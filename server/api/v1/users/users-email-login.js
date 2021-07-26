const { ObjectId } = require('mongodb');

const Tokens = require("../../../models/token");
const Users = require("../../../models/user");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");

const logger = require("../../../../utils/logger")(module);
const { generateClientToken } = require("../common/helper");
const { RedisKeys } = require('../../../constants/app');
const ReferralCodeDetails = require('../../../models/user-referral-code-details');
const redis = require('../../../../lib/redis');

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			device_id: "required",
			email: "required",
			password: "required",
			device_type: "required"
		};

		let validationMessages = {
			device_id: "Device ID is required",
			email: "Email is required",
			password: "Password is required",
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
			let user = await Users.findOne({ email: params.email, password: params.password }).lean();
			
			if (user) {
				if(user.status == 1) {
					var finalResponse ={};
					finalResponse = user;
					finalResponse["fair_play_user"]= user.user_type;
					
					let tokendata = {};
	
					tokendata.language	=	user.language;
					tokendata._id		=	user._id;
					tokendata.id		=	user._id;
					tokendata.phone		=	user.phone;
					tokendata.email		=	user.email;
					await Tokens.deleteMany({"userId":ObjectId(user._id)});
					let token = await generateClientToken(tokendata);
					
	
					await Users.updateOne({ _id: user._id }, { $set: { otp: '', otp_time: '', token: token, device_id: params.device_id, device_type: params.device_type } });
					response["message"] = "Logged-in successfully.";         
	
					let tokenInsertData		=	{};
					tokenInsertData.userId	=	new ObjectId(user._id);
					tokenInsertData.token	=	token;
					tokenInsertData.device_id	=	params.device_id;
					tokenInsertData.device_type	=	params.device_type;
					
					finalResponse.token = token;

					try{
						let referalUser = await ReferralCodeDetails.findOne({ user_id: user._id });
						if (referalUser && referalUser.referal_code) {
							finalResponse.refered_by_code = referalUser.referal_code;
						}
					} catch(errrrr){
						
					}
	
					//****************Set Toen In Redis**************** */
					var newTokenObj = {user_id : user._id, token : token}
					redis.setRedisLogin(RedisKeys.USER_AUTH_CHECK + user._id, newTokenObj);
					//******************************* */
	
					Tokens.create(tokenInsertData);
					delete finalResponse.password;
					delete finalResponse.otp;
					delete finalResponse.user_type;  
					
					response["status"]	=	true;
					response["token"]	=	token;
					response["data"]	=	finalResponse;
					return res.json(response);
				} else {
					response["message"] = "Please verify your phone number before email login.";
					return res.json(response);
				}

			} else {
				response["message"] = "Invalid login details";
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
