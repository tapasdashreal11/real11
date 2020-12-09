const Users = require("../../../models/user");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);

module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let params = req.body;
		let constraints = {
			password: "required",
			old_password: "required"
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
			let user = await Users.findOne({ _id: userId, password: params.old_password });
			if (user) {
				let updatedData = {};
				updatedData.password = params.password;
				response["message"] = "Password updated successfully.";
				const result = await Users.update({ _id: user._id }, { $set: updatedData });

				// console.log('result', result);
				response["status"] = true;
				response["data"] = updatedData;
				return res.json(response);
			} else {
				response["message"] = "Invalid Password !";
				return res.json(response);
			}
		} catch (err) {
			response["msg"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		logger.error("LOGIN_ERROR", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};
