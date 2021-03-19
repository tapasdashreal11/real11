const config = require('../../../config');
const User = require('../../../models/user');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const Category = require('../../../models/category');
const PlayerTeamContest = require('../../../models/player-team-contest');
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

async function getRedisLeaderboard(matchId, contestId) {
    try {
        return new Promise(async (resolve, reject) => {
            let leaderboardRedis = 'leaderboard-' + matchId + '-' + contestId;
            await redis.getRedisLeaderboard(leaderboardRedis, function (err, contestData) {
                if (contestData) {
                    return resolve(contestData);
                } else {
                    return resolve(false);
                }
            })
        });
    } catch (error) {
        console.log('redis leaderboard > ', error);
    }
}

const getAllTeamsByMatchIdRedis = async (match_id, contest_id, user_id, aakashId) => {
    let leaderboardRedis = 'leaderboard-' + match_id + '-' + contest_id

    return new Promise(async (resv, rej) => {
        await redis.getRedisLeaderboard(leaderboardRedis, function (err, reply) {
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

 async function getCategoryRedis(category_id) {
    let categoryRedis = 'category-data-' + category_id

    return new Promise(async (resv, rej) => {
        redis.getRedis(categoryRedis, function (err, reply) {
            if (!err) {
                resv(reply)
            } else {
                resv([])
            }
        })
        
    })
}

module.exports = {
    contestDetailNew: async (req, res) => {
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
            let reviewMatch = await SeriesSquad.findOne({ 'match_id': match_id, sport:sport });
            
            let reviewStatus = '';
            if (reviewMatch) {
                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                    reviewStatus = 'Under Review';
                } else if (reviewMatch.match_status == 'Delayed') {
                    reviewStatus = 'Delayed';
                }
            }
            let contestDataAPIKey = RedisKeys.getContestDetailAPIKey(match_id, contest_id);
            let contestData;
            if (reviewMatch == "In Progress") {
                contestData = await redis.getRedis(contestDataAPIKey);
            }
            if (!contestData) {
                let contestDetail = await Contest.findOne({ _id: contest_id });
                let CategoryData = await getCategoryRedis(contestDetail.category_id);
                if(_.isEmpty()) {
                    CategoryData   =   await Category.findOne({ _id: contestDetail.category_id })
                    let categoryRedis = 'category-data-' + contestDetail.category_id;
                    setRedis(categoryRedis, CategoryData);
                }
                contestDetail = JSON.parse(JSON.stringify(contestDetail));
                let prizeMoney = 0;
                let totalTeams = 0;
                // let teamsJoined = [];
                // let toalWinner = 0;
                let entryfee = 0;
                let inviteCode = '';
                let teamData = [];
                let myTeamIds = [];
                let customPrice = [];
                matchInviteCode = await MatchContest.getInviteCode(parseInt(match_id), contest_id, sport);
                if (matchInviteCode && matchInviteCode.invite_code) {
                    inviteCode = matchInviteCode.invite_code;
                }

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
                    aakashTeams = await PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, aakashData._id, sport);
                }

                let myTeams = await PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, user_id, sport);
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                    mergedTeam = [...myTeams, ...aakashTeams];
                } else {
                    mergedTeam = myTeams;
                }
                // let allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id);
                let teamCount = 0;

                let player_team_id_filter = []
                for (const userTeam of mergedTeam) {
                    
                    if (_.find(player_team_id_filter, userTeam.player_team_id)){
                        continue
                    }else{
                    let player_ids = [];

                    let playerTeam = await PlayerTeam.findById(userTeam.player_team_id);
                    player_team_id_filter.push(userTeam.player_team_id);
                    if (playerTeam) {
                        let player_ids_array = playerTeam.players

                        for (const row of player_ids_array) {
                            player_ids.push(row.player_id);
                        }

                       // let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                      let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                        if (userTeam.user) {
                            let teamUserDetail = userTeam.user;
                            teamData[teamCount] = {};
                            teamData[teamCount]['user_id'] = userTeam.user_id;
                            teamData[teamCount]['team_name'] = teamUserDetail.team_name;
                            teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                            teamData[teamCount]['team_no'] = (playerTeam) ? playerTeam.team_count : 0;
                            teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                            teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                            teamData[teamCount]['point'] = playerTeam.points || 0;
                            // teamData[teamCount]['substitute_status']	=	playerTeam.substitute_status;
                            teamData[teamCount]['winning_amount'] = winAmount;
                            teamData[teamCount]['is_aakash_team'] = _.isEqual(ObjectId(teamUserDetail._id), ObjectId(aakashData._id)) ? true : false;
                        }
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

                let teamRankData = MyUser.concat(teamData);
                
                if (!contestDetail.confirmed_winning || contestDetail.confirmed_winning == '' || contestDetail.confirmed_winning == '0' || contestDetail.confirmed_winning == 'no') {
                    winComfimed = 'no';
                } else {
                    winComfimed = 'yes';
                }
                if (decoded['user_id'] && myTeams) {
                    if (myTeams) {
                        for (const joined of myTeams) {
                            if(joined.player_team_id) {
                                myTeamIds.push({ "player_team_id": joined.player_team_id });
                            }
                        }
                    }
                }

                prizeMoney = contestDetail.winning_amount;
                totalTeams = contestDetail.contest_size;
                entryfee = contestDetail.entry_fee;
                multipleTeam = (contestDetail.multiple_team && contestDetail.multiple_team == 'yes') ? true : false;
                gadgetLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'gadget') ? true : false;
                aakashLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'aakash') ? true : false;
                let joinedTeams = await PlayerTeamContest.find({ 'match_id': match_id, 'contest_id': contest_id, sport: sport }).countDocuments();
                let is_joined = (myTeamIds.length > 0) ? true : false;

                let bonusAmount = 0;
                let useBonus = 0;
                // console.log(matchInviteCode); return false;
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
                let myTeamsCount = await PlayerTeam.find({ user_id: user_id, match_id: parseInt(match_id), sport: sport }).countDocuments()
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
                    maximum_team_size: multipleTeam && contestDetail.maximum_team_size ? contestDetail.maximum_team_size : 1,
                    contest_shareable : contestDetail && contestDetail.contest_shareable ? contestDetail.contest_shareable : 0,	
                    category_id:contestDetail && contestDetail.category_id ?contestDetail.category_id:'',
                    category_name:CategoryData && CategoryData.category_name ?CategoryData.category_name:'',
                    my_teams: myTeamsCount || 0
                }
                if (reviewMatch == "In Progress") {
                    redis.setRedis(contestDataAPIKey, contestData)
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    contestLeaderboard: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
            }
            
            sport   =   parseInt(sport) || 1;
            let reviewMatch = await SeriesSquad.findOne({ 'match_id': match_id, sport: sport });
            let contestDetail = await Contest.findOne({ _id: contest_id });

            let aakashData  =   {};
            if(contestDetail.amount_gadget == 'aakash') {
                aakashData  =   await User.findOne({ "user_type": 101 }, { "team_name": 1, "image": 1, "_id":1 });
            }

            let mergedTeam = [];
            let redisTeams = await getRedisLeaderboard(match_id, contest_id);
            let myTeams = [];
            if (redisTeams) {
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    mergedTeam = await getAllTeamsByMatchIdRedis(match_id, contest_id, user_id, aakashData._id);
                } else {
                    mergedTeam = await getAllTeamsByMatchIdRedis(match_id, contest_id, user_id, '');
                }
            }
            
            if (mergedTeam && mergedTeam.length == 0) {
                let allTeams = [];
                // allTeams = await getRedisLeaderboard(match_id, contest_id);
                let leaderboardKey = 'leaderboard-' + match_id + '-' + contest_id;
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id, sport, aakashData._id);
                } else {
                    allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id, sport, '');
                }
                if(allTeams && allTeams.length == 100) {
                    await redis.setRedisLeaderboard(leaderboardKey, allTeams);
                }
                // contestDetail && reviewMatch.time >= Date.now() && contestDetail.contest_size <= 50
                //if (contestDetail && reviewMatch.time >= Date.now() && contestDetail.contest_size <= 50) {
                    // allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id, sport);
                //}
                mergedTeam = allTeams;
            }
            let teamCount = 0;
            let teamData = [];

            for (const userTeam of mergedTeam) {
                let player_ids = [];

                let playerTeam = '';
                if (!userTeam.player_team) {
                    playerTeam = await PlayerTeam.findById(userTeam.player_team_id, { team_count: 1 });
                } else {
                    playerTeam = userTeam.player_team;
                }

                if (playerTeam) {

                    if (!userTeam.user) {
                        userTeam.user = await User.findOne({ _id: userTeam.user_id }, { "team_name": 1, "image": 1 });
                    }
                   // let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                    let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                    if (userTeam.user) {

                        let teamUserDetail = userTeam.user;
                        teamData[teamCount] = {};
                        teamData[teamCount]['user_id'] = userTeam.user_id;
                        teamData[teamCount]['team_name'] = teamUserDetail.team_name;
                        teamData[teamCount]['user_image'] = '';
                        teamData[teamCount]['team_no'] = (playerTeam) ? playerTeam.team_count : 0;
                        teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                        teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                        teamData[teamCount]['point'] = userTeam.points || 0;
                        teamData[teamCount]['winning_amount'] = winAmount;
                        teamData[teamCount]['is_aakash_team'] = false;
                    }
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
            }

            return res.send(ApiUtility.success(contestData));
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    contestDetail: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
            }
            sport   =   parseInt(sport) || 1;
            let reviewMatch = await SeriesSquad.findOne({ 'match_id': match_id, "sport": sport });
            let joinedTeams = await PlayerTeamContest.find({ 'match_id': match_id, 'contest_id': contest_id }).countDocuments();
            let reviewStatus = '';
            if (reviewMatch) {
                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                    reviewStatus = 'Under Review';
                } else if (reviewMatch.match_status == 'Delayed') {
                    reviewStatus = 'Delayed';
                }
            }
            let contestDataAPIKey = RedisKeys.getContestDetailAPIKey(match_id, contest_id);
            let contestData;
            if (reviewMatch == "In Progress") {
                contestData = await redis.getRedis(contestDataAPIKey);
            }
            if (!contestData) {
                let contestDetail = await Contest.findOne({ _id: contest_id });
                contestDetail = JSON.parse(JSON.stringify(contestDetail));
                // console.log(contestDetail.contest_size);return false
                let prizeMoney = 0;
                let totalTeams = 0;
                let teamsJoined = [];
                let toalWinner = 0;
                let entryfee = 0;
                let inviteCode = '';
                let teamData = [];
                let myTeamIds = [];
                let customPrice = [];
                matchInviteCode = await MatchContest.getInviteCode(parseInt(match_id), contest_id, sport);
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
                let redisTeams = await getRedisLeaderboard(match_id, contest_id);
                
                let myTeams = [];
                let aakashTeams = [];
                if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    aakashTeams = await PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, aakashData._id, sport);
                }
                // console.log(aakashTeams);
                if (!_.isEmpty(redisTeams)) {
                    MyUserData = await User.findOne({ _id: user_id }, { "team_name": 1, "image": 1 });

                    myTeams = await PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, user_id, sport);
                    let allTeams = [];
                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                        allTeams = await getAllTeamsByMatchIdRedis(match_id, contest_id, user_id, aakashData._id);
                    } else {
                        allTeams = await getAllTeamsByMatchIdRedis(match_id, contest_id, user_id, '');
                    }
                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                        mergedTeam = [...myTeams, ...aakashTeams, ...allTeams];
                    } else {
                        mergedTeam = [...myTeams, ...allTeams];
                    }
                }
                
                if (mergedTeam && mergedTeam.length == 0) {
                    myTeams = await PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, user_id,sport);
                    
                    let allTeams = [];
                    if ((reviewMatch.time >= Date.now() && contestDetail.contest_size <= 50) || reviewMatch.match_status == "Finished" || reviewMatch.match_status == "In Progress" || reviewMatch.time <= Date.now()) {
                        allTeams = await getRedisLeaderboard(match_id, contest_id);
                        
                        if (_.isEmpty(allTeams)) {
                            let leaderboardKey = 'leaderboard-' + match_id + '-' + contest_id;
                            if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                                allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id,sport, aakashData._id);
                            } else {
                                allTeams = await PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id,sport, '');
                            }
                            if((reviewMatch.time >= Date.now() && (allTeams.length == 100 || contestDetail.contest_size == allTeams.length)) || reviewMatch.match_status == "In Progress" || reviewMatch.match_status == "Finished") {
                                await redis.setRedisLeaderboard(leaderboardKey, allTeams);
                            }
                            //await redis.setRedisLeaderboard(leaderboardKey, allTeams);
                        }
                    }
                    if(contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                        mergedTeam = [...myTeams, ...aakashTeams, ...allTeams];
                    } else {
                        mergedTeam = [...myTeams, ...allTeams];
                    }
                    // mergedTeam = [...myTeams, ...allTeams];
                }
                let teamCount = 0;
                let player_team_id_filter = []
                for (const userTeam of mergedTeam) {
                    
                    if (_.find(player_team_id_filter, userTeam.player_team_id)){
                        continue
                    } else{
                        let player_ids = [];
                        // let playerTeam = await PlayerTeam.findById(userTeam.player_team_id);
                        let playerTeam = '';
                        if (!userTeam.player_team) {
                            playerTeam = await PlayerTeam.findById(userTeam.player_team_id, { team_count: 1 });
                        } else {
                            playerTeam = userTeam.player_team;
                        }
                        player_team_id_filter.push(userTeam.player_team_id);

                        if (playerTeam) {
                            if (!userTeam.user) {
                                if (MyUserData && user_id == userTeam.user_id) {
                                    userTeam.user = MyUserData;
                                } else {
                                    userTeam.user = await User.findOne({ _id: userTeam.user_id }, { "team_name": 1, "image": 1 });
                                }
                            }
                        // let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                        let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                            if (userTeam.user) {
                                let teamUserDetail = userTeam.user;
                                teamData[teamCount] = {};
                                teamData[teamCount]['user_id'] = userTeam.user_id;
                                teamData[teamCount]['team_name'] = teamUserDetail.team_name;
                                teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                                teamData[teamCount]['team_no'] = (playerTeam) ? playerTeam.team_count : 0;
                                teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                                teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                                teamData[teamCount]['point'] = userTeam.points || 0;
                                teamData[teamCount]['winning_amount'] = winAmount;
                                teamData[teamCount]['is_aakash_team'] = _.isEqual(ObjectId(teamUserDetail._id), ObjectId(aakashData._id)) ? true : false;
                            }
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
                }
                if (reviewMatch == "In Progress") {
                    redis.setRedis(contestDataAPIKey, contestData)
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
}
