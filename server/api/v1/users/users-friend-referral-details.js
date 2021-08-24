const async = require('async');
const ReferralCodeDetails = require("../../../models/user-referral-code-details");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);

// @params

// {
//   "user_id" : "5e68a11adafea822187ce735",
//   "language" : "en"
// }

// @response
// {"response":{"status":true,"message":null,"data":{"total_earnd":0,"to_be_earnd":0,"total_fields":0,"friend_detail":[]}}}


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
      let userId = req.userId;
      // console.log('userId', userId)
      let user = await ReferralCodeDetails.find({ refered_by: userId }).populate('user_id');
      // console.log(user);
      // return false
      if (user) {
        let responseData = [];
        let i = 0;

        let $totalEarnd = 0;
        let $toBeEarned = 0;
        let $userAmount = 0;

        async.eachSeries(user, function (data, cb) {
          if(data['user_id']) {
            let formated = {};
            formated.image = (data['user_id'] && data['user_id']['image']) || '';
            formated.team_name = (data['user_id'] && data['user_id']['team_name']) || '';
            formated.received_amount = (data['refered_by_amount']) || 0.00;
            formated.total_amount = (data['user_amount']) || 0.00;
            formated.first_depo_reward_amount = (data['first_depo_reward_amount']) || 0.00;
            responseData[i] = formated;
  
            $totalEarnd += data['refered_by_amount'] || 0.00;
            $userAmount += data['user_amount'] || 0.00;
  
            i++;
          }
          cb();
        }, function (err) {
          if (err) {
            console.log('A file failed to process');
          } else {

            $toBeEarned = $userAmount - $totalEarnd;
            $finalResponse = {};
            $finalResponse['total_earnd'] = $totalEarnd;
            $finalResponse['to_be_earnd'] = $toBeEarned;
            $finalResponse['total_fields'] = responseData.length || 0;
            $finalResponse['friend_detail'] = responseData;

            response["message"] = null;
            response["status"] = true;
            response["data"] = $finalResponse;
            return res.json(response);
          }
        });

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
