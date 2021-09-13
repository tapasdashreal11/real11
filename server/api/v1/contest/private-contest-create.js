const config = require('../../../config');
const User = require('../../../models/user');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeamContest = require('../../../models/player-team-contest');
const MyContestModel = require('../../../models/my-contest-model');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/transaction');
const JoinContestDetail = require('../../../models/join-contest-detail');
const { Validator } = require("node-input-validator");
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
const { appsFlyerEntryService } = require("../users/appsflyer-api");
const UserContestBreakup = require('../../../models/user-contest-breakup');
const Helper = require('./../common/helper');

module.exports = {
    createPrivateContest: async (req, res) => {
        try {
            let data1 = {};
            const user_id = req.userId;
            let {contest_name, contest_size, series_id, match_id, team_id, winners_count, winning_amount, entry_fee, team_count, sport } = req.body;
            let params = req.body;
            let constraints = { contest_name: "required", contest_size: "required",series_id: "required",match_id: "required",team_id: "required",winners_count: "required",winning_amount: "required",team_count: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            var team_count_number = team_count ? parseInt(team_count) : 0;
            let match_sport = sport ? parseInt(sport) : 1;
            match_id = parseInt(match_id);
            series_id = parseInt(series_id);
            entry_fee = parseFloat(entry_fee);
            entryFee = parseFloat(entry_fee);
            winning_amount = parseFloat(winning_amount);
            contest_size = parseInt(contest_size);
            winners_count = parseInt(winners_count);
            // create contest invite code
            let inviteCode = Helper.createUserReferal(6);
            let decoded = {
                contest_size,
                series_id,
                match_id,
                team_id,
                user_id,
                winners_count,
                winning_amount,
                entry_fee
            }
            let currentDate = moment().utc().toDate();
            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            if (decoded) {
                let commission = config.contest_commission;
                if (decoded['user_id'] && decoded['contest_size'] && decoded['series_id'] && decoded['match_id'] && decoded['team_id'] && decoded['winners_count']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });
                    if (authUser) {
                        let seriesMatch = await SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] });
                        if (seriesMatch && seriesMatch._id) {
                            let ctime = Date.now();
                            let mtime = seriesMatch.time;
                            if (mtime < ctime) {
                                return res.send(ApiUtility.failed('Match has been started.'));
                            } else {
                                const session = await startSession()
                                session.startTransaction();
                                const sessionOpts = { session, new: true };
                                try {
                                    let contestSaveData = {};
                                    contestSaveData['contest_size'] = decoded['contest_size'];
                                    contestSaveData['winning_amount'] = decoded['winning_amount'];
                                    contestSaveData['entry_fee'] = decoded['entry_fee'];
                                    contestSaveData['admin_comission'] = commission;
                                    contestSaveData['contest_type'] = (decoded['winning_amount'] > 0) ? 'Paid' : 'Free';
                                    contestSaveData['multiple_team'] = (decoded['join_multiple'] == 'yes') ? 'yes' : 'no';
                                    contestSaveData['maximum_team_size'] = (decoded['join_multiple'] == 'yes') ? 9 : 1;
                                    contestSaveData['used_bonus'] = 0;
                                    contestSaveData['is_private'] = 1;
                                    contestSaveData['status'] = 1;
                                    contestSaveData['is_auto_create'] = 0;
                                    contestSaveData['auto_create'] = 'no';
                                    contestSaveData['confirmed_winning'] = 'no';
                                    contestSaveData['amount_gadget'] = 'false';
                                    contestSaveData['infinite_contest_size'] = 0;
                                    contestSaveData['contest_shareable'] = 0;
                                    contestSaveData['user_created'] = 1;
                                    contestSaveData['category_id'] = config && config.private_category && config.private_category.id ? config.private_category.id :'';
                                    contestSaveData['user_contest']= {'invite_code':inviteCode,'user_id': decoded['user_id'],'match_id':match_id,'contest_name':contest_name};

                                    // contest price breakup
                                    if (decoded['winning_amount'] > 0) {
                                        let prizeBreakup = await UserContestBreakup.find({ "contest_size_start": { $lte: decoded['contest_size'] }, "contest_size_end": { $gte: decoded['contest_size'] }, winner: decoded['winners_count'] }).sort({ winner: 1 });
                                        let breakpArr = [];
                                        if (prizeBreakup) {
                                            contestSaveData['price_breakup'] = 1;
                                            let key = 0;
                                            for (const breakup of prizeBreakup) {
                                                breakpArr[key] = {};
                                                let winnigAmount = decoded['winning_amount'];
                                                let percent = breakup.percent_prize;
                                                let prizeMoney = (winnigAmount / 100) * percent;
                                                let priceRange = breakup.rank.split(" ");
                                                let startRank = (priceRange[1]) ? priceRange[1] : 0;
                                                let endRank = (priceRange[3]) ? priceRange[3] : priceRange[1];
                                                breakpArr[key].name = breakup.rank;
                                                breakpArr[key].startRank = startRank;
                                                breakpArr[key].endRank = endRank;
                                                breakpArr[key].percentage = breakup.percent_prize;
                                                breakpArr[key].price = prizeMoney;
                                                breakpArr[key].price_each = prizeMoney / (parseInt(endRank) - parseInt(startRank) + 1);

                                                key++;
                                            }
                                        }
                                        if(breakpArr && breakpArr.length>0){
                                            breakpArr = _.sortBy(breakpArr,[function(o) { return o.startRank; }]);
                                        }
                                        
                                        contestSaveData['breakup'] = breakpArr;
                                    }
                                    // save contest with no category_id
                                    const newDataC = await Contest.create([contestSaveData], { session: session });
                                    var result = newDataC && newDataC.length > 0 ? newDataC[0] : {};
                                    if (result && result._id) {
                                        decoded['contest_id'] = result._id;
                                        if (seriesMatch) {
                                            matchContest = {};
                                            matchContest['localteam'] = seriesMatch.localteam;
                                            matchContest['visitorteam'] = seriesMatch.visitorteam;
                                            matchContest['localteam_id'] = seriesMatch.localteam_id;
                                            matchContest['visitorteam_id'] = seriesMatch.visitorteam_id;
                                            matchContest['match_status'] = seriesMatch.match_status;
                                            matchContest['invite_code'] = inviteCode;
                                            matchContest['contestStartDateTime'] = seriesMatch.time;
                                            matchContest['contest_id'] = decoded['contest_id'];
                                            matchContest['created'] = currentDate;
                                            matchContest['joined_users'] = 1;
                                            matchContest['is_full'] = 0;
                                            matchContest['isCanceled'] = 0;
                                            matchContest['status'] = 1;
                                            matchContest['is_auto_create'] = 0;
                                            matchContest['admin_create'] = 0;
                                            matchContest['is_offerable'] = 0;
                                            matchContest['match_id'] = seriesMatch.match_id;
                                            matchContest['series_id'] = seriesMatch.series_id;
                                            matchContest['category_id'] = config && config.private_category && config.private_category.id ? config.private_category.id :'';
                                            matchContest['category_name'] = config && config.private_category && config.private_category.cat_name ? config.private_category.cat_name :'';
                                            matchContest['category_description'] = config && config.private_category && config.private_category.cat_des ? config.private_category.cat_des :'';
                                            matchContest['sport'] = 1;
                                            matchContest['category_seq'] = 1;
                                            matchContest['is_private'] = 1;
                                            matchContest['contest'] = contestSaveData;
                                            matchContest['contest_id'] = result._id;;
                                            await MatchContest.create([matchContest], { session: session });
                                        }
                                        let cashAmount = 0;
                                        let winAmount = 0;
                                        let bonusAmount = 0;
                                        let extraAmount = 0;
                                        let calEntryFees = entry_fee;
                                        const paymentCal = await joinContestPaymentCalculation(false, 0, authUser, entry_fee, winAmount, cashAmount, bonusAmount, extraAmount, 0);

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
                                                        contest_id: decoded['contest_id'],
                                                        match_id: match_id,
                                                        sport: match_sport,
                                                        txn_amount: txnAmount,
                                                        retantion_amount: 0,
                                                        currency: "INR",
                                                        txn_date: Date.now(),
                                                        contest_entry_fee: entryFee,
                                                        total_team_joined: 1,
                                                        local_txn_id: txnId,
                                                        added_type: parseInt(status)
                                                    };
                                                    let userBalance = await User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1 })
                                                    if (userBalance) {
                                                        if (userBalance.extra_amount < extraAmount || userBalance.cash_balance < cashAmount || userBalance.winning_balance < winAmount || userBalance.bonus_amount < bonusAmount) {
                                                           
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                            return res.send(ApiUtility.failed("Please try again."));
                                                        }
                                                    }
                                                    let walletRes = await User.updateOne({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } }, sessionOpts);

                                                    if (walletRes && walletRes.nModified > 0) {
                                                        await Transaction.create([entity], { session: session });
                                                       
                                                        let contest = {};
                                                        let newContestId = new ObjectId();
                                                        contest._id = newContestId;
                                                        contest.player_team_id = team_id;
                                                        contest.match_id = match_id;
                                                        contest.series_id = series_id;
                                                        contest.contest_id = decoded['contest_id'];
                                                        contest.user_id = user_id;
                                                        contest.sport = match_sport;
                                                        contest.total_amount = calEntryFees;
                                                        contest.team_count = team_count_number;
                                                        contest.team_name = authUser && authUser.team_name ? authUser.team_name : '';
                                                        contest.avatar = authUser && authUser.avatar ? authUser.avatar : '';
                                                        if(_.has(contest, "player_team_id") && _.has(contest, "team_count") &&  _.has(contest, "team_name") &&  contest.team_name !='' && contest.player_team_id !=null && contest.player_team_id != '' && contest.team_count != null && contest.team_count != '' && contest.team_count > 0 ){
                                                            await PlayerTeamContest.create([contest], { session: session });
                                                        } else {
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                            return res.send(ApiUtility.failed("Player team not found. Please try again!!"));
                                                        }
                                                        
                                                        var newMyModelobj = {
                                                            'match_id': match_id,
                                                            "series_id": series_id,
                                                            "contest_id": decoded['contest_id'],
                                                            "user_id": user_id,
                                                            "sport": match_sport,
                                                            "player_team_contest_id": newContestId,
                                                            "match_status": 'Not Started',
                                                            "total_contest": 1
                                                        }
                                                        let redisKey = 'user-contest-joinedContestIds-' + user_id + '-' + match_id + '-' + match_sport;
                                                        try {
                                                            redis.getRedis(redisKey, async(err, data) => {
                                                                if (data) {
                                                                    let userContests = data;
                                                                    userContests.push(decoded['contest_id']);
                                                                    data = userContests;
                                                                } else {
                                                                    data = [decoded['contest_id']];
                                                                }
                                                                var uniqueContestIds = data.filter((value, index, self) => {
                                                                    return self.indexOf(value) === index;
                                                                });
                                                                newMyModelobj['total_contest'] = uniqueContestIds && uniqueContestIds.length ? uniqueContestIds.length : 1; 
                                                                await MyContestModel.findOneAndUpdate({ match_id: match_id, sport: match_sport, user_id: user_id }, newMyModelobj, {session: session , upsert: true, new: true });
                                                                redis.setRedis(redisKey, data);
                                                            });
                                                         } catch(errredis){
                                                          
                                                         }
                                                        
                                                        
                                                        
                                                        await saveJoinContestPrivateDetail(decoded, bonusAmount, winAmount, cashAmount, newContestId, result, extraAmount, match_sport, session);
                                                        await session.commitTransaction();
                                                        session.endSession();
                                                        setAppsflyerData(authUser, match_id, match_sport, decoded['contest_id']);
                                                        let myJoinedContestListKey = "joined-contest-list-" + match_id + "-" + series_id + "-" + user_id;
                                                        redis.setRedisMyMatches(myJoinedContestListKey, {});
                                                        try{
                                                            redis.redisObj.get('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, (err, data) => {
                                                                let count = (data) ? parseInt(data) : 1;
                                                                redis.redisObj.del('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id);
                                                            });
                                                            let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id + "_" + match_sport;
                                                            redis.setRedisMyMatches(matchContestUserKey, {});
                                                        }catch(er){}
                                                        //******************************last response*******************
                                                        data1.invite_code = inviteCode;
                                                        data1.match_id = match_id;
                                                        data1.series_id = series_id;
                                                        data1.match_name = seriesMatch.visitorteam_short_name + " vs " + seriesMatch.localteam_short_name;
                                                        data1.match_time = seriesMatch.time;
                                                        data1.entry_fee = entryFee;
                                                        data1.contest_size = contest_size;
                                                        data1.contest_id = decoded['contest_id'];
                                                        return res.send(ApiUtility.success(data1, 'You have created your private contest successfully. Now share with your friends!!'));
                                                    } else {
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

                                    } else {
                                        await session.abortTransaction();
                                        session.endSession();
                                        response.message = "Something went wrong, please try again!";
                                        return res.json(response);
                                    }

                                } catch (errorr) {
                                    let response = {};
                                    console.log('errorr', errorr)
                                    await session.abortTransaction();
                                    session.endSession();
                                    response.status = false;
                                    response.message = errorr;
                                    response.error_code = null;
                                    return res.json(response);
                                } finally {
                                    // ending the session
                                    session.endSession();
                                }
                            }

                        } else {
                            return res.send(ApiUtility.failed('You can not create contest, match already started.'));
                        }
                    } else {
                        return res.send(ApiUtility.failed('Invalid user id.'));
                    }
                } else {
                    return res.send(ApiUtility.failed("match id or series id are empty."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }

    }
};


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
async function joinContestPaymentCalculation(offerableAppled, useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount) {
    let useAmount = (useableBonusPer / 100) * entryFee;
    let saveData = {};
    let remainingFee = 0;
    let indianDate = Date.now();
    indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));

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
/**
 * This is used for join contest detail
 * @param {*} decoded 
 * @param {*} bonusAmount 
 * @param {*} winAmount 
 * @param {*} cashAmount 
 * @param {*} playerTeamContestId 
 * @param {*} contestData 
 * @param {*} extraAmount 
 * @param {*} match_sport 
 * @param {*} session 
 */
