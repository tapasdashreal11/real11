const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const ObjectId = require('mongoose').Types.ObjectId;
const OtherGameTransaction = require('../../../models/other-games-transaction');
const OtherGameLudoLogs = require('../../../models/other-game-ludo-log');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const { Validator } = require("node-input-validator");
const { startSession } = require('mongoose');
const moment = require('moment');

module.exports = async (req, res) => {
    try {
        const { roomId, matchId, scores } = req.body;

        let response = {};
        let constraints = { roomId: "required", matchId: "required", scores: "required" };
        var apiKey = req.headers['api-key'];
        let validator = new Validator(req.body, constraints);
        let matched = await validator.check();
        //console.log("scores",scores);
        let match_sport = 3;
        if (scores && scores.length == 0 && roomId && matchId) {

            let zop_match_id = parseInt(matchId);
            await cancelContestAtResult(zop_match_id, roomId);
            response["success"] = false;
            response["scores"] = [];
            return res.json(response);

        } else {
            if (!matched) {
                response["success"] = false;
                response["scores"] = [];
                return res.json(response);
            }
            if (scores && scores.length > 2) {

            }
        }

        let rankData = scores.map(s => {
            return { rank: s.rank, user_id: ObjectId(s.sub), score: s.score }
        });
        if (_.isEqual(apiKey, config.gamezop_api_key)) {
            if (rankData && rankData.length > 0) {
                const allEqual = arr => arr.every(v => v.rank === arr[0].rank);
                let matchTieStatus = allEqual(rankData);
                if (matchTieStatus) {
                    // When match tie status is happening
                    console.log("matchTieStatus*********",matchTieStatus,rankData);

                    let matchContest = await OtherGamesContest.findOne({ 'contest_id': ObjectId(roomId), sport: match_sport });
                    let contestData = matchContest && matchContest.contest ? matchContest.contest : {};
                    let contestType = contestData.contest_type;
                    if (contestType == "Paid") {

                        let zop_match_id = parseInt(matchId);
                        await cancelContestAtResult(zop_match_id, roomId);
                        response["success"] = false;
                        response["scores"] = [];
                        return res.json(response);
                    } else {
                        response.success = true;
                        let scoresData = scores.map(v => ({ ...v, prize: 0, currencyIcon: "icon.png" }))
                        response.scores = scoresData;

                        return res.json(response);
                    }

                } else {
                    // If match tie does not exists
                    let userIds = _.map(rankData, 'user_id');
                    let zopmatchId = parseInt(matchId);
                    let playerTeamRes = await OtherGamesPtc.find({ contest_id: ObjectId(roomId), zop_match_id: zopmatchId, user_id: { $in: userIds }, is_deleted: 0, winning_amount_distributed: 0 });

                    let matchContestData = await OtherGamesContest.findOne({ 'contest_id': ObjectId(roomId), sport: match_sport });
                    if(matchContestData && scores && matchContestData.contest && matchContestData.contest.contest_size && matchContestData.contest.contest_size == scores.length){
                        if (matchContestData && matchContestData._id && matchContestData.contest) {
                            let contestData = matchContestData.contest;
                            let contestType = contestData.contest_type;
                            if (contestType == "Paid" || (matchContestData.contest &&  matchContestData.contest.winning_amount>0) ) {
                                console.log("contestType*********",contestType,scores);
                                var playerContestData = playerTeamRes.filter(item => Number(item.winning_amount) == 0);
                                let breakup = contestData.breakup ? _.sortBy(contestData.breakup, ['startRank']) : [];
                                if (playerContestData && playerContestData.length > 0) {
                                    let transactionData = [];
                                    let finalScoreData = [];
                                    for (const contestTeam of playerContestData) {
                                        let oPTCuserItem = _.find(rankData, { user_id: contestTeam.user_id });
                                        if (oPTCuserItem && oPTCuserItem.user_id) {
                                            let rank = oPTCuserItem.rank ? oPTCuserItem.rank : 0;
                                            let score = oPTCuserItem.score ? oPTCuserItem.score : 0;
                                            let finalScoreDataObj = { rank: rank, score: score, sub: "" + oPTCuserItem.user_id, currencyIcon: "icon.png" };
                                            const txnId = (new Date()).getTime() + contestTeam.user_id;
    
                                            let rankDataGroup = rankData.reduce(function (rv, x) {
                                                (rv[x['rank']] = rv[x['rank']] || []).push(x);
                                                return rv;
                                            }, {});
                                            let win_amount = 0;
                                            let pricewin_amount = 0;
                                            let rankItem = breakup && breakup.length > 0 ? breakup.find((item) => oPTCuserItem.rank >= item.startRank && oPTCuserItem.rank <= item.endRank) : {};
                                            if (rankItem && breakup && breakup.length > 0) {
                                                let perTeamPrice = rankItem.price_each ? rankItem.price_each : 0;
                                                if (rankDataGroup.hasOwnProperty(rank) && perTeamPrice > 0) {
                                                    const priceGroup = rankDataGroup[rank];
                                                    const priceWin = perTeamPrice / priceGroup.length;
                                                    if (priceWin > 0){
                                                        let updatedUserData =   await User.findOneAndUpdate({ _id: oPTCuserItem.user_id }, { $inc: { winning_balance: parseFloat(priceWin) } },{new: true});
                                                        win_amount = priceWin;
                                                        pricewin_amount = priceWin;
                                                        transactionData.push({
                                                            "match_id": matchContestData.match_id, "contest_id": contestTeam.contest_id, "local_txn_id": txnId, "txn_date": new Date(), "txn_amount": pricewin_amount, "currency": "INR", "added_type": 4,
                                                            "status": 1,
                                                            "created": new Date(),
                                                            "sport": match_sport,
                                                            "user_id": oPTCuserItem.user_id,
                                                            "txn_id": "",
                                                            "details": {
                                                                "refund_winning_balance":priceWin,
                                                                "refund_cash_balance": 0,
                                                                "refund_bonus_amount": 0,
                                                                "refund_extra_amount": 0,
                                                                "refund_affiliate_amount": 0,
                                                                "current_winning_balance": updatedUserData && updatedUserData.winning_balance ? updatedUserData.winning_balance:0,
                                                                "current_cash_balance": updatedUserData && updatedUserData.cash_balance ? updatedUserData.cash_balance:0,
                                                                "current_bonus_amount": updatedUserData && updatedUserData.bonus_amount ? updatedUserData.bonus_amount:0,
                                                                "current_extra_amount": updatedUserData && updatedUserData.extra_amount ? updatedUserData.extra_amount:0,
                                                                "current_affiliate_amount":updatedUserData && updatedUserData.affiliate_amount ? updatedUserData.affiliate_amount:0,
                                                            }
                                                        });
                                                    } 
                                                    
                                                }
    
                                            }
                                            finalScoreDataObj['prize'] = pricewin_amount;
                                            finalScoreData.push(finalScoreDataObj);
                                            await OtherGamesPtc.updateOne({ _id: contestTeam._id }, { $set: { "price_win": pricewin_amount, "points": score, "winning_amount": win_amount, "rank": rank, "winning_amount_distributed": 1, "winning_amount_notification": 1 } });
                                        }
                                    }
                                    if (transactionData && transactionData.length > 0) {
    
                                        await OtherGameTransaction.insertMany(transactionData, { ordered: false });
                                    }
                                    await OtherGamesContest.updateOne({ contest_id: ObjectId(roomId) }, { $set: { is_distributed: 1 } });
                                    let response = {};
                                    response.success = true;
                                    response.scores = finalScoreData;
    
                                    return res.json(response);
                                } else {
                                    // already distributed and update score
                                    if (contestType == "Free"  && scores.length > 1 && (matchContestData.contest &&  matchContestData.contest.winning_amount>0) ) {
                                        console.log("check in freegive away*****",playerTeamRes);
                                       let responseData = await freegiveaway(match_sport,matchContestData,breakup,rankData,scores,roomId);
                                       return res.json(responseData);
                                     }else{
                                        console.log("check in else*****",playerTeamRes);
                                        response["success"] = false;
                                        response["scores"] = [];
                                        return res.json(response);
                                     }
                                }
                            } else {
                                console.log("tie status 6********************");
                                response.success = true;
                                let scoresData = scores.map(v => ({ ...v, prize: 0, currencyIcon: "icon.png" }))
                                response.scores = scoresData;
    
                                return res.json(response);
                            }
                        } else {
                            console.log("tie status 5********************");
                            response["success"] = false;
                            response["scores"] = [];
                            return res.json(response);
                        }
                    } else {
                        console.log("tie status 4********************");
                        response["success"] = false;
                        response["scores"] = [];
                        return res.json(response);
                    }
                    
                }

            } else {
                console.log("tie status 3********************");
                response["success"] = false;
                response["scores"] = [];
                return res.json(response);
            }
        } else {
            console.log("tie status 2********************");
            let response = {};
            response["success"] = false;
            response["message"] = "Wrong api key!!";
            return res.json(response);
        }

    } catch (error) {
       console.log("tie status********************");
        let response = {};
        response["success"] = false;
        response["scores"] = [];
        return res.json(response);
    }
}

