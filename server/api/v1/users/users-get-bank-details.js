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
const { sendSMTPMail } = require("../common/helper.js");
const redis = require('../../../../lib/redis');
const AppSettings = require("../../../models/settings");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    try {
      let userId = req.userId;
      let user = await BankDetails.findOne({ user_id: userId }).populate('user_id', 'winning_balance');
      if (user) {
        let currentDate = moment().format('YYYY-MM-DD');
        let userWithdraw = await WithdrawRequests.findOne({ user_id: userId, is_instant: true, refund_amount: { $gte: 10000 }, created: { $gte: (moment(currentDate + "T00:00:00.000Z").toISOString()), $lte: (moment(currentDate + "T23:59:59.000Z").toISOString()) } });
        const userData = rowTextToJson(user);
        let userFundAc = await UserRazopayFundAc.findOne({ user_id: userId });

        let data = userData;
        data.account_no = userData.account_number;
        data.min_withdraw_amount = config.min_withdraw_amount || 0;
        data.winning_balance = userData.user_id.winning_balance || 0;
        data.is_fast_withdraw = false;
        data.withdraw_allow_option = ['bank'];
        if (!userWithdraw) {
          data.is_fast_withdraw = true;
        }
        if (userFundAc && userFundAc.contact_id && userFundAc.fund_account_id) {
          data.is_user_fund_ac = true;
        } else {
          data.is_user_fund_ac = false;
          sendEmailToDev(userId);
        }
        try {
          redis.getRedis('app-setting', async (err, settingData) => {
            if (settingData) {
              if (settingData && settingData.is_instant_withdraw === 1) {
                data['withdraw_message'] = settingData && settingData.instant_withdraw_msg ? settingData.instant_withdraw_msg : "";
              } else {
                data['withdraw_message'] = "";
              }
            } else {
              let appSettingData = await AppSettings.findOne({}, { is_instant_withdraw: 1, instant_withdraw_msg: 1 });
              if (appSettingData && appSettingData.is_instant_withdraw === 1) {
                data['withdraw_message'] = appSettingData ? (appSettingData.instant_withdraw_msg) : "";
              } else {
                data['withdraw_message'] = "";
              }
            }
            response["message"] = "Successfully";
            response["status"] = true;
            response["data"] = data;
            return res.json(response);
          });
        } catch (setting_err) {
          data.withdraw_message = "";
          response["message"] = "Successfully";
          response["status"] = true;
          response["data"] = data;
          return res.json(response);
        }

        // data.withdraw_message = ""; //"Instant withdraw is temporarily paused, will resume shortly.";

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

async function sendEmailToDev(user_id) {
  try {
    let to = "developer@real11.com";
    let subject = 'Real11 user failed at fund account';
    let message = '<table><tr><td>Dear Team,</td></tr><tr><td>We have one user to face fund account problem <br><br/> User id ' + user_id + '</td></tr><tr><td><br /><br />Thank you <br />Real11</td></tr></table>';
    // send mail on low balance
    sendSMTPMail(to, subject, message);

  } catch (error_notif) { }
}