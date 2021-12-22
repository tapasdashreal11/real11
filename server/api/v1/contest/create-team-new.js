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

    createTeamNew: async (req, res) => {
        let {
            series_id, player_id, captain, match_id, vice_captain, sport, team_id, team_count, xm_system, one_five_x, two_x, three_x, four_x, five_x
        } = req.body
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        let data1 = {}, message = "";
        let x_system = (xm_system && (xm_system == 1)) ? 1 : 0;
        try {
            
            if (x_system == 0 && (!series_id || !player_id || !captain || !match_id || !vice_captain || !sport)) {
                return res.send(ApiUtility.failed('Please send proper data'));
            } else if (x_system == 1 && (!series_id || !player_id || !one_five_x || !two_x || !three_x  || !match_id || !sport)) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
            let liveMatch = await SeriesSquad.findOne({ match_id: match_id, series_id: series_id, sport: sport });
            if (liveMatch) {
                if (liveMatch.time < Date.now() && req.body.teamType != 55) {
                    return res.send(ApiUtility.failed('Match Already Closed'));
                }
                if (x_system == 1 && (!liveMatch.is_parent || liveMatch.inning_number !=2)){
                    return res.send(ApiUtility.failed('Something went wrong!!!'));
                }
                if (x_system != 1 && (liveMatch.is_parent && liveMatch.inning_number ==2)){
                    return res.send(ApiUtility.failed('This system will not support create team. Please update the app!!'));
                }

                // let wk = 0, bat = 0, bowl = 0, ar = 0;
                let playerIds = player_id;
                let teamString = playerIds.sort().join("|");
                if (liveMatch.live_fantasy_parent_id) {
                    if (x_system == 1){
                        return res.send(ApiUtility.failed('Please Select Properly!!'));  
                    }
                    if (playerIds.length != 5)
                        return res.send(ApiUtility.failed('Please select only 5 players!!'));
                    else if (x_system == 1 && (!one_five_x || !two_x || !three_x  || !four_x || !five_x))
                        return res.send(ApiUtility.failed('Please Select Properly X System!!'));    

                } else {
                    if (sport === 1) {
                        if (playerIds.length != 11)
                            return res.send(ApiUtility.failed('Please select valid team'));

                    } else if (sport === 2) {
                        if (playerIds.length !== 11)
                            return res.send(ApiUtility.failed('Please select valid team'));
                    }else if (sport === 4) {
                        if (playerIds.length !== 7)
                            return res.send(ApiUtility.failed('Please select valid team'));
                    }
                }


                let statusAdd = false;

                if (team_id) {
                    var teamDataa = await PlayerTeam.findOne({ _id: ObjectId(team_id) });
                    if (_.isEmpty(teamDataa))
                        return res.send(ApiUtility.failed('Invalid team id'));
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
                        if (x_system == 1) {
                            if (liveMatch.live_fantasy_parent_id) {
                                teamDataaCheckAll = await PlayerTeam.find({
                                    user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString, sport: sport,
                                    one_five_x: one_five_x,
                                    two_x: two_x,
                                    three_x: three_x,
                                    four_x: four_x,
                                    five_x: five_x
                                });
                            } else {
                                teamDataaCheckAll = await PlayerTeam.find({
                                    user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString, sport: sport,
                                    one_five_x: one_five_x,
                                    two_x: two_x,
                                    three_x: three_x
                                });
                            }
                        } else {
                            teamDataaCheckAll = await PlayerTeam.find({
                                user_id: user_id, match_id: match_id, series_id: series_id, sport: sport, playerStr: teamString,
                                captain: captain,
                                vice_captain: vice_captain
                            });
                        }

                    }

                    if (teamDataaCheckAll.length > 0) {
                        message = "Same team already exists."
                        return res.send(ApiUtility.failed(message));
                    } else {
                        statusAdd = _.isEmpty(teamDataa) ? false : true;
                        let team = {
                            user_id: user_id, match_id: match_id, series_id: series_id, players: playerIds, playerStr: teamString, team_count: teamDataa.team_count, sport: sport,
                            captain: captain,
                            vice_captain: vice_captain
                        };
                        if (x_system == 1) {
                            if (liveMatch.live_fantasy_parent_id) {
                                team['one_five_x'] = one_five_x;
                                team['two_x'] = two_x;
                                team['three_x'] = three_x;
                                team['four_x'] = four_x;
                                team['five_x'] = five_x;
                            } else {
                                team['one_five_x'] = one_five_x;
                                team['two_x'] = two_x;
                                team['three_x'] = three_x;
                            }
                        } else {
                            team['captain'] = captain;
                            team['vice_captain'] = vice_captain;

                            team['one_five_x'] = vice_captain;
                            team['two_x'] = captain;
                        }
                        if (statusAdd == true) {
                            await PlayerTeam.updateOne({_id: team_id, user_id: user_id, match_id: Number(match_id), sport: Number(sport)}, { $set: team });
                            data1.team_id = team_id;
                            message = "Team has been updated successfully."
                            data1.message = message;
                            redis.redisnMyTeamsObj.del(RedisKeys.USER_DATA + user_id);
                            return res.send(ApiUtility.success(data1));
                        } else {
                            message = team_id ? "Same team already exists." : "You have already created this team";
                            return res.send(ApiUtility.failed(message));
                        }
                    }
                } else {
                    let teamDataa = [];
                    if (req.body.teamType && req.body.teamType == 55) {
                        console.log('hello team type 55 ****');
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
                        if (x_system == 1) {
                            if (liveMatch.live_fantasy_parent_id) {
                                teamDataa = await PlayerTeam.find({ user_id: user_id, match_id: match_id, series_id: series_id,playerStr: teamString,sport: sport,
                                    one_five_x: one_five_x,
                                    two_x: two_x,
                                    three_x: three_x,
                                    four_x: four_x,
                                    five_x: five_x
                                }).limit(1);
                            } else {
                                teamDataa = await PlayerTeam.find({user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString,sport: sport,
                                    one_five_x: one_five_x,
                                    two_x: two_x,
                                    three_x: three_x
                                }).limit(1);
                            }

                        } else {
                            teamDataa = await PlayerTeam.find({ user_id: user_id, match_id: match_id, series_id: series_id,playerStr: teamString,sport: sport,
                                captain: captain,
                                vice_captain: vice_captain
                            }).limit(1);
                        }
                    }
                    statusAdd = teamDataa.length > 0 ? false: true;
                    if (statusAdd) {
                         team_count = await PlayerTeam.countDocuments({user_id: user_id,match_id: match_id,series_id: series_id,sport: sport});
                        let appSettingData = await Settings.findOne({}, { max_team_create: 1 });
                        const totalTemCount = appSettingData && appSettingData._id && appSettingData.max_team_create ? appSettingData.max_team_create : 15;
                        if (team_count < totalTemCount) {
                            team_count += 1;
                            let team = {
                                user_id: user_id, match_id: match_id, series_id: series_id, players: playerIds, playerStr: teamString, team_count: team_count, sport: sport,
                                created: new Date()
                            };
                            if (x_system == 1) {
                                if (liveMatch.live_fantasy_parent_id) {
                                    team['one_five_x'] = one_five_x;
                                    team['two_x'] = two_x;
                                    team['three_x'] = three_x;
                                    team['four_x'] = four_x;
                                    team['five_x'] = five_x;
                                    team['x_counter'] = 5;
                                } else {
                                    team['one_five_x'] = one_five_x;
                                    team['two_x'] = two_x;
                                    team['three_x'] = three_x;
                                    team['x_counter'] = 3;
                                }
                            } else {
                                team['captain'] = captain;
                                team['vice_captain'] = vice_captain;
                                team['one_five_x'] = vice_captain;
                                team['two_x'] = captain;
                                team['x_counter'] = 2;
                            }
                            let teamId = new ObjectId()
                            team._id = teamId;
                            data1.team_id = teamId;
                            data1.team_count = team_count;
                            await PlayerTeam.collection.insertOne(team);
                            message = "Team has been created successfully."
                            data1.message = message;
                            redis.redisObj.get('user-teams-count-' + match_id + '-' + sport + '-' + user_id, (err, data) => {
                                let count = (data) ? parseInt(data) + 1 : 1;
                                mqtt.publishUserJoinedTeamCounts(match_id, user_id, JSON.stringify({ team_count: count }))
                                redis.redisObj.del('user-teams-count-' + match_id + '-' + sport + '-' + user_id) //force user to get data from db
                            });
                            redis.redisnMyTeamsObj.del(RedisKeys.USER_DATA + user_id);
                            return res.send(ApiUtility.success(data1));
                        } else {
                            return res.send(ApiUtility.failed("You can not create team more than " + totalTemCount + " teams."));
                        }
                    } else {
                        message =  team_id ? "Same team already exists." : "You have already created this team";
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