async function cancelContestAtResult(zop_match_id, room_id) {
    const session = await startSession()
    session.startTransaction();
    try {
        let matchContest = await OtherGamesContest.findOne({ contest_id: ObjectId(room_id), zop_match_id: zop_match_id });
        if (matchContest && matchContest._id) {
            let otherPtc = await OtherGamesPtc.find({ contest_id: ObjectId(room_id), zop_match_id: zop_match_id, is_deleted: 0, winning_amount_distributed: 0 });
            if (otherPtc && otherPtc.length > 0) {
                let u_players =  _.map(otherPtc,'user_id');
                let playersIds = u_players.map(s => ObjectId(s));
                let userDataList = await User.find({ _id: { $in: playersIds } });
                let userArray = [];
                let transactionArray = [];
                let ptcDataArray = [];
                if (userDataList && userDataList.length > 0) {
                    for (const otherPtcItem of otherPtc) {
                        let singleUserDataItem = _.find(userDataList, { _id: otherPtcItem.user_id });
                        let jcd = otherPtcItem.join_contest_detail;
                        let bonousAmount = jcd && jcd.deduct_bonus_amount && jcd.deduct_bonus_amount > 0 ? jcd.deduct_bonus_amount : 0;
                        let cashAmount = jcd && jcd.deduct_deposit_cash && jcd.deduct_deposit_cash > 0 ? jcd.deduct_deposit_cash : 0;
                        let xtraAmount = jcd && jcd.deduct_extra_amount && jcd.deduct_extra_amount > 0 ? jcd.deduct_extra_amount : 0;
                        let winAmount = jcd && jcd.deduct_winning_amount && jcd.deduct_winning_amount > 0 ? jcd.deduct_winning_amount : 0;
                        let total_amount = jcd && jcd.total_amount && jcd.total_amount > 0 ? jcd.total_amount : 0;
    
                        let r_winning_balance = singleUserDataItem && singleUserDataItem['winning_balance'] ? singleUserDataItem['winning_balance'] + winAmount :0;
                        let r_cash_balance = singleUserDataItem && singleUserDataItem['cash_balance'] ? singleUserDataItem['cash_balance'] + cashAmount :0;
                        let r_bonus_balance = singleUserDataItem && singleUserDataItem['bonus_amount'] ? singleUserDataItem['bonus_amount'] + bonousAmount :0 ;
                        let r_extra_amount = singleUserDataItem && singleUserDataItem['extra_amount'] ? singleUserDataItem['extra_amount'] + xtraAmount:0 ;
    
                        ptcDataArray.push({
                            updateOne: {
                                "filter": { "_id": otherPtcItem._id },
                                "update": { $set: { is_deleted: 1 } }
                            }
                        });
                        userArray.push({
                            updateOne: {
                                "filter": { "_id": otherPtcItem.user_id },
                                "update": { $inc: { cash_balance: cashAmount, bonus_amount: bonousAmount, winning_balance: winAmount, extra_amount: xtraAmount } }
                            }
                        });
                        const txnId = (new Date()).getTime() + otherPtcItem.user_id;
                        let entity = {
                            user_id: otherPtcItem.user_id, contest_id: otherPtcItem.contest_id, match_id: matchContest.match_id, sport: 3, txn_amount: total_amount, currency: "INR",
                            retantion_amount: 0,
                            txn_date: Date.now(),
                            local_txn_id: txnId,
                            added_type: 6,
                            details: {
                                "refund_winning_balance":(winAmount ? winAmount : 0),
                                "refund_cash_balance": (cashAmount ? cashAmount : 0),
                                "refund_bonus_amount": (bonousAmount ? bonousAmount : 0),
                                "refund_extra_amount": (xtraAmount ? xtraAmount : 0),
                                "refund_affiliate_amount": 0,
                                "current_winning_balance": r_winning_balance ? r_winning_balance:0,
                                "current_cash_balance": r_cash_balance ? r_cash_balance:0,
                                "current_bonus_amount": r_bonus_balance ? r_bonus_balance:0,
                                "current_extra_amount": r_extra_amount ? r_extra_amount:0,
                                "current_affiliate_amount":singleUserDataItem && singleUserDataItem.affiliate_amount ? singleUserDataItem.affiliate_amount:0,
                            }
                        };
                        transactionArray.push(entity);
    
                    }
                    if (userArray && userArray.length > 0 && transactionArray && transactionArray.length > 0 && ptcDataArray && ptcDataArray.length > 0) {
                        await User.bulkWrite(userArray, { session: session });
                        await OtherGameTransaction.create(transactionArray, { session: session });
                        await OtherGamesPtc.bulkWrite(ptcDataArray, { session: session });
                        await OtherGamesContest.updateOne({ contest_id: ObjectId(room_id) }, { $set: { is_cancelled: 1 } }, { session: session });
                        await session.commitTransaction();
                        session.endSession();
    
                    } else {
    
                        await session.abortTransaction();
                        session.endSession();
                    }
                }{

                    await session.abortTransaction();
                    session.endSession();
                }
                
            } else {

                await session.abortTransaction();
                session.endSession();
            }
        } else {

            await OtherGameLudoLogs.create({ error_txt: "contest cancel at result-matchContest data not found", room_id: room_id });
            await session.abortTransaction();
            session.endSession();
        }
    } catch (errorSession) {

        let error = "contest cancel at result-" + errorSession;
        await OtherGameLudoLogs.create({ error_txt: error, room_id: room_id });
        await session.abortTransaction();
        session.endSession();

    }

}

