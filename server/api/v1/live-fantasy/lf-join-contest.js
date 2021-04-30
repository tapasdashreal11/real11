const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const LFTransaction = require('../../../models/live-fantasy/lf_transaction');
const LFPlayerTeamContest = require('../../../models/live-fantasy/lf_joined_contest');
const LFMatchContest = require('../../../models/live-fantasy/lf-match-contest');
const LFMatchList = require('../../../models/live-fantasy/lf-match-list-model');
const LFMyContestModel = require('../../../models/live-fantasy/lf-my-contest-model');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const { startSession } = require('mongoose');
const UserAnalysis = require("../../../models/user-analysis");
const ContestInvite = require("../../../models/contest-invite");
const CouponSale = require("../../../models/coupon-sale");
const { ObjectID } = require('mongodb');


module.exports = async (req, res) => {
    try {
        let data1 = {};
        let startTime = Date.now();
        const user_id = req.userId;
        const {team_count, prediction_id,prediction_array,parent_match_id, contest_id, series_id, match_id, sport, rf_code, refer_by_user_id } = req.body;
        let refer_code = rf_code ? rf_code : '';
        let refer_by_user = refer_by_user_id ? refer_by_user_id : '';
        let match_sport = sport ? parseInt(sport) : 1;

        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id,
            user_id: user_id
        }
        if (match_id && series_id && contest_id && user_id && prediction_id && prediction_array && _.isArray(prediction_array)) {

            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1, "extra_amount_date": 1, "extra_amount_date": 1, "perday_extra_amount": 1, "referal_code_detail": 1, "email": 1, "is_beginner_user": 1, "is_super_user": 1, "is_dimond_user": 1,"team_name":1 }),
                LFMatchContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id,series_id: parseInt(series_id) }),
                LFMatchList.findOne({ 'match_id': decoded['match_id'],  series_id: parseInt(series_id)}),
            ];
            var results = await Promise.all(apiList);
            if(results && results.length>0){
               
                let authUser = results[0] ? results[0] : {};
                if (authUser) {
                    let liveMatch = results[2] ? results[2] : {};
                    if(prediction_array && prediction_array.length<6){
                        return res.send(ApiUtility.failed("Prediction data is not in format!!"));
                     }
                    if (liveMatch) {
                        let ctime = Date.now();
                        let mtime = liveMatch.time;
                        if (mtime < ctime || liveMatch.is_contest_stop ==1) {
                            return res.send(ApiUtility.failed('Match has been started.'));
                        } else {
                            let matchContest = results[1] ? results[1] : {};
                            let contestData = results[1] ? results[1] : '';
                            var parentContestId = (contestData && contestData.parent_contest_id) ? contestData.parent_contest_id : contestData.contest_id;
                            var PlayerTeamContestFilter = { 'contest_id': contest_id,'user_id': user_id, 'match_id': decoded['match_id'], 'series_id': decoded['series_id']}
                            let playerTeamRes = await LFPlayerTeamContest.findOne(PlayerTeamContestFilter);
                            if(playerTeamRes){
                                return res.send(ApiUtility.failed("Already Joined Contest."));
                             } else {
                                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;
                                
                                const session = await startSession()
                                session.startTransaction();
                                const sessionOpts = { session, new: true };

                                try {
                                    const doc = await LFMatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: 1 } }, sessionOpts);
                                    if (doc) {
                                        let joinedContestCount = doc.joined_users;
                                        if (matchContest && matchContest.contest_size < joinedContestCount && infinteStatus ) {
                                            // console.log("Join contest matchContest live fantasy response-----", matchContest.contest_size, joinedContestCount);
                                            
                                            let response = {};
                                            var MatchContestData = await LFMatchContest.findOne({ 'parent_contest_id': parentContestId,'match_id': decoded['match_id'], 'series_id': decoded['series_id'], is_full: 0 }).sort({ _id: -1 });
                                             // console.log('MatchContestData***',MatchContestData);
                                            if (MatchContestData) {
                                                await session.abortTransaction();
                                                session.endSession();
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.data = { contest_id: MatchContestData.contest_id };
                                                response.error_code = null;
                                                return res.json(response);
                                            } else {
                                                await session.abortTransaction();
                                               session.endSession();
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.error_code = null;
                                                return res.json(response);
                                            }


                
                                        } else {
                                            let new_predit_dic = {};
                                            for (item in prediction_array){
                                                new_predit_dic = {...new_predit_dic,...prediction_array[item]['value']}
                                            }
                                                let contest = {};
                                                let newContestId = new ObjectId();
                                                contest._id = newContestId;
                                                contest.prediction_id = prediction_id;
                                                contest.prediction = new_predit_dic;
                                                contest.match_id = match_id;
                                                contest.series_id = series_id;
                                                contest.contest_id = contest_id;
                                                contest.user_id = user_id;
                                                contest.team_name = authUser.team_name;
                                                contest.team_count = team_count ? parseInt(team_count):1;
                                                contest.total_amount = contestData.entry_fee;
                                                contest.parent_match_id = contestData && contestData.parent_match_id ? contestData.parent_match_id: parent_match_id;
                                                let useableBonusPer = contestData.used_bonus || 0;
                                                let contestType = contestData.contest_type;
                                                let entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                                                
                                                try {
                                                    let cashAmount = 0;
                                                    let winAmount = 0;
                                                    let bonusAmount = 0;
                                                    let extraAmount = 0;
                                                    let remainingFee = 0;
                                                    let userWalletStatus = false;

                                                    if (matchContest.usable_bonus_time) {
                                                        if (moment().isBefore(matchContest.usable_bonus_time)) {
                                                            useableBonusPer = matchContest.before_time_bonus;
                                                        } else {
                                                            useableBonusPer = matchContest.after_time_bonus;
                                                        }
                                                    } else {
                                                        useableBonusPer = contestData.used_bonus || 0;
                                                    }
                                                    let userOfferAmount = 0;
                                                    let calEntryFees = entryFee;
                                                    let retention_bonus_amount = 0;
                                                    let userBounousData = {};
                                                    let redisKeyForRentation = 'app-analysis-' + user_id + '-' + match_id + '-' + match_sport;
                                                    if (contestType == 'Paid') {
                                                        // work for user rentation and cal amount for data

                                                       // let fileds = {match_name:1,match_id:1,user_id:1,series_id:1,is_offer_type:1,contest_ids:1,sport:1,offer_amount:1,offer_percent:1,is_offer_repeat:1};
                                                       // let rdata = await UserAnalysis.findOne({ user_id: user_id, match_id: decoded['match_id'], sport: match_sport });
                                                        // let cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), status: 1, expiry_date: { $gte: new Date() } });
                                                        // let couponSaleData = [];

                                                        /* if (cSaleData && cSaleData._id && cSaleData.coupon_contest_data && cSaleData.coupon_contest_data.length > 0) {
                                                            let catid = matchContest.category_id;
                                                            couponSaleData = cSaleData.coupon_contest_data;
                                                            couponSaleData = couponSaleData.map(item => {
                                                                let container = {};
                                                                container.category_id = ObjectId(item.category_id);
                                                                container.offer_data = item.offer_data;
                                                                return container;
                                                            });
                                                            let constestIdsData = _.find(couponSaleData, { category_id: ObjectId(catid) });
                                                            if (constestIdsData && constestIdsData.category_id) {
                                                                let offDataArray = constestIdsData.offer_data;
                                                                let offDataItem = _.find(offDataArray, { amount: entryFee });
                                                                if (offDataItem) {
                                                                    userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                                                    calEntryFees = userOfferAmount > entryFee ? 0 : (entryFee - userOfferAmount);
                                                                    retention_bonus_amount = userOfferAmount > entryFee ? entryFee : userOfferAmount;
                                                                    let diff = cSaleData.coupon_credit && cSaleData.coupon_used ? cSaleData.coupon_credit - cSaleData.coupon_used : 0;
                                                                    let status_value = diff && diff == 1 ? 0 : 1;
                                                                    redis.redisObj.del('my-coupons-' + user_id) //force user to get data from db
                                                                    await CouponSale.update({ user_id: ObjectId(user_id) }, { $set: { status: status_value }, $inc: { coupon_used: +1 } }, sessionOpts);
                                                                }

                                                            }
                                                        }*/

                                                        


                                                        if (calEntryFees > 0) {
                                                            const paymentCal = await joinContestPaymentCalculation(useableBonusPer, authUser, calEntryFees, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount);
                                                            cashAmount = paymentCal.cashAmount;
                                                            winAmount = paymentCal.winAmount;
                                                            bonusAmount = paymentCal.bonusAmount;
                                                            extraAmount = paymentCal.extraAmount;
                                                            let saveData = paymentCal.saveData;
                                                            let perdayExtraAmount = paymentCal.perdayExtraAmount;

                                                            if (Object.keys(saveData).length > 0) {
                                                                let date = new Date();
                                                                let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + user_id;
                                                                userId = user_id;
                                                                let txnId = joinContestTxnId;
                                                                let status = TransactionTypes.JOIN_CONTEST;
                                                                let txnAmount = entryFee;
                                                                let withdrawId = 0;

                                                                if (calEntryFees == (winAmount + cashAmount + bonusAmount + extraAmount)) {
                                                                    // Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId, contest_id, match_id);
                                                                    
                                                                    let jcd = {
                                                                        deduct_bonus_amount : bonusAmount,
                                                                        deduct_winning_amount : winAmount,
                                                                        deduct_deposit_cash : cashAmount,
                                                                        deduct_extra_amount : extraAmount,
                                                                        total_amount : entryFee,
                                                                        admin_comission : await calculateAdminComission(contestData),
                                                                        retention_bonus : retention_bonus_amount,

                                                                      }
                                                                    contest.join_contest_detail = jcd; 

                                                                    let cons_cash_balance = bonusAmount;
                                                                    let cons_winning_balance = winAmount;
                                                                    let cons_bonus_amount = cashAmount;
                                                                    let refund_cash_balance = null;
                                                                    let refund_winning_balance = null;
                                                                    let refund_bonus_amount = null;
                                                                    let extra_amount_date = indianDate;
                                                                    let perday_extra_amount = saveData['perday_extra_amount'] ? saveData['perday_extra_amount'] : perdayExtraAmount;
                                                                    let winning_balance = authUser['winning_balance'] - winAmount;
                                                                    let cash_balance = authUser['cash_balance'] - cashAmount;
                                                                    let bonus_balance = authUser['bonus_amount'] - bonusAmount;
                                                                    let extra_amount = authUser['extra_amount'] - extraAmount;
                                                                    let total_balance = winning_balance + cash_balance + bonus_balance + extra_amount;

                                                                    try {
                                                                        let updateUserData = {
                                                                            cons_winning_balance: cons_winning_balance,
                                                                            cons_cash_balance: cons_cash_balance,
                                                                            cons_bonus_amount: cons_bonus_amount,
                                                                            refund_winning_balance: refund_winning_balance,
                                                                            refund_cash_balance: refund_cash_balance,
                                                                            refund_bonus_amount: refund_bonus_amount,
                                                                            total_balance: total_balance,
                                                                            extra_amount_date: extra_amount_date,
                                                                            perday_extra_amount: perday_extra_amount
                                                                        }

                                                                        let entity = {
                                                                            user_id: userId,
                                                                            contest_id: contest_id,
                                                                            match_id: match_id,
                                                                            sport: match_sport,
                                                                            txn_amount: txnAmount,
                                                                            details:{
                                                                                cons_winning_balance:winAmount,
                                                                                cons_cash_balance:cashAmount,
                                                                                cons_bonus_amount:bonusAmount,
                                                                                cons_extra_amount:extraAmount,
                                                                            },
                                                                            retantion_amount: retention_bonus_amount,
                                                                            currency: "INR",
                                                                            txn_date: Date.now(),
                                                                            local_txn_id: txnId,
                                                                            added_type: parseInt(status)
                                                                        };
                                                                        let userBalance = await User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1})
                                                                            if(userBalance){
                                                                                if(userBalance.extra_amount < extraAmount || userBalance.cash_balance < cashAmount || userBalance.winning_balance < winAmount || userBalance.bonus_amount < bonusAmount){
                                                                                    userWalletStatus = false;
                                                                                    await session.abortTransaction();
                                                                                    session.endSession();
                                                                                    return res.send(ApiUtility.failed("Please try again."));
                                                                                }
                                                                            }

                                                                        let walletRes = await User.updateOne({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } }, sessionOpts);

                                                                        if (walletRes && walletRes.nModified > 0) {
                                                                            await LFTransaction.create([entity], { session: session });
                                                                            userWalletStatus = true;
                                                                        } else {
                                                                            userWalletStatus = false;
                                                                            await session.abortTransaction();
                                                                            session.endSession();
                                                                            return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                                        }

                                                                    } catch (error) {

                                                                        await session.abortTransaction();
                                                                        session.endSession();
                                                                        let userWalletData = await User.findOne({ _id: user_id }, { "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1 });
                                                                        if (userWalletData) {
                                                                            userWalletData.winning_balance = (_.isNaN(userWalletData.winning_balance) || _.isNull(userWalletData.winning_balance)) ? 0 : userWalletData.winning_balance;
                                                                            userWalletData.cash_balance = (_.isNaN(userWalletData.cash_balance) || _.isNull(userWalletData.cash_balance)) ? 0 : userWalletData.cash_balance;
                                                                            userWalletData.bonus_amount = (_.isNaN(userWalletData.bonus_amount) || _.isNull(userWalletData.bonus_amount)) ? 0 : userWalletData.bonus_amount;
                                                                            userWalletData.extra_amount = (_.isNaN(userWalletData.extra_amount) || _.isNull(userWalletData.extra_amount)) ? 0 : userWalletData.extra_amount;
                                                                            await User.updateOne({ _id: user_id }, { $set: userWalletData });
                                                                        }
                                                                        return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                                    }
                                                                } else {
                                                                    await session.abortTransaction();
                                                                    session.endSession();
                                                                    return res.send(ApiUtility.failed('Insufficient Balance!!'));
                                                                }
                                                            } else {
                                                                await session.abortTransaction();
                                                                session.endSession();
                                                                return res.send(ApiUtility.failed('something went wrong!!'));

                                                            }
                                                        } else if (calEntryFees == 0 && retention_bonus_amount > 0) {

                                                            let date = new Date();
                                                            let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + user_id;
                                                            userId = user_id;
                                                            let txnId = joinContestTxnId;
                                                            let status = TransactionTypes.JOIN_CONTEST;
                                                            let txnAmount = entryFee;

                                                            let jcd = {
                                                                deduct_bonus_amount : bonusAmount,
                                                                deduct_winning_amount : winAmount,
                                                                deduct_deposit_cash : cashAmount,
                                                                deduct_extra_amount : extraAmount,
                                                                total_amount : entryFee,
                                                                admin_comission : await calculateAdminComission(contestData),
                                                                retention_bonus : retention_bonus_amount,

                                                              }
                                                            contest.join_contest_detail = jcd; 

                                                            let entity = {
                                                                user_id: userId,
                                                                contest_id: contest_id,
                                                                match_id: match_id,
                                                                sport: match_sport,
                                                                txn_amount: txnAmount,
                                                                details:{
                                                                    cons_winning_balance:winAmount,
                                                                    cons_cash_balance:cashAmount,
                                                                    cons_bonus_amount:bonusAmount,
                                                                    cons_extra_amount:extraAmount,
                                                                },
                                                                retantion_amount: retention_bonus_amount,
                                                                currency: "INR",
                                                                txn_date: Date.now(),
                                                                local_txn_id: txnId,
                                                                added_type: parseInt(status)
                                                            };

                                                            await LFTransaction.create([entity], { session: session });
                                                            userWalletStatus = true;
                                                        } else {
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                            return res.send(ApiUtility.failed('something went wrong!!'));

                                                        }

                                                    }
                                                    let totalEntryAmount = cashAmount + winAmount + bonusAmount + extraAmount;

                                                    if (contestType == "Free" || (contestType == "Paid" && totalEntryAmount > 0 && calEntryFees > 0 && totalEntryAmount == calEntryFees && userWalletStatus) || (calEntryFees == 0 && retention_bonus_amount > 0 && userWalletStatus)) {
                                                        try {
                                                            contest.bonus_amount = bonusAmount;
                                                            contest.sport = match_sport;
                                                            let getCountKey = 0;

                                                            let playerTeamContestId = newContestId;
                                                            if (_.isUndefined(contest.prediction_id) || _.isNull(contest.prediction_id) || _.isEmpty(contest.prediction_id)) {
                                                                await session.abortTransaction();
                                                                session.endSession();

                                                                return res.send(ApiUtility.failed("Player team id not found."));
                                                            } else {
                                                               
                                                                totalContestKey = await getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user);
                                                            }
                                                            
                                                            
                                                        } catch (error) {
                                                            await session.abortTransaction();
                                                            session.endSession();

                                                            return res.send(ApiUtility.failed(error.message));
                                                        }
                                                   

                                                        return res.send(ApiUtility.success(data1, 'Contest Joined successfully.'));

                                                        

                                                        
                                                    } else {
                                                        console.log("check balance error. ");
                                                        await session.abortTransaction();
                                                        session.endSession();
                                                        return res.send(ApiUtility.failed("Something went wrong!!"));
                                                    }
                                                } catch (error) {
                                                    await session.abortTransaction();
                                                    session.endSession();
                                                    console.log("join contest condition true > ", error);
                                                    return res.send(ApiUtility.failed(error.message));
                                                }
                                            
                                            
                                        }

                                    }

                                } catch (error){
                                    let response = {};
                                    await session.abortTransaction();
                                    session.endSession();
                                    response.status = false;
                                    response.message = "This contest is full, please join other contest.";
                                    response.error_code = null;
                                    return res.json(response);
                                } finally {
                                    // ending the session
                                    session.endSession();
                                }
                               
                             }

                        }
                    } else {
                        return res.send(ApiUtility.failed('Match has been started.!!!!'));
                    }

                } else {
                    return res.send(ApiUtility.failed("You are not authenticated user."));
                }
            }

        } else {
            return res.send(ApiUtility.failed('Something went wrong!!'));
        }

       
    } catch (error) {
        console.log(error);
        return res.send(ApiUtility.failed(error.message));
    }
}

