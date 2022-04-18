const config = require('../../../config');
const User = require('../../../models/user');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const MyContestModel = require('../../../models/my-contest-model');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/transaction');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const db = require('../../../db');
const { startSession } = require('mongoose');
const UserAnalysis = require("../../../models/user-analysis");
const ContestInvite = require("../../../models/contest-invite");
const CouponSale = require("../../../models/coupon-sale");
const JoinContestDetail = require('../../../models/join-contest-detail');
const { appsFlyerEntryService } = require("../users/appsflyer-api");
const Helper = require('./../common/helper');

module.exports = async (req, res) => {
    try {
        let data1 = {};
        const user_id = req.userId;
        const { team_data, contest_id, series_id, match_id, sport, rf_code, refer_by_user_id } = req.body;
        let refer_code = rf_code ? rf_code : '';
        let refer_by_user = refer_by_user_id ? refer_by_user_id : '';
        let match_sport = sport ? parseInt(sport) : 1;
        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id,
            user_id: user_id
        }
        var totalContestKey = 0;
        var mycontId = 0;
        if (match_id && series_id && contest_id && user_id && team_data && _.isArray(team_data) && team_data.length > 0) {

            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                User.findById(user_id).select({ "affiliate_amount": 1, "win_dis_status": 1, "xtra_cash_block": 1, "fair_play_violation": 1, "avatar": 1, "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1, "extra_amount_date": 1, "extra_amount_date": 1, "perday_extra_amount": 1, "referal_code_detail": 1, "email": 1, "is_beginner_user": 1, "is_super_user": 1, "is_dimond_user": 1, "is_looser_user": 1, "team_name": 1, "appsflayer_id": 1, "clevertap_id": 1 }),
                SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }),
                PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }).countDocuments(),
                redis.getRedis('contest-detail-' + contest_id),
                MatchContest.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id })
            ];

            var results = await Promise.all(apiList);
            if (results && results.length > 0) {
                let authUser = results[0] ? results[0] : {};
                if (authUser) {
                    let liveMatch = results[1] ? results[1] : {};
                    if (authUser.fair_play_violation && authUser.fair_play_violation == 1) {
                        return res.send(ApiUtility.failed("You can't join contest.You are under fair play violation!!"));
                    }
                    if (liveMatch) {
                        let ctime = Date.now();
                        let mtime = liveMatch.time;
                        if (mtime < ctime) {
                            return res.send(ApiUtility.failed('Match has been started.'));
                        } else {
                            if (team_data && team_data != null) {
                                let matchContest = results[4] ? results[4] : {};
                                if (!matchContest) {

                                    return res.send(ApiUtility.failed('Match Contest Not Found'));
                                }
                                if (matchContest && matchContest.category_slug && (_.isEqual(matchContest.category_slug, 'head-to-head') || _.isEqual(matchContest.category_slug, 'last-man-standing')) && match_sport == 1) {
                                    return res.send(ApiUtility.failed('Something went wrong.Please join again from contest list!!'));
                                }
                                let contestData = results[3] ? results[3] : '';
                                if (!contestData) {
                                    contestData = await Contest.findOne({ _id: ObjectId(contest_id) });
                                    if (!contestData) {
                                        return res.send(ApiUtility.failed('Contest Not Found'));
                                    } else {
                                        redis.setRedis('contest-detail-' + contest_id, contestData);
                                    }
                                }
                                let joinedContest = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': series_id, 'contest_id': contest_id }).countDocuments();

                                var parentContestId = (contestData && contestData.parent_id) ? contestData.parent_id : contestData._id;
                                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;

                                if (contestData && contestData.contest_size == parseInt(joinedContest) && infinteStatus) {

                                    let response = {};
                                    var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, sport: match_sport, is_full: 0 }).sort({ _id: -1 });
                                    await MatchContest.updateOne({ _id: ObjectId(matchContest._id) }, { $set: { "is_full": 1 } });

                                    if (MatchContestData) {
                                        response.status = false;
                                        response.message = "This contest is full, please join other contest.";
                                        response.data = { contest_id: MatchContestData.contest_id };
                                        response.error_code = null;
                                        return res.json(response);
                                    } else {
                                        response.status = false;
                                        response.message = "This contest is full, please join other contest.";
                                        response.error_code = null;
                                        return res.json(response);
                                    }

                                }
                                let tIds = _.map(team_data, 'team_id');
                                var PlayerTeamContestFilter = { 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'player_team_id': { $in: tIds } }
                                let playerTeamRes = await PlayerTeamContest.find(PlayerTeamContestFilter, { _id: 1 });
                                let joinedContestWithTeamCounts = results[2] ? results[2] : 0;
                                let maxTeamSize = contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : 9;

                                if (joinedContestWithTeamCounts < maxTeamSize) {

                                    if (playerTeamRes && playerTeamRes.length == 0) {
                                        if ((!contestData.multiple_team && joinedContestWithTeamCounts >= 1) || ((contestData.multiple_team !== 'yes') && joinedContestWithTeamCounts >= 1)) {
                                            return res.send(ApiUtility.failed('Multiple Teams Not Allowed'));
                                        }

                                        let teamArray = [];
                                        if (team_data && team_data.length > 0) {
                                            teamArray = await removeDuplicateEntry(team_data);
                                        }
                                        try {

                                            let contestDataArray = [];
                                            let newContestId;
                                            for (const team_data_item of teamArray) {
                                                let contest = {};
                                                let genratedcontestId = new ObjectId();
                                                newContestId = genratedcontestId;
                                                contest._id = genratedcontestId;
                                                contest.player_team_id = team_data_item.team_id;
                                                contest.match_id = match_id;
                                                contest.series_id = series_id;
                                                contest.contest_id = contest_id;
                                                contest.user_id = user_id;
                                                contest.total_amount = contestData.entry_fee;
                                                if (contestData && contestData.category_id) contest.category_id = contestData.category_id;
                                                contest.team_count = team_data_item.team_count;
                                                contest.avatar = authUser && authUser.avatar ? authUser.avatar : '';
                                                contest.team_name = authUser && authUser.team_name ? authUser.team_name : '';
                                                contest.sport = match_sport;
                                                contestDataArray.push(contest);
                                            }

                                            let totalTeamJoinedCount = contestDataArray.length;
                                            let total_team_number = totalTeamJoinedCount;
                                            let mcontestIncKey = 'mci_' + match_id + '_' + match_sport + '_' + contest_id;
                                            // payment calcuation
                                            let useableBonusPer = contestData.used_bonus || 0;
                                            let contestType = contestData.contest_type;
                                            let entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                                            let isOfferused = false;

                                            let cashAmount = 0;
                                            let winAmount = 0;
                                            let bonusAmount = 0;
                                            let extraAmount = 0;
                                            let remainingFee = 0;
                                            let userWalletStatus = false;
                                            let updateUserData = {};
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
                                            let calEntryFees = entryFee * (contestDataArray.length);
                                            let totalEntryForContest = entryFee * (contestDataArray.length);
                                            let retention_bonus_amount = 0;
                                            let userBounousData = {};
                                            let offerableAppled = false;
                                            let transactionList = [];
                                            let redisKeyForRentation = 'app-analysis-' + user_id + '-' + match_id + '-' + match_sport;
                                            if (contestType == 'Paid') {
                                                let rdata = await UserAnalysis.findOne({ user_id: user_id, match_id: decoded['match_id'], sport: match_sport });
                                                let cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), status: 1, expiry_date: { $gte: new Date() } });
                                                let couponSaleData = [];
                                                let totalCouponsToBeUsed = 1;
                                                if (cSaleData && cSaleData._id && cSaleData.coupon_contest_data && cSaleData.coupon_contest_data.length > 0) {
                                                    let catid = matchContest.category_id;
                                                    // couponSaleData = cSaleData.coupon_contest_data;
                                                    couponSaleData = cSaleData.coupon_contest_data ? cSaleData.coupon_contest_data : [];
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
                                                        if (offDataItem && offDataItem.credit > 0) {
                                                            totalCouponsToBeUsed = offDataItem.credit > total_team_number ? total_team_number : offDataItem.credit;
                                                            userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                                            userOfferAmount = userOfferAmount * totalCouponsToBeUsed;
                                                            calEntryFees = userOfferAmount > totalEntryForContest ? 0 : (totalEntryForContest - userOfferAmount);
                                                            retention_bonus_amount = userOfferAmount > totalEntryForContest ? totalEntryForContest : userOfferAmount;
                                                            if (cSaleData.is_repeat == 2) {
                                                                couponSaleData = couponSaleData.map(item => {
                                                                    let container = {};
                                                                    let cate_id = ObjectId(item.category_id);
                                                                    let offerDataArry = item.offer_data;
                                                                    if (cate_id && cate_id.equals(ObjectId(catid))) {
                                                                        let objIndex = offerDataArry.findIndex((obj => obj.amount == entryFee));
                                                                        if (offDataItem.credit == totalCouponsToBeUsed) {
                                                                            offerDataArry[objIndex].offer = 0;
                                                                            offerDataArry[objIndex].amount = 0;
                                                                            offerDataArry[objIndex].credit = 0;
                                                                        } else {
                                                                            offerDataArry[objIndex].credit = offDataItem.credit - totalCouponsToBeUsed;
                                                                        }
                                                                    }
                                                                    container.category_id = cate_id;
                                                                    container.offer_data = offerDataArry;
                                                                    return container;
                                                                });
                                                                cSaleData.coupon_contest_data = couponSaleData;
                                                                await CouponSale.updateOne({ _id: ObjectId(cSaleData._id) }, { $set: { 'coupon_contest_data': couponSaleData } });
                                                                redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(cSaleData));
                                                            }

                                                        }

                                                    }
                                                }

                                                if (rdata && rdata._id && entryFee > 0 && userOfferAmount == 0) {
                                                    userBounousData = rdata;
                                                    userOfferAmount = rdata.is_offer_type == 1 ? rdata.offer_amount : eval((rdata.offer_percent / 100) * entryFee);
                                                    let pContestId = ObjectId(contest_id);
                                                    let offerContests = rdata && rdata.contest_ids && (rdata.contest_ids).length > 0 ? rdata.contest_ids.map(itm => {
                                                        return ObjectId(itm)
                                                    }) : [];
                                                    let prContestId = matchContest && matchContest.parent_contest_id ? ObjectId(matchContest.parent_contest_id) : pContestId;

                                                    let cBonus = rdata && rdata.contest_bonous ? rdata.contest_bonous : [];
                                                    let cBonusItem = {};
                                                    if (rdata.is_offer_type == 3) {
                                                        cBonusItem = cBonus.find(function (el) {
                                                            if (ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))) {
                                                                return el
                                                            }
                                                        });
                                                    }

                                                    if ((userOfferAmount > 0 && rdata.is_offer_type === 1) || (userOfferAmount > 0 && offerContests.length > 0 && rdata.is_offer_type == 2 && (_.find(offerContests, pContestId) || _.find(offerContests, prContestId)))) {

                                                        userOfferAmount = userOfferAmount.toFixed(2);
                                                        calEntryFees = userOfferAmount > totalEntryForContest ? 0 : (totalEntryForContest - userOfferAmount);
                                                        retention_bonus_amount = userOfferAmount > totalEntryForContest ? totalEntryForContest : userOfferAmount;
                                                        isOfferused = true;
                                                    } else if (rdata.is_offer_type == 3 && cBonusItem && cBonusItem.contest_id) {
                                                        userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                                        // userOfferAmount = userOfferAmount * totalTeamJoinedCount;
                                                        userOfferAmount = userOfferAmount;
                                                        calEntryFees = userOfferAmount > totalEntryForContest ? 0 : (totalEntryForContest - userOfferAmount);
                                                        retention_bonus_amount = userOfferAmount > totalEntryForContest ? totalEntryForContest : userOfferAmount;
                                                        isOfferused = true;
                                                    }

                                                }

                                                if (matchContest && matchContest.is_offerable) {
                                                    let totalJoinedTeam = joinedContestWithTeamCounts;
                                                    let calJoinTeam = total_team_number + totalJoinedTeam;
                                                    if (matchContest.offer_after_join >= totalJoinedTeam && calJoinTeam > matchContest.offer_after_join && matchContest.offerable_amount > 0) {
                                                        if (calEntryFees > 0) {
                                                            offerableAppled = false;
                                                            let recalcalEntryFees = calEntryFees;
                                                            calEntryFees = matchContest.offerable_amount >= calEntryFees ? 0 : (calEntryFees - matchContest.offerable_amount);
                                                            let offerdAmount = matchContest.offerable_amount >= recalcalEntryFees ? recalcalEntryFees : matchContest.offerable_amount;
                                                            let totalOfferdAmount = retention_bonus_amount + offerdAmount;
                                                            retention_bonus_amount = totalOfferdAmount;
                                                        }
                                                    }
                                                }

                                                if (calEntryFees > 0) {
                                                    let contestSizeCal = (contestData && contestData.contest_size) ? (contestData.contest_size) : (contestData.infinite_contest_size ? 100 : 2);
                                                    const paymentCal = await joinContestPaymentCalculation(contestSizeCal, offerableAppled, useableBonusPer, authUser, calEntryFees, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount);
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
                                                        let txnAmount = totalEntryForContest;
                                                        let withdrawId = 0;

                                                        if (calEntryFees == (winAmount + cashAmount + bonusAmount + extraAmount)) {

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
                                                                updateUserData = {
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
                                                                    retantion_amount: retention_bonus_amount,
                                                                    currency: "INR",
                                                                    txn_date: Date.now(),
                                                                    local_txn_id: txnId,
                                                                    contest_entry_fee: entryFee,
                                                                    total_team_joined: totalTeamJoinedCount,
                                                                    added_type: parseInt(status),
                                                                    details: {
                                                                        "refund_winning_balance": (winAmount ? winAmount : 0),
                                                                        "refund_cash_balance": (cashAmount ? cashAmount : 0),
                                                                        "refund_bonus_amount": (bonusAmount ? bonusAmount : 0),
                                                                        "refund_extra_amount": (extraAmount ? extraAmount : 0),
                                                                        "refund_affiliate_amount": 0,
                                                                        "current_winning_balance": winning_balance ? winning_balance : 0,
                                                                        "current_cash_balance": cash_balance ? cash_balance : 0,
                                                                        "current_bonus_amount": bonus_balance ? bonus_balance : 0,
                                                                        "current_extra_amount": extra_amount ? extra_amount : 0,
                                                                        "current_affiliate_amount": authUser && authUser.affiliate_amount ? authUser.affiliate_amount : 0,
                                                                    }

                                                                };
                                                                userWalletStatus = true;
                                                                transactionList.push(entity);
                                                            } catch (error) {
                                                                userWalletStatus = false;
                                                                return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                            }
                                                        } else {
                                                            userWalletStatus = false;
                                                            return res.send(ApiUtility.failed('Insufficient Balance!!'));
                                                        }
                                                    } else {
                                                        userWalletStatus = false;
                                                        return res.send(ApiUtility.failed('something went wrong!!'));

                                                    }
                                                } else if (calEntryFees == 0 && retention_bonus_amount > 0) {

                                                    let date = new Date();
                                                    let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + user_id;
                                                    userId = user_id;
                                                    let txnId = joinContestTxnId;
                                                    let status = TransactionTypes.JOIN_CONTEST;
                                                    let txnAmount = totalEntryForContest;

                                                    let entity = {
                                                        user_id: userId,
                                                        contest_id: contest_id,
                                                        match_id: match_id,
                                                        sport: match_sport,
                                                        txn_amount: txnAmount,
                                                        retantion_amount: retention_bonus_amount,
                                                        currency: "INR",
                                                        txn_date: Date.now(),
                                                        local_txn_id: txnId,
                                                        contest_entry_fee: entryFee,
                                                        total_team_joined: totalTeamJoinedCount,
                                                        added_type: parseInt(status),
                                                        details: {
                                                            "refund_winning_balance": 0,
                                                            "refund_cash_balance": 0,
                                                            "refund_bonus_amount": 0,
                                                            "refund_extra_amount": 0,
                                                            "refund_affiliate_amount": 0,
                                                            "current_winning_balance": authUser && authUser.winning_balance ? authUser.winning_balance : 0,
                                                            "current_cash_balance": authUser && authUser.cash_balance ? authUser.cash_balance : 0,
                                                            "current_bonus_amount": authUser && authUser.bonus_amount ? authUser.bonus_amount : 0,
                                                            "current_extra_amount": authUser && authUser.extra_amount ? authUser.extra_amount : 0,
                                                            "current_affiliate_amount": authUser && authUser.affiliate_amount ? authUser.affiliate_amount : 0,
                                                        }
                                                    };
                                                    userWalletStatus = true;
                                                    transactionList.push(entity);
                                                } else {
                                                    userWalletStatus = false;
                                                    return res.send(ApiUtility.failed('something went wrong!!'));
                                                }
                                            }
                                            let totalEntryAmount = cashAmount + winAmount + bonusAmount + extraAmount;

                                            redis.redisObj.get(mcontestIncKey, async (erri, dataInc) => {
                                                let mIcount = (dataInc) ? parseInt(dataInc) : 0;
                                                let totalBeforJoin = mIcount + totalTeamJoinedCount;
                                                if (mIcount >= contestData.contest_size && infinteStatus) {
                                                    return res.send(ApiUtility.failed("Contest is full!!."));
                                                } else if (totalBeforJoin > contestData.contest_size && infinteStatus) {
                                                    let diffSlot = contestData.contest_size - mIcount;
                                                    let mszSlot = diffSlot == 1 ? "Please try with one team !!" : "Only " + diffSlot + " teams are reaming.Please try again!!"
                                                    return res.send(ApiUtility.failed(mszSlot));
                                                } else {
                                                    console.log("test*****************", mIcount);
                                                    let mcRedisIncData = await redis.redisObj.incrby(mcontestIncKey, totalTeamJoinedCount);
                                                    joinedContest = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': series_id, 'contest_id': contest_id }).countDocuments();
                                                    if ((mcRedisIncData < contestData.contest_size) || (contestData && contestData.contest_size == 0 && contestData.infinite_contest_size == 1)) {
                                                        let joinStatus = false;
                                                        joinStatus = joinedContest && (joinedContest < contestData.contest_size || contestData.infinite_contest_size == 1) ? true : (joinedContest == 0 ? true : false);
                                                        if (joinStatus) {
                                                            if (contestType == "Free" || (contestType == "Paid" && totalEntryAmount > 0 && calEntryFees > 0 && totalEntryAmount == calEntryFees && userWalletStatus) || (calEntryFees == 0 && retention_bonus_amount > 0 && userWalletStatus)) {
                                                                let tCount = contestDataArray.length;
                                                                for (const team_data_item of contestDataArray) {
                                                                    team_data_item.bonus_amount = (bonusAmount / tCount) || 0;
                                                                }

                                                                let getCountKey = 0;

                                                                let playerTeamContestId = newContestId;
                                                                var filteredCDArray = contestDataArray.filter(function (el) {
                                                                    return el.player_team_id != null && el.player_team_id != '';
                                                                });
                                                                var contestDataFinal = _.reject(contestDataArray, ['player_team_id', null]);
                                                                var contestDataFinalOne = _.reject(contestDataArray, ['player_team_id', '']);
                                                                var ptIdArray = _.map(contestDataArray, 'player_team_id');
                                                                if (_.isUndefined(contestDataArray) || _.isNull(contestDataArray) || _.isEmpty(contestDataArray)) {
                                                                    return res.send(ApiUtility.failed("Player team id not found."));
                                                                } else {

                                                                    if (filteredCDArray.length == contestDataArray.length && ptIdArray.length == contestDataArray.length && contestDataFinal.length == contestDataArray.length && contestDataFinalOne.length == contestDataArray.length) {
                                                                        const session = await startSession()
                                                                        session.startTransaction();
                                                                        const sessionOpts = { session, new: true };
                                                                        try {
                                                                            if ((contestType == "Paid" && totalEntryAmount == calEntryFees && transactionList.length > 0) || (calEntryFees == 0 && userOfferAmount > 0 && contestType == "Paid" && transactionList.length > 0)) {
                                                                                const doc = await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: totalTeamJoinedCount } }, { new: true });
                                                                                let joinedContestCount = doc.joined_users;
                                                                                // transaction methods
                                                                                if (totalEntryAmount == calEntryFees) {
                                                                                    await User.updateOne({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } }, sessionOpts);
                                                                                }
                                                                                await Transaction.insertMany(transactionList, { session: session });
                                                                                await multipleJoinContestDetail(session, contestDataArray, decoded, bonusAmount, winAmount, cashAmount, newContestId, contestData, extraAmount, match_sport, retention_bonus_amount);
                                                                                totalContestKey = await getContestCount(contestDataFinal, user_id, match_id, series_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user, matchContest);

                                                                                if ((contestType == "Paid" && totalEntryAmount == calEntryFees) || (calEntryFees == 0 && userOfferAmount > 0 && contestType == "Paid")) {
                                                                                    if (retention_bonus_amount > 0 && userBounousData && userBounousData._id && isOfferused) {
                                                                                        if (userBounousData.is_offer_type == 1) {
                                                                                            await UserAnalysis.updateOne({ _id: ObjectId(userBounousData._id) }, { $inc: { "offer_amount": -retention_bonus_amount } });
                                                                                            userBounousData.offer_amount = ((userBounousData.offer_amount) - retention_bonus_amount);
                                                                                            redis.setRedisForUserAnaysis(redisKeyForRentation, userBounousData);
                                                                                        } else if (userBounousData.is_offer_type == 2 && userBounousData.is_offer_repeat && userBounousData.is_offer_repeat == 2) {
                                                                                            let percent = userBounousData.offer_percent ? parseFloat(userBounousData.offer_percent) : 0;
                                                                                            await UserAnalysis.updateOne({ _id: ObjectId(userBounousData._id) }, { $inc: { "offer_percent": -percent } });
                                                                                            userBounousData.offer_percent = 0;
                                                                                            redis.setRedisForUserAnaysis(redisKeyForRentation, userBounousData);
                                                                                        }
                                                                                        else if (userBounousData.is_offer_type == 3 && userBounousData.is_offer_repeat && userBounousData.is_offer_repeat == 2) {
                                                                                            let pContestId = ObjectId(contest_id);
                                                                                            let prContestId = matchContest && matchContest.parent_contest_id ? ObjectId(matchContest.parent_contest_id) : pContestId;
                                                                                            let cBonus = userBounousData && userBounousData.contest_bonous ? userBounousData.contest_bonous : [];
                                                                                            let c_bonous = [];
                                                                                            cBonus.find(function (e2) {
                                                                                                if (ObjectId(e2.contest_id).equals(ObjectId(prContestId)) || ObjectId(e2.contest_id).equals(ObjectId(pContestId))) {
                                                                                                } else { c_bonous.push(e2); }
                                                                                            });
                                                                                            userBounousData.contest_bonous = c_bonous;
                                                                                            await UserAnalysis.updateOne({ _id: ObjectId(userBounousData._id) }, { $set: { "contest_bonous": c_bonous } });
                                                                                            redis.setRedisForUserAnaysis(redisKeyForRentation, userBounousData);
                                                                                        }
                                                                                    }

                                                                                }
                                                                                let myJoinedContestListKey = "joined-contest-list-" + match_id + "-" + series_id + "-" + user_id;
                                                                                redis.setRedisMyMatches(myJoinedContestListKey, {});

                                                                                /**
                                                                                 * Worked to user type category and manage beginnerwow cat for first user on app to join paid contest
                                                                                 */

                                                                                try {
                                                                                    if (contestData && contestData.entry_fee && contestData.entry_fee > 0) {
                                                                                        if (authUser && authUser.is_beginner_user && authUser.is_beginner_user == 1) {
                                                                                            await User.findOneAndUpdate({ '_id': ObjectId(user_id) }, { $set: { is_beginner_user: 0 } });
                                                                                        }
                                                                                        let redisKeyForUserCategory = 'user-category-' + user_id;
                                                                                        let userCatObj = {
                                                                                            is_super_user: authUser && authUser.is_super_user ? authUser.is_super_user : 0,
                                                                                            is_dimond_user: authUser && authUser.is_dimond_user ? authUser.is_dimond_user : 0,
                                                                                            is_looser_user: authUser && authUser.is_looser_user ? authUser.is_looser_user : 0,
                                                                                            is_beginner_user: 0
                                                                                        };
                                                                                        redis.setRedisForUserCategory(redisKeyForUserCategory, userCatObj);
                                                                                    }
                                                                                } catch (errusercat) { }

                                                                                // TODO: Save Contest
                                                                                let playerContest = {};
                                                                                playerContest.id = newContestId;
                                                                                if (playerContest.id) {
                                                                                    if (contestData) {
                                                                                        let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`;
                                                                                        redis.getRedis(joinedTeamsCountKey, (err, data) => {
                                                                                            if (data) {
                                                                                                let userContests = data;
                                                                                                if (userContests[contest_id]) {
                                                                                                    userContests[contest_id] = joinedContest + 1;
                                                                                                } else {
                                                                                                    userContests[contest_id] = joinedContest + 1;
                                                                                                }
                                                                                                data = userContests;
                                                                                            } else {
                                                                                                data = {}
                                                                                                data[contest_id] = joinedContest + 1;
                                                                                            }
                                                                                            mqtt.publishContestTeamCounts(match_id, JSON.stringify(data));
                                                                                            redis.setRedis(joinedTeamsCountKey, data);
                                                                                        });

                                                                                        let joinedContestCountData = {};
                                                                                        joinedContestCountData[contest_id] = joinedContest + 1;
                                                                                        mqtt.publishContestTeamCounts(match_id, JSON.stringify(joinedContestCountData));

                                                                                        redis.redisObj.get('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, (err, data) => {
                                                                                            let count = (data) ? parseInt(data) : 1;
                                                                                            // mqtt.publishUserJoinedTeamCounts(match_id,user_id,JSON.stringify({team_count:count}))
                                                                                            redis.redisObj.del('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id) //force user to get data from db
                                                                                        });

                                                                                        let joinedContestKey = `${RedisKeys.CONTEST_JOINED_LIST}${series_id}-${match_id}-${user_id}`;
                                                                                        redis.redisObj.del(joinedContestKey); //force user to get data from db

                                                                                        try {
                                                                                            let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id + "_" + match_sport;
                                                                                            var datsse = moment().subtract('30', 'days').toDate();
                                                                                            let sortm = { createdAt: -1 }
                                                                                            let serverTimeu = moment(Date.now()).format(config.DateFormat.datetime);
                                                                                            await redis.getRedisMyMatches(matchContestUserKey, function (err, contestData) { // Get Redis
                                                                                                if (!contestData) {
                                                                                                    getMatchRedisData(0, { "user_id": user_id, "pagesize": 25 }, {}, sortm, match_sport, function (results) {
                                                                                                        results['server_time'] = serverTimeu;
                                                                                                        // console.log("Join contest data in redis when data is empty****");
                                                                                                        redis.setRedisMyMatches(matchContestUserKey, results);
                                                                                                    })
                                                                                                } else {
                                                                                                    SeriesSquad.findOne({ 'match_id': parseInt(match_id), 'sport': match_sport, 'series_id': parseInt(series_id) }).then(async function (data) {
                                                                                                        let conIndex = _.findIndex(contestData.upcoming_match, { "match_id": decoded['match_id'] });
                                                                                                        if (conIndex < 0) {
                                                                                                            const mData = await MyContestModel.findOne({ match_id: parseInt(match_id), sport: match_sport, user_id: user_id }, { _id: 1 });
                                                                                                            if (mData && mData._id) {
                                                                                                                //console.log("after join this is seires squad data*****");
                                                                                                                mycontId = mData._id
                                                                                                                var newLiveArray = {
                                                                                                                    "_id": mycontId,
                                                                                                                    "match_id": parseInt(match_id),
                                                                                                                    "series_id": parseInt(series_id),
                                                                                                                    "match_status": "Not Started",
                                                                                                                    "local_team_id": parseInt(data.localteam_id),
                                                                                                                    "local_team_name": data.localteam_short_name || data.localteam,
                                                                                                                    // "local_team_flag": config.imageBaseUrl + data.local_flag || "",
                                                                                                                    "visitor_team_id": parseInt(data.visitorteam_id),
                                                                                                                    "visitor_team_name": data.visitorteam_short_name || data.visitorteam,
                                                                                                                    // "visitor_team_flag": config.imageBaseUrl + data.local_flag || "",
                                                                                                                    "local_team_flag": data.local_flag ? config.imageBaseUrl + '/' + data.local_flag : "",
                                                                                                                    "visitor_team_flag": data.visitor_flag ? config.imageBaseUrl + '/' + data.visitor_flag : "",
                                                                                                                    "series_name": data.series_name,
                                                                                                                    "star_date": moment(data.time).format("YYYY-MM-DD"),
                                                                                                                    "star_time": moment(data.time).format("HH:mm"),
                                                                                                                    "server_time": serverTimeu,
                                                                                                                    "sort_time": data.time,
                                                                                                                    "match_filter": _.has(data, "is_parent") ? (data.is_parent ? "FULL" : (data.live_fantasy_parent_id ? "LIVE" : "FULL")) : (data.live_fantasy_parent_id ? "LIVE" : "FULL")
                                                                                                                    // "total_contest": totalContestKey
                                                                                                                };
                                                                                                                if (data && data.inning_number && data.is_parent) {
                                                                                                                    newLiveArray['inning_number'] = data.inning_number;
                                                                                                                }

                                                                                                                if (totalContestKey > 0) {
                                                                                                                    newLiveArray['total_contest'] = totalContestKey;
                                                                                                                }
                                                                                                                if (contestData && contestData.upcoming_match) {
                                                                                                                    contestData.upcoming_match.push(newLiveArray);
                                                                                                                }


                                                                                                                var newContDataSort = _.sortBy(contestData.upcoming_match, ['sort_time', 'desc']);

                                                                                                                contestData.upcoming_match = newContDataSort;
                                                                                                                contestData['server_time'] = serverTimeu;

                                                                                                                redis.setRedisMyMatches(matchContestUserKey, contestData);
                                                                                                            } else {
                                                                                                                //console.log("My Match contest id not found for after join *****",match_id);
                                                                                                                redis.redisnMyMatchesObj.del(matchContestUserKey);
                                                                                                            }


                                                                                                        } else {
                                                                                                            if (totalContestKey > 0) {
                                                                                                                contestData.upcoming_match[conIndex]['total_contest'] = totalContestKey;
                                                                                                            }

                                                                                                            var newContDataSort = _.sortBy(contestData.upcoming_match, ['sort_time', 'desc']);
                                                                                                            contestData.upcoming_match = newContDataSort;
                                                                                                            contestData['server_time'] = serverTimeu;
                                                                                                            redis.setRedisMyMatches(matchContestUserKey, contestData);
                                                                                                        }
                                                                                                    });
                                                                                                }
                                                                                            });
                                                                                        } catch (error) {
                                                                                            console.log("updateing redis > join contest  > ", error);
                                                                                            return res.send(ApiUtility.failed(error.message));
                                                                                        }
                                                                                        // call for send data to appsflyer
                                                                                        await setJoinContestDataToAppsflyer(authUser,match_id,sport,contest_id,team_data);
                                                                                        return res.send(ApiUtility.success(data1, 'Contest Joined successfully.'));
                                                                                    }
                                                                                } else {
                                                                                    return res.send(ApiUtility.failed("Something went wrong!!"));
                                                                                }

                                                                            } else if (contestType == "Free") {
                                                                                const doc = await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: totalTeamJoinedCount } }, { new: true });
                                                                                let joinedContestCount = doc.joined_users;
                                                                                totalContestKey = await getContestCount(contestDataFinal, user_id, match_id, series_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user, matchContest);
                                                                                let myJoinedContestListKey = "joined-contest-list-" + match_id + "-" + series_id + "-" + user_id;
                                                                                redis.setRedisMyMatches(myJoinedContestListKey, {});
                                                                                let playerContest = {};
                                                                                playerContest.id = newContestId;
                                                                                if (playerContest.id) {
                                                                                    let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`;
                                                                                    redis.getRedis(joinedTeamsCountKey, (err, data) => {
                                                                                        if (data) {
                                                                                            let userContests = data;
                                                                                            if (userContests[contest_id]) {
                                                                                                userContests[contest_id] = joinedContest + 1;
                                                                                            } else {
                                                                                                userContests[contest_id] = joinedContest + 1;
                                                                                            }
                                                                                            data = userContests;
                                                                                        } else {
                                                                                            data = {}
                                                                                            data[contest_id] = joinedContest + 1;
                                                                                        }
                                                                                        mqtt.publishContestTeamCounts(match_id, JSON.stringify(data));
                                                                                        redis.setRedis(joinedTeamsCountKey, data);
                                                                                    });

                                                                                    let joinedContestCountData = {};
                                                                                    joinedContestCountData[contest_id] = joinedContest + 1;
                                                                                    mqtt.publishContestTeamCounts(match_id, JSON.stringify(joinedContestCountData));

                                                                                    redis.redisObj.get('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, (err, data) => {
                                                                                        let count = (data) ? parseInt(data) : 1;
                                                                                        // mqtt.publishUserJoinedTeamCounts(match_id,user_id,JSON.stringify({team_count:count}))
                                                                                        redis.redisObj.del('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id) //force user to get data from db
                                                                                    });

                                                                                    let joinedContestKey = `${RedisKeys.CONTEST_JOINED_LIST}${series_id}-${match_id}-${user_id}`;
                                                                                    redis.redisObj.del(joinedContestKey); //force user to get data from db

                                                                                    let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id + "_" + match_sport;
                                                                                    redis.setRedisMyMatches(matchContestUserKey, results);
                                                                                }
                                                                                return res.send(ApiUtility.success(data1, 'Contest Joined successfully.'));
                                                                            } else {
                                                                                await session.abortTransaction();
                                                                                session.endSession();
                                                                                await redis.redisObj.decrby(mcontestIncKey, totalTeamJoinedCount);
                                                                                return res.send(ApiUtility.failed("Somehing went wrong1."));
                                                                            }
                                                                        } catch (error) {
                                                                            console.log("error", error)
                                                                            await session.abortTransaction();
                                                                            session.endSession();
                                                                            await redis.redisObj.decrby(mcontestIncKey, totalTeamJoinedCount);
                                                                            setTranscation(decoded, match_sport, contest_id, totalTeamJoinedCount)
                                                                            return res.send(ApiUtility.failed("Somehing went wrong2."));
                                                                        } finally {
                                                                            // ending the session
                                                                            session.endSession();
                                                                        }
                                                                    } else {
                                                                        console.log("Team data not match before join");
                                                                        return res.send(ApiUtility.failed("Somehing went wrong3."));
                                                                    }
                                                                }
                                                            } else {
                                                                return res.send(ApiUtility.failed("You can't join this contest!!"));
                                                            }
                                                        } else {
                                                            return res.send(ApiUtility.failed("You can't join this contest!!"));
                                                        }
                                                    } else {
                                                        return res.send(ApiUtility.failed("You can't join this contest.Contest is full!!."));
                                                    }

                                                }
                                            });

                                        } catch (errorr) {
                                            let response = {};
                                            let tLength = teamArray && teamArray.length > 0 ? teamArray.length : 1;
                                            console.log("error in catch***", errorr);
                                            var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, 'sport': match_sport, is_full: { $ne: 1 } }).sort({ _id: -1 });
                                            if (MatchContestData) {
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.data = { contest_id: MatchContestData.contest_id };
                                                response.error_code = null;
                                                return res.json(response);
                                            } else {
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.error_code = null;
                                                return res.json(response);
                                            }
                                        }
                                    } else {
                                        return res.send(ApiUtility.failed("Already Joined Contest."));
                                    }
                                } else {
                                    return res.send(ApiUtility.failed("You can not add more than " + maxTeamSize + " teams."));
                                }
                            } else {
                                return res.send(ApiUtility.failed('You have no team to join this contest.'));
                            }
                        }
                    } else {
                        return res.send(ApiUtility.failed('You can not join contest, match already started'));
                    }


                } else {
                    return res.send(ApiUtility.failed("You are not authenticated user."));
                }
            } else {
                return res.send(ApiUtility.failed("Something went wrong!!."));
            }
        } else {
            console.log("Something went wrong!!.Prams not in proper format", req.body);
            return res.send(ApiUtility.failed("Something went wrong!!.Prams not in proper format"));
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
async function getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId, session, match_sport, liveMatch, joinedContestCount, refer_code, refer_by_user, matchContest) {
    try {
        return new Promise(async (resolve, reject) => {
            await PlayerTeamContest.insertMany(contest, { session: session }).then(async (newDataPTC) => {
                var newPTC = newDataPTC && newDataPTC.length > 0 ? newDataPTC[0] : {};
                var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
                if (isAutoCreateStatus) {
                    if (joinedContestCount == contestData.contest_size) {
                        console.log(contestData.contest_size, "************** auto create counter");
                        contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session, matchContest);
                        await MatchContest.findOneAndUpdate({ 'match_id': parseInt(match_id), 'sport': match_sport, 'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } });
                    } else {
                        await session.commitTransaction();
                        session.endSession();
                    }
                } else {
                    await session.commitTransaction();
                    session.endSession();
                }
                // This is used for user referal for contest upto ten friends and get bopnous
                try {
                    if (contestData && contestData.entry_fee > 0 && refer_code && !_.isEmpty(refer_code) && refer_by_user && !_.isEmpty(refer_by_user)) {
                        await ContestInvite.create({ refer_code: refer_code, refer_by_user: refer_by_user, refered_user: user_id, contest_id: contest_id, match_id: match_id, series_id: series_id, sport: match_sport });
                        if (user_id) {
                            let rfuserTotalCounts = await ContestInvite.find({ refer_by_user: refer_by_user, use_status: 0, contest_id: contest_id, match_id: match_id, series_id: series_id }).countDocuments();
                            if (rfuserTotalCounts >= 5) {
                                let uAnalysisData = await UserAnalysis.findOne({ user_id: ObjectId(refer_by_user), match_id: match_id, series_id: series_id, sport: match_sport });
                                let redisKeyForRentation = 'app-analysis-' + refer_by_user + '-' + match_id + '-' + match_sport;
                                if (uAnalysisData && uAnalysisData._id) {
                                    if (uAnalysisData.is_offer_type == 2 || uAnalysisData.is_offer_type == 1) {
                                        await UserAnalysis.updateOne({ _id: ObjectId(uAnalysisData._id) }, { $set: { "offer_percent": 100, "is_offer_type": 2, "contest_ids": [ObjectId(contest_id)] } });
                                        uAnalysisData.offer_percent = 100;
                                        redis.setRedisForUserAnaysis(redisKeyForRentation, uAnalysisData);
                                        await ContestInvite.updateMany(
                                            { refer_by_user: ObjectId(refer_by_user), use_status: 0, contest_id: ObjectId(contest_id), match_id: match_id, series_id: series_id, sport: match_sport },
                                            { $set: { use_status: 1 } }
                                        );
                                    }
                                } else {
                                    let offerObj = { "match_id": match_id, "series_id": series_id, "is_offer_type": 2, "sport": match_sport, "offer_amount": 0, "offer_percent": 100, "match_name": "Shareable Offer Message", "contest_ids": [ObjectId(contest_id)], "user_id": ObjectId(refer_by_user) };
                                    UserAnalysis.insertMany([offerObj])
                                        .then(function (mongooseDocuments) {
                                            for (const resItem of mongooseDocuments) {
                                                redis.setRedisForUserAnaysis(redisKeyForRentation, resItem);
                                            }
                                        })
                                        .catch(function (err) {
                                            /* Error handling */
                                            console.log('error in offer add in join contest', err);
                                        });
                                    // await UserAnalysis.create(offerObj);
                                    await ContestInvite.updateMany(
                                        { refer_by_user: ObjectId(refer_by_user), use_status: 0, contest_id: ObjectId(contest_id), match_id: match_id, series_id: series_id, sport: match_sport },
                                        { $set: { use_status: 1 } }
                                    );
                                }

                            }
                        }
                    } else {

                    }
                } catch (errrrrr) {
                    console.log('error in join contest for bonus update for referal**********');
                }
                // This is used to update data in MyContestModel for match entry as joined 
                let redisKey = 'user-contest-joinedContestIds-' + user_id + '-' + match_id + '-' + match_sport;
                redis.getRedis(redisKey, (err, data) => {
                    if (data) {
                        let userContests = data;
                        userContests.push(contest_id);
                        data = userContests;
                    } else {
                        data = [contest_id];
                    }
                    var uniqueContestIds = data.filter((value, index, self) => {
                        return self.indexOf(value) === index;
                    });

                    var newMyModelobj = {
                        'match_id': match_id, "series_id": series_id, "contest_id": contest_id, "user_id": user_id,
                        "sport": match_sport, "player_team_contest_id": newPTC._id, "match_status": 'Not Started',
                        "total_contest": uniqueContestIds.length
                    }
                    totalContestKey = uniqueContestIds.length;
                    MyContestModel.findOneAndUpdate({ match_id: match_id, sport: match_sport, user_id: user_id }, newMyModelobj, { upsert: true, new: true }).then((MyContestModel) => {
                        mycontId = MyContestModel._id || 0;
                    });

                    mqtt.publishUserJoinedContestCounts(match_id, user_id, JSON.stringify({ contest_count: uniqueContestIds.length }))
                    redis.setRedis(redisKey, data);

                    return resolve(totalContestKey);
                });

            });
        })
    } catch (error) {
        console.log("JC eroor in catch erorr error at 800", error);
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

async function contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session, matchContest) {
    try {

        let catID = contestData.category_id;
        let entity = {};
        entity.category_id = catID;
        entity.is_full = false;
        entity.admin_comission = contestData.admin_comission;
        entity.winning_amount = contestData.winning_amount;
        entity.contest_size = contestData.contest_size;
        entity.min_contest_size = contestData.min_contest_size;
        entity.contest_type = contestData.contest_type;
        entity.entry_fee = contestData.entry_fee;
        entity.used_bonus = contestData.used_bonus;
        entity.confirmed_winning = contestData.confirmed_winning;
        entity.multiple_team = contestData.multiple_team;
        entity.auto_create = contestData.auto_create;
        entity.status = contestData.status;
        entity.price_breakup = contestData.price_breakup;
        entity.invite_code = contestData.invite_code;
        entity.breakup = contestData.breakup;
        entity.amount_gadget = contestData.amount_gadget;
        entity.created = new Date();
        entity.maximum_team_size = contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1);
        if (parentContestId) {
            entity.parent_id = parentContestId;
        } else {
            entity.parent_id = contestData._id;
        }
        entity.is_auto_create = 2;
        const newDataC = await Contest.insertMany([entity], { session: session });
        var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
        console.log("cResult", cResult);
        let inviteCode = Helper.createUserReferal(6);
        if (cResult && cResult._id) {
            let newContestId = cResult._id;
            let entityM = {};
            if (parentContestId) {
                entityM.parent_contest_id = parentContestId;
            } else {
                entityM.parent_contest_id = contestData._id;
            }
            entityM.match_id = match_id;
            entityM.contest_id = newContestId;
            entityM.series_id = series_id;
            entityM.category_id = ObjectId(catID);
            entityM.invite_code = '1Q' + inviteCode;
            entityM.created = new Date();
            entityM.localteam = liveMatch.localteam || '';
            entityM.localteam_id = liveMatch.localteam_id || '';
            entityM.visitorteam = liveMatch.visitorteam || '';
            entityM.visitorteam_id = liveMatch.visitorteam_id || '';
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
                maximum_team_size: contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1)
            };


            const dd = await MatchContest.insertMany([entityM], { session: session });

            await session.commitTransaction();
            session.endSession();

            try {
                let matchContestKey = RedisKeys.MATCH_CONTEST_LIST + match_id;
                redis.getRedis(matchContestKey, (err, categories) => {
                    let catId = contestData.category_id.toString();
                    let catIndex = _.findIndex(categories, { "_id": catId });
                    if (catIndex >= 0) {
                        let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                        if (contestIndex >= 0) {
                            let newCOntestDeepObj = JSON.parse(JSON.stringify(categories[catIndex]['contests'][contestIndex]))
                            categories[catIndex]['contests'].splice(contestIndex, 1);
                            newCOntestDeepObj["contest_id"] = cResult._id;
                            newCOntestDeepObj["parent_id"] = contest_id;
                            if (categories[catIndex]['contests'].length === 0) {
                                categories[catIndex].contests.push(newCOntestDeepObj);
                            } else {
                                categories[catIndex].contests.unshift(newCOntestDeepObj);
                            }
                            redis.setRedis(matchContestKey, categories);
                        }
                    }
                });
            } catch (errr) {
                console.log('JC eorr in auto create redis***');
            }


            return cResult;
        } else {
            console.log('something went wrong autocreate***************************wrong in auto crete');
            return {}
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log('sometjhing went wrong in autocreate***************************wrong in auto error');
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
async function joinContestPaymentCalculation(contest_size, offerableAppled, useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount) {
    let useAmount = (useableBonusPer / 100) * entryFee;
    let saveData = {};
    let remainingFee = 0;
    let indianDate = Date.now();
    indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
    let winDistributeStatus = authUser && authUser.win_dis_status ? true : false;

    if (entryFee > 0 && useAmount > 0 && authUser.bonus_amount && authUser.bonus_amount > 0 && (retention_bonus_amount == 0 || (retention_bonus_amount > 0 && offerableAppled))) {
        if (useAmount <= authUser.bonus_amount) {
            remainingFee = entryFee - useAmount;
            saveData['bonus_amount'] = authUser.bonus_amount - useAmount;
            bonusAmount = useAmount;
        } else {
            remainingFee = entryFee - authUser.bonus_amount;
            saveData['bonus_amount'] = 0;
            bonusAmount = authUser.bonus_amount;
        }
    } else {
        remainingFee = entryFee;
    }
    if (retention_bonus_amount > 0 && !offerableAppled) {
        bonusAmount = 0;
    }

    let perdayExtraAmount = 0;
    if (remainingFee) {
        let extraBalance = authUser.extra_amount || 0;

        let extraBal = 0;
        if (extraBalance && extraBalance > 0 && contest_size > 25 && !authUser.xtra_cash_block) {
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
    }
}

async function multipleJoinContestDetail(session, contestTeamData, decoded, bonusAmount, winAmount, cashAmount, playerTeamContestId, contestData, extraAmount, match_sport, retention_bonus_amount) {

    let surpriseAmount = extraAmount || 0;
    let totalAmount = bonusAmount + winAmount + cashAmount + surpriseAmount;
    if (!contestData) {
        contestData = await Contest.findOne({ '_id': decoded['contest_id'] });
    }
    let adminComission = contestData && contestData.admin_comission ? parseFloat(contestData.admin_comission) : 0;
    let winningAmount = contestData.winning_amount;
    let contestSize = contestData.contest_size;
    let comission = 0;
    if (adminComission && adminComission > 0) {
        const profitAmount = Math.ceil((winningAmount * adminComission) / 100);
        let entryfee = contestData.entry_fee;
        comission = (profitAmount / contestSize);
        comission = Math.round(comission, 2);
    } else {
        comission = 0;
    }
    let jcdArray = [];
    let tCount = contestTeamData.length;
    for (const team_data_item of contestTeamData) {
        let saveEntity = {};
        saveEntity.user_id = decoded['user_id'];
        saveEntity.contest_id = decoded['contest_id'];
        saveEntity.series_id = decoded['series_id'];
        saveEntity.match_id = decoded['match_id'];
        saveEntity.sport = match_sport;
        saveEntity.bonus_amount = bonusAmount / tCount;
        saveEntity.winning_amount = winAmount / tCount;
        saveEntity.deposit_cash = cashAmount / tCount;
        saveEntity.extra_amount = surpriseAmount / tCount;
        saveEntity.total_amount = totalAmount / tCount;
        saveEntity.admin_comission = comission ? parseFloat(comission) : 0;
        saveEntity.player_team_contest_id = team_data_item._id;
        saveEntity.retention_bonus = retention_bonus_amount || 0;
        jcdArray.push(saveEntity);
    }
    await JoinContestDetail.insertMany(jcdArray, { session: session });

}

async function removeDuplicateEntry(data) {
    let uniqueUsersByID = _.uniqWith(data, _.isEqual);;
    return uniqueUsersByID;
}

async function setTranscation(decoded, match_sport, contest_id, total_team) {
    await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: - total_team } });
}

/**
 * This is used to send join contest data to appsflyer
 * @param {*} authUser 
 * @param {*} match_id 
 * @param {*} sport 
 * @param {*} contest_id 
 * @param {*} team_data 
 */
async function setJoinContestDataToAppsflyer(authUser,match_id,sport,contest_id,team_data){
    try {
        if (authUser && authUser.appsflayer_id) {
            let appsflyerURL = config.appsFlyerAndroidUrl;
            let event_val = {
                "appsflyer_id": authUser.appsflayer_id || '',
                "af_customer_user_id": authUser.clevertap_id || '',
                "match_id": match_id || '',
                "sport": sport || '',
                "contest_id": contest_id || '',
                "team_joined": team_data.length || 1,
                'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid : ''
            };
            var joinContestAppslyeBd = {
                "eventName": "JoinContestS2S",
                "appsflyer_id": authUser.appsflayer_id || '',
                "customer_user_id": authUser._id || '',
                "eventTime": new Date(),
                'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid : '',
                "eventValue": JSON.stringify(event_val)
            };
            await appsFlyerEntryService(joinContestAppslyeBd, appsflyerURL);
        }
    } catch (appserr) {
        console.log('appserr at join contest', appserr);
    }
}