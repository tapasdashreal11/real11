const OtherGamesContes = require('../../../models/other_games_contest');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const { RedisKeys } = require('../../../constants/app');
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const config = require('./../../../config');
const CouponSale = require("../../../models/coupon-sale");

module.exports = async (req, res) => {
 
try {
        const { match_id, sport,series_id } = req.params;
        const user_id = "609b66b8ed55670950d6f7d3";  //req.userId;
        let match_sport = sport ? parseInt(sport) : 3;
        let filter = {
            "match_id": parseInt(match_id),
            "sport": match_sport,
            is_full: 0
        };
        let userCategory = {is_super_user : 0,is_dimond_user : 0,is_beginner_user :0
        };
        let userCoupons = [];
        let queryArray = [
            await getContestListForOthergames(filter,false)
        ];
        if (user_id) {
            let redisKeyForUserCategory = 'user-category-' + user_id;
            let redisKeyForUserMyCoupons = 'my-coupons-'+ user_id;
            queryArray.push(
                getPromiseForAnalysis(redisKeyForUserCategory, "{}"),
                getPromiseForUserCoupons(redisKeyForUserMyCoupons, "{}",user_id)
            )
        }
        const mcResult = await Promise.all(queryArray);
        if (mcResult && mcResult.length > 0) {
            let match_contest_data = mcResult && mcResult[0] ? mcResult[0] : []
            let userFavouriteContest = {};
            if (user_id) {
                userCoupons = mcResult && mcResult.length >= 2 && mcResult[2] && !_.isEmpty(mcResult[2]) ? JSON.parse(mcResult[2])  : {};
                userCategory = mcResult && mcResult.length >= 1 && mcResult[1] && !_.isEmpty(mcResult[1]) ? JSON.parse(mcResult[1])  : userCategory;
            }

            let redisKeyForFavouriteContest = 'favourite-contest-' + user_id;
            try {
                await redis.getRedisFavouriteContest(redisKeyForFavouriteContest, async (err, favData) => {
                    if (favData) {
                           userFavouriteContest = favData;
                        if(userFavouriteContest && userFavouriteContest._id && userFavouriteContest.contest_data && userFavouriteContest.contest_data.length){
                            for (const cData of userFavouriteContest.contest_data) {
                                cData.contest_id = ObjectId(cData.contest_id)
                            }
                        }
                    } else {
                        if (user_id) {
                            let userFavouriteConetsData = await FavouriteContest.findOne({ user_id: user_id, status: 1 });
                            if (userFavouriteConetsData && userFavouriteConetsData._id) {
    
                                redis.setRedisFavouriteContest(redisKeyForFavouriteContest, userFavouriteConetsData);
                                userFavouriteContest = userFavouriteConetsData;
                            } else {
                                userFavouriteContest = {};
                            }
                        }
                    }
                    redis.setRedis(RedisKeys.MATCH_CONTEST_LIST + req.params.match_id, match_contest_data);
                    let newMatchContestData = match_contest_data;
                    try{
                            //contest list according to user cat
                            newMatchContestData = _.reject(newMatchContestData, function(e) {
                            userCategory = _.has(userCategory, "is_super_user") && _.has(userCategory, "is_dimond_user") && _.has(userCategory, "is_beginner_user")?userCategory :{is_super_user : 0,is_dimond_user : 0,is_beginner_user :0};
                            return (ObjectId(e.category_id).equals(ObjectId(config.user_category.beginner_cat)) && userCategory && userCategory.is_beginner_user == 0 ) ||
                            (ObjectId(e.category_id).equals(ObjectId(config.user_category.super_cat)) && userCategory && userCategory.is_super_user == 0 ) ||
                            (ObjectId(e.category_id).equals(ObjectId(config.user_category.dimond_cat)) && userCategory && userCategory.is_dimond_user == 0 )
                        });
                    }catch(eerrrr){}
                    let resObj = {
                        match_contest: newMatchContestData,
                        user_rentation_bonous: {},
                        user_coupons: userCoupons || {},
                        user_favourite_contest: userFavouriteContest || {}
                    };
                    let redisKeyForUserAnalysis = 'app-analysis-' + user_id + '-' + match_id +  '-' + match_sport;
                    try {
                        redis.getRedisForUserAnaysis(redisKeyForUserAnalysis, async (err, data) => {
                            if (data) {
                                resObj['user_rentation_bonous'] = data;
                            } else {
                                let userAnalysisData = await UserAnalysis.findOne({ user_id: user_id, match_id: parseInt(match_id), sport: match_sport });
                                if (userAnalysisData && userAnalysisData._id) {
                                    userAnalysisData.offer_amount = userAnalysisData.offer_amount ? parseFloat(userAnalysisData.offer_amount) : 0;
                                    userAnalysisData.offer_percent = userAnalysisData.offer_percent ? parseFloat(userAnalysisData.offer_percent) : 0;
                                    redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, userAnalysisData);
                                    resObj['user_rentation_bonous'] = userAnalysisData;
                                } else {
                                    resObj['user_rentation_bonous'] = {};
                                }
                            }
                            var finalResult = ApiUtility.success(resObj);
                            return res.send(finalResult);
                        });
                    } catch (err) {
                        var finalResult = ApiUtility.success(resObj);
                        return res.send(finalResult);
                    }


                });
            } catch (errs) {
                console.log('contest list error in catch',errs);
                return res.send(ApiUtility.failed('Something went wrong!!'));
            }

        } else {
            return res.send(ApiUtility.failed('Something went wrong!!'));
        }

    } catch (error) {
        console.log('contest list error in catch',error);
        return res.send(ApiUtility.failed('Something went wrong!!'));
    }
}

