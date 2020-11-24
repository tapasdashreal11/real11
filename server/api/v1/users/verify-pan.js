const Users = require("../../../models/user");
const PanDetails = require("../../../models/user-pan-details");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const ModelService = require("../../ModelService");
const { panVerification } = require("./panAPI");
const moment = require('moment');
const ReferralCodeDetails = require('../../../models/user-referral-code-details');
const Transaction = require('../../../models/transaction');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = {
      state: "required",
      pan_name: "required",
      date_of_birth: "required",
      pan_number: "required"
    };
    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing !";
      response["errors"] = validator.errors;
      return res.json(response);
    }
    var convertDOB = moment(params.date_of_birth,'DD-MM-YYYY').format('YYYY-MM-DD');
    var panDataRes = await panVerification({"id_number": params.pan_number,"dob": convertDOB,"full_name": params.pan_name})
    
    if(panDataRes && panDataRes.success) {
    try {
      let userId = req.userId || null;
      // const user = await (new ModelService(Users)).getUserDetail(userId);
      let user = await Users.findOne({ _id: userId });
      if(user) {
        let panDetail = await PanDetails.findOne({ user_id: userId });
        
        let updatedData = {};
        updatedData.state = params.state || null;
        updatedData.pan_name = params.pan_name || null;
        updatedData.date_of_birth = params.date_of_birth || null;
        updatedData.pan_card = params.pan_number || null;
        updatedData.aadhar_card = params.aadhar_card || null;
        updatedData.user_id = userId;
        updatedData.is_verified = 1;

        if (params.image) {
          updatedData.pan_image = params.image;
        }
        if(!panDetail) {
          await PanDetails.create(updatedData);
        } else {
          const result = await PanDetails.update({ user_id: user._id }, { $set: updatedData });
        }
        await Users.updateOne({ _id: userId }, { $set: {pen_verify:2} });
        await (new ModelService()).referalManageAtVerification(userId,true,false,false);
        response["message"] = "Pan card detail updated successfully.";
        response["status"] = true;
        response["data"] = updatedData;
        return res.json(response);
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
   } else {
    response["message"] = "Invalid Details";
    return res.json(response);
   }  
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
