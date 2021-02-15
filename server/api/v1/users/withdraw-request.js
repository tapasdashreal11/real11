const { ObjectId } = require('mongodb');
const Users = require("../../../models/user");
const BankDetails = require("../../../models/user-bank-details");
const Transaction = require('../../../models/transaction');
const WithdrawRequest = require("../../../models/withdraw_requests");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
var PaytmChecksum = require("../../../../lib/PaytmChecksum");
const { TransactionTypes } = require('../../../constants/app');
const https = require('https');
const { parse } = require('url');

// const subwalletGuid = process.env.WALLET_SUBWALLET_GUID;
// const MERCHANT_KEY = process.env.WALLET_MERCHANT_KEY;
// const MID = process.env.WALLET_MID;
// let hostname  = 'dashboard.paytm.com';

// const bank_subwalletGuid = process.env.BANK_SUBWALLET_GUID;
// const BANK_MERCHANT_KEY = process.env.WALLET_MERCHANT_KEY;
// const BANK_MID = process.env.BANK_MID;
const subwalletGuid = "4b471086-28fc-4e4c-8a9a-b52e487db3b7";
const MERCHANT_KEY = "8OB28Uj@GhBMAcjh";
const MID = "Real1164880585275836";
let hostname  = 'dashboard.paytm.com';

const bank_subwalletGuid = "c640c6ac-4f25-4cc8-b569-a3a266fdd98d";
const BANK_MERCHANT_KEY = "aPZqprXHI0yRuBBs";
const BANK_MID = "FANTRE57342726781895";

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
				let isInstant = ((params.instant_withdraw && params.instant_withdraw == "1") || params.withdraw_amount >= 10000) ? 1 : 0; 
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
						updatedData.refund_amount = parseFloat(params.withdraw_amount) || '';
						updatedData.user_id = userId;
						updatedData.type = params.type || '';
						updatedData.email = user.email || '';
						updatedData.wallet_type = params.wallet_type || '';
						updatedData.is_instant = isInstant;
						// console.log(remainingAmount);
						
						// let result =  await Users.update({_id: userId}, {$set : {affiliate_amount : remainingAmount}});
						let result =  await Users.updateOne({_id: userId}, {$inc : {affiliate_amount : - parseFloat(params.withdraw_amount)}});
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
						updatedData.refund_amount = parseFloat(params.withdraw_amount) || '';
						updatedData.user_id = userId;
						updatedData.type = params.type || '';
						updatedData.email = user.email || '';
						updatedData.wallet_type = '';
						updatedData.is_instant = isInstant;
						if(params.instant_withdraw && params.instant_withdraw == "1") {
							updatedData.instant_withdraw_comm = 10;
						}
						console.log(updatedData);
						// return false;
						
						// let result =  await Users.update({_id: userId}, {$set : {winning_balance : remainingAmount}});
						let result =  await Users.updateOne({_id: userId}, {$inc : {winning_balance : - parseFloat(params.withdraw_amount)}});
						if(result) {
							let withdrawData =  await WithdrawRequest.create(updatedData);
							let date = new Date();
							let joinContestTxnId	=	'JL'+ date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
							let txnId = joinContestTxnId;
							// let status = TransactionTypes.TRANSACTION_PENDING;
							// let txnAmount = params.withdraw_amount;
							// let withdrawId = withdrawData._id;
							if(params.instant_withdraw && params.instant_withdraw == "1") {
								await withdrawConfirm(withdrawData, params.type, userId, user, txnId, function(withdrawResult) {
									console.log(withdrawResult.status);
									response["message"] = withdrawResult.message;
									if(withdrawResult.status == true) {
										response["status"] = true;
										response["data"] = {};
										return res.json(response);
									} else {
										response["status"] = false;
										response["data"] = {};
										return res.json(response);
									}
								})
								// return false
							} else {
								let status = TransactionTypes.TRANSACTION_PENDING;
								let txnAmount = params.withdraw_amount;
								let withdrawId = withdrawData._id;
								
								await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);

								response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
								response["status"] = true;
								response["data"] = {};
								return res.json(response);
							}
							// await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
						}
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


async function withdrawConfirm(withdrawData, type, userId, userData, txnId, cb) {
	// console.log(orderId, type, userId, userData);
	// console.log(orderId, withdrawData);
	// return false
	try {
		let withdraw_request = withdrawData; //await WithdrawRequest.findOne({ _id: orderId })
		let orderId	=	withdrawData._id;
		if (withdraw_request) {
			var paytmParams = {};
			let userDetail = userData; //await Users.findOne({_id:new ObjectId(params.user_id)});

			// let userId = params.user_id;
			const deviceType = userDetail.device_type;
			const deviceToken = userDetail.device_id;
			// console.log(userDetail);return false;
			if (type && type === "bank") {
				let bankDetail = await BankDetails.findOne({ user_id: new ObjectId(userId) });
				// console.log(bankDetail);
				let txnDate = new Date();
				let month = ("0" + (txnDate.getMonth() + 1)).slice(-2);
				let date = ("0" + (txnDate.getDate())).slice(-2);
				paytmParams["subwalletGuid"]	=	bank_subwalletGuid;
				paytmParams["orderId"]			=	orderId;
				paytmParams["beneficiaryAccount"]=	bankDetail.account_number;
				paytmParams["beneficiaryIFSC"]	=	bankDetail.ifsc_code;
				paytmParams["amount"]			=	withdraw_request.refund_amount- 10;
				paytmParams["purpose"]			=	"REIMBURSEMENT";
				paytmParams["date"]				=	txnDate.getFullYear() + "-" + month + "-" + date;
			} else {
				paytmParams["subwalletGuid"]	=	subwalletGuid;
				paytmParams["orderId"]			=	orderId;
				paytmParams["beneficiaryPhoneNo"]=	userDetail.phone;
				paytmParams["amount"]			=	withdraw_request.refund_amount- 10;
			}
			var post_data	=	JSON.stringify(paytmParams);

			let merchant_key=	'';
			let mid			=	'';
			if (type && type === "bank") {
				merchant_key=	BANK_MERCHANT_KEY;
				mid			=	BANK_MID;
			} else {
				merchant_key=	MERCHANT_KEY;
				mid			=	MID;
			}

			try {
				if (withdraw_request.request_status == 0) {
					PaytmChecksum.generateSignature(post_data, merchant_key).then(function (checksum) {

						let path = '';
						if (type && type === "bank") {
							path = '/bpay/api/v1/disburse/order/bank';
						} else {
							path = '/bpay/api/v1/disburse/order/wallet/gratification';
						}
						// var x_mid = mid;
						// var x_checksum = checksum;

						var options = {
							hostname: hostname,
							path: path,
							port: 443,
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
								'x-mid': mid,
								'x-checksum': checksum,
								'Content-Length': post_data.length
							}
						};

						var response = "";
						var post_req = https.request(options, function (post_res) {
							post_res.on('data', function (chunk) {
								response += chunk;
								// console.log(chunk);
							});

							post_res.on('end', async function () {
								// console.log(response); //return false
								let txnAmount	=	withdraw_request.refund_amount;
								let withdrawId	=	withdrawData._id;

								let result = JSON.parse(response);
								if (result.status == 'SUCCESS' || result.status == 'ACCEPTED') {
									try {
										withdrawStatus(orderId, merchant_key, mid, async function (res1) {
											if (res1 && res1.status === 200) {
												console.log("enter to success state with status");
												// request status 1 => confirmed request and money sent to users wallet or bank
												let approveDate = new Date();
												const successRes = await WithdrawRequest.updateOne({ '_id': orderId }, { $set: { request_status: 1, approve_date: approveDate, message: res1.message } });
												if (successRes) {
													let status = TransactionTypes.TRANSACTION_CONFIRM;
													await Transaction.saveWithdrawTransaction(userId, txnId, status, txnAmount, withdrawId, res1.data.paytmOrderId, params.type, approveDate);

													// await Transaction.findOneAndUpdate({ withdraw_id: new ObjectId(orderId) }, { $set: { added_type: TransactionTypes.TRANSACTION_CONFIRM, order_id: res1.data.paytmOrderId, gateway_name: params.type, approve_withdraw: approveDate } })
													// send mail on withdraw Start
													let to = userDetail.email;
													// let from = 'support@real11.com';
													// let cc = ['amityadav@real11.com, amansingh@real11.com'];
													let subject = 'Real 11 Withdraw Request';
													let message = '<table><tr><td>Dear user,</td></tr><tr><td>Your withdrawal request is confirmed of Rs. ' + withdraw_request.refund_amount + '/- Make sure your withdrawal details are correct. <br><br/> In case any issue please mail us on support@real11.com</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';

													sendSMTPMail(to, subject, message);
													// send mail on withdraw end

													// PUSH Notification
													const notiType = '8';
													let title = 'withdraw Request confirmed';
													let notification = 'Your withdraw request has been confirmed';
													if ((deviceType == 'Android') && (deviceToken != '')) {
														sendNotificationFCM(userId, notiType, deviceToken, title, notification);
													}
													if ((deviceType == 'iphone') && (deviceToken != '') && (deviceToken != 'device_id')) {
														sendNotificationFCM(userId, notiType, deviceToken, title, notification);
													}
													cb({"status": true, "message": "Withdraw confirmed and sent to users wallet successfully." })
													// return res.status(201).json({ status: true, message: "Withdraw confirmed and sent to users wallet successfully." });
												}
											} else if (res1 && res1.status === 205) {
												console.log("enter to pending state with status");
												// request status 2 => request pending, whether its not sent to wallet or user's wallet not found 
												const successRes = await WithdrawRequest.updateOne({ '_id': orderId }, { $set: { request_status: 3, message: res1.message } });
												if(successRes.nModified && successRes.nModified > 0) {
													let status = TransactionTypes.TRANSACTION_PENDING;
													await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
													// PUSH Notification
													const notiType = '8';
													let title = 'withdraw Request initiated';
													let notification = 'Your withdraw request has been initiated.';
													if ((deviceType == 'Android') && (deviceToken != '')) {
														sendNotificationFCM(userId, notiType, deviceToken, title, notification);
													}
													if ((deviceType == 'iphone') && (deviceToken != '') && (deviceToken != 'device_id')) {
														sendNotificationFCM(userId, notiType, deviceToken, title, notification);
													}
													cb({"status": true, "message": "Withdraw in Process, please wait." })
												}

												// return res.status(409).json({ status: true, message: "Withdraw payment is procced by paytm, but stil not sent to user wallet." });
											} else {
												console.log("enter to fail state with status");
												const successRes = await WithdrawRequest.updateOne({ '_id': orderId }, { $set: { request_status: 2, message: res1.message } });
												if(successRes.nModified && successRes.nModified > 0) {
													let userWallet =  await Users.updateOne({_id: userId}, {$inc : {winning_balance : + txnAmount}});
													if(userWallet.nModified && userWallet.nModified > 0) {
														let status = TransactionTypes.TRANSACTION_REJECT;
														await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
														cb({"status": false, "message": res1.message })
													}
												}
												// const successRes = await WithdrawRequest.updateOne({ '_id': orderId }, { $set: { request_status: 4, message: res1.message } });
												// console.log('error', res1.message);
												// return res.status(409).json({ status: false, message: res1.message });
											}
										});
									} catch (error) {
										console.log("update user withdraw status == ", error);
										cb({"status": true, "message": "Withdraw in Process, please wait." })
										// return res.status(409).json({ status: true, message: "Withdraw confirmed, but there is something wrong to update status." });
									}

									// return res.send(ApiUtility.success({response: result.statusMessage}));
								} else {
									console.log("enter to fail state", result);
									const successRes = await WithdrawRequest.updateOne({ '_id': orderId }, { $set: { request_status: 2, message: result.statusMessage } });
									if(successRes.nModified && successRes.nModified > 0) {
										let userWallet =  await Users.updateOne({_id: userId}, {$inc : {winning_balance : + txnAmount}});
										if(userWallet.nModified && userWallet.nModified > 0) {
											let status = TransactionTypes.TRANSACTION_REJECT;
											await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);
											cb({"status": false, "message": result.statusMessage })
										}
									}
								}
							});
						});
						post_req.write(post_data);
						post_req.end();
					});
				} else {
					response["message"] = "withdraw request already perform for current order id.";
					// return res.json(response);
					cb({"status": false, "message": result.response["message"] })
					// return res.status(409).json({ status: false, message: response["message"] });
					// return res.send(ApiUtility.failed(response["message"]));
				}
			} catch (err) {
				console.log("Withdraw param error ===", err);
				cb({"status": false, "message": err.message })
				// return res.status(409).json({ status: true, message: response["message"] });
			}
		} else {
			response["message"] = "withdraw request does not exists for current order id.";
			// return res.json(response);
			cb({"status": false, "message": result.response["message"] })
			// return res.status(409).json({ status: false, message: response["message"] });
			// return res.send(ApiUtility.failed(response));
		}
	} catch (error) {
		logger.error("ERROR", error.message);
		console.log("Withdraw accept error === ", error);
		cb({"status": false, "message": error.message })
		// return res.status(409).json({ status: false, message: error.message });
		// return res.send(ApiUtility.failed(error.message));
	}
}


async function withdrawStatus(orderId, merchant_key, mid, cb) {
	try {
		var paytmParams = {};
		paytmParams.orderId = orderId;

		var post_data = JSON.stringify(paytmParams);
		PaytmChecksum.generateSignature(post_data, merchant_key).then(function (checksum) {
			var x_mid = mid;
			var x_checksum = checksum;

			var options = {
				hostname: hostname,
				path: '/bpay/api/v1/disburse/order/query',
				port: 443,
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'x-mid': x_mid,
					'x-checksum': x_checksum,
					'Content-Length': post_data.length
				}
			};
			// console.log('enter');return false;
			var response = "";
			var post_req = https.request(options, function (post_res) {
				post_res.on('data', function (chunk) {
					response += chunk;
				});

				post_res.on('end', function () {
					let result = JSON.parse(response);
					console.log(response);

					if (result.status == 'SUCCESS' || result.status == 'ACCEPTED') {
						return cb({ "status": 200, "message": result.statusMessage, data: result });
					} else if (result.status == 'PENDING') {
						return cb({ "status": 205, "message": result.statusMessage });
					} else {
						return cb({ "status": 409, "message": result.statusMessage });
					}
				});
			});
			post_req.write(post_data);
			post_req.end();
		});
	} catch (error) {
		logger.error("ERROR", error.message);
		console.log("Witrhdraw status ERROR", error);
		cb(ApiUtility.failed(error.message))
	}
}