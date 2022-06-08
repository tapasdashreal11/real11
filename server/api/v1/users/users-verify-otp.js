const { ObjectId } = require('mongodb');
const Tokens = require("../../../models/token");
const Users = require("../../../models/user");
const Transaction = require("../../../models/transaction");
const EmailTemplate = require("../../../models/email");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const config = require('../../../config');
const ejs = require('ejs');
const path = require('path');
const _ = require('lodash');
const logger = require("../../../../utils/logger")(module);
const { generateClientToken, sendSMTPMail} = require("../common/helper");
const {TransactionTypes, RedisKeys } = require('../../../constants/app');
const redis = require('../../../../lib/redis');
const ReferralCodeDetails = require('../../../models/user-referral-code-details');
const Real11ReferalCodeModel = require('../../../models/real-ref-code-model');
const UserGaidModel = require('../../../models/user-gaid-model');
const { appsFlyerEntryService } = require("./appsflyer-api");
var sha256 = require('sha256');
const { facebookEntryService } = require("./facebook-api");

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
		let params = req.body;
		let constraints = {
			is_signup: "required",
			language: "required",
			user_id: "required",
			otp: "required",
			device_type: "required"
		};

		let validationMessages = {
			is_signup: "Signup key is required",
			language: "Language is required",
			// device_id: "Device ID is required",
			user_id: "UserId is required",
			otp: "Otp is required",
			device_type: "Device Type is required"
		};
		
		let validator = new Validator(params, constraints, validationMessages);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields missing";

			let finalErrorMsg = '';
			let err = validator.errors;
			Object.entries(err).map(
				([key, val]) => {
					finalErrorMsg = finalErrorMsg + ' - ' + val.message + ' \n\n'
				}
			)
			response["errors"] = finalErrorMsg;
			return res.json(response);
		}

		try {
			let user = await Users.findOne({ _id: params.user_id, otp: params.otp }).lean();
			if (user) {
				var finalResponse ={};
				finalResponse = user;
				let responseMsz = "Otp verified successfully.";
				finalResponse.is_youtuber = (finalResponse.is_youtuber == 1) ? true : false;
				let tokendata = {};
				tokendata.language = user.language;
				tokendata._id = user._id;
				tokendata.id = user._id;
				tokendata.phone = user && user.phone ? user.phone: user.temp_phone;
				tokendata.email = user.email;
				
				var tokelDelMany = await Tokens.deleteMany({"userId":ObjectId(user._id)});
				let token = await generateClientToken(tokendata);
				let updateObj = { otp: '', otp_time: '', token: token, device_id: params.device_id, device_type: params.device_type,status:1 } 
				try{
					if(user.user_gaid){
						let userGaidData = await UserGaidModel.findOne({user_gaid:user.user_gaid});
						if(userGaidData && userGaidData._id){
							if(params && params.phone && user && user.temp_phone && user.is_beginner_user && !_.isEmpty(user.temp_phone) && _.isEqual(user.temp_phone,params.phone)&& _.isEmpty(user.phone )){
								await UserGaidModel.findOneAndUpdate({_id:userGaidData._id},{$inc:{counter:1}});
							  }
							if(!user.xtra_cash_block && userGaidData.counter >=5){
								updateObj['xtra_cash_block'] = 1;
								updateObj['bonus_amount_block'] = 1;
							}
						} else {
							await UserGaidModel.create([{user_gaid:user.user_gaid,counter:1}]);
						}
					}
				}catch(err_gaid){}
				if(params && params.phone && user && user.temp_phone && user.is_beginner_user && !_.isEmpty(user.temp_phone) && _.isEqual(user.temp_phone,params.phone)&& _.isEmpty(user.phone )){
					updateObj['phone'] = user.temp_phone;
					updateObj['temp_phone'] = '';
					finalResponse['phone'] = user.temp_phone;
					finalResponse['temp_email'] = user && user.temp_email ? user.temp_email : "";
					let rf_bonous_amount = config.referral_bouns_amount;
					let rf_xtra_amount = 0;
					try{
						let referalUser = await ReferralCodeDetails.findOne({ user_id: user._id },{referal_code:1,sub_referal_code:1});
						if (referalUser && referalUser.sub_referal_code && _.isEqual(referalUser.sub_referal_code,"IPL200")) {
							let realRefData = await Real11ReferalCodeModel.findOneAndUpdate({referal_code:referalUser.referal_code,use_status:1},{ $set: { use_status: 2,user_id:user._id} }, { new: true });
							 if(realRefData && realRefData._id){
								rf_xtra_amount = 75;
								responseMsz = "Otp verified successfully!!"
							 } else {
								responseMsz = "Otp verified successfully.Your applied referal code has been out!!"
                               if(user && user.extra_amount>0)updateObj['extra_amount'] = 0;
							}
						} else if (referalUser && referalUser.referal_code && _.isEqual(referalUser.referal_code,"RWC100")) {
							rf_xtra_amount = 75;
						}
					}catch(errrrr){}
					updateObj.bonus_amount = rf_bonous_amount;
					await transactionAtSignupBonous(user._id,rf_bonous_amount,rf_xtra_amount);
					setDataToAppsflyer(user);
					setFacebookEventAtSingup(user,userIp);
				} else {
					finalResponse['temp_email'] = user && user.email ? user.email : (user && user.temp_email ? user.temp_email : (user && user.new_email ? user.new_email : ""));
				} 
				      
				await Users.updateOne({ _id: user._id }, { $set:updateObj });
	
				if(params.is_signup == true && user && user.email && !_.isEmpty(user.email)) {
					console.log('enter');
					ejs.renderFile(path.join(__dirname, "../../../../views/email-templates/user-registration/html.ejs"), {
						username  : user.email,
					})
					.then(emailTemplate => {
						const to  = user.email;
						// const from = config.smtp.fromEmail;
						const subject = "Registration";
						const message  =  emailTemplate;
						sendSMTPMail(to, subject, message);
					}).catch(err => {
						response["message"] = err.message;
						return res.json(response);
					});
				}
				
				response["message"] = responseMsz;

				let tokenInsertData = {};
				tokenInsertData.userId = new ObjectId(user._id);
				tokenInsertData.token = token;
				tokenInsertData.device_id = params.device_id;
				tokenInsertData.device_type = params.device_type;
				finalResponse.token = token;
				try{
					let referalUser = await ReferralCodeDetails.findOne({ user_id: user._id });
					if (referalUser && referalUser.referal_code) {
						finalResponse.refered_by_code = referalUser.referal_code;
					}
				}catch(errrrr){}

				Tokens.create(tokenInsertData);
				delete finalResponse.password;
				delete finalResponse.otp;

				//****************Set Toen In Redis**************** */
				var newTokenObj = {user_id : user._id, token : token}
				redis.setRedisLogin(RedisKeys.USER_AUTH_CHECK + user._id, newTokenObj);
				//************************************************************** */
								
				response["status"] = true;
				response["token"] = token;
				response["data"] = finalResponse;
				return res.json(response);

			} else {
				response["message"] = "Wrong OTP entered, please try again !";
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

/**
 * This is used to generate the transaction for new signup user for bonous
 * @param {*} userId 
 * @param {*} rf_bonous_amount 
 * @param {*} rf_xtra_amount 
 */
async function transactionAtSignupBonous(userId,rf_bonous_amount,rf_xtra_amount){
	let date = new Date();
	let transaction_data =[
		{
			user_id: userId,
			txn_amount: rf_bonous_amount,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
			added_type: TransactionTypes.SIGNUP_BONOUS_REWARD,
			details: {
				"refund_winning_balance": 0,
				"refund_cash_balance": 0,
				"refund_bonus_amount": rf_bonous_amount,
				"refund_extra_amount": 0,
				"refund_affiliate_amount": 0,
				"current_winning_balance": 0,
				"current_cash_balance": 0,
				"current_bonus_amount": rf_bonous_amount,
				"current_extra_amount": 0,
				"current_affiliate_amount": 0,
			}
		}
	]
	if(rf_xtra_amount>0){
		transaction_data.push({
			user_id: userId,
			txn_amount: rf_xtra_amount,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
			added_type: TransactionTypes.REAL_CODE_SIGNUP_XCASH_REWARD,
			details: {
				"refund_winning_balance": 0,
				"refund_cash_balance": 0,
				"refund_bonus_amount":0,
				"refund_extra_amount": rf_xtra_amount,
				"refund_affiliate_amount": 0,
				"current_winning_balance": 0,
				"current_cash_balance": 0,
				"current_bonus_amount": rf_bonous_amount,
				"current_extra_amount": rf_xtra_amount,
				"current_affiliate_amount": 0,
			}
		});
	}
	await Transaction.create(transaction_data);
}

/**
 *This is used to set data for new signup to appsflyer when user don't set any referal code
 * @param {*} params 
 */
async function setDataToAppsflyer(params){
    try {
		let eName = params && params.app_source == "playstore" ? "SignUp":"SignUp";
        let appsflyerURL = "";
        if (params && params.device_type) {
            if (params.device_type == "Android") {
				appsflyerURL = config.appsFlyerAndroidUrl;
				if(params && params.app_source == "playstore"){
					appsflyerURL = config.appsFlyerAndroidPlaystorUrl;
				}
            } else {
				appsflyerURL = config.appsFlyeriPhoneUrl;
            }
        }
        if (params && params.appsflayer_id) {
            let event_val = {
                "appsflyer_id": params.appsflayer_id || '',
                "af_customer_user_id": params.clevertap_id || '',
				"af_email": params.email || '',
                "af_mobile": params.temp_phone || '',
                'advertising_id': params && params.user_gaid ? params.user_gaid : ''
            };
            var signUpBody = {
                "eventName": eName,
                "appsflyer_id": params.appsflayer_id || '',
                "customer_user_id": params._id || '',
                "eventTime": new Date(),
                'advertising_id': params && params.user_gaid ? params.user_gaid : '',
				"eventValue": JSON.stringify(event_val)
			};
			appsFlyerEntryService(signUpBody, appsflyerURL);
			// This code is block till IPL
           /* if (!params.is_refered_by) {
				appsFlyerEntryService(signUpBody, appsflyerURL);
				
            }*/
        }

    } catch (errr) {
        console.log('errr', errr);
    }
}

/**
 * Set Faceook event for new singup
 * @param {*} params 
 * @param {*} userIp 
 */
async function setFacebookEventAtSingup(params,userIp){
    try {

		let fb_event = {
			"data": [
				{
					"event_name": "CompleteRegistration",
					"event_time": parseInt(new Date().getTime() / 1000),
					"event_source_url": "real11.com/s2s",
					"opt_out": false,
					"event_id": Math.floor(1000000 + Math.random() * 9000000),
					"user_data": {
						"em": params && params.email ? sha256(params.email) : (params && params.temp_email ?sha256(params.temp_email):null),
						"ph": params && params.temp_phone ? sha256(params.temp_phone) : null,
						"external_id":params && params._id ? params._id:null,
						"client_ip_address": userIp ? userIp: "172.17.0.5",
						"client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
					},
					"custom_data": {
						"value": 1,
						"currency": "INR",
						"status":"registered"
					},
					"action_source": "app"
				}
			]
		}
		let db_prmas ={
			"event_name": "CompleteRegistration",
			"em": params && params.email ? params.email : null,
			"ph": params && params.temp_phone ? params.temp_phone : null,
			"client_ip_address": userIp ? userIp: ""
		};
	   facebookEntryService(fb_event, db_prmas);
	} catch (errfb) { 
		console.log('error in fb***8',errfb);
	}

}