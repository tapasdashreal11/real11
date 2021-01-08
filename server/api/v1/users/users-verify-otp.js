const { ObjectId } = require('mongodb');

const Tokens = require("../../../models/token");
const Users = require("../../../models/user");
const EmailTemplate = require("../../../models/email");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const config = require('../../../config');
const ejs = require('ejs');
const path = require('path');

const logger = require("../../../../utils/logger")(module);
const { generateClientToken, sendMail, sendSMTPMail} = require("../common/helper");
const { RedisKeys } = require('../../../constants/app');
const redis = require('../../../../lib/redis');

module.exports = async (req, res) => {
	try {
		// console.log('enter');
		// return false;
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			is_signup: "required",
			language: "required",
			// device_id: "required",
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
				tokendata.phone = user.phone;
				tokendata.email = user.email;

				var tokelDelMany = await Tokens.deleteMany({"userId":ObjectId(user._id)});
				let token = await generateClientToken(tokendata);        
				await Users.update({ _id: user._id }, { $set: { otp: '', otp_time: '', token: token, device_id: params.device_id, device_type: params.device_type,status:1 } });
	
				if(params.is_signup == true) {
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
				// console.log(finalResponse);return false;
				Tokens.create(tokenInsertData);
				delete finalResponse.password;
				delete finalResponse.otp;

				//****************Set Toen In Redis**************** */
				var newTokenObj = {user_id : user._id, token : token}
				redis.setRedis(RedisKeys.USER_AUTH_CHECK + user._id, newTokenObj);
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
