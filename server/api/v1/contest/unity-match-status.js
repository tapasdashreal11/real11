const config = require('../../../config');
const User = require('../../../models/user');
const UnityGamesPtc = require('../../../models/unity-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const UserOtherInfo = require('../../../models/user-other-info');
const ObjectId = require('mongoose').Types.ObjectId;
const OtherGameTransaction = require('../../../models/other-games-transaction');
const { TransactionTypes } = require('../../../constants/app');
const _ = require("lodash");
const ludoMqtt = require('../../../../lib/other-games-mqtt');
const { Validator } = require("node-input-validator");
const { startSession } = require('mongoose');
const moment = require('moment');
const redis = require('../../../../lib/redis');
const LudoOffer = require("../../../models/ludo_offer");

module.exports = async (req, res) => {
    try {
        const { contestId, status, players, roomId, unity_room_id } = req.body;
        let response = {};
        let constraints = { contestId: "required", status: "required", players: "required", roomId: "required", unity_room_id: "required" };
        let validator = new Validator(req.body, constraints);
        let matched = await validator.check();
        var apiKey = req.headers['api-key'];
        let local_match_id;
        let match_sport = 3;
        console.log("Unity Ludo status*** ", contestId, status, players,roomId,unity_room_id);
        if (!matched) {
            response["success"] = false;
            response["matchId"] = "";
            return res.json(response);
        }
        if (_.isEqual(apiKey, config.gamezop_api_key)) {
            let playersIds = players.map(s => ObjectId(s));
            let matchContest = await OtherGamesContest.findOne({ contest_id: ObjectId(contestId) });
            local_match_id = matchContest && matchContest.match_id ? matchContest.match_id:111;
            const ludoOffer = await LudoOffer.find({match_id:local_match_id,status: 1,user_id:{ $in: playersIds},expiry_date:{$gte:new Date()} });
            if (status == 'MATCH_FOUND' && matchContest && matchContest.is_full) {
                const session = await startSession()
                session.startTransaction();
                try {
                    let userDataList = await User.find({ _id: { $in: playersIds},fair_play_violation:0 });
                    console.log("ludoOffer status **",ludoOffer);
                    
                    if (userDataList && userDataList.length > 0 && matchContest && playersIds && playersIds.length == userDataList.length) {
                        local_match_id = matchContest.match_id;
                        let contestData = matchContest && matchContest.contest ? matchContest.contest : {};
                        let useableBonusPer = contestData.used_bonus || 0;
                        let contestType = contestData.contest_type;
                        let entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                        let contestSizeCal = (contestData && contestData.contest_size) ? (contestData.contest_size) : (contestData.infinite_contest_size ? 2 : 2);
                        
                        
                        let date = new Date();
                        let caculateAdminComision = await calculateAdminComission(contestData);
                        let transactionArray = [];
                        let ptcArray = [];
                        let userArray = [];
                        let userOfferArray =[]
                        let zop_match_id = unity_room_id; //ObjectId(roomId); //await generateZopMatchId();
                        if(local_match_id ==111) await checkUserLudoPlayed(userDataList);

                        let pContestId = matchContest.contest_id;
                        let prContestId = matchContest && matchContest.parent_contest_id ? String(matchContest.parent_contest_id):matchContest.contest_id;

                        if (contestType == "Paid") {
                            for (const userId of playersIds) {
                                let singleUserDataItem = _.find(userDataList, { _id: userId });
                                let contest = {};
                                let newContestId = new ObjectId();
                                contest._id = newContestId;
                                contest.match_id = local_match_id;
                                contest.sport = match_sport;
                                contest.contest_id = contestId;
                                contest.user_id = userId;
                                contest.team_name = singleUserDataItem.team_name;
                                contest.total_amount = contestData.entry_fee;
                                contest.avatar = singleUserDataItem.avatar || '';
                                let retention_bonus_amount = 0;
                                let calEntryFees = entryFee;
                                // Check user has ludo offer 
                                if(ludoOffer && ludoOffer.length>0){
                                    let checkUserOffer =  ludoOffer.find((el) => el && el.user_id && (ObjectId(el.user_id).equals(ObjectId(userId))));
                                    let cBonus =  checkUserOffer && checkUserOffer.contest_bonous?checkUserOffer.contest_bonous:[]; 
                                    let cBonusItem =  cBonus.find((el)=> (ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))) );
                                    if(cBonusItem && cBonusItem.contest_id ){
                                        let userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                        calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                        retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                    }
                                    let c_bonous = [];
                                    cBonus.find(function (e2) {
                                        if (ObjectId(e2.contest_id).equals(ObjectId(prContestId)) || ObjectId(e2.contest_id).equals(ObjectId(pContestId))) {
                                        } else { c_bonous.push(e2); }
                                    });

                                    // Check if user get retention amount then update again into LudoOffer after deduction
                                    if(retention_bonus_amount>0 && checkUserOffer && checkUserOffer._id){
                                        userOfferArray.push({
                                            updateOne: {
                                                "filter": { "_id": checkUserOffer._id },
                                                "update":{ $set: { "contest_bonous": c_bonous } }
                                            }
                                        });
                                        checkUserOffer.contest_bonous = c_bonous
                                        let redisKeyForUserAnalysisOthers = 'other-games-offer-' + userId + '-'  + local_match_id;
                                        redis.setRedisForUserAnaysis(redisKeyForUserAnalysisOthers, checkUserOffer);
                                    }
                                    console.log("userOfferArray status **",userOfferArray);
                                }
                                
                                if (matchContest.usable_bonus_time) {
                                    if (moment().isBefore(matchContest.usable_bonus_time)) {
                                        useableBonusPer = matchContest.before_time_bonus;
                                    } else {
                                        useableBonusPer = matchContest.after_time_bonus;
                                    }
                                } else {
                                    useableBonusPer = contestData.used_bonus || 0;
                                }
                                let cashAmount = 0;
                                let winAmount = 0;
                                let bonusAmount = 0;
                                let extraAmount = 0;
                                const paymentCal = await joinContestPaymentCalculation(contestSizeCal, useableBonusPer, singleUserDataItem, calEntryFees, winAmount, cashAmount, bonusAmount, extraAmount, retention_bonus_amount);
                                cashAmount = paymentCal.cashAmount;
                                winAmount = paymentCal.winAmount;
                                bonusAmount = paymentCal.bonusAmount;
                                extraAmount = paymentCal.extraAmount;
                                let saveData = paymentCal.saveData;
                                let perdayExtraAmount = paymentCal.perdayExtraAmount;
                                let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;

                                let txnId = joinContestTxnId;
                                let status = TransactionTypes.JOIN_CONTEST;
                                let txnAmount = entryFee;
                                let withdrawId = 0;

                                if (calEntryFees == (winAmount + cashAmount + bonusAmount + extraAmount)) {
                                    let jcd = {
                                        deduct_bonus_amount: bonusAmount,
                                        deduct_winning_amount: winAmount,
                                        deduct_deposit_cash: cashAmount,
                                        deduct_extra_amount: extraAmount,
                                        total_amount: entryFee,
                                        admin_comission: caculateAdminComision,
                                        retention_bonus: retention_bonus_amount,
                                    }
                                    let r_winning_balance = singleUserDataItem && singleUserDataItem['winning_balance'] ? singleUserDataItem['winning_balance'] - winAmount :0;
                                    let r_cash_balance = singleUserDataItem && singleUserDataItem['cash_balance'] ? singleUserDataItem['cash_balance'] - cashAmount :0;
                                    let r_bonus_balance = singleUserDataItem && singleUserDataItem['bonus_amount'] ? singleUserDataItem['bonus_amount'] - bonusAmount :0 ;
                                    let r_extra_amount = singleUserDataItem && singleUserDataItem['extra_amount'] ? singleUserDataItem['extra_amount'] - extraAmount:0 ;

                                    contest.join_contest_detail = jcd;
                                    contest.zop_match_id = unity_room_id;
                                    contest.unity_room_id = unity_room_id;
                                    ptcArray.push(contest);
                                    let entity = {
                                        user_id: userId, contest_id: contestId, match_id: local_match_id, sport: match_sport, txn_amount: txnAmount, currency: "INR",
                                        details: {
                                            "refund_winning_balance":(winAmount ? winAmount : 0),
                                            "refund_cash_balance": (cashAmount ? cashAmount : 0),
                                            "refund_bonus_amount": (bonusAmount ? bonusAmount : 0),
                                            "refund_extra_amount": (extraAmount ? extraAmount : 0),
                                            "refund_affiliate_amount": 0,
                                            "current_winning_balance": r_winning_balance ? r_winning_balance:0,
                                            "current_cash_balance": r_cash_balance ? r_cash_balance:0,
                                            "current_bonus_amount": r_bonus_balance ? r_bonus_balance:0,
                                            "current_extra_amount": r_extra_amount ? r_extra_amount:0,
                                            "current_affiliate_amount":singleUserDataItem && singleUserDataItem.affiliate_amount ? singleUserDataItem.affiliate_amount:0,
                                        },
                                        retantion_amount: retention_bonus_amount,
                                        txn_date: Date.now(),
                                        local_txn_id: txnId,
                                        added_type: parseInt(status)
                                    };
                                    transactionArray.push(entity);
                                    userArray.push({
                                        updateOne: {
                                            "filter": { "_id": userId },
                                            "update": { $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } }
                                        }
                                    })

                                }

                            }
                            if (ptcArray && ptcArray.length > 1 && userArray && userArray.length > 1 && transactionArray && transactionArray.length > 0 && transactionArray.length == ptcArray.length) {
                                await User.bulkWrite(userArray, { session: session });
                                await OtherGameTransaction.insertMany(transactionArray, { session: session });
                                await UnityGamesPtc.insertMany(ptcArray, { session: session });
                                await OtherGamesContest.updateOne({ contest_id: ObjectId(contestId) }, { $set: { zop_match_id: zop_match_id } }, { session: session });
                                if(userOfferArray && userOfferArray.length > 0){
                                  await LudoOffer.bulkWrite(userOfferArray, { session: session });
                                }
                                await session.commitTransaction();
                                session.endSession();
                                response["success"] = true;
                                response["matchId"] = zop_match_id;
                                return res.json(response);
                            } else {
                                await session.commitTransaction();
                                session.endSession();
                                response["success"] = true;
                                response["matchId"] = "";
                                return res.json(response);
                            }
                        } else {
                            await session.abortTransaction();
                            session.endSession();
                            response["success"] = true;
                            response["matchId"] = zop_match_id;
                            return res.json(response);
                        }

                    } else {
                        await session.abortTransaction();
                        session.endSession();
                        response["success"] = true;
                        response["matchId"] = "";
                        return res.json(response);
                    }
                } catch (sessionError) {
                    console.log("catch error in ludo match status",sessionError);
                    await session.abortTransaction();
                    session.endSession();
                    response["success"] = false;
                    response["matchId"] = "";
                    return res.json(response);
                }

            } else if (status == 'NO_MATCH_FOUND') {
                
                let teamLength = playersIds && playersIds.length > 0 ? playersIds.length : 1;
                let doc= await OtherGamesContest.findOneAndUpdate({ contest_id: ObjectId(contestId), is_full: 0,joined_users:{$gte:teamLength} }, { $inc: { joined_users: -teamLength } },{new: true });
                response["success"] = true;
                response["matchId"] = "";
                let joinedContestCount = doc && doc.joined_users ? doc.joined_users: 0 ;
                ludoMqtt.publishOtherGameJoinedUserCounts(local_match_id,contestId,JSON.stringify({joined_count:joinedContestCount}));
                if (playersIds && playersIds.length > 0) redis.setRedis("match-contest-other-" + local_match_id, []);  //redis.setRedis("match-contest-other-view-" + playersIds[0], {});
                return res.json(response);
            }
        } else {
            let response = {};
            response["success"] = false;
            response["message"] = "Wrong api key!!";
            return res.json(response);
        }

    } catch (error) {
        let response = {};
        console.log("catch error in ludo match status2",error);
        response["success"] = false;
        response["matchId"] = "";
        return res.json(response);
    }
}

