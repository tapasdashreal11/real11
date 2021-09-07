const Users = require("../../../models/user");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const PlayerTeamContest = require("../../../models/player-team-contest");
const ObjectId = require('mongoose').Types.ObjectId;
const config = require('../../../config');
const YoutuberUser = require("../../../models/youtuber-user");
const UserAnalysis = require("../../../models/user-analysis");
const Contest = require("../../../models/contest");
const ContestInvite = require("../../../models/contest-invite");
const redis = require('../../../../lib/redis');
module.exports = {
	usersVerifyRF: async (req, res) => {
		try {
			var response = { status: false, message: "Invalid Request", data: {} };
			let { invite_code, match_id, series_id, contest_id, sport } = req.params;

			const auth_user_id = req.userId;
			let decoded = {
				match_id: parseInt(match_id),
				series_id: parseInt(series_id),
				contest_id: contest_id
			}
			try {
				if (auth_user_id) {
					if (invite_code && !_.isEmpty(invite_code)) {
						invite_code = invite_code.toUpperCase();
						redis.getRedis('app-setting', async (err, data) => {
							let youtuberCode = (data.youtber_codes.replace(/\s+/g, "")).split(",");
							// console.log(youtuberCode);
							if (youtuberCode.indexOf(invite_code) > -1) {
								let ytuberUserData = await YoutuberUser.findOne({ user_id: ObjectId(auth_user_id), 'sport': parseInt(sport) });
								if (ytuberUserData) {
									response["message"] = "You have already applied the code.";
									response["status"] = false;
									return res.json(response);
								} else {
									let yUserIData = { user_id: auth_user_id, youtuber_code: parseInt(invite_code.substring(2)) };
									let cBonus = config && config.contest_bonous ? config.contest_bonous : [];

									if (invite_code == 'AK49') {
										console.log('akash bonous **********');
										cBonus = [
											{ 'contest_id': '5f306f878ca80a108035b2d1', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108035ecd5', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108036395b', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108035e62b', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108036e5a5', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a1080368a3d', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108037118f', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108036dfb1', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a1080373fe5', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a1080367799', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f878ca80a108036980d', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a108037e7d9', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a1080383915', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a108038b301', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a108038d80b', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803ac9ff', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803a4d17', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803bc43f', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803c40fb', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803c9103', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f888ca80a10803c95cf', 'bonus_amount': 14 },
											{ 'contest_id': '5f306fff8ca80a10809aa967', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f8f8ca80a10807e8713', 'bonus_amount': 14 },
											{ 'contest_id': '5f306f8f8ca80a10807f3e45', 'bonus_amount': 14 },
										];
									} else {
										console.log('normal bonous **********');
										cBonus = config && config.contest_bonous ? config.contest_bonous : [];
									}
									let bulkdata = {
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
									const uData = await UserAnalysis.findOne({ match_id: decoded['match_id'], user_id: auth_user_id, sport: parseInt(sport) });
									if (uData && uData._id) {
										response["message"] = "You can now use the existing offer code for this match to gain entry in another match.Offer is already going on this match";
										response["status"] = false;
										return res.json(response);
									} else {
										UserAnalysis.insertMany([bulkdata])
											.then(function (mongooseDocuments) {
												for (const resItem of mongooseDocuments) {
													let redisKeyForUserAnalysis = 'app-analysis-' + auth_user_id + '-' + decoded['match_id'] + '-' + sport;
													redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, resItem);
												}
												response["message"] = "Referal Code Verified Successfully.";
												response["status"] = true;
												response["data"] = { refresh: true };
												return res.json(response);
											})
									}
								}
							} else {
								// var regCode = new RegExp(["^", invite_code, "$"].join(""), "i");
								var regCode = invite_code.toUpperCase();
								let user = await Users.findOne({ refer_id: regCode });
								if (user && user._id) {
									if (ObjectId(auth_user_id).equals(ObjectId(user._id))) {
										response["message"] = "You can't use this Referal Code.";
										return res.json(response);
									}
									let contestData = await Contest.findOne({ _id: ObjectId(contest_id), contest_shareable: 1 }, { _id: 1 });
									if (contestData && contestData._id) {
										const ptcCoount = await PlayerTeamContest.find({ 'contest_id': ObjectId(contest_id), 'user_id': ObjectId(user._id), 'match_id': decoded['match_id'], 'sport': sport, 'series_id': decoded['series_id'] }).countDocuments();
										if (ptcCoount > 0) {
											response["message"] = "Referal Code Verified Successfully.";
											response["status"] = true;
											response["data"] = { refer_by_id: user._id };
										} else {
											response["message"] = "Referal code is not active. Referal code holder did not join this contest.";
										}

										return res.json(response);
									} else {
										response["message"] = "This contest is not shareable!!";
										return res.json(response);
									}

								} else {
									response["message"] = "Wrong Referal Code, Please Try Again !";
									return res.json(response);
								}
							}
						});

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
	},
	sharedContestCounts: async (req, res) => {
		var response = { status: false, message: "Invalid Request", data: {} };
		try{
			const user_id = req.userId;
			let { match_id, series_id, contest_id } = req.params;
			if(match_id && series_id && contest_id){
				let decoded = {
					match_id: parseInt(match_id),
					series_id: parseInt(series_id),
					contest_id: contest_id
				}
				let rfuserTotalCounts = await ContestInvite.find({ refer_by_user: user_id, use_status: 0, contest_id: contest_id, match_id:decoded['match_id'], series_id:decoded['series_id'] }).countDocuments();
				response.status = true;
				response.message = "";
				response.data = { shared_counts:rfuserTotalCounts };
				return res.json(response);
			} else {
				return res.json(response);
			}
		} catch(error){
			return res.json(response);
		}
		
	}
};
