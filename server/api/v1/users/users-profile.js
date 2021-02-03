const { ObjectId } = require('mongodb');
const Profile = require("../../../models/user-profile");
const User = require("../../../models/user");
const PlayerTeamContest = require('../../../models/player-team-contest');
const ReferralCodeDetails = require("../../../models/user-referral-code-details");
const { Validator } = require("node-input-validator");
const logger = require("../../../../utils/logger")(module);
const { rowTextToJson } = require("../common/helper");
const ModelService = require("../../ModelService");
const _ = require("lodash");

module.exports = {
  profile : async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      
      try {
        let userId = req.userId;
        let user = await User.findOne({ _id: userId }).select("  ");
        let userProData = await Profile.findOne({ user_id: ObjectId(userId) })
        // let user = await User.findOne({ status: 1 }).maxTimeMS(2)
        // console.log(user.fair_play_violation);return false; 
        //.populate('profile','team_name image cash_balance winning_balance bonus_amount email_verified bank_account_verify pen_verify email');
        if (user) {
          let is_profile_complete = false;
          if(user.first_name !== '' && user.email !== '' && user.phone !== '' && user.address !== '' && user.city !== user.postal_code !== '') {
            is_profile_complete = true;
          }
          let Referdetails = []; //await ReferralCodeDetails.find({ refered_by: userId });
          //console.log("user", user.bank_account_verify, user.pen_verify, user.email_verified)
          let sport = 1;
          const contestCount = []; //await (new ModelService(PlayerTeamContest)).getContestCount(req.userId,sport);
          const paidContests = []; //await (new ModelService(PlayerTeamContest)).getPaidContests(req.userId,sport);
          const totalMatches = []; //await (new ModelService(PlayerTeamContest)).getTotalMatches(req.userId,sport);
          const totalSeries = []; //await (new ModelService(PlayerTeamContest)).getTotalSeries(req.userId,sport);
          const totalMatchWin = []; //await (new ModelService(PlayerTeamContest)).getTotalMatchWin(req.userId,sport);
          
          let level	= 1;
          let totalPaidContest = userProData && userProData.paid_contest_count ? userProData.paid_contest_count : 0;
          // let totalPaidContest = (!_.isEmpty(paidContests)) ? paidContests["0"].player_team_id : 0;
          if(totalPaidContest >= 0) {
            let ratio		=	totalPaidContest / 20;
            let ratioPlus	=	parseInt(ratio) + 1;
            if(parseInt(ratio) < ratioPlus) {
              level	=	ratioPlus;
            }
          }
          
          let data = {};
          data.team_name = user.team_name || '';
          data.image = user.image || '';
          data.email = user.email || '';
          data.contest_finished = userProData && userProData.contest_finished ? userProData.contest_finished : 0;
          data.total_match = userProData && userProData.total_match ? userProData.total_match : 0;
          data.total_series = userProData && userProData.total_series ? userProData.total_series : 0;
          data.series_wins = userProData && userProData.series_wins ? userProData.series_wins : 0;
          //data.contest_finished = (!_.isEmpty(contestCount)) ? contestCount["0"].player_team_id : 0;
          //data.total_match = (!_.isEmpty(totalMatches)) ? totalMatches["0"].player_team_id : 0;
          //data.total_series = (!_.isEmpty(totalSeries)) ? totalSeries["0"].player_team_id : 0;
          //data.series_wins = (!_.isEmpty(totalMatchWin)) ? totalMatchWin["0"].player_team_id : 0;
          data.contest_level = level;
          data.paid_contest_count = totalPaidContest;

          // console.log(user.bonus_amount);
          data.total_cash_amount = user.cash_balance ? parseFloat(user.cash_balance).toFixed(2) : 0.00;
          data.total_winning_amount = user.winning_balance ? parseFloat(user.winning_balance).toFixed(2) : 0.00;
          data.cash_bonus_amount = user.bonus_amount ? parseFloat(user.bonus_amount).toFixed(2) : 0.00;
          data.extra_amount = user.extra_amount ? parseFloat(user.extra_amount).toFixed(2) : 0.00;

          data.avatar = "";
          data.team_name_updated = (user.is_updated) ? 1 : 0;

          if(user.bank_account_verify== 2 && user.pen_verify==2 && user.email_verified == 1){
            data.account_verified = true;
          } else {
            data.account_verified = false;
          }

          data.bank_verify = user.bank_account_verify || null;
          data.pan_verify = user.pen_verify || null;
          data.email_verify = user.email_verified || null;
          data.mobile_verify = true;
          data.email = user.email || null;
          data.refered_to_friend = Referdetails || [];
          data.rewards = [];
          data.series_ranks = [];
          data.is_profile_complete= is_profile_complete;
          data.fair_play_violation= (user.fair_play_violation == 1) ? true : false;
          data.is_youtuber= (user.is_youtuber == 1) ? true : false;
          data.pan_reject_reason = user.pan_reject_reason || null;
          data.bank_reject_reason = user.bank_reject_reason || null;
          data.withdraw_message  = "Currently, withdrawal requests are not processing due to banking partner's service problems, Apologies for the inconvenience caused to you!";
          data.deposite_message  = "Rupay cardholders, please use paytm payment gateway for better success rate.";
          data.change_bank_req = user && user.change_bank_req ? user.change_bank_req: false ;
          
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
  getAffiliateAmount : async (req, res) => {
    try{
      let userId = req.userId;
      var response = { status: false, message: "Invalid Request", data: {} };
      if(userId){
        let resultContestIds = await User.findOne({_id : ObjectId(userId)}, {"affiliate_amount":1,"cash_balance":1,"winning_balance":1,"bonus_amount":1});
        response["message"] = "Successfully";
        response["status"] = true;
        response["data"] = resultContestIds;        
      }
      return res.json(response);
    }catch(error){
      logger.error("ERROR", error.message);
      response["message"] = error.message;
      return res.json(response);
    }
  }
};
