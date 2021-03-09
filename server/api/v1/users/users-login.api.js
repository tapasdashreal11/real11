const Series = require("../../../models/series");
const Users = require("../../../models/user");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const logger = require("../../../../utils/logger")(module);
const { currentDateTimeFormat, sendSMTPMail } = require("../common/helper");

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = { user_name: "required", language: "required" };

		let validator = new Validator(params, constraints);
		let matched = await validator.check();
		if (!matched) {
			response["message"] = "Required fields missing";
			response["errors"] = validator.errors;
			return res.json(response);
		}

		try {
			let user = await Users.findOne({
				$or: [
					{ phone: params.user_name },
					{ email: params.user_name }
				]
			}).select(
				"_id phone status image user_id bonous_percent type full_name email"
			);
			if (user) {

				let data = user;

				var otp		=	Math.floor(100000 + Math.random() * 900000);
				user.otp	=	otp;
				let otp_time=	currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
				user.otp_time=	otp_time;

				data.otp	=	"0";
				data.otp_time=	otp_time;

				const msg = otp + " is the OTP for your Real11 account. Never share your OTP with anyone.";
				let userMobile = user.phone || '';
				sendSMS(userMobile, msg)
					.then(() => { })
					.catch(err => {
						console.log("error in sms API ", err);
						logger.error("MSG_ERROR", err.message);
					});
				
				let mailMessage	=	"<div><h3>OTP Request</h3><p>Hi,</p><p>You One Time Password(OTP) is <b>"+ otp +"</b></p><p>The password will expire in 10 minnutes if not used.</p><p>If you have not made this request, please contact our customer support immidiately.</p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>"
				let to	=	data.email;
				let subject	=	"One Time Password (OTP) login to Real11";
				
				sendSMTPMail(to, subject, mailMessage);

				response["message"] = "Otp has been sent on you registered mail and phone number, please enter otp to complete login.";
				// response["message"] = "Login successfully.";
				await Users.update({ _id: user._id }, { $set: { otp: otp, otp_time: otp_time } });

				response["status"] = true;
				response["data"] = data;
				return res.json(response);
			} else {
				response["data"] = {};
				response["message"] = "Mobile no / email is not registered with us.";
				return res.json(response);
			}
		} catch (err) {
			response["message"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		logger.error("LOGIN_ERROR", error.message);
		response["message"] = error.message;
		return res.json(response);
	}
};