async function freegiveaway(match_sport,matchContestData,breakup,rankData,scores,roomId){
    let finalScoreData = [];
    let transactionData = [];
    for (const contestTeam of scores) {
        let oPTCuserItem = _.find(rankData, { user_id: ObjectId(contestTeam.sub)});
        if (oPTCuserItem && oPTCuserItem.user_id) {
            let rank = oPTCuserItem.rank ? oPTCuserItem.rank : 0;
            let score = oPTCuserItem.score ? oPTCuserItem.score : 0;
            let finalScoreDataObj = { rank: rank, score: score, sub: "" + oPTCuserItem.user_id, currencyIcon: "icon.png" };
            const txnId = (new Date()).getTime() + contestTeam.sub;

            let rankDataGroup = rankData.reduce(function (rv, x) {
                (rv[x['rank']] = rv[x['rank']] || []).push(x);
                return rv;
            }, {});
            let win_amount = 0;
            let pricewin_amount = 0;
            let rankItem = breakup && breakup.length > 0 ? breakup.find((item) => oPTCuserItem.rank >= item.startRank && oPTCuserItem.rank <= item.endRank) : {};
            if (rankItem && breakup && breakup.length > 0) {
                let perTeamPrice = rankItem.price_each ? rankItem.price_each : 0;
                if (rankDataGroup.hasOwnProperty(rank) && perTeamPrice > 0) {
                    const priceGroup = rankDataGroup[rank];
                    const priceWin = perTeamPrice / priceGroup.length;
                    if (priceWin > 0){
                        let updatedUserData =   await User.findOneAndUpdate({ _id: oPTCuserItem.user_id }, { $inc: { winning_balance: parseFloat(priceWin) } },{new: true});
                      
                        win_amount = priceWin;
                        pricewin_amount = priceWin;
                        transactionData.push({
                            "match_id": matchContestData.match_id, "contest_id": roomId, "local_txn_id": txnId, "txn_date": new Date(), "txn_amount": pricewin_amount, "currency": "INR", "added_type": 4,
                            "status": 1,
                            "created": new Date(),
                            "sport": match_sport,
                            "user_id": oPTCuserItem.user_id,
                            "txn_id": "",
                            "details": {
                                "refund_winning_balance":priceWin,
                                "refund_cash_balance": 0,
                                "refund_bonus_amount": 0,
                                "refund_extra_amount": 0,
                                "refund_affiliate_amount": 0,
                                "current_winning_balance": updatedUserData && updatedUserData.winning_balance ? updatedUserData.winning_balance:0,
                                "current_cash_balance": updatedUserData && updatedUserData.cash_balance ? updatedUserData.cash_balance:0,
                                "current_bonus_amount": updatedUserData && updatedUserData.bonus_amount ? updatedUserData.bonus_amount:0,
                                "current_extra_amount": updatedUserData && updatedUserData.extra_amount ? updatedUserData.extra_amount:0,
                                "current_affiliate_amount":updatedUserData && updatedUserData.affiliate_amount ? updatedUserData.affiliate_amount:0,
                            }
                        });
                    } 
                    
                }

            }
            finalScoreDataObj['prize'] = pricewin_amount;
            finalScoreData.push(finalScoreDataObj);
        }
    }
    if (transactionData && transactionData.length > 0) {
        await OtherGameTransaction.insertMany(transactionData, { ordered: false });
    }
    await OtherGamesContest.updateOne({ contest_id: ObjectId(roomId) }, { $set: { is_distributed: 1 } });
    let response = {};
    response.success = true;
    response.scores = finalScoreData;
    return response;
}

