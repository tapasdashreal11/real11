const { ObjectId } = require('mongodb');
const Users = require("../../../models/user");
const SeriesSquad = require("../../../models/series-squad");
const PlayerTeamContest = require('../../../models/player-team-contest');
const UserProfile = require('../../../models/user-profile');
// const PlayerTeam = require("../../../models/player-team");
// const WithdrawRequest = require("../../../models/withdraw_requests");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const ModelService = require("../../ModelService");
const config = require('../../../config');

module.exports = {

teamProfileComparision: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = {
        user_id: "required",
        friend_user_id: "required"
      };

      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields are Empty.";
        response["errors"] = validator.errors;
        return res.json(response);
      }
      
      try {
        let userProData =  await UserProfile.findOne({user_id : ObjectId(params.friend_user_id)});
	     //console.log("data coming on profile is ----------------------------------------------------", params.friend_user_id, userProData)
        let userData =  await Users.findOne({_id : new ObjectId(params.friend_user_id), status : 1});
        if(userData) {
          
          let sport = 1;
          
          const totalPaidContest = userProData && userProData.paid_contest_count ? userProData.paid_contest_count : 0;

          let level	= 1;
          if(totalPaidContest >= 0) {
            let ratio		=	totalPaidContest / 20;
            let ratioPlus	=	parseInt(ratio) + 1;
            if(parseInt(ratio) < ratioPlus) {
              level	=	ratioPlus;
            }
          }
          data  = {}
          data.team_name  = userData.team_name || '';
          data.image  = '';
          data.avatar  = userData && userData.avatar ? userData.avatar:'';
          data.contest_level  = level || '';
          data.contest_finished  = userProData && userProData.contest_finished ? userProData.contest_finished : 0;
          data.total_match  = userProData && userProData.total_match ? userProData.total_match : 0;
          data.total_series  = userProData && userProData.total_series ? userProData.total_series : 0;
          data.series_wins  =  userProData && userProData.series_wins ? userProData.series_wins : 0;

          response['message'] = "Profile Comparison";
          response['data'] = data;
          response['status'] = true;
          return res.json(response);
        } else {
          response["message"] = "It seems that your Friend has been deactivated his/her profile!";
          return res.json(response);
        }
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },

  teamProfileComparision_18_12_2020: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = {
        user_id: "required",
        friend_user_id: "required"
      };

      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        response["message"] = "Required fields are Empty.";
        response["errors"] = validator.errors;
        return res.json(response);
      }
      
      try {

        let userData =  await Users.findOne({_id : new ObjectId(params.friend_user_id), status : 1});
        if(userData) {

          let sport = 1;
          const contestCount = 0;
          const paidContests = 0;
          const totalMatches = 0;
          const totalSeries = 0;
          const totalMatchWin = 0;

          let level	= 1;
          let totalPaidContest = 0; //paidContests["0"] ? paidContests["0"].player_team_id : 0;
          if(totalPaidContest >= 0) {
            let ratio		=	totalPaidContest / 20;
            let ratioPlus	=	parseInt(ratio) + 1;
            if(parseInt(ratio) < ratioPlus) {
              level	=	ratioPlus;
            }
          }
          data  = {}
          data.team_name  = userData.team_name || '';
          data.image  = userData.image ? `${config.imageBaseUrl}/users/${userData.image}` : '';
          data.contest_level  = level || '';
          data.contest_finished  = 0; //contestCount["0"] ? contestCount["0"].player_team_id : 0;
          data.total_match  = 0; //totalMatches["0"] ? totalMatches["0"].player_team_id : 0;
          data.total_series  = 0; //totalSeries["0"] ? totalSeries["0"].player_team_id : 0;
          data.series_wins  = 0; //totalMatchWin["0"] ? totalMatchWin["0"].player_team_id : 0;

          response['message'] = "Profile Comparison";
          response['data'] = data;
          response['status'] = true;
          
          return res.json(response);
        } else {
          response["message"] = "It seems that your Friend has been deactivated his/her profile!";
          return res.json(response);
        }
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },
  
  teamProfilePaging: async (req, res) => {
    try {
      
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      
      
      try {

        var response = {}
        let skip = (params.page - 1) * (params.pagesize);
        let sort = { "created": 1 };

        let userData =  await Users.find({},{"email":1}).sort(sort).skip(skip).limit(params.pagesize);

        response["data"] = userData;

        if(userData.length > 0) {
          var newArray = [];
          userGetTotalAllCount(userData, newArray, function(result){
            response['message'] = "Profile Comparison";
            response['data'] = result;
            response['page'] = params.page;
            response['status'] = true;            
            return res.json(response);
          });

        } else {
          response["message"] = "It seems that your Friend has been deactivated his/her profile!";
          return res.json(response);
        }
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  }
}

async function userGetTotalAllCount(users, newArray, cb){
  try{
      
      // console.log("userData", users.length)
      if(users.length > 0){
        var userData = users[0];
       
        let sport = 1;
        
        const contestCount = 0; //await (new ModelService(PlayerTeamContest)).getContestCount(userData._id,sport);
        const paidContests = 0; //await (new ModelService(PlayerTeamContest)).getPaidContests(userData._id,sport);
        const totalMatches = 0; //await (new ModelService(PlayerTeamContest)).getTotalMatches(userData._id,sport);
        const totalSeries = 0; //await (new ModelService(PlayerTeamContest)).getTotalSeries(userData._id,sport);
        const totalMatchWin = 0; //await (new ModelService(PlayerTeamContest)).getTotalMatchWin(userData._id,sport);

        let level	= 1;
        let totalPaidContest = paidContests["0"] ? paidContests["0"].player_team_id : 0;
        if(totalPaidContest >= 0) {
          let ratio		=	totalPaidContest / 20;
          let ratioPlus	=	parseInt(ratio) + 1;
          if(parseInt(ratio) < ratioPlus) {
            level	=	ratioPlus;
          }
        }

        data  = {}
        data.team_name  = userData.team_name || '';
        data.image  = ''; //userData.image ? `${config.imageBaseUrl}/users/${userData.image}` : '';
        data.contest_level  = level || '';
        data.contest_finished  = contestCount["0"] ? contestCount["0"].player_team_id : 0;
        data.total_match  = totalMatches["0"] ? totalMatches["0"].player_team_id : 0;
        data.total_series  = totalSeries["0"] ? totalSeries["0"].player_team_id : 0;
        data.series_wins  = totalMatchWin["0"] ? totalMatchWin["0"].player_team_id : 0;
        //data.index  = totalMatchWin["0"] ? totalMatchWin["0"].player_team_id : 0;
        data.paid_contest_count = totalPaidContest;

        // console.log("user_id***", userData._id)
        // UserProfile.updateOne({ user_id: ObjectId(userData._id) }, {$set : data}, {} ).then((newPdata)=>{
        //   console.log("newPdata-------", newPdata)
        // });

        UserProfile.updateOne({ user_id: ObjectId(userData._id) }, data, { upsert: true }).then((MyContestModel)=>{
          console.log("MyContestModel-------", MyContestModel)
        });

        //console.log("ssss**", ssss)
        
        newArray.push(data);

        users.splice(0, 1);
        userGetTotalAllCount(users, newArray, cb);

      }else{
        cb(newArray)
      }   
  }catch(error){
    console.log("error", error)
  }
}
