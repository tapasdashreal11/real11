const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGameTransaction = require('../../../models/other-games-transaction');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const ObjectId = require('mongoose').Types.ObjectId;
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const ludoMqtt = require('../../../../lib/ludo-mqtt');
const { startSession } = require('mongoose');

module.exports = async (req, res) => {
    try {
        let data1 = {};
        const user_id = req.userId;
        const { contest_id, match_id, sport, ptc_id } = req.body;
        let match_sport = sport ? parseInt(sport) : 3;
        let decoded = { match_id: parseInt(match_id),contest_id: contest_id,user_id: user_id };

        if (contest_id && match_id && user_id) {
            let ptcItem = await OtherGamesPtc.findOne({ _id: ptc_id });
            if (ptcItem && ptcItem._id) {
                const session = await startSession()
                session.startTransaction();
                const sessionOpts = { session, new: true };
                try {

                    const doc = await OtherGamesContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'is_full': 0, 'sport': match_sport, 'joined_users': { $gt: 0 }, 'contest_id': contest_id }, { $inc: { joined_users: -1 }, $set: { is_full: 0 } }, { session: session });
                    if (doc) {
                        const txnId = (new Date()).getTime() + user_id;
                        await OtherGamesPtc.updateOne({ _id: ptc_id }, { $set: { is_deleted: 1 } }, { session: session });
                        let refundAmount = ptcItem.join_contest_detail & ptcItem.join_contest_detail.total_amount ? ptcItem.join_contest_detail.total_amount : 0;
                        if (refundAmount > 0) {
                            await setTransactionAtContestCancel(decoded['match_id'], contest_id, txnId, refundAmount, user_id, session);
                            let deduct_winning_amount = ptcItem.join_contest_detail & ptcItem.join_contest_detail.deduct_winning_amount ? ptcItem.join_contest_detail.deduct_winning_amount : 0;
                            let deduct_bonus_amount = ptcItem.join_contest_detail & ptcItem.join_contest_detail.deduct_bonus_amount ? ptcItem.join_contest_detail.deduct_bonus_amount : 0;
                            let deduct_deposit_cash = ptcItem.join_contest_detail & ptcItem.join_contest_detail.deduct_deposit_cash ? ptcItem.join_contest_detail.deduct_deposit_cash : 0;
                            let deduct_extra_amount = ptcItem.join_contest_detail & ptcItem.join_contest_detail.deduct_extra_amount ? ptcItem.join_contest_detail.deduct_extra_amount : 0;
                            await User.updateOne({ _id: user_id }, { $inc: { extra_amount: parseFloat(deduct_extra_amount), cash_balance: parseFloat(deduct_deposit_cash), bonus_amount: parseFloat(deduct_bonus_amount), winning_balance: parseFloat(deduct_winning_amount) } }, { session: session });
                            await session.commitTransaction();
                            session.endSession();
                        } else {
                            await session.commitTransaction();
                            session.endSession();
                        }

                        return res.send(ApiUtility.success(data1, 'Contest cancel successfully.'));
                    } else {
                        console.log('in elase');
                        await session.abortTransaction();
                        session.endSession();
                        return res.send(ApiUtility.failed("Something went wrong!!"));

                    }
                } catch (errorr) {
                    let response = {};
                    console.log('errorr in ludo contest cancel', errorr)
                    await session.abortTransaction();
                    session.endSession();
                    response.status = false;
                    response.message = 'Something went wrong!!';
                    response.error_code = null;
                    return res.json(response);
                } finally {
                    session.endSession();
                }
            }
        } else {
            return res.send(ApiUtility.failed("Invalid Request!!"));
        }
    } catch (error) {
        console.log(error);
        return res.send(ApiUtility.failed('Something went wrong!!'));
    }
}

/**
 * set transaction at contest cancel
 * @param {*} match_id 
 * @param {*} contest_id 
 * @param {*} txnId 
 * @param {*} amount 
 * @param {*} user_id 
 * @param {*} session 
 */
async function setTransactionAtContestCancel(match_id, contest_id, txnId, amount, user_id, session) {
    await OtherGameTransaction.create([{
        "match_id": match_id, "contest_id": contest_id, "local_txn_id": txnId, "txn_date": new Date(), "txn_amount": amount, "currency": "INR", "added_type": 6,
        "status": 1,
        "created": new Date(),
        "user_id": user_id,
        "txn_id": "",
    }], { session: session });
}