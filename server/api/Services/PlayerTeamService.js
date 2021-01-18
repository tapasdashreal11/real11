const SeriesSquad = require('../../models/series-squad');
const SeriesPlayer = require('../../models/series-player');
const Series = require('../../models/series');
const PlayerRecord = require('../../models/player-record');
const PlayerTeam = require('../../models/player-team');
const PlayerTeamContest = require('../../models/player-team-contest');
const MatchContest = require('../../models/match-contest');
const Team = require('../../models/team');
const User = require('../../models/user');
const LiveScore = require('../../models/live-score');
const PointSystem = require('../../models/point-system');
const Contest = require('../../models/contest');
const PointsBreakup = require('../../models/points-breakup');
const { ObjectId } = require('mongodb');
const { isEmpty, _ } = require('lodash');
const UserService = require('./UserService');
const { setRedis, getRedis } = require('../../../lib/redis');
const redisKeys = require('../../constants/redis-keys');
const config = require('../../config');
var MongoObjectID = require('mongodb').ObjectID;

class PlayerTeamService {
    static getDbPointSystem(cb, setCache) {
        PointSystem.collection.find({}).toArray((err, results) => {
            if (setCache && results) {
                setRedis(redisKeys.POINTS_BREAKUPS, results);
            }
            return cb(err, results);
        })
    }
    static getCachePointSystem(cb) {
        getRedis(redisKeys.POINTS_BREAKUPS, (err, data) => {
            if (data) {
                return cb(err, data)
            } else {
                return PlayerTeamService.getDbPointSystem(cb, true)
            }
        })
    }