/**
 * This is used to get count of contest joins and join contest
 * @param {*} contest 
 * @param {*} user_id 
 * @param {*} match_id 
 * @param {*} series_id 
 * @param {*} contest_id 
 * @param {*} contestData 
 * @param {*} parentContestId 
 * @param {*} session 
 */
async function getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user) {
    try {
        return new Promise(async (resolve, reject) => {
            await LFPlayerTeamContest.create([contest], { session: session }).then(async (newDataPTC) => {

                var newPTC = newDataPTC && newDataPTC.length > 0 ? newDataPTC[0] : {};
                      
                var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
                if (isAutoCreateStatus) {
                    
                    if (joinedContestCount == contestData.contest_size) {
                        
                        contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session);
                        await LFMatchContest.findOneAndUpdate({ 'match_id': parseInt(match_id), 'sport': match_sport, 'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } });
                    } else {
                        await session.commitTransaction();
                        session.endSession();
                    }
                } else {
                    await session.commitTransaction();
                    session.endSession();
                }
             
                var newMyModelobj = {
                    'match_id': match_id,
                    "series_id": series_id,
                    "user_id": user_id,
                    "sport": match_sport,
                    "player_team_contest_id": newPTC._id,
                    "match_status": 'Not Started',
                }
                let totalContestKey = 1
                LFMyContestModel.findOneAndUpdate({ match_id: match_id, sport: match_sport, user_id: user_id }, {$set:newMyModelobj ,$inc: { total_contest: 1 } }, { upsert: true, new: true }).then((MyContestModel) => {
                    totalContestKey = MyContestModel.total_contest || 0;
                });
                let redisKey = 'lf-user-contest-joinedContestIds-' + user_id + '-' + match_id + '-' + series_id;
                let userContestCountRedisKey = 'lf-user-contest-count-' + match_id + '-' + series_id + '-' + user_id;
                redis.getRedisForLf(redisKey, (err, data) => {
                    if (data) {
                        let userContests = data;
                        userContests.push(contest_id);
                        data = userContests;
                    } else {
                        data = [contest_id];
                    }
                    redis.setRedisForLf(redisKey,data);
                    const totalContest = data && _.isArray(data)?data.length:0;
                    if(totalContest!=0){
                        redis.setRedisForLf(userContestCountRedisKey,totalContest);
                    }
                    let userTeamcountRedisKey = 'lf-user-teams-count-' + match_id + '-' + series_id + '-' + user_id;
                    let matchContestKey = 'lf-my-matches-list-' + user_id;
                    redis.setRedisForLf(userTeamcountRedisKey,-1);
                    redis.setRedisLFBoard(matchContestKey, {}); // Set Redis  for my matches
                    return resolve(totalContestKey);
                });
                
                
            });
        })
    } catch (error) {
        // console.log("error getContestCount", error)   
    }
}

/**
 * This is uesd to contest autocreate 
 * @param {*} contestData 
 * @param {*} series_id 
 * @param {*} contest_id 
 * @param {*} match_id 
 * @param {*} parentContestId 
 */

async function contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session) {
    try {
         let newContestId = new ObjectId();
            let entityM = {};
            if (parentContestId) {
                entityM.parent_contest_id = parentContestId;
            } else {
                entityM.parent_contest_id = contestData._id;
            }
            entityM.match_id = match_id;
            entityM.parent_match_id = contestData.parent_match_id 
            entityM.contest_id = newContestId;
            entityM.series_id = series_id;
            entityM.category_id = ObjectId(contestData.category_id);
            entityM.category_name = contestData.category_name;
            entityM.category_description = contestData.category_description;
            entityM.category_seq = contestData.category_seq;
            entityM.match_status= contestData.match_status;
            entityM.before_time_bonus = contestData.before_time_bonus;
            entityM.after_time_bonus = contestData.after_time_bonus;
            entityM.usable_bonus_time = contestData.usable_bonus_time;
            entityM.invite_code = '1Q' + Math.random().toString(36).slice(-6);
            entityM.created = new Date();
            entityM.localteam = liveMatch.localteam || '';
            entityM.localteam_id = liveMatch.localteam_id || '';
            entityM.visitorteam = liveMatch.visitorteam || '';
            entityM.visitorteam_id = liveMatch.visitorteam_id || '';
            entityM.is_auto_create = 1;
            entityM.admin_create = 0;
            entityM.joined_users = 0;
            entityM.sport = match_sport;
            entityM.entry_fee = contestData.entry_fee;
            entityM.winning_amount = contestData.winning_amount;
            entityM.contest_size = contestData.contest_size;
            entityM.contest_type = contestData.contest_type;
            entityM.confirmed_winning = contestData.confirmed_winning;
            entityM.amount_gadget = contestData.amount_gadget;
            entityM.category_id = contestData.category_id;
            entityM.multiple_team = contestData.multiple_team;
            entityM.contest_size = contestData.contest_size;
            entityM.infinite_contest_size = contestData.infinite_contest_size;
            entityM.winning_amount_times = contestData.winning_amount_times;
            entityM.auto_create = contestData.auto_create;
            entityM.used_bonus = contestData.used_bonus;
            entityM.winner_percent = contestData.winner_percent;
            entityM.breakup = contestData.breakup;
            entityM.maximum_team_size = contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1)
            
            const dd = await LFMatchContest.create([entityM], { session: session });
            
            await session.commitTransaction();
            session.endSession();
            return entityM;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log('LF something went wrong in autocreate***************************wrong in auto error');
        return {}
    }
}
/**
 * This is used to payment calculation before join paid contest
 * @param {*} useableBonusPer 
 * @param {*} authUser 
 * @param {*} entryFee 
 * @param {*} winAmount 
 * @param {*} cashAmount 
 * @param {*} bonusAmount 
 * @param {*} extraAmount 
 */
