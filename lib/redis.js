'use strict';

const RedisClient = require('redis');
const config = require('../server/config');
const { RedisKeys } = require('../server/constants/app');
const ObjectId = require('mongoose').Types.ObjectId;
const ApiUtility = require('../server/api/api.utility');
const Helper = require("../server/api/v1/common/helper");
const moment = require('moment');
const _ = require("lodash");
const redisEnt = require('./redisEnterprise');
var redis = RedisClient.createClient(config.redis.port, config.redis.host);
var redisLeaderboard = RedisClient.createClient(config.leaderboard_redis.port, config.leaderboard_redis.host);
var redisForUserAnalysis = RedisClient.createClient(config.useranalysis_redis.port, config.useranalysis_redis.host);
var redisWeekLeaderboard = RedisClient.createClient(config.leaderboard_redis.port, config.leaderboard_redis.host);
var redisLiveFantasyMatch = RedisClient.createClient(config.lf_redis.port, config.lf_redis.host);
var redisLiveFantasyLB = RedisClient.createClient(config.lf_redis_leaderboard.port, config.lf_redis_leaderboard.host);
var redisLogin = RedisClient.createClient(config.login_redis.port, config.login_redis.host);
var redisMyMatches = RedisClient.createClient(config.my_matches_redis.port, config.my_matches_redis.host);
var redisMyTeams = RedisClient.createClient(config.my_teams_redis.port, config.my_teams_redis.host);
var redisForContest = RedisClient.createClient(config.my_teams_redis.port, config.my_teams_redis.host);


redis.on("connect", function() {
    //console.log("Redis Server connected");
});