    static getDbPlayerList(reqData, cb, setCache) {
        let { series_id, match_id, sport } = reqData;
        series_id = parseInt(series_id)
        match_id  = parseInt(match_id)
        sport     = parseInt(sport) || 1;
        SeriesSquad.collection.aggregate([
            {
                $match: { series_id, match_id, status: 1, sport: sport }
            },
            {
                $lookup: {
                    from: SeriesPlayer.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        localteamId: "$localteam_id",
                        visitorteamId: "$visitorteam_id"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $in: [ "$team_id", ["$$localteamId", "$$visitorteamId"], ] }
                                    ]
                                }
                            }
                        },
                        {
                            $addFields: {
                                is_local_team: { $eq: ["$$localteamId", "$team_id"] },
                            }
                        }
                    ],
                    as: "seriesplayers"
                }
            },
            {
                $unwind: {
                    path: "$seriesplayers",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $lookup: {
                    from: PlayerRecord.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        playerId: "$seriesplayers.player_id"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$series_id", "$$seriesId"] },
                                        { $eq: ["$player_id", "$$playerId"] }
                                    ]
                                }
                            }
                        },
                        {
                            $addFields: {
                                player_credit: { $toString: "$player_credit" }
                            }
                        },
                        { $limit: 1 }
                    ],
                    as: "playerRecord"
                }
            },
            {
                $unwind: {
                    path: "$playerRecord",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $lookup: {
                    from: LiveScore.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        matchId: "$match_id",
                        playerId: "$seriesplayers.player_id",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $eq: [ "$match_id", "$$matchId" ] },
                                        { $eq: [ "$player_id", "$$playerId" ] }
                                    ]
                                }
                            }
                        },
                        { $sort: { "created": -1 } },
                        { $limit: 1 },
                        { $project: { point: 1, match_type: 1 } }
                    ],
                    as: "liveScore"
                }
            },
            {
                $unwind: {
                    path: "$liveScore",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: LiveScore.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        playerId: "$seriesplayers.player_id",
                        matchType: "$type",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $eq: [ "$player_id", "$$playerId" ] },
                                        { $eq: [ "$match_type", "$$matchType" ] }
                                    ]
                                }
                            }
                        },
                        { $sort: { "created": -1 } },
                        {
                            $group: {
                                _id: "$player_id",
                                player_points: { $sum: '$point' }
                            }
                        },
                    ],
                    as: "seriesScore"
                }
            },
            {
                $unwind: {
                    path: "$seriesScore",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    "_id": "$seriesplayers._id",
                    "series_id": 1,
                    "match_id": 1,
                    "series_name": "$seriesplayers.series_name",
                    "team_id": "$seriesplayers.team_id",
                    "is_local_team": "$seriesplayers.is_local_team",
                    "team_name": "$seriesplayers.team_name",
                    "player_id": "$seriesplayers.player_id",
                    "player_name": "$seriesplayers.player_name",
                    "player_role": "$seriesplayers.player_role",
                    "sport": "$seriesplayers.sport",
                    "odi": { $toBool: "$seriesplayers.odi" },
                    "t20": { $toBool: "$seriesplayers.t20" },
                    "t10": { $toBool: "$seriesplayers.t10" },
                    "test": { $toBool: "$seriesplayers.test" },
                    "player_point": "$liveScore.point",
                    "series_point": { $cond: { if: { $ne: ["$seriesScore", ''] }, then: "$seriesScore.player_points", else: 0 } },
                    "match_type": { $toLower: "$type" },
                    "selected_by": '0%',
                    "captain_selected": '0%',
                    "vice_captain_selected": '0%',
                    "player_record": "$playerRecord",
                    "playing_11": 1,
                    "xfactors": 1,
                    "is_last_played": true,
                }
            },
        ]).toArray((error, results) => {
            // console.log(results);return false;
            if (error) {
                console.error("PlayerTeam.getDbPlayerList catch error", error)
                return cb(error);
            }
            if (results && results.length > 0) {
                getRedis(redisKeys.getMatchPlayerStatsKey(match_id, sport), (redisErr, playerStats) => {
                    let i = 0;
                    let resultNew = [];
                    for (let playerData of results) {
                        // console.log(playerData.player_id,i,playerData.match_type,playerData.t20);

                        if ((playerData.match_type === "t10" && playerData.t10 === true) || (playerData.match_type === "odi" && playerData.odi === true) || (playerData.match_type === "t20" && playerData.t20 === true) || (playerData.match_type === "test" && playerData.test === true)) {

                            if (playerData.player_record && playerData.player_record._id) playerData.player_record.id = playerData.player_record._id;
                            if (playerData.player_record && playerData.player_record.image) playerData.player_record.image = playerData.player_record.image;
                            // if (playerData.player_record && playerData.player_record.image) playerData.player_record.image = config.imageBaseUrl + '/player_image/' + playerData.player_record.image;
                            if (playerData.playing_11 && playerData.playing_11.length > 0) {
                                playerData.is_playing_show = 1
                                playerData.is_playing = (playerData.playing_11.indexOf(playerData.player_id) > -1) ? 1 : 0;
                            } else {
                                playerData.is_playing_show = 0
                                playerData.is_playing = 0
                            }
                            if (playerData.xfactors && playerData.xfactors.length > 0) {
                                playerData.is_xfactor = (playerData.xfactors.indexOf(playerData.player_id) > -1) ? 1 : 0;
                            } else {
                                playerData.is_xfactor = 0
                            }

                            if (playerStats && playerStats[playerData.player_id]) {

                                playerData.selected_by = (playerStats[playerData.player_id]["selectedBy"] && playerStats[playerData.player_id]["selectedBy"] != "NaN") ? `${playerStats[playerData.player_id]["selectedBy"]}%` : "0%";
                                playerData.captain_selected = (playerStats[playerData.player_id]["captainSelected"] && playerStats[playerData.player_id]["captainSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["captainSelected"]}%` : "0%";
                                playerData.vice_captain_selected = (playerStats[playerData.player_id]["viceCaptainSelected"] && playerStats[playerData.player_id]["viceCaptainSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["viceCaptainSelected"]}%` : "0%";
                            }
                            resultNew.push(playerData);
                        }
                        i++;
                    }
                    // console.log(results.length);
                    if (setCache) {
                        const mpKey = redisKeys.getMatchPlayerListKey(match_id, sport)
                        setRedis(mpKey, resultNew);
                    }
                    return cb(null, resultNew);

                });
            } else {
                return cb(new Error('record not found....'));
            }
        })
    }

    static getDbFootballPlayerList(reqData, cb, setCache) {
        let { series_id, match_id, sport } = reqData;
        series_id = parseInt(series_id)
        match_id = parseInt(match_id)
        sport = parseInt(sport) || 1;
        SeriesSquad.collection.aggregate([
            {
                $match: { series_id, match_id, status: 1, sport:sport }
            },
            {
                $lookup: {
                    from: SeriesPlayer.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        localteamId: "$localteam_id",
                        visitorteamId: "$visitorteam_id"
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $in: [ "$team_id", ["$$localteamId", "$$visitorteamId"], ] }
                                    ]
                                }
                            }
                        },
                        {
                            $addFields: {
                                is_local_team: { $eq: ["$$localteamId", "$team_id"] },
                            }
                        }
                    ],
                    as: "seriesplayers"
                }
            },
            {
                $unwind: {
                    path: "$seriesplayers",
                    preserveNullAndEmptyArrays: false
                }
            },
            {
                $lookup: {
                    from: LiveScore.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        matchId: "$match_id",
                        playerId: "$seriesplayers.player_id",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $eq: [ "$match_id", "$$matchId" ] },
                                        { $eq: [ "$player_id", "$$playerId" ] }
                                    ]
                                }
                            }
                        },
                        { $sort: { "created": -1 } },
                        { $limit: 1 },
                        { $project: { point: 1, match_type: 1 } }
                    ],
                    as: "liveScore"
                }
            },
            {
                $unwind: {
                    path: "$liveScore",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: LiveScore.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        playerId: "$seriesplayers.player_id",
                        matchType: "$type",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $eq: [ "$player_id", "$$playerId" ] },
                                        { $eq: [ "$match_type", "$$matchType" ] }
                                    ]
                                }
                            }
                        },
                        { $sort: { "created": -1 } },
                        {
                            $group: {
                                _id: "$player_id",
                                player_points: { $sum: '$point' }
                            }
                        },
                    ],
                    as: "seriesScore"
                }
            },
            {
                $unwind: {
                    path: "$seriesScore",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    "_id": "$seriesplayers._id",
                    "series_id": 1,
                    "match_id": 1,
                    "series_name": "$seriesplayers.series_name",
                    "team_id": "$seriesplayers.team_id",
                    "is_local_team": "$seriesplayers.is_local_team",
                    "team_name": "$seriesplayers.team_name",
                    "player_id":{ $toLong: "$seriesplayers.player_id"},
                    "player_name": "$seriesplayers.player_name",
                    "player_role": "$seriesplayers.player_role",
                    "sport": "$seriesplayers.sport",
                    "player_point": "$liveScore.point",
                    "series_point": { $cond: { if: { $ne: ["$seriesScore", ''] }, then: "$seriesScore.player_points", else: 0 } },
                    "match_type": { $toLower: "$type" },
                    "selected_by": '0%',
                    "captain_selected": '0%',
                    "vice_captain_selected": '0%',
                    "player_record": {
                        "_id": "$seriesplayers._id",
                        "player_id": { $toLong: "$seriesplayers.player_id"},
                        "series_id": "$seriesplayers.series_id",
                        "player_credit": {$toString: "$seriesplayers.player_credit"},
                        "player_name": "$seriesplayers.player_name",
                        "playing_role": "$seriesplayers.player_role",
                        "sport": sport,
                        "image": "undefined",
                        "id": "$seriesplayers._id"
                    },
                    "playing_11": 1,
                    "is_last_played": true,
                }
            },
        ]).toArray((error, results) => {
            if (error) {
                console.error("PlayerTeam.getDbPlayerList catch error", error)
                return cb(error);
            }
            if (results && results.length > 0) {
                getRedis(redisKeys.getMatchPlayerStatsKey(match_id, sport), (redisErr, playerStats) => {
                    let i = 0;
                    let resultNew = [];
                    for (let playerData of results) {

                        if (playerData.player_record && playerData.player_record._id) playerData.player_record.id = playerData.player_record._id;
                        if (playerData.player_record && playerData.player_record.image) playerData.player_record.image = playerData.player_record.image;
                        
                        if (playerData.playing_11 && playerData.playing_11.length > 0) {
                            playerData.is_playing_show = 1
                            playerData.is_playing = (playerData.playing_11.indexOf(playerData.player_id) > -1) ? 1 : 0;
                        } else {
                            playerData.is_playing_show = 0
                            playerData.is_playing = 0
                        }
                        if (playerStats && playerStats[playerData.player_id]) {
                            playerData.selected_by = (playerStats[playerData.player_id]["selectedBy"] && playerStats[playerData.player_id]["selectedBy"] != "NaN") ? `${playerStats[playerData.player_id]["selectedBy"]}%` : "0%";
                            playerData.captain_selected = (playerStats[playerData.player_id]["captainSelected"] && playerStats[playerData.player_id]["captainSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["captainSelected"]}%` : "0%";
                            playerData.vice_captain_selected = (playerStats[playerData.player_id]["viceCaptainSelected"] && playerStats[playerData.player_id]["viceCaptainSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["viceCaptainSelected"]}%` : "0%";
                        }
                        resultNew.push(playerData);
                        i++;
                    }
                    
                    if (setCache) {
                        const mpKey = redisKeys.getMatchPlayerListKey(match_id, sport)
                        setRedis(mpKey, resultNew);
                    }
                    return cb(null, resultNew);

                });
            } else {
                return cb(new Error('record not found'));
            }
        })
    }

    static getCachePlayerList(reqData, cb) {
        const { match_id, sport } = reqData;
        let sportType = parseInt(sport) || 1;
        // console.log(reqData, sportType);return false;
        const mpKey = redisKeys.getMatchPlayerListKey(match_id, sport)
        
        getRedis(mpKey, (err, data) => {
            if (!isEmpty(data)) {
                return cb(err, data)
            } else {
                if(sportType == 1) {
                    return PlayerTeamService.getDbPlayerList(reqData, cb, true)
                } else {
                    return PlayerTeamService.getDbFootballPlayerList(reqData, cb, true)
                }
            }
        })
    }

    static getPlayerTeamList(reqData, playerTeamRecord, cb) {
        if (!playerTeamRecord || playerTeamRecord.length === 0) {
            return cb(null, []);
        }
        // console.log(reqData);return false;
        let { match_id, series_id, team_no, user_id, sport } = reqData;
        let data = [];
        let filter = {};
        if (team_no) {
            filter.team_count = team_no
        }
        filter.sport = parseInt(sport) || 1;

        let myContest = 0;
        let myTeams = 0;

        PlayerTeamService.getCachePlayerList({ series_id, match_id, sport }, (err, playerListData) => {
            if (err) {
                console.error("PlayerTeamService > getDbPlayerTeamList > PlayerTeamService.getCachePlayerList > err ", err);
                return cb(err);
            }
            if (playerListData) {
                if(sport == 1) {
                    PlayerTeamService.getCachePointSystem((err, pointSystemsData) => {
                        if (err) {
                            console.error("PlayerTeamService > getDbPlayerTeamList > PlayerTeamService.getCachePlayerList > PlayerTeamService.getCachePointSystem > err ", err);
                            return cb(err);
                        }
                        const mType = playerListData[0].match_type;
                        // console.log(playerListData[0],'playerData');return false;
                        if (pointSystemsData) {
                            PlayerTeamService.getPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, mType, pointSystemsData, playerListData, data, function (resData) {
                                return cb(null, resData)
                            }); 
                        } 
                    })
                } else {
                    // console.log(data);return false;
                    PlayerTeamService.getFootballPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, playerListData, data, function (resData) {
                        return cb(null, resData)
                    });
                    // console.log('footabll');return false;
                }
            }
        })

    }

    static getPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, mType, pointSystemsData, playerListData, data, cb) {
        try {
            if (playerTeamRecord.length > 0) {
                
                let index = 0;
                let matchType = 1
                if ((mType == 'Test') || (mType == 'First-class')) {
                    matchType = 3;
                } else if (mType == 'ODI') {
                    matchType = 2;
                } else if (mType == 'T20') {
                    matchType = 1;
                } else if (mType == 'T10' || mType == 'other') {
                    matchType = 4;
                }

                const pointSystemData = pointSystemsData.find((item) => item.matchType == matchType)
                let totalBowler = 0;
                let totalBatsman = 0;
                let totalWicketkeeper = 0;
                let totalAllrounder = 0;
                let playerDetail = []

                for (let j = 0; j < playerTeamRecord[index].players.length; j++) {
                    playerTeamRecord[index].players[j] = playerListData.find((item) => item.player_id == playerTeamRecord[index].players[j])
                    if (playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j]._id) {
                        if (pointSystemData && playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j].player_id && playerTeamRecord[index].captain && playerTeamRecord[index].captain == playerTeamRecord[index].players[j].player_id) {
                            playerTeamRecord[index].players[j].player_point = playerTeamRecord[index].players[j].player_point * pointSystemData.othersCaptain
                        }
                        if (pointSystemData && playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j].player_id && playerTeamRecord[index].vice_captain && playerTeamRecord[index].vice_captain == playerTeamRecord[index].players[j].player_id) {
                            playerTeamRecord[index].players[j].player_point = playerTeamRecord[index].players[j].player_point * pointSystemData.othersViceCaptain
                        }
                        playerDetail[j] = {};
                        // console.log(playerTeamRecord[index].players[j].player_name.split(" ").length);
                        // playerDetail[j]['name']		=	(playerTeamRecord[index].players[j].player_name.split(" ").length > 1) ? playerTeamRecord[index].players[j].player_name : 'a '+playerTeamRecord[index].players[j].player_name;
                        playerDetail[j]['name'] = playerTeamRecord[index].players[j].player_name;
                        playerDetail[j]['player_id'] = playerTeamRecord[index].players[j].player_id;
                        playerDetail[j]['image'] = playerTeamRecord[index].players[j].image;
                        playerDetail[j]['role'] = playerTeamRecord[index].players[j].player_role;
                        playerDetail[j]['credits'] = (playerTeamRecord[index].players[j].player_record && playerTeamRecord[index].players[j].player_record.player_credit) ? Number(playerTeamRecord[index].players[j].player_record.player_credit) : 0;
                        playerDetail[j]['points'] = playerTeamRecord[index].players[j].player_point ? playerTeamRecord[index].players[j].player_point : 0;
                        playerDetail[j]['is_local_team'] = playerTeamRecord[index].players[j].is_local_team;

                        if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Wicketkeeper') > -1) {
                            totalWicketkeeper += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Bowler') > -1) {
                            totalBowler += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Batsman') > -1) {
                            totalBatsman += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Allrounder') > -1) {
                            totalAllrounder += 1;
                        }
                    }
                }

                let indexObj = {
                    '_id': playerTeamRecord[index]._id,
                    'series_id': playerTeamRecord[index].series_id,
                    'match_id': playerTeamRecord[index].match_id,
                    'teamid': playerTeamRecord[index]._id,
                    'team_number': playerTeamRecord[index].team_count,
                    'total_point': playerTeamRecord[index].points,
                    'captain_player_id': playerTeamRecord[index].captain,
                    'vice_captain_player_id': playerTeamRecord[index].vice_captain,
                    'total_bowler': totalBowler,
                    'total_batsman': totalBatsman,
                    'total_wicketkeeper': totalWicketkeeper,
                    'total_allrounder': totalAllrounder,
                    'player_details': playerDetail,
                    'substitute_detail': {},
                    'my_teams': myTeams,
                    'my_contests': myContest
                }

                data.push(indexObj);
                playerTeamRecord.splice(0,1);
                PlayerTeamService.getPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, mType, pointSystemsData, playerListData, data, cb);
            }else{
                cb(data)
            }
        } catch (error) {
            console.log("error", error)
        }
    }

    static getFootballPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, playerListData, data, cb) {
        try {
            if (playerTeamRecord.length > 0) {
                
                let index = 0;
                let totalDefender   =   0;
                let totalForward    =   0;
                let totalGoalkeeper =   0;
                let totalMidfielder =   0;
                let playerDetail    =   []

                for (let j = 0; j < playerTeamRecord[index].players.length; j++) {
                    playerTeamRecord[index].players[j] = playerListData.find((item) => item.player_id == playerTeamRecord[index].players[j])
                    if (playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j]._id) {
                        if (playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j].player_id && playerTeamRecord[index].captain && playerTeamRecord[index].captain == playerTeamRecord[index].players[j].player_id) {
                            playerTeamRecord[index].players[j].player_point = playerTeamRecord[index].players[j].player_point * 2;
                        }
                        if (playerTeamRecord[index].players[j] && playerTeamRecord[index].players[j].player_id && playerTeamRecord[index].vice_captain && playerTeamRecord[index].vice_captain == playerTeamRecord[index].players[j].player_id) {
                            playerTeamRecord[index].players[j].player_point = playerTeamRecord[index].players[j].player_point * 1.5;
                        }
                        playerDetail[j] = {};
                        playerDetail[j]['name']     =   playerTeamRecord[index].players[j].player_name;
                        playerDetail[j]['player_id']=   playerTeamRecord[index].players[j].player_id;
                        playerDetail[j]['image']    =   playerTeamRecord[index].players[j].image;
                        playerDetail[j]['role']     =   playerTeamRecord[index].players[j].player_role;
                        playerDetail[j]['credits']  =   (playerTeamRecord[index].players[j].player_record && playerTeamRecord[index].players[j].player_record.player_credit) ? Number(playerTeamRecord[index].players[j].player_record.player_credit) : 0;
                        playerDetail[j]['points']   =   playerTeamRecord[index].players[j].player_point ? playerTeamRecord[index].players[j].player_point : 0;
                        playerDetail[j]['is_local_team'] = playerTeamRecord[index].players[j].is_local_team;
                        // console.log(playerTeamRecord[index].players[j].player_role);
                        if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Defender') > -1) {
                            totalDefender += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Forward') > -1) {
                            totalForward += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Goalkeeper') > -1) {
                            totalGoalkeeper += 1;
                        } else if (playerTeamRecord[index].players[j].player_role && playerTeamRecord[index].players[j].player_role.indexOf('Midfielder') > -1) {
                            totalMidfielder += 1;
                        }
                    }
                }

                let indexObj = {
                    '_id': playerTeamRecord[index]._id,
                    'series_id': playerTeamRecord[index].series_id,
                    'match_id': playerTeamRecord[index].match_id,
                    'teamid': playerTeamRecord[index]._id,
                    'team_number': playerTeamRecord[index].team_count,
                    'total_point': playerTeamRecord[index].points,
                    'captain_player_id': playerTeamRecord[index].captain,
                    'vice_captain_player_id': playerTeamRecord[index].vice_captain,
                    'total_defender': totalDefender,
                    'total_forward': totalForward,
                    'total_goalkeeper': totalGoalkeeper,
                    'total_midfielder': totalMidfielder,
                    'player_details': playerDetail,
                    'substitute_detail': {},
                    'my_teams': myTeams,
                    'my_contests': myContest
                }

                data.push(indexObj);
                playerTeamRecord.splice(0,1);
                PlayerTeamService.getFootballPlayerTeamListSecondLoop(playerTeamRecord, myContest, myTeams, playerListData, data, cb);
            } else {
                cb(data)
            }
        } catch (error) {
            console.log("error", error)
        }
    }

    static getDbPlayerTeamList(reqData, cb, setCache) {
        let { match_id, series_id, team_no, user_id, sport } = reqData;
        let filter = { match_id, series_id };
        if (user_id && MongoObjectID.isValid(user_id)) {
            filter['user_id'] = MongoObjectID(user_id);
        }
        if (team_no) {
            filter.team_count = team_no
        }
        filter.sport = parseInt(sport) || 1;
        PlayerTeam.collection.find(filter).limit(15).toArray((err, playerTeamRecord) => {
            if (err) {
                console.error("PlayerTeamService > getDbPlayerTeamList > err ", err);
                return cb(err);
            } else if (playerTeamRecord) {
                if (setCache) {
                    UserService.setRedisUserData(user_id, { playerTeamData: playerTeamRecord }, match_id)
                }
                return PlayerTeamService.getPlayerTeamList(reqData, playerTeamRecord, cb)
            } else {
                return cb(new Error("record not found"));
            }

        });

    }
    static getCachePlayerTeamList(reqData, cb) {
        let { user_id, match_id, sport } = reqData;
        sport   =   parseInt(sport) || 1;
        // console.log(reqData,"reqData");return false;
        UserService.getRedisUserData(user_id, function (err, playerTeamData) {
            // console.log(playerTeamData);return false;
            if (playerTeamData && playerTeamData.length > 0) {
                return PlayerTeamService.getPlayerTeamList(reqData, playerTeamData, cb)
            } else {
                return PlayerTeamService.getDbPlayerTeamList(reqData, cb, true)
            }
        }, match_id, 'playerTeamData')
    }
    static setRedisUserPlayerTeamData(user_id, match_id, newPlayerTeamData, callback) {
        UserService.getRedisUserData(user_id, function (err, playerTeamData) {
            if (!playerTeamData) {playerTeamData= []}
            playerTeamData.push(newPlayerTeamData);
            UserService.setRedisUserData(user_id, { playerTeamData }, match_id);
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, match_id, 'playerTeamData');
    }

    static updateRedisUserPlayerTeamData(user_id, match_id, newPlayerTeamData, team_id ,callback) {
        UserService.getRedisUserData(user_id, function (err, playerTeamData) {
            newPlayerTeamData._id= team_id;
            let catIndex = _.findIndex(playerTeamData, { "_id": team_id });
            if(catIndex != -1) {
                playerTeamData[catIndex]    =   newPlayerTeamData;
            } else {
                playerTeamData  =   [];
                playerTeamData.push(newPlayerTeamData);
            }
            UserService.setRedisUserData(user_id, { playerTeamData }, match_id);
            if (callback && typeof callback === 'function') {
                callback();
            }
        }, match_id, 'playerTeamData');
    }
}

module.exports = PlayerTeamService;