async function generateZopMatchId() {
    var text = "";
    var possible = "0123456789";
    for (var i = 0; i < 7; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return parseInt(text);
}


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
        if (extraBalance && extraBalance > 0 && contest_size > 25 && (authUser && !authUser.xtra_cash_block)) {
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
/**
 * Check user is ludo player or not
 * If not then create a record during match 
 * @param {*} userList 
 */
async function checkUserLudoPlayed(userList){
    try{
        let UsersIds = _.map(userList,'_id');
        let userOtherInfo = await UserOtherInfo.find({ user_id:{$in:UsersIds} });
        if(UsersIds){
           // console.log("userOtherInfo",userOtherInfo);
            userOtherInfo ? userOtherInfo:[]; 
            let result = userList.filter(o1 => !userOtherInfo.some(o2 =>  o1._id.equals(ObjectId(o2.user_id))));
           if(result && result.length>0){
                //console.log("userOtherInfo result",result);
                let playedList =[];
                for (const userItem of result) {
                    let key = "user_ludo_played_" + userItem._id;
                    playedList.push({ user_id: userItem._id, is_ludo_played:1 });
                    redis.setRedis(key, {status:true});
                }
                if(playedList && playedList.length>0){
                   // console.log(playedList);
                    await UserOtherInfo.insertMany(playedList);
                } 
           }
        }
    }catch(error){
    }
}