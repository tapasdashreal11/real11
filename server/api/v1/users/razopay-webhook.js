const { ObjectId } = require('mongodb');
const Users = require("../../../models/user");
const Transaction = require('../../../models/transaction');
const WithdrawRequest = require("../../../models/withdraw_requests");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const { TransactionTypes } = require('../../../constants/app');
const { sendSMTPMail, sendNotificationFCM, sendMailToDeveloper } = require("../common/helper.js");
const https = require('https');
const { parse } = require('url');
const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac");
const { razopayPayoutToUserFundAc } = require("./razopay-contact-fund-ac");
const RazopayPayoutStatus = require("../../../models/razopay-payout-status");
const crypto = require('crypto');


module.exports = async (req, res) => {
	var response = { status: false, message: "", data: {} };
	var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
	let params = req.body;
	let approveDate = new Date();
	var host = req.headers; 
	const secret = '123456789';
	console.log('host*****',host);
	try {

		const shasum = crypto.createHmac('sha256', secret);
		shasum.update(JSON.stringify(req.body));
		const signature  = shasum.digest('hex');
		const x_rzopay_signature  = host['x-razorpay-signature'];
		console.log("signature",signature,"x_rzopay_signature",x_rzopay_signature);
		if(signature === x_rzopay_signature){
			console.log('we are in write way at hook****');
			if (params && params.entity) {
				if (params.event == 'payout.processed') {
					console.log('razopay webhook in state*****', params.event);
					let payoutData = params.payload && params.payload.payout && params.payload.payout.entity ? params.payload.payout.entity : {};
					console.log('payoutData in hook', payoutData);
					if (payoutData && payoutData.id) {
						let pId = payoutData.id;
						let payoutStatus = await RazopayPayoutStatus.findOne({ payout_id: pId });
						if (payoutStatus && payoutStatus.withdraw_id && payoutStatus.transaction_id) {
							let transStatus = TransactionTypes.TRANSACTION_CONFIRM;
							let userId = payoutStatus.user_id;
							let txnAmount = payoutStatus.txn_amount ? parseFloat(payoutStatus.txn_amount) : 0;
							let user = await Users.findOne({ _id: userId });
							await WithdrawRequest.updateOne({ '_id': payoutStatus.withdraw_id }, { $set: { request_status: 1, approve_date: approveDate, message: "processed" } });
							await Transaction.updateOne({ '_id': payoutStatus.transaction_id }, { $set: { added_type: parseInt(transStatus), approve_withdraw: approveDate, message: "processed from hook" } });
							let title = 'withdraw Request confirmed';
							let notification = 'Your withdraw request has been confirmed';
							await sendNotificationToUser(userId, user, txnAmount, title, notification, true);
						}
					} else {
						console.log(" payoutData in hook for processed condi****", payoutData);
					}
					response["status"] = true;
					response["data"] = {};
					return res.json(response);
	
	
				} else if (params.event == 'payout.reversed' || params.event == 'payout.failed' || params.event == 'payout.rejected' || params.event == 'payout.cancelled') {
					console.log('razopay webhook in state*****', params.event);
					let mszOfEvent = "Hook case of " + params.event
					let payoutData = params.payload && params.payload.payout && params.payload.payout.entity ? params.payload.payout.entity : {};
					if (payoutData && payoutData.id) {
						let pId = payoutData.id;
						console.log('if hook', pId);
						let payoutStatus = await RazopayPayoutStatus.findOne({ payout_id: pId, reverse_status: 2 });
						if (payoutStatus.withdraw_id && payoutStatus.transaction_id) {
							let transStatus = TransactionTypes.TRANSACTION_REJECT;
							let txnAmount = payoutStatus.txn_amount ? parseFloat(payoutStatus.txn_amount) : 0;
							let userId = payoutStatus.user_id;
							await Users.updateOne({ _id: userId }, { $inc: { winning_balance: txnAmount } });
							await RazopayPayoutStatus.updateOne({ _id: payoutStatus._id }, { $set: { reverse_status: 1 } });
							await WithdrawRequest.updateOne({ '_id': payoutStatus.withdraw_id }, { $set: { request_status: 2, approve_date: approveDate, message: mszOfEvent } });
							await Transaction.updateOne({ '_id': payoutStatus.transaction_id }, { $set: { added_type: parseInt(transStatus), approve_withdraw: approveDate, message: mszOfEvent } });
	
	
						}
					}
					response["status"] = true;
					response["data"] = {};
					return res.json(response);
				} else {
					let payoutData = params.payload && params.payload.payout && params.payload.payout.entity ? params.payload.payout.entity : {};
	
					console.log('razopay webhook in other state*****', payoutData);
				}
			}
		}else{
			// some body hitting your server
			console.log('someone hitting your server******');
		}
		
	} catch (error) {
		res.send(ApiUtility.failed(error.message));
	}
};

async function sendNotificationToUser(userId, userDetail, refund_amount, title, notification, isSendEmail) {
	try {
		const deviceType = userDetail.device_type;
		const deviceToken = userDetail.device_id;
		let to = userDetail.email;
		let subject = 'Real 11 Withdraw Request';
		let message = '<table><tr><td>Dear user,</td></tr><tr><td>Your withdrawal request is confirmed of Rs. ' + refund_amount + '/- Make sure your withdrawal details are correct. <br><br/> In case any issue please mail us on support@real11.com</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';
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