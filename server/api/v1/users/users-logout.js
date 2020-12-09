const { ObjectId } = require('mongodb');
const Tokens = require("../../../models/token");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);

// @params

// {
//   "user_id" : "827",
//   "language" : "en"
// }

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = { user_id: "required", language: "required" };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing";
      response["errors"] = validator.errors;
      return res.json(response);
    }

    try {
      let token = req.headers['token'] || '';
      response["message"] = "Logout successfully";
      let result = await Tokens.deleteOne({ token:token  });
// console.log('result',result,token);
      response["status"] = true;
      response["data"] = [];
      return res.json(response);

    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    response["message"] = err.message;
    return res.json(response);
  }
};
