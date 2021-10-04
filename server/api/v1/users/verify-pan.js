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
      let pdNumberMatch = await PanDetails.findOne({ pan_card: params.pan_number });
      if(pdNumberMatch && pdNumberMatch._id){
        response["message"] = "This Pan Card is already exists.";
        return res.json(response);
      }
      if(user) {
        if(user && user.status == 1) {
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
            const result = await PanDetails.updateOne({ user_id: user._id }, { $set: updatedData });
          }
          await Users.updateOne({ _id: userId }, { $set: {pen_verify:2} });
          await (new ModelService()).referalManageAtVerification(userId,true,false,false);
          let typeOfReward = TransactionTypes.FRIEND_PAN_VERIFY_XCASH_REWARD;
          await (new ModelService()).referalxCashRewardAtPanVerify(userId,typeOfReward,20);
          if(user && user.extra_amount <= 10){
            console.log('pan if ***');
            await transactionAtPanVerfiy(userId);
          } else  console.log('user.extra_amount ***',user.extra_amount);

          response["message"] = "Pan card detail updated successfully.";
          response["status"] = true;
          response["data"] = updatedData;
          return res.json(response);
        } else {
          response["message"] = "Before verifing pan, please verify your phone number.";
          return res.json(response);
        }
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


async function transactionAtPanVerfiy(userId){
	let date = new Date();
	let transaction_data =[
		{
      user_id: userId,
      txn_amount: 10,
      currency: "INR",
      txn_date: Date.now(),
      local_txn_id: 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + userId,
      added_type: TransactionTypes.SIGNUP_XTRA_CASH_REWARD
    }
	]
  await Transaction.create(transaction_data);
  await Users.updateOne({ _id: userId }, { $inc: {extra_amount:10} });
}