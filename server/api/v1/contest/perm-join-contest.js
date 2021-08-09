const config = require('../../../config');
const User = require('../../../models/user');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const MyContestModel = require('../../../models/my-contest-model');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/transaction');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const db = require('../../../db');
const { startSession } = require('mongoose');
const UserAnalysis = require("../../../models/user-analysis");
const ContestInvite = require("../../../models/contest-invite");
const CouponSale = require("../../../models/coupon-sale");
const { appsFlyerEntryService } = require("../users/appsflyer-api");

module.exports = async (req, res) => {
    try {
        const { team_id,team_name,user_id, team_count, contest_id, series_id, match_id, sport} = req.body;
        let match_sport = sport ? parseInt(sport) : 1;
        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id,
            user_id: user_id
        }
        var teamCount = team_count ? parseInt(team_count) : 0;
        var user_team_name = team_name ? team_name : '';
        var teamId = team_id ? team_id : '';
        var totalContestKey = 0;
        if (match_id && series_id && contest_id && user_id) {
            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }),
                PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }).countDocuments(),
                redis.getRedis('contest-detail-' + contest_id),
                MatchContest.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }),
            ];
            
            var results = await Promise.all(apiList);
            if (results && results.length > 0) {
                let authUser = user_id;
                if (authUser) {
                    let liveMatch = results[0] ? results[0] : {};

                    if (liveMatch) {
                        let ctime = Date.now();
                        let mtime = liveMatch.time;
                        if (mtime < ctime) {
                            return res.send(ApiUtility.failed('Match has been started.'));
                        } else { 
                            if (teamId && teamId != null && teamId != '' && ! _.isUndefined(teamId) && teamCount > 0) {
                                
                                let matchContest = results[3] ? results[3] : {};
                                if (!matchContest) {
                                    return res.send(ApiUtility.failed('Match Contest Not Found'));
                                }
                                let contestData = results[2] ? results[2] : '';
                                if (!contestData) {
                                    contestData = await Contest.findOne({ _id: ObjectId(contest_id) });
                                    if (!contestData) {
                                        return res.send(ApiUtility.failed('Contest Not Found'));
                                    } else {
                                        redis.setRedis('contest-detail-' + contest_id, contestData);
                                    }
                                }
                                //let joinedContest = 0;
                                let joinedContest = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': series_id, 'contest_id': contest_id }).countDocuments();// (matchContest && matchContest.joined_users) ? matchContest.joined_users : 0

                                var parentContestId = (contestData && contestData.parent_id) ? contestData.parent_id : contestData._id;
                                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;

                                if (contestData && contestData.contest_size == parseInt(joinedContest) && infinteStatus) {

                                    let response = {};
                                    var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, sport: match_sport, is_full: { $ne: 1 } }).sort({ _id: -1 });
                                    await MatchContest.updateOne({ _id: ObjectId(matchContest._id) }, { $set: { "is_full": 1 } });

                                    if (MatchContestData) {
                                        response.status = false;
                                        response.message = "This contest is full, please join other contest.";
                                        response.data = { contest_id: MatchContestData.contest_id };
                                        response.error_code = null;
                                        return res.json(response);
                                    } else {
                                        response.status = false;
                                        response.message = "This contest is full, please join other contest.";
                                        response.error_code = null;
                                        return res.json(response);
                                    }

                                }

                                var PlayerTeamContestFilter = { 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'], 'player_team_id': teamId }
                                let playerTeamRes = await PlayerTeamContest.findOne(PlayerTeamContestFilter);
                                let joinedContestWithTeamCounts = results[1] ? results[1] : 0;
                                let maxTeamSize = contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : 9;

                                if (joinedContestWithTeamCounts < maxTeamSize) {
                                    if (!playerTeamRes) {
                                        if ((!contestData.multiple_team && joinedContestWithTeamCounts >= 1) || ((contestData.multiple_team !== 'yes') && joinedContestWithTeamCounts >= 1)) {
                                            return res.send(ApiUtility.failed('Multiple Teams Not Allowed'));
                                        }
                                        const session = await startSession()
                                        session.startTransaction();
                                        const sessionOpts = { session, new: true };
                                        try {
                                            const doc = await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: 1 } }, sessionOpts);
                                            if (doc) {
                                                let joinedContestCount = doc.joined_users;

                                                if (contestData && contestData.contest_size < joinedContestCount && infinteStatus) {
                                                    console.log("Going in the/ last response ----------***********", contestData.contest_size, joinedContestCount);
                                                    await session.abortTransaction();
                                                    session.endSession();
                                                    let response = {};
                                                    response.status = false;
                                                    response.message = "This contest is full, please join other contest.";
                                                    response.error_code = null;
                                                    return res.json(response);
                                                }
                                                let joinStatus = false;
                                                joinStatus = joinedContest && (joinedContest < contestData.contest_size || contestData.infinite_contest_size == 1) ? true : (joinedContest == 0 ? true : false);

                                                if (joinStatus == true) {
                                                    let contest = {};
                                                    let newContestId = new ObjectId();
                                                    contest._id = newContestId;
                                                    contest.player_team_id = teamId;
                                                    contest.match_id = match_id;
                                                    contest.series_id = series_id;
                                                    contest.contest_id = contest_id;
                                                    contest.user_id = user_id;
                                                    contest.total_amount = contestData.entry_fee;
                                                    contest.team_count = teamCount;
                                                    contest.team_name = user_team_name;
                                                    contest.bonus_amount = 0;
                                                    contest.sport = match_sport;
                                                    try {
                                                        
                                                        if(_.has(contest, "player_team_id") && _.has(contest, "team_count") &&  _.has(contest, "team_name") &&  contest.team_name !='' && contest.player_team_id !=null && contest.player_team_id != '' && contest.team_count != null && contest.team_count != '' && contest.team_count > 0 ){
                                                            totalContestKey = await getContestCount(contest, match_id, contest_id, contestData, session, match_sport, joinedContestCount);
                                                        } else {
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                            return res.send(ApiUtility.failed("Player team not found. Please try again!!"));
                                                        }

                                                    } catch (error) {
                                                        await session.abortTransaction();
                                                        session.endSession();
                                                        console.log("join contest condition true > at line 584", error);
                                                        return res.send(ApiUtility.failed(error.message));
                                                    }
                                                } else {
                                                    console.log('JC Join Status is false at line 586');
                                                    let response = {};
                                                    await session.abortTransaction();
                                                    session.endSession();
                                                    var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, sport: match_sport, is_full: { $ne: 1 } }).sort({ _id: -1 });
                                                    if (MatchContestData) {
                                                        response.status = false;
                                                        response.message = "This contest is full, please join other contest.";
                                                        response.data = { contest_id: MatchContestData.contest_id };
                                                        response.error_code = null;
                                                        return res.json(response);
                                                    } else {
                                                        response.status = false;
                                                        response.message = "This contest is full, please join other contest.";
                                                        response.error_code = null;
                                                        return res.json(response);
                                                    }
                                                }

                                            } else {
                                                await session.abortTransaction();
                                                session.endSession();
                                                console.log('JC session drop at 610 *****');
                                                let response = {};
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.error_code = null;
                                                return res.json(response);
                                            }

                                        } catch (errorr) {
                                            let response = {};
                                            await session.abortTransaction();
                                            session.endSession();
                                            console.log("error in catch***", errorr);
                                            var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, 'sport': match_sport, is_full: { $ne: 1 } }).sort({ _id: -1 });
                                            if (MatchContestData) {
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.data = { contest_id: MatchContestData.contest_id };
                                                response.error_code = null;
                                                return res.json(response);
                                            } else {
                                                response.status = false;
                                                response.message = "This contest is full, please join other contest.";
                                                response.error_code = null;
                                                return res.json(response);
                                            }
                                        } finally {
                                            // ending the session
                                            session.endSession();
                                        }
                                    } else {
                                        return res.send(ApiUtility.failed("Already Joined Contest."));
                                    }
                                } else {
                                    return res.send(ApiUtility.failed("You can not add more than " + maxTeamSize + " teams."));
                                }
                            } else {
                                return res.send(ApiUtility.failed('You have no team to join this contest.'));
                            }
                        }
                    } else {
                        return res.send(ApiUtility.failed('You can not join contest, match already started'));
                    }


                } else {
                    return res.send(ApiUtility.failed("You are not authenticated user."));
                }
            } else {
                return res.send(ApiUtility.failed("Something went wrong!!."));
            }
        } else {
            return res.send(ApiUtility.failed("user id, match id, series id or contest id are empty."));
        }
    } catch (error) {
        console.log(error);
        return res.send(ApiUtility.failed(error.message));
    }
}

/**
 * This is used to get count of contest joins and join contest
 * @param {*} contest 
 * @param {*} user_id 
 * @param {*} match_id 
 * @param {*} series_id 
 * @param {*} contest_id 
 * @param {*} contestData 
 * @param {*} parentContestId 
 * @param {*} session 
 */
async function getContestCount(contest, match_id, contest_id, contestData, session, match_sport, joinedContestCount) {
    try {
        
        return new Promise(async (resolve, reject) => {
            await PlayerTeamContest.create([contest], { session: session }).then(async (newDataPTC) => {
                if (joinedContestCount == contestData.contest_size) {
                    await MatchContest.findOneAndUpdate({ 'match_id': parseInt(match_id), 'sport': match_sport, 'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } });
                    await session.commitTransaction();
                    session.endSession();
                } else {
                    await session.commitTransaction();
                    session.endSession();
                }
                return resolve(1);
            });
        })
    } catch (error) {
        console.log("JC eroor in catch erorr error at 800",error);  
    }
}



