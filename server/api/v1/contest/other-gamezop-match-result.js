const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const ObjectId = require('mongoose').Types.ObjectId;
const OtherGameTransaction = require('../../../models/other-games-transaction');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const { Validator } = require("node-input-validator");
const { startSession } = require('mongoose');
const moment = require('moment');

module.exports = async (req, res) => {
    try {
        const { roomId, matchId, scores } = req.body;
        console.log('roomId', roomId, 'scores', scores, 'matchId', matchId);
        let response = {};
        let constraints = { roomId: "required", matchId: "required", scores: "required" };
        var apiKey = req.headers['api-key'];
        let validator = new Validator(req.body, constraints);
        let matched = await validator.check();
        let decoded = { match_id: 111 };
        let match_sport = 3;
        if(scores && scores.length ==0 &&roomId && matchId ){
            console.log('in***');
            let zop_match_id = parseInt(matchId);
            await cancelContestAtResult(zop_match_id,roomId);
            response["success"] = false;
            response["scores"] = [];
            return res.json(response);

        } else {
            if (!matched) {
                response["success"] = false;
                response["scores"] = [];
                return res.json(response);
            }
        }
        
        let rankData = scores.map(s => {
            return { rank: s.rank, user_id: ObjectId(s.sub), score: s.score }
        });
        if (_.isEqual(apiKey, config.gamezop_api_key)) {
            if (rankData && rankData.length > 0) {
                let userIds = _.map(rankData, 'user_id');
                let zopmatchId = parseInt(matchId);
                let playerTeamRes = await OtherGamesPtc.find({ contest_id: ObjectId(roomId), zop_match_id: zopmatchId, user_id: { $in: userIds }, is_deleted: 0, winning_amount_distributed: 0 });

                let matchContestData = await OtherGamesContest.findOne({ 'contest_id': ObjectId(roomId), sport: match_sport });
                if (matchContestData && matchContestData._id && matchContestData.contest) {
                    let contestData = matchContestData.contest;
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
                                        if (priceWin > 0) await User.updateOne({ _id: oPTCuserItem.user_id }, { $inc: { winning_balance: parseFloat(priceWin) } })
                                        win_amount = priceWin;
                                        pricewin_amount = priceWin;
                                        transactionData.push({
                                            "match_id": decoded['match_id'], "contest_id": contestTeam.contest_id, "local_txn_id": txnId, "txn_date": new Date(), "txn_amount": pricewin_amount, "currency": "INR", "added_type": 4,
                                            "status": 1,
                                            "created": new Date(),
                                            "sport": match_sport,
                                            "user_id": oPTCuserItem.user_id,
                                            "txn_id": "",
                                        });
                                    }

                                }
                                finalScoreDataObj['prize'] = pricewin_amount;
                                finalScoreData.push(finalScoreDataObj);
                                await OtherGamesPtc.updateOne({ _id: contestTeam._id }, { $set: { "price_win": pricewin_amount, "points": score, "winning_amount": win_amount, "rank": rank, "winning_amount_distributed": 1, "winning_amount_notification": 1 } });
                            }
                        }
                        if (transactionData && transactionData.length > 0) {
                            console.log("***transactionData", transactionData);
                            await OtherGameTransaction.insertMany(transactionData, { ordered: false });
                        }
                        await OtherGamesContest.updateOne({ contest_id: ObjectId(roomId) }, { $set: { is_distributed: 1 } });
                        let response = {};
                        response.success = true;
                        response.scores = finalScoreData;
                        console.log('response', response);
                        return res.json(response);
                    } else {
                        // already distributed and update score
                        console.log('data in result match for playerContestData******', rankData);
                        response["success"] = false;
                        response["scores"] = [];
                        return res.json(response);
                    }
                } else {
                    console.log('data in result match for matchContestData******', rankData);
                    response["success"] = false;
                    response["scores"] = [];
                    return res.json(response);
                }

            } else {
                console.log('data in result match for else******');
                response["success"] = false;
                response["scores"] = [];
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
        console.log("error", error);
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
                let userArray = [];
                let transactionArray = [];
                let ptcDataArray = [];
                for (const otherPtcItem of otherPtc) {
                    let bonousAmount = otherPtcItem.deduct_bonus_amount && otherPtcItem.deduct_bonus_amount > 0 ? otherPtcItem.deduct_bonus_amount : 0;
                    let cashAmount = otherPtcItem.deduct_deposit_cash && otherPtcItem.deduct_deposit_cash > 0 ? otherPtcItem.deduct_deposit_cash : 0;
                    let xtraAmount = otherPtcItem.deduct_extra_amount && otherPtcItem.deduct_extra_amount > 0 ? otherPtcItem.deduct_extra_amount : 0;
                    let winAmount = otherPtcItem.deduct_winning_amount && otherPtcItem.deduct_winning_amount > 0 ? otherPtcItem.deduct_winning_amount : 0;
                    let total_amount = otherPtcItem.total_amount && otherPtcItem.total_amount > 0 ? otherPtcItem.total_amount : 0;
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
                        user_id: otherPtcItem.user_id, contest_id: otherPtcItem.contest_id, match_id: 111, sport: 3, txn_amount: total_amount, currency: "INR",
                        retantion_amount: 0,
                        txn_date: Date.now(),
                        local_txn_id: txnId,
                        added_type: 6
                    };
                    transactionArray.push(entity);

                }
                if (userArray && userArray.length > 0 && transactionArray && transactionArray.length > 0 && ptcDataArray && ptcDataArray.length > 0) {
                    await User.bulkWrite(userArray, { session: session });
                    await OtherGameTransaction.insertMany(transactionArray, { session: session });
                    await OtherGamesPtc.bulkWrite(ptcDataArray, { session: session });
                    await OtherGamesContest.updateOne({ contest_id: ObjectId(room_id) }, { $set: { is_cancelled: 1 } }, { session: session });
                    await session.commitTransaction();
                    session.endSession();
                    console.log("in result ludo cancel contest Success****", room_id);
                } else {
                    console.log("in result ludo cancel contest not work for****", room_id);
                    await session.commitTransaction();
                    session.endSession();
                }
            } else {
                console.log('in result Ludo cancel contest in else****', room_id);
                await session.abortTransaction();
                session.endSession();
            }
        }else{
            console.log('result in catch at contest cancel****', errorSession);
             await session.abortTransaction();
            session.endSession();
        }
    } catch (errorSession) {
        console.log('sessionError in catch at contest cancel****', errorSession);
        await session.abortTransaction();
        session.endSession();
    }

}



