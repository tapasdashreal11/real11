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
		let approveDate = new Date();
		if (params && params.entity) {
			if (params.event == 'payout.processed') {
				console.log('razopay webhook in state*****',params.event);
				let payoutData = params.payload && params.payload.payout && params.payload.payout.entity ? params.payload.payout.entity : {};
				console.log('payoutData in hook',payoutData);
				if(payoutData && payoutData.id){
					console.log('if hook',payoutData.id);
					let payoutStatus =  await RazopayPayoutStatus.findOne({pauout_id:payoutData.id});
					console.log('if payoutStatus',payoutStatus);
					if(payoutStatus && payoutStatus.withdraw_id && payoutStatus.transaction_id){
						let transStatus = TransactionTypes.TRANSACTION_CONFIRM;
						await WithdrawRequest.updateOne({ '_id': payoutStatus.withdraw_id }, { $set: { request_status: 1, approve_date: approveDate, message: "processed" } });
						await Transaction.updateOne({ '_id': payoutStatus.transaction_id }, { $set: { added_type: parseInt(transStatus), approve_withdraw: approveDate, message: "processed from hook" } });
					}else{
						console.log('if payoutStatus not payout',payoutStatus);
					}
				} else{
					console.log(" payoutData in else condi****", payoutData);
				}
				console.log(" payoutData in****", payoutData);
				response["status"] = true;
				response["data"] = {};
				return res.json(response);
				
				
			} else if (params.event == 'payout.reversed' || params.event == 'payout.failed' || params.event == 'payout.rejected') {
				console.log('razopay webhook in state*****',params.event);
				let payoutData = params.payload && params.payload.payout && params.payload.payout.entity ? params.payload.payout.entity : {};
				if(payoutData && payoutData.id){
					let payoutStatus =  await RazopayPayoutStatus.findOne({pauout_id:payoutData.id});
					if(payoutStatus.withdraw_id && payoutStatus.transaction_id){
						let transStatus = TransactionTypes.TRANSACTION_REJECT;
						await WithdrawRequest.updateOne({ '_id': payoutStatus.withdraw_id }, { $set: { request_status: 2, approve_date: approveDate, message: "payout reversed from hook" } });
						await Transaction.updateOne({ '_id': payoutStatus.transaction_id }, { $set: { added_type: parseInt(transStatus), approve_withdraw: approveDate, message: "payout reversed from hook" } });
					}
				}
			} else {
				console.log('razopay webhook in other state*****',params.event);
			}
		}
	} catch (error) {
		res.send(ApiUtility.failed(error.message));
	}
};