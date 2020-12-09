const Users = require("../../../models/user");
const BankDetails = require("../../../models/user-bank-details");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const ModelService = require("../../ModelService");

module.exports = async (req, res) => {
  try {

    // Data: {
    //   "language" : "en",
    //   "account_no" : "43754839359743875",
    //   "ifsc_code" : "HDFC0000295",
    //   "user_id" : "331583",
    //   "bank_name" : "HDFC Bank",
    //   "branch" : "COCHIN - KADAVANTHRA"
    // }


    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = { 
      account_no: "required",  
      bank_name: "required",
      branch: "required",
      ifsc_code: "required"
    };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing !";
      response["errors"] = validator.errors;
      return res.json(response);
    }

    try {
      let userId = req.userId;

      let user = await Users.findOne({ _id: userId });
      // const user = await (new ModelService(Users)).getUserDetail(userId);
      if(user) {
        let bankDetail = await BankDetails.findOne({ user_id: userId });
        let updatedData = {};
        updatedData.account_number = params.account_no || null;
        updatedData.ifsc_code = params.ifsc_code || null;
        updatedData.bank_name = params.bank_name || null;
        updatedData.branch = params.branch || null;
        updatedData.beneficiary_id =  null;
        updatedData.user_id =  userId;

        if(params.image){
          updatedData.bank_image = params.image;
        }
        if(!bankDetail) {
          await BankDetails.create(updatedData);
          
        } else {
          const result = await BankDetails.updateOne({ user_id: user._id }, {$set : updatedData});
          // response["message"] = "Account number already exists.";
          // return res.json(response);
        }
        const result2 = await Users.update({ _id: userId }, { $set: {bank_account_verify:1} });
        response["message"] = "Bank detail updated successfully.";
        response["status"] = true;
        response["data"] = updatedData;
        return res.json(response);
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (err) {
      console.log('catch',err);
      response["msg"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
