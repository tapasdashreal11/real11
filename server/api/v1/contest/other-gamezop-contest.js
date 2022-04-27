const OtherGamesContes = require('../../../models/other_games_contest');
const UserOtherInfo = require('../../../models/user-other-info');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const { RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const config = require('./../../../config');

module.exports = async (req, res) => {
 
try {
        const { match_id, sport } = req.params;
        const user_id = req.userId;
        let match_sport = sport ? parseInt(sport) : 3;
        let filter = {"match_id": parseInt(match_id),"sport": match_sport,is_full: 0};
        let queryArray = [await getContestListForOthergames(filter,false)];
        let userLudoPlayedKey = "user_ludo_played_" + user_id;
        console.log("from contest list************************************");
        const mcResult = await Promise.all(queryArray);
        if (mcResult && mcResult.length > 0) {
            let match_contest_data = mcResult && mcResult[0] ? mcResult[0] : []
            try {
                    redis.setRedis("match-contest-other-" + req.params.match_id, match_contest_data);
                    redis.setRedis("match-contest-other-view-" + user_id, {status:true});
                    let playedData = await getPromiseForUserPlayed(userLudoPlayedKey,user_id,"{status:true}");
                    let playedDataItem = playedData ?  JSON.parse(playedData) :{};
                    let newMatchContestData = match_contest_data;
                    let resObj = {
                        match_contest: newMatchContestData,
                        user_rentation_bonous: {},
                        user_coupons: {},
                        user_favourite_contest: {},
                        user_ludo_played: playedDataItem && playedDataItem.status ? playedDataItem.status : false
                    };
                var finalResult = ApiUtility.success(resObj);
                return res.send(finalResult);

            } catch (errs) {
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


/**
 * This is used to get all contest for other games
 * @param {*} filter 
 * @param {*} is_all 
 */
async function getContestListForOthergames(filter,is_all){
    is_all = false;
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

async function getPromiseForUserPlayed(key, user_id,defaultValue){
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) { 
                reject(defaultValue);
            }
            if (data == null) {
                const userOtherInfo = await UserOtherInfo.findOne({user_id:user_id});
                if(userOtherInfo && userOtherInfo._id){
                    data = JSON.stringify({status:true});
                    redis.setRedis(key, {status:true});
                } else {
                    data = defaultValue;
                    redis.setRedis(key, {status:false});
                }
            }
            resolve(data)
        })
    })
}