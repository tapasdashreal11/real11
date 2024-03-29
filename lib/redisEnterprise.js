'use strict';

const RedisClient = require('redis');
const _ = require("lodash");

var redis = RedisClient.createClient({url: process.env.ENT_REDIS_URL});

redis.on("connect", function() {
    console.log("Redis Server connected");
});

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedis = async (key, field, data, expDays = 0) => {
    try {
        var secconds = process.env.ENT_REDIS_EXPTIME;
        if(expDays && expDays > 0) {
            secconds = expDays * 24 * 60 * 60;
        }
        await redis.hset(key, field, JSON.stringify(data));
        redis.expire(key, secconds);
    } catch (error) {
        console.error("setRedis error ==== ", error)
    }
}

/**
 * getRedis Used for HGETALL
 * @param key
 * @param cb
 */
 const getRedis = async (key,cb) => {
    await redis.HGETALL(key, (err, data) => {
        // console.log(err, data)
        if (err) {
            return cb(err)
        }
        if (!data) {
            return cb(null,[])
            //return cb([new Error(`record not found for key: ${key}`)])
        }
        try {
            let array = [];
            Object.keys(data).forEach(function(key, index) {
                array.push(JSON.parse(data[key]))
            });
            return cb(null, array)
        } catch (error) {
            return cb(error)
        }
    });
}

async function getRedisData(key) {
    try {
        return new Promise(async (resolve, reject) => {
            await getRedis(key, function (err, data) {
                if(err){
                    return reject(err)
                }else{

                    if (data) {
                        return resolve(data);
                    } else {
                        return resolve(false);
                    }
                }
            })
        });
    } catch (error) {
        // console.log('redis for join contest > ', error);
    }
}

const getHashRedis = async (key) => {
    return await getRedisData(key)
}

/**
 * getRedis
 * @param key
 * @param cb
 */
 const getNormalFunRedis = async(key, cb) => {
    redis.get(key, (err, data) => {
        if (err) {
            if (cb) {
                return cb(err)
            } else {
                return err;
            }
        }
        if (!data) {
            if (cb) {
                // return cb(new Error(`record not found for key: ${key}`))
                return cb(`record not found for key: ${key}`,[])
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
async function getNormalRedisData(key) {
    try {
        return await new Promise(async (resolve, reject) => {
            await getNormalFunRedis(key, function (err, data) {
                if(err){
                    // return reject(err)
                    return reject(new Error(err))
                }else{
                    if (data) {
                        return resolve(data);
                    } else {
                        return resolve(false);
                    }
                }
            })
        });
    } catch (error) {
        // console.log('Error in getNormalRedis > ', error.message);
    }
}

const getNormalRedis = async (key) => {
    return await getNormalRedisData(key)
}

const setNormalRedis = (key, data, expDays = 0) => {
    try {
        var secconds = process.env.ENT_REDIS_EXPTIME;
        if(expDays && expDays > 0) {
            secconds = expDays * 24 * 60 * 60;
        }
        redis.set(key, JSON.stringify(data));
        redis.expire(key, secconds);
    } catch (error) {
        //console.error("setRedis error ==== ", error)
    }
}

////////////////////////
const getHGETRedis = async (key,fieldId,cb) => {
    await redis.HGET(key, fieldId, (err, data) => {
        
        if (err) {
            return cb(err)
        }
        if (!data) {
            return cb(null,[])
            //return cb([new Error(`record not found for key: ${key}`)])
        }
        try {
            return cb(null, JSON.parse(data))
        } catch (error) {
            return cb(error)
        }
    });
}

const getHashCount = async (key) => {

    try {
        return await new Promise(async (resolve, reject) => {
            await redis.HLEN(key, (err, data) => {
        
                if (err) {
                    return resolve(err);
                }
                if (!data) {
                    return resolve(0);
                }
                try {
                    return resolve(data)
                } catch (error) {
                    return resolve(0);
                }
            });
        });
    } catch (error) {
        // console.log('Error in getNormalRedis > ', error.message);
    }
    
}




module.exports = {
    setRedis,
    getRedis,
    getHashRedis,
    getNormalRedis,
    setNormalRedis,
    getHGETRedis,
    getHashCount,
    getNormalFunRedis,
    redisObj:redis
};