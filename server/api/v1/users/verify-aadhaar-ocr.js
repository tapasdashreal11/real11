const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require("lodash");
const AadhaarDetails = require("../../../models/aadhar-details");
const request = require("request");

const verifyAadhaarOcr = async (req, res, next) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    const { front_image, back_image, verification_id } = req.body;
    console.log({ front_image, back_image, verification_id });
    const { userId } = req;
    const constraints = {
      front_image: "required",
      back_image: "required",
      verification_id: "required",
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
      url: `${process.env.CASHFREE_ENDPOINT_AADHAAR}verification/document/aadhaar`,
      headers: {
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
        "Content-Type": "multipart/form-data",
      },
      formData: {
        verification_id,
        front_image,
        back_image,
      },
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

        if (statusCode === 200) {
          if (resBody.valid) {
            const aadhaarData = {
              ...resBody,
              user: userId,
              isVerified: true,
              verifiedThrough: "Ocr",
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

module.exports = verifyAadhaarOcr;
