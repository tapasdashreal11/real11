const Users = require("../../../models/user");
const Transaction = require('../../../models/transaction');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const { TransactionTypes } = require('../../../constants/app');
const { startSession } = require('mongoose');

module.exports = async (req, res) => {
  	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        let params = req.body;
        let userId = req.userId;
		let constraints = { affil_amount: "required" };
		let validator = new Validator(params, constraints);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields are Empty.";
			response["errors"] = validator.errors;
			return res.json(response);
		}
		let pram_affi_amount = params && params.affil_amount ? parseFloat(params.affil_amount) : 0;
		if(pram_affi_amount < 1){
			response["message"] = "You are under supervision of admin.Please don't do this activity!!";
			return res.json(response);
        }
        const session = await startSession()
        session.startTransaction();
        const sessionOpts = { session, new: true };
		try {
            let user = await Users.findOne({ _id: userId },{_id:1,affiliate_amount:1,is_youtuber:1});
            let user_affil_amount = user.affiliate_amount ?parseFloat(user.affiliate_amount): 0
			if (user && pram_affi_amount >= 1 && user_affil_amount >= pram_affi_amount && user.is_youtuber && user.is_youtuber == 1) {
               let userWalletUpdate = await Users.findOneAndUpdate({ _id: userId },{$inc:{affiliate_amount:-pram_affi_amount,cash_balance:pram_affi_amount}},sessionOpts);
               if(userWalletUpdate){
                    await transAtAffilateMoneyTranser(userId,pram_affi_amount,session,userIp,userWalletUpdate);
                    await session.commitTransaction();
                    session.endSession();
                    response["status"] = true;
                    response["message"] = "Amount Transferred Successfully!!";
                    return res.json(response);
                 } else {
                    await session.abortTransaction();
                    session.endSession();
                    response["message"] = "Something went wrong!";
                    return res.json(response);
                 }
			} else {
                await session.abortTransaction();
                session.endSession();
				response["message"] = user && user.is_youtuber ? "Invalid Amount": "Invalid User.";
				return res.json(response);
			}
		} catch (err) {
            await session.abortTransaction();
            session.endSession();
			response["message"] = "Something went wrong!!";
			return res.json(response);
		}
	} catch (error) {
		logger.error("Youtuber win trans error", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};

/**
 * This is used to generate transaction for transfer affilate amonut into deposit
 * @param {*} userId 
 * @param {*} affi_amount 
 * @param {*} session 
 * @param {*} userIp 
 */
async function transAtAffilateMoneyTranser(userId,affi_amount,session,userIp,userWalletUpdate){
	let date = new Date();
	let transaction_data =[
		{
			user_id: userId,
			txn_amount: affi_amount,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
            added_type: TransactionTypes.AFFIL_AMOUNT_AT_DEPOST,
			ip_address : userIp ? userIp : "",
			details: {
				"refund_winning_balance":0,
				"refund_cash_balance": affi_amount,
				"refund_bonus_amount": 0,
				"refund_extra_amount": 0,
				"refund_affiliate_amount": 0,
				"current_winning_balance": userWalletUpdate && userWalletUpdate.winning_balance ? userWalletUpdate.winning_balance:0,
				"current_cash_balance": userWalletUpdate && userWalletUpdate.cash_balance ? userWalletUpdate.cash_balance:0,
				"current_bonus_amount": userWalletUpdate && userWalletUpdate.bonus_amount ? userWalletUpdate.bonus_amount:0,
				"current_extra_amount": userWalletUpdate && userWalletUpdate.extra_amount ? userWalletUpdate.extra_amount:0,
				"current_affiliate_amount":userWalletUpdate && userWalletUpdate.affiliate_amount ? userWalletUpdate.affiliate_amount:0,
			}
		},
		{
			user_id: userId,
			txn_amount: affi_amount,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
            added_type: TransactionTypes.AFFIL_AMOUNT_WITHDRAWAL_FOR_DEPOST,
			ip_address : userIp ? userIp : "",
			details: {
				"refund_winning_balance":0,
				"refund_cash_balance": 0,
				"refund_bonus_amount": 0,
				"refund_extra_amount": 0,
				"refund_affiliate_amount": affi_amount,
				"current_winning_balance": userWalletUpdate && userWalletUpdate.winning_balance ? userWalletUpdate.winning_balance:0,
				"current_cash_balance": userWalletUpdate && userWalletUpdate.cash_balance ? userWalletUpdate.cash_balance:0,
				"current_bonus_amount": userWalletUpdate && userWalletUpdate.bonus_amount ? userWalletUpdate.bonus_amount:0,
				"current_extra_amount": userWalletUpdate && userWalletUpdate.extra_amount ? userWalletUpdate.extra_amount:0,
				"current_affiliate_amount":userWalletUpdate && userWalletUpdate.affiliate_amount ? userWalletUpdate.affiliate_amount:0,
			}
		}
	]
	await Transaction.create(transaction_data,{ session: session });
}