const { ObjectId } = require('mongodb');
const LiveFantasyMatchList = require('../../../models/live-fantasy/lf-match-list-model');
const LiveFantasyMatchContest = require('../../../models/live-fantasy/lf-match-contest');
const CouponSale = require("../../../models/coupon-sale");
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const redis = require('../../../../lib/redis');
const moment = require('moment');
const _ = require("lodash");
var imageurl = config.imageBaseUrl;
const { sendMailToDeveloper } = require('./../common/helper');


module.exports = {
    liveFantasyMatchList: async (req, res) => {
        try {
            let data1 = {};
            let {pmatch_id,sport} = req.params;
            const upCommingMatch = await LiveFantasyMatchList.find({over_parent_id:pmatch_id,time: {$gte: new Date()}, status:1,match_status:"Not Started"}).limit(40).sort({_id:-1});
            let liveData = [];
            let finishData = [];
            data1.upcoming_match = upCommingMatch;
            data1.total = upCommingMatch.length;
            data1.live_match = liveData;
            data1.completed_match = finishData;
            data1.message = 'Test Message';
            data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
            var successObj = ApiUtility.success(data1);
            redis.setRedisForLf('lf-match-list-'+ pmatch_id + '-' + sport, successObj);
            res.send(successObj);
        } catch (error) {
            console.log(error);
            sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
    liveFantasyMatchContestList: async (req, res) => {
        try {
            const { match_id, sport,series_id } = req.params;
            const user_id = req.userId;
            let resObj = {
                match_contest: [],
                my_contests: 0,
                joined_contest_ids:[],
                user_coupons: {},
            };
            if(match_id && sport){
                let filter = {
                    "match_id": parseInt(match_id),
                    "sport": parseInt(sport),
                    is_full: { $ne: 1 }
                };
                let contestList  = await getLfMatchContest(filter,false);
                if(user_id){
                    let redisKeyForUserMyCoupons = 'my-coupons-'+ user_id;
                    let userCoupons = await getPromiseForUserCoupons(redisKeyForUserMyCoupons, "{}",user_id);
                    resObj['user_coupons'] = userCoupons || {};
                }
                resObj['match_contest'] = contestList || [];

                if(contestList && contestList.length>0){
                    redis.setRedisForLf('lf-match-contest-list-'+ match_id + '-' + sport, contestList);
                }
                
                var finalResult = ApiUtility.success(resObj);
                return res.send(finalResult);
            } else {
                return res.send(ApiUtility.failed('Something went wrong!!'));
            }
            
        } catch (error) {
            console.log(error);
           // sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    }
}

function getLfMatchContest(filter,is_all){
    is_all = false;
    console.log(filter);
    return new Promise((resolve, reject) => {
        try{
            var is_joined = false;
            LiveFantasyMatchContest.aggregate([
                {
                    $match: filter
                },   
                {
                    $group : {
                        _id : "$category_id",
                        category_name : {$first : "$category_name"},
                        description : {$first : "$description"},
                        status : {$first : "$status"},
                        sequence : {$first : "$category_seq"},
                        match_id : {$first : "$match_id"},
                        series_id : {$first : "$series_id"},
                        parent_match_id : {$first : "$parent_match_id"},
                        match_contest_id : {$first : "_id"},
                        contests : {"$push": "$$ROOT"  }
                    }
                },
                {
                    $project: {
                        _id:"$_id",
                        match_id: "$match_id",
                        category_id:"$_id",
                        "category_title": "$category_name",
                        "sequence": "$sequence",
                        "category_desc": "$description",
                        "series_id": "$series_id",
                        "parent_match_id": "$parent_match_id",
                        "contests": {
                            $map: {
                                "input": "$contests",
                                as: "sec",
                                in: {
                                    "contest_id": "$$sec.contest_id",
                                    "parent_contest_id":"$$sec.parent_contest_id",
                                    "entry_fee": "$$sec.entry_fee",
                                    "prize_money": "$$sec.winning_amount",
                                    "is_full": "$$sec.is_full",
                                    "confirm_winning": {$cond: { if: { $eq: [ "$$sec.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                    "is_gadget": {$cond: { if: { $eq: [ "$$sec.amount_gadget", "gadget" ] }, then: true, else: false }},
                                    "category_id": "$$sec.category_id",
                                    "is_auto_create": "$$sec.is_auto_create",                                       
                                    "multiple_team": {$cond: { if: { $in: [ "$$sec.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                    "invite_code": "$$sec.invite_code",
                                    "breakup_detail": { 
                                        $map: {
                                            "input": "$$sec.breakup",
                                            as: "break",
                                            in: {
                                                "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                "image": {$cond: { if: { $ne: [ "$$break.image", "" ] }, then: { $concat: [ imageurl, "/", "$$break.image" ] }, else: "" }},
                                                "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                            }
                                        }
                                    },
                                    "after_time_bonus":  "$$sec.after_time_bonus",
                                    "before_time_bonus": "$$sec.before_time_bonus",
                                    "current_date": new Date(),
                                    "usable_bonus_time":'$$sec.usable_bonus_time',
                                    "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.used_bonus"} }},
                                    "is_infinite": {$cond: { if: { $eq: [ "$$sec.infinite_contest_size", 1 ] }, then: true, else: false }},
                                    "teams_joined": "$$sec.joined_users",
                                    "total_teams": "$$sec.contest_size",
                                    "total_winners": { $arrayElemAt: [ "$$sec.breakup", -1 ] },
                                    "is_joined": is_joined, 
                                    "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.winner_percent", "winner_amount": "$$sec.winning_amount_times"}, else: {} }},
                                    "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.amount_gadget", "aakash" ] }, then: true, else: false }},
                                    "maximum_team_size": {$cond: { if: { $in: [ "$$sec.multiple_team", ["yes",true] ] }, then: { $cond: { if: { $ifNull: ["$$sec.maximum_team_size",false] },then: "$$sec.maximum_team_size",else: 9 } }, else: 1 }},
                                    
                                }
                            }
                        },
                    }
                },
                {$sort : {category_seq : 1}}
            ], (err, data) => {
                if (err) {
                    reject(err);
                }
                if (!err) {
                    if(is_all && data && data.length > 0){
                        var conArry = [];
                        var dlength = data.length;
                        _.forEach(data, function(k, i){
                            conArry.push(k.contests)
                            if(i === (dlength - 1)){
                                var newArray = Array.prototype.concat.apply([], conArry);
                                resolve([{"contests": newArray}]);
                            }
                        })
                    }else{
                        resolve(data);
                    }
                }
            });
        }catch(err){
            reject(err);
        } 
    });
}
async function getPromiseForUserCoupons(key, defaultValue,user_id){
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) { 
                reject(defaultValue);
            }
            if (data == null) {
                const cSaleData = await CouponSale.findOne({user_id:ObjectId(user_id),status: 1 });
                console.log('cSaleData from list *****',cSaleData);
                if(cSaleData && cSaleData._id){
                    redis.redisObj.set('my-coupons-'+ user_id,JSON.stringify(cSaleData));
                    data = JSON.stringify(cSaleData);
                } else {
                    data = defaultValue;
                }
                
            }
            resolve(data)
        })
    })
}