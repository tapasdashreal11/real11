const Users = require("../../../models/user");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const PlayerTeamContest = require("../../../models/player-team-contest");
const ObjectId = require('mongoose').Types.ObjectId;
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
                    var regCode = new RegExp(["^", invite_code, "$"].join(""), "i");
                    let user = await Users.findOne({ refer_id: regCode, status: 1 });
                    if (user && user._id) {
                        if(ObjectId(auth_user_id).equals(ObjectId(user._id))){
                            response["message"] = "You can't use this Referal Code.";
                            return res.json(response);
                        }
                        const ptcCoount = await PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user._id, 'match_id': decoded['match_id'], 'sport': sport, 'series_id': decoded['series_id'] }).countDocuments();
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
