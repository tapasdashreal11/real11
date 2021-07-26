const { ObjectId } = require('mongodb');
const BankDetails = require("../../../models/user-bank-details");
const Users = require("../../../models/user");
const PanDetails = require("../../../models/user-pan-details");
const UserReferral = require("../../../models/user-referral-code-details");
const Profile = require("../../../models/user-profile");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const logger = require("../../../../utils/logger")(module);
const { currentDateTimeFormat, createUserReferal, generateTransactionId, createTeamName } = require("../common/helper");
const config = require('../../../config');
const _ = require('lodash');
const moment = require('moment');
const redis = require('../../../../lib/redis');
const Helper = require('./../common/helper');
const { appsFlyerEntryService } = require("./appsflyer-api");
const { facebookEntryService } = require("./facebook-api");

// @params
// {
//     "mobile_number" : "90011234555",
//     "password" : "aa@123456",
//     "email" : "aaq@mailinator.com",
//     "language" : "en",
//     "invite_code" : "",
//     "name" : ""
//   }
module.exports = async (req, res) => {
  try {
    
    
    var response = { status: false, message: "Invalid Request", data: {} };
    let appsflyerURL = "";
    let params = req.body;
    let constraints = {
      mobile_number: "required",
      password: "required",
      email: "required",
      language: "required"
    };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing";
      response["errors"] = validator.errors;
      return res.json(response);
    }
    try {
      var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
      const beforeHalfHrDate   = moment().add(-30, 'm').toDate();
      let userCount = await Users.find({ created: { $gt: beforeHalfHrDate }, ip_address:userIp }).countDocuments();
      // console.log('count', userCount, "user_ip",userIp);
      if(userCount >= 20) {
        response["message"] = "There is some technical issue, please try after some time.";
        return res.json(response);
      }
      
      let userPhone = await Users.findOne({ phone: params.mobile_number });
      if (!userPhone) {
        let referal_code_detail = {};
        if(!_.isEmpty(params.invite_code)){
          var caps_invite_code = params.invite_code.toUpperCase();
          var regCode = new RegExp(["^", params.invite_code, "$"].join(""), "i");
          let inviteDetails = await Users.findOne({ refer_id: caps_invite_code });
          if(!_.isEmpty(inviteDetails)) {
            referal_code_detail.referal_code = caps_invite_code;  // params.invite_code;
            referal_code_detail.refered_by = new ObjectId(inviteDetails._id);
            referal_code_detail.user_amount = config.referral_bouns_amount;
            referal_code_detail.status = 1;
            
          } else {
            response["message"] = "Invalid invite code.";
            return res.json(response);
          }
        }

        let userEmail = await Users.findOne({ email: params.email });
        if (!userEmail) {
          // console.log(new Date(), ' dfdf ', moment().add(-30, 'm').toDate());
          
          let insertData = {};
          insertData.phone = params.mobile_number;
          insertData.password = params.password;
          insertData.email = params.email;
          insertData.language = params.language;
          insertData.invite_code = params.invite_code;
          insertData.clevertap_id = params.clevertap_id || '';
          insertData.appsflayer_id = params.appsflayer_id || '';
          insertData.refer_id = createUserReferal(10);
          insertData.isFirstPaymentAdded = 2;
          insertData.is_beginner_user = 1;
          if(params && params.user_gaid){
            insertData.user_gaid = params.user_gaid;
          }
          if(params && params.dcode){
            insertData.dcode = params.dcode;
          }
          // insertData.bonus_amount = 50;
          if(params && params.device_id)
           insertData.device_id = params.device_id;

           if(params && params.device_type){
              insertData.device_type = params.device_type;
              if(params.device_type == "Android"){
                appsflyerURL = config.appsFlyerAndroidUrl;
              } else {
                appsflyerURL = config.appsFlyeriPhoneUrl;
              }
           }
           
  
          insertData.team_name = createTeamName(params.email);
          insertData.bonus_amount = config.referral_bouns_amount;
          insertData.image = '';
          insertData.status = 0;
          insertData.avatar = 'boy.png';
          insertData.refer_able = 1;
  
          let full_name = params.name;
  
          if(params.name && full_name!=''){
            full_name = full_name.split(' ');
  
            let firstName = full_name[0];
            let lastName = '';
            if(full_name[1]){
              lastName = full_name[1];
            }
            insertData.first_name = firstName;
            insertData.last_name = lastName;
  
          }
          // return false;
          var otp = Math.floor(100000 + Math.random() * 900000);
          insertData.otp = otp;
          let otp_time = currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
          insertData.otp_time = otp_time;

          insertData.ip_address = userIp;

          response["message"] = "Registered successfully.";

          const user = await Users.create(insertData);
  
          const insertId = user._id;
          let transId = generateTransactionId('credit', insertId);
  
          const msg = otp + " is the OTP for your Real11 account. Never share your OTP with anyone.";
          let userMobile = params.mobile_number || '';
          sendSMS(userMobile, msg)
            .then(() => {})
            .catch(err => {
              console.log("error in sms API ", err);
              logger.error("MSG_ERROR", err.message);
          });
          
          let bank_details = {};
          bank_details.user_id = insertId;
          await BankDetails.create(bank_details);  
          await Profile.create(bank_details);
          await PanDetails.create(bank_details);
          try{
            if(params && params.device_id){
              Helper.sendNotificationFCM(insertId,12,params.device_id,'Welcome Bonus!!','Kick start your journey with 100% deposit bonus. Make your initial deposit in wallet to avail this reward.');
            }
          }catch(errr){}
          
          try {
            if(insertId){
              let redisKeyForUserCategory = 'user-category-' + insertId;
              let userCatObj = {
                  is_super_user : 0,
                  is_dimond_user : 0,
                  is_beginner_user :1,
                  is_looser_user :0
              };
              
              redis.setRedisForUserCategory(redisKeyForUserCategory,userCatObj); 
            }
         } catch(errrrrr){
          console.log('insertId*** errrr',insertId,errrrrr);
         }
          
          insertData.user_id = insertId;
          insertData.otp = 0;
           
          if(!_.isEmpty(referal_code_detail)) {
            referal_code_detail.user_id = insertId;
            await UserReferral.create(referal_code_detail);
          }
          

           //To-do-work

           //save transaction and save transaction-details pending

            // $userId = $result->id;
            // $txnId = $transactionId;
            // $status = MOBILE_VERIFY;
            // $txnAmount = $txnAmount;
            // $withdrawId = 0;
            // $contest_id = 0;
            // $match_id = 0;

            // // $this->saveTransaction($result->id,$transactionId,MOBILE_VERIFY,$txnAmount);
            // $trs_id = $this->saveTransaction($userId, $txnId, $status, $txnAmount, $withdrawId, $contest_id, $match_id);

            // $txn_id = $txnId;
            // $txn_table_id = $trs_id ;
            // $txn_type = MOBILE_VERIFY;
            // $txn_amount = $txnAmount;
            // $winning_balance = 0;
            // $cash_balance = 0;
            // $bonus_balance = $txnAmount;
            // $total_balance = $winning_balance + $cash_balance + $bonus_balance;
            // $cons_cash_balance = null;
            // $cons_winning_balance = null;
            // $cons_bonus_amount = null;
            // $refund_cash_balance = 0;
            // $refund_winning_balance = 0;
            // $refund_bonus_amount = $txnAmount;
            // $user_id = $userId;
            // $series_id = 0;
            // $match_id = 0;
            // $contest_id = 0;

            // $this->saveTransactionDetail($txn_id, $txn_table_id, $txn_type, $txn_amount, $winning_balance, $cash_balance, $bonus_balance, $total_balance, $cons_cash_balance, $cons_winning_balance, $cons_bonus_amount, $refund_cash_balance, $refund_winning_balance, $refund_bonus_amount, $user_id, $series_id, $match_id, $contest_id);

          response["status"] = true;
          response["data"] = insertData;

          // After successfully signup entery data in appsflyer
          try{
            if(params && params.appsflayer_id){
              let event_val = { 
                "appsflyer_id": params.appsflayer_id || '', 
                "af_customer_user_id": params.clevertap_id || '',
                "af_email":  params.email || '', 
                "af_mobile": params.mobile_number || '',
                'advertising_id': params && params.user_gaid ? params.user_gaid: ''
                };
               var signUpBody = {
                "eventName": "SignUp",
                "appsflyer_id": params.appsflayer_id || '', 
                "customer_user_id": insertId || '',
                "eventTime" : new Date(),
                'advertising_id':params && params.user_gaid ? params.user_gaid: '',
                "eventValue": JSON.stringify(event_val)
              };
              
              if(_.isEmpty(params.invite_code)){
                 appsFlyerEntryService(signUpBody,appsflyerURL);
                 try{
                  let fb_event = {
                    "data": [
                       {
                      "event_name": "Complete registration",
                      "event_time": parseInt(new Date().getTime()/ 1000),
                      "event_source_url": "real11.com/s2s",
                      "opt_out": false,
                      "event_id":Math.floor(1000000 + Math.random() * 9000000),
                      "user_data": {
                        "client_ip_address": userIp || "172.17.0.5",
                        "client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                        },
                        "action_source": "website"
                      }
                      ]
                    }
                    facebookEntryService(fb_event,'');
                 }catch(errfb){}
                
              }
            }
            
          } catch(errr){
            console.log('errr',errr);
          }
          return res.json(response);
        }else{
          response["message"] = "Email already exists.";
          return res.json(response);
        }
        
      } else {
        response["message"] = "Mobile number already exists.";
        return res.json(response);
      }
    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    response["message"] = error.message;
    return res.json(response);
  }
};
