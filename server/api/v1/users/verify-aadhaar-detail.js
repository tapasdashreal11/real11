const { ObjectId } = require("mongodb");
const Users = require("../../../models/user");
const Settings = require("../../../models/settings");
// const Transaction = require('../../../models/transaction');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const { TransactionTypes } = require("../../../constants/app");
const config = require("../../../config.js");
const redis = require("../../../../lib/redis.js");
// const { sendSMTPMail, sendNotificationFCM, sendMailToDeveloper } = require("../common/helper.js");
// const https = require('https');
// const { parse } = require('url')
// const UserRazopayFundAc = require("../../../models/razopay-contact-fund-ac")
// const { razopayPayoutToUserFundAc } = require("./razopay-contact-fund-ac")
// const RazopayPayoutStatus = require("../../../models/razopay-payout-status")
const { startSession } = require("mongoose");
const moment = require("moment");
const request = require("request");
const _ = require("lodash");
const AadhaarDetails = require("../../../models/aadhar-details");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    console.log("**body**", req.body);
    let userId = req.userId;
    let constraints = {
      aadhaar_number: "required",
    };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields are Empty.";
      response["errors"] = validator.errors;
      return res.json(response);
    }
    var options = {
      method: "POST",
      url:
        process.env.CASHFREE_ENDPOINT_AADHAAR +
        "verification/offline-aadhaar/otp",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      },
      body: JSON.stringify({
        aadhaar_number: params.aadhaar_number,
      }),
    };
    console.log(options);
    request(options, async function (error, resBody) {
      if (error) {
        console.log(error.message);
        response["message"] =
          "Something went wrong, please try after some time!!";
        return res.json(response);
      }

      const { statusCode } = resBody;
      console.log({ statusCode }, typeof statusCode);
      const responseBody = JSON.parse(resBody.body);

      if (resBody && !_.isEmpty(responseBody)) {
        console.log("****body type****", responseBody);

        response["message"] = responseBody?.message;
        response["code"] = responseBody?.code;

        if (statusCode === 200) {
          response["status"] = true;
          response["ref_id"] = responseBody?.ref_id;
        } else {
          response["status"] = false;
        }

        if (responseBody?.error) response["error"] = responseBody?.error;

        console.log({ response });
        return res.status(statusCode).json(response);
      }
    });

    // 		curl --location --request POST 'http://localhost:4500/api/v1/verify-aadhaar-detail' \
    // --header 'Authorization: JWT eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsYW5ndWFnZSI6ImVuIiwiX2lkIjoiNjM5OTY3NGFjNzY5YTAyMGRmNjBkNjk3IiwiaWQiOiI2Mzk5Njc0YWM3NjlhMDIwZGY2MGQ2OTciLCJwaG9uZSI6IjIyMjMzMzQ0NDEiLCJlbWFpbCI6InBvb25hbUByZWFsMTEuY29tIiwiaWF0IjoxNjc0NjUyMzg1LCJleHAiOjE3MDA1NzIzODV9.ixYsCFVaB_GAnkiM3ZAkUipD0-4CiiubrSWYM94cNvQ' \
    // --header 'Content-Type: application/json' \
    // --header 'Cookie: session=s%3AcEwq8RG7fcZ42zpzVs3ZroFY8ntfX_-u.noBscbRgwWTB6ICdS7eOVYBWVMkHp2BTHlDnOWqdSOo' \
    // --data-raw '{
    //     "aadhaar_number": "504281662701"
    // }'
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
