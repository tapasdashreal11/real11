const Users = require("../../../models/user");
const BankDetails = require("../../../models/user-bank-details");
const logger = require("../../../../utils/logger")(module);
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const config = require('../../../config');
const request = require('request');
const _ = require('lodash');

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			account_no: "required",
			bank_name: "required",
			branch: "required",
			ifsc_code: "required"
		};

		let validator = new Validator(params, constraints);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields missing !";
			response["errors"] = validator.errors;
			return res.json(response);
		}

		try {
			let userId = req.userId;
			let user = await Users.findOne({ _id: userId });
			if (user) {
				bankVerificationToken(params, function(resToken) {
					// console.log(resToken.token)
					if(resToken.status == true && resToken.token) {
						bankVerification(params, user.phone, resToken.token, function(veriyRes) {
							// console.log("ddddd", veriyRes);
							let bankDetail = await BankDetails.findOne({ user_id: userId });
							let updatedData = {};
							updatedData.account_number = params.account_no || null;
							updatedData.ifsc_code = params.ifsc_code || null;
							updatedData.bank_name = params.bank_name || null;
							updatedData.branch = params.branch || null;
							updatedData.beneficiary_id = null;
							updatedData.user_id = userId;
							if (params.image) {
								updatedData.bank_image = params.image;
							}
							if (!bankDetail) {
								await BankDetails.create(updatedData);
							} else {
								const result = await BankDetails.updateOne({ user_id: user._id }, { $set: updatedData });
							}
							let currentDate = Date.now();
							await Users.updateOne({ _id: userId }, { $set: { bank_account_verify: 1, bank_request_date: currentDate } });
							response["message"] = "Bank detail updated successfully.";
							response["status"] = true;
							response["data"] = updatedData;
							return res.json(response);
						});
					} else {
						
					}
				});
				return false;
			} else {
				response["message"] = "Invalid User id.";
				return res.json(response);
			}
		} catch (err) {
			console.log('catch', err);
			response["msg"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		logger.error("LOGIN_ERROR", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};


async function bankVerificationToken(bankData, cb) {
	if (!_.isEmpty(bankData)) {
		var options = {
			"method": "POST",
			"url": config.BANK_VERIFY_API.URL + "payout/v1/authorize",
			"headers": { 'X-Client-Id': process.env.CASHFREE_CLIENT_ID, 'X-Client-Secret': process.env.CASHFREE_CLIENT_SECRET },
		};
		request(options, function (error, res, body) {
			let bodyRes	=	JSON.parse(body)
			if(bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.token) {
				cb({"status":true,token:bodyRes.data.token});
			} else {
				cb({"status":false});
			}
		});
	} else {
		cb({"status":false});
	}
}

async function bankVerification(bankData, phoneNo, token, cb) {
	// console.log(bankData.account_holder_name);
	// return false;
	if (!_.isEmpty(bankData) && !_.isEmpty(token)) {
		var options = {
			"method": "GET",
			"url": config.BANK_VERIFY_API.URL + "payout/v1/asyncValidation/bankDetails?name=" + bankData.account_holder_name + "&phone=" + phoneNo + "&bankAccount=" + bankData.account_no + "&ifsc=" + bankData.ifsc_code,
			"headers": { 'Accept': "application/json", 'Authorization': "Bearer "+token },
		};
		console.log(options);
		request(options, function (error, res, body) {
			let bodyRes	=	JSON.parse(body)
			// console.log(bodyRes);
			if(bodyRes && bodyRes.status == "SUCCESS" && bodyRes.data && bodyRes.data.accountExists && bodyRes.data.accountExists == "YES") {
				cb({"status":true,token:bodyRes.data.bvRefId});
			} else {
				cb({"status":false});
			}
		});
	} else {
		cb({"status":false});
	}
}