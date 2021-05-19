const config = require('../../../config');
const MyContestModel = require('../../../models/my-contest-model');
const SeriesSquadModel = require('../../../models/series-squad');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { RedisKeys,MatchStatus,TransactionTypes } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
var imageurl = config.imageBaseUrl;

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        var data = await myContestModel(skip, pagesize, sort, filter, sport, type);
        callback(null, data)
    } catch (error) {
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


module.exports = {
    joinedContestMatchesNew: async (req, res) => {
        try {
            console.log("this is my match list new ****");
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
                        redis.getRedisMyMatches(matchContestKey, function (err, contestData) { // Get Redis 
                            if (!contestData) {
                                getMatchRedisData(skip, decoded, filter, sort, sport, function (results) {
                                    results['server_time'] = serverTime;
                                    redis.setRedisMyMatches(matchContestKey, results); // Set Redis                                 
                                    return res.send(ApiUtility.success(results));
                                })
                            } else {
                                var newLiveArray = JSON.parse(JSON.stringify(contestData))
                                var contestDataUp = newLiveArray.upcoming_match.length;
                                if (contestDataUp > 0) {
                                    let key = 0;
                                    _.forEach(newLiveArray.upcoming_match, function (i, k) {
                                        if (i && moment(i.sort_time).toDate() < serverTimeForalc) {
                                            i["match_status"] = 'In Progress';
                                            newLiveArray.live_match.unshift(i);
                                            newLiveArray.upcoming_match.splice(k, 1)
                                        }
                                        key++;
                                    })
                                    if (key === contestDataUp) {
                                        newLiveArray['server_time'] = serverTime;
                                        redis.setRedisMyMatches(matchContestKey, newLiveArray); // Set Redis
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

function myContestModel(skip, limit, sort, filter, sport, type){
    return new Promise(async (resolve, reject) => {
        try{
            var serverTime2 = moment(new Date()).format(config.DateFormat.datetime);
            var matchesFilter = []
            let sortTime =  {};
            var queryObj = {};
            if(type == 'upcoming') {
                let currentDate2 = moment().utc().toDate();
                let oneMonthDateUp =  moment().utc().add('30','days').toDate();
                queryObj = {sport:sport,status:1,match_status:"Not Started",time:{$gte:currentDate2,$lt:oneMonthDateUp}}
                sortTime = {date : 1}
            } else if (type == 'live'){
                let currentDateLive	 =	moment().utc().toDate();
                sortTime = {date : -1}
                queryObj = {win_flag:0,sport:sport,status:1,match_status:{$in:[MatchStatus.MATCH_INPROGRESS,MatchStatus.MATCH_DELAYED,MatchStatus.MATCH_NOTSTART,'Finished']},time:{$lte:currentDateLive}}

            } else if (type == 'completed_match'){
                let pastMonthDateCM	=  moment().utc().subtract('30','days').toDate();
                queryObj = {sport:sport,status:1,time:{$gte:pastMonthDateCM},$or: [ 
                    {match_status:"Finished", win_flag:1},
                    {match_status:"Cancelled"}
                ]}
                sortTime = {date : -1}
            }
           let myJoindMatch = await MyContestModel.find(filter).skip(skip).sort(sort);

           let matchIds  = _.map(myJoindMatch,'match_id');
           queryObj['match_id']= {$in:matchIds};
           
           let seriesSqueadData = await SeriesSquadModel.find(queryObj).sort(sortTime);
           let data = [];
            if(seriesSqueadData && seriesSqueadData.length>0){
                for (const sItem of seriesSqueadData) {
                    let myMatchItem = myJoindMatch.find(element => element.match_id==sItem.match_id && element.series_id==sItem.series_id);
                    if(myMatchItem && myMatchItem._id){
                        console.log("sItem***",sItem);
                        let ddItem = {
                            _id : myMatchItem._id,
                            match_id : sItem.match_id,
                            series_id : sItem.series_id,
                            match_status : sItem && sItem.match_status && sItem.match_status== "Finished" && sItem.win_flag == 0 ? "Under Review" : sItem.match_status,
                            local_team_id : sItem.localteam_id,
                            local_team_name : _.isNull(sItem.localteam_short_name) ?sItem.localteam :sItem.localteam_short_name,
                            local_team_flag : _.isNull(sItem.local_flag) ? null :config.imageBaseUrl + "/" + sItem.local_flag,
                            visitor_team_id : sItem.visitorteam_id,
                            visitor_team_name : _.isNull(sItem.visitorteam_short_name) ?sItem.visitorteam :sItem.visitorteam_short_name,
                            visitor_team_flag : _.isNull(sItem.visitor_flag) ? null :config.imageBaseUrl + "/" + sItem.visitor_flag,
                            series_name : _.isNull(sItem.series_name) ? "" :sItem.series_name,
                            star_date:  sItem.date_str || '',
                            star_time: sItem.time_str || '', 
                            server_time : serverTime2,
                            sort_time : sItem.time,
                            total_contest : myMatchItem.total_contest,
                            match_type : _.has(sItem, "is_parent") || _.has(sItem, "live_fantasy_parent_id")?(sItem.is_parent ? "FULL":(sItem.live_fantasy_parent_id ? "LIVE":"FULL")):"FULL" 
                        }
                        data.push(ddItem);
                        
                    }
                }
                if(data && data.length>0){
                    resolve(data);
                }
            } else {
                resolve(data);
            }
           
        } catch (error){
            console.log("error in*******", error)
            reject(error);
        }
    });
}