const SeriesSquad = require('../../../models/series-squad');
const SeriesPlayer = require('../../../models/series-player');
const PlayerRecord = require('../../../models/player-record');
const PlayerTeam = require('../../../models/player-team');
const LiveScore = require('../../../models/live-score')

const ApiUtility = require('../../api.utility');
const { ObjectId } = require('mongodb');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const redisEnt = require('../../../../lib/redisEnterprise');
const redisKeys = require('../../../constants/redis-keys');
const PlayerTeamService = require('../../Services/PlayerTeamService');
const PlayerTeamServiceRedisEnt = require('../../Services/PlayerTeamServiceRedisEnt');
const AWS = require('aws-sdk');
const { isEmpty } = require('lodash');
const { resolve } = require('path');

module.exports = {

    playerTeamListRedisEnt: async (req, res) => {
        var _this = this;
        let { match_id, series_id, team_no, user_id, sport } = req.params;
        if (!user_id) {
            user_id = req.userId;
        }
        sport = sport || 1;

        match_id = parseInt(match_id);
        series_id = parseInt(series_id);

        if (!user_id || !match_id || !series_id) {
            return res.send(ApiUtility.failed('user id, match id or series id are empty.'));
        }
        let joinedTeamKey = `userteam-${match_id}-${sport}-${user_id}`;
        
        redisEnt.getRedis(joinedTeamKey, async (err, data) => {
            if (isEmpty(data)) {
                let key = match_id+"_"+sport+"/"+match_id + "_" + sport + "_" + user_id + "_";
                let data = await listAllObjectsFromS3Bucket(key, match_id,user_id,sport)
                if(isEmpty(data)) {
                    PlayerTeamService.getCachePlayerTeamList({ match_id, series_id, team_no, user_id, sport }, (err, playerList) => {
                        if (err) {
                            return res.send(ApiUtility.failed(err.message));
                        } else {
                            return res.send(ApiUtility.success(playerList));
                        }
                    })
                } else {
                    let full_team = _.map(data, 'full_team');
                    let team = full_team.sort((a,b)=>{
                        return a.team_number - b.team_number
                    })
                    return res.send(ApiUtility.success(team));
                }
                
            } else {
                let full_team = _.map(data, 'full_team');
                let team = full_team.sort((a,b)=>{
                    return a.team_number - b.team_number
                })
                return res.send(ApiUtility.success(team));
            }
        });
    },

    previewPlayerTeamListRedisEnt: async (req, res) => {
        try {
            let { match_id, series_id, team_no, player_team_id, sport,cat_id } = req.params;
           
            let  user_id = req.userId;
            sport   =   parseInt(sport) || 1;
            match_id = parseInt(match_id);
            series_id = parseInt(series_id);

            if (!user_id || !match_id || !series_id || !player_team_id) {
                return res.send(ApiUtility.failed('user id, match id team id or series id are empty.'));
            }

            let liveMatch = await SeriesSquad.findOne({
                series_id: series_id,
                match_id: match_id,
                sport: sport,
            }, {playing_11:1, xfactors:1, localteam_id: 1,match_status:1,show_preview:1,is_parent:1,time: 1, date: 1, type: 1, visitorteam_id: 1, win_flag: 1 });

            if (!liveMatch) {
                return res.send(ApiUtility.failed('Match Detail not found'));
            }
            let filter = { user_id: user_id, match_id: match_id, series_id: series_id, sport: sport };
            
            if (player_team_id) {
                let joinedTeamKey = `userteam-${match_id}-${sport}-${user_id}`;
                redisEnt.getHGETRedis(joinedTeamKey,player_team_id, async (err, result) => {
                    if(isEmpty(result)) {
                        let key = match_id+"_"+sport+"/"+match_id + "_" + sport + "_" + user_id + "_" + player_team_id + ".json";
                        result = await readTeamOns3(key, match_id,user_id,sport)
                        if(isEmpty(result)) {
                            result = await PlayerTeam.findOne({_id:ObjectId(player_team_id)});
                        }
                    }

                    let player_list = result && result.players ? result.players : [];
                    if(sport === 1) {
                        if(result &&  result.user_id){
                            var teamuserId = ObjectId(result.user_id);
                            var loginUserId = ObjectId(user_id);
                            var mStatus = liveMatch.match_status;
                            var winFlag = liveMatch.win_flag;
                            if(!loginUserId.equals(teamuserId) && cat_id && !_.isUndefined(cat_id) && liveMatch && liveMatch.is_parent && liveMatch.show_preview == 0 && ( mStatus == "In Progress" || mStatus == "Not Started") ){
                                return res.send(ApiUtility.failed("Please wait for a few seconds to view other teams!!"))
                            } else {
                                cricketPreview(series_id, match_id, user_id, sport, player_list, result, liveMatch, player_team_id, function (result) {
                                    return res.send(result);
                                });
                            }
                        } else {
                            return res.send(ApiUtility.failed('Something went wrong!!'));
                        }
                    } else {
                        footballPreview(series_id, match_id, user_id, sport, player_list, result, liveMatch, player_team_id, function (result) {
                            return res.send(result);
                        });
                    }
                });
            } else {
                return res.send(ApiUtility.failed("Something went wrong !!"))
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    }

}

async function cricketPreview(series_id, match_id, user_id, sport, player_list, result, liveMatch, player_team_id, cb) {
    try {
        let data    =   [];
        let teamData = [];

        var newLocalteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${liveMatch.localteam_id}`;
        var newVisitorteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${liveMatch.visitorteam_id}`;
         
        let apiList = [
            redisEnt.getNormalRedis(newLocalteamIdKey),
            redisEnt.getNormalRedis(newVisitorteamIdKey)
        ];
        var redisResults = await Promise.all(apiList);
        let playerRcdData = [];
        if(redisResults && redisResults[0] && redisResults[0] != undefined && redisResults[1] && redisResults[1] != undefined) {
            playerRcdData = redisResults[0].concat(redisResults[1])
        }

        if (!isEmpty(playerRcdData)) {
            let playerShortDetails = playerRcdData.map(
                item => {
                    if(_.includes(player_list, item.player_id) && item !== undefined) {
                        return item;
                    }
                }
            )
            playerShortDetails = playerShortDetails.filter(function( element ) {
                return element !== undefined;
            });
            teamData = playerShortDetails;
        } else {
            let matchType   =   { series_id: series_id, player_id: { $in: player_list }, team_id: {$in:[liveMatch.localteam_id, liveMatch.visitorteam_id]}, sport: sport };
            if(liveMatch && liveMatch.type == "T10") {
                matchType.t10   =   true;
            } else if(liveMatch && liveMatch.type == "T20") {
                matchType.t20   =   true;
            } else if(liveMatch && liveMatch.type == "TEST") {
                matchType.test   =   true;
            } else if(liveMatch && liveMatch.type == "ODI") {
                matchType.odi   =   true;
            } else if(liveMatch && liveMatch.type == "T100") {
                matchType.t100   =   true;
            }
            teamData = await SeriesPlayer.find(matchType);
        }

        if (!_.isEmpty(teamData) && (teamData.length == 11 || teamData.length == 5)) {
            let playerData = {};
            for (const value of teamData) {
                playerData[value.player_id] = value;
            }
            
            let localPlayers = [];
    
            for (const value of teamData) {
                if(liveMatch.localteam_id == value.team_id) {
                    localPlayers.push(value.player_id);
                }
            }
            if (!_.isEmpty(teamData)) {
                let captain;
                let viceCaptain;
                let key = 0;
    
                captain = result.captain;
                viceCaptain = result.vice_captain;
                substitute = result.substitute;
                playerTeamId = result._id;
                playerTeamNo = result.team_count;
                playerDetail = [];
    
                let totalBowler = 0;
                let totalBatsman = 0;
                let totalWicketkeeper = 0;
                let totalAllrounder = 0;
                
                let totalPoints    =   0;
                if (result.players && result.players.length > 0) {
                    let playerTeamDetails = result.players;
                    let teamKey = 0;
                    let pointsArray = {};
                    // Get players Points 
                    if(result && result.x_counter && result.x_counter == 3 && result.one_five_x &&  result.two_x &&  result.three_x){
                        pointsArray = await PlayerRecord.getPlayerPointPreviewForXSystem(series_id, match_id, player_list, result.three_x, result.two_x, result.one_five_x, liveMatch.type, sport);
                    }else{
                        pointsArray = await PlayerRecord.getPlayerPointPreview(series_id, match_id, player_list, captain, viceCaptain, liveMatch.type, sport);
                    }
                    for (let teamValue of playerTeamDetails) {
                        teamValue = playerData[teamValue];
                        if (teamValue) {
                            let playerImage = '';
                            if (teamValue) {
                                playerImage = teamValue.image ? teamValue.image : ''; 
                            }
    
                            let point = 0;
                            point = pointsArray && pointsArray[teamValue.player_id] && pointsArray[teamValue.player_id]["point"] ? pointsArray[teamValue.player_id]["point"] : 0;
                            let playerRole = pointsArray && pointsArray[teamValue.player_id] && pointsArray[teamValue.player_id]["player_role"] ? pointsArray[teamValue.player_id]["player_role"] : teamValue.player_role;
                            
                            let dreamPlayers = {}
    
                            islocalTeam = (localPlayers.indexOf(teamValue.player_id) > -1) ? true : false;
                            playerDetail[teamKey] = {};
                            playerDetail[teamKey]['name'] = teamValue.player_name;
                            playerDetail[teamKey]['player_id'] = teamValue.player_id;
                            playerDetail[teamKey]['image'] = playerImage;
                            playerDetail[teamKey]['role'] = playerRole; //teamValue.playing_role;
                            playerDetail[teamKey]['credits'] = teamValue.player_credit;
                            playerDetail[teamKey]['points'] = point;
                            playerDetail[teamKey]['is_local_team'] = islocalTeam;
                            playerDetail[teamKey]['in_dream_team'] = (dreamPlayers.length > 0) ? true : false;
                            try{
                                if (liveMatch && liveMatch.playing_11 && liveMatch.playing_11.length > 0) {
                                    playerDetail[teamKey]['is_playing_show'] = 1;
                                    playerDetail[teamKey]['is_playing'] = (liveMatch.playing_11.indexOf(teamValue.player_id) > -1) ? 1 : 0;
                                } else {
                                    playerDetail[teamKey]['is_playing_show'] = 0;
                                    playerDetail[teamKey]['is_playing'] = 0
                                }
                                
                                if (liveMatch && liveMatch.xfactors && liveMatch.xfactors.length > 0) {
                                    playerDetail[teamKey]['is_xfactor'] = (liveMatch.xfactors.indexOf(teamValue.player_id) > -1) ? 1 : 0;
                                } else {
                                    playerDetail[teamKey]['is_xfactor'] = 0
                                }
                            }catch(preiewErr){}
                            

                            totalPoints +=   point;
                            
                            if (playerRole.indexOf('Wicketkeeper') > -1) {
                                totalWicketkeeper += 1;
                            } else if (playerRole.indexOf('Bowler') > -1) {
                                totalBowler += 1;
                            } else if (playerRole.indexOf('Batsman') > -1) {
                                totalBatsman += 1;
                            } else if (playerRole.indexOf('Allrounder') > -1) {
                                totalAllrounder += 1;
                            }
                            teamKey++;
                        }
                    }
    
                }
                substituteDetail = {};
                
                data[key] = {};
                data[key]['teamid'] = playerTeamId;
                data[key]['team_number'] = playerTeamNo;
                data[key]['total_point'] = totalPoints;
                data[key]['captain_player_id'] = captain;
                data[key]['vice_captain_player_id'] = viceCaptain;
                if(result && result.one_five_x) data[key]['one_five_x'] = result.one_five_x;
                if(result && result.two_x) data[key]['two_x'] = result.two_x;
                if(result && result.three_x) data[key]['three_x'] = result.three_x;
                if(result && result.four_x)  data[key]['four_x'] = result.four_x;
                if(result && result.five_x) data[key]['five_x'] = result.five_x;
                if(result && result.x_counter) data[key]['x_counter'] = result.x_counter;
                data[key]['total_bowler'] = totalBowler;
                data[key]['total_batsman'] = totalBatsman;
                data[key]['total_wicketkeeper'] = totalWicketkeeper;
                data[key]['total_allrounder'] = totalAllrounder;
                data[key]['player_details'] = playerDetail;
                data[key]['substitute_detail'] = substituteDetail;
                data[key]['my_teams'] = 0;
                data[key]['my_contests'] = 0;
            }
            data1 = data;

            var mStatus = liveMatch.match_status;
            var winFlag = liveMatch.win_flag;
            // if(mStatus == "Finished" && winFlag == 1) {
            //     let previewTeamKey = `${redisKeys.MATCH_PREVIEW}${sport}-${series_id}-${match_id}-${player_team_id}`;
            //     redisEnt.setRedis(previewTeamKey, `${player_team_id}`, data1);
            // }

            cb(ApiUtility.success(data1));
    
        } else {
            cb(ApiUtility.failed("Server error"));
        }
    } catch(err) {
        console.log("cticket preview > ", err);
    }
}

async function footballPreview(series_id, match_id, user_id, sport, player_list, result, liveMatch, player_team_id, cb) {
    try {
        let data    =   [];

        let teamData = [];

        var newLocalteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${liveMatch.localteam_id}`;
        var newVisitorteamIdKey = `${redisKeys.PLAYER_LIST}${series_id}-${liveMatch.visitorteam_id}`;
         
        let apiList = [
            redisEnt.getNormalRedis(newLocalteamIdKey),
            redisEnt.getNormalRedis(newVisitorteamIdKey)
        ];
        var redisResults = await Promise.all(apiList);
        let playerRcdData = [];
        if(redisResults && redisResults[0] && redisResults[0] != undefined && redisResults[1] && redisResults[1] != undefined) {
            playerRcdData = redisResults[0].concat(redisResults[1])
        }

        if (!isEmpty(playerRcdData)) {
            let playerShortDetails = playerRcdData.map(
                item => {
                    if(_.includes(player_list, item.player_id) && item !== undefined) {
                        return item;
                    }
                }
            )
            playerShortDetails = playerShortDetails.filter(function( element ) {
                return element !== undefined;
            });
            teamData = playerShortDetails;
        } else {
            teamData = await SeriesPlayer.find({ series_id: series_id, player_id: { $in: player_list },team_id: {$in: [liveMatch.localteam_id,liveMatch.visitorteam_id]}, sport: sport, player_status:1 });
        }
        
        if (teamData && ((sport == 2 && teamData.length == 11) || (sport == 4 && teamData.length == 7)) ) {
            let playerData = {};
            for (const value of teamData) {
                playerData[value.player_id] = value;
            }
            
            // let teamData = await SeriesPlayer.find({ series_id: series_id, player_id: { $in: player_list }, team_id: liveMatch.localteam_id });
            let localPlayers = [];
            for (const value of teamData) {
                if(value.team_id == liveMatch.localteam_id) {
                    localPlayers.push(value.player_id);
                }
            }
            
            if (!_.isEmpty(teamData)) {
                let captain;
                let viceCaptain;
                let key = 0;

                captain = result.captain;
                viceCaptain = result.vice_captain;
                substitute = result.substitute;
                playerTeamId = result._id;
                playerTeamNo = result.team_count;
                // totalPoints = (!result.points) ? 0 : result.points;
                totalPoints = 0;
                playerDetail = [];

                let totalDefender = 0;
                let totalForward = 0;
                let totalGoalkeeper = 0;
                let totalMidfielder = 0;
                let totalRaider = 0;
                let totalAllrounder = 0;

                if (result.players && result.players.length > 0) {
                    let playerTeamDetails = result.players;
                    let teamKey = 0;
                    
                    // Get players Points 
                    let pointsArray = await getFootballPlayerPoint(series_id, match_id, player_list, captain, viceCaptain, sport);

                    for (let teamValue of playerTeamDetails) {
                        teamValue = playerData[teamValue];
                        if (teamValue) {
                            let playerImage = 'undefined';
                            if (teamValue && teamValue.image) {
                                playerImage = teamValue.image; 
                            }

                            let point = 0;
                            //point =  pointsArray[teamValue.player_id] ? pointsArray[teamValue.player_id] : 0
                            point =  pointsArray[teamValue.player_id] && pointsArray[teamValue.player_id]["point"] ? pointsArray[teamValue.player_id]["point"] : 0;
                            let playerRole =  pointsArray[teamValue.player_id] && pointsArray[teamValue.player_id]["player_role"] ? pointsArray[teamValue.player_id]["player_role"] : teamValue.player_role;
                            
                            let dreamPlayers = {}

                            islocalTeam = (localPlayers.indexOf(teamValue.player_id) > -1) ? true : false;
                            playerDetail[teamKey] = {};
                            playerDetail[teamKey]['name'] = teamValue.player_name;
                            playerDetail[teamKey]['player_id'] = teamValue.player_id;
                            playerDetail[teamKey]['image'] = playerImage;
                            playerDetail[teamKey]['role'] = playerRole; //teamValue.player_role;
                            playerDetail[teamKey]['credits'] = (teamValue.player_credit).toString();
                            playerDetail[teamKey]['points'] = point;
                            playerDetail[teamKey]['is_local_team'] = islocalTeam;
                            playerDetail[teamKey]['in_dream_team'] = (dreamPlayers.length > 0) ? true : false;

                            try{
                                if (liveMatch && liveMatch.playing_11 && liveMatch.playing_11.length > 0) {
                                    playerDetail[teamKey]['is_playing_show'] = 1;
                                    playerDetail[teamKey]['is_playing'] = (liveMatch.playing_11.indexOf(teamValue.player_id) > -1) ? 1 : 0;
                                } else {
                                    playerDetail[teamKey]['is_playing_show'] = 0;
                                    playerDetail[teamKey]['is_playing'] = 0
                                }
                                
                            }catch(preiewErr){}

                            totalPoints +=   point;
                            if(sport == 4) {
                                if (playerRole.indexOf('Defender') > -1) {
                                    totalDefender += 1;
                                } else if (playerRole.indexOf('Raider') > -1) {
                                    totalRaider += 1;
                                } else if (playerRole.indexOf('Allrounder') > -1) {
                                    totalAllrounder += 1;
                                }
                            } else {
                                if (playerRole.indexOf('Defender') > -1) {
                                    totalDefender += 1;
                                } else if (playerRole.indexOf('Forward') > -1) {
                                    totalForward += 1;
                                } else if (playerRole.indexOf('Goalkeeper') > -1) {
                                    totalGoalkeeper += 1;
                                } else if (playerRole.indexOf('Midfielder') > -1) {
                                    totalMidfielder += 1;
                                }
                            }
                            teamKey++;
                        }
                    }
                }

                substituteDetail = {};
                
                data[key] = {};
                data[key]['teamid'] = playerTeamId;
                data[key]['team_number'] = playerTeamNo;
                data[key]['total_point'] = totalPoints;
                data[key]['captain_player_id'] = captain;
                data[key]['vice_captain_player_id'] = viceCaptain;
                data[key]['total_defender'] = totalDefender;
                data[key]['total_forward'] = totalForward;
                data[key]['total_goalkeeper'] = totalGoalkeeper;
                data[key]['total_midfielder'] = totalMidfielder;
                data[key]['total_raider'] = totalRaider;
                data[key]['total_allrounder'] = totalAllrounder;
                data[key]['player_details'] = playerDetail;
                data[key]['substitute_detail'] = substituteDetail;
                data[key]['my_teams'] = 0;
                data[key]['my_contests'] = 0;
            }
            
            // if(liveMatch.match_status == "Finished" && liveMatch.win_flag == 1) {
            //     let previewTeamKey = `${redisKeys.MATCH_PREVIEW}${sport}-${series_id}-${match_id}-${player_team_id}`;
            //     redisEnt.setRedis(previewTeamKey, `${player_team_id}`, data);
            // }
            cb(ApiUtility.success(data));
        } else {
            cb(ApiUtility.failed("Server error"));
        }
    } catch(err) {
        console.log('Football Preview > ', err);
    }
}

async function getFootballPlayerPoint(series_id, match_id, player_ids, captain, viceCaptain, sport) {
    let point = 0;

    let record = await LiveScore.find({ 'series_id': series_id, 'match_id': match_id, 'player_id': { $in: player_ids }, sport: sport }, { 'point': 1, 'player_name': 1 , "player_id": 1,"player_role":1}).sort({ _id: -1 });

    let teamDataArray = {}
    if (record) {
        for (let i = 0; i < record.length; i++) {
            recordItem = JSON.parse(JSON.stringify(record[i]));
            point = (recordItem['point']) ? parseFloat(recordItem['point']) : 0;

            let captainPoint = 2;
            let viceCaptainPoint = 1.5;
            if (captain == record[i].player_id) {
                point = point * captainPoint;
            }
            if (viceCaptain == record[i].player_id) {
                point = point * viceCaptainPoint;
            }
            
            // teamDataArray[recordItem.player_id] = point;
            teamDataArray[recordItem.player_id] = [];
            teamDataArray[recordItem.player_id]["point"] = point;
            teamDataArray[recordItem.player_id]['player_role'] = recordItem['player_role'] ? recordItem['player_role'] : '';
        }
    }
    return teamDataArray
}

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_TEAM
});

async function listAllObjectsFromS3Bucket(prefix, match_id,user_id,sport) {
    let allJoinedTeamTeams = [];
    let params = { Bucket: process.env.S3_BUCKET_TEAM };
    if (prefix) params.Prefix = prefix;
    try {
        const response = await s3.listObjects(params).promise();
        await Promise.all(response.Contents.map(async (item) => {
            const joinedTeam = await readTeamOns3(item.Key, match_id,user_id,sport)
            if(typeof joinedTeam === 'object' && joinedTeam !== null) {
                allJoinedTeamTeams.push(joinedTeam);
            }
        }));
        return allJoinedTeamTeams;
    } catch (error) {
        console.log("err0r");
        throw error;
    }
    
}

async function readTeamOns3(key, match_id,user_id,sport) { 
    return await new Promise((resolve, reject) => {

        const params = {
            Key: key,
            Bucket: process.env.S3_BUCKET_TEAM
        };
        
        s3.getObject(params, function (err, data) {
            if (err) {
                // reject(err)
                resolve(false);
            } else {
                let finalData = JSON.parse(data.Body.toString());
                redisEnt.setRedis(`userteam-${match_id}-${sport}-${user_id}`, finalData._id, finalData);
                resolve(finalData);
            }
        });
        
    });
}
