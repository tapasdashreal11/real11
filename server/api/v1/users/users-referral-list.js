const async = require('async');
const ReferralCodeDetails = require("../../../models/user-referral-code-details");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const ModelService = require("../../ModelService");

// @params

// {
//   "user_id" : "5e68a11adafea822187ce735",
//   "language" : "en"
// }

// @response
// {"response":{"status":true,"message":null,"data":{"total_earnd":0,"to_be_earnd":0,"total_fields":0,"friend_detail":[]}}}


module.exports = async (req, res) => {
  try {
    // console.log(req.params);
    // return false;
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = { user_id: "required", language: "required"};

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing";
      response["errors"] = validator.errors;
      return res.json(response);
    }
    // console.log(req.body);
    // return false;
    try {
      let userId = req.userId;
      
      const { pagesize, page} = req.params;
      let skip = (page - 1) * (pagesize);
      let pageSize= (pagesize) ? parseInt(pagesize) : 25;
      let user = await (new ModelService(ReferralCodeDetails)).referralUserList(userId,skip,pageSize);
      // let user = await ReferralCodeDetails.find({ refered_by: new ObjectId(userId) }).populate('refered_by');
      
      if (user) {
        response["message"] = null;
        response["status"] = true;
        response["data"] = user;
        return res.json(response);
      } else {
        response["message"] = "No Records found.";
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