async function saveJoinContestPrivateDetail(decoded, bonusAmount, winAmount, cashAmount, playerTeamContestId, contestData, extraAmount, match_sport, session) {
    let surpriseAmount = extraAmount || 0;
    let totalAmount = bonusAmount + winAmount + cashAmount + surpriseAmount;

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

    let saveEntity = {};
    saveEntity.user_id = decoded['user_id'];
    saveEntity.contest_id = decoded['contest_id'];
    saveEntity.series_id = decoded['series_id'];
    saveEntity.match_id = decoded['match_id'];
    saveEntity.sport = match_sport;
    saveEntity.bonus_amount = bonusAmount;
    saveEntity.winning_amount = winAmount;
    saveEntity.deposit_cash = cashAmount;
    saveEntity.extra_amount = surpriseAmount;
    saveEntity.total_amount = totalAmount;
    saveEntity.admin_comission = comission ? parseFloat(comission) : 0;
    saveEntity.player_team_contest_id = playerTeamContestId;
    saveEntity.retention_bonus = 0;
    await JoinContestDetail.create([saveEntity], { session: session });
}
/**
 * This is used to set data to appsflyr event to create private contest by user
 * @param {*} authUser 
 * @param {*} match_id 
 * @param {*} sport 
 * @param {*} contest_id 
 */
async function setAppsflyerData(authUser, match_id, sport, contest_id) {
    try {
        if (authUser && authUser.appsflayer_id) {
            let appsflyerURL = config.appsFlyerAndroidUrl;
            let event_val = {
                "appsflyer_id": authUser.appsflayer_id || '',
                "af_customer_user_id": authUser.clevertap_id || '',
                "match_id": match_id || '',
                "sport": sport || '',
                "contest_id": contest_id || '',
                "team_joined": 1,
                'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid : ''
            };
            var joinContestAppslyeBd = {
                "eventName": "PrivateContestCreateS2S",
                "appsflyer_id": authUser.appsflayer_id || '',
                "customer_user_id": authUser._id || '',
                "eventTime": new Date(),
                'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid : '',
                "eventValue": JSON.stringify(event_val)
            };
            appsFlyerEntryService(joinContestAppslyeBd, appsflyerURL);
        }

    } catch (appserr) {
        console.log('appserr at private create contest', appserr);
    }
}