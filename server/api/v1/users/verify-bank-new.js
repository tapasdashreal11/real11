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
			let instant_verification_free = true;
			let user = await Users.findOne({ _id: userId ,bank_account_verify:0});
			let userCashbalance = user.cash_balance ? user.cash_balance : 0;
			let userWinBalance = user.winning_balance ? user.winning_balance : 0;
			let totalBalance = userCashbalance + userWinBalance;
			let isInstantVerfy = params && params.is_instant_verify && params.is_instant_verify == 1 ? true : false;
			if (user && isInstantVerfy) {
				// user instatnt bank verfication and check balance before verification
				if (totalBalance >= 2 || instant_verification_free) {
					let remainingFee = 2;
					let cashAmount = 0;
					let winAmount = 0;
					if (userCashbalance) {
						cashAmount = (userCashbalance > remainingFee) ? remainingFee : userCashbalance;
						remainingFee = (userCashbalance < remainingFee) ? remainingFee - userCashbalance : 0;
					}
					if (remainingFee) {
						winAmount = (userWinBalance > remainingFee) ? remainingFee : userWinBalance;
						remainingFee = (userWinBalance < remainingFee) ? remainingFee - userWinBalance : 0;
					}
					let totalDeductedAmount = cashAmount + winAmount;
					if (totalDeductedAmount == 2 || instant_verification_free) {
						bankVerificationToken(params, function (resToken) {
							console.log(resToken.token)
							if (resToken.status == true && resToken.token) {
								bankVerification(params, user.phone, resToken.token, async function (veriyRes) {
									console.log("ddddd", veriyRes);
									if (veriyRes && veriyRes.status == true) {

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
                                        // This reward goes to refered by user. Now this is stop
										//await (new ModelService()).referalManageAtVerification(userId, false, false, true);
										let typeOfReward = TransactionTypes.FRIEND_BANK_VERIFY_XCASH_REWARD;
										// This reward goes to refered by user. Now this is stop
										//await (new ModelService()).referalxCashRewardAtBankVerify(userId, typeOfReward, 10);
										if (user && user.bank_xtra_amount === 0) {
											await transactionAtBankVerfiy(userId);
										}
										let r_winning_balance = user && user['winning_balance'] ? user['winning_balance'] - winAmount : 0;
										let r_cash_balance = user && user['cash_balance'] ? user['cash_balance'] - cashAmount : 0;
										let date = new Date();
										let txnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
										let status = TransactionTypes.INSTANT_BANK_VERIFIED;
										let entity = {
											user_id: userId, txn_amount: 2, currency: "INR",
											details: {
												"refund_winning_balance": (winAmount ? winAmount : 0),
												"refund_cash_balance": (cashAmount ? cashAmount : 0),
												"refund_bonus_amount": 0,
												"refund_extra_amount": 0,
												"refund_affiliate_amount": 0,
												"current_winning_balance": r_winning_balance ? r_winning_balance : 0,
												"current_cash_balance": r_cash_balance ? r_cash_balance : 0,
												"current_bonus_amount": user && user.bonus_amount ? user.bonus_amount : 0,
												"current_extra_amount": user && user.extra_amount ? user.extra_amount : 0,
												"current_affiliate_amount": user && user.affiliate_amount ? user.affiliate_amount : 0,
											},
											retantion_amount: 0,
											txn_date: Date.now(),
											local_txn_id: txnId,
											added_type: parseInt(status)
										};
										let userUpdateQuery = { $set: { bank_account_verify: 2, bank_request_date: currentDate, change_bank_req: false } };
										if (!instant_verification_free) {
											userUpdateQuery = { $set: { bank_account_verify: 2, bank_request_date: currentDate, change_bank_req: false }, $inc: { cash_balance: -cashAmount, winning_balance: -winAmount } };
										}
										const userResult = await Users.updateOne({ _id: userId }, userUpdateQuery);
										if (userResult && userResult.nModified > 0) {
											if (!instant_verification_free) {
												await Transaction.create(entity);
											}
											console.log('enter 1');
											let fundAcount = await UserRazopayFundAc.findOne({ user_id: user._id });
											if (!_.isEmpty(fundAcount) && fundAcount.change_bank_req_accept == true) {
												// console.log(fundAcount);
												let userBankDeatail = await BankDetails.findOne({ user_id: userId })
												if (!_.isEmpty(userBankDeatail)) {
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
														await UserRazopayFundAc.updateOne({ user_id: userId, contact_id: fundAcount.contact_id }, { $set: { change_bank_req_accept: false, fund_account_id: userFundRes.id, old_func_account_id: fundAcount.fund_account_id } });
													}
												}
											}
										}
										response["message"] = "Bank detail updated successfully.";
										response["status"] = true;
										response["data"] = updatedData;
										return res.json(response);
									} else {
										manualVerification(userId, params, response, res);
									}
								});
							} else {
								response["message"] = "Something went wrong!!";
								return res.json({ response });
							}
						});
					} else {
						// user wallet is not sufficient for bank verfication
						response["message"] = "Something went wrong!!";
						return res.json({ response });
					}

				} else {
					response["message"] = "Insufficient Balance. Please maintain 2 rupees in the cash wallet for instant bank approval!!";
					return res.json(response);
				}
			} else if (user && !isInstantVerfy) {
				// user bank manual verification
				manualVerification(userId, params, response, res);
			} else {
				response["message"] = "Invalid Data!!";
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
	await Users.updateOne({ _id: userId }, { $inc: { extra_amount: 10 }, $set: { bank_xtra_amount: 1 } });
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
			let bodyRes = JSON.parse(body)
			console.log("bodyRes", bodyRes);
			if (bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.token) {
				cb({ "status": true, token: bodyRes.data.token });
			} else {
				cb({ "status": false });
			}
		});
	} else {
		cb({ "status": false });
	}
}

async function bankVerification(bankData, phoneNo, token, cb) {
	// console.log(bankData.account_holder_name);
	// return false;
	if (!_.isEmpty(bankData) && !_.isEmpty(token)) {
		var options = {
			"method": "GET",
			"url": config.BANK_VERIFY_API.URL + "payout/v1/asyncValidation/bankDetails?name=" + bankData.account_holder_name + "&phone=" + phoneNo + "&bankAccount=" + bankData.account_no + "&ifsc=" + bankData.ifsc_code,
			"headers": { 'Accept': "application/json", 'Authorization': "Bearer " + token },
		};
		console.log(options);
		request(options, function (error, res, body) {
			if (error) throw new Error(error);
			let bodyRes = JSON.parse(body)
			console.log("data at verif***",bodyRes);
			if (bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.accountExists && bodyRes.data.accountExists == "YES") {
				cb({ "status": true, token: bodyRes.data.bvRefId });
			} else {
				cb({ "status": false });
			}
		});
	} else {
		cb({ "status": false });
	}
}

async function manualVerification(userId, params, response, res) {
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
		const result = await BankDetails.updateOne({ user_id: userId }, { $set: updatedData });
	}
	let currentDate = Date.now();
	await Users.updateOne({ _id: userId }, { $set: { bank_account_verify: 1, bank_request_date: currentDate } });
	response["message"] = "Bank detail updated successfully.";
	response["status"] = true;
	response["data"] = updatedData;
	return res.json(response);
}