const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const request = require("request");
const _ = require("lodash");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    // let params = req.body;
    const { userId } = req;
    const { aadhaar_number } = req.body;
    let constraints = {
      aadhaar_number: "required",
    };

    const validator = new Validator(req.body, constraints);
    const matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields are Empty.";
      response["errors"] = validator.errors;
      return res.status(500).json(response);
    }
    const options = {
      method: "POST",
      url: `${process.env.CASHFREE_ENDPOINT_AADHAAR}verification/document/aadhaar`,
      headers: {
        "Content-Type": "application/json",
        "x-client-id": process.env.CASHFREE_CLIENT_ID,
        "x-client-secret": process.env.CASHFREE_CLIENT_SECRET,
      },
      body: JSON.stringify({
        aadhaar_number,
      }),
    };
    console.log(options);
    request(options, async function (error, resBody) {
      if (error) {
        console.log(error.message);
        response["message"] =
          "Something went wrong, please try after some time!!";
        return res.status(500).json(response);
      }

      const { statusCode } = resBody;
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
