const BankDetails = require("../../../models/user-bank-details");
const WithdrawRequests = require("../../../models/withdraw_requests");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const config = require("../../../config");
const logger = require("../../../../utils/logger")(module);
const { rowTextToJson } = require("../common/helper");
const moment = require('moment');
const { isAbstractType } = require("graphql");
const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac");

// @params
// {
//   "user_id" : "827",
//   "language" : "en"
// }

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    // let params = req.body;
    // let constraints = { user_id: "required", language: "required" };

    // let validator = new Validator(params, constraints);
    // let matched = await validator.check();
    // if (!matched) {
    //   response["message"] = "Required fields missing";
    //   response["errors"] = validator.errors;
    //   return res.json(response);
    // }

    try {
      let userId = req.userId;
      let user = await BankDetails.findOne({ user_id: userId }).populate('user_id','winning_balance');
      // console.log('ddsf',user);return false;
      // console.log(user);
      // return false;
      if (user) {
        let currentDate = moment().format('YYYY-MM-DD');
        let userWithdraw = await WithdrawRequests.findOne({ user_id: userId, is_instant:true, refund_amount:{$gte:10000}, created: {$gte: (moment(currentDate+"T00:00:00.000Z").toISOString()), $lte: (moment(currentDate+"T23:59:59.000Z").toISOString())}  });
        // console.log(userWithdraw);
        // return false;
        const userData = rowTextToJson(user);
        let userFundAc = await UserRazopayFundAc.findOne({ user_id: userId });
        
        let data = userData;
        data.account_no = userData.account_number;
        data.min_withdraw_amount = config.min_withdraw_amount || 0; 
        data.winning_balance = userData.user_id.winning_balance || 0; 
        data.is_fast_withdraw = false;
        data.withdraw_allow_option = ['bank','paytm'];
        if(!userWithdraw) {
          data.is_fast_withdraw  = true;
        }
        if (userFundAc && userFundAc.contact_id && userFundAc.fund_account_id) {
          data. is_user_fund_ac = true;
        } else {
          data. is_user_fund_ac = false;
        }
        response["message"] = "Successfully";
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
