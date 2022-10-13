const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/other-games-transaction');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const LFMyContestModel = require('../../../models/live-fantasy/lf-my-contest-model');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const ludoMqtt = require('../../../../lib/other-games-mqtt');
const { startSession } = require('mongoose');
const btoa = require('btoa');
const redis = require('../../../../lib/redis');
var imageurl = config.imageBaseUrl;
const LudoOffer = require("../../../models/ludo_offer");

module.exports = async (req, res) => {
    try {
        let data1 = {};
        const user_id = req.userId;
        const { contest_id, match_id, sport, rf_code, refer_by_user_id, game_code } = req.body;
        let refer_code = rf_code ? rf_code : '';
        let refer_by_user = refer_by_user_id ? refer_by_user_id : '';
        let match_sport = sport ? parseInt(sport) : 3;
        let decoded = { match_id: parseInt(match_id), contest_id: contest_id, user_id: user_id }
        if (match_id && contest_id && user_id && game_code) {
            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                User.findById(user_id).select({ "_id": 1, "fair_play_violation": 1, "avatar": 1, "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1, "extra_amount_date": 1, "extra_amount_date": 1, "perday_extra_amount": 1, "referal_code_detail": 1, "email": 1, "is_beginner_user": 1, "is_super_user": 1, "is_dimond_user": 1, "team_name": 1 }),
                OtherGamesContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id }),
                OtherGames.findOne({ 'match_id': decoded['match_id'], status: 1 }),
            ];
            var results = await Promise.all(apiList);
            if (results && results.length > 0) {
                let authUser = results[0] ? results[0] : {};
                if (authUser) {
                    let liveMatch = results && results.length == 3 && results[2] ? results[2] : {};
                    if (authUser.fair_play_violation && authUser.fair_play_violation == 1) {
                        return res.send(ApiUtility.failed("You can't join contest.You are under fair play violation!!"));
                    }
                    if (liveMatch && liveMatch.match_id) {

                        let matchContest = results[1] ? results[1] : {};
                        let contestData = matchContest && matchContest.contest ? matchContest.contest : {};
                        var parentContestId = (matchContest && matchContest.parent_contest_id) ? matchContest.parent_contest_id : matchContest.contest_id;
                        var PlayerTeamContestFilter = { 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], is_deleted: 0 }
                        let playerTeamRes = await OtherGamesPtc.findOne(PlayerTeamContestFilter);

                        if (playerTeamRes) {
                            return res.send(ApiUtility.failed("Already Joined Contest."));
                        } else {
                            let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;

                            const session = await startSession()
                            session.startTransaction();
                            const sessionOpts = { session, new: true };

                            try {
                                const doc = await OtherGamesContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: 1 } }, sessionOpts);
                                if (doc) {
                                    let joinedContestCount = doc.joined_users;
                                    if (contestData && contestData.contest_size < joinedContestCount && infinteStatus) {
                                        // console.log("Join contest matchContest live fantasy response-----", matchContest.contest_size, joinedContestCount);

                                        let response = {};
                                        var MatchContestData = await OtherGamesContest.findOne({ 'parent_contest_id': parentContestId, 'match_id': decoded['match_id'], is_full: 0 }).sort({ _id: -1 });
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


                                        let contest = {};
                                        let newContestId = new ObjectId();
                                        contest._id = newContestId;
                                        contest.match_id = match_id;

                                        contest.contest_id = contest_id;
                                        contest.user_id = user_id;
                                        contest.team_name = authUser.team_name;
                                        contest.total_amount = contestData.entry_fee;
                                        contest.game_code = game_code;

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
                                                //************Ludo offer calculation ***************/
                                                const ludoOffer = await LudoOffer.findOne({user_id:user_id,status: 1,'match_id': decoded['match_id'],expiry_date:{$gte:new Date()}  });
                                                let pContestId = contest_id;
                                                let prContestId = matchContest && matchContest.parent_contest_id ? String(matchContest.parent_contest_id):matchContest.contest_id;
                                                if(ludoOffer && ludoOffer._id){
                                                    let cBonus =  ludoOffer && ludoOffer.contest_bonous?ludoOffer.contest_bonous:[]; 
                                                    let cBonusItem =  cBonus.find(function(el){
                                                        if(ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))){
                                                            return el
                                                          }
                                                        });
                                                     if(cBonusItem && cBonusItem.contest_id ){
                                                        userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                                        calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                                        retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                                      }   
                                                    
                                                }
                                                //**************************************** */
                                                let contestSizeCal = (contestData && contestData.contest_size) ? (contestData.contest_size) : (contestData.infinite_contest_size ? 2 : 2);
                                                if (calEntryFees > 0) {
                                                    const paymentCal = await joinContestPaymentCalculation(contestSizeCal, useableBonusPer, authUser, calEntryFees, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount);
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
                                                                deduct_bonus_amount: bonusAmount,
                                                                deduct_winning_amount: winAmount,
                                                                deduct_deposit_cash: cashAmount,
                                                                deduct_extra_amount: extraAmount,
                                                                total_amount: entryFee,
                                                                admin_comission: await calculateAdminComission(contestData),
                                                                retention_bonus: retention_bonus_amount,

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
                                                                    details: {
                                                                        cons_winning_balance: winAmount,
                                                                        cons_cash_balance: cashAmount,
                                                                        cons_bonus_amount: bonusAmount,
                                                                        cons_extra_amount: extraAmount,
                                                                    },
                                                                    retantion_amount: retention_bonus_amount,
                                                                    currency: "INR",
                                                                    txn_date: Date.now(),
                                                                    local_txn_id: txnId,
                                                                    added_type: parseInt(status)
                                                                };
                                                                let userBalance = await User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1 })
                                                                if (userBalance) {
                                                                    if (userBalance.extra_amount < extraAmount || userBalance.cash_balance < cashAmount || userBalance.winning_balance < winAmount || userBalance.bonus_amount < bonusAmount) {
                                                                        userWalletStatus = false;
                                                                        await session.abortTransaction();
                                                                        session.endSession();
                                                                        return res.send(ApiUtility.failed("Please try again."));
                                                                    }
                                                                }
                                                                userWalletStatus = true;
                                                                /**  let walletRes = await User.updateOne({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } }, sessionOpts);

                                                                 if (walletRes && walletRes.nModified > 0) {
                                                                     await Transaction.create([entity], { session: session });
                                                                     userWalletStatus = true;
                                                                 } else {
                                                                     userWalletStatus = false;
                                                                     await session.abortTransaction();
                                                                     session.endSession();
                                                                     return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                                 }*/

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
                                                        deduct_bonus_amount: bonusAmount,
                                                        deduct_winning_amount: winAmount,
                                                        deduct_deposit_cash: cashAmount,
                                                        deduct_extra_amount: extraAmount,
                                                        total_amount: entryFee,
                                                        admin_comission: await calculateAdminComission(contestData),
                                                        retention_bonus: retention_bonus_amount,
                                                    }
                                                    contest.join_contest_detail = jcd;

                                                    let entity = {
                                                        user_id: userId,
                                                        contest_id: contest_id,
                                                        match_id: match_id,
                                                        sport: match_sport,
                                                        txn_amount: txnAmount,
                                                        details: {
                                                            cons_winning_balance: winAmount,
                                                            cons_cash_balance: cashAmount,
                                                            cons_bonus_amount: bonusAmount,
                                                            cons_extra_amount: extraAmount,
                                                        },
                                                        retantion_amount: retention_bonus_amount,
                                                        currency: "INR",
                                                        txn_date: Date.now(),
                                                        local_txn_id: txnId,
                                                        added_type: parseInt(status)
                                                    };

                                                    // await Transaction.create([entity], { session: session });
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
                                                    totalContestKey = await getContestCount(matchContest, contest, user_id, match_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user);


                                                    const roomDetails = {
                                                        roomId: contest_id,
                                                        user: {
                                                            name: authUser.team_name,
                                                            photo: _.isEqual(authUser.avatar, "boy.png") ? imageurl + "/avatar20.png" : imageurl + "/" + authUser.avatar + ".png",
                                                            sub: authUser._id
                                                        },
                                                        maxPlayers: contestData.contest_size,
                                                        minPlayers: contestData.contest_size,
                                                        maxWait: 60,
                                                        rounds: 1,
                                                        cta: "BRIDGE.postMessage",
                                                        text: "go_home"
                                                    }

                                                    let encodeData = encodeURIComponent(btoa(JSON.stringify(roomDetails)));
                                                    data1.room_id = contest_id;
                                                    // data1.game_url ="https://www.gamezop.com/g/SkhljT2fdgb?id=3472&roomDetails="+encodeData; // For Prod
                                                    // data1.game_url ="https://www.gamezop.com/g/SkhljT2fdgb?id=3472&gamingEnv=staging&roomDetails="+encodeData; // For test
                                                    if (decoded['match_id'] && liveMatch.match_id && liveMatch.game_code && liveMatch.game_sub_url) {
                                                        data1.game_url = "https://www.gamezop.com/g/" + liveMatch.game_code + "?" + liveMatch.game_sub_url + "&roomDetails=" + encodeData;
                                                        console.log("Game URL >>>>>>>>>>>>>>>>", data1.game_url,">>>>>>>>>>>>>>>");
                                                        redis.setRedis("match-contest-other-view-" + authUser._id, {});
                                                        let contestLudoJoin = joinedContestCount >= contestData.contest_size ? 0 : joinedContestCount;
                                                        ludoMqtt.publishOtherGameJoinedUserCounts(liveMatch.match_id,contest_id,JSON.stringify({joined_count:contestLudoJoin}));
                                                        return res.send(ApiUtility.success(data1, 'Contest Joined successfully.'));
                                                    } else {
                                                        return res.send(ApiUtility.failed("Something went wrong!!"));
                                                    }


                                                    /*if(decoded['match_id'] == 111){
                                                         data1.game_url ="https://www.gamezop.com/g/SkhljT2fdgb?id=3472&gamingEnv=staging&roomDetails="+encodeData; // For test
                                                     } else if(decoded['match_id'] == 112){
                                                         data1.game_url ="https://www.gamezop.com/g/rkPlk2T7qAr?id=3472&gamingEnv=staging&roomDetails="+encodeData; // For test
                                                     } else if(decoded['match_id'] == 113){
                                                         data1.game_url ="https://www.gamezop.com/g/H1PJn6mqAr?id=3472&gamingEnv=staging&roomDetails="+encodeData; // For test
                                                     }*/


                                                } catch (error) {
                                                    await session.abortTransaction();
                                                    session.endSession();
                                                    return res.send(ApiUtility.failed(error.message));
                                                }


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

                                } else {
                                    let response = {};
                                    await session.abortTransaction();
                                    session.endSession();
                                    response.status = false;
                                    response.message = "Something Went wrong!!.";
                                    response.error_code = null;
                                    return res.json(response);
                                }

                            } catch (error) {
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


                    } else {
                        return res.send(ApiUtility.failed('This Game is now in-active.Please try after sometime.'));
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
 * @param {*} contest_id 
 * @param {*} contestData 
 * @param {*} parentContestId 
 * @param {*} session 
 */
async function getContestCount(matchContest, contest, user_id, match_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user) {
    try {
        return new Promise(async (resolve, reject) => {

            var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
            if (isAutoCreateStatus) {

                if (joinedContestCount == contestData.contest_size) {

                    contestAutoCreateAferJoin(contestData, contest_id, match_id, parentContestId, match_sport, session, matchContest);
                    await OtherGamesContest.findOneAndUpdate({ 'match_id': parseInt(match_id), 'sport': match_sport, 'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } });
                } else {
                    await session.commitTransaction();
                    session.endSession();
                }
            } else {
                await session.commitTransaction();
                session.endSession();
                if (joinedContestCount == contestData.contest_size) {
                    await OtherGamesContest.findOneAndUpdate({ 'contest_id': contest_id }, { $set: { "is_full": 1 } });
                }
            }
            return resolve(1);
        })
    } catch (error) {
        console.log("error getContestCount", error)
    }
}

/**
 * This is uesd to contest autocreate 
 * @param {*} contestData  
 * @param {*} contest_id 
 * @param {*} match_id 
 * @param {*} parentContestId 
 */

async function contestAutoCreateAferJoin(contestData, contest_id, match_id, parentContestId, match_sport, session, matchContest) {
    try {
        let newContestId = new ObjectId();
        let entityM = {};
        let catID = contestData.category_id;
        if (parentContestId) {
            entityM.parent_contest_id = parentContestId;
        } else {
            entityM.parent_contest_id = matchContest.contest_id;
        }
        entityM.match_id = match_id;
        entityM.contest_id = newContestId;
        entityM.category_id = ObjectId(catID);
        entityM.invite_code = '1Q' + Math.random().toString(36).slice(-6);
        entityM.created = new Date();

        entityM.is_auto_create = 1;
        entityM.admin_create = 0;
        entityM.joined_users = 0;
        entityM.sport = match_sport;

        entityM.category_name = matchContest && matchContest.category_name ? matchContest.category_name : '';
        entityM.category_description = matchContest && matchContest.category_description ? matchContest.category_description : "";
        entityM.category_seq = matchContest && matchContest.category_seq ? matchContest.category_seq : 0;
        entityM.contest = {
            entry_fee: contestData.entry_fee,
            winning_amount: contestData.winning_amount,
            contest_size: contestData.contest_size,
            contest_type: contestData.contest_type,
            confirmed_winning: contestData.confirmed_winning,
            amount_gadget: contestData.amount_gadget,
            category_id: contestData.category_id,
            multiple_team: contestData.multiple_team,
            contest_size: contestData.contest_size,
            infinite_contest_size: contestData.infinite_contest_size,
            winning_amount_times: contestData.winning_amount_times,
            is_auto_create: contestData.is_auto_create,
            auto_create: contestData.auto_create,
            used_bonus: contestData.used_bonus,
            winner_percent: contestData.winner_percent,
            breakup: contestData.breakup,
            admin_comission: contestData && contestData.admin_comission ? contestData.admin_comission : 0,
            maximum_team_size: contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1)
        };

        const dd = await OtherGamesContest.insertMany([entityM], { session: session });

        await session.commitTransaction();
        session.endSession();
        return entityM;
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        // console.log('LF something went wrong in autocreate***************************wrong in auto error');
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
async function joinContestPaymentCalculation(contest_size, useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount) {
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
        if (extraBalance && extraBalance > 0 && contest_size > 25) {
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

async function calculateAdminComission(contestData) {
    let adminComission = contestData.admin_comission || 0;
    let winningAmount = contestData.winning_amount || 0;
    let contestSize = contestData.contest_size || 0;
    let comission = 0;
    if (adminComission && adminComission > 0) {
        const profitAmount = Math.ceil((winningAmount * adminComission) / 100);
        comission = (profitAmount / contestSize);
        comission = Math.round(comission, 2);
        return comission;
    } else {
        comission = 0;
        return comission;
    }
}
