const SeriesSquad = require('../../../models/series-squad');
const PlayerTeam = require('../../../models/player-team');
const ApiUtility = require('../../api.utility');
const { ObjectId } = require('mongodb');
const _ = require("lodash");
const redisEnt = require('../../../../lib/redisEnterprise');
const { RedisKeys } = require('../../../constants/app');
const redisKeys = require('../../../constants/redis-keys');
const Settings = require("../../../models/settings");
const AWS = require('aws-sdk');
const PlayerTeamServiceRedisEnt = require('../../Services/PlayerTeamServiceRedisEnt');
const { isEmpty } = require('lodash');

module.exports = {

    createTeamRedisEnt: async (req, res) => {
        let {
            series_id, player_id, captain, match_id, vice_captain, sport, team_id, team_count, xm_system, one_five_x, two_x, three_x, four_x, five_x
        } = req.body
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        let data1 = {}, message = "";
        let x_system = (xm_system && (xm_system == 1)) ? 1 : 0;
        try {
            console.log(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`);
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
                    } else if (sport === 4) {
                        if (playerIds.length !== 7)
                            return res.send(ApiUtility.failed('Please select valid team'));
                    }
                }

                let joinedTeamKey = `${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`;
                let statusAdd = false;
                let joinedTeamData = false;


                let isSetOnRedis = false;
                const getDataforDB = await redisEnt.getHashRedis(joinedTeamKey)
                if(isEmpty(getDataforDB)) {
                    let s3key = match_id+"_"+sport+"/"+match_id + "_" + sport + "_" + user_id + "_";
                    let data = await listAllObjectsFromS3Bucket(s3key, match_id,user_id,sport)

                    let userTeamDB = await PlayerTeam.find({user_id: user_id, match_id: match_id, series_id: series_id, sport: sport}).lean();
                    let flag = 0
                    if(userTeamDB.length > 0) {
                        for(var team of userTeamDB) {
                            let fullTeamForDB = await PlayerTeamServiceRedisEnt.getUserCreatedTeam(series_id, match_id, sport, team.team_count, team);
                            team.full_team = fullTeamForDB
                            redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, `${team._id}`, team);
                            flag++;
                            if(userTeamDB.length == flag) {
                                isSetOnRedis = true;
                            }
                        }
                    } else {
                        isSetOnRedis = true;
                    }
                } else {
                    isSetOnRedis = true;
                }

                if(isSetOnRedis == true) {
                    try {
                        const getData = await redisEnt.getHashRedis(joinedTeamKey)
                        if(getData) {
                            joinedTeamData = JSON.parse(JSON.stringify(getData));
                        }
                    } catch(error) {
                        return res.send(ApiUtility.failed(error.message));
                    }
    
                    if (team_id) {
                        var teamDataa= [];
                        if(joinedTeamData) {
                            cdataRsp = _.find(joinedTeamData, { '_id': team_id });
                            if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                teamDataa.push(cdataRsp);
                            }
                        } else {
                            teamDataa = await PlayerTeam.findOne({ _id: ObjectId(team_id) });
                        }
                        
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
                                    if(joinedTeamData) {
                                        cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'one_five_x': one_five_x, 'two_x': two_x, 'three_x': three_x, 'four_x': four_x, 'five_x': five_x });
                                        if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                            teamDataaCheckAll.push(cdataRsp);
                                        }
                                    } else {
                                        teamDataaCheckAll = await PlayerTeam.find({
                                            user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString, sport: sport,
                                            one_five_x: one_five_x,
                                            two_x: two_x,
                                            three_x: three_x,
                                            four_x: four_x,
                                            five_x: five_x
                                        });
                                    }
                                } else {
                                    if(joinedTeamData) {
                                        cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'one_five_x': one_five_x, 'two_x': two_x, 'three_x': three_x });
                                        if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                            teamDataaCheckAll.push(cdataRsp);
                                        }
                                    } else {
                                        teamDataaCheckAll = await PlayerTeam.find({
                                            user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString, sport: sport,
                                            one_five_x: one_five_x,
                                            two_x: two_x,
                                            three_x: three_x
                                        });
                                    }
                                }
                            } else {
                                if(joinedTeamData) {
                                    cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'captain': captain, 'vice_captain': vice_captain });
                                    if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                        teamDataaCheckAll.push(cdataRsp);
                                    }
                                } else {
                                    teamDataaCheckAll = await PlayerTeam.find({
                                        user_id: user_id, match_id: match_id, series_id: series_id, sport: sport, playerStr: teamString,
                                        captain: captain,
                                        vice_captain: vice_captain
                                    });
                                }
                            }
    
                        }
                        
                        if (teamDataaCheckAll.length > 0) {
                            message = "Same team already exists."
                            return res.send(ApiUtility.failed(message));
                        } else {
                            teamDataa = teamDataa[0];
                            statusAdd = _.isEmpty(teamDataa) ? false : true;
                            let team = {
                                _id: teamDataa._id, user_id: user_id, match_id: match_id, series_id: series_id, players: playerIds, playerStr: teamString, team_count: teamDataa.team_count, sport: sport,
                                captain: captain,
                                vice_captain: vice_captain,
                                created: teamDataa.created,
                                updatedAt: new Date()
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
                            
                            if (statusAdd == true) {
                                let fullTeam = await PlayerTeamServiceRedisEnt.getUserCreatedTeam(series_id, match_id, sport, teamDataa.team_count, team);
                                team.full_team = fullTeam;
                                // team.operation = "update";
    
                                if (liveMatch.time < Date.now() && req.body.teamType == 55) {

                                    await PlayerTeam.updateOne({_id: team_id, user_id: user_id, match_id: Number(match_id), sport: Number(sport)}, { $set: team });                                    
                                    redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, `${team._id}`, team);
                                    redisEnt.redisObj.publish('player_team', JSON.stringify(team))
    
                                    message = "Team has been updated successfully."
                                    data1.message = message;
                                    data1.team_id = team_id;
                                    return res.send(ApiUtility.success(data1));
                                } else {
                                    let s3Res = await createTeamOnS3(match_id+"_"+sport+"/"+match_id+"_"+sport+"_"+user_id+"_"+team._id+".json", team);
                                    if(s3Res) {
                                        redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, `${team._id}`, team);
                                        redisEnt.redisObj.publish('player_team', JSON.stringify(team))
        
                                        message = "Team has been updated successfully."
                                        data1.message = message;
                                        data1.team_id = team_id;
                                        return res.send(ApiUtility.success(data1));
                                    } else {
                                        message = "Something went wrong."
                                        data1.message = message;
                                        return res.send(ApiUtility.failed(data1));
                                    }
                                }
                            } else {
                                message = team_id ? "Same team already exists." : "You have already created this team";
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
                            
                            if (x_system == 1) {
                                if (liveMatch.live_fantasy_parent_id) {
                                    try {
                                        if(joinedTeamData) {
                                            cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'one_five_x': one_five_x, 'two_x': two_x, 'three_x': three_x, 'four_x': four_x, 'five_x': five_x });
                                            if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                                teamDataa.push(cdataRsp);
                                            }
    
                                        } else {
                                            teamDataa = await PlayerTeam.find({ user_id: user_id, match_id: match_id, series_id: series_id,playerStr: teamString,sport: sport,
                                                one_five_x: one_five_x,
                                                two_x: two_x,
                                                three_x: three_x,
                                                four_x: four_x,
                                                five_x: five_x
                                            }).limit(1);
                                        }
                                    } catch (error) {
                                        return res.send(ApiUtility.failed(error.message));
                                    }
                                } else {
                                    try {
                                        if(joinedTeamData) {
                                            cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'one_five_x': one_five_x, 'two_x': two_x, 'three_x': three_x });
                                            if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                                teamDataa.push(cdataRsp);
                                            }
                                        } else {
                                            teamDataa = await PlayerTeam.find({user_id: user_id, match_id: match_id, series_id: series_id, playerStr: teamString,sport: sport,
                                                one_five_x: one_five_x,
                                                two_x: two_x,
                                                three_x: three_x
                                            }).limit(1);
                                        }
                                    } catch (error) {
                                        return res.send(ApiUtility.failed(error.message));
                                    }
                                }
    
                            } else {
                                try {
                                    if(joinedTeamData) {
                                        cdataRsp = _.find(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'playerStr': teamString, 'sport': sport, 'captain': captain, 'vice_captain': vice_captain });
                                        if(typeof cdataRsp === 'object' && cdataRsp !== null) {
                                            teamDataa.push(cdataRsp);
                                        }
                                    } else {
                                        teamDataa = await PlayerTeam.find({ user_id: user_id, match_id: match_id, series_id: series_id,playerStr: teamString,sport: sport,
                                            captain: captain,
                                            vice_captain: vice_captain
                                        }).limit(1);
                                    }
                                } catch (error) {
                                    return res.send(ApiUtility.failed(error.message));
                                }
                            }
                        }
                        
                        statusAdd = teamDataa.length > 0 ? false: true;
                        let team_count = 0;
                        if (statusAdd) {
                            if(joinedTeamData) {
                                joindTeams = _.filter(joinedTeamData, { 'user_id': user_id.toString(), 'match_id': match_id, 'series_id': series_id, 'sport': sport });
                                team_count = joindTeams.length;
                            } else {
                                team_count = await PlayerTeam.countDocuments({user_id: user_id,match_id: match_id,series_id: series_id,sport: sport});
                            }
                            let appSettingData = await Settings.findOne({}, { max_team_create: 1 });
                            const totalTemCount = appSettingData && appSettingData._id && appSettingData.max_team_create ? appSettingData.max_team_create : 20;
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
                                let fullTeam = await PlayerTeamServiceRedisEnt.getUserCreatedTeam(series_id, match_id, sport, team_count, team);
                                team.full_team = fullTeam;
                                let s3Res = await createTeamOnS3(match_id+"_"+sport+"/"+match_id+"_"+sport+"_"+user_id+"_"+team._id+".json", team);
                                if(s3Res) {
                                    redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, `${team._id}`, team);
                                    message = "Team has been created successfully."
                                    data1.message = message;
                                    return res.send(ApiUtility.success(data1));
                                } else {
                                    message = "Something went wrong."
                                    data1.message = message;
                                    return res.send(ApiUtility.failed(data1));
                                }
                            } else {
                                return res.send(ApiUtility.failed("You can not create team more than " + totalTemCount + " teams."));
                            }
                        } else {
                            message =  team_id ? "Same team already exists." : "You have already created this team";
                            return res.send(ApiUtility.failed(message));
                        }
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


const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: process.env.S3_BUCKET_TEAM
});

/** This function for upload on s3 bucket */
async function createTeamOnS3(key, team) {
    
    return new Promise((resolve, reject) => {
            const params = {
                Key: key,
                Body: JSON.stringify(team),
                Bucket: process.env.S3_BUCKET_TEAM
            };
            
            s3.putObject(params, function (err, data) {
                if (err) {
                    // createTeamOnS3(key, team)
                    // reject(err.message)
                    resolve(false);
                } else {
                    // resolve(data);
                    if(data && data.ETag) {
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }
            });
    });
    
}

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
                redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, finalData._id, finalData);
                resolve(finalData);
            }
        });
        
    });
}