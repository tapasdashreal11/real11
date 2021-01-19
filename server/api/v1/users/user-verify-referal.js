const Users = require("../../../models/user");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let {invite_code} = req.params;
		try {
            if(invite_code && !_.isEmpty(invite_code)){
                var regCode = new RegExp(["^", invite_code, "$"].join(""), "i");
                let user = await Users.findOne({ refer_id: regCode, status: 1 });
                if (user) {
                    response["message"] = "Referal Code Verified Successfully.";
                    response["status"] = true;
                    response["data"] = {refer_by_id:user._id};
                    return res.json(response);
                } else {
                    response["message"] = "Wrong Referal Code, Please Try Again !";
                    return res.json(response);
                }
            } else {
                response["message"] = "Enter Referal Code!!";
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