async function joinContestPaymentCalculation(useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount) {
    let useAmount = (useableBonusPer / 100) * entryFee;
    let saveData = {};
    let remainingFee = 0;
    let indianDate = Date.now();
    indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));

    if (entryFee > 0 && authUser.bonus_amount && authUser.bonus_amount > 0 && retention_bonus_amount == 0) {
        if (useAmount <= authUser.bonus_amount) {
            remainingFee = retention_bonus_amount > 0 ? entryFee : entryFee - useAmount;
            saveData['bonus_amount'] = retention_bonus_amount > 0 ? 0 : authUser.bonus_amount - useAmount;
            bonusAmount = retention_bonus_amount > 0 ? 0 : useAmount;
        } else {
            remainingFee = retention_bonus_amount > 0 ? entryFee : entryFee - authUser.bonus_amount;
            saveData['bonus_amount'] = 0;
            bonusAmount = retention_bonus_amount > 0 ? 0 : authUser.bonus_amount;
        }
    } else {
        remainingFee = entryFee;
    }
    if (retention_bonus_amount > 0) bonusAmount = 0;

    let perdayExtraAmount = 0;
    if (remainingFee) {
        let extraBalance = authUser.extra_amount || 0;
       
        let extraBal = 0;
        if (extraBalance && extraBalance > 0) {
            let perDayExtraAmt = 0;
            let perDayLimit = config.extra_bonus_perday_limit;
            if (String(authUser.extra_amount_date) == String(indianDate)) {
                perDayExtraAmt = authUser.perday_extra_amount;
            }
            
            let saveData = {};
            if (perDayExtraAmt < perDayLimit) {
                extraAmount = (extraBalance > remainingFee) ? remainingFee : extraBalance;
                extraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - perDayExtraAmt) : extraAmount;
                extraBal = (extraBalance > remainingFee) ? extraBalance - extraAmount : 0;

                remainingFee = (extraBalance < remainingFee && extraAmount < remainingFee) ? (extraAmount < remainingFee ? remainingFee - extraAmount : remainingFee - extraBalance) : remainingFee - extraAmount;

                saveData['extra_amount'] = extraBal;
                saveData['extra_amount_date'] = indianDate;
                perdayExtraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - extraAmount) : (perDayExtraAmt + extraAmount);
                saveData['perday_extra_amount'] = perdayExtraAmount;
            } else {
                perdayExtraAmount = perDayExtraAmt;
                saveData['perday_extra_amount'] = perdayExtraAmount;
            }
        } else {
            // remainingFee = entryFee;
            saveData['extra_amount'] = extraBal;
        }
        saveData['perday_extra_amount'] = perdayExtraAmount;
        saveData['extra_amount'] = extraBal;
    }
    
    if (remainingFee) {
        let cashBalance = authUser.cash_balance;

        if (cashBalance) {
            let cashBal = (cashBalance > remainingFee) ? cashBalance - remainingFee : 0;
            cashAmount = (cashBalance > remainingFee) ? remainingFee : cashBalance;
            remainingFee = (cashBalance < remainingFee) ? remainingFee - cashBalance : 0;
            saveData['cash_balance'] = cashBal;
        }
    }

    if (remainingFee) {
        winningBal = authUser.winning_balance;
        if (winningBal) {
            winningBal1 = (winningBal > remainingFee) ? winningBal - remainingFee : 0;
            winAmount = (winningBal > remainingFee) ? remainingFee : winningBal;
            remainingFee = (winningBal < remainingFee) ? remainingFee - winningBal : 0;
            saveData['winning_balance'] = winningBal1;
        }
    }
    return { 'winAmount': winAmount, 'cashAmount': cashAmount, 'bonusAmount': bonusAmount, 'extraAmount': extraAmount, 'saveData': saveData, 'perdayExtraAmount': perdayExtraAmount };

}

