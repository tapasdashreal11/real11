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

const subwalletGuid = process.env.WALLET_SUBWALLET_GUID;
const MERCHANT_KEY = process.env.WALLET_MERCHANT_KEY;
const MID = process.env.WALLET_MID;
let hostname = 'dashboard.paytm.com';

const bank_subwalletGuid = process.env.BANK_SUBWALLET_GUID;
const BANK_MERCHANT_KEY = process.env.BANK_MERCHANT_KEY;
const BANK_MID = process.env.BANK_MID;

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
			response["message"] = "You are under supervision of admin.Please don't do this activity!!";
			return res.json(response);
		}
		try {
			let userId = "6166e12894f04e3f15a9c057" //req.userId;
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
								let result = await Users.updateOne({ _id: userId }, { $inc: { affiliate_amount: - parseFloat(params.withdraw_amount) } });
								if (result) {
									let withdrawData = await WithdrawRequest.create(updatedData);
									let date = new Date();
									let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId;
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
											"account_number": "2323230094748663",
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
											console.log("payoutPlayload***", payoutPlayload);
											let payOutResponse = await razopayPayoutToUserFundAc(payoutPlayload);
											console.log("payOutResponse", payOutResponse);
											if (payOutResponse && payOutResponse.id) {
												let transEntity = { user_id: userId, txn_amount: txnAmount, currency: "INR", txn_date: Date.now(), local_txn_id: txnId };
												let payOutData = { payout_id: payOutResponse.id, fund_account_id: userRazopayData.fund_account_id, user_id: userId, txn_amount: txnAmount };


												transEntity['order_id'] = payOutResponse.id;
												transEntity['gateway_name'] = "Razopay";
												transEntity['withdraw_commission'] = updatedData.instant_withdraw_comm ? updatedData.instant_withdraw_comm : 0;

												if (payOutResponse.status == "processing") {
													console.log("enter to processing state with status");
													// request status 3 => request pending, whether its not sent to wallet or user's wallet not found 
													//const session = await startSession()
													//session.startTransaction();
													let transStatus = TransactionTypes.TRANSACTION_PENDING;
													response["message"] = "Your transaction is processing!!";
													updatedData['request_status'] = 3;
													updatedData['message'] = "processing";
													payOutData['status'] = 1;
													transEntity['added_type'] = parseInt(transStatus);

													try {
														await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } });
														let newDataC = await WithdrawRequest.create([updatedData]);
														var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
														transEntity['withdraw_id'] = cResult._id;
														let newTrnasDataC = await Transaction.create([transEntity]);
														var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
														if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
														if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id;
														await RazopayPayoutStatus.create([payOutData]);
														let title = 'withdraw Request initiated';
														let notification = 'Your withdraw request has been initiated.';
														await sendNotificationToUser(userId,user,updatedData,title,notification,false);
													} catch (err_pending) {

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
														await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } });
														let newDataC = await WithdrawRequest.create([updatedData]);
														var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
														transEntity['withdraw_id'] = cResult._id;
														let newTrnasDataC = await Transaction.create([transEntity]);
														var cTResult = newTrnasDataC && newTrnasDataC.length > 0 ? newTrnasDataC[0] : {};
														if (cResult && cResult._id) payOutData['withdraw_id'] = cResult._id;
														if (cTResult && cTResult._id) payOutData['transaction_id'] = cTResult._id;
														await RazopayPayoutStatus.create([payOutData]);
														let title = 'withdraw Request confirmed';
														let notification = 'Your withdraw request has been confirmed';
														await sendNotificationToUser(userId,user,updatedData,title,notification,true);
													} catch (err_pending) {

													}


												} else if (payOutResponse.status == "reversed") {
													console.log("enter to reversed state with status");
													response["message"] = "Your transaction has been reversed!!";
													payOutData['status'] = 2;
													await RazopayPayoutStatus.create([payOutData]);
													return res.json(response);

												} else if (payOutResponse.status == "rejected") {
													console.log("enter to rejected state with status");
													payOutData['status'] = 2;
													await RazopayPayoutStatus.create([payOutData]);
													response["message"] = "Your withdraw has been rejected.Please try again!!";

												} else if (payOutResponse.status == "cancelled") {
													console.log("enter to cancelled state with status");
													payOutData['status'] = 2;
													await RazopayPayoutStatus.create([payOutData]);
													response["message"] = "Your withdraw has been cancelled.Please try again!!";

												} else if (payOutResponse.status == "failed") {
													console.log("enter to failed state with status");
													payOutData['status'] = 2;
													await RazopayPayoutStatus.create([payOutData]);
													response["message"] = "Your withdraw has been failed.Please try again!!";
												} else {
													console.log("enter in else state in withdraw");
													response["message"] = "Something went wrong. Please try after some time!!";
												}

												response["status"] = true;
												response["data"] = {};
												return res.json(response);
											} else {
												response["message"] = (payOutResponse && payOutResponse.error && payOutResponse.error.reason && payOutResponse.error.reason == "insufficient_funds") ? "Withdraw is temporarily on hold for few hours.Please try after some time!!" : "Something went wrong!!";
												return res.json(response);
											}
										} else {
											
											await Users.updateOne({ _id: userId }, { $inc: { winning_balance: - parseFloat(params.withdraw_amount) } });
											let withdrawData = await WithdrawRequest.create(updatedData);
											let status = TransactionTypes.TRANSACTION_PENDING;
											let txnAmount = params.withdraw_amount;
											let withdrawId = withdrawData._id;
											await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId);

											response["message"] = "Your request has been sent successfully, you will get notified once request is approved.";
											response["status"] = true;
											response["data"] = {};
											return res.json(response);
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
				res.send(ApiUtility.failed("Your account is not verified with us.Please contact with admin!!"));
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

async function sendNotificationToUser(userId,userDetail,withdraw_request,title,notification,isSendEmail){
	try{
		const deviceType = userDetail.device_type;
		const deviceToken = userDetail.device_id;
		let to = userDetail.email;
		let subject = 'Real 11 Withdraw Request';
		let message = '<table><tr><td>Dear user,</td></tr><tr><td>Your withdrawal request is confirmed of Rs. ' + withdraw_request.refund_amount + '/- Make sure your withdrawal details are correct. <br><br/> In case any issue please mail us on support@real11.com</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';
		// send mail on withdraw end
		if(isSendEmail)sendSMTPMail(to, subject, message);
		// PUSH Notification
		const notiType = '8';
		if ((deviceType == 'Android') && (deviceToken != '')) {
			sendNotificationFCM(userId, notiType, deviceToken, title, notification);
		}
		if ((deviceType == 'iphone') && (deviceToken != '') && (deviceToken != 'device_id')) {
			sendNotificationFCM(userId, notiType, deviceToken, title, notification);
		}
	}catch(error_notif){}
}