const Users = require("../../../models/user");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const logger = require("../../../../utils/logger")(module);
const { rowTextToJson } = require("../common/helper");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data:{} };

    try {
      let userId = req.userId;
      let user = await Users.findOne({ _id: userId })
        .select('pen_verify bank_account_verify email email_verified phone pan_reject_reason bank_reject_reason');
      if (user) {
        const userData = rowTextToJson(user);
        let data = userData;
        data.mobile= user.phone || 0;
        data.bank_verify_mode = 2; // 0 for manual,1 for instatnt,2 for both(manual/instatnt)
        delete data.phone;

        response["message"] = null;
        response["status"] = true;
        response["data"] = data;
        return res.json(response);
      } else {
        response["message"] = "No data found";
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