async function getPromiseForAnalysis(key, defaultValue){
    return new Promise((resolve, reject) => {
        redis.userAnalysisRedisObj.get(key, (err, data) => {
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

async function getPromiseForUserCoupons(key, defaultValue,user_id){
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) { 
                reject(defaultValue);
            }
            if (data == null) {
                const cSaleData = await CouponSale.findOne({user_id:ObjectId(user_id),status: 1 });
                // console.log('cSaleData from list *****',cSaleData);
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

async function getContestListForOthergames(filter,is_all){
    is_all = false;
    console.log(filter);
    return new Promise((resolve, reject) => {
        try{
            var is_joined = false;
            OtherGamesContes.aggregate([
                {
                    $match: filter
                },   
                {
                    $group : {
                        _id : "$category_id",
                        category_name : {$first : "$category_name"},
                        sequence : {$first : "$category_seq"},
                        description : {$first : "$category_description"},
                        status : {$first : "$status"},
                        match_id : {$first : "$match_id"},
                        match_contest_id : {$first : "$_id"},
                        contests : {$push : "$$ROOT"}
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
                        category_image: "",
                        "contests": {
                            $map: {
                                "input": "$contests",
                                as: "sec",
                                in: {
                                    "contest_id": "$$sec.contest_id",
                                    "parent_contest_id":"$$sec.parent_contest_id",
                                    "entry_fee": "$$sec.contest.entry_fee",
                                    "prize_money": "$$sec.contest.winning_amount",
                                    "is_full": "$$sec.contest.is_full",
                                    "confirm_winning": {$cond: { if: { $eq: [ "$$sec.contest.confirmed_winning", "yes" ] }, then: "yes", else: 'no' }},
                                    "is_gadget": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "gadget" ] }, then: true, else: false }},
                                    "category_id": "$$sec.contest.category_id",
                                    "is_auto_create": "$$sec.contest.is_auto_create",                                       
                                    "multiple_team": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: true, else: false }},
                                    "invite_code": "$$sec.invite_code",
                                    "breakup_detail": { 
                                        $map: {
                                            "input": "$$sec.contest.breakup",
                                            as: "break",
                                            in: {
                                                "rank": {$cond: { if: { $eq: [ "$$break.startRank", "$$break.endRank" ] }, then: { $concat: [ "Rank ", {$toString: "$$break.startRank" } ] }, else:  "$$break.name" }},
                                                "gadget_name": {$cond: { if: { $ne: [ "$$break.gadget_name", "" ] }, then: "$$break.gadget_name", else: "" }},
                                                "image": "",
                                                "price": {$cond: { if: { $gt: [ "$$break.price_each", 0 ] }, then: {$trunc : ["$$break.price_each", 2]}, else: {$trunc : ["$$break.price", 2]} }},
                                            }
                                        }
                                    },
                                    "after_time_bonus":  "$$sec.after_time_bonus",
                                    "before_time_bonus": "$$sec.before_time_bonus",
                                    "current_date": new Date(),
                                    "usable_bonus_time":'$$sec.usable_bonus_time',
                                    "use_bonus": {$cond: { if: { $ifNull: [ "$$sec.usable_bonus_time", false ] }, then: { $cond: { if: { $gt: [new Date(),'$$sec.usable_bonus_time'] },then: {$toString: "$$sec.before_time_bonus"},else: {$toString: "$$sec.after_time_bonus"} } }, else: {$toString: "$$sec.contest.used_bonus"} }},
                                    "is_infinite": {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: true, else: false }},
                                    "teams_joined": "$$sec.joined_users",
                                    "total_teams": "$$sec.contest.contest_size",
                                    "total_winners": { $arrayElemAt: [ "$$sec.contest.breakup", -1 ] },
                                    "is_joined": is_joined, 
                                    "infinite_breakup" : {$cond: { if: { $eq: [ "$$sec.contest.infinite_contest_size", 1 ] }, then: {"winner_percent": "$$sec.contest.winner_percent", "winner_amount": "$$sec.contest.winning_amount_times"}, else: {} }},
                                    "is_aakash_team": {$cond: { if: { $eq: [ "$$sec.contest.amount_gadget", "aakash" ] }, then: true, else: false }},
                                    "is_favourite":false,
                                    "maximum_team_size": {$cond: { if: { $in: [ "$$sec.contest.multiple_team", ["yes",true] ] }, then: { $cond: { if: { $ifNull: ["$$sec.contest.maximum_team_size",false] },then: "$$sec.contest.maximum_team_size",else: 9 } }, else: 1 }},
                                    "contest_shareable": {$cond: { if: { $ifNull: [ "$$sec.contest.contest_shareable", false ] }, then: "$$sec.contest.contest_shareable", else: 0 }} 
                                }
                            }
                        },
                    }
                },
                {$sort : {sequence : 1}}
            ], (err, data) => {
                if (err) {
                    console.log("err",err);
                    reject(err);
                }
                if (!err) {
                    console.log("data",data);
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