const Users = require("../../../models/user");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const PlayerTeamContest = require("../../../models/player-team-contest");
const ObjectId = require('mongoose').Types.ObjectId;
const config = require('../../../config');
const YoutuberUser = require("../../../models/youtuber-user");
const UserAnalysis = require("../../../models/user-analysis");
const redis = require('../../../../lib/redis');
module.exports = async (req, res) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
        let {invite_code,match_id,series_id,contest_id,sport} = req.params;
        
        const auth_user_id = req.userId;
        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id
        }
		try {
            if(auth_user_id){
                if(invite_code && !_.isEmpty(invite_code)){
                   let ytuberCode = config && config.youtuber_bcode ? config.youtuber_bcode:[];
                   console.log(ytuberCode)
                   let ytuberCodeItem = _.find(ytuberCode, {code: invite_code });
                   console.log(ytuberCodeItem,invite_code);
                   if(ytuberCodeItem && ytuberCodeItem.code){
                   let ytuberUserData  = await YoutuberUser.findOne({user_id:ObjectId(auth_user_id),'sport':parseInt(sport)});
                        if(ytuberUserData){
                            response["message"] = "You have already applied this code.";
                            response["status"] = false;
                            return res.json(response);
                        } else {
                            let yUserIData = {user_id:auth_user_id,youtuber_code:parseInt(invite_code.substring(2))};
                            let cBonus = config && config.contest_bonous ? config.contest_bonous:[];
                            let bulkdata =   {
                                "match_id": decoded['match_id'],
                                "series_id": decoded['series_id'],
                                "is_offer_type": 3,
                                "sport": parseInt(sport),
                                "offer_amount": 0,
                                "offer_percent": 0,
                                "match_name": "Admin Added Bonous",
                                "contest_ids": [],
                                "contest_bonous": cBonus,
                                "user_id": auth_user_id
                              }
                            
                            await YoutuberUser.create(yUserIData);
                            const uData = await UserAnalysis.findOne({match_id:decoded['match_id'],user_id:auth_user_id,sport:parseInt(sport)});
                           if(uData && uData._id){
                            response["message"] = "You can now use the existing offer code for this match to gain entry in another match.Offer is already going on this match";
                            response["status"] = false;
                            return res.json(response);
                            } else {
                                UserAnalysis.insertMany([bulkdata])
                                .then(function(mongooseDocuments) {
                                    for (const resItem of mongooseDocuments) {
                                        let redisKeyForUserAnalysis = 'app-analysis-' + auth_user_id + '-' + decoded['match_id'] +  '-' + sport;
                                        redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, resItem);
                                    }
                                    response["message"] = "Referal Code Verified Successfully.";
                                    response["status"] = true;
                                    response["data"] = {refresh:true};
                                    return res.json(response);
                                })
                           }
                            
                        }
                    } else {
                        var regCode = new RegExp(["^", invite_code, "$"].join(""), "i");
                        let user = await Users.findOne({ refer_id: regCode });
                        if (user && user._id) {
                            if(ObjectId(auth_user_id).equals(ObjectId(user._id))){
                                response["message"] = "You can't use this Referal Code.";
                                return res.json(response);
                            }
                            const ptcCoount = await PlayerTeamContest.find({ 'contest_id': ObjectId(contest_id), 'user_id':ObjectId(user._id), 'match_id': decoded['match_id'], 'sport': sport, 'series_id': decoded['series_id'] }).countDocuments();
                            if(ptcCoount>0){
                                response["message"] = "Referal Code Verified Successfully.";
                                response["status"] = true;
                                response["data"] = {refer_by_id:user._id};
                            } else {
                                response["message"] = "Referal code is not active. Referal code holder did not join this contest.";
                            }
                            
                            return res.json(response);
                        } else {
                            response["message"] = "Wrong Referal Code, Please Try Again !";
                            return res.json(response);
                        }
                    }
                    
                } else {
                    response["message"] = "Enter Referal Code!!";
                    return res.json(response);
                }
            } else {
                response["message"] = "You are not valid user!!";
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
};
