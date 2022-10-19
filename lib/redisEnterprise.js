'use strict';

const RedisClient = require('redis');
const config = require('../server/config');
const { RedisKeys } = require('../server/constants/app');
const PlayerTeamContest = require('../server/models/player-team-contest');
const ObjectId = require('mongoose').Types.ObjectId;
const ApiUtility = require('../server/api/api.utility');
const Helper = require("../server/api/v1/common/helper");
const moment = require('moment');
const _ = require("lodash");
const { isEmpty } = require('lodash');

// var redis = RedisClient.createClient({url: process.env.ENT_REDIS_URL});
var redis = RedisClient.createClient({"host": "redis-18936.c20812.ap-south-1-mz.ec2.cloud.rlrcp.com","port":18936,"username": "Real11Test","password":"Sdkfjdkfdkf76$&8skfjksfj", "db":0});


redis.on("connect", function() {
    console.log("Redis Server connected on ent");
});

/**
 * setRedis
 * @param key 
 * @param data 
 * @param expTime default 10h
 */
const setRedis = async (key, field, data, setExp = true) => {
    try {
        await redis.hset(key, field, JSON.stringify(data));
         setExp && redis.expire(key, process.env.ENT_REDIS_EXPTIME);
    } catch (error) {
        console.error("setRedis error ==== ", error)
    }
}

// const setHset = async () => {
//     console.log(">>>>here");
//     await redis.hset('test', 'test_1', 'test success');
// }
// setHset()

/**
 * getRedis
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
            //return cb(null,[])
            return cb([new Error(`record not found for key: ${key}`)])
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
        console.log('redis for join contest > ', error);
    }
}

const getHashRedis = async (key) => {
    return await getRedisData(key)
}



module.exports = {
    setRedis,
    getRedis,
    getHashRedis,
    redisObj:redis
};