const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require("lodash");
const AadhaarDetails = require("../../../models/aadhar-details");
const Users = require("../../../models/user");
const request = require("request");

const submitAadhaarOtp = async (req, res, next) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    console.log("**body**", req.body);
    const { userId } = req;
    const { otp, ref_id } = req.body;
    console.log({ userId, otp, ref_id });
    const constraints = {
      otp: "required",
      ref_id: "required",
    };

    const validator = new Validator(req.body, constraints);
    const matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields are Empty.";
      response["errors"] = validator.errors;
      return res.status(400).json(response);
    }

    const options = {
      method: "POST",
      url:
        process.env.CASHFREE_ENDPOINT_AADHAAR +
        "verification/offline-aadhaar/verify",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      },
      body: JSON.stringify({
        otp,
        ref_id,
      }),
    };
    request(options, async (error, resp) => {
      if (error) {
        console.log(error.message);
        response["message"] =
          "Something went wrong, please try after some time!!";
        return res.status(500).json(response);
      }
      const { statusCode } = resp;
      const resBody = JSON.parse(resp.body);

      if (resp && !_.isEmpty(resBody)) {
        console.log("****body type****", resBody);

        response["message"] = resBody?.message;
        response["code"] = resBody?.code;

        const { isAadhaarVerified } = await Users.findOne({ _id: userId });

        if (statusCode === 200) {
          if (!isAadhaarVerified) {
            const aadhaarData = {
              ...resBody,
              user: userId,
              isVerified: true,
              verifiedThrough: "OTP",
            };
            await AadhaarDetails.addData(aadhaarData);
          }
          response["status"] = true;
          response["ref_id"] = resBody?.ref_id;
        } else {
          response["status"] = false;
        }

        if (resBody?.error) response["error"] = resBody?.error;

        console.log({ response });
        return res.status(statusCode).json(response);
      }
    });
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};

module.exports = submitAadhaarOtp;
