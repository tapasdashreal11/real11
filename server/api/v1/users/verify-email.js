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
  verifyEmail: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = { email: "required" };
      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields missing !";
        response["errors"] = validator.errors;
        return res.json(response);
      }
      let userId = req.userId || null;
      let user = await Users.findOne({ _id: userId });
      if (user) {
        let updatedData = {};
        let verifyStr = Buffer.from(params.email).toString('base64');
        let emailLink = new Date().getTime() + verifyStr;
        updatedData.new_email = params.email || null;
        if(user && user.email && !_.isEmpty(user.email)){
        } else {
          updatedData.email = params.email || null;
        }
        updatedData.verify_string = userId;
        let userCheck = await Users.findOne({_id: {$ne:userId},email: params.email});
        if(userCheck && userCheck._id) {
          response["message"] = "This email is already exist to other account.";
          return res.json(response);
        }

        const result2 = await Users.updateOne({ _id: userId }, { $set: updatedData });
        if (result2 && result2.ok == 1) {
          let emailTemplate = await EmailTemplate.findOne({ subject: "confirm_your_account" });
          if (emailTemplate) {
            var rootUrl = `${req.protocol}://${req.get('host')}`;
            var verifyUrl = `${rootUrl}${'/api/v1/verify-account-email'}/${userId}`;
            // var verifyUrl  = `${rootUrl}${'/api/v1/verify-account-email'}/${encodeURIComponent(emailLink)}`;

            emailTemplate.template = emailTemplate.template.replace('{{site_name}}', user.first_name);
            emailTemplate.template = emailTemplate.template.replace('{{link}}', verifyUrl);
            const to = params.email;
            // const from = config.supportEmail;
            const subject = emailTemplate.email_name;
            const message = emailTemplate.template;

            // sendMail(to, from, subject, message);
            sendSMTPMail(to, subject, message);
          }
        }

        response["message"] = "Verification link has been sent to email address !";
        response["status"] = true;
        // response["data"] = {"email" : updatedData.new_email};
        return res.json(response);
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },

  verifyAccountEmail: async (req, res) => {
    var opts = help.flashToView(req);
    try {
      let user = await Users.findOne({ verify_string: req.params.verify_string });
      if (user) {
        let userId = user._id;
        let updatedData = {};
        if (user && user.email_verified) {
          opts.message = "Your email already verified!";
          res.render('alert-msg', opts);
          return false;
        } else {
          updatedData.email_verified = 1;
          if(user.email && user.new_email &&! _.isEqual(user.email,user.new_email) ){
            updatedData.email = user.new_email || null;
            updatedData.google_id = null;
          }
          await Users.updateOne({ _id: userId }, { $set: updatedData });
          await (new ModelService()).referalManageAtVerification(userId, false, true, false);
          opts.message = "Your mail has been verified successfully!";
          res.render('alert-msg', opts);
          return false;
        }
      } else {
        opts.message = "Invalid User id.";
        res.render('alert-msg', opts);
        return false;
      }
    } catch (err) {
      console.log('catch', err);
      opts.message = err.message;
      res.render('alert-msg', opts);
      return false;
    }
  },
  updateUserFCMToken: async (req, res) => {
    var response = { status: false, message: "", data: {} };
    let params = req.body;
    try {
      let userId = req.userId || null;
       if(userId && params && (params.device_id ||params.clevertap_id || params.appsflayer_id || params.user_gaid)){
         let user_update = {};
         if(params.device_id){
          user_update['device_id'] = params.device_id; 
         }
         if(params.clevertap_id){
          user_update['clevertap_id'] = params.clevertap_id; 
         }
         if(params.appsflayer_id){
          user_update['appsflayer_id'] = params.appsflayer_id; 
         }
         if(params.user_gaid){
          user_update['user_gaid'] = params.user_gaid; 
         }
        if(user_update && (user_update.device_id || user_update.clevertap_id || user_update.appsflayer_id || user_update.user_gaid)){
          await Users.findOneAndUpdate({ _id: ObjectId(userId) }, { $set: user_update});
        }
        response["status"] = true;
        response["message"] = "";
        return res.json(response);
      } else {
        response["message"] = "";
        return res.json(response);
       }
    } catch (err) {
        return res.json(response);
    }
  },
  verifyReferal: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = {
        invite_code: "required"
      };
      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields missing !";
        response["errors"] = validator.errors;
        return res.json(response); 
      }
      if(params && !_.isEmpty(params.invite_code)){
        var caps_invite_code = params.invite_code.toUpperCase();
        let real11Code = caps_invite_code.substring(0, 3);
        if(real11Code == "REL"){
          let realRefData = await Real11ReferalCodeModel.findOne({referal_code:caps_invite_code,use_status:1});
          if(realRefData && realRefData._id){
            response["status"] = true;
            response["message"] = "Verified";
            return res.json(response);
           }
         }
        let ref_key = 'user-referal-' + caps_invite_code;
        redis.getRedisLogin(ref_key, async (err, data) => {
          if (data && data.status) {
            response["status"] = data.status == 1 ? true: false;
            response["message"] = data.status == 1 ?  "Verified":  "Not Valid Code";
            return res.json(response);
          } else {
            let inviteDetails = await Users.findOne({ refer_id: caps_invite_code },{_id:1});
            if(!_.isEmpty(inviteDetails) && inviteDetails._id) {
              console.log("inviteDetails",inviteDetails);
              // Valid code we set status 1
              let obj = { status : 1 };
              redis.setRedisLogin(ref_key,obj); 
              response["status"] = true;
              response["message"] = "Verified";
              return res.json(response);
            } else {
              // Not valid code we set status 2
              console.log("inviteDetails",inviteDetails);
              let obj = { status : 2 }; 
              redis.setRedisLogin(ref_key,obj);
              response["status"] = false;
              response["message"] = "Not Valid Code";
              return res.json(response);
            }
          }
        });
          
      } else {
        return res.json(response);
      }
      
    } catch (error) {
      logger.error("Referal code verfication error", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },
  verifyGmailAccount: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = { email: "required",user_id: "required", google_id: "required" };
      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields missing !";
        response["errors"] = validator.errors;
        return res.json(response);
      }
      let userId = req.userId || null;
      let user = await Users.findOne({ _id: userId });
      if (user && user._id) {
        if(user.email_verified && user.email_verified == 1){
          response["message"] = "You are already verified with " + user.new_email + " account.";
          return res.json(response);
        } else {
             let userCheck = await Users.findOne({_id: {$ne:userId},email: params.email});
            if(userCheck && userCheck._id) {
              response["message"] = "This email is already exist to other account.";
              return res.json(response);
            }
            let updatedData = {};
            updatedData.new_email = params.email || null;
            updatedData.email = params.email || null;
            updatedData.verify_string = userId;
            updatedData.email_verified = 1;
            updatedData.google_id = params.google_id;
            await Users.updateOne({ _id: userId }, { $set: updatedData });
            await (new ModelService()).referalManageAtVerification(userId, false, true, false);
            response["message"] = "Your email has been verified successfully!";
            response["status"] = true;
            return res.json(response);
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
  realRefCodeGenerate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      if(params && !_.isEmpty(params.sub_referal_code)){
        var caps_invite_code = params.sub_referal_code.toUpperCase();
        let realRefArray = [];
        let refCount = Real11ReferalCodeModel.find({sub_referal_code:caps_invite_code,status:1}).count();
        if(refCount >100000){
          response["message"] = "Already Created!";
          response["status"] = false; 
          return res.json(response);
        }else{
          for (let index = 0; index < 200000; index++) {
            let cc = generateRef();
            let obj = {
             referal_code : "REL"+cc,
             sub_referal_code : caps_invite_code
            } 
            realRefArray.push(obj);
          }
          if(realRefArray && realRefArray.length == 200000)
          await Real11ReferalCodeModel.insertMany(realRefArray, { ordered: false })
          response["message"] = "Successfully Done !";
          response["status"] = true; 
          return res.json(response);
        }
         
          
      } else {
        return res.json(response);
      }
      
    } catch (error) {
      logger.error("Referal code verfication error", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  }

}

 function generateRef() {
  var text = "";
  var possible = "01BCDEFGHI23456789AJKLMNOPQRSTUVWXYZ";
  for (var i = 0; i < 7; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  return text;
}