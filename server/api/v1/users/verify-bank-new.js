const Users = require("../../../models/user");
const Transaction = require("../../../models/transaction");
const BankDetails = require("../../../models/user-bank-details");
const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac");
const logger = require("../../../../utils/logger")(module);
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const config = require('../../../config');
const request = require('request');
const _ = require('lodash');
const ModelService = require("../../ModelService");
const { TransactionTypes } = require('../../../constants/app');
const { razopayFundAccount } = require("./razopay-contact-fund-ac.js");

module.exports = async (req, res) => {
	try {
		console.log("enter to bank verify")
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			account_no: "required",
			bank_name: "required",
			branch: "required",
			ifsc_code: "required"
		};

		let validator = new Validator(params, constraints);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields missing !";
			response["errors"] = validator.errors;
			return res.json(response);
		}

		try {
			let userId = req.userId;
			let user = await Users.findOne({ _id: userId });
			if (user) {
				bankVerificationToken(params, function(resToken) {
					console.log(resToken.token)
					if(resToken.status == true && resToken.token) {
						bankVerification(params, user.phone, resToken.token, async function(veriyRes) {
							console.log("ddddd", veriyRes);
							let bankDetail = await BankDetails.findOne({ user_id: userId });
							let updatedData = {};
							updatedData.account_number = params.account_no || null;
							updatedData.ifsc_code = params.ifsc_code || null;
							updatedData.bank_name = params.bank_name || null;
							updatedData.branch = params.branch || null;
							updatedData.beneficiary_id = null;
							updatedData.user_id = userId;
							if (params.image) {
								updatedData.bank_image = params.image;
							}
							if (!bankDetail) {
								await BankDetails.create(updatedData);
							} else {
								const result = await BankDetails.updateOne({ user_id: user._id }, { $set: updatedData });
							}
							let currentDate = Date.now();

							await (new ModelService()).referalManageAtVerification(userId,false,false,true);
							let typeOfReward = TransactionTypes.FRIEND_BANK_VERIFY_XCASH_REWARD;
							await (new ModelService()).referalxCashRewardAtBankVerify(userId,typeOfReward,10);
							if(user && user.bank_xtra_amount === 0){
								await transactionAtBankVerfiy(userId);
							}
							
							const userResult =	await Users.updateOne({ _id: userId }, { $set: { bank_account_verify: 2, bank_request_date: currentDate, change_bank_req:false } });
							if (userResult && userResult.nModified > 0) {
								console.log('enter 1');
								let fundAcount	=	await UserRazopayFundAc.findOne({user_id:user._id});
								if(!_.isEmpty(fundAcount) && fundAcount.change_bank_req_accept == true) {
									// console.log(fundAcount);
									let userBankDeatail	=	await BankDetails.findOne({ user_id: userId })
									if(!_.isEmpty(userBankDeatail)) {
										let fundAccount = {
											"account_type": "bank_account",
											"contact_id": fundAcount.contact_id,
											"bank_account": {
												"name": user.first_name,
												"ifsc": userBankDeatail.ifsc_code,
												"account_number": userBankDeatail.account_number,
											}
										};
										let userFundRes = await razopayFundAccount(fundAccount);
										console.log(userFundRes);
										if (userFundRes && userFundRes.id) {
											await UserRazopayFundAc.updateOne({user_id:userId, contact_id:fundAcount.contact_id},{$set: {change_bank_req_accept: false, fund_account_id: userFundRes.id, old_func_account_id: fundAcount.fund_account_id }});
										}
									}
								}
							}
							response["message"] = "Bank detail updated successfully.";
							response["status"] = true;
							response["data"] = updatedData;
							return res.json(response);
						});
					} else {
						response["message"] = "Something went wrong!!";
						return res.json({response});
					}
				});
			} else {
				response["message"] = "Invalid User id.";
				return res.json(response);
			}
		} catch (err) {
			console.log('catch', err);
			response["msg"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		console.log('bank verify catch >> ', error)
		logger.error("LOGIN_ERROR", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};

async function transactionAtBankVerfiy(userId) {
	let date = new Date();
	let transaction_data = [
		{
			user_id: userId,
			txn_amount: 10,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
			added_type: TransactionTypes.USER_BANK_VERIFY_XCASH_REWARD
		}
	]
	await Transaction.create(transaction_data);
	await Users.updateOne({ _id: userId }, { $inc: { extra_amount: 10 }, $set: {bank_xtra_amount:1 }});
}

async function bankVerificationToken(bankData, cb) {
	if (!_.isEmpty(bankData)) {
		var options = {
			"method": "POST",
			"url": config.BANK_VERIFY_API.URL + "payout/v1/authorize",
			"headers": { 'X-Client-Id': process.env.CASHFREE_CLIENT_ID, 'X-Client-Secret': process.env.CASHFREE_CLIENT_SECRET },
		};
		request(options, function (error, res, body) {
			if (error) throw new Error(error);
			let bodyRes	=	JSON.parse(body)
			console.log("bodyRes",bodyRes);
			if(bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.token) {
				cb({"status":true,token:bodyRes.data.token});
			} else {
				cb({"status":false});
			}
		});
	} else {
		cb({"status":false});
	}
}

async function bankVerification(bankData, phoneNo, token, cb) {
	// console.log(bankData.account_holder_name);
	// return false;
	if (!_.isEmpty(bankData) && !_.isEmpty(token)) {
		var options = {
			"method": "GET",
			"url": config.BANK_VERIFY_API.URL + "payout/v1/asyncValidation/bankDetails?name=" + bankData.account_holder_name + "&phone=" + phoneNo + "&bankAccount=" + bankData.account_no + "&ifsc=" + bankData.ifsc_code,
			"headers": { 'Accept': "application/json", 'Authorization': "Bearer "+token },
		};
		console.log(options);
		request(options, function (error, res, body) {
			if (error) throw new Error(error);
			let bodyRes	=	JSON.parse(body)
			// console.log(bodyRes);
			if(bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.accountExists && bodyRes.data.accountExists == "YES") {
				cb({"status":true,token:bodyRes.data.bvRefId});
			} else {
				cb({"status":false});
			}
		});
	} else {
		cb({"status":false});
	}
}