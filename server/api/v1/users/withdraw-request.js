const { ObjectId } = require('mongodb');
const Users = require("../../../models/user");
const Transaction = require('../../../models/transaction');
const WithdrawRequest = require("../../../models/withdraw_requests");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const { TransactionTypes } = require('../../../constants/app');

module.exports = async (req, res) => {
  	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			withdraw_amount: "required",
			type: "required"
		};

		let validator = new Validator(params, constraints);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields are Empty.";
			response["errors"] = validator.errors;
			return res.json(response);
		}
		
		try {
			let userId = req.userId;
		
			let user = await Users.findOne({ _id: userId });
			if (user) {
				let winning_balance = user.winning_balance || 0;
				let affiliate_amount = user.affiliate_amount || 0;
				let isInstant = (user.instant_withdraw == 1 || params.withdraw_amount >= 10000) ? 1 : 0; 
				// console.log(affiliate_amount);return false;
				// console.log('winning_balance',winning_balance);
				if(params.wallet_type && params.wallet_type == 'affliate') {
					if (params.withdraw_amount > affiliate_amount) {
						response["status"] = false;
						response["data"] = {};
						response["message"] = "The amount you have entered is more than your total available winnings for withdrawal, please enter a realistic amount.";
						return res.json(response);
					} else {
						let updatedData = {};
						let remainingAmount	=	affiliate_amount - params.withdraw_amount;
						updatedData.amount =	remainingAmount;
						updatedData.refund_amount = params.withdraw_amount || '';
						updatedData.user_id = userId;
						updatedData.type = params.type || '';
						updatedData.email = user.email || '';
						updatedData.wallet_type = params.wallet_type || '';
						updatedData.is_instant = isInstant;
						// console.log(remainingAmount);
						
						// let result =  await Users.update({_id: userId}, {$set : {affiliate_amount : remainingAmount}});
						let result =  await Users.update({_id: userId}, {$inc : {affiliate_amount : -params.withdraw_amount}});
						if(result) {
							let withdrawData =  await WithdrawRequest.create(updatedData);
							let date = new Date();
							let joinContestTxnId	=	'JL'+ date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
							let txnId = joinContestTxnId;
							let status = TransactionTypes.TRANSACTION_PENDING;
							let txnAmount = params.withdraw_amount;
							let withdrawId = withdrawData._id;
							
							await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
						}
						response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
						response["status"] = true;
						response["data"] = {};
						return res.json(response);
					}
				} else {
					if (params.withdraw_amount > winning_balance) {
						response["status"] = false;
						response["data"] = {};
						response["message"] = "The amount you have entered is more than your total available winnings for withdrawal, please enter a realistic amount.";
						return res.json(response);
					} else {
						let updatedData = {};
						let remainingAmount	=	winning_balance - params.withdraw_amount;
						updatedData.amount =	remainingAmount;
						updatedData.refund_amount = params.withdraw_amount || '';
						updatedData.user_id = userId;
						updatedData.type = params.type || '';
						updatedData.email = user.email || '';
						updatedData.wallet_type = '';
						updatedData.is_instant = isInstant;
						// console.log(remainingAmount);
						
						// let result =  await Users.update({_id: userId}, {$set : {winning_balance : remainingAmount}});
						let result =  await Users.update({_id: userId}, {$inc : {winning_balance : -params.withdraw_amount}});
						if(result) {
							let withdrawData =  await WithdrawRequest.create(updatedData);
							let date = new Date();
							let joinContestTxnId	=	'JL'+ date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
							let txnId = joinContestTxnId;
							let status = TransactionTypes.TRANSACTION_PENDING;
							let txnAmount = params.withdraw_amount;
							let withdrawId = withdrawData._id;
							
							await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
						}
						response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
						response["status"] = true;
						response["data"] = {};
						return res.json(response);
					}
				}

			} else {
				response["message"] = "Invalid User id.";
				return res.json(response);
			}

		} catch (err) {
			response["message"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		logger.error("LOGIN_ERROR", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};
