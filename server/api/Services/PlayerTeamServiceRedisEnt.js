const SeriesSquad = require('../../models/series-squad');
const SeriesPlayer = require('../../models/series-player');
const LiveScore = require('../../models/live-score');
const { isEmpty, _ } = require('lodash');
const redisKeys = require('../../constants/redis-keys');
const redisEnt = require('../../../lib/redisEnterprise');

class PlayerTeamServiceRedisEnt {

    static async getCachePlayerList(reqData, cb) {
        const { match_id, sport } = reqData;
        const mpKey = `${redisKeys.MATCH_PLAYER_LIST}${match_id}-${sport}`
        
        let redisData = await redisEnt.getNormalRedis(mpKey);
        if (!isEmpty(redisData)) {
            return cb(null, redisData)
        } else {
            return PlayerTeamServiceRedisEnt.getDbPlayerList(reqData, cb, true)
        }
    }

    static async getDbPlayerList(reqData, cb, setCache) {
        let { series_id, match_id, sport, localteamId, visitorteamId,playing_11 } = reqData;
        series_id = parseInt(series_id)
        match_id  = parseInt(match_id)
        sport     = parseInt(sport) || 1;
        playing_11     = playing_11 || [];

        var newLocalteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${localteamId}`;
        var newVisitorteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${visitorteamId}`;
        
        let apiList = [
            redisEnt.getNormalRedis(newLocalteamIdKey),
            redisEnt.getNormalRedis(newVisitorteamIdKey)
        ];
        var redisResults = await Promise.all(apiList);

        let playerIdsArr = [];
        let playerRcdData = [];
        if(redisResults && redisResults[0] && redisResults[0] != undefined && redisResults[1] && redisResults[1] != undefined) {
            playerRcdData = redisResults[0].concat(redisResults[1])
        }
        
        if (!isEmpty(playerRcdData)) {
            playerIdsArr = _.map(playerRcdData, 'player_id');
        } else {
            let cond = {};
            cond.sport = sport;
            cond.series_id = series_id
            cond.team_id = { "$in": [localteamId, visitorteamId] };
            const projection = {
                player_id: 1,
                series_id: 1,
                team_id: 1,
                odi: 1,
                player_credit: 1,
                player_name: 1,
                player_role: 1,
                series_name: 1,
                sport: 1,
                t10:1,
                t100:1,
                t20: true,
                team_name: 1,
                test: 1,
                image: 1,
                is_lastplayed: {$cond: { if: { $ifNull: [ "$is_lastplayed", 0 ] }, then: "$is_lastplayed", else: 0}},
            }
            playerRcdData = await SeriesPlayer.find(cond, projection).lean();
            playerIdsArr = _.map(playerRcdData, 'player_id');
        }
        SeriesSquad.collection.aggregate([
            {
                $match: { series_id, match_id, status: 1, sport: sport }
            },

            {
                $lookup: {
                    from: LiveScore.collection.collectionName,
                    let: {
                        seriesId: "$series_id",
                        matchId: "$match_id",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $eq: [ "$match_id", "$$matchId" ] },
                                        { $in: [ "$player_id", playerIdsArr ] }
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
                        matchType: "$type",
                    },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: [ "$series_id", "$$seriesId" ] },
                                        { $in: [ "$player_id", playerIdsArr ] },
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
                    "series_id": 1,
                    "match_id": 1,
                    "player_point": "$liveScore.point",
                    "series_point": { $cond: { if: { $ne: ["$seriesScore", ''] }, then: "$seriesScore.player_points", else: 0 } },
                    "match_type": { $toLower: "$type" },
                    "selected_by": '0%',
                    "captain_selected": '0%',
                    "vice_captain_selected": '0%',
                    "one_five_x_selected": '0%',
                    "two_x_selected": '0%',
                    "three_x_selected": '0%',
                    "four_x_selected": '0%',
                    "five_x_selected": '0%',
                    "player_record": "$playerRecord",
                    "playing_11": 1,
                    "xfactors": 1
                }
            },
        ]).toArray((error, results) => {
            if (error) {
                console.error("PlayerTeam.getDbPlayerList catch error", error)
                return cb(error);
            }
            if (results && results.length > 0) {
                
                redisEnt.getNormalFunRedis(redisKeys.getMatchPlayerStatsKey(match_id, sport),async (redisErr, playerStats) => {
                    let commonData = results[0];
                    
                    let i = 0;
                    let resultNew = [];
                    let playerIds = [];
                    for (let playerData of playerRcdData) {
                        
                        playerData.match_id = commonData.match_id;
                        playerData.series_id = commonData.series_id;
                        playerData.match_type = commonData.match_type;
                        playerData.selected_by = commonData.selected_by;
                        playerData.captain_selected = commonData.captain_selected;
                        playerData.vice_captain_selected = commonData.vice_captain_selected;
                        playerData.one_five_x_selected = commonData.one_five_x_selected;
                        playerData.two_x_selected = commonData.two_x_selected;
                        playerData.three_x_selected = commonData.three_x_selected;
                        playerData.four_x_selected = commonData.four_x_selected;
                        playerData.five_x_selected = commonData.five_x_selected;
                        playerData.is_local_team = (localteamId==playerData.team_id ? true : false);
                        playerData.is_last_played = playerData.is_lastplayed;
                        playerData.player_record = {
                            player_id: playerData.player_id,
                            series_id: commonData.series_id,
                            player_credit: playerData.player_credit,
                            player_name: playerData.player_name,
                            playing_role: playerData.player_role,
                            sport: playerData.sport,
                            image: playerData.image
                        }

                        if (sport == 1 && (playerData.match_type === "t10" && playerData.t10 === true) || (playerData.match_type === "odi" && playerData.odi === true) || (playerData.match_type === "t20" && playerData.t20 === true) || (playerData.match_type === "test" && playerData.test === true) || (playerData.match_type === "t100" && playerData.t100 === true)) {

                            if (playerData.player_record && playerData.player_record._id) playerData.player_record.id = playerData.player_record._id;
                            if (playerData && playerData.player_record) playerData.player_record.image = (playerData && playerData.image? playerData.image:"");
                            // if (playerData.player_record && playerData.player_record.image) playerData.player_record.image = config.imageBaseUrl + '/player_image/' + playerData.player_record.image;
                            
                            if (playing_11 && playing_11.length > 0) {
                                playerData.is_playing_show = 1
                                playerData.is_playing = (playing_11.indexOf(playerData.player_id) > -1) ? 1 : 0;
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

                                playerData.one_five_x_selected = (playerStats[playerData.player_id]["oneFivexSelected"] && playerStats[playerData.player_id]["oneFivexSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["oneFivexSelected"]}%` : "0%";
                                playerData.two_x_selected = (playerStats[playerData.player_id]["twoxSelected"] && playerStats[playerData.player_id]["twoxSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["twoxSelected"]}%` : "0%";
                                playerData.three_x_selected = (playerStats[playerData.player_id]["threexSelected"] && playerStats[playerData.player_id]["threexSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["threexSelected"]}%` : "0%";
                                playerData.four_x_selected = (playerStats[playerData.player_id]["fourxSelected"] && playerStats[playerData.player_id]["fourxSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["fourxSelected"]}%` : "0%";
                                playerData.five_x_selected = (playerStats[playerData.player_id]["fivexSelected"] && playerStats[playerData.player_id]["fivexSelected"] != 'NaN') ? `${playerStats[playerData.player_id]["fivexSelected"]}%` : "0%";
                            }
                            resultNew.push(playerData);
                        } 
                        if(sport == 2 || sport == 4) {
                            if (playerData.player_record && playerData.player_record._id) playerData.player_record.id = playerData.player_record._id;
                            if (playerData.player_record && playerData.player_record.image) playerData.player_record.image = playerData.player_record.image;
                            
                            if (playing_11 && playing_11.length > 0) {
                                playerData.is_playing_show = 1
                                playerData.is_playing = (playing_11.indexOf(playerData.player_id) > -1) ? 1 : 0;
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
                        }
                        i++;
                    }
                    
                    if(playerIds && playerIds.length>=11){
                        await SeriesPlayer.updateMany({series_id:series_id,player_id:{$in:playerIds}},{$set:{is_lastplayed:1}});
                    }
                   
                    if (setCache) {
                        const mpKey = redisKeys.getMatchPlayerListKey(match_id, sport)
                        // setRedis(mpKey, resultNew);
                        redisEnt.setNormalRedis(mpKey, resultNew);
                    }
                    return cb(null, resultNew);

                });
            } else {
                return cb(new Error('record not found....'));
            }
        })
    }

    static async getUserCreatedTeam(series_id, match_id, sport, team_count, teamData) {
        const team = [teamData];
        const results = await SeriesSquad.find({'series_id': series_id, 'match_id': match_id, 'sport': sport}, {localteam_id:1, visitorteam_id:1 });
        
        let localteamId = results[0].localteam_id
        let visitorteamId = results[0].visitorteam_id
        let reqData = {series_id, match_id, sport, localteamId, visitorteamId};
        const mpKey = `${redisKeys.MATCH_PLAYER_LIST}${match_id}-${sport}`
        let redisData = await redisEnt.getNormalRedis(mpKey);
        if(isEmpty(redisData) && redisData == undefined) {
            redisData = await PlayerTeamServiceRedisEnt.getTeamsPlayersDB(reqData);
        }
        
        let playerShortDetails = [];
        let data1 = {};
        for (let playerData of team) {
            let totalBowler = 0;
            let totalBatsman = 0;
            let totalWicketkeeper = 0;
            let totalAllrounder = 0;
            let totalDefender   =   0;  // football && kabaddi player role
            let totalForward    =   0;  // football player role
            let totalGoalkeeper =   0;  // football player role
            let totalMidfielder =   0;  // football player role
            let totalRaider     =   0;  // kabaddi player role

            playerShortDetails = redisData.map(
                item => {
                    if(_.includes(playerData.players, item.player_id) && item != undefined) {
                        if(sport == 1) {
                            if (item.player_role && item.player_role.indexOf('Wicketkeeper') > -1) {
                                totalWicketkeeper += 1;
                            } else if (item.player_role && item.player_role.indexOf('Bowler') > -1) {
                                totalBowler += 1;
                            } else if (item.player_role && item.player_role.indexOf('Batsman') > -1) {
                                totalBatsman += 1;
                            } else if (item.player_role && item.player_role.indexOf('Allrounder') > -1) {
                                totalAllrounder += 1;
                            }
                        }
                        if(sport == 2) {
                            // total player role count for football
                            if (item.player_role && item.player_role.indexOf('Defender') > -1) {
                                totalDefender += 1;
                            } else if (item.player_role && item.player_role.indexOf('Forward') > -1) {
                                totalForward += 1;
                            } else if (item.player_role && item.player_role.indexOf('Goalkeeper') > -1) {
                                totalGoalkeeper += 1;
                            } else if (item.player_role && item.player_role.indexOf('Midfielder') > -1) {
                                totalMidfielder += 1;
                            }
                        }
                        if(sport == 4) {
                            // total player role count for kabaddi
                            if (item.player_role && item.player_role.indexOf('Defender') > -1) {
                                totalDefender += 1;
                            } else if (item.player_role && item.player_role.indexOf('Allrounder') > -1) {
                                totalAllrounder += 1;
                            } else if (item.player_role && item.player_role.indexOf('Raider') > -1) {
                                totalRaider += 1;
                            }
                        }
                        
                        return {
                            name: item.player_name,
                            player_id: item.player_id,
                            image: item.image,
                            role: item.player_role,
                            credits: item.player_credit,
                            points: 0,
                            is_local_team: item.is_local_team
                        }
                    }
                }
                
            );
            playerShortDetails = playerShortDetails.filter(function( element ) {
                return element !== undefined;
            });
            data1._id = playerData._id;
            data1.series_id = playerData.series_id;
            data1.match_id = playerData.match_id;
            data1.teamid = playerData._id;
            data1.team_number = playerData.team_count;
            data1.captain_player_id = playerData.captain;
            data1.vice_captain_player_id = playerData.vice_captain;
            data1.one_five_x = playerData.one_five_x;
            data1.two_x = playerData.two_x;
            data1.three_x = playerData.three_x ? playerData.three_x : 0,
            data1.four_x = playerData.four_x ? playerData.four_x : 0,
            data1.five_x = playerData.five_x ? playerData.five_x : 0,
            data1.x_counter = playerData.x_counter;
            data1.total_bowler = totalBowler;
            data1.total_batsman = totalBatsman;
            data1.total_wicketkeeper = totalWicketkeeper;
            data1.total_allrounder = totalAllrounder; // cricket and kabaddi player
            data1.total_defender = totalDefender,    // football & kabaddi player
            data1.total_forward = totalForward,  // football player
            data1.total_goalkeeper = totalGoalkeeper,    // football player
            data1.total_midfielder = totalMidfielder,    // football player
            data1.total_raider = totalRaider,    // kabaddi player
            data1.player_details = playerShortDetails;
            data1.substitute_detail = {};
            data1.my_teams = team_count;
            data1.my_contests = 0;
        }
        return data1
        
    }

    static async getTeamsPlayersDB(reqData) {
        return new Promise((resolve, reject) => {
            PlayerTeamServiceRedisEnt.getDbPlayerList(reqData, (err, playerList) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(playerList);
                }
                
            })
        });
    }
}

module.exports = PlayerTeamServiceRedisEnt;