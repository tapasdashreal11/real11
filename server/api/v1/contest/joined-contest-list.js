const config = require('../../../config');
const User = require('../../../models/user');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const ApiUtility = require('../../api.utility');
const moment = require('moment');
const { MatchStatus } = require('../../../constants/app');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const { ObjectId } = require('mongodb');

module.exports = {
    joinedContestListOld: async (req, res) => {
        try {
           // let sport = 1;
            const user_id = req.userId;
            const { match_id, series_id,sport } = req.params;
            let decoded = {
                sport: parseInt(sport || 1),
                match_id: parseInt(match_id),
                series_id: parseInt(series_id),
                user_id: user_id
            }

            if (match_id && series_id && user_id) {
                let data1 = {};
                let authUser = await User.findById(user_id);
                if (authUser) {
                    let joinedTeams = await PlayerTeamContest.aggregate([{
                        $match: { 'user_id': decoded['user_id'], 'match_id': decoded['match_id'],'sport':decoded['sport'], 'series_id': decoded['series_id'] }
                    },
                    {
                        $lookup: {
                            from: 'player_team',
                            localField: 'player_team_id',
                            foreignField: '_id',
                            as: 'player_team'
                        }
                    },
                    {
                        $unwind: "$player_team"
                    },
                    {
                        $lookup: {
                            from: 'contest',
                            localField: 'contest_id',
                            foreignField: '_id',
                            as: 'contest'
                        }
                    },
                    {
                        $unwind: "$contest"
                    },
                    {
                        $group: {
                            _id: "$contest_id",
                            "doc": { "$first": "$$ROOT" },
                            "player_team": { "$first": "$player_team" },
                            "contest": { "$first": "$contest" }
                        }
                    }
                    ])
                    // consolelog(JSON.stringify(joinedTeams))
                    let pointsData = {};
                    if (joinedTeams) {
                        for (const teams of joinedTeams) {
                            if (!pointsData[teams.doc.contest_id]) {
                                pointsData[teams.doc.contest_id] = [];
                            }
                            if (teams.player_team && teams.player_team.points) {
                                pointsData[teams.doc.contest_id].push(teams.player_team.points);
                            } else {
                                pointsData[teams.doc.contest_id].push(0);
                            }
                        }
                    }

                    if (joinedTeams) {
                        let key = 0;
                        // for(const teams of joinedTeams) {
                        //     if(teams.player_team.points !== pointsData[teams.doc.contest_id][0]) {
                        //         delete joinedTeams[key];
                        //     }
                        //     key++;
                        // }
                    }

                    let contest = [];
                    let upComingData = [];
                    let myTeamRank = [];
                    if (joinedTeams) {
                        let contestKey = 0;
                        for (const contestValue of joinedTeams) {
                            // consolelog('enter',contestValue.doc.contest)
                            if (!contestValue || !contestValue.doc.contest) {
                                continue;
                            }
                            let inviteCode = await MatchContest.getInviteCode(decoded['match_id'], contestValue.doc.contest_id);
                            myTeamRank.push((contestValue.doc.rank) ? contestValue.doc.rank : 0);

                            let customBreakup;
                            if (contestValue.contest && contestValue.contest.breakup) {
                                customBreakup = contestValue.contest.breakup[contestValue.contest.breakup.length - 1];
                            }

                            if (customBreakup && customBreakup.endRank) {
                                toalWinner = customBreakup.endRank;
                            } else {
                                toalWinner = (customBreakup) ? customBreakup.startRank : 0;
                            }

                            let playerContestFilter = {
                                'match_id': decoded['match_id'],
                                'contest_id': contestValue.doc.contest._id,
                                'user_id': decoded['user_id'],
                                'sport':decoded['sport']
                            };
                            let joinedTeamCount = await PlayerTeamContest.find({ 'match_id': decoded['match_id'],'sport':decoded['sport'], 'contest_id': contestValue.doc.contest._id }).countDocuments();

                            let myTeamIds = [];
                            let myTeamNo = [];
                            let winningAmt = [];

                            let teamsJoined = await PlayerTeamContest.find(playerContestFilter);

                            if (teamsJoined) {
                                for (const joined of teamsJoined) {
                                    myTeamIds.push({ "player_team_id": joined.player_team_id });
                                    myTeamNo.push((joined.player_team) ? joined.player_team.team_count : 0);
                                   // winningAmt.push((joined.winning_amount) ? joined.winning_amount : 0);
                                  winningAmt.push((joined && joined.price_win) ? parseFloat(joined.price_win) : 0);
                                }
                            }

                            let customPrice = [];
                            let isWinner = false;
                            let isGadget = false;
                            let aakashLeague  = (contestValue.doc.contest.amount_gadget == 'aakash') ? true : false;
                            if (contestValue.doc.contest.breakup) {
                                let key = 0;
                                if (contestValue.doc.contest.amount_gadget == 'gadget') {
                                    for (const customBreakup of contestValue.doc.contest.breakup) {
                                        if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                            isWinner = true;
                                        }

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
                                    isGadget = true;
                                } else {
                                    for (const customBreakup of contestValue.contest.breakup) {
                                        if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                            isWinner = true;
                                        }

                                        if (!customPrice[key]) {
                                            customPrice[key] = {};
                                        }
                                        if (customBreakup.startRank == customBreakup.endRank) {
                                            customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                                        } else {
                                            customPrice[key]['rank'] = customBreakup.name;
                                        }

                                        if (!customBreakup.price) {
                                            customPrice[key]['price'] = 0;
                                        } else {
                                            customPrice[key]['price'] = customBreakup.price_each ? customBreakup.price_each.toFixed(2) : customBreakup.price.toFixed(2);
                                        }

                                        customPrice[key]['image'] = (customBreakup.image) ? config.imageBaseUrl + 'contest_image/'.customBreakup.image : '';
                                        key++;
                                    }
                                }
                            } else if (contestValue.doc.contest.contest_type.indexOf('free') > -1 && contestValue.doc.rank == 1) {
                                isWinner = true;
                            }

                            let finiteBreakupDetail = {};

                            if (contestValue.doc.contest.infinite_contest_size == 1) {
                                finiteBreakupDetail.winner_percent = contestValue.doc.contest.winner_percent;
                                finiteBreakupDetail.winner_amount = contestValue.doc.contest.winning_amount_times;
                            }

                            let winComfimed;
                            if (contestValue.doc.contest.confirmed_winning == '' || contestValue.doc.contest.confirmed_winning == '0') {
                                winComfimed = 'no';
                            } else {
                                winComfimed = contestValue.doc.contest.confirmed_winning;
                            }

                            // let usablebonus = config.admin_percentage;
                            let useBonus = 0;

                            if (inviteCode && inviteCode.usable_bonus_time) {
                                // console.log("matchInviteCode", inviteCode, moment().isBefore(inviteCode.usable_bonus_time))
                                if (moment().isBefore(inviteCode.usable_bonus_time)) {
                                    useBonus = inviteCode.before_time_bonus;
                                } else {
                                    useBonus = inviteCode.after_time_bonus;
                                }
                            } else {
                                if (contestValue.doc.contest.used_bonus != '') {
                                    useBonus = contestValue.doc.contest.used_bonus;
                                }
                            }
                            // if (contestValue.doc.contest.used_bonus != '') {
                            //     useBonus = contestValue.doc.contest.used_bonus;
                            // }
                            let totalWinningAmount = winningAmt.reduce(function (a, b) {
                                return a + b;
                            }, 0);

                            contest[contestKey] = {};
                            contest[contestKey]['confirm_winning'] = winComfimed.toString();
                            contest[contestKey]['is_gadget'] = isGadget;
                            contest[contestKey]['entry_fee'] = contestValue.doc.contest.entry_fee;
                            contest[contestKey]['prize_money'] = contestValue.doc.contest.winning_amount;
                            contest[contestKey]['total_teams'] = contestValue.doc.contest.contest_size;
                            contest[contestKey]['category_id'] = contestValue.doc.contest.category_id;
                            contest[contestKey]['contest_id'] = contestValue.doc.contest_id;
                            contest[contestKey]['total_winners'] = customBreakup, //(customBreakup && customBreakup.length) ? customBreakup.pop : {},//toalWinner;
                                contest[contestKey]['teams_joined'] = joinedTeamCount;
                            contest[contestKey]['is_joined'] = (teamsJoined) ? true : false;
                            contest[contestKey]['multiple_team'] = (contestValue.doc.contest.multiple_team && contestValue.doc.contest.multiple_team == 'yes') ? true : false;
                            contest[contestKey]['invite_code'] = (inviteCode) ? inviteCode.invite_code : '';
                            contest[contestKey]['breakup_detail'] = customPrice;
                            contest[contestKey]['my_team_ids'] = myTeamIds;
                            contest[contestKey]['team_number'] = myTeamNo;
                            contest[contestKey]['points_earned'] = (contestValue.doc.player_team && contestValue.doc.player_team.points) ? contestValue.player_team.points : 0;
                            contest[contestKey]['my_rank'] = contestValue.doc.rank;
                            contest[contestKey]['is_winner'] = isWinner;
                            contest[contestKey]['winning_amount'] = totalWinningAmount;
                            contest[contestKey]['use_bonus'] = useBonus;
                            contest[contestKey]['is_infinite'] = (contestValue.doc.contest.infinite_contest_size == 1) ? true : false;
                            contest[contestKey]['infinite_breakup'] = finiteBreakupDetail;
                            contest[contestKey]['is_aakash_team'] = aakashLeague;
                            contest[contestKey]['maximum_team_size'] = (contestValue.doc.contest.multiple_team && contestValue.doc.contest.multiple_team == 'yes') ? (contestValue.doc.contest.maximum_team_size) : 1;
                            contestKey++;
                        }
                    }

                    let reviewMatch = await SeriesSquad.findOne({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], sport: decoded['sport'] });
                    reviewStatus = '';
                    if (reviewMatch) {
                        if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                            reviewStatus = MatchStatus.IN_REVIEW;
                        }

                        if (reviewMatch.match_status == MatchStatus.MATCH_DELAYED) {
                            reviewStatus = MatchStatus.MATCH_DELAYED;
                        }
                    }

                    let myTeams = await PlayerTeam.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'] ,'sport': decoded['sport']}).countDocuments();

                    let myContest = await PlayerTeamContest.aggregate([{
                        $match: { 'user_id': decoded['user_id'], 'match_id': decoded['match_id'],'sport': decoded['sport'] }
                    },
                    {
                        $group: { _id: "$contest_id", count: { $sum: 1 } }
                    }
                    ]);

                    data1.joined_contest = contest;
                    data1.upcoming_match = upComingData;
                    data1.my_team_count = myTeams;
                    data1.my_teams = myTeams;
                    data1.my_contests = myContest.length;
                    data1.my_team_rank = myTeamRank;
                    data1.match_status = reviewStatus;
                } else {
                    return res.send(ApiUtility.failed('User not found.'));
                }
                return res.send(ApiUtility.success(data1));
            } else {
                return res.send(ApiUtility.failed('Missing Required Fields'));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    joinedContestListUpcoming: async (req, res) => {
        try {
            const user_id = req.userId;
            const { match_id, series_id, sport } = req.params;
            let decoded = {
                sport: parseInt(sport || 1),
                match_id: parseInt(match_id),
                series_id: parseInt(series_id),
                user_id: user_id
            }
            if (match_id && series_id && user_id) {
                let myJoinedContestListKey = "joined-contest-list-" + match_id + "-" + series_id + "-" + user_id;
                let joindedContestlistdata = await getPromiseUserJoinedContestList(myJoinedContestListKey);
                if (joindedContestlistdata && joindedContestlistdata.joined_contest) {
                    let joindContesList = joindedContestlistdata.joined_contest;
                    let cIds = _.map(joindContesList, 'contest_id');
                    let mList = await MatchContest.find({ match_id: decoded['match_id'],'sport': decoded['sport'], contest_id: { $in: cIds } }, { "joined_users": 1, "contest_id": 1 });
                    for (const jclist of joindedContestlistdata.joined_contest) {
                        let cId = jclist.contest_id;
                        const mcObj = mList.find(element => element.contest_id.equals(ObjectId(cId)));
                        jclist.teams_joined = mcObj && mcObj.joined_users ? mcObj.joined_users : 0;
                    }
                    let myTeams = await PlayerTeam.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'] }).countDocuments();
                    joindedContestlistdata['my_team_count']= myTeams;
                    joindedContestlistdata['my_teams']= myTeams;
                    return res.send(ApiUtility.success(joindedContestlistdata));
                } else {
                    let data1 = {};
                    let ptcData = await PlayerTeamContest.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'sport': decoded['sport'], 'series_id': decoded['series_id'] }).exec()
                    if (ptcData && ptcData.length > 0) {
                        let playerteamIds = _.map(ptcData, 'player_team_id');
                        let joinedContestIds = _.uniq(_.map(ptcData, 'contest_id'), _.isEqual);
                        let ptAndContestData = await Promise.all([
                            PlayerTeam.find({ _id: { $in: playerteamIds } }).exec(),
                            MatchContest.find({ match_id: decoded['match_id'], sport: decoded['sport'], contest_id: { $in: joinedContestIds } })
                        ]);
                        if (ptAndContestData && ptAndContestData.length > 0) {
                            const playerTeamList = ptAndContestData && ptAndContestData[0] ? ptAndContestData[0] : [];
                            // const contestList = ptAndContestData && ptAndContestData[1] ? _.map(ptAndContestData[1],'contest')  : [];
                            const matchContestWithCodeList = ptAndContestData && ptAndContestData[1] ? ptAndContestData[1] : [];

                            let joinedTeams = [];
                            let contest_id_filter = [];
                            for (const ptcDataItem of ptcData) {
                                var joinObj = {};
                                const ptObj = _.find(playerTeamList, { '_id': ptcDataItem.player_team_id });
                                const contstObj = _.find(matchContestWithCodeList, { 'contest_id': ptcDataItem.contest_id });
                                if (_.find(contest_id_filter, ptcDataItem.contest_id)) {
                                    continue
                                } else {
                                    contest_id_filter.push(ptcDataItem.contest_id);
                                    joinObj._id = ptcDataItem.contest_id;
                                    joinObj.player_team = ptObj;
                                    joinObj.contest = contstObj.contest || {};
                                    joinObj.invite_code = contstObj.invite_code ? contstObj.invite_code : '';
                                    ptcDataItem.player_team = ptObj;
                                    ptcDataItem.contest = contstObj.contest || {};
                                    joinObj.doc = ptcDataItem;
                                    joinedTeams.push(joinObj);
                                }

                            }
                            //******************************************
                            let pointsData = {};
                            if (joinedTeams) {
                                for (const teams of joinedTeams) {
                                    if (!pointsData[teams.doc.contest_id]) {
                                        pointsData[teams.doc.contest_id] = [];
                                    }
                                    if (teams.player_team && teams.player_team.points) {
                                        pointsData[teams.doc.contest_id].push(teams.player_team.points);
                                    } else {
                                        pointsData[teams.doc.contest_id].push(0);
                                    }
                                }
                            }

                            let contest = [];
                            let upComingData = [];
                            let myTeamRank = [];

                            if (joinedTeams) {
                                let contestKey = 0;
                                for (const contestValue of joinedTeams) {
                                    if (!contestValue || !contestValue.contest) {
                                        continue;
                                    }
                                    let mcObj = _.find(matchContestWithCodeList, { 'contest_id': contestValue.doc.contest_id });
                                    let inviteCode = mcObj && mcObj.invite_code ? mcObj.invite_code : '';
                                    myTeamRank.push((contestValue.doc.rank) ? contestValue.doc.rank : 0);

                                    let customBreakup;
                                    if (contestValue.contest && contestValue.contest.breakup) {
                                        customBreakup = contestValue.contest.breakup[contestValue.contest.breakup.length - 1];
                                    }
                                    toalWinner = customBreakup && customBreakup.endRank ? customBreakup.endRank : ((customBreakup) ? customBreakup.startRank : 0);

                                    let joinedTeamCount = mcObj && mcObj.joined_users ? mcObj.joined_users : 0;
                                    let myTeamIds = [];
                                    let myTeamNo = [];
                                    let winningAmt = [];
                                    let joinedTeamList = _.filter(ptcData, { 'contest_id': contestValue.doc.contest_id });
                                    let teamsJoined = joinedTeamList ? joinedTeamList : [];
                                    if (teamsJoined) {
                                        for (const joined of teamsJoined) {
                                            myTeamIds.push({ "player_team_id": joined.player_team_id });
                                            myTeamNo.push((joined.player_team) ? joined.player_team.team_count : 0);
                                            // winningAmt.push((joined.winning_amount) ? joined.winning_amount : 0);
                                            winningAmt.push((joined && joined.price_win) ? parseFloat(joined.price_win) : 0);
                                        }
                                    }
                                    let customPrice = [];
                                    let isWinner = false;
                                    let isGadget = false;
                                    let aakashLeague = (contestValue && contestValue.doc && contestValue.doc.contest && contestValue.doc.contest.amount_gadget == 'aakash') ? true : false;
                                    if (contestValue.contest.breakup) {
                                        let key = 0;
                                        if (contestValue.contest.amount_gadget == 'gadget') {
                                            for (const customBreakup of contestValue.contest.breakup) {
                                                if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                                    isWinner = true;
                                                }

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
                                            isGadget = true;
                                        } else if (contestValue.contest.amount_gadget == 'x_win_breakup') {
                                            for (const customBreakup of contestValue.contest.breakup) {
                                               // console.log(contestValue, customBreakup);
                                                if ((contestValue.points <= customBreakup.start_point && contestValue.points >= customBreakup.end_point)) {
                                                    isWinner = true;
                                                }

                                                if (!customPrice[key]) {
                                                    customPrice[key] = {}
                                                }


                                                customPrice[key]['start_point'] = customBreakup.start_point ? (customBreakup.start_point) : 0;
                                                customPrice[key]['end_point'] = customBreakup.end_point ? (customBreakup.end_point) : 0;
                                                customPrice[key]['x_factor_price'] = customBreakup.x_factor_price ? (customBreakup.x_factor_price) : 0;
                                                key++;
                                            }
                                        } else {
                                            for (const customBreakup of contestValue.contest.breakup) {
                                                if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                                    isWinner = true;
                                                }

                                                if (!customPrice[key]) {
                                                    customPrice[key] = {};
                                                }
                                                if (customBreakup.startRank == customBreakup.endRank) {
                                                    customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                                                } else {
                                                    customPrice[key]['rank'] = customBreakup.name;
                                                }

                                                if (!customBreakup.price) {
                                                    customPrice[key]['price'] = 0;
                                                } else {
                                                    customPrice[key]['price'] = customBreakup.price_each ? customBreakup.price_each.toFixed(2) : customBreakup.price.toFixed(2);
                                                }

                                                customPrice[key]['image'] = (customBreakup.image) ? config.imageBaseUrl + 'contest_image/'.customBreakup.image : '';
                                                key++;
                                            }
                                        }
                                    } else if (contestValue.contest.contest_type.indexOf('free') > -1 && contestValue.doc.rank == 1) {
                                        isWinner = true;
                                    }

                                    let finiteBreakupDetail = {};

                                    if (contestValue.contest.infinite_contest_size == 1) {
                                        finiteBreakupDetail.winner_percent = contestValue.contest.winner_percent;
                                        finiteBreakupDetail.winner_amount = contestValue.contest.winning_amount_times;
                                    }

                                    let winComfimed;
                                    if (contestValue.contest.confirmed_winning == '' || contestValue.contest.confirmed_winning == '0') {
                                        winComfimed = 'no';
                                    } else {
                                        winComfimed = contestValue.contest.confirmed_winning;
                                    }

                                    // let usablebonus = config.admin_percentage;
                                    let useBonus = 0;

                                    if (inviteCode && inviteCode.usable_bonus_time) {
                                        if (moment().isBefore(inviteCode.usable_bonus_time)) {
                                            useBonus = inviteCode.before_time_bonus;
                                        } else {
                                            useBonus = inviteCode.after_time_bonus;
                                        }
                                    } else {
                                        if (contestValue.contest.used_bonus != '') {
                                            useBonus = contestValue.contest.used_bonus;
                                        }
                                    }
                                    let totalWinningAmount = winningAmt.reduce(function (a, b) {
                                        return a + b;
                                    }, 0);
                                    contest[contestKey] = {};
                                    contest[contestKey]['confirm_winning'] = winComfimed.toString();
                                    contest[contestKey]['is_gadget'] = isGadget;
                                    contest[contestKey]['user_created'] = contestValue && contestValue.contest && contestValue.contest.user_created ? contestValue.contest.user_created:0;
                                    contest[contestKey]['user_contest'] = contestValue && contestValue.contest && contestValue.contest.user_contest ? contestValue.contest.user_contest:{};
                                    contest[contestKey]['entry_fee'] = contestValue.contest.entry_fee;
                                    contest[contestKey]['prize_money'] = contestValue.contest.winning_amount;
                                    contest[contestKey]['total_teams'] = contestValue.contest.contest_size;
                                    contest[contestKey]['category_id'] = contestValue.contest.category_id;
                                    contest[contestKey]['contest_id'] = contestValue.doc.contest_id;
                                    contest[contestKey]['total_winners'] = customBreakup,
                                    contest[contestKey]['teams_joined'] = joinedTeamCount;
                                    contest[contestKey]['is_joined'] = (teamsJoined) ? true : false;
                                    contest[contestKey]['multiple_team'] = (contestValue.contest.multiple_team && contestValue.contest.multiple_team == 'yes') ? true : false;
                                    contest[contestKey]['invite_code'] = (contestValue.invite_code) ? contestValue.invite_code : '';
                                    contest[contestKey]['breakup_detail'] = customPrice;
                                    contest[contestKey]['my_team_ids'] = myTeamIds;
                                    contest[contestKey]['team_number'] = myTeamNo;
                                    contest[contestKey]['points_earned'] = (contestValue.doc && contestValue.doc.points) ? contestValue.doc.points : 0;
                                    contest[contestKey]['my_rank'] = contestValue.doc.rank;
                                    contest[contestKey]['is_winner'] = isWinner;
                                    contest[contestKey]['winning_amount'] = totalWinningAmount;
                                    contest[contestKey]['use_bonus'] = useBonus;
                                    contest[contestKey]['is_infinite'] = (contestValue.contest.infinite_contest_size == 1) ? true : false;
                                    contest[contestKey]['infinite_breakup'] = finiteBreakupDetail;
                                    contest[contestKey]['is_aakash_team'] = aakashLeague;
                                    contest[contestKey]['maximum_team_size'] = (contestValue && contestValue.doc && contestValue.doc.contest && contestValue.doc.contest.multiple_team && contestValue.doc.contest.multiple_team == 'yes') ? (contestValue.doc.contest.maximum_team_size) : 1;
                                    contestKey++;
                                }
                            }
                            let reviewMatch = await SeriesSquad.findOne({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] });
                            reviewStatus = '';
                            if (reviewMatch) {
                                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                                    reviewStatus = MatchStatus.IN_REVIEW;
                                }

                                if (reviewMatch.match_status == MatchStatus.MATCH_DELAYED) {
                                    reviewStatus = MatchStatus.MATCH_DELAYED;
                                }
                            }

                            let myTeams = await PlayerTeam.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'] }).countDocuments();


                            data1.joined_contest = contest;
                            data1.upcoming_match = upComingData;
                            data1.my_team_count = myTeams;
                            data1.my_teams = myTeams;
                            data1.my_contests = contest_id_filter && _.isArray(contest_id_filter) ? contest_id_filter.length : 0;
                            data1.my_team_rank = myTeamRank;
                            data1.match_status = reviewStatus;
                            redis.setRedisMyMatches(myJoinedContestListKey, data1);
                            return res.send(ApiUtility.success(data1));
                        } else {
                            // Something went wrong
                            return res.send('Something went wrong!!');
                        }
                    } else {
                        // No contest joined yet for this match and series
                        return res.send(ApiUtility.success(data1));
                    }
                }
            } else {
                return res.send('Something went wrong!!');
            }

        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    joinedContestList: async (req, res) => {
        try {
            const user_id = req.userId;
            const { match_id, series_id, sport } = req.params;
            let decoded = {
                sport: parseInt(sport || 1),
                match_id: parseInt(match_id),
                series_id: parseInt(series_id),
                user_id: user_id
            }
            if (match_id && series_id && user_id) {
                let data1 = {};
                let ptcData = await PlayerTeamContest.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'sport': decoded['sport'], 'series_id': decoded['series_id'] }).exec()
                if (ptcData && ptcData.length > 0) {
                    let playerteamIds = _.map(ptcData, 'player_team_id');
                    let joinedContestIds = _.uniq(_.map(ptcData, 'contest_id'), _.isEqual);
                    let ptAndContestData = await Promise.all([
                        PlayerTeam.find({ _id: { $in: playerteamIds } }).exec(),
                        MatchContest.find({ match_id: decoded['match_id'],sport:decoded['sport'], contest_id: { $in: joinedContestIds } })
                    ]);
                    if (ptAndContestData && ptAndContestData.length > 0) {
                        const playerTeamList = ptAndContestData && ptAndContestData[0] ? ptAndContestData[0] : [];
                        // const contestList = ptAndContestData && ptAndContestData[1] ? _.map(ptAndContestData[1],'contest')  : [];
                        const matchContestWithCodeList = ptAndContestData && ptAndContestData[1] ? ptAndContestData[1] : [];

                        let joinedTeams = [];
                        let contest_id_filter = [];
                        for (const ptcDataItem of ptcData) {
                            var joinObj = {};
                            const ptObj = _.find(playerTeamList, { '_id': ptcDataItem.player_team_id });
                            const contstObj = _.find(matchContestWithCodeList, { 'contest_id': ptcDataItem.contest_id });
                            if (_.find(contest_id_filter, ptcDataItem.contest_id)) {
                                continue
                            } else {
                                contest_id_filter.push(ptcDataItem.contest_id);
                                joinObj._id = ptcDataItem.contest_id;
                                joinObj.player_team = ptObj;
                                joinObj.contest = contstObj.contest || {};
                                ptcDataItem.player_team = ptObj;
                                ptcDataItem.contest = contstObj.contest || {};
                                joinObj.doc = ptcDataItem;
                                joinedTeams.push(joinObj);
                            }

                        }
                        //******************************************
                        let pointsData = {};
                        if (joinedTeams) {
                            for (const teams of joinedTeams) {
                                if (!pointsData[teams.doc.contest_id]) {
                                    pointsData[teams.doc.contest_id] = [];
                                }
                                if (teams.player_team && teams.player_team.points) {
                                    pointsData[teams.doc.contest_id].push(teams.player_team.points);
                                } else {
                                    pointsData[teams.doc.contest_id].push(0);
                                }
                            }
                        }

                        let contest = [];
                        let upComingData = [];
                        let myTeamRank = [];

                        if (joinedTeams) {
                            let contestKey = 0;
                            for (const contestValue of joinedTeams) {
                                if (!contestValue || !contestValue.contest) {
                                    continue;
                                }
                                let isCancelShow = false;
                                let mcObj = _.find(matchContestWithCodeList, { 'contest_id': contestValue.doc.contest_id });
                                let inviteCode = mcObj && mcObj.invite_code ? mcObj.invite_code : '';
                                myTeamRank.push((contestValue.doc.rank) ? contestValue.doc.rank : 0);

                                let customBreakup;
                                if (contestValue.contest && contestValue.contest.breakup) {
                                    customBreakup = contestValue.contest.breakup[contestValue.contest.breakup.length - 1];
                                }
                                toalWinner = customBreakup && customBreakup.endRank ? customBreakup.endRank : ((customBreakup) ? customBreakup.startRank : 0);
                                if (mcObj && mcObj.category_slug && (_.isEqual(mcObj.category_slug, 'head-to-head') || _.isEqual(mcObj.category_slug, 'last-man-standing'))) {
                                   if(mcObj.isCanceled){
                                    isCancelShow = true;
                                   }
                                }
                                let joinedTeamCount = mcObj && mcObj.joined_users ? mcObj.joined_users : 0;
                                let myTeamIds = [];
                                let myTeamNo = [];
                                let winningAmt = [];
                                let joinedTeamList = _.filter(ptcData, { 'contest_id': contestValue.doc.contest_id });
                                let teamsJoined = joinedTeamList ? joinedTeamList : [];
                                if (teamsJoined) {
                                    for (const joined of teamsJoined) {
                                        myTeamIds.push({ "player_team_id": joined.player_team_id });
                                        myTeamNo.push((joined.player_team) ? joined.player_team.team_count : 0);
                                        // winningAmt.push((joined.winning_amount) ? joined.winning_amount : 0);
                                        winningAmt.push((joined && joined.price_win) ? parseFloat(joined.price_win) : 0);
                                    }
                                }
                                let customPrice = [];
                                let isWinner = false;
                                let isGadget = false;
                                let aakashLeague = (contestValue && contestValue.doc && contestValue.doc.contest && contestValue.doc.contest.amount_gadget == 'aakash') ? true : false;
                                if (contestValue.contest.breakup) {
                                    let key = 0;
                                    if (contestValue.contest.amount_gadget == 'gadget') {
                                        for (const customBreakup of contestValue.contest.breakup) {
                                            if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                                isWinner = true;
                                            }

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
                                        isGadget = true;
                                    } else if (contestValue.contest.amount_gadget == 'x_win_breakup') {
                                        for (const customBreakup of contestValue.contest.breakup) {
                                           // console.log(contestValue, customBreakup);
                                            if ((contestValue.points <= customBreakup.start_point && contestValue.points >= customBreakup.end_point)) {
                                                isWinner = true;
                                            }

                                            if (!customPrice[key]) {
                                                customPrice[key] = {}
                                            }


                                            customPrice[key]['start_point'] = customBreakup.start_point ? (customBreakup.start_point) : 0;
                                            customPrice[key]['end_point'] = customBreakup.end_point ? (customBreakup.end_point) : 0;
                                            customPrice[key]['x_factor_price'] = customBreakup.x_factor_price ? (customBreakup.x_factor_price) : 0;
                                            key++;
                                        }
                                    } else {
                                        for (const customBreakup of contestValue.contest.breakup) {
                                            if ((contestValue.rank >= customBreakup.startRank && contestValue.rank <= customBreakup.endRank) || contestValue.rank == customBreakup.end) {
                                                isWinner = true;
                                            }

                                            if (!customPrice[key]) {
                                                customPrice[key] = {};
                                            }
                                            if (customBreakup.startRank == customBreakup.endRank) {
                                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                                            } else {
                                                customPrice[key]['rank'] = customBreakup.name;
                                            }

                                            if (!customBreakup.price) {
                                                customPrice[key]['price'] = 0;
                                            } else {
                                                customPrice[key]['price'] = customBreakup.price_each ? customBreakup.price_each.toFixed(2) : customBreakup.price.toFixed(2);
                                            }

                                            customPrice[key]['image'] = (customBreakup.image) ? config.imageBaseUrl + 'contest_image/'.customBreakup.image : '';
                                            key++;
                                        }
                                    }
                                } else if (contestValue.contest.contest_type.indexOf('free') > -1 && contestValue.doc.rank == 1) {
                                    isWinner = true;
                                }

                                let finiteBreakupDetail = {};

                                if (contestValue.contest.infinite_contest_size == 1) {
                                    finiteBreakupDetail.winner_percent = contestValue.contest.winner_percent;
                                    finiteBreakupDetail.winner_amount = contestValue.contest.winning_amount_times;
                                }

                                let winComfimed;
                                if (contestValue.contest.confirmed_winning == '' || contestValue.contest.confirmed_winning == '0') {
                                    winComfimed = 'no';
                                } else {
                                    winComfimed = contestValue.contest.confirmed_winning;
                                }

                                // let usablebonus = config.admin_percentage;
                                let useBonus = 0;

                                if (inviteCode && inviteCode.usable_bonus_time) {
                                    // //////console.log("matchInviteCode", inviteCode, moment().isBefore(inviteCode.usable_bonus_time))
                                    if (moment().isBefore(inviteCode.usable_bonus_time)) {
                                        useBonus = inviteCode.before_time_bonus;
                                    } else {
                                        useBonus = inviteCode.after_time_bonus;
                                    }
                                } else {
                                    if (contestValue.contest.used_bonus != '') {
                                        useBonus = contestValue.contest.used_bonus;
                                    }
                                }
                                let totalWinningAmount = winningAmt.reduce(function (a, b) {
                                    return a + b;
                                }, 0);

                                contest[contestKey] = {};
                                contest[contestKey]['confirm_winning'] = winComfimed.toString();
                                contest[contestKey]['is_gadget'] = isGadget;
                                contest[contestKey]['entry_fee'] = contestValue.contest.entry_fee;
                                contest[contestKey]['prize_money'] = contestValue.contest.winning_amount;
                                contest[contestKey]['total_teams'] = contestValue.contest.contest_size;
                                contest[contestKey]['category_id'] = contestValue.contest.category_id;
                                contest[contestKey]['contest_id'] = contestValue.doc.contest_id;
                                contest[contestKey]['total_winners'] = customBreakup,
                                    contest[contestKey]['teams_joined'] = joinedTeamCount;
                                contest[contestKey]['is_joined'] = (teamsJoined) ? true : false;
                                contest[contestKey]['multiple_team'] = (contestValue.contest.multiple_team && contestValue.contest.multiple_team == 'yes') ? true : false;
                                contest[contestKey]['invite_code'] = (inviteCode) ? inviteCode.invite_code : '';
                                contest[contestKey]['breakup_detail'] = customPrice;
                                contest[contestKey]['my_team_ids'] = myTeamIds;
                                contest[contestKey]['team_number'] = myTeamNo;
                                contest[contestKey]['points_earned'] = (contestValue.doc && contestValue.doc.points) ? contestValue.doc.points : 0;
                                contest[contestKey]['commision'] = (contestValue.doc && contestValue.doc.commision) ? contestValue.doc.commision : 0;
                                contest[contestKey]['my_rank'] =  contestValue.doc.rank;
                                contest[contestKey]['is_winner'] = totalWinningAmount && totalWinningAmount > 0 ? true :false;
                                contest[contestKey]['winning_amount'] = totalWinningAmount ?  parseFloat(totalWinningAmount).toFixed(2) :  totalWinningAmount;
                                contest[contestKey]['use_bonus'] = useBonus;
                                contest[contestKey]['is_infinite'] = (contestValue.contest.infinite_contest_size == 1) ? true : false;
                                contest[contestKey]['infinite_breakup'] = finiteBreakupDetail;
                                contest[contestKey]['is_aakash_team'] = aakashLeague;
                                contest[contestKey]['is_cancel_show'] = isCancelShow;
                                contest[contestKey]['maximum_team_size'] = (contestValue && contestValue.doc && contestValue.doc.contest && contestValue.doc.contest.multiple_team && contestValue.doc.contest.multiple_team == 'yes') ? (contestValue.doc.contest.maximum_team_size) : 1;
                                contestKey++;
                            }
                        }
                        let reviewMatch = await SeriesSquad.findOne({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] });
                        reviewStatus = '';
                        if (reviewMatch) {
                            if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                                reviewStatus = MatchStatus.IN_REVIEW;
                            }

                            if (reviewMatch.match_status == MatchStatus.MATCH_DELAYED) {
                                reviewStatus = MatchStatus.MATCH_DELAYED;
                            }
                        }

                        let myTeams = await PlayerTeam.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'] }).countDocuments();


                        data1.joined_contest = contest;
                        data1.upcoming_match = upComingData;
                        data1.my_team_count = myTeams;
                        data1.my_teams = myTeams;
                        data1.my_contests = contest_id_filter && _.isArray(contest_id_filter) ? contest_id_filter.length : 0;
                        data1.my_team_rank = myTeamRank;
                        data1.match_status = reviewStatus;

                        return res.send(ApiUtility.success(data1));

                        //******************************************
                    } else {
                        // Something went wrong
                        return res.send('Something went wrong!!');
                    }
                } else {
                    // No contest joined yet for this match and series
                    return res.send(ApiUtility.success(data1));
                }
            } else {
                return res.send('Something went wrong!!');
            }

        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
}

async function getPromiseUserJoinedContestList(key) {
    return new Promise((resolve, reject) => {
        redis.getRedisMyMatches(key, async (err, data) => {
            if (data == null) {
                data = {};
            }
            resolve(data)
        })
    })
}