function getMatchRedisData(skip, decoded, filter, sort, sport, cb) {
    try {
        var datsse = moment().subtract('10', 'days').toDate();
        asyncp.parallel({
            upcoming_match: function (callback) {
                filter = {
                    "user_id": decoded.user_id,
                };
                getMyContestList(skip, decoded.pagesize, filter, 'upcoming', sort, sport, callback);
            },
            live_match: function (callback) {
                filter = {
                    "$and": [
                        { "user_id": decoded.user_id },
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

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        var data = await (new ModelService(MyContestModel)).myContestModel(skip, pagesize, sort, filter, sport, type);
        callback(null, data)
    } catch (error) {
        //console.log("error",error)
    }
}
async function calculateAdminComission(contestData){
  let adminComission = contestData.admin_comission || 0;
  let winningAmount = contestData.winning_amount || 0;
  let contestSize = contestData.contest_size || 0;
  let comission = 0;
  if(adminComission && adminComission > 0) {
    const profitAmount = Math.ceil((winningAmount * adminComission) / 100);
    comission = (profitAmount / contestSize);
    comission = Math.round(comission,2);
    return comission;
  } else {
    comission = 0;
    return comission;
  }
}

async function getRedisForJoindContestIds(key, defaultValue,contest_id){
    return new Promise((resolve, reject) => {
        redis.getRedisForLf(key, (err, data) => {
            if (err) { 
                reject(defaultValue);
            }
            if (data) {
                let userContests = data;
                userContests.push(contest_id);
                data = userContests;
            } else {
                data = [contest_id];
            }
            redis.setRedisForLf(key,data)
            resolve(data)
        });
    })
}