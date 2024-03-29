const config = require('../../../config');
const User = require('../../../models/user');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const ApiUtility = require('../../api.utility');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const redisEnt = require('../../../../lib/redisEnterprise');

module.exports = {
    contestDetailRedisEnt: async (req, res) => {
        try {
            let { match_id, contest_id, sport } = req.params;
            const user_id = req.userId;
            let decoded = { match_id: parseInt(match_id), contest_id: contest_id, user_id: user_id, sport: parseInt(sport) || 1, };
            sport = parseInt(sport) || 1;
            let reviewStatus = '';
            let contestDataAPIKey = RedisKeys.getContestDetailAPIKey(match_id, contest_id);
            let contestData;
            let reviewMatch = {};
            if (reviewMatch == "In Progress") {
                contestData = await redis.getRedis(contestDataAPIKey);
            }
            let matchKey = 'match-list-' + sport;
            let macthList = await getMatchList(matchKey, "{}");
            let seriesSqadData = {};
            if (macthList && !_.isEmpty(macthList)) {
                let matchListData = JSON.parse(macthList);
                if (matchListData && matchListData.data && matchListData.data.upcoming_match) {
                    const lst = JSON.parse(JSON.stringify(matchListData.data.upcoming_match));
                    let cdataRsp = _.find(lst, { 'match_id': parseInt(match_id) });
                    if (cdataRsp && cdataRsp.match_id)
                        seriesSqadData = cdataRsp;
                    else
                        seriesSqadData = await SeriesSquad.findOne({ match_id: parseInt(match_id), sport: sport }, { match_id: 1, inning_number: 1, is_parent: 1 });
                } else {
                    seriesSqadData = await SeriesSquad.findOne({ match_id: parseInt(match_id), sport: sport }, { match_id: 1, inning_number: 1, is_parent: 1 });
                }
            } else {
                seriesSqadData = await SeriesSquad.findOne({ match_id: parseInt(match_id), sport: sport }, { match_id: 1, inning_number: 1, is_parent: 1 });
            }
            let ptcJoinedRecords = [];
            let teamData = [];
            let joinedTeams = 0;
            if (!contestData) {
                // let contestDetail = await Contest.findOne({ _id: contest_id });
                let matchContestDetail = await MatchContest.findOne({ contest_id: contest_id, match_id: parseInt(match_id), sport: sport });
                matchContestDetail = JSON.parse(JSON.stringify(matchContestDetail));
                let contestDetail = matchContestDetail && matchContestDetail.contest ? matchContestDetail.contest : {};
                let totalChildContestJoined = 0;
                if ((matchContestDetail && matchContestDetail.is_auto_create) || (matchContestDetail && matchContestDetail.contest && matchContestDetail.contest.is_auto_create)) {

                    let mParentId = matchContestDetail && matchContestDetail.parent_contest_id ? matchContestDetail.parent_contest_id : matchContestDetail.contest_id;
                    ptcJoinedRecords = await PlayerTeamContest.find({ 'parent_contest_id': mParentId, 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'sport': sport }, { contest_id: 1 });
                    totalChildContestJoined = ptcJoinedRecords && ptcJoinedRecords.length > 0 ? ptcJoinedRecords.length : 0;
                }
                // This is used to show h2h/LMS team of user when comes on parent contest of H2H/LMS for circket and footbal
                if (matchContestDetail && matchContestDetail.category_slug && (_.isEqual(matchContestDetail.category_slug, 'head-to-head') || _.isEqual(matchContestDetail.category_slug, 'last-man-standing')) && (sport == 1 || sport == 2 || sport == 4)) {
                    if (matchContestDetail.parent_contest_id) {
                        // This is child contest so show only join team of child contest.
                        joinedTeams = await PlayerTeamContest.find({ 'match_id': match_id, 'contest_id': contest_id, sport: sport }).countDocuments();
                    } else {
                        // parent contest access of H2H case of circket
                        let userJoinedContest = _.map(ptcJoinedRecords, 'contest_id');
                        let queryMatchContest = { 'parent_contest_id': matchContestDetail.contest_id, match_id: decoded['match_id'], sport: sport, joined_users: 1 };
                        if(_.isEqual(matchContestDetail.category_slug, 'last-man-standing')){
                            let maxTeam = matchContestDetail.contest && matchContestDetail.contest.contest_size ? matchContestDetail.contest.contest_size:4;
                            queryMatchContest = { 'parent_contest_id': matchContestDetail.contest_id, match_id: decoded['match_id'], sport: sport, joined_users: {$nin:[0,maxTeam]} };
                         }

                        if (userJoinedContest && userJoinedContest.length > 0) {
                          //  queryMatchContest['contest_id'] = { $nin: userJoinedContest };
                        }
                        var matchContestData = await MatchContest.findOne(queryMatchContest).sort({ _id: 1 });
                        if (matchContestData && matchContestData._id && matchContestData.contest_id) {
                            if(_.isEqual(matchContestDetail.category_slug, 'last-man-standing')){
                                let userTeamArray = await PlayerTeamContest.find({ 'contest_id': matchContestData.contest_id, 'match_id': decoded['match_id'], 'sport': sport });
                                if (userTeamArray && userTeamArray.length>0) {
                                    let indx =0;
                                    joinedTeams = userTeamArray.length;
                                    for (const userTeam of userTeamArray) {
                                        teamData[indx] = {};
                                        teamData[indx]['user_id'] = userTeam.user_id;
                                        teamData[indx]['team_name'] = userTeam.team_name;
                                        teamData[indx]['avatar'] = userTeam && userTeam.avatar ? userTeam.avatar : '';
                                        teamData[indx]['team_no'] = userTeam.team_count || 0;
                                        teamData[indx]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                                        teamData[indx]['previous_rank'] = userTeam.previous_rank || 0;
                                        teamData[indx]['winning_amount'] = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;;
                                        teamData[indx]['is_aakash_team'] = false;
                                        teamData[indx]['champ_type'] = 0;
                                        teamData[indx]['player_team_id'] = userTeam.player_team_id;
                                        indx++;
                                    }
                                    teamData.forEach(function(item,i){
                                        if(item && item.user_id && item.user_id.equals(ObjectId(user_id))){
                                            teamData.splice(i, 1);
                                            teamData.unshift(item);
                                        }
                                      });
                                }
                            }else{
                                let userTeam = await PlayerTeamContest.findOne({ 'contest_id': matchContestData.contest_id, 'match_id': decoded['match_id'], 'sport': sport });
                                if (userTeam && userTeam._id) {
                                    joinedTeams = 1;
                                    teamData[0] = {};
                                    teamData[0]['user_id'] = userTeam.user_id;
                                    teamData[0]['team_name'] = userTeam.team_name;
                                    teamData[0]['avatar'] = userTeam && userTeam.avatar ? userTeam.avatar : '';
                                    teamData[0]['team_no'] = userTeam.team_count || 0;
                                    teamData[0]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                                    teamData[0]['previous_rank'] = userTeam.previous_rank || 0;
                                    teamData[0]['winning_amount'] = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;;
                                    teamData[0]['is_aakash_team'] = false;
                                    teamData[0]['champ_type'] = 0;
                                    teamData[0]['player_team_id'] = userTeam.player_team_id;
                                }
                            }
                            
                            if (matchContestDetail && _.has(matchContestDetail, "attendee") && matchContestDetail.attendee == 0 && _.isEqual(matchContestDetail.category_slug, 'head-to-head')) {
                                await MatchContest.findOneAndUpdate({ contest_id: matchContestDetail.contest_id, 'match_id': decoded['match_id'], 'sport': sport }, { $set: { attendee: 1 } });
                            }

                        } else {
                            if (totalChildContestJoined > 0 && userJoinedContest && userJoinedContest.length > 0) {
                                let loginuserMatchContest = { 'parent_contest_id': matchContestDetail.contest_id, match_id: decoded['match_id'], sport: sport, joined_users: 1 };
                                if(_.isEqual(matchContestDetail.category_slug, 'last-man-standing')){
                                    loginuserMatchContest = { 'parent_contest_id': matchContestDetail.contest_id, match_id: decoded['match_id'], sport: sport, joined_users: { $ne: 0 },is_full:0 };
                                }
                                loginuserMatchContest['contest_id'] = { $in: userJoinedContest };

                                var userJoinMatchContest = await MatchContest.findOne(loginuserMatchContest).sort({ _id: 1 });
                                if (userJoinMatchContest && userJoinMatchContest.contest_id) {
                                    if(_.isEqual(matchContestDetail.category_slug, 'last-man-standing')){
                                        let userTeamArray = await PlayerTeamContest.find({ 'contest_id': userJoinMatchContest.contest_id, 'match_id': decoded['match_id'], 'sport': sport });
                                        if (userTeamArray && userTeamArray.length>0) {
                                            let indx =0;
                                            joinedTeams = userTeamArray.length;
                                           // console.log('heloo in ************detal',joinedTeams);
                                            for (const userTeam of userTeamArray) {
                                                teamData[indx] = {};
                                                teamData[indx]['user_id'] = userTeam.user_id;
                                                teamData[indx]['team_name'] = userTeam.team_name;
                                                teamData[indx]['avatar'] = userTeam && userTeam.avatar ? userTeam.avatar : '';
                                                teamData[indx]['team_no'] = userTeam.team_count || 0;
                                                teamData[indx]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                                                teamData[indx]['previous_rank'] = userTeam.previous_rank || 0;
                                                teamData[indx]['winning_amount'] = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;;
                                                teamData[indx]['is_aakash_team'] = false;
                                                teamData[indx]['champ_type'] = 0;
                                                teamData[indx]['player_team_id'] = userTeam.player_team_id;
                                                indx++;
                                            }
                                            teamData.forEach(function(item,i){
                                                if(item && item.user_id && item.user_id.equals(ObjectId(user_id))){
                                                    teamData.splice(i, 1);
                                                    teamData.unshift(item);
                                                }
                                              });
                                            
                                        }
                                    }else{
                                        let userTeam = await PlayerTeamContest.findOne({ 'contest_id': userJoinMatchContest.contest_id, 'match_id': decoded['match_id'], 'sport': sport });
                                        if (userTeam && userTeam._id) {
                                            joinedTeams = 1;
                                            teamData[0] = {};
                                            teamData[0]['user_id'] = userTeam.user_id;
                                            teamData[0]['team_name'] = userTeam.team_name;
                                            teamData[0]['avatar'] = userTeam && userTeam.avatar ? userTeam.avatar : '';
                                            teamData[0]['team_no'] = userTeam.team_count || 0;
                                            teamData[0]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                                            teamData[0]['previous_rank'] = userTeam.previous_rank || 0;
                                            teamData[0]['winning_amount'] = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;;
                                            teamData[0]['is_aakash_team'] = false;
                                            teamData[0]['champ_type'] = 0;
                                            teamData[0]['player_team_id'] = userTeam.player_team_id;
                                        }
                                    }
                                    
                                    if (matchContestDetail && _.has(matchContestDetail, "attendee") && matchContestDetail.attendee == 0 && _.isEqual(matchContestDetail.category_slug, 'head-to-head')) {
                                        await MatchContest.findOneAndUpdate({ contest_id: matchContestDetail.contest_id, 'match_id': decoded['match_id'], 'sport': sport }, { $set: { attendee: 1 } });
                                    }
                                } else {
                                    if (matchContestDetail && _.has(matchContestDetail, "attendee") && matchContestDetail.attendee == 1 && (_.isEqual(matchContestDetail.category_slug, 'head-to-head'))) {
                                        await MatchContest.findOneAndUpdate({ contest_id: contest_id, 'match_id': decoded['match_id'], 'sport': sport }, { $set: { attendee: 0 } });
                                    }
                                }

                            } else {
                                joinedTeams = 0;
                                if (matchContestDetail && _.has(matchContestDetail, "attendee") && matchContestDetail.attendee == 1 && (_.isEqual(matchContestDetail.category_slug, 'head-to-head'))) {
                                    await MatchContest.findOneAndUpdate({ contest_id: contest_id, 'match_id': decoded['match_id'], 'sport': sport }, { $set: { attendee: 0 } });
                                }
                            }


                        }
                    }

                } else {
                    // Case of other contest to show total team joined counts 
                    joinedTeams = await PlayerTeamContest.find({ 'match_id': match_id, 'contest_id': contest_id, sport: sport }).countDocuments();
                }
                /*let CategoryData = await getCategoryRedis(contestDetail.category_id);
                if(_.isEmpty()) {
                    CategoryData   =   await Category.findOne({ _id: contestDetail.category_id })
                    let categoryRedis = 'category-data-' + contestDetail.category_id;
                    setRedis(categoryRedis, CategoryData);
                }*/
                // contestDetail = JSON.parse(JSON.stringify(contestDetail));
                let prizeMoney = 0;
                let totalTeams = 0;
                let entryfee = 0;
                let inviteCode = '';

                let myTeamIds = [];
                let customPrice = [];
                // matchInviteCode = await MatchContest.getInviteCode(parseInt(match_id), contest_id, sport);
                matchInviteCode = matchContestDetail;
                if (matchInviteCode && matchInviteCode.invite_code) {
                    inviteCode = matchInviteCode.invite_code;
                }
                let finiteBreakupDetail = {};
                if (contestDetail.infinite_contest_size == 1) {
                    finiteBreakupDetail.winner_percent = contestDetail.winner_percent;
                    finiteBreakupDetail.winner_amount = contestDetail.winning_amount_times;
                }
                let aakashData = {};
                if (contestDetail.amount_gadget == 'aakash') {
                    aakashData = await User.findOne({ "user_type": 101 }, { "team_name": 1, "avatar": 1, "image": 1, "_id": 1 });
                }
                let aakashTeams = [];
                if (contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData)) {
                    aakashTeams = await PlayerTeamContest.find({
                        match_id: parseInt(match_id),
                        sport: parseInt(sport),
                        contest_id: ObjectId(contest_id),
                        user_id: ObjectId(aakashData._id)
                    });
                }
                let myTeams = await PlayerTeamContest.find({
                    match_id: parseInt(match_id),
                    sport: parseInt(sport),
                    contest_id: ObjectId(contest_id),
                    user_id: ObjectId(user_id)
                });
                if (contestDetail.amount_gadget == 'aakash' && !_.isEmpty(aakashData) && !_.isEmpty(aakashTeams)) {
                    mergedTeam = [...myTeams, ...aakashTeams];
                } else {
                    mergedTeam = myTeams;
                }
                let teamCount = 0;

                let player_team_id_filter = []
                for (const userTeam of mergedTeam) {
                    let player_ids = [];
                    let winAmount = (userTeam && userTeam.price_win) ? userTeam.price_win : 0;
                    if (userTeam) {
                        teamData[teamCount] = {};
                        teamData[teamCount]['user_id'] = userTeam.user_id;
                        teamData[teamCount]['team_name'] = userTeam.team_name;
                        teamData[teamCount]['avatar'] = userTeam && userTeam.avatar ? userTeam.avatar : '';
                        teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                        teamData[teamCount]['team_no'] = userTeam.team_count || 0;
                        teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                        teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                        // teamData[teamCount]['point'] = playerTeam.points || 0;
                        teamData[teamCount]['winning_amount'] = winAmount;
                        teamData[teamCount]['is_aakash_team'] = _.isEqual(ObjectId(userTeam.user_id), ObjectId(aakashData._id)) ? true : false;
                        teamData[teamCount]['champ_type'] = contestDetail && contestDetail.champ_type ? contestDetail.champ_type : 0;
                        teamData[teamCount]['player_team_id'] = userTeam.player_team_id;
                    }
                    teamCount++;
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
                if(_.isEqual(matchContestDetail.category_slug, 'last-man-standing')){
                    let maxTeam = matchContestDetail.contest && matchContestDetail.contest.contest_size ? matchContestDetail.contest.contest_size:0;
                    if (matchContestDetail.parent_contest_id) {
                        if(teamRankData && teamRankData.length>maxTeam ){
                            //teamRankData = [];
                        }
                    }else{
                        //teamRankData = [];
                    }
                }
                if (!contestDetail.confirmed_winning || contestDetail.confirmed_winning == '' || contestDetail.confirmed_winning == '0' || contestDetail.confirmed_winning == 'no') {
                    winComfimed = 'no';
                } else {
                    winComfimed = 'yes';
                }
                if (decoded['user_id'] && myTeams) {
                    if (myTeams) {
                        for (const joined of myTeams) {
                            if (joined.player_team_id) {
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
                multiplierLeague = (contestDetail.amount_gadget && contestDetail.amount_gadget == 'multiplier') ? true : false;

                let is_joined = (myTeamIds.length > 0) ? true : false;

                let bonusAmount = 0;
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
                                // customPrice[key]['rank'] = customBreakup.startRank.toString();
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                                // customPrice[key]['rank'] = customBreakup.name.replace("Rank ","");
                            }

                            customPrice[key]['gadget_name'] = customBreakup.gadget_name ? (customBreakup.gadget_name) : "";
                            customPrice[key]['image'] = customBreakup.image ? config.imageBaseUrl + '/' + customBreakup.image : "";
                            key++;
                        }
                    } else if (contestDetail.amount_gadget == 'x_win_breakup') {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }
                            customPrice[key]['start_point'] = customBreakup.start_point ? (customBreakup.start_point) : 0;
                            customPrice[key]['end_point'] = customBreakup.end_point ? (customBreakup.end_point) : 0;
                            customPrice[key]['x_factor_price'] = customBreakup.x_factor_price ? (customBreakup.x_factor_price) : 0;
                            key++;
                        }
                    } else {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }

                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                                // customPrice[key]['rank'] = customBreakup.startRank.toString();
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                                // customPrice[key]['rank'] = customBreakup.name.replace("Rank ","");
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
                
                let myTeamsCount = 0;
                let myTeamCountKey = `${RedisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`;
                let myTeamCountRedis = await redisEnt.getHashCount(myTeamCountKey);
                if(myTeamCountRedis) {
                    myTeamsCount = myTeamCountRedis;
                } else {
                    myTeamsCount = await PlayerTeam.find({ user_id: user_id, match_id: parseInt(match_id), sport: sport }).countDocuments();
                }


                let contestData = {
                    match_status: (reviewMatch) ? reviewMatch.status : '',
                    prize_money: prizeMoney,
                    usable_bonus_time: matchInviteCode && matchInviteCode.usable_bonus_time ? matchInviteCode.usable_bonus_time : null,
                    before_time_bonus: matchInviteCode && matchInviteCode.before_time_bonus ? matchInviteCode.before_time_bonus : 0,
                    after_time_bonus: matchInviteCode && matchInviteCode.after_time_bonus ? matchInviteCode.after_time_bonus : 0,
                    confirm_winning: winComfimed.toString(),
                    total_teams: totalTeams,
                    entry_fee: entryfee,
                    expect_entry_fee: matchContestDetail && matchContestDetail.expect_entry_fee ? matchContestDetail.expect_entry_fee : 0,
                    invite_code: inviteCode,
                    join_multiple_teams: multipleTeam,
                    multiple_team: multipleTeam,
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
                    is_multiplier: multiplierLeague,
                    maximum_team_size: multipleTeam && contestDetail.maximum_team_size ? contestDetail.maximum_team_size : 1,
                    contest_shareable: contestDetail && contestDetail.contest_shareable ? contestDetail.contest_shareable : 0,
                    category_id: contestDetail && contestDetail.category_id ? contestDetail.category_id : '',
                    user_contest: contestDetail && contestDetail.user_contest ? contestDetail.user_contest : {},
                    category_name: matchContestDetail && matchContestDetail.category_name ? matchContestDetail.category_name : '',
                    my_teams: myTeamsCount || 0,
                    is_offerable: matchContestDetail && matchContestDetail.is_offerable && matchContestDetail.is_offerable == 1 ? true : false,
                    offer_after_join: matchContestDetail && matchContestDetail.is_offerable && matchContestDetail.offer_after_join ? matchContestDetail.offer_after_join : 0,
                    offerable_amount: matchContestDetail && matchContestDetail.is_offerable && matchContestDetail.offerable_amount ? matchContestDetail.offerable_amount : 0,
                    contest_comment: matchContestDetail && matchContestDetail.contest_comment ? matchContestDetail.contest_comment : "",
                    champ_type: contestDetail && contestDetail.champ_type ? contestDetail.champ_type : 0,
                    amount_gadget: contestDetail && contestDetail.amount_gadget ? contestDetail.amount_gadget : "",
                    category_slug: matchContestDetail && matchContestDetail.category_slug ? matchContestDetail.category_slug : '',
                    is_offerable_multiple: matchContestDetail && matchContestDetail.is_offerable_multiple && matchContestDetail.is_offerable_multiple == 1 ? true : false,
                    offer_join_team: matchContestDetail && matchContestDetail.offer_join_team  ? matchContestDetail.offer_join_team : [],
                    contest_id: contest_id
                }
                if (totalChildContestJoined > 0) {
                    contestData['total_child_joined'] = totalChildContestJoined;
                }
                if (reviewMatch == "In Progress") {
                    redis.setRedis(contestDataAPIKey, contestData)
                }
                if (seriesSqadData && seriesSqadData.is_parent) {
                    contestData['match_inning_number'] = seriesSqadData.inning_number && seriesSqadData.inning_number == 2 ? 2 : 1;
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            console.log('error***', error);
            return res.send(ApiUtility.failed(error.message));
        }
    }
}

async function getMatchList(key, defaultValue) {
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue;
            }
            resolve(data)
        })
    })
}

