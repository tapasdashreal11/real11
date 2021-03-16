const config = require('../../../config');
const LFMyContestModel = require('../../../models/live-fantasy/lf-my-contest-model');
const ApiUtility = require('../../api.utility');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const { TransactionTypes, MatchStatus } = require('../../../constants/app');
// const mqtt = require('../../../lib/mqtt');
// const Helper = require('./common/helper');

var imageurl = config.imageBaseUrl;

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        var data = await lfMyContestModel(skip, pagesize, sort, filter, sport, type);
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
        console.log("error in lF join-contest-matches-api", error)
    }
}


module.exports = {
    lfJoinedContestMatches: async (req, res) => {
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
            
            let serverTime = moment(Date.now()).format(config.DateFormat.datetime);
            let serverTimeForalc = moment().utc().toDate();

            if (decoded) {
                if (decoded['user_id']) {

                    let sort = { "createdAt": -1 }
                    let skip = (decoded.page - 1) * (decoded.pagesize);
                    let sport = decoded.sport || 1;
                    var datsse = moment().subtract('30', 'days').toDate();
                    let filter = {};
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
                        getMatchRedisData(skip, decoded, filter, sort, sport, function (results) {
                            console.log(results);
                            results['server_time'] = serverTime;                              
                            return res.send(ApiUtility.success(results));
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

function lfMyContestModel(skip, limit, sort, filter, sport, type){
    return new Promise((resolve, reject) => {
        try{
            var serverTime2 = moment(new Date()).format(config.DateFormat.datetime);
            
            var matchesFilter = []
            let sortTime =  {};
            if(type == 'upcoming') {
                let currentDate2 = moment().utc().toDate();
                let oneMonthDateUp =  moment().utc().add('30','days').toDate();

                matchesFilter = [
                    { $eq: [ "$match_id", "$$matchId" ]},
                    { $eq: [ "$series_id", "$$seriesId" ]},
                    { $eq: [ "$match_status",  "Not Started" ]},
                    { $eq: [ "$sport",  sport ]},
                    { $eq: [ "$status",  1 ]},
                    { $gte: [ "$time",  currentDate2 ]},
                    { $lt: [ "$time",  oneMonthDateUp ]},
                ]
                sortTime = {sort_time : 1}
            }else if(type == 'live'){
                let currentDateLive	 =	moment().utc().toDate();
                matchesFilter = [
                    { $in: [ "$match_status", [MatchStatus.MATCH_INPROGRESS,MatchStatus.MATCH_DELAYED,MatchStatus.MATCH_NOTSTART,'Finished'] ]},
                    { $eq: [ "$sport",  sport ]},
                    { $eq: [ "$win_flag",  0 ]},
                    { $eq: [ "$status",  1 ]},
                    { $lte: [ "$time",  currentDateLive ]},
                    { $eq: [ "$match_id", "$$matchId" ]},
                    { $eq: [ "$series_id", "$$seriesId" ]},
                ]
                sortTime = {sort_time : -1}
            }else if(type == 'completed_match'){
                let pastMonthDateCM	=  moment().utc().subtract('30','days').toDate();
                matchesFilter = [
                    { $or: [ 
                        {$and: [{ $eq: ["$match_status", "Finished"] },{ $eq: [ "$win_flag",  1 ] }]},
                        { $eq: ["$match_status", "Cancelled"] }
                    ]},
                    { $eq: [ "$sport",  sport ]},
                    { $eq: [ "$status",  1 ]},
                    { $gte: [ "$time",  pastMonthDateCM ]},
                    { $eq: [ "$match_id", "$$matchId" ]},
                    { $eq: [ "$series_id", "$$seriesId" ]},
                ]
                sortTime = {sort_time : -1}
            }

            LFMyContestModel.aggregate([
                {
                    $match:filter
                },
                { $sort: sort },
                { $skip: skip },
                {
                    $lookup: {
                        from: 'lf_matches',
                        let: { matchId: "$match_id", seriesId : "$series_id"},
                        pipeline: [
                            {
                                $match: {
                                    $expr:{ 
                                        $and: matchesFilter
                                    }
                                }
                            },
                            {$project : {"localteam_id": 1, "visitorteam_id" : 1, "series_id":1, "match_status":1, "time":1, "date":1, "localteam_short_name":1, "visitorteam_short_name":1, "local_flag":1, "visitor_flag":1, "series_name":1, "localteam": 1, "visitorteam": 1, "win_flag" : 1}}
                        ],
                        as: 'matches',
                    }
                },
                {
                    $unwind: {
                        path: "$matches",
                        preserveNullAndEmptyArrays: false // optional
                    }
                },
                {
                    $project : {
                        "_id" : "$_id",
                        "p_t_c": "$p_t_c",
                        "match_id": "$match_id",
                        "series_id": "$series_id",
                        "match_status": {$cond: { if: { $and:[{ $eq: [ "$matches.match_status", 'Finished' ] },{ $eq: [ "$matches.win_flag", 0 ] }]}, then: "Under Review", else: "$matches.match_status" }}, //"$matches.match_status",
                        "local_team_id" : "$matches.localteam_id",
                        "local_team_name": {$cond: { if: { $eq: [ "$matches.localteam_short_name", null ] }, then: "$matches.localteam", else: "$matches.localteam_short_name" }},
                        "local_team_flag" : {$cond: { if: { $eq: [ "$matches.local_flag", null ] }, then: "", else: { $concat: [ config.imageBaseUrl, "/", "$matches.local_flag" ] }}},

                        "visitor_team_id" : "$matches.visitorteam_id",
                        "visitor_team_name" : {$cond: { if: { $eq: [ "$matches.visitorteam_short_name", null ] }, then: "$matches.visitorteam", else: "$matches.visitorteam_short_name" }},
                        "visitor_team_flag"  : {$cond: { if: { $eq: [ "$matches.visitor_flag", null ] }, then: "", else: { $concat: [ config.imageBaseUrl, "/", "$matches.visitor_flag" ] }}},
                        series_name : {$cond: { if: { $eq: [ "$matches.series_name", null ] }, then: " ", else: "$matches.series_name" }},
                        
                        "star_date":  { $dateToString: {date: "$matches.time", format: "%Y-%m-%d" } },
                        "star_time":  { $dateToString: {date: "$matches.time", format: "%H:%M" } },
                        "server_time": serverTime2,
                        "sort_time" : "$matches.time",
                        total_contest :"$total_contest"
                    }
                },
                {
                    $sort: sortTime
                },

            ], (err, data) => {
                if (err) {
                    reject(err);
                }
                if (!err) {
                    resolve(data);
                }
            }).option({ allowDiskUse: true });
        }catch(error){
            console.log("error", error)
        }
    });
}