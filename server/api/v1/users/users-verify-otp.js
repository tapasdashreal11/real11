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
const { appsFlyerEntryService } = require("./appsflyer-api");

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
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
				if(params && params.phone && user && user.temp_phone && user.is_beginner_user && !_.isEmpty(user.temp_phone) && _.isEqual(user.temp_phone,params.phone)&& _.isEmpty(user.phone )){
					updateObj['phone'] = user.temp_phone;
					updateObj['temp_phone'] = '';
					finalResponse['phone'] = user.temp_phone;
					await transactionAtSignupBonous(user._id);
					setDataToAppsflyer(user);
					console.log('***** in for phone update');
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
				
				response["message"] = "Otp verified successfully.";

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
 */
async function transactionAtSignupBonous(userId){
	let date = new Date();
	let transaction_data =[
		{
			user_id: userId,
			txn_amount: 25,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
			added_type: TransactionTypes.SIGNUP_XTRA_CASH_REWARD
		},
		{
			user_id: userId,
			txn_amount: 50,
			currency: "INR",
			txn_date: Date.now(),
			local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
			added_type: TransactionTypes.SIGNUP_BONOUS_REWARD
		}
	]
	await Transaction.create(transaction_data);
}

/**
 *This is used to set data for new signup to appsflyer when user don't set any referal code
 * @param {*} params 
 */
async function setDataToAppsflyer(params){
    try {
        let appsflyerURL = "";
        if (params && params.device_type) {
            if (params.device_type == "Android") {
                appsflyerURL = config.appsFlyerAndroidUrl;
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
                "eventName": "SignUp",
                "appsflyer_id": params.appsflayer_id || '',
                "customer_user_id": params._id || '',
                "eventTime": new Date(),
                'advertising_id': params && params.user_gaid ? params.user_gaid : '',
                "eventValue": JSON.stringify(event_val)
            };

            if (!params.is_refered_by) {
                appsFlyerEntryService(signUpBody, appsflyerURL);
            }
        }

    } catch (errr) {
        console.log('errr', errr);
    }
}