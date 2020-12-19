'use strict';

const RedisClient = require('redis');
const config = require('../server/config');
const { RedisKeys } = require('../server/constants/app');
const PlayerTeamContest = require('../server/models/player-team-contest');
const ObjectId = require('mongoose').Types.ObjectId;
const ApiUtility = require('../server/api/api.utility');
const Helper = require("../server/api/v1/common/helper");
const moment = require('moment');
var redis = RedisClient.createClient(config.redis.port, config.redis.host);
var redisForUserAnalysis = RedisClient.createClient(config.useranalysis_redis.port, config.useranalysis_redis.host);
var redisLeaderboard = RedisClient.createClient(config.leaderboard_redis.port, config.leaderboard_redis.host);
// var redisTemp = RedisClient.createClient(config.redis.port, "redis-temp-testing.kayq2e.ng.0001.aps1.cache.amazonaws.com");


// let redis;
// if(config.redis.host !== "localhost"){
//   var RedisClustr = require('redis-clustr');
//     redis = new RedisClustr({
//       servers: [{
//           host: config.redis.host,
//           port: config.redis.port
//       }],
//       createClient: function (port, host) {
//           return RedisClient.createClient(port, host);
//       }
//   });
// } else {
//   redis = RedisClient.createClient(config.redis.port, config.redis.host);
// }

redis.on("connect", function() {
    //console.log("Redis Server connected");
});

redisForUserAnalysis.on("connect", function() {
    //console.log("Redis Server connected");
});

redis.getPromise = (key, defaultValue) => {
    return new Promise((resolve, reject) => {
        redis.get(key, (err, data) => {
            if (err) {
                //console.log("redis.getPromise Error for key", key, err)
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue
            }
            resolve(data)
        })
    })
}
redis.getPromiseForAnalysis = (key, defaultValue) => {
    return new Promise((resolve, reject) => {
        redisForUserAnalysis.get(key, (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue
            }
            resolve(data)
        })
    })
}

const cacheMiddle = async(req, res, next) => {
    try {
        // console.log("req.route.path", req.route.path)
        if (req.route.path == '/api/v1/contest-list/:match_id/:sport?/:series_id?') {
            let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${req.params.match_id}`;
            let contetestMatchKey = RedisKeys.MATCH_CONTEST_LIST + req.params.match_id;
            let match_sport = req && req.params && req.params.sport ? req.params.sport :1;
            let match_series_id = req && req.params && req.params.series_id ? parseInt(req.params.series_id) : 1;
            let redisKeyForUserAnalysis = 'app-analysis-' + req.userId  + '-' + req.params.match_id + '_' + match_series_id + '-' + match_sport;
            let promiseArray = [
                redis.getPromise(contetestMatchKey, []),
                redis.getPromise(joinedTeamsCountKey, "[]"),
            ];
            if (req.userId) {
                promiseArray.push(redis.getPromise('user-teams-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-teamIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromise('user-contest-joinedContestIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromiseForAnalysis(redisKeyForUserAnalysis, {}));
            }
            let redisData = await Promise.all(promiseArray).catch((err) => {
                next();
            });
            if (redisData[0].length > 0) {
                let matchContestData = JSON.parse(redisData[0]);
                let finalRes = {
                    match_contest: matchContestData,
                    my_teams: 0,
                    my_contests: 0,
                    user_rentation_bonous:{}
                }
                if (req.userId) {
                    if (redisData[2] == 0) {
                        return next();
                    }
                    
                    let userTeamIds = [];
                    if (redisData[4]) {
                        userTeamIds = JSON.parse(redisData[4]);
                    }

                    finalRes['joined_teams_count'] = Helper.parseContestTeamsJoined(JSON.parse(redisData[1]))
                    finalRes['my_teams'] = parseInt(redisData[2]);
                    finalRes['my_contests'] = parseInt(redisData[3]);
                    finalRes['user_team_ids'] = userTeamIds;
                    finalRes['joined_contest_ids'] = JSON.parse(redisData[5]);
                    finalRes['user_rentation_bonous'] = JSON.parse(redisData[6]);
                    console.log('contets list from redis*******');
                }
                return res.send(ApiUtility.success(finalRes));
            } else {
                next();
            }
        } else if (req.route.path == '/api/v1/get-match-list') {
            redis.get('match-list', (err, data) => {
                if (data) {
                    let matchListData = JSON.parse(data);
                    if (matchListData.data) {
                        matchListData.data['server_time'] = moment(new Date()).format(config.DateFormat.datetime);
                    }
                    res.send(matchListData);
                } else {
                    next();
                }
            });
        } else if(req.route.path == '/api/v1/category-contest-list/:match_id/:sport?/:category_id?'){
            try {
                let match_sport = req && req.params && req.params.sport ? req.params.sport :1;
                if(req.params.category_id){
                    var categoryContestList = RedisKeys.MATCH_CONTEST_LIST_CATEGORY +req.params.match_id+req.params.category_id;                
                }else{
                    var categoryContestList = RedisKeys.MATCH_CONTEST_All_LIST + req.params.match_id;
                }
    
                let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${req.params.match_id}`;
                //console.log("contetestMatchKey***", contetestMatchKey)
                //gerTeamData();
                let promiseArray = [
                    redis.getPromise(categoryContestList, []),
                    redis.getPromise(joinedTeamsCountKey, "[]"),
                ];
                //console.log("req.userId", req.userId)
                if (req.userId) {
                    ////console.log('1111111111111111111111111111111111111111111111111111111')
                    promiseArray.push(redis.getPromise('user-teams-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                    promiseArray.push(redis.getPromise('user-contest-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                    promiseArray.push(redis.getPromise('user-contest-teamIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                    promiseArray.push(redis.getPromise('user-contest-joinedContestIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                }
                let redisData = await Promise.all(promiseArray).catch((err) => {
                    //console.log("promise error")
                    next();
                });
    
                ////console.log("redisData", redisData)
    
                if (redisData[0].length > 0) {
                    let matchContestData = JSON.parse(redisData[0]);
                    let finalRes = {
                        match_contest: matchContestData,
                        my_teams: 0,
                        my_contests: 0
                    }
                    //console.log("redisData[2]", redisData[2])
                    if (req.userId) {
                        if (redisData[2] == 0) {
                            return next();
                        }
                        let userTeamIds = [];
                        if (redisData[4]) {
                            userTeamIds = JSON.parse(redisData[4]);
                        }
    
                        finalRes['joined_teams_count'] = Helper.parseContestTeamsJoined(JSON.parse(redisData[1]))
                        finalRes['my_teams'] = parseInt(redisData[2]);
                        finalRes['my_contests'] = parseInt(redisData[3]);
                        finalRes['user_team_ids'] = userTeamIds;
                        finalRes['joined_contest_ids'] = JSON.parse(redisData[5]);
                    }
                    console.log("from_Redis**********")
                    return res.send(ApiUtility.success(finalRes));
                } else {
                    next();
                }
            } catch (error) {
                console.log("error category", error)
            }
        }

    } catch (error) {
       // console.log('error in redis for contest list', error)
    }
}

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedis = (key, data, expTime = 432000, setExp = true) => {
    try {
        ////console.log("redis set******", key, JSON.stringify(data))
        redis.set(key, JSON.stringify(data));
        setExp && redis.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * getRedis
 * @param key
 * @param cb
 */
const getRedis = (key, cb) => {
    redis.get(key, (err, data) => {
        ////console.log(err, data)
        if (err) {
            //console.error("getRedis get err ==== ", err)
            if (cb) {
                return cb(err)
            } else {
                return err;
            }
        }
        if (!data) {
            if (cb) {
                return cb(new Error(`record not found for key: ${key}`))
            } else {
                return new Error(`record not found for key: ${key}`);
            }
        }
        try {
            data = JSON.parse(data);
            if (cb) {
                return cb(null, data)
            } else {
                return data;
            }
        } catch (error) {
            //console.error("getRedis catch error ==== ", error)
            if (cb) {
                return cb(error)
            }
            return error
        }
    });
}

/**
 * incrementCounter
 * @param key
 * @param cb
 */
const incr = (key, cb) => {
    redis.incr(key, (err, data) => {
        if (err) {
            //console.error("redisIncr get err ==== ", err)
            return cb(err)
        }
        if (!data) {
            return cb(new Error(`record not found for key: ${key}`))
        }
        try {
            return cb(null, data)
        } catch (error) {
            //console.error("redisIncr catch error ==== ", error)
            return cb(error)
        }
    });
}

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setIPRedis = (key, cb, expTime = 432000, setExp = true) => {
    try {
        // let currentDate =   new Date();
        let newCurrentDate =   moment().add(1, 'm').toDate();
        // console.log(currentDate, newCurrentDate);
        // redisLeaderboard.del(key);
        redisLeaderboard.get(key, (err, data) => {
            let ipCount =   0; 
            let ipObj   =   (data == "NaN" || data == null) ? {} : JSON.parse(data);
            if(ipObj && Object.keys(ipObj).length == 0) {
                ipCount =   1;
                ipObj   =   {
                    time: newCurrentDate,
                    ip_count: ipCount
                }
                redisLeaderboard.set(key, JSON.stringify(ipObj));
                setExp && redis.expire(key, expTime);
            } else {
                // ipObj   =   JSON.parse(ipObj);
                ipObj.ip_count++;
                
                console.log(ipObj,ipObj.ip_count);
                redisLeaderboard.set(key, JSON.stringify(ipObj));
            }
            console.log(ipObj.time, moment().isBefore(ipObj.time));
            // if(currentDate > ipObj.time) {
            if(moment().isBefore(ipObj.time) == false) {
                redisLeaderboard.del(key);
                return cb(0);
            } else {
                return cb(ipObj.ip_count);
            }
        });
    } catch (error) {
        console.error("setRedis error ==== ", error)
    }
}

/**
 * getRedis
 * @param key
 * @param cb
 */
const getRedisLeaderboard = (key, cb) => {
    redisLeaderboard.get(key, (err, data) => {
        ////console.log(err, data)
        if (err) {
            //console.error("getRedis get err ==== ", err)
            if (cb) {
                return cb(err)
            } else {    
                return err;
            }
        }
        if (!data) {
            if (cb) {
                return cb(new Error(`record not found for key: ${key}`))
            } else {
                return new Error(`record not found for key: ${key}`);
            }
        }
        try {
            data = JSON.parse(data);
            if (cb) {
                return cb(null, data)
            } else {
                return data;
            }
        } catch (error) {
            //console.error("getRedis catch error ==== ", error)
            if (cb) {
                return cb(error)
            }
            return error
        }
    });
}

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisLeaderboard = (key, data, expTime = 432000, setExp = true) => {
    try {
        ////console.log("redis set******", key, JSON.stringify(data))
        redis.set(key, JSON.stringify(data));
        setExp && redis.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * getBulkKeyRedisLeaderboard
 * @param key
 * @param cb
 */
const getBulkKeyRedisLeaderboard = (key, cb) => {
    // console.log('key**', key)
    redisLeaderboard.keys(key, (err, data) =>{
      if (err) {
        console.error("getRedis get err ==== ", err)
        return cb(err)
      }
      if (!data) {
        return cb(new Error('record not found'))
      }
      try {
  
        //data = JSON.parse(data);
        return cb(null, data)
      } catch (error) {
        console.error("getRedis catch error ==== ", error)
        return cb(error)
      }
    });
  }

    /**
     * setRedis For UserAnalysis
     * @param key 
     * @param data 
     * @param expTime default 10h
     */
    const setRedisForUserAnaysis = (key, data, expTime = 432000, setExp = true) => {
        try {
            console.log('key** in set user redis', key)
            redisForUserAnalysis.set(key, JSON.stringify(data));
            setExp && redisForUserAnalysis.expire(key, expTime);
        } catch (error) {
        }
    }

    /**
     * getRedis For UserAnalysis
     * @param key
     * @param cb
     */
    const getRedisForUserAnaysis = (key, cb) => {
        redisForUserAnalysis.get(key, (err, data) => {
            if (err) {
                if (cb) {
                    return cb(err)
                } else {
                    return err;
                }
            }
            if (!data) {
                if (cb) {
                    return cb(new Error(`record not found for key: ${key}`))
                } else {
                    return new Error(`record not found for key: ${key}`);
                }
            }
            try {
                data = JSON.parse(data);
                if (cb) {
                    return cb(null, data)
                } else {
                    return data;
                }
            } catch (error) {
                if (cb) {
                    return cb(error)
                }
                return error
            }
        });
    }

    /**
     * setRedis For UserAnalysis
     * @param key 
     * @param data 
     * @param expTime default 10h
     */
    const setRedisFavouriteContest = (key, data, expTime = 432000, setExp = true) => {
        try {
            console.log('key** in set user redis', key)
            redisForUserAnalysis.set(key, JSON.stringify(data));
            setExp && redisForUserAnalysis.expire(key, expTime);
        } catch (error) {
        }
    }

    /**
     * getRedis For getRedis For User Favourite Contest
     * @param key
     * @param cb
     */
    const getRedisFavouriteContest = (key, cb) => {
        redisForUserAnalysis.get(key, (err, data) => {
            if (err) {
                if (cb) {
                    return cb(err)
                } else {
                    return err;
                }
            }
            if (!data) {
                if (cb) {
                    return cb(new Error(`record not found for key: ${key}`))
                } else {
                    return new Error(`record not found for key: ${key}`);
                }
            }
            try {
                data = JSON.parse(data);
                if (cb) {
                    return cb(null, data)
                } else {
                    return data;
                }
            } catch (error) {
                if (cb) {
                    return cb(error)
                }
                return error
            }
        });
    }

module.exports = {
    cacheMiddle,
    setRedis,
    getRedis,
    incr,
    setIPRedis,
    getRedisLeaderboard,
    setRedisLeaderboard,
    getBulkKeyRedisLeaderboard,
    setRedisForUserAnaysis,
    getRedisForUserAnaysis,
    setRedisFavouriteContest,
    getRedisFavouriteContest,
    redisObj: redis,
    leaderboardRedisObj: redisLeaderboard,
    userAnalysisRedisObj: redisForUserAnalysis
};
