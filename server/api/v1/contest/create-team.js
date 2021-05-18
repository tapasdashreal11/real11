const SeriesSquad = require('../../../models/series-squad');
const PlayerTeam = require('../../../models/player-team');
const ApiUtility = require('../../api.utility');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const config = require('../../../config');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const PlayerTeamService = require('../../Services/PlayerTeamService');
const { RedisKeys } = require('../../../constants/app');
const Settings = require("../../../models/settings");

module.exports = {
    
    createTeam: async (req, res) => {
        let {
            series_id, player_id, captain, match_id, vice_captain, sport, team_id, team_count
        } = req.body
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        let data1 = {}, message = "";
        try {
            if (!series_id || !player_id || !captain || !match_id || !vice_captain || !sport) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }

            let liveMatch = await SeriesSquad.findOne({ match_id: match_id, series_id: series_id, sport: sport });

            if (liveMatch) {
                if (liveMatch.time < Date.now() && req.body.teamType != 55) {
                    return res.send(ApiUtility.failed('Match Already Closed'));
                }
                // let wk = 0, bat = 0, bowl = 0, ar = 0;
                let playerIds = player_id;
                let teamString = playerIds.sort().join("|");
               if(liveMatch.live_fantasy_parent_id){

                if (playerIds.length != 5)
                 return res.send(ApiUtility.failed('Please select only 5 players!!'));

               } else {
                    if (sport === 1) {
                        if (playerIds.length != 11)
                            return res.send(ApiUtility.failed('Please select valid team'));

                    } else if (sport === 2) {
                        if (playerIds.length !== 11)
                            return res.send(ApiUtility.failed('Please select valid team'));
                    }
               }
                

                let statusAdd = false;

                if (team_id) {
                    var teamDataa = await PlayerTeam.findOne({ _id: ObjectId(team_id) });
                    if (_.isEmpty(teamDataa))
                        return res.send(ApiUtility.failed('Invalid team id'));
                    // var diff = _.difference(playerIds, teamDataa.players)
                    //return false;
                    let teamDataaCheckAll = [];
                    if (req.body.teamType && req.body.teamType == 55) {
                        teamDataaCheckAll = await PlayerTeam.aggregate([
                            {
                                $match: { match_id: match_id, playerStr: teamString, sport: sport }
                            },
                            {
                                $lookup: {
                                    from: "users",
                                    let: { "userIdd": "$user_id" },
                                    pipeline: [
                                        { $match: { $expr: { $and: [{ $eq: ["$_id", "$$userIdd"] }, { $eq: ["$user_type", 55] }] } } }],
                                    as: "user"
                                }
                            },
                            {
                                $unwind: {
                                    "path": "$user",
                                    "preserveNullAndEmptyArrays": false
                                }
                            },
                        ]);
                    } else {
                        teamDataaCheckAll = await PlayerTeam.find({
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            captain: captain,
                            vice_captain: vice_captain,
                            playerStr: teamString,
                            sport: sport
                        });
                    }
                    
                    if (teamDataaCheckAll.length > 0) {
                        message = "Same team already exists."
                        return res.send(ApiUtility.failed(message));
                    } else {
                        
                        if (_.isEmpty(teamDataa)) {
                            statusAdd = false;
                        } else {
                            statusAdd = true;
                        };
                        let team = {
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            captain: captain,
                            vice_captain: vice_captain,
                            players: playerIds,
                            playerStr: teamString,
                            team_count: teamDataa.team_count,
                            sport: sport
                        };
                        
                        if (statusAdd == true) {
                            await PlayerTeam.updateOne({
                                _id: team_id,
                                user_id: user_id
                            }, { $set: team })
                            data1.team_id = team_id;
                            message = "Team has been updated successfully."
                            data1.message = message;
                            redis.redisnMyTeamsObj.del(RedisKeys.USER_DATA + user_id);
                            // PlayerTeamService.updateRedisUserPlayerTeamData(user_id, match_id, team, team_id, () => {
                                return res.send(ApiUtility.success(data1));
                            // })
                        } else {
                            if (team_id) {
                                message = "Same team already exists."
                            } else {
                                message = "You have already created this team"
                            }
                            return res.send(ApiUtility.failed(message));
                        }
                    }
                } else {
                    let teamDataa = [];
                    if (req.body.teamType && req.body.teamType == 55) {
                        teamDataa = await PlayerTeam.aggregate([
                            {
                                $match: { 'match_id': match_id, 'playerStr': teamString, 'sport': sport }
                            },
                            {
                                $lookup: {
                                    from: "users",
                                    let: { "userIdd": "$user_id" },
                                    pipeline: [
                                        { $match: { $expr: { $and: [{ $eq: ["$_id", "$$userIdd"] }, { $eq: ["$user_type", 55] }] } } }],
                                    as: "user"
                                }
                            },
                            {
                                $unwind: {
                                    "path": "$user",
                                    "preserveNullAndEmptyArrays": false
                                }
                            },
                        ]);
                    } else {
                        teamDataa = await PlayerTeam.find({
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            captain: captain,
                            vice_captain: vice_captain,
                            playerStr: teamString,
                            sport: sport
                        }).limit(1);
                    }
                    if (teamDataa.length > 0) {
                        statusAdd = false;
                    } else {
                        statusAdd = true;
                    }
                    if (statusAdd == true) {
                        team_count = await PlayerTeam.countDocuments({
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            sport: sport
                        });
                        let appSettingData = await Settings.findOne({}, { max_team_create: 1 });
                        const totalTemCount = appSettingData && appSettingData._id && appSettingData.max_team_create ? appSettingData.max_team_create : 9;
                        if (team_count < totalTemCount) {
                            team_count += 1;
                            // console.log(team_count);
                            // return false;
                            let team = {
                                user_id: user_id,
                                match_id: match_id,
                                series_id: series_id,
                                captain: captain,
                                vice_captain: vice_captain,
                                players: playerIds,
                                playerStr: teamString,
                                team_count: team_count,
                                sport: sport,
                                created: new Date()
                            };
                            let teamId = new ObjectId()
                            team._id = teamId;
                            data1.team_id = teamId;
                            data1.team_count = team_count;
                            
                            // message = "Team has been created successfully."
                            // data1.message = message;
                            //TODO: Create Object ID first and Save Mongodb and Redis Parallely
                            //TODO: Return only player ids in redis and player team list api
                            
                            let newTeam    =   await PlayerTeam.collection.insertOne(team);
                            // if (err) return res.send(ApiUtility.failed(err.message));
                            // data1.team_id = teamDataa._id;
                            message = "Team has been created successfully."
                            
                            data1.message = message;
                            redis.redisObj.get('user-teams-count-' + match_id + '-' + sport + '-' + user_id, (err, data) => {
                                let count = (data) ? parseInt(data) + 1 : 1;
                                mqtt.publishUserJoinedTeamCounts(match_id, user_id, JSON.stringify({ team_count: count }))
                                redis.redisObj.del('user-teams-count-' + match_id + '-' + sport + '-' + user_id) //force user to get data from db
                            });
                            redis.redisnMyTeamsObj.del(RedisKeys.USER_DATA + user_id);
                            // PlayerTeamService.setRedisUserPlayerTeamData(user_id, match_id, team, () => {
                                return res.send(ApiUtility.success(data1));
                            // });
                        } else {
                            return res.send(ApiUtility.failed("You can not create team more than "+ totalTemCount + " teams."));
                        }
                    } else {
                        if (team_id) {
                            message = "Same team already exists."
                        } else {
                            message = "You have already created this team"
                        }
                        return res.send(ApiUtility.failed(message));
                    }
                }

            } else {
                message = "This team is already created, please make changes in team players or change team captain/vice captain to continue."
                return res.send(ApiUtility.failed(message));
            }
        } catch (error) {
            console.log("Create Team", error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
}

