const Users = require("../../../models/user");
const PanDetails = require("../../../models/user-pan-details");
const EmailTemplate = require("../../../models/email");
const { ObjectId } = require('mongodb');
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const config = require('../../../config');
const { sendMail, sendSMTPMail } = require("../common/helper");
var help = require('../../../controllers/helpers');
const ModelService = require("../../ModelService");
const _ = require('lodash');
const redis = require('../../../../lib/redis');
const Real11ReferalCodeModel = require('../../../models/real-ref-code-model');

module.exports = {
  emailReqOtp: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let userId = req.userId;
      let constraints = { email: "required" };
      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields missing !";
        response["errors"] = validator.errors;
        return res.json(response);
      }
      let user = await Users.findOne({ _id: userId });
      if (user && user._id) {
        let userCheck = await Users.findOne({_id: {$ne:userId},email: params.email});
        if(userCheck && userCheck._id) {
          response["message"] = "This email is already exist to other account.";
          return res.json(response);
        }else{
            if(user.email_verified){
                response["message"] = "Your account is already verified!!.";
                return res.json(response);
            }else{
                let updatedData = {};
                const to = params.email;
                updatedData.new_email = params.email || null;
                if(user && user.email && !_.isEmpty(user.email)){
                    if(!user.email_verified){
                        updatedData.email = params.email || null;
                    }
                } else {
                  updatedData.email = params.email || null;
                }
                
                if(to){
                    var otp		=	Math.floor(100000 + Math.random() * 900000);
                    let mailMessage	=	"<div><h3>Email Verification OTP</h3><p>Hi,</p><p>Your One time password (OTP) is <b>"+ otp +"</b></p><p>This OTP will only be valid for 30 minutes. Kindly complete the verification before the password expires.</p><p>If you have not made any request, please contact our customer support team immediately.</p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>";
                    let subject	=	"Confirm Your Account To Real11";
                    sendSMTPMail(to, subject, mailMessage);
                    updatedData.verify_string = otp;
                    await Users.updateOne({ _id: userId }, { $set: updatedData });
                    response["message"] = "Verification code has been sent to the email Id!!";
                    response["status"] = true;
    
                 }else{
                    response["message"] = "Email address is not properly!!";
                    response["status"] = false;
                 }         
                return res.json(response);
            }
           
        }
       
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },
  verifyEmailWithOtp: async (req, res) => {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let {otp,email} = req.body;
    try {
        let userId = req.userId;
        let constraints = { otp: "required",email: "required" };
        let validator = new Validator(params, constraints);
        let matched = await validator.check();
        if (!matched) {
            response["message"] = "Required fields missing !";
            response["errors"] = validator.errors;
            return res.json(response);
        }
      let user = await Users.findOne({ _id:userId});
      if (user && user._id) {
        let updatedData = {};
        if (user && user.email_verified) {
            response["message"] = "Your email already verified!";
            response["status"] = false;
            return res.json(response);
        } else if(_.isEqual(user.verify_string,otp) && _.isEqual(user.new_email,email)) {
            updatedData.email_verified = 1;
          if(user.email && user.new_email &&! _.isEqual(user.email,user.new_email) ){
            updatedData.email = user.new_email || null;
            updatedData.google_id = null;
          }
          await Users.updateOne({ _id: userId }, { $set: updatedData });
          await (new ModelService()).referalManageAtVerification(userId, false, true, false);
          
          response["message"] = "Your email is verified successfully!!";
          response["status"] = true;
          return res.json(response);
        } else {
            response["message"] = "Wrong OTP!!";
            response["status"] = false;
            return res.json(response);
        }
      } else {
        response["message"] = "Invalid User Request!!";
        response["status"] = false;
        return res.json(response);
      }
    } catch (err) {
        response["message"] = "Something went wrong!!";
        response["status"] = false;
        return res.json(response);
    }
  }
}
