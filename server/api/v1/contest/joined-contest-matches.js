const config = require('../../../config');
const MyContestModel = require('../../../models/my-contest-model');
const ApiUtility = require('../../api.utility');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
// const mqtt = require('../../../lib/mqtt');
// const Helper = require('./common/helper');

var imageurl = config.imageBaseUrl;

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        // console.log(sport);
        var data = await (new ModelService(MyContestModel)).myContestModel(skip, pagesize, sort, filter, sport, type);
        callback(null, data)
    } catch (error) {
        //console.log("error",error)
    }
}

function getMatchRedisData(skip, decoded, filter, sort, sport, cb) {
    try {
        var datsse = moment().subtract('10', 'days').toDate();
        asyncp.parallel({
            upcoming_match: function (callback) {
                filter = {
                    "user_id": decoded.user_id,
                    "sport": sport,
                };
                getMyContestList(skip, decoded.pagesize, filter, 'upcoming', sort, sport, callback);
            },
            live_match: function (callback) {
                filter = {
                    "$and": [
                        { "user_id": decoded.user_id },
                        {"sport": sport}
                    ]
                };
                getMyContestList(skip, decoded.pagesize, filter, 'live', sort, sport, callback);
            },
            completed_match: function (callback) {
                callback(null, []);
            }
        },
            function (err, results) {
                if (err) {
                    return res.send(ApiUtility.failed("Server error"));
                } else {
                    cb(results);
                }
            });
    } catch (error) {
        //console.log("error", error)
    }
}

function deleteMyContestRedis(matchId, seriesId) {
    try {
        var response =  {};
        let leaderboardRediskey =   '*leaderboard-' + matchId + "-*";
        // console.log(leaderboardRediskey);
        return new Promise(async (resv, rej) => {
            redis.getBulkKeyRedisLeaderboard(leaderboardRediskey, (err, categories) =>{
                // console.log("categories", categories)
                if(categories && categories.length > 0){
                    _.forEach(categories, function(i,k){
                        redis.leaderboardRedisObj.del(i);
                        if(k === (categories.length - 1)){
                            redis.setRedis('leaderboard-redis-'+matchId,1);
                            resv(true);
                        }
                    });
                } else {
                    resv(false);
                }
            })
            resv(true);
        })
    } catch (error) {
        console.log("error", error)
    }
}

const getLeaderboardRedis = async (matchId) => {
    let leaderboardRedis = 'leaderboard-redis-' + matchId

    return new Promise(async (resv, rej) => {
        await redis.getRedis(leaderboardRedis, function (err, reply) {
            if (!err) {
                resv(reply);
            } else {
                resv(false);
            }
        })
    })
}

module.exports = {
    joinedContestMatches: async (req, res) => {
        try {
            let data1 = {};
            const { pagesize, page, is_complete, sport } = req.params;
            let user_id = req.userId;
            let decoded = {
                user_id: user_id,
                pagesize: (pagesize) ? parseInt(pagesize) : 25,
                page: (page) ? parseInt(page) : 1,
                is_complete: is_complete || "false",
                sport: parseInt(sport) || 1
            }
            // console.log(req.params,decoded); return false;
            // set server Time Start
            let serverTime = moment(Date.now()).format(config.DateFormat.datetime);
            let serverTimeForalc = moment().utc().toDate();

            if (decoded) {
                if (decoded['user_id']) {

                    let sort = { "createdAt": -1 }
                    let skip = (decoded.page - 1) * (decoded.pagesize);
                    let sport = decoded.sport || 1;
                    var datsse = moment().subtract('30', 'days').toDate();
                    let filter = {};

                    let matchContestKey = RedisKeys.MY_MATCHES_LIST + user_id+"_"+sport;
                    if (decoded.is_complete == 'true') {
                        asyncp.parallel({
                            upcoming_match: function (callback) {
                                callback(null, []);
                            },
                            live_match: function (callback) {
                                callback(null, []);
                            },
                            completed_match: function (callback) {
                                filter = {
                                    "$and": [
                                        { "user_id": user_id },
                                        { "sport": sport },
                                    ]
                                };
                                getMyContestList(skip, decoded.pagesize, filter, 'completed_match', sort, sport, callback);
                            }
                        },
                            function (err, results) {
                                if (err) {
                                    return res.send(ApiUtility.failed("Server error"));
                                } else {
                                    results['server_time'] = serverTime;
                                    return res.send(ApiUtility.success(results));
                                }
                            });
                    } else {
                        redis.getRedis(matchContestKey, function (err, contestData) { // Get Redis 
                            if (!contestData) {
                                getMatchRedisData(skip, decoded, filter, sort, sport, function (results) {
                                    results['server_time'] = serverTime;
                                    redis.setRedis(matchContestKey, results); // Set Redis                                
                                    return res.send(ApiUtility.success(results));
                                })
                            } else {
                                var newLiveArray = JSON.parse(JSON.stringify(contestData))
                                var contestDataUp = newLiveArray.upcoming_match.length;
                                if (contestDataUp > 0) {
                                    let key = 0;
                                    _.forEach(newLiveArray.upcoming_match, async function (i, k) {
                                        if (i && moment(i.sort_time).toDate() < serverTimeForalc) {
                                            i["match_status"] = 'In Progress';
                                            newLiveArray.live_match.unshift(i);
                                            newLiveArray.upcoming_match.splice(k, 1)

                                            let matchRedis = await getLeaderboardRedis(i.match_id);
                                            if(_.isEmpty(matchRedis) || _.isUndefined(matchRedis)) {
                                                let deleted =   deleteMyContestRedis(i.match_id);
                                                console.log(deleted);
                                            }
                                        }
                                        key++;
                                    })
                                    if (key === contestDataUp) {
                                        newLiveArray['server_time'] = serverTime;
                                        //console.log("contestDataUp-af", newLiveArray.upcoming_match.length, newLiveArray.live_match.length)
                                        redis.setRedis(matchContestKey, newLiveArray); // Set Redis
                                        return res.send(ApiUtility.success(newLiveArray));
                                    }
                                } else {
                                    contestData['server_time'] = serverTime;
                                    return res.send(ApiUtility.success(contestData));
                                }
                            }
                        });
                    }

                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed('Please check user id is blank.'));
            }
        } catch (error) {
            //////////consolelog(error);
            res.send(ApiUtility.failed(error.message));
        }
    },
}