redis.getPromise = (key, defaultValue) => {
    return new Promise((resolve, reject) => {
        redis.get(key, (err, data) => {
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
redis.lfGetMPromise = (key, defaultValue) => {
    return new Promise((resolve, reject) => {
        redisLiveFantasyMatch.get(key, (err, data) => {
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
    
}

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedis = (key, data, expTime = 345600000, setExp = true) => {
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
const setIPRedis = (key, cb, expTime = 345600000, setExp = true) => {
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
const setRedisLeaderboard = (key, data, expTime = 345600000, setExp = true) => {
    try {
        //console.log("redis set******", key, JSON.stringify(data))
        redisLeaderboard.set(key, JSON.stringify(data));
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
const setRedisForUserAnaysis = (key, data, expTime = 345600000, setExp = true) => {
    try {
        //console.log('key** in set user redis', key)
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
 * setRedis For add cash coupon
 * @param key 
 * @param data 
 * @param expTime default 2h
 */
const setRedisForAddCashCoupon = (key, data, expTime = 7200, setExp = true) => {
    try {
        //console.log('key** in set add cash copunlist redis', key)
        redisForUserAnalysis.set(key, JSON.stringify(data));
        setExp && redisForUserAnalysis.expire(key, expTime);
    } catch (error) {
    }
}

/**
 * setRedis For UserAnalysis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisFavouriteContest = (key, data, expTime = 345600000, setExp = true) => {
    try {
        //console.log('key** in set user redis', key)
        redisForUserAnalysis.set(key, JSON.stringify(data));
        setExp && redisForUserAnalysis.expire(key, expTime);
    } catch (error) {
    }
}

const deleteRedisFavouriteContest = (key) => {
    try {
        //console.log('key** in set user redis for delete', key)
        redisForUserAnalysis.del(key, function(err, response) {
            if (response == 1) {
                console.log("Deleted Successfully!");
            } else{
                console.log("Cannot delete",err);
            }
            })
            
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

/**
 * setRedis For User Category
 * @param key 
 * @param data 
 * @param expTime defaul false
 */
const setRedisForUserCategory = (key, data, expTime = 345600000, setExp = false) => {
    try {
        redisForUserAnalysis.set(key, JSON.stringify(data));
        setExp && redisForUserAnalysis.expire(key, expTime);
    } catch (error) {
    }
}

/**
 * getRedis for week leader board
 * @param key
 * @param cb
 */
const getRedisWeekLeaderboard = (key, cb) => {
    redisWeekLeaderboard.get(key, (err, data) => {
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
 * setRedis for week leader board
 * @param key 
 * @param data 
 * @param expTime false never expire
 */
const setRedisWeekLeaderboard = (key, data, expTime = 345600000, setExp = false) => {
    try {
        redisWeekLeaderboard.set(key, JSON.stringify(data));
        setExp && redis.expire(key, expTime);
    } catch (error) {
        console.error("setRedis error for week leaderboard ==== ", error)
    }
}

/**
 * set redis for live fantasy match
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisForLf = (key, data, expTime = 345600000, setExp = true) => {
    try {
        redisLiveFantasyMatch.set(key, JSON.stringify(data));
        setExp && redisLiveFantasyMatch.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * get Redis for live fantasy match
 * @param key
 * @param cb
 */
const getRedisForLf = (key, cb) => {
    redisLiveFantasyMatch.get(key, (err, data) => {
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
 * getRedis for LF Leaderboard
 * @param key
 * @param cb
 */
const getRedisLFBoard = (key, cb) => {
    redisLiveFantasyLB.get(key, (err, data) => {
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
 * setRedis for LF Leaderboard
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisLFBoard = (key, data, expTime = 345600000, setExp = true) => {
    try {
        redisLiveFantasyLB.set(key, JSON.stringify(data));
        setExp && redisLiveFantasyLB.expire(key, expTime);
    } catch (error) {
    }
}

/**
 * set redis for live fantasy
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisLogin = (key, data, expTime = 345600000, setExp = true) => {
    try {
        redisLogin.set(key, JSON.stringify(data));
        setExp && redisLogin.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

const setRedisLoginForReferal = (key, data, expTime = 86400, setExp = true) => {
    try {
        redisLogin.set(key, JSON.stringify(data));
        setExp && redisLogin.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * get Redis for live fantasy
 * @param key
 * @param cb
 */
const getRedisLogin = (key, cb) => {
    redisLogin.get(key, (err, data) => {
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
 * set redis for live fantasy
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisMyMatches = (key, data, expTime = 345600000, setExp = true) => {
    try {
        redisMyMatches.set(key, JSON.stringify(data));
        setExp && redisMyMatches.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * get Redis for live fantasy
 * @param key
 * @param cb
 */
const getRedisMyMatches = (key, cb) => {
    redisMyMatches.get(key, (err, data) => {
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
 * set redis for live fantasy
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedisMyTeams = (key, data, expTime = 345600000, setExp = true) => {
    try {
        redisMyTeams.set(key, JSON.stringify(data));
        setExp && redisMyTeams.expire(key, expTime);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

/**
 * get Redis for live fantasy
 * @param key
 * @param cb
 */
const getRedisMyTeams = (key, cb) => {
    redisMyTeams.get(key, (err, data) => {
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
    setRedisForAddCashCoupon,
    getRedisFavouriteContest,
    deleteRedisFavouriteContest,
    setRedisForUserCategory,
    redisObj: redis,
    leaderboardRedisObj: redisLeaderboard,
    userAnalysisRedisObj: redisForUserAnalysis,
    getRedisWeekLeaderboard,
    setRedisWeekLeaderboard,
    weekLeaderboardObj: redisWeekLeaderboard,
    setRedisForLf,
    getRedisForLf, 
    redisLiveFantasyObj: redisLiveFantasyMatch,
    setRedisLFBoard,
    getRedisLFBoard, 
    redisLiveFantasyLBoardObj: redisLiveFantasyLB,
    setRedisLogin,
    setRedisLoginForReferal,
    getRedisLogin,
    redisLoginObj: redisLogin,
    setRedisMyMatches,
    getRedisMyMatches,
    redisnMyMatchesObj: redisMyMatches,
    setRedisMyTeams,
    getRedisMyTeams,
    redisnMyTeamsObj: redisMyTeams,
    redisForContestObj : redisForContest
};
