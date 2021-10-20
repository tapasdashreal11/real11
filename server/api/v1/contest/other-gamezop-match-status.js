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

module.exports = async (req, res) => {
    try {
        const {roomId, status, players} = req.body;
        let response = {};
        let constraints = { roomId: "required", status: "required",players: "required" };
        let validator = new Validator(req.body, constraints);
        let matched = await validator.check();
        var apiKey = req.headers['api-key']; 
        let decoded = { match_id: 111 };
        let match_sport = 3;
        if (!matched) {
            response["success"] = false;
            response["matchId"] = "";
            return res.json(response);
        }
        if(_.isEqual(apiKey,config.gamezop_api_key)){
            let playersIds = players.map(s => ObjectId(s));
            let ptcData = await OtherGamesPtc.find({contest_id:ObjectId(roomId),user_id:{$in:playersIds},is_deleted:0});
            if(status=='MATCH_FOUND'){
                
                 if(ptcData && ptcData.length>0){
                    if(ptcData.length == playersIds.length ){
                        let zop_match_id = await generateZopMatchId();
                        response["success"] = true;
                        response["matchId"] = zop_match_id;
                         await OtherGamesPtc.updateMany({contest_id:ObjectId(roomId),user_id:{$in:playersIds},is_deleted:0},{$set:{zop_match_id:zop_match_id}});
                        return res.json(response);
                    } else {
                        await refundAmountProcess(ptcData,decoded,roomId,match_sport);
                        response["success"] = true;
                        response["matchId"] = "";
                        return res.json(response);
                    }
                 } else {
                    response["success"] = false;
                    response["matchId"] = "";
                    return res.json(response);
                 }
            } else if(status=='NO_MATCH_FOUND'){
                console.log("enter refund****");
                await refundAmountProcess(ptcData,decoded,roomId,match_sport);
                response["success"] = true;
                response["matchId"] = "";
                return res.json(response);
            }
        }else {
            let response = {};
            response["success"] = false;
            response["message"] = "Wrong api key!!";
            return res.json(response);
        }
        
    } catch (error) {
        let response = {};
        console.log("error",error);
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


async function refundAmountProcess(ptcData,decoded,roomId,match_sport){
    if(ptcData && ptcData.length>0){
        let transactionData = [];
        let joineduser = ptcData.length ? ptcData.length : 0
        const doc = await OtherGamesContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'joined_users': { $gt: 0 }, 'contest_id': ObjectId(roomId) }, { $inc: { joined_users: -joineduser }, $set: { is_full: 0 } });
        for (const ptcItems of ptcData) {
            let ptcItem = JSON.parse(JSON.stringify(ptcItems));
            const txnId = (new Date()).getTime() + ptcItem.user_id;
            await OtherGamesPtc.updateOne({ _id: ptcItem._id }, { $set: { is_deleted: 1 } });
            console.log('ptcItem.join_contest_detail****',ptcItem);
            let refundAmount = ptcItem.join_contest_detail && ptcItem.join_contest_detail.total_amount ? ptcItem.join_contest_detail.total_amount : 0;
            console.log('refundAmount pooo****',refundAmount);
            if (refundAmount > 0) {
                console.log('refundAmount****',refundAmount);
                transactionData.push({
                    "match_id": decoded['match_id'], "contest_id": ptcItem.contest_id, "local_txn_id": txnId, "txn_date": new Date(), "txn_amount": refundAmount, "currency": "INR", "added_type": 6,
                    "status": 1,
                    "created": new Date(),
                    "user_id": ptcItem.user_id,
                    "txn_id": "",
                }); 
                let deduct_winning_amount = ptcItem.join_contest_detail && ptcItem.join_contest_detail.deduct_winning_amount ? ptcItem.join_contest_detail.deduct_winning_amount : 0;
                let deduct_bonus_amount = ptcItem.join_contest_detail && ptcItem.join_contest_detail.deduct_bonus_amount ? ptcItem.join_contest_detail.deduct_bonus_amount : 0;
                let deduct_deposit_cash = ptcItem.join_contest_detail && ptcItem.join_contest_detail.deduct_deposit_cash ? ptcItem.join_contest_detail.deduct_deposit_cash : 0;
                let deduct_extra_amount = ptcItem.join_contest_detail && ptcItem.join_contest_detail.deduct_extra_amount ? ptcItem.join_contest_detail.deduct_extra_amount : 0;
                await User.updateOne({ _id: ptcItem.user_id }, { $inc: { extra_amount: parseFloat(deduct_extra_amount), cash_balance: parseFloat(deduct_deposit_cash), bonus_amount: parseFloat(deduct_bonus_amount), winning_balance: parseFloat(deduct_winning_amount) } });
                console.log('transactionData in****',transactionData);
            }
        }
        if(transactionData && transactionData.length>0){
            console.log("***transactionData",transactionData);
            await OtherGameTransaction.insertMany(transactionData, { ordered: false });
        }
    }
}

