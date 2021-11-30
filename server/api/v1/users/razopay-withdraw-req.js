const { ObjectId } = require('mongodb');
const Users = require("../../../models/user");
const Settings = require("../../../models/settings");
const BankDetails = require("../../../models/user-bank-details");
const Transaction = require('../../../models/transaction');
const WithdrawRequest = require("../../../models/withdraw_requests");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
var PaytmChecksum = require("../../../../lib/PaytmChecksum");
const { TransactionTypes } = require('../../../constants/app');
const config = require('../../../config.js');
const redis = require('../../../../lib/redis.js');
const { sendSMTPMail, sendNotificationFCM, sendMailToDeveloper } = require("../common/helper.js");
const https = require('https');
const { parse } = require('url');
const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac");
const { razopayPayoutToUserFundAc } = require("./razopay-contact-fund-ac");
const RazopayPayoutStatus = require("../../../models/razopay-payout-status");
const { startSession } = require('mongoose');

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
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

		let wAmount = params && params.withdraw_amount ? parseFloat(params.withdraw_amount) : 0;
		if (wAmount < 1) {
			response["message"] = "You are under supervision of admin. Please don't do this activity!!";
			return res.json(response);
		}
		try {
			let userId = req.userId;
			let user = await Users.findOne({ _id: userId, fair_play_violation: 0 });
			let userRazopayData = await UserRazopayFundAc.findOne({ user_id: userId });
			if (userRazopayData && userRazopayData.contact_id && userRazopayData.fund_account_id) {
				if (user && wAmount >= 1) {
					if (user.status == 1) {
						let winning_balance = user.winning_balance || 0;
						let affiliate_amount = user.affiliate_amount || 0;
						let isInstant = ((params.instant_withdraw && params.instant_withdraw == "1") || params.withdraw_amount >= 10000) ? 1 : 0;

						if (params.wallet_type && params.wallet_type == 'affliate') {
							if (params.withdraw_amount > affiliate_amount) {
								response["status"] = false;
								response["data"] = {};
								response["message"] = "The amount you have entered is more than your total available winnings for withdrawal, please enter a realistic amount.";
								return res.json(response);
							} else {
								let updatedData = {};
								let remainingAmount = affiliate_amount - params.withdraw_amount;
								updatedData.amount = remainingAmount;
								updatedData.refund_amount = parseFloat(params.withdraw_amount) || '';
								updatedData.user_id = userId;
								updatedData.type = params.type || '';
								updatedData.email = user.email || '';
								updatedData.wallet_type = params.wallet_type || '';
								updatedData.is_instant = isInstant;
								updatedData.ip_address = userIp ? userIp : "";
								const session = await startSession()
								session.startTransaction();
								const sessionOpts = { session, new: true };
								try {
									let result = await Users.updateOne({ _id: userId }, { $inc: { affiliate_amount: - parseFloat(params.withdraw_amount) } }, sessionOpts);
									if (result && result.nModified > 0) {
										let withdrawData = await WithdrawRequest.create([updatedData], { session: session });
										let date = new Date();
										let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
										let txnId = joinContestTxnId;
										let txnStatus = TransactionTypes.TRANSACTION_PENDING;
										let txnAmount = params.withdraw_amount;
										var cResult = withdrawData && withdrawData.length > 0 ? withdrawData[0] : {};
										let withdrawId = cResult._id;
										let transEntity = { user_id: userId, txn_amount: txnAmount, currency: "INR", txn_date: Date.now(), local_txn_id: txnId };
										transEntity['added_type'] = parseInt(txnStatus);
										transEntity['match_id'] = 0;
										transEntity['withdraw_id'] = withdrawId;
										await Transaction.create([transEntity], { session: session });
										await session.commitTransaction();
										session.endSession();
										response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
										response["status"] = true;
										response["data"] = {};
										return res.json(response);
									} else {
										await session.abortTransaction();
										session.endSession();
										return res.send(ApiUtility.failed("Please try again!!"));
									}

								} catch (error_affil) {
									await session.abortTransaction();
									session.endSession();
									return res.send(ApiUtility.failed("Please try again!!"));
								} finally {
									// ending the session
									session.endSession();
								}

							}
						} else {
							if (params.withdraw_amount > winning_balance) {
								response["status"] = false;
								response["data"] = {};
								response["message"] = "The amount you have entered is more than your total available winnings for withdrawal, please enter a realistic amount.";
								return res.json(response);
							} else {
								let updatedData = {};
								let remainingAmount = winning_balance - params.withdraw_amount;
								updatedData.amount = remainingAmount;
								updatedData.refund_amount = parseFloat(params.withdraw_amount) || '';
								updatedData.user_id = userId;
								updatedData.type = params.type || '';
								updatedData.email = user.email || '';
								updatedData.wallet_type = '';
								updatedData.is_instant = isInstant;
								updatedData.ip_address = userIp ? userIp : "";
								let settingData = {};
								let appSettingData = {};
								redis.getRedis('app-setting', async (err, data) => {
									if (data) {
										settingData = data;
									} else {
										appSettingData = await Settings.findOne({}, { is_instant_withdraw: 1, instant_withdraw_msg: 1 });
										settingData = appSettingData;
									}
									if (settingData && settingData.is_instant_withdraw === 1 && params.instant_withdraw == "1") {
										response["message"] = settingData.instant_withdraw_msg;
										return res.json(response);
									}
									if (params.instant_withdraw && params.instant_withdraw == "1") {
										let instantComm = 0;
										if (params.type == "bank") {
											instantComm = config.withdraw_commission;
										} else {
											let commAmt = 1 / 100 * parseFloat(params.withdraw_amount);
											instantComm = commAmt;
										}
										updatedData.instant_withdraw_comm = instantComm;
									}
									if (user) {
										let date = new Date();
										let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
										let txnId = joinContestTxnId;
										let txnAmount = params.withdraw_amount;
										// let withdrawId = withdrawData._id;
										let amountValue = updatedData.refund_amount;// - updatedData.instant_withdraw_comm;
										let payoutPlayload = {
											"account_number": config.RAZOPAY_API.ACCOUNT_NUMBER,
											"fund_account_id": userRazopayData.fund_account_id,
											"amount": amountValue * 100,
											"currency": "INR",
											"mode": "IMPS",
											"purpose": "payout",
											"queue_if_low_balance": false,
											"reference_id": "" + userId,
											"narration": "user Withdraw req",
											"notes": {
												"random_key_1": "Make it so.",
												"random_key_2": "Win Withdraw"
											}
										}
										if (params.instant_withdraw && params.instant_withdraw == "1") {
											await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } });
											let newDataC = await WithdrawRequest.create([updatedData]);
											var withDrawResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
											let payOutResponse = await razopayPayoutToUserFundAc(payoutPlayload, withDrawResult._id);
											let transEntity = { user_id: userId, txn_amount: txnAmount, currency: "INR", txn_date: Date.now(), local_txn_id: txnId };
											console.log("payOutResponse", payOutResponse);
											if (payOutResponse && payOutResponse.id) {

												let payOutData = { payout_id: payOutResponse.id, fund_account_id: userRazopayData.fund_account_id, user_id: userId, txn_amount: txnAmount };


												transEntity['order_id'] = payOutResponse.id;
												transEntity['gateway_name'] = "Razorpay";
												transEntity['withdraw_commission'] = updatedData.instant_withdraw_comm ? updatedData.instant_withdraw_comm : 0;

												if (payOutResponse.status == "processing") {
													console.log("enter to processing state with status");
													let transStatus = TransactionTypes.TRANSACTION_PENDING;
													response["message"] = "Your transaction is processing!!";
													updatedData['request_status'] = 3;
													updatedData['message'] = "processing";
													payOutData['status'] = 0;
													transEntity['added_type'] = parseInt(transStatus);

													try {

														var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
														transEntity['withdraw_id'] = cResult._id;
														await WithdrawRequest.updateOne({ '_id': cResult._id }, { "request_status": 3, "message": "processing" });
														let newTrnasDataC = await Transaction.create([transEntity]);
														var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
														if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
														if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id;
														await RazopayPayoutStatus.create([payOutData]);
														let title = 'withdraw Request initiated';
														let notification = 'Your withdraw request has been initiated.';
														await sendNotificationToUser(userId, user, updatedData, title, notification, false);
													} catch (err_pending) {
														payOutData['status'] = 4;
														payOutData['msz'] = err_pending && err_pending.message ? err_pending.message: "";
														await RazopayPayoutStatus.create([payOutData]);
													}


												} else if (payOutResponse.status == "processed") {
													console.log("enter to processed state with status");
													// request status 1 => request pending, whether its not sent to wallet or user's wallet not found 
													let transStatus = TransactionTypes.TRANSACTION_CONFIRM;
													response["message"] = "Your transaction has been processed successfully!!";
													let approveDate = new Date();
													updatedData['request_status'] = 1;
													payOutData['status'] = 1;
													updatedData['approve_date'] = approveDate;
													updatedData['message'] = "processed";
													transEntity['added_type'] = parseInt(transStatus);
													transEntity['approve_withdraw'] = approveDate;
													try {
														//await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } });
														//let newDataC = await WithdrawRequest.create([updatedData]);
														var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
														transEntity['withdraw_id'] = cResult._id;
														await WithdrawRequest.updateOne({ '_id': cResult._id }, { "request_status": 1, "message": "processed", "approve_date": approveDate });
														let newTrnasDataC = await Transaction.create([transEntity]);
														var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
														if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
														if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id; //utr
														payOutData['utr'] = payOutResponse.utr;
														await RazopayPayoutStatus.create([payOutData]);
														let title = 'withdraw Request confirmed';
														let notification = 'Your withdraw request has been confirmed';
														await sendNotificationToUser(userId, user, updatedData, title, notification, true);
													} catch (err_pending) {
														payOutData['status'] = 4;
														payOutData['msz'] = err_pending && err_pending.message ? err_pending.message: "";
														await RazopayPayoutStatus.create([payOutData]);
													}


												} else if (payOutResponse.status == "reversed" || payOutResponse.status == "rejected" || payOutResponse.status == "cancelled" || payOutResponse.status == "failed") {
													try {
														console.log("enter to reversed state with status");
														let transStatus = TransactionTypes.TRANSACTION_PENDING;
														let mszFailed = payOutResponse.failure_reason ? payOutResponse.failure_reason : "failed detected";
														transEntity['added_type'] = parseInt(transStatus);
														response["message"] = "Your transaction has been reversed!!";
														payOutData['status'] = 2;
														var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
														transEntity['withdraw_id'] = cResult._id;
														transEntity['message'] = "" + mszFailed;
														await WithdrawRequest.updateOne({ '_id': cResult._id }, { "request_status": 4, "message": mszFailed });
														let newTrnasDataC = await Transaction.create([transEntity]);
														var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
														if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
														if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id; //utr
														if (payOutResponse && payOutResponse.utr) payOutData['utr'] = payOutResponse.utr;
														await RazopayPayoutStatus.create([payOutData]);
													} catch (err_pending) {
														payOutData['status'] = 4;
														payOutData['msz'] = err_pending && err_pending.message ? err_pending.message: "";
														await RazopayPayoutStatus.create([payOutData]);
													}


												} else {
													var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
													transEntity['withdraw_id'] = cResult._id;
													let mszFor = "This is exceptional case.Admin should see this." + (payOutResponse.failure_reason ? payOutResponse.failure_reason : "");
													await WithdrawRequest.updateOne({ '_id': cResult._id }, { "request_status": 3, "message": mszFor });
													payOutData['status'] = 4;
													let transStatus = TransactionTypes.TRANSACTION_PENDING;
													transEntity['added_type'] = parseInt(transStatus);
													if (payOutResponse && payOutResponse.utr) payOutData['utr'] = payOutResponse.utr;
													let newTrnasDataC = await Transaction.create([transEntity]);
													var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
													if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
													if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id;
													await RazopayPayoutStatus.create([payOutData]);
													console.log("enter in else state in withdraw");
													response["message"] = "Something went wrong. Please try after some time!!";
												}

												response["status"] = true;
												response["data"] = {};
												return res.json(response);
											} else {
												// In this case razorpay have any error related to low balance and other
												if (payOutResponse && payOutResponse.error && payOutResponse.error.reason && payOutResponse.error.reason == "insufficient_funds") {
													sendEmailToAdminForLowBalance();
												}
												response["message"] = "Your request is in process. Kindly check after sometime!!";
												var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
												//await WithdrawRequest.updateOne({ '_id': cResult._id },{"request_status":3,"message":"processing"});
												transEntity['withdraw_commission'] = updatedData.instant_withdraw_comm ? updatedData.instant_withdraw_comm : 0;
												let transStatus = TransactionTypes.TRANSACTION_PENDING;
												transEntity['added_type'] = parseInt(transStatus);
												transEntity['withdraw_id'] = cResult._id;
												await Transaction.create([transEntity]);
												return res.json(response);
											}
										} else {
											const session = await startSession()
											session.startTransaction();
											const sessionOpts = { session, new: true };
											try {
												let walletRes = await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } }, sessionOpts);
												if (walletRes && walletRes.nModified > 0) {
													let withdrawData = await WithdrawRequest.create([updatedData], { session: session });
													let txnStatus = TransactionTypes.TRANSACTION_PENDING;
													let txnAmount = params.withdraw_amount;
													var cResult = withdrawData && withdrawData.length > 0 ? withdrawData[0] : {};
													let withdrawId = cResult._id;
													let transEntity = { user_id: userId, txn_amount: txnAmount, currency: "INR", txn_date: Date.now(), local_txn_id: txnId };
													transEntity['added_type'] = parseInt(txnStatus);
													transEntity['match_id'] = 0;
													transEntity['withdraw_id'] = withdrawId;
													await Transaction.create([transEntity], { session: session });
													await session.commitTransaction();
													session.endSession();
													response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
													response["status"] = true;
													response["data"] = {};
													return res.json(response);
												} else {
													await session.abortTransaction();
													session.endSession();
													return res.send(ApiUtility.failed("Please try again!!"));
												}

											} catch (error_nin) {
												await session.abortTransaction();
												session.endSession();
												return res.send(ApiUtility.failed("Please try again!!"));
											} finally {
												// ending the session
												session.endSession();
											}

										}

									}
								});
							}
						}
					} else {
						response["message"] = "Before doing withdraw, please verify your phone number.";
						return res.json(response);
					}
				} else {
					response["message"] = "Invalid Data.";
					return res.json(response);
				}
			} else {
				res.send(ApiUtility.failed("Your account is not verified with us. Please contact with admin!!"));
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

/**
 * Send a message and email to user for withdrawal status
 * @param {*} userId 
 * @param {*} userDetail 
 * @param {*} withdraw_request 
 * @param {*} title 
 * @param {*} notification 
 * @param {*} isSendEmail 
 */
async function sendNotificationToUser(userId, userDetail, withdraw_request, title, notification, isSendEmail) {
	try {
		const deviceType = userDetail.device_type;
		const deviceToken = userDetail.device_id;
		let to = userDetail.email;
		let subject = 'Real 11 Withdraw Request';
		let message = '<table><tr><td>Dear user,</td></tr><tr><td>Your withdrawal request is confirmed of Rs. ' + withdraw_request.refund_amount + '/- Make sure your withdrawal details are correct. <br><br/> In case any issue please mail us on support@real11.com</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';
		// send mail on withdraw end
		if (isSendEmail) sendSMTPMail(to, subject, message);
		// PUSH Notification
		const notiType = '8';
		if ((deviceType == 'Android') && (deviceToken != '')) {
			sendNotificationFCM(userId, notiType, deviceToken, title, notification);
		}
		if ((deviceType == 'iphone') && (deviceToken != '') && (deviceToken != 'device_id')) {
			sendNotificationFCM(userId, notiType, deviceToken, title, notification);
		}
	} catch (error_notif) { }
}

/**
 * Send email to admin during low balance in payout
 */
async function sendEmailToAdminForLowBalance() {
	try {
		let to = "amityadav@real11.com";
		let subject = 'Real 11 Withdraw Low Balance Alert';
		let message = '<table><tr><td>Dear Admin,</td></tr><tr><td>We have low balance in account for payout at Razopay PROD. <br><br/> Please add more amount to make user withdrawal successfully</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';
		// send mail on low balance
		sendSMTPMail(to, subject, message);

	} catch (error_notif) { }
}