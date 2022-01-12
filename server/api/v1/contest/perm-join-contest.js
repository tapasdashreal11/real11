const config = require('../../../config');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const db = require('../../../db');
const { startSession } = require('mongoose');


module.exports = async (req, res) => {
    try {
        console.log('hello test');
        const { player_team_id,team_name,user_id, team_count, contest_id, series_id, match_id, sport,pid,by_user,isCreatedBy,} = req.body;

        console.log('req.body',req.body);
        let match_sport = sport ? parseInt(sport) : 1;
        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id,
            user_id: user_id
        }
        var teamCount = team_count ? parseInt(team_count) : 0;
        var user_team_name = team_name ? team_name : '';
        var teamId = player_team_id ? player_team_id : '';
        var totalContestKey = 0;
        if (match_id && series_id && contest_id && user_id) {
            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] },{time:1}),
                PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }).countDocuments(),
                redis.getRedis('contest-detail-' + contest_id),
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
                            redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                            let response = {};
                            response.status = false;
                            response.is_match_live = true;
                            response.message = "Match has been started.";
                            response.error_code = null;
                            return res.json(response);
                            
                        } else { 
                            if (teamId && teamId != null && teamId != '' && ! _.isUndefined(teamId) && teamCount > 0) {
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
                                let joinedContest = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': series_id, 'contest_id': contest_id }).countDocuments();

                                var parentContestId = contestData._id;
                                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;

                                if (contestData && contestData.contest_size == parseInt(joinedContest) && infinteStatus) {
                                    redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                                    let response = {};
                                    response.status = false;
                                    response.message = "This contest is full, please join other contest.";
                                    response.error_code = null;
                                    return res.json(response);

                                 }

                                var PlayerTeamContestFilter = { 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'], 'player_team_id': teamId }
                                let playerTeamRes = await PlayerTeamContest.findOne(PlayerTeamContestFilter,{_id:1});
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
                                                    redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                                                    console.log("PREM Going in the/ last response ----------***********", contestData.contest_size, joinedContestCount);
                                                    await session.abortTransaction();
                                                    session.endSession();

                                                    await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }, { $set: { is_full: 1 } });
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
                                                    contest.isPermainan = true;
                                                    contest.pid = pid || '';
                                                    contest.by_user = by_user || '';
                                                    contest.isCreatedBy = isCreatedBy;

 
                                                    try {
                                                        
                                                        if(_.has(contest, "player_team_id") && _.has(contest, "team_count") &&  _.has(contest, "team_name") &&  contest.team_name !='' && contest.player_team_id !=null && contest.player_team_id != '' && contest.team_count != null && contest.team_count != '' && contest.team_count > 0 ){
                                                            totalContestKey = await getContestCount(contest, match_id, contest_id, contestData, session, match_sport, joinedContestCount);
                                                            return res.send(ApiUtility.failed('Join contest Successfully!!'));
                                                        } else {
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                            return res.send(ApiUtility.failed("Player team not found. Please try again!!"));
                                                        }

                                                    } catch (error) {
                                                        await session.abortTransaction();
                                                        session.endSession();
                                                        return res.send(ApiUtility.failed(error.message));
                                                    }
                                                } else {
                                                    let response = {};
                                                    await session.abortTransaction();
                                                    session.endSession();
                                                    response.status = false;
                                                    response.message = "This contest is full, please join other contest.";
                                                    response.error_code = null;
                                                    return res.json(response);
                                                }

                                            } else {
                                                await session.abortTransaction();
                                                session.endSession();
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
                                            response.status = false;
                                            response.message = "This contest is full, please join other contest.";
                                            response.data = {};
                                            response.error_code = null;
                                            return res.json(response);
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
                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;
                if (joinedContestCount >= contestData.contest_size && infinteStatus) {
                    redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                    console.log('Perm Contest full****************************');
                    await session.commitTransaction();
                    session.endSession();
                    await MatchContest.findOneAndUpdate({ 'match_id': match_id, 'sport': match_sport, 'contest_id': contest_id }, { $set: { is_full: 1 } });
                } else {
                    await session.commitTransaction();
                    session.endSession();
                }
                return resolve(1);
            });
        })
    } catch (error) {
        console.log("perm JC eroor in catch erorr error at 800",error);  
    }
}



