const config = require('../../../config');
const User = require('../../../models/user');
const LFMatchContest = require('../../../models/live-fantasy/lf-match-contest');
const LFMatchSeriesSquad = require('../../../models/live-fantasy/lf-match-list-model');
const LFPrediction = require('../../../models/live-fantasy/lf-prediction');
const Category = require('../../../models/category');
const LFJoinedContest = require('../../../models/live-fantasy/lf_joined_contest');
const ApiUtility = require('../../api.utility');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const Helper = require('./../common/helper');
const db = require('../../../db');
const { setRedis } = require('../../../../lib/redis');

async function getLFRedisLeaderboard(matchId, contestId) {
    try {
        return new Promise(async (resolve, reject) => {
            let leaderboardRedis = 'lf-leaderboard-' + matchId + '-' + contestId;
            await redis.getRedisLFBoard(leaderboardRedis, function (err, contestData) {
                if (contestData) {
                    return resolve(contestData);
                } else {
                    return resolve(false);
                }
            })
        });
    } catch (error) {
        console.log('LF redis leaderboard > ', error);
    }
}

const getAllLFTeamsByMatchIdRedis = async (match_id, contest_id, user_id, aakashId) => {
    let leaderboardRedis = 'lf-leaderboard-' + match_id + '-' + contest_id

    return new Promise(async (resv, rej) => {
        await redis.getRedisLFBoard(leaderboardRedis, function (err, reply) {
            console.log('repl********',reply);
            if (!err) {
                const result = reply.reduce((index, obj) => {
                    if(aakashId) {
                        if (obj.user_id != user_id && obj.user_id != aakashId && index.length < 100)
                            index.push(obj);
                    } else {
                        if (obj.user_id != user_id && index.length < 100)
                            index.push(obj);
                    }
                    return index;
                }, []);
                resv(result)
            } else {
                rej(err)
            }
        })
        
    })
}

module.exports = {
    lfContestDetailNew: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
                sport: parseInt(sport) || 1,
            }
            sport   =   parseInt(sport) || 1;
            let reviewMatch = await LFMatchSeriesSquad.findOne({ 'match_id': match_id, sport:sport });
            let reviewStatus = '';
            if (reviewMatch) {
                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                    reviewStatus = 'Under Review';
                } else if (reviewMatch.match_status == 'Delayed') {
                    reviewStatus = 'Delayed';
                }
            }
            let contestData;
            if (!contestData) {
                let contestDetail = await LFMatchContest.findOne({ 'match_id': match_id,contest_id: contest_id });
                contestDetail = JSON.parse(JSON.stringify(contestDetail));
                let prizeMoney = 0;
                let totalTeams = 0;
                // let teamsJoined = [];
                // let toalWinner = 0;
                let entryfee = 0;
                let teamData = [];
                let myTeamIds = [];
                let customPrice = [];
                let inviteCode = contestDetail && contestDetail.invite_code ? contestDetail.invite_code : '';
                
                let finiteBreakupDetail = {};

                if (contestDetail.infinite_contest_size == 1) {
                    finiteBreakupDetail.winner_percent = contestDetail.winner_percent;
                    finiteBreakupDetail.winner_amount = contestDetail.winning_amount_times;
                }

                let aakashData  =   {};
                if(contestDetail.amount_gadget == 'aakash') {
                    aakashData  =   await User.findOne({ "user_type": 101 }, { "team_name": 1, "image": 1, "_id":1 });
                }
                let aakashTeams = [];
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    aakashTeams = await LFJoinedContest.find({match_id:match_id, contest_id:ObjectId(contest_id), user_id:aakashData._id, is_deleted:0});
                }
                let myTeams = await LFJoinedContest.find({match_id:match_id, contest_id:ObjectId(contest_id), user_id:ObjectId(user_id), is_deleted:0});
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                    mergedTeam = [...myTeams, ...aakashTeams];
                } else {
                    mergedTeam = myTeams;
                }
                let teamCount = 0;
                let player_team_id_filter = []
                for (const userTeam of mergedTeam) {
                    if (_.find(player_team_id_filter, userTeam.prediction_id)){
                        continue
                    }else{
                    let predictions = [];
                    player_team_id_filter.push(userTeam.prediction_id);
                    predictions.push(userTeam.prediction);
                    if (userTeam && userTeam.prediction_id) {
                        let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                       //let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                       teamData[teamCount] = {};
                       teamData[teamCount]['user_id'] = userTeam.user_id;
                       teamData[teamCount]['team_name'] = userTeam.team_name || "";
                       teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                       teamData[teamCount]['team_no'] = userTeam.team_count || 1 ;
                       teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                       teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                       teamData[teamCount]['point'] = userTeam.points || 0;
                       teamData[teamCount]['winning_amount'] = winAmount;
                       teamData[teamCount]['prediction'] = userTeam.prediction || {};
                       teamData[teamCount]['is_aakash_team'] = _.isEqual(ObjectId(userTeam.user_id), ObjectId(aakashData._id)) ? true : false;
                    }
                    teamCount++;
                }
                }

                let ranArr = [];
                let MyUser = [];

                if (teamData) {
                    key = 0;
                    for (const teamss of teamData) {
                        if (teamss && teamss['user_id'] == decoded['user_id']) {
                            MyUser.push(teamss);
                            delete teamData[key];
                        }
                        key++;
                    }
                }

                if (teamData) {
                    for (const teamss of teamData) {
                        if (teamss) {
                            ranArr.push(teamss['rank']);
                        }
                    }
                }

                let teamRankData = MyUser.concat(teamData);
                if (!contestDetail.confirmed_winning || contestDetail.confirmed_winning == '' || contestDetail.confirmed_winning == '0' || contestDetail.confirmed_winning == 'no') {
                    winComfimed = 'no';
                } else {
                    winComfimed = 'yes';
                }
                if (decoded['user_id'] && myTeams) {
                    if (myTeams) {
                        for (const joined of myTeams) {
                            if(joined.prediction_id) {
                                myTeamIds.push({ "prediction_id": joined.prediction_id });
                            }
                        }
                    }
                }

                prizeMoney = contestDetail.winning_amount;
                totalTeams = contestDetail.contest_size;
                entryfee = contestDetail.entry_fee;
                multipleTeam =false;  // (contestDetail.multiple_team && contestDetail.multiple_team == 'yes') ? true : false;
                gadgetLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'gadget') ? true : false;
                aakashLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'aakash') ? true : false;
                
                let is_joined = (myTeamIds.length > 0) ? true : false;
                let bonusAmount = 0;
                let useBonus = 0;
                if (contestDetail && contestDetail.usable_bonus_time) {
                    if (moment().isBefore(contestDetail.usable_bonus_time)) {
                        useBonus = contestDetail.before_time_bonus;
                    } else {
                        useBonus = contestDetail.after_time_bonus;
                    }
                } else {
                    if (contestDetail.used_bonus != '') {
                        useBonus = contestDetail.used_bonus;
                    } else if (contestDetail.entry_fee > 0) {
                        useBonus = bonusAmount;
                    }
                }

                if (contestDetail.breakup) {
                    let key = 0;
                    if (contestDetail.amount_gadget == 'gadget') {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }
                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['gadget_name'] = customBreakup.gadget_name ? (customBreakup.gadget_name) : "";
                            customPrice[key]['image'] = customBreakup.image ? config.imageBaseUrl + '/' + customBreakup.image : "";
                            key++;
                        }
                    } else {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }

                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['price'] = customBreakup.price_each ? (customBreakup.price_each).toFixed(2) : (customBreakup.price).toFixed(2);
                            if (customBreakup.endRank) {
                                toalWinner = customBreakup.endRank;
                            } else {
                                toalWinner = customBreakup.startRank;
                            }
                            key++;
                        }
                    }
                }
               
                let contestData = {
                    match_status: (reviewMatch) ? reviewMatch.status : '',
                    prize_money: prizeMoney,
                    usable_bonus_time: contestDetail.usable_bonus_time,
                    before_time_bonus: contestDetail.before_time_bonus,
                    after_time_bonus: contestDetail.after_time_bonus,
                    confirm_winning: winComfimed.toString(),
                    total_teams: totalTeams,
                    entry_fee: entryfee,
                    invite_code: inviteCode,
                    join_multiple_teams: multipleTeam,
                    teams_joined: contestDetail.joined_users|| 0,
                    is_gadget: gadgetLeague,
                    total_winners: (contestDetail.breakup && contestDetail.breakup.length > 0) ? contestDetail.breakup.pop() : {}, //toalWinner,
                    prediction_joined: myTeams ? myTeams.length : 0,
                    is_joined: is_joined,
                    my_prediction_ids: myTeamIds,
                    joined_prediction_list: teamRankData,
                    breakup_detail: customPrice,
                    server_time: moment(Date.now()).format(config.DateFormat.datetime),
                    use_bonus: useBonus,
                    review_status: reviewStatus,
                    is_infinite: (contestDetail.infinite_contest_size == 1) ? true : false,
                    infinite_breakup: finiteBreakupDetail,
                    is_aakash_team: aakashLeague,
                    maximum_team_size: 1, // multipleTeam && contestDetail.maximum_team_size ? contestDetail.maximum_team_size : 1,
                    contest_shareable : contestDetail && contestDetail.contest_shareable ? contestDetail.contest_shareable : 0,	
                    category_id:contestDetail && contestDetail.category_id ?contestDetail.category_id:'',
                    category_name:contestDetail && contestDetail.category_name ?contestDetail.category_name:'',
                    my_prediction: player_team_id_filter? player_team_id_filter.length : 0,
                    match_type: "live-fantasy"
                }
                if (reviewMatch == "In Progress") {
                    //redis.setRedis(contestDataAPIKey, contestData)
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    lfContestLeaderboard: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
            }
            
            sport   =   parseInt(sport) || 1;
            let contestDetail = await LFMatchContest.findOne({ contest_id: contest_id });
    
            let aakashData  =   {};
            if(contestDetail.amount_gadget == 'aakash') {
                aakashData  =   await User.findOne({ "user_type": 101 }, { "team_name": 1, "image": 1, "_id":1 });
            }
    
            let mergedTeam = [];
            let redisTeams = await getLFRedisLeaderboard(match_id, contest_id);
            let myTeams = [];
            if (redisTeams) {
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    mergedTeam = await getAllLFTeamsByMatchIdRedis(match_id, contest_id, user_id, aakashData._id);
                } else {
                    mergedTeam = await getAllLFTeamsByMatchIdRedis(match_id, contest_id, user_id, '');
                }
            }
            
            if (mergedTeam && mergedTeam.length == 0) {
                let allTeams = [];
                let leaderboardKey = 'lf-leaderboard-' + match_id + '-' + contest_id;
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    allTeams = await LFJoinedContest.find({ 
                        match_id:parseInt(match_id),
                        sport: sport,
                        contest_id:ObjectId(contest_id),
                        user_id:{$ne:ObjectId(user_id)},
                        is_deleted:0
                      }).limit(100).sort({_id:-1});
                } else {
                    allTeams = await LFJoinedContest.find({
                        match_id:parseInt(match_id),
                        sport: sport,
                        contest_id:ObjectId(contest_id),
                        is_deleted:0
                      }).limit(100).sort({_id:-1});
                }
                if(allTeams && (allTeams.length == 100 || contestDetail.contest_size == allTeams.length)) {
                    await redis.setRedisLFBoard(leaderboardKey, allTeams);
                }
                
                mergedTeam = allTeams;
            }
            let teamCount = 0;
            let teamData = [];
    
            for (const userTeam of mergedTeam) {
                 let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                //let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                if (userTeam) {
                    teamData[teamCount] = {};
                    teamData[teamCount]['user_id'] = userTeam.user_id;
                    teamData[teamCount]['team_name'] = userTeam.team_name || "";
                    teamData[teamCount]['user_image'] = '';
                    teamData[teamCount]['team_no'] = userTeam.team_count || 0;
                    teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                    teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                    teamData[teamCount]['point'] = userTeam.points || 0;
                    teamData[teamCount]['winning_amount'] = winAmount;
                    teamData[teamCount]['user_preview_point'] = userTeam.user_preview || {};
                   // teamData[teamCount]['prediction'] = userTeam.prediction || {};
                    teamData[teamCount]['is_aakash_team'] = false;
                }
                teamCount++;
            }
    
            let ranArr = [];
            let MyUser = [];
            let newTeamData = [];
    
            if (teamData) {
                key = 0;
                for (const teamss of teamData) {
                    if (teamss && _.isEqual(ObjectId(teamss['user_id']), ObjectId(decoded['user_id'])) ) {
                        MyUser.push(teamss);
                        delete teamData[key];
                    } else {
                        newTeamData.push(teamss);
                    }
                    key++;
                }
            }
    
            teamData.filter((e) => {
                return e;
            })
    
            if (teamData) {
                for (const teamss of teamData) {
                    if (teamss) {
                        ranArr.push(teamss['rank']);
                    }
                }
            }
    
            let teamRankData = newTeamData;
            let contestData = {
                joined_team_list: teamRankData,
                match_type: "live-fantasy"
            }
    
            return res.send(ApiUtility.success(contestData));
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    lfLivecontestDetailLB: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
            }
            sport   =   parseInt(sport) || 1;
            let reviewMatch = await LFMatchSeriesSquad.findOne({ 'match_id': match_id, "sport": sport });
            let joinedTeams = await LFJoinedContest.find({ 'match_id': match_id, 'contest_id': contest_id,is_deleted:0 }).countDocuments();
            let reviewStatus = '';
            if (reviewMatch) {
                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                    reviewStatus = 'Under Review';
                } else if (reviewMatch.match_status == 'Delayed') {
                    reviewStatus = 'Delayed';
                }
            }
            let contestData;
        
            if (!contestData) {
                let contestDetail = await LFMatchContest.findOne({ contest_id: contest_id });
                contestDetail = JSON.parse(JSON.stringify(contestDetail));
                let prizeMoney = 0;
                let totalTeams = 0;
                let teamsJoined = [];
                let toalWinner = 0;
                let entryfee = 0;
                let inviteCode = '';
                let teamData = [];
                let myTeamIds = [];
                let customPrice = [];
                matchInviteCode = contestDetail;
                if (matchInviteCode && matchInviteCode.invite_code) {
                    inviteCode = matchInviteCode.invite_code;
                }

                let finiteBreakupDetail = {};

                if (contestDetail.infinite_contest_size && contestDetail.infinite_contest_size == 1) {
                    finiteBreakupDetail.winner_percent = contestDetail.winner_percent;
                    finiteBreakupDetail.winner_amount = contestDetail.winning_amount_times;
                }

                let aakashData = {};
                if(contestDetail.amount_gadget == 'aakash') {
                    aakashData  =   await User.findOne({ "user_type": 101 }, { "team_name": 1, "image": 1, "_id":1 });
                }
                
                let mergedTeam = [];
                let redisTeams = await getLFRedisLeaderboard(match_id, contest_id);
                
                let myTeams = [];
                let aakashTeams = [];
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    
                    aakashTeams = await LFJoinedContest.find({
                        match_id:parseInt(match_id),
                        sport:parseInt(sport),
                        contest_id:ObjectId(contest_id),
                        user_id:ObjectId(aakashData._id),
                        is_deleted:0
                      }).limit(15).sort({"rank": 1});
                }
               
                if (!_.isEmpty(redisTeams)) {
                    console.log("Live leader board coming from redis*****");
                    MyUserData = await User.findOne({ _id: user_id }, { "team_name": 1, "image": 1 });
                    myTeams = await LFJoinedContest.find({
                        match_id:parseInt(match_id),
                        sport:parseInt(sport),
                        contest_id:ObjectId(contest_id),
                        user_id:ObjectId(user_id),
                        is_deleted:0
                      }).limit(15).sort({"rank": 1});
                    let allTeams = [];
                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                        allTeams =  await getAllLFTeamsByMatchIdRedis(match_id, contest_id, user_id, aakashData._id);
                    } else {
                        allTeams =  await getAllLFTeamsByMatchIdRedis(match_id, contest_id, user_id, '');
                    }
                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                        mergedTeam = [...myTeams, ...aakashTeams, ...allTeams];
                    } else {
                        mergedTeam = [...myTeams, ...allTeams];
                    }
                    console.log("mergedTeam****",mergedTeam);
                }
                
                if (mergedTeam && mergedTeam.length == 0) {
                    myTeams = await LFJoinedContest.find({
                        match_id:parseInt(match_id),
                        sport:parseInt(sport),
                        contest_id:ObjectId(contest_id),
                        user_id:ObjectId(user_id),
                        is_deleted:0
                      }).limit(15).sort({"rank": 1});
        
                      let allTeams = await getLFRedisLeaderboard(match_id, contest_id);
                        
                        if (_.isEmpty(allTeams)) {
                            console.log("Live FN leader board coming from DBBBBB*****");
                            let leaderboardKey = 'lf-leaderboard-' + match_id + '-' + contest_id;
                            if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                            
                                allTeams = await LFJoinedContest.find({
                                    match_id:parseInt(match_id),
                                    sport: sport,
                                    contest_id:ObjectId(contest_id),
                                    user_id:{$ne:ObjectId(user_id)},
                                    is_deleted:0
                                  }).limit(100).sort({"rank": 1});
                            } else {
                                
                                allTeams = await LFJoinedContest.find({
                                    match_id:parseInt(match_id),
                                    sport: sport,
                                    contest_id:ObjectId(contest_id),
                                    is_deleted:0
                                  }).limit(100).sort({"rank": 1});
                            }
                            if(((allTeams.length == 100 || contestDetail.contest_size == allTeams.length)) || reviewMatch.match_status == "In Progress" || reviewMatch.match_status == "Finished") {
                               // await redis.setRedisLFBoard(leaderboardKey, allTeams);
                            }
                           
                        }

                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                        mergedTeam = [...myTeams, ...aakashTeams, ...allTeams];
                    } else {
                        mergedTeam = [...myTeams, ...allTeams];
                    }
                    
                }
                let teamCount = 0;
                let player_team_id_filter = []

                for (const userTeam of mergedTeam) {
                    if (_.find(player_team_id_filter, userTeam.prediction_id)){
                        continue
                    } else {
                    
                    player_team_id_filter.push(userTeam.prediction_id);
                    let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                        if (userTeam) {
                            
                            teamData[teamCount] = {};
                            teamData[teamCount]['user_id'] = userTeam.user_id;
                            teamData[teamCount]['team_name'] = userTeam.team_name || '';
                            teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                            teamData[teamCount]['team_no'] = userTeam.team_count || 1;
                            teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                            teamData[teamCount]['previous_rank'] = userTeam.rank || 0;
                            teamData[teamCount]['point'] = userTeam.points || 0;
                            teamData[teamCount]['winning_amount'] = winAmount;
                            teamData[teamCount]['user_preview_point'] = userTeam.user_preview || {};
                            teamData[teamCount]['prediction'] = userTeam.prediction || {};
                            teamData[teamCount]['is_aakash_team'] = _.isEqual(ObjectId(userTeam.user_id), ObjectId(aakashData._id)) ? true : false;
                        }
                       teamCount++;
                    }
                        
                }

                let ranArr = [];
                let MyUser = [];
                let newTeamData = [];

                if (teamData) {
                    key = 0;
                    for (const teamss of teamData) {
                        if (teamss && _.isEqual(ObjectId(teamss['user_id']), ObjectId(decoded['user_id'])) ) {
                            MyUser.push(teamss);
                            delete teamData[key];
                        } else {
                            newTeamData.push(teamss);
                        }
                        key++;
                    }
                }

                teamData.filter((e) => {
                    return e;
                })

                if (teamData) {
                    for (const teamss of teamData) {
                        if (teamss) {
                            ranArr.push(teamss['rank']);
                        }
                    }
                }
                
                let teamRankData = MyUser.concat(newTeamData);

                if (!contestDetail.confirmed_winning || contestDetail.confirmed_winning == '' || contestDetail.confirmed_winning == '0' || contestDetail.confirmed_winning == 'no') {
                    winComfimed = 'no';
                } else {
                    winComfimed = 'yes';
                }
                if (decoded['user_id'] && myTeams) {
                    if (myTeams) {
                        for (const joined of myTeams) {
                            myTeamIds.push({ "player_team_id": joined.player_team_id });
                        }
                    }
                }

                prizeMoney = contestDetail.winning_amount;
                totalTeams = contestDetail.contest_size;
                entryfee = contestDetail.entry_fee;
                multipleTeam = (contestDetail.multiple_team && contestDetail.multiple_team == 'yes') ? true : false;
                gadgetLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'gadget') ? true : false;
                aakashLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'aakash') ? true : false;
                
                let is_joined = (myTeamIds.length > 0) ? true : false;

                let bonusAmount = 0; //config.admin_percentage;
                let useBonus = 0;
                if (matchInviteCode && matchInviteCode.usable_bonus_time) {
                    if (moment().isBefore(matchInviteCode.usable_bonus_time)) {
                        useBonus = matchInviteCode.before_time_bonus;
                    } else {
                        useBonus = matchInviteCode.after_time_bonus;
                    }
                } else {
                    if (contestDetail.used_bonus != '') {
                        useBonus = contestDetail.used_bonus;
                    } else if (contestDetail.entry_fee > 0) {
                        useBonus = bonusAmount;
                    }
                }


                if (contestDetail.breakup) {
                    let key = 0;
                    if (contestDetail.amount_gadget == 'gadget') {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }
                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['gadget_name'] = customBreakup.gadget_name ? (customBreakup.gadget_name) : "";
                            customPrice[key]['image'] = customBreakup.image ? config.imageBaseUrl + '/' + customBreakup.image : "";
                            key++;
                        }
                    } else {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }

                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['price'] = customBreakup.price_each ? (customBreakup.price_each).toFixed(2) : (customBreakup.price).toFixed(2);
                            if (customBreakup.endRank) {
                                toalWinner = customBreakup.endRank;
                            } else {
                                toalWinner = customBreakup.startRank;
                            }
                            key++;
                        }
                    }
                }
                // consolelog(contestDetail.breakup);
                let contestData = {
                    match_status: (reviewMatch) ? reviewMatch.status : '',
                    prize_money: prizeMoney,
                    usable_bonus_time: matchInviteCode.usable_bonus_time,
                    before_time_bonus: matchInviteCode.before_time_bonus,
                    after_time_bonus: matchInviteCode.after_time_bonus,
                    confirm_winning: winComfimed.toString(),
                    total_teams: totalTeams,
                    entry_fee: entryfee,
                    invite_code: inviteCode,
                    join_multiple_teams: multipleTeam,
                    is_gadget: gadgetLeague,
                    total_winners: (contestDetail.breakup && contestDetail.breakup.length > 0) ? contestDetail.breakup.pop() : {}, //toalWinner,
                    teams_joined: joinedTeams,
                    is_joined: is_joined,
                    my_team_ids: myTeamIds,
                    joined_team_list: teamRankData,
                    breakup_detail: customPrice,
                    server_time: moment(Date.now()).format(config.DateFormat.datetime),
                    use_bonus: useBonus,
                    review_status: reviewStatus,
                    is_infinite: (contestDetail.infinite_contest_size == 1) ? true : false,
                    infinite_breakup: finiteBreakupDetail,
                    is_aakash_team: aakashLeague,
                    match_scores: reviewMatch.match_scores || {},
                    ball_update: reviewMatch.ball_update || {},
                    match_type: "live-fantasy"
                }
                if (reviewMatch == "In Progress") {
                   // redis.setRedis(contestDataAPIKey, contestData)
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    }
}