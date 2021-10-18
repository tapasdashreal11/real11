const { ObjectId } = require('mongodb');
const Profile = require("../../../models/user-profile");
const BankDetails = require("../../../models/user-bank-details");
const AppSettings = require("../../../models/settings");
const BankDetailsUnverified = require("../../../models/user-bank-deatial-unverified");
const User = require("../../../models/user");
const PlayerTeamContest = require('../../../models/player-team-contest');
const ReferralCodeDetails = require("../../../models/user-referral-code-details");
const { Validator } = require("node-input-validator");
const logger = require("../../../../utils/logger")(module);
const { rowTextToJson,sendSMTPMail } = require("../common/helper");
const ModelService = require("../../ModelService");
const _ = require("lodash");
var ifsc = require('ifsc');
const redis = require('../../../../lib/redis');

module.exports = {
  profile: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };

      try {
        let userId = req.userId;
        let user = await User.findOne({ _id: userId }).select("  ");
        let userProData = await Profile.findOne({ user_id: ObjectId(userId) })

        if (user) {
          let is_profile_complete = false;
          if (user.first_name !== '' && user.email !== '' && user.phone !== '' && user.address !== '' && user.city !== user.postal_code !== '') {
            is_profile_complete = true;
          }
          let Referdetails = [];
          let sport = 1;

          let level = 1;
          let totalPaidContest = userProData && userProData.paid_contest_count ? userProData.paid_contest_count : 0;

          if (totalPaidContest >= 0) {
            let ratio = totalPaidContest / 20;
            let ratioPlus = parseInt(ratio) + 1;
            if (parseInt(ratio) < ratioPlus) {
              level = ratioPlus;
            }
          }

          let data = {};
          data.team_name = user.team_name || '';
          data.image = user.image || '';
          data.email = user.email || '';
          data.contest_finished = userProData && userProData.contest_finished ? userProData.contest_finished : 0;
          data.total_match = userProData && userProData.total_match ? userProData.total_match : 0;
          // data.total_series = userProData && userProData.total_series ? userProData.total_series : 0;
          let t_series_Counts = userProData && userProData.total_series ? userProData.total_series : 0;
          data.total_series = userProData && userProData.series_ids ? t_series_Counts + _.size(userProData.series_ids) : t_series_Counts;
          data.series_wins = userProData && userProData.series_wins ? userProData.series_wins : 0;

          data.contest_level = level;
          data.paid_contest_count = totalPaidContest;

          // console.log(user.bonus_amount);
          data.total_cash_amount = user.cash_balance ? parseFloat(user.cash_balance).toFixed(2) : 0.00;
          data.total_winning_amount = user.winning_balance ? parseFloat(user.winning_balance).toFixed(2) : 0.00;
          data.cash_bonus_amount = user.bonus_amount ? parseFloat(user.bonus_amount).toFixed(2) : 0.00;
          data.extra_amount = user.extra_amount ? parseFloat(user.extra_amount).toFixed(2) : 0.00;

          data.avatar = "";
          data.team_name_updated = (user.is_updated) ? 1 : 0;

          if (user.bank_account_verify == 2 && user.pen_verify == 2 && user.email_verified == 1) {
            data.account_verified = true;
            try{
              let bankDetail = await BankDetails.findOne({ user_id: userId });
              if(bankDetail && bankDetail.ifsc_code && bankDetail.api_verified && bankDetail.api_verified == 1 ){
                ifsc.fetchDetails(bankDetail.ifsc_code).then(async function(res) {
                  let appSData = await getPromiseForAppSetting('app-setting',"{}");
                  let dataItem = appSData ?  JSON.parse(appSData) :{};
                  if(dataItem && dataItem.state_name_list && res && res.STATE && user.email){
                    if(dataItem.state_name_list.toUpperCase().includes(res.STATE)){
                      await User.findOneAndUpdate({ _id: userId },{$set:{bank_account_verify:0,bank_reject_reason:"Your state is banned as per govt policy"}});
                      let updatedData = {};
                      updatedData.account_number = bankDetail.account_number || null;
                      updatedData.ifsc_code = bankDetail.ifsc_code || null;
                      updatedData.bank_name = bankDetail.bank_name || null;
                      updatedData.branch = bankDetail.branch || null;
                      updatedData.user_id =bankDetail.user_id;
                      updatedData.bank_image = bankDetail.bank_image;
                      await BankDetailsUnverified.create(updatedData);
                      await BankDetails.deleteOne({ user_id: userId });
                      sendEmailToAdmin(user.email);
                    } else {
                      await BankDetails.findOneAndUpdate({ user_id: userId },{$set:{api_verified:2}});
                    }
                   }
                });
              }
              
            }catch(errorIfsc){
              console.log('errorIfsc check at profile *****',errorIfsc);
            }

          } else {
            data.account_verified = false;
          }

          data.is_password_set = user && user.password && !_.isEmpty(user.password) ? true : false;
          data.bank_verify = user.bank_account_verify || null;
          data.pan_verify = user.pen_verify || null;
          data.email_verify = user.email_verified || null;
          data.mobile_verify = true;
          data.email = user.email || null;
          data.refered_to_friend = Referdetails || [];
          data.rewards = [];
          data.series_ranks = [];
          data.is_profile_complete = is_profile_complete;
          data.fair_play_violation = (user.fair_play_violation == 1) ? true : false;
          data.is_youtuber = (user.is_youtuber == 1) ? true : false;
          data.pan_reject_reason = user.pan_reject_reason || null;
          data.bank_reject_reason = user.bank_reject_reason || null;
          data.withdraw_message = ""; //"Instant withdraw is temporarily paused, will resume shortly.";
          data.deposite_message = "Rupay cardholders, please use paytm payment gateway for better success rate.";
          data.change_bank_req = user && user.change_bank_req ? user.change_bank_req : false;
          data.xtra_cash_block = user && user.xtra_cash_block ? true : false;
          data.bonus_amount_block = user && user.bonus_amount_block ? true : false;

          delete data.profile;
          delete data.created;
          delete data.modified;
          response["message"] = "Successfully";
          response["status"] = true;
          response["data"] = data;
          return res.json(response);
        } else {
          response["message"] = "No data found";
          return res.json(response);
        }
      } catch (err) {
        console.log(err);
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("ERROR", error.message);
      response["message"] = error.message;
      return res.json(response);
    }
  },
  getAffiliateAmount: async (req, res) => {
    try {
      let userId = req.userId;
      var response = { status: false, message: "Invalid Request", data: {} };
      if (userId) {
        let user = await User.findOne({ _id: ObjectId(userId) });
        let userData = {};
        if (user) {
          let is_profile_complete = false;
          if (user.first_name !== '' && user.email !== '' && user.phone !== '' && user.address !== '' && user.city !== user.postal_code !== '') {
            is_profile_complete = true;
          }
          if (user.bank_account_verify == 2 && user.pen_verify == 2 && user.email_verified == 1) {
            userData['account_verified'] = true;
          } else {
            userData['account_verified'] = false;
          }
          userData['cash_balance'] = user && user.cash_balance ? user.cash_balance : 0;
          userData['winning_balance'] = user && user.winning_balance ? user.winning_balance :0 ;
          userData['bonus_amount'] = user && user.bonus_amount ? user.bonus_amount :0 ;
          userData['affiliate_amount'] = user && user.affiliate_amount ? parseInt(user.affiliate_amount) : 0;
          userData['_id'] = user._id ;
          userData['is_profile_complete'] = is_profile_complete;
          userData['fair_play_violation'] = (user.fair_play_violation == 1) ? true : false;
          response["message"] = "Successfully";
          response["status"] = true;
          response["data"] = userData;
          return res.json(response);
        } else {
          response["message"] = "Invalid User!!";
          return res.json(response);
        }
      } else return res.json(response);
    } catch (error) {
      logger.error("ERROR", error.message);
      response["message"] = "Something went wrong!!"
      return res.json(response);
    }
  }
};

async function getPromiseForAppSetting(key, defaultValue){
  return new Promise((resolve, reject) => {
      redis.redisObj.get(key, async (err, data) => {
          if (err) { 
              reject(defaultValue);
          }
          if (data == null) {
              const appSettingData = await AppSettings.findOne({});
              if(appSettingData && appSettingData._id){
                  console.log('app setting coming from db*****');
                  data = JSON.stringify(appSettingData);
              } else {
                  data = defaultValue;
              }
          }
          resolve(data)
      })
  })
}

async function sendEmailToAdmin(to1) {
  let mailMessage = "<div><h3>Dear User</h3><p>You Bank has been unverified due to some Govt policy,</p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>"
  let to = "shashijangir@real11.com";
  let subject = "Bank unverified";
  sendSMTPMail(to, subject, mailMessage);
}