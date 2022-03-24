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
const Helper = require('./../common/helper');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');


module.exports = async (req, res) => {
    try {
        //console.log('hello test');
        const { player_team_id,team_name,user_id,p_type, category_id,team_count, contest_id, series_id, match_id, sport,pid,by_user,isCreatedBy,} = req.body;

        
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
                SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] },{time:1,localteam:1,localteam_id:1,visitorteam:1,visitorteam_id:1}),
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

                                // var parentContestId = contestData._id;
                                var parentContestId = (contestData && contestData.parent_id) ? contestData.parent_id : contestData._id;
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
                                                let matchContest = doc;
                                                if (contestData && contestData.contest_size < joinedContestCount && infinteStatus) {
                                                    redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                                                    //console.log("PREM Going in the/ last response ----------***********", contestData.contest_size, joinedContestCount);
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
                                                let avatar_name = avatar1;
                                                joinStatus = joinedContest && (joinedContest < contestData.contest_size || contestData.infinite_contest_size == 1) ? true : (joinedContest == 0 ? true : false);
                                                const avatar_list = ['avatar1','','avatar2','avatar3','','avatar4','avatar5','','avatar6','avatar7','','avatar8','avatar9',
                                                'avatar10','avatar11','','avatar12','avatar13','','avatar14','','avatar15','','avatar16','avatar17','avatar18','avatar19','avatar20',
                                                'avatar21','','avatar22','','avatar23','avatar24','avatar25','avatar26','avatar27','','avatar28','avatar29','avatar30',
                                                'avatar31','avatar32','','avatar33','avatar34','','avatar35','avatar36','avatar37','avatar38','avatar39','avatar40'];
                                                try{
                                                    avatar_name = avatar_list[Math.floor(Math.random()*avatar_list.length)];
                                                }catch(err_avtart){}
                                                
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
                                                    contest.avatar = avatar_name ? avatar_name : 'avatar40';
                                                    if(p_type){
                                                        contest.p_type = p_type;
                                                    }
                                                    if(category_id){
                                                        contest.category_id = category_id;
                                                    }
 
                                                    try {
                                                        
                                                        if(_.has(contest, "player_team_id") && _.has(contest, "team_count") &&  _.has(contest, "team_name") &&  contest.team_name !='' && contest.player_team_id !=null && contest.player_team_id != '' && contest.team_count != null && contest.team_count != '' && contest.team_count > 0 ){
                                                            totalContestKey = await getContestCount(contest, match_id, series_id,contest_id, contestData, session, match_sport, joinedContestCount,parentContestId,liveMatch,matchContest);
                                                            
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
async function getContestCount(contest, match_id, series_id,contest_id, contestData, session, match_sport, joinedContestCount,parentContestId,liveMatch,matchContest) {
    try {
        
        return new Promise(async (resolve, reject) => {
            await PlayerTeamContest.create([contest], { session: session }).then(async (newDataPTC) => {
                let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;
                var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
                if (isAutoCreateStatus) {
                    if (joinedContestCount >= contestData.contest_size && infinteStatus) {
                        redis.setRedis('PERMAINAN_FOR_MATCH_CONTEST_ID_' + match_id + '_' + contest_id, 'FALSE');
                       // console.log('Perm Contest full****************************');
                        if (matchContest && matchContest.category_slug && (_.isEqual(matchContest.category_slug, 'head-to-head') || _.isEqual(matchContest.category_slug, 'last-man-standing'))) {
                            await session.commitTransaction();
                            session.endSession();
                            let macthContestData  = await MatchContest.findOneAndUpdate({ 'match_id': match_id, 'sport': match_sport, 'contest_id': contest_id }, { $set: { is_full: 1 } });
                            if(macthContestData && macthContestData._id && macthContestData.parent_contest_id){
                                let queryMatchContest = { 'parent_contest_id': macthContestData.parent_contest_id, match_id: match_id, sport: match_sport, joined_users: 1 };
                                if(_.isEqual(matchContest.category_slug, 'last-man-standing')){
                                    let maxTeam = macthContestData.contest && macthContestData.contest.contest_size ? macthContestData.contest.contest_size:0;
                                    queryMatchContest = { 'parent_contest_id': macthContestData.parent_contest_id, match_id: match_id, sport: match_sport, joined_users: {$nin:[0,maxTeam]} };
                                }
                                var remainSlotCounts = await MatchContest.find(queryMatchContest).count();
                                if(remainSlotCounts ==0){
                                   // console.log("prem*** restet attendee");
                                    let queyUpdate = {'contest_id': macthContestData.parent_contest_id, match_id: match_id, sport: match_sport};
                                    if(_.isEqual(matchContest.category_slug, 'head-to-head')){
                                        queyUpdate.attendee =1;
                                    }
                                    await MatchContest.findOneAndUpdate(queyUpdate,{ $set: { attendee: 0 } });
                                }
                            }
                            

                        } else {
                            console.log('Perm Contest full**************************** autocreate for lms');
                            await contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session, matchContest);
                            await MatchContest.findOneAndUpdate({ 'match_id': match_id, 'sport': match_sport, 'contest_id': contest_id }, { $set: { is_full: 1 } });
                            let userDataPTC = await PlayerTeamContest.find({ 'match_id': match_id, 'sport': match_sport, 'contest_id': contest_id },{user_id:1});
                            if(userDataPTC && userDataPTC.length>0 && userDataPTC.length < 8 ){
                                userDataPTC.map(item => {
                                    if(item && item.user_id){
                                        let uId = item.user_id;
                                        redis.redisObj.get('user-teams-count-' + match_id + '-' + match_sport + '-' + uId, (err, data) => {
                                            if(data){
                                               
                                                redis.redisObj.del('user-teams-count-' + match_id + '-' + match_sport + '-' + uId);
                                            }
                                        });
                                    }
                                });
                            }
                            
                        }
                    } else {
                        await session.commitTransaction();
                        session.endSession();
                    }
                } else {
                    await session.commitTransaction();
                    session.endSession();
                    if (joinedContestCount >= contestData.contest_size && infinteStatus) {
                        await MatchContest.findOneAndUpdate({ 'match_id': match_id, 'sport': match_sport, 'contest_id': contest_id }, { $set: { is_full: 1 } });
                     }
                    
                }
                return resolve(1);
            });
        })
    } catch (error) {
        console.log("perm JC eroor in catch erorr error at 800",error);  
    }
}

async function contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId, match_sport, liveMatch, session, matchContest) {
    try {

        let catID = contestData.category_id;
        let entity = {};
        entity.category_id = catID;
        entity.is_full = false;
        entity.admin_comission = contestData.admin_comission;
        entity.winning_amount = contestData.winning_amount;
        entity.contest_size = contestData.contest_size;
        entity.min_contest_size = contestData.min_contest_size;
        entity.contest_type = contestData.contest_type;
        entity.entry_fee = contestData.entry_fee;
        entity.used_bonus = contestData.used_bonus;
        entity.confirmed_winning = contestData.confirmed_winning;
        entity.multiple_team = contestData.multiple_team;
        entity.auto_create = contestData.auto_create;
        entity.status = contestData.status;
        entity.price_breakup = contestData.price_breakup;
        entity.invite_code = contestData.invite_code;
        entity.breakup = contestData.breakup;
        entity.amount_gadget = contestData.amount_gadget;
        entity.created = new Date();
        entity.maximum_team_size = contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1);
        if (parentContestId) {
            entity.parent_id = parentContestId;
        } else {
            entity.parent_id = contestData._id;
        }
        entity.is_auto_create = 2;
        // console.log('cResult************** before');
        const newDataC = await Contest.create([entity], { session: session });
        var cResult = newDataC && newDataC.length > 0 ? newDataC[0] : {};
        let inviteCode = Helper.createUserReferal(6);
        if (cResult && cResult._id) {
            let newContestId = cResult._id;
            let entityM = {};
            if (parentContestId) {
                entityM.parent_contest_id = parentContestId;
            } else {
                entityM.parent_contest_id = contestData._id;
            }
            entityM.match_id = match_id;
            entityM.contest_id = newContestId;
            entityM.series_id = series_id;
            entityM.category_id = ObjectId(catID);
            entityM.invite_code = '1Q' + inviteCode;
            entityM.created = new Date();
            entityM.localteam = liveMatch.localteam || '';
            entityM.localteam_id = liveMatch.localteam_id || '';
            entityM.visitorteam = liveMatch.visitorteam || '';
            entityM.visitorteam_id = liveMatch.visitorteam_id || '';
            entityM.is_auto_create = 1;
            entityM.admin_create = 0;
            entityM.joined_users = 0;
            entityM.is_private = 0;
            entityM.sport = match_sport;

            entityM.is_offerable = matchContest && matchContest.is_offerable ? matchContest.is_offerable : 0;
            if(matchContest && matchContest.is_offerable){
                entityM.offer_after_join = matchContest && matchContest.offer_after_join ? matchContest.offer_after_join : 0;
                entityM.offerable_amount = matchContest && matchContest.offerable_amount ? matchContest.offerable_amount : 0;
            }
            entityM.category_slug = matchContest && matchContest.category_slug ? matchContest.category_slug : '';
            entityM.category_name = matchContest && matchContest.category_name ? matchContest.category_name : '';
            entityM.category_description = matchContest && matchContest.category_description ? matchContest.category_description : "";
            entityM.category_seq = matchContest && matchContest.category_seq ? matchContest.category_seq : 0;
            entityM.contest = {
                entry_fee: contestData.entry_fee,
                winning_amount: contestData.winning_amount,
                contest_size: contestData.contest_size,
                contest_type: contestData.contest_type,
                confirmed_winning: contestData.confirmed_winning,
                amount_gadget: contestData.amount_gadget,
                category_id: contestData.category_id,
                multiple_team: contestData.multiple_team,
                contest_size: contestData.contest_size,
                infinite_contest_size: contestData.infinite_contest_size,
                winning_amount_times: contestData.winning_amount_times,
                is_auto_create: contestData.is_auto_create,
                auto_create: contestData.auto_create,
                used_bonus: contestData.used_bonus,
                winner_percent: contestData.winner_percent,
                breakup: contestData.breakup,
                is_private:0,
                maximum_team_size: contestData && contestData.maximum_team_size && !_.isNull(contestData.maximum_team_size) ? contestData.maximum_team_size : ((contestData.multiple_team == "yes") ? 9 : 1)
            };
            const match_contest_new = await MatchContest.create([entityM], { session: session });
            await session.commitTransaction();
            session.endSession();

            try {
                let matchContestKey = RedisKeys.MATCH_CONTEST_LIST + match_id;
                redis.getRedis(matchContestKey, (err, categories) => {
                    let catId = contestData.category_id.toString();
                    let catIndex = _.findIndex(categories, { "_id": catId });
                    if (catIndex >= 0) {
                        let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                        if (contestIndex >= 0) {
                            let newCOntestDeepObj = JSON.parse(JSON.stringify(categories[catIndex]['contests'][contestIndex]))
                            categories[catIndex]['contests'].splice(contestIndex, 1);
                            newCOntestDeepObj["contest_id"] = cResult._id;
                            newCOntestDeepObj["parent_id"] = contest_id;
                            if (categories[catIndex]['contests'].length === 0) {
                                categories[catIndex].contests.push(newCOntestDeepObj);
                            } else {
                                categories[catIndex].contests.unshift(newCOntestDeepObj);
                            }
                            redis.setRedis(matchContestKey, categories);
                        }
                    }
                });
            } catch (errr) {
                console.log('JC eorr in auto create redis***');
            }

            return cResult;
        } else {
            console.log('Perm auro else');
            return {}
        }

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.log('sometjhing went wrong in autocreate at perm***************************wrong in auto error');
        return {}
    }



}



