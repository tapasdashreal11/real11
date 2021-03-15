const { ObjectId } = require('mongodb');
const LiveFantasyMatchList = require('../../../models/live-fantasy/lf-match-list-model');
const LiveFantasyMatchContest = require('../../../models/live-fantasy/lf-match-contest');
const CouponSale = require("../../../models/coupon-sale");
const User = require('../../../models/user');
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
                    resObj['user_coupons'] = !_.isEmpty(userCoupons) ? JSON.parse(userCoupons)  : {};
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
    },
    liveFantasyMatchContestWallet: async (req, res) => {
        try {
            let data = {};
            let data1 = {};
            let setting = config;
            let matchContestData = {}; 
            const { contest_id, entry_fee, match_id , series_id,sport } = req.body;
            let decoded = {
                user_id: req.userId,
                contest_id: contest_id || '',
                entry_fee: entry_fee,
                match_id: match_id,
                series_id:series_id
            }
            let match_sport = sport ? parseInt(sport) : 1;
            let match_series_id = series_id ? parseInt(series_id) : 1;
            let youtuber_code = 0;
            let is_offer_applied = false;
            let couponSaleData = [];
            // //////console.log(req.userId);
            let userdata = await User.findOne({ _id: decoded['user_id'] })
            if (userdata) {
                adminPer = 0; //(setting.admin_percentage) ? setting.admin_percentage : 0;
                let useableBonusPer = adminPer;
                let entryFee = 0;
                if (decoded['contest_id']) {
                    const cSaleData = await CouponSale.findOne({user_id:ObjectId(req.userId),status: 1,expiry_date:{$gte:new Date()} });
                    console.log("cSaleData***",cSaleData);
                     matchContestData = await LiveFantasyMatchContest.findOne({ 'contest_id': decoded['contest_id'],sport: match_sport, match_id: match_id });
                     if(matchContestData && !matchContestData._id){
                        return res.send(ApiUtility.failed("Something went wrong in params!!"));
                     }
                     entryFee = (matchContestData && matchContestData.entry_fee) ? matchContestData.entry_fee : 0;
                     if(cSaleData && cSaleData._id){
                        couponSaleData = cSaleData.coupon_contest_data; 
                     }
                    if (matchContestData && matchContestData.usable_bonus_time) {
                        //////console.log("matchInviteCode", matchContest, moment().isBefore(matchContest.usable_bonus_time))
                        if (moment().isBefore(matchContestData.usable_bonus_time)) {
                            useableBonusPer = matchContestData.before_time_bonus;
                        } else {
                            useableBonusPer = matchContestData.after_time_bonus;
                        }
                    } else {
                        useableBonusPer = (matchContestData && matchContestData.used_bonus) ? matchContestData.used_bonus : 0;
                    }

                    if (useableBonusPer == '') {
                        useableBonusPer = adminPer;
                    }
                    youtuber_code = matchContestData && matchContestData.youtuber_code ? matchContestData.youtuber_code: 0;
                    data['youtuber_code'] = youtuber_code;
                    data['contest_shareable'] = 0;
                } else {
                    entryFee = decoded['entry_fee'];
                }
                let useAmount = eval((useableBonusPer / 100) * entryFee);
                // ////////console.log(useAmount);
                let usableAmt = 0;
                let extraAmount = 0;
                let cashBalance = 0;
                let winningBalance = 0;
                let redisKeyForRentation = 'app-analysis-' + decoded['user_id'] + '-' + decoded['match_id'] + '-' + match_sport;
                let userOfferAmount = 0;
                let retention_bonus_amount =0;
                let calEntryFees = entryFee;
                try {
                    redis.getRedisForUserAnaysis(redisKeyForRentation, async (err, rdata) => {
                        //console.log('couponSaleData****',couponSaleData,"matchContestData.category_id",matchContestData.category_id);
                        let catid = matchContestData.category_id;
                        if(couponSaleData && couponSaleData.length>0){
                            couponSaleData = couponSaleData.map(item => {
                                let container = {};
                                container.category_id = ObjectId(item.category_id);
                                container.offer_data = item.offer_data;
                                return container;
                            });
                            let  constestIdsData  =  _.find(couponSaleData,{category_id:ObjectId(catid)});
                            if(constestIdsData && constestIdsData.category_id){
                               let offDataArray = constestIdsData.offer_data;
                               let offDataItem = _.find(offDataArray,{amount:entryFee});
                                  if(offDataItem){
                                   userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                   calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                   retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                  }
                                   
                             }
                           } 
                           if (rdata && entryFee>0 && userOfferAmount ==0) {
                            userOfferAmount = rdata.is_offer_type == 1 ? rdata.offer_amount:eval((rdata.offer_percent/100)*entryFee);
                            let pContestId = contest_id; //ObjectId(contest_id);
                            let offerContests = rdata.contest_ids || [];
                            let prContestId = matchContestData && matchContestData.parent_contest_id ? String(matchContestData.parent_contest_id):pContestId;
                            let cBonus =  rdata && rdata.contest_bonous?rdata.contest_bonous:[];  //config && config.contest_bonous ? config.contest_bonous:[];
                            let cBonusItem = {};
                            if(rdata.is_offer_type == 3){
                                cBonusItem =  cBonus.find(function(el){
                                    if(ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))){
                                        return el
                                    }
                                });
                            }
                            if((userOfferAmount > 0 && rdata.is_offer_type === 1) || (userOfferAmount > 0 && rdata.is_offer_type == 2 && offerContests.length > 0  && (_.includes(offerContests,pContestId) || _.includes(offerContests,prContestId)))){
                                calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                
                            } else if(rdata.is_offer_type == 3 && cBonusItem && cBonusItem.contest_id ){
                                userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                is_offer_applied = true;
                            }    
                        }
                        
                         
                        if (userdata) {
                            if (decoded['contest_id']) {
                                if(retention_bonus_amount > 0){
                                    usableAmt = 0;
                                } else {
                                    if (useAmount > userdata.bonus_amount) {
                                        usableAmt = userdata.bonus_amount;
                                    } else {
                                        usableAmt = useAmount;
                                    }
                                }
                                let extraBalance = userdata.extra_amount || 0;
                                let remainingFee = retention_bonus_amount > 0 ? calEntryFees : entryFee - usableAmt;
        
                                let indianDate = Date.now();
                                indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
                                if (extraBalance) {
                                    let perDayExtraAmt = 0;
                                    let perDayLimit = config.extra_bonus_perday_limit;
        
                                    if (String(userdata.extra_amount_date) == String(indianDate)) {
                                        perDayExtraAmt = userdata.perday_extra_amount;
                                    }
                                    if (perDayExtraAmt < perDayLimit) {
                                        extraAmount = (extraBalance > remainingFee) ? remainingFee : extraBalance;
                                        extraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - perDayExtraAmt) : extraAmount
                                    }
                                }
                            }
                            cashBalance = userdata.cash_balance;
                            winningBalance = userdata.winning_balance;
                           
                        }
                        data['cash_balance'] = (cashBalance) ? cashBalance : 0;
                        data['winning_balance'] = (winningBalance) ? winningBalance : 0;
                        data['usable_bonus'] = usableAmt ? parseFloat(usableAmt.toFixed(2)) : 0;
                        data['extra_amount'] = extraAmount ? parseFloat(extraAmount.toFixed(2)) : 0;
                        data['entry_fee'] = (entryFee) ? parseInt(entryFee) : 0;
                        data['user_offer_amount'] = (retention_bonus_amount) ? parseFloat(retention_bonus_amount.toFixed(2)) : 0;
                        data['calculated_entry_fee'] = (calEntryFees && _.isNumber(calEntryFees)) ? parseFloat(calEntryFees.toFixed(2)) : 0;
                        data['usable_bonus_percent'] = 0; //is_offer_applied;
                        data['is_offer_applied'] = is_offer_applied;
                        data1 = data;
                        res.send(ApiUtility.success(data1)); 
                    });
                } catch (err) {
                    consolelog('error in catch block in cache****',err);
                    return res.send(ApiUtility.failed("Something went wrong!!"));
                }
                
            } else {
                return res.send(ApiUtility.failed("User not found."));
            }
        } catch (error) {
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