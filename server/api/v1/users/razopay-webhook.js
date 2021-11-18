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
		if (params && params.entity) {
			if (params.event == 'payout.processed') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			} else if (params.event == 'payout.reversed') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			} else if (params.event == 'payout.failed') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			} else if (params.event == 'payout.updated') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			} else if (params.event == 'payout.rejected') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			} else if (params.event == 'payout.queued') {
				var paramsData = JSON.parse(JSON.stringify(params));
				console.log(" webhook in****", paramsData);
				let payoutData = params.payload && params.payload.payout ? params.payload.payout : [];
				console.log(" payoutData in****", payoutData);
			}




		}


	} catch (error) {
		res.send(ApiUtility.failed(error.message));
	}
};