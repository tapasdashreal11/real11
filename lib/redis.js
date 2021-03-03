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
var redis = RedisClient.createClient(config.redis.port, config.redis.host);
var redisLeaderboard = RedisClient.createClient(config.leaderboard_redis.port, config.leaderboard_redis.host);
var redisForUserAnalysis = RedisClient.createClient(config.useranalysis_redis.port, config.useranalysis_redis.host);
var redisWeekLeaderboard = RedisClient.createClient(config.leaderboard_redis.port, config.leaderboard_redis.host);
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
        if (req.route.path == '/api/v1/contest-list/:match_id/:sport?') {
            let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${req.params.match_id}`;
            let contetestMatchKey = RedisKeys.MATCH_CONTEST_LIST + req.params.match_id;
            console.log('Hello 1********');
            next();
            let match_sport = req && req.params && req.params.sport ? req.params.sport :1;
            //let match_series_id = req && req.params && req.params.series_id ? parseInt(req.params.series_id) : 1;
            let redisKeyForUserAnalysis = 'app-analysis-' + req.userId  + '-' + req.params.match_id  + '-' + match_sport;
            let promiseArray = [
                redis.getPromise(contetestMatchKey, []),
                redis.getPromise(joinedTeamsCountKey, "[]"),
            ];
            if (req.userId) {
                promiseArray.push(redis.getPromise('user-teams-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-teamIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromise('user-contest-joinedContestIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromiseForAnalysis(redisKeyForUserAnalysis, "{}"));
            }
            let redisData = await Promise.all(promiseArray).catch((err) => {
                //console.log("promise error in caheche for contest list")
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
        }else if (req.route.path == '/api/v1/contest-list-new/:match_id/:sport?/:series_id?') {
            try {
                let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${req.params.match_id}`;
                let contetestMatchKey = RedisKeys.MATCH_CONTEST_LIST + req.params.match_id;
                let match_sport = req && req.params && req.params.sport ? req.params.sport :1;
                let userCategory = {is_super_user : 0,is_dimond_user : 0,is_beginner_user :0};
                //let match_series_id = req && req.params && req.params.series_id ? parseInt(req.params.series_id) : 1;
                
                let promiseArray = [
                    redis.getPromise(contetestMatchKey, []),
                    redis.getPromise(joinedTeamsCountKey, "[]"),
                ];
                if (req.userId) {
                    let redisKeyForUserAnalysis = 'app-analysis-' + req.userId  + '-' + req.params.match_id  + '-' + match_sport;
                    let redisKeyForFavouriteContest = 'favourite-contest-' + req.userId;
                    let redisKeyForUserCategory = 'user-category-' + req.userId;
                    let redisKeyForUserMyCoupons = 'my-coupons-'+ req.userId;
                    promiseArray.push(redis.getPromise('user-teams-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                    promiseArray.push(redis.getPromise('user-contest-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                    promiseArray.push(redis.getPromise('user-contest-teamIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                    promiseArray.push(redis.getPromise('user-contest-joinedContestIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                    promiseArray.push(redis.getPromiseForAnalysis(redisKeyForUserAnalysis, "{}"));
                    promiseArray.push(redis.getPromiseForAnalysis(redisKeyForFavouriteContest, "{}"));
                    promiseArray.push(redis.getPromiseForAnalysis(redisKeyForUserCategory, "{}"));
                    promiseArray.push(redis.getPromise(redisKeyForUserMyCoupons, "{}"));
                }
                let redisData = await Promise.all(promiseArray).catch((err) => {
                    
                    next();
                });
                if (redisData && redisData[0].length > 0) {
                    let matchContestData = JSON.parse(redisData[0]);
                    userCategory  = redisData && redisData.length >= 9 && redisData[8] && !_.isEmpty(redisData[8]) ? JSON.parse(redisData[8]):userCategory;
                    //console.log("userCategory from redis****",userCategory);
                    let newMatchContestData = matchContestData;
                    try{
                         newMatchContestData = _.reject(newMatchContestData, function(e) {
                            userCategory = _.has(userCategory, "is_super_user") && _.has(userCategory, "is_dimond_user") && _.has(userCategory, "is_beginner_user")?userCategory :{is_super_user : 0,is_dimond_user : 0,is_beginner_user :0}; 
                            //userCategory = _.isEmpty(userCategory)?{is_super_user : 0,is_dimond_user : 0,is_beginner_user :0}: userCategory;
                            return (ObjectId(e.category_id).equals(ObjectId(config.user_category.beginner_cat)) && userCategory.is_beginner_user == 0 ) ||
                            (ObjectId(e.category_id).equals(ObjectId(config.user_category.super_cat)) && userCategory.is_super_user == 0 ) ||
                            (ObjectId(e.category_id).equals(ObjectId(config.user_category.dimond_cat)) && userCategory && userCategory.is_dimond_user == 0 )
                        });
                    }catch(eerrrr){}
                    if(_.size(newMatchContestData) == 0 || _.isNull(newMatchContestData) || _.isUndefined(newMatchContestData)){
                        //console.log('*******contest list empty in reids')
                        return next();
                    }
                    let finalRes = {
                        match_contest: newMatchContestData,
                        my_teams: 0,
                        my_contests: 0,
                        user_rentation_bonous:{},
                        user_favourite_contest:{}
                    }
                    if (req.userId) {
                        if (redisData && redisData[2] == 0) {
                            return next();
                        }
                        
                        let userTeamIds = [];
                        if (redisData && redisData[4]) {
                            userTeamIds = JSON.parse(redisData[4]);
                        }
                        
                        finalRes['joined_teams_count'] = Helper.parseContestTeamsJoined(JSON.parse(redisData[1]))
                        finalRes['my_teams'] = redisData && redisData.length >1? parseInt(redisData[2]):0;
                        finalRes['my_contests'] = redisData ? parseInt(redisData[3]):0;
                        finalRes['user_team_ids'] = userTeamIds;
                        finalRes['joined_contest_ids'] =redisData && redisData.length >= 6 && redisData[5] ? JSON.parse(redisData[5]):[];
                        finalRes['user_rentation_bonous'] = redisData && redisData.length >= 7 && redisData[6] ? JSON.parse(redisData[6]):{};
                        finalRes['user_favourite_contest'] = redisData && redisData.length >= 8 && redisData[7] ? JSON.parse(redisData[7]):{};
                        finalRes['user_coupons'] = redisData && redisData.length == 10 && redisData[9] ? JSON.parse(redisData[9]):{};
                        console.log("userCoupons**** in redis",finalRes['user_coupons']);
                        
                    }
                    return res.send(ApiUtility.success(finalRes));
                } else {
                    next();
                }
            }catch(errrrr){
                next();
            }
            
        }  else if (req.route.path == '/api/v1/contest-list-new-old/:match_id/:sport?/:series_id?') {
             
             try{
             let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${req.params.match_id}`;
             let contetestMatchKey = RedisKeys.MATCH_CONTEST_LIST + req.params.match_id;
            let match_sport = req && req.params && req.params.sport ? req.params.sport :1;
             console.log('Hello 1********');
           // let match_series_id = req && req.params && req.params.series_id ? parseInt(req.params.series_id) : 1;
            let redisKeyForUserAnalysis = 'app-analysis-' + req.userId  + '-' + req.params.match_id  + '-' + match_sport;
           let redisKeyForFavouriteContest = 'favourite-contest-' + req.userId; 
            let promiseArray = [
                redis.getPromise(contetestMatchKey, []),
                redis.getPromise(joinedTeamsCountKey, "[]"),
            ];
            console.log('Hello 2********',redisKeyForUserAnalysis);
            if (req.userId) {
                promiseArray.push(redis.getPromise('user-teams-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-count-' + req.params.match_id + '-' + match_sport + '-' + req.userId, 0));
                promiseArray.push(redis.getPromise('user-contest-teamIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromise('user-contest-joinedContestIds-' + req.userId + '-' + req.params.match_id + '-' + match_sport, "[]"));
                promiseArray.push(redis.getPromiseForAnalysis(redisKeyForUserAnalysis, "{}"));
                promiseArray.push(redis.getPromiseForAnalysis(redisKeyForFavouriteContest, "{}"));
            }
            let redisData = await Promise.all(promiseArray).catch((err) => {
               console.log('eror',err); 
              next();
            });
           console.log('Hello 2222222********');
            if (redisData && redisData[0].length > 0) {
                let matchContestData = JSON.parse(redisData[0]);
                let finalRes = {
                    match_contest: matchContestData,
                    my_teams: 0,
                    my_contests: 0,
                    user_rentation_bonous:{},
                    user_favourite_contest:{}
                }
               console.log('Hello 11****');
               if (req.userId) {
                    if (redisData && redisData[2] == 0) {
                        return next();
                    }
                    
                    let userTeamIds = [];
                    if (redisData && redisData[4]) {
                        userTeamIds = JSON.parse(redisData[4]);
                    }
                  console.log('Hello 12****');
                    finalRes['joined_teams_count'] = Helper.parseContestTeamsJoined(JSON.parse(redisData[1]))
                    finalRes['my_teams'] = redisData && redisData.length >1? parseInt(redisData[2]):0;
                    finalRes['my_contests'] = redisData ? parseInt(redisData[3]):0;
                    finalRes['user_team_ids'] = userTeamIds;
                    finalRes['joined_contest_ids'] =redisData && redisData.length >= 6 && redisData[5] ? JSON.parse(redisData[5]):[];
                    finalRes['user_rentation_bonous'] = redisData && redisData.length >= 7 && redisData[6] ? JSON.parse(redisData[6]):{};
                    finalRes['user_favourite_contest'] = redisData && redisData.length >= 8 && redisData[7] ? JSON.parse(redisData[7]):{};
                    
                }
                return res.send(ApiUtility.success(finalRes));
            } else {
             console.log('Hello from*****');
                next();
            }
           } catch(errrrr){
                next();
           }
        } else if (req.route.path == '/api/v1/get-match-list/:sport?') {
            let sport= parseInt(req.params.sport) || 1;
            console.log(sport);
            redis.get('match-list-'+sport, (err, data) => {
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
        }else if (req.route.path == '/api/v1/get-match-detail/:match_id/:sport/:series_id') {
            try {
                const {series_id, match_id } = req.params;
                let cdataRsp = {};
                let sport   =   parseInt(req.params.sport) || 1;
                if(match_id && series_id){
                    redis.get('match-list-'+sport, (err, data) => {
                        if (data) {
                            let matchListData = JSON.parse(data);
                            if (matchListData && matchListData.data && matchListData.data.upcoming_match) {
                                 const lst = JSON.parse(JSON.stringify(matchListData.data.upcoming_match));
                                  cdataRsp = _.find(lst, { 'match_id': parseInt(match_id),'series_id': parseInt(series_id)});
                              return res.send(ApiUtility.success(cdataRsp));
                            } else {
                                return res.send(ApiUtility.success(cdataRsp));
                            }
                        } else {
                            return res.send(ApiUtility.success({}));
                        }
                    });
                } else {
                    return res.send(ApiUtility.failed("Wrong Parameters!!"));
                }
            } catch(erorrr){
                console.log('erorrr in match list detail from redis',erorrr);
                return res.send(ApiUtility.failed("Something went wrong!!"));
            }
           
            
        }else if (req.route.path == '/api/v1/view-add-cash-coupon') {
            try{
                let redisKeyForAddCashCoupon = 'add-cash-coupon-list';
                if(req && req.userId){
                    redisForUserAnalysis.get(redisKeyForAddCashCoupon, (err, couponData) => { 
                        if(couponData){
                            let couponData1 = couponData ? JSON.parse(couponData):{};
                            //console.log("couponData***",couponData1);
                           return res.send(ApiUtility.success(couponData1));
                        } else {
                           console.log("couponData redis empty***");
                           next();
                        } 
                    });
                } else {
                    return res.send(ApiUtility.failed("Wrong Parameter!!"));
                }
            } catch(erorrr){
                console.log('erorrr in coupon list',erorrr);
                next();
            }
           
            
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
                next();
                console.log("error category", error)
            }
        }
    } catch (error) {
        next();
        console.log('error in redis for contest list', error)
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
    const setRedisForUserAnaysis = (key, data, expTime = 432000, setExp = true) => {
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
    const setRedisFavouriteContest = (key, data, expTime = 432000, setExp = true) => {
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
    const setRedisForUserCategory = (key, data, expTime = 432000000, setExp = false) => {
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
const setRedisWeekLeaderboard = (key, data, expTime = 432000, setExp = false) => {
    try {
        redisWeekLeaderboard.set(key, JSON.stringify(data));
        setExp && redis.expire(key, expTime);
    } catch (error) {
        console.error("setRedis error for week leaderboard ==== ", error)
    }
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
    getRedisWeekLeaderboard,
    setRedisWeekLeaderboard, 
    redisObj: redis,
    leaderboardRedisObj: redisLeaderboard,
    userAnalysisRedisObj: redisForUserAnalysis,
    weekLeaderboardObj: redisWeekLeaderboard
};
