const { ObjectId } = require('mongodb');
const LiveFantasyMatchList = require('../../../models/live-fantasy/lf-match-list-model');
const LiveFantasyMatchContest = require('../../../models/live-fantasy/lf-match-contest');
const LFPlayerTeamContest = require('../../../models/live-fantasy/lf_joined_contest');
const LFPrediction = require('../../../models/live-fantasy/lf-prediction');
const CouponSale = require("../../../models/coupon-sale");
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const redis = require('../../../../lib/redis');
const moment = require('moment');
const _ = require("lodash");
var imageurl = config.imageBaseUrl;
const Helper = require('./../common/helper');
const { MatchStatus } = require('../../../constants/app');

module.exports = {
    liveFantasyMatchList: async (req, res) => {
        try {
            let data1 = {};
            let { pmatch_id, sport } = req.params;
            let  upCommingMatch = await LiveFantasyMatchList.find({ over_parent_id: pmatch_id, time: { $gte: new Date() }, status: 1, match_status: "Not Started" }).limit(40).sort({ _id: -1 });
            if(upCommingMatch && upCommingMatch.length>0){
                for (const item of upCommingMatch) {
                    item['local_team_name'] = item.localteam_short_name;
                    item['visitor_team_name'] = item.visitorteam_short_name;
                }
            }
            let liveData = [];
            let finishData = [];
            data1.upcoming_match = upCommingMatch;
            data1.total = upCommingMatch.length;
            data1.live_match = liveData;
            data1.completed_match = finishData;
            data1.message = 'Test Message';
            data1.match_type = "live-fantasy";
            let data = {};
            data.running_over = 3;
            data.running_ball = 2;
            data.match_id = 42345;
            data.message = 'Test Message';
            data.live_score = "India - 10/1";

            data1['match_data'] = data;
            data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
            var successObj = ApiUtility.success(data1);
            redis.setRedisForLf('lf-match-list-' + pmatch_id + '-' + sport, successObj);
            res.send(successObj);
        } catch (error) {
            console.log(error);
            Helper.sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
    liveFantasyMatchContestList: async (req, res) => {
        try {
            const { match_id, sport, series_id } = req.params;
            const user_id = req.userId;
            let resObj = {
                match_contest: [],
                my_contests: 0,
                joined_contest_ids: [],
                user_coupons: {},
                user_prediction_ids: []
            };
            if (match_id && sport) {
                let filter = {
                    "match_id": parseInt(match_id),
                    "sport": parseInt(sport),
                    is_full: { $ne: 1 }
                };
                let joinedTeamsCount = {};
                let userTeamIds = {};
                let joinedContestIds =[];
                let myPrediction = 0;
                let match_contest_data = await getLfMatchContest(filter, false);
                let myContest = [];
                if (user_id) {
                    let redisKeyForUserMyCoupons = 'my-coupons-' + user_id;
                    let countRedisKey = 'lf-user-teams-count-' + match_id + '-' + series_id + '-' + user_id;
                    myContest = await LFPlayerTeamContest.find({ user_id: ObjectId(user_id), match_id: parseInt(match_id) }, { _id: 1, contest_id: 1, prediction_id: 1 }).exec();
                    
                    let teamCounts = await getLFRedisForMyTeamCount(countRedisKey);
                    if(teamCounts>0){
                        myPrediction = teamCounts;
                    } else {
                        myPrediction = await LFPrediction.find({ user_id: ObjectId(user_id), match_id: parseInt(match_id) }).countDocuments();
                        if(myPrediction && myPrediction>0){
                            redis.setRedisForLf(countRedisKey,myPrediction);
                        }
                    }
                    
                    let userCoupons ={}; // await getPromiseForUserCoupons(redisKeyForUserMyCoupons, "{}", user_id);
                    resObj['user_coupons'] = !_.isEmpty(userCoupons) ? JSON.parse(userCoupons) : {};
                    const contestGrpIds = myContest && myContest.length > 0 ? _.groupBy(myContest, 'contest_id') : {};
                     joinedContestIds = myContest && myContest.length > 0 ? _.uniqWith(_.map(myContest, 'contest_id'), _.isEqual) : [];
                    
                    resObj['my_contests'] = joinedContestIds.length || 0;
                    resObj['joined_contest_ids'] = joinedContestIds;
                    for (const contsIds of joinedContestIds) {
                        userTeamIds[contsIds] = contestGrpIds[contsIds];
                    }
                    redis.setRedisForLf('lf-user-contest-count-' + match_id + '-' + series_id + '-' + user_id, joinedContestIds.length || 0);
                }
                for (const matchContests of match_contest_data) {
                    for (const contest of matchContests.contests) {
                        joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                        contest.my_predction_ids = [];
                    }
                }

                resObj['my_prediction'] = myPrediction;
                resObj['user_prediction_ids'] = Helper.parseUserPrediction(userTeamIds);
                resObj['joined_predictions_count'] = Helper.parseContestPredictionJoined(joinedTeamsCount);
                resObj['match_type'] = "live-fantasy";
                resObj['match_contest'] = match_contest_data || [];
                let userContestJoinedRKey = 'lf-user-contest-joinedContestIds-' + user_id + '-' + match_id + '-' + series_id;
                let userContestTeamsIds  = 'lf-user-contest-teamIds-' + user_id + '-' + match_id + '-' + series_id;
                let contestJoineTeamCounts  = 'lf-contest-joined-teams-count-'+ match_id + '-' + series_id;
                let  matchContestList = 'lf-match-contest-list-'+ match_id + '-' + series_id;
                redis.setRedisForLf(userContestTeamsIds, userTeamIds);
                redis.setRedisForLf(userContestJoinedRKey, joinedContestIds);
                redis.setRedisForLf(contestJoineTeamCounts, joinedTeamsCount);
                redis.setRedisForLf(matchContestList, match_contest_data);
                var finalResult = ApiUtility.success(resObj);
                return res.send(finalResult);
            } else {
                return res.send(ApiUtility.failed('Something went wrong!!'));
            }

        } catch (error) {
            console.log(error);
            // Helper.sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
    liveFantasyMatchContestWallet: async (req, res) => {
        try {
            let data = {};
            let data1 = {};
            let setting = config;
            let matchContestData = {};
            const { contest_id, entry_fee, match_id, series_id, sport } = req.body;
            let decoded = {
                user_id: req.userId,
                contest_id: contest_id || '',
                entry_fee: entry_fee,
                match_id: match_id,
                series_id: series_id
            }
            let match_sport = sport ? parseInt(sport) : 1;
            let match_series_id = series_id ? parseInt(series_id) : 1;
            let youtuber_code = 0;
            let is_offer_applied = false;
            let couponSaleData = [];
            let userdata = await User.findOne({ _id: decoded['user_id'] })
            if (userdata) {
                adminPer = 0; //(setting.admin_percentage) ? setting.admin_percentage : 0;
                let useableBonusPer = adminPer;
                let entryFee = 0;
                if (decoded['contest_id']) {
                    const cSaleData = await CouponSale.findOne({ user_id: ObjectId(req.userId), status: 1, expiry_date: { $gte: new Date() } });
                    matchContestData = await LiveFantasyMatchContest.findOne({ 'contest_id': decoded['contest_id'], sport: match_sport, match_id: match_id });
                    if (matchContestData && !matchContestData._id) {
                        return res.send(ApiUtility.failed("Something went wrong in params!!"));
                    }
                    entryFee = (matchContestData && matchContestData.entry_fee) ? matchContestData.entry_fee : 0;
                    if (cSaleData && cSaleData._id) {
                        couponSaleData = cSaleData.coupon_contest_data;
                    }
                    if (matchContestData && matchContestData.usable_bonus_time) {
                        //////console.log("matchInviteCode", matchContest, moment().isBefore(matchContest.usable_bonus_time))
                        if (moment().isBefore(matchContestData.usable_bonus_time)) {
                            useableBonusPer = matchContestData.before_time_bonus;
                        } else {
                            useableBonusPer = matchContestData.after_time_bonus;
                        }
                    } else {
                        useableBonusPer = (matchContestData && matchContestData.used_bonus) ? matchContestData.used_bonus : 0;
                    }

                    if (useableBonusPer == '') {
                        useableBonusPer = adminPer;
                    }
                    youtuber_code = matchContestData && matchContestData.youtuber_code ? matchContestData.youtuber_code : 0;
                    data['youtuber_code'] = youtuber_code;
                    data['contest_shareable'] = 0;
                } else {
                    entryFee = decoded['entry_fee'];
                }
                let useAmount = eval((useableBonusPer / 100) * entryFee);
                
                let usableAmt = 0;
                let extraAmount = 0;
                let cashBalance = 0;
                let winningBalance = 0;
                let redisKeyForRentation = 'app-analysis-' + decoded['user_id'] + '-' + decoded['match_id'] + '-' + match_sport;
                let userOfferAmount = 0;
                let retention_bonus_amount = 0;
                let calEntryFees = entryFee;
                try {
                    redis.getRedisForUserAnaysis(redisKeyForRentation, async (err, rdata) => {
                        
                        let catid = matchContestData.category_id;
                        if (couponSaleData && couponSaleData.length > 0) {
                            couponSaleData = couponSaleData.map(item => {
                                let container = {};
                                container.category_id = ObjectId(item.category_id);
                                container.offer_data = item.offer_data;
                                return container;
                            });
                            let constestIdsData = _.find(couponSaleData, { category_id: ObjectId(catid) });
                            if (constestIdsData && constestIdsData.category_id) {
                                let offDataArray = constestIdsData.offer_data;
                                let offDataItem = _.find(offDataArray, { amount: entryFee });
                                if (offDataItem) {
                                    userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                    calEntryFees = userOfferAmount > entryFee ? 0 : (entryFee - userOfferAmount);
                                    retention_bonus_amount = userOfferAmount > entryFee ? entryFee : userOfferAmount;
                                }

                            }
                        }
                        if (rdata && entryFee > 0 && userOfferAmount == 0) {
                            userOfferAmount = rdata.is_offer_type == 1 ? rdata.offer_amount : eval((rdata.offer_percent / 100) * entryFee);
                            let pContestId = contest_id; //ObjectId(contest_id);
                            let offerContests = rdata.contest_ids || [];
                            let prContestId = matchContestData && matchContestData.parent_contest_id ? String(matchContestData.parent_contest_id) : pContestId;
                            let cBonus = rdata && rdata.contest_bonous ? rdata.contest_bonous : [];  //config && config.contest_bonous ? config.contest_bonous:[];
                            let cBonusItem = {};
                            if (rdata.is_offer_type == 3) {
                                cBonusItem = cBonus.find(function (el) {
                                    if (ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))) {
                                        return el
                                    }
                                });
                            }
                            if ((userOfferAmount > 0 && rdata.is_offer_type === 1) || (userOfferAmount > 0 && rdata.is_offer_type == 2 && offerContests.length > 0 && (_.includes(offerContests, pContestId) || _.includes(offerContests, prContestId)))) {
                                calEntryFees = userOfferAmount > entryFee ? 0 : (entryFee - userOfferAmount);
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee : userOfferAmount;

                            } else if (rdata.is_offer_type == 3 && cBonusItem && cBonusItem.contest_id) {
                                userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                calEntryFees = userOfferAmount > entryFee ? 0 : (entryFee - userOfferAmount);
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee : userOfferAmount;
                                is_offer_applied = true;
                            }
                        }


                        if (userdata) {
                            if (decoded['contest_id']) {
                                if (retention_bonus_amount > 0) {
                                    usableAmt = 0;
                                } else {
                                    if (useAmount > userdata.bonus_amount) {
                                        usableAmt = userdata.bonus_amount;
                                    } else {
                                        usableAmt = useAmount;
                                    }
                                }
                                let extraBalance = userdata.extra_amount || 0;
                                let remainingFee = retention_bonus_amount > 0 ? calEntryFees : entryFee - usableAmt;

                                let indianDate = Date.now();
                                indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
                                if (extraBalance) {
                                    let perDayExtraAmt = 0;
                                    let perDayLimit = config.extra_bonus_perday_limit;

                                    if (String(userdata.extra_amount_date) == String(indianDate)) {
                                        perDayExtraAmt = userdata.perday_extra_amount;
                                    }
                                    if (perDayExtraAmt < perDayLimit) {
                                        extraAmount = (extraBalance > remainingFee) ? remainingFee : extraBalance;
                                        extraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - perDayExtraAmt) : extraAmount
                                    }
                                }
                            }
                            cashBalance = userdata.cash_balance;
                            winningBalance = userdata.winning_balance;

                        }
                        data['cash_balance'] = (cashBalance) ? cashBalance : 0;
                        data['winning_balance'] = (winningBalance) ? winningBalance : 0;
                        data['usable_bonus'] = usableAmt ? parseFloat(usableAmt.toFixed(2)) : 0;
                        data['extra_amount'] = extraAmount ? parseFloat(extraAmount.toFixed(2)) : 0;
                        data['entry_fee'] = (entryFee) ? parseInt(entryFee) : 0;
                        data['user_offer_amount'] = (retention_bonus_amount) ? parseFloat(retention_bonus_amount.toFixed(2)) : 0;
                        data['calculated_entry_fee'] = (calEntryFees && _.isNumber(calEntryFees)) ? parseFloat(calEntryFees.toFixed(2)) : 0;
                        data['usable_bonus_percent'] = 0; //is_offer_applied;
                        data['is_offer_applied'] = is_offer_applied;
                        data['match_type'] = "live-fantasy";
                        data1 = data;
                        res.send(ApiUtility.success(data1));
                    });
                } catch (err) {
                    consolelog('error in catch block in cache****', err);
                    return res.send(ApiUtility.failed("Something went wrong!!"));
                }

            } else {
                return res.send(ApiUtility.failed("User not found."));
            }
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    lfJoinedContestList11: async (req, res) => {
        try {
            // let sport = 1;
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
                let authUser = await User.findById(user_id);
                if (authUser) {
                    let joinedTeams = await LFPlayerTeamContest.aggregate([{
                        $match: { 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'sport': decoded['sport'], 'series_id': decoded['series_id'] }
                    },
                    {
                        $lookup: {
                            from: 'lf_match_contest',
                            localField: 'contest_id',
                            foreignField: 'contest_id',
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
                            let inviteCode = '';//await LiveFantasyMatchContest.getInviteCode(decoded['match_id'], contestValue.doc.contest_id);
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
                                'contest_id': contestValue.doc.contest.contest_id,
                                'user_id': decoded['user_id'],
                                'sport': decoded['sport']
                            };
                            let joinedTeamCount = contestValue && contestValue.contest && contestValue.contest.joined_users ? contestValue.contest.joined_users : 0 //await PlayerTeamContest.find({ 'match_id': decoded['match_id'],'sport':decoded['sport'], 'contest_id': contestValue.doc.contest._id }).countDocuments();

                            let myTeamIds = [];
                            let myTeamNo = [];
                            let winningAmt = [];

                            let teamsJoined = await LFPlayerTeamContest.find(playerContestFilter);
                            
                            if (teamsJoined) {
                                for (const joined of teamsJoined) {
                                    
                                    myTeamIds.push({ "player_team_id": joined.prediction_id });
                                    myTeamNo.push(1);
                                    winningAmt.push((joined.winning_amount) ? joined.winning_amount : 0);

                                }
                            }

                            let customPrice = [];
                            let isWinner = false;
                            let isGadget = false;
                            let aakashLeague = (contestValue.doc.contest.amount_gadget == 'aakash') ? true : false;
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
                            contest[contestKey]['multiple_team'] = false;
                            contest[contestKey]['invite_code'] = (inviteCode) ? inviteCode.invite_code : '';
                            contest[contestKey]['breakup_detail'] = customPrice;
                            contest[contestKey]['my_team_ids'] = myTeamIds;
                            contest[contestKey]['team_number'] = myTeamNo;
                            //contest[contestKey]['points_earned'] = (contestValue.doc.player_team && contestValue.doc.player_team.points) ? contestValue.player_team.points : 0;
                            contest[contestKey]['my_rank'] = contestValue.doc.rank;
                            contest[contestKey]['is_winner'] = isWinner;
                            contest[contestKey]['winning_amount'] = totalWinningAmount;
                            contest[contestKey]['use_bonus'] = useBonus;
                            contest[contestKey]['is_infinite'] = (contestValue.doc.contest.infinite_contest_size == 1) ? true : false;
                            contest[contestKey]['infinite_breakup'] = finiteBreakupDetail;
                            contest[contestKey]['is_aakash_team'] = aakashLeague;
                            contest[contestKey]['maximum_team_size'] = 1;
                            contestKey++;
                        }
                    }



                    let myTeams = await LFPrediction.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'sport': decoded['sport'] }).countDocuments();



                    data1.joined_contest = contest;
                    data1.upcoming_match = upComingData;
                    data1.my_team_count = myTeams;
                    data1.my_teams = myTeams;
                    data1.my_contests = 0;
                    data1.my_team_rank = myTeamRank;
                    data1.match_type = "live-fantasy";

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
    lfJoinedContestList: async (req, res) => {
        try {
            const user_id = req.userId;
            const { match_id, series_id, sport } = req.params;
            let decoded = { match_id: parseInt(match_id), series_id: parseInt(series_id), user_id: ObjectId(user_id) }
            let data1 = {};
            if (match_id && series_id && user_id) {
                let ptcData = await LFPlayerTeamContest.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], 'series_id': decoded['series_id'],'is_deleted': 0 }).exec()
                if (ptcData && ptcData.length > 0) {
                    let predictionIds = _.map(ptcData, 'prediction_id');
                    let joinedContestIds = _.uniq(_.map(ptcData, 'contest_id'), _.isEqual);

                    let ptAndContestData = await Promise.all([
                        LiveFantasyMatchContest.find({ match_id: decoded['match_id'], contest_id: { $in: joinedContestIds } }),
                        LiveFantasyMatchList.findOne({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] })
                    ]);

                    if (ptAndContestData && ptAndContestData.length > 0) {
                        const predictionList = []; // ptAndContestData && ptAndContestData[0] ? ptAndContestData[0] : [];
                        // const contestList = ptAndContestData && ptAndContestData[1] ? ptAndContestData[1] : [];
                        let reviewMatch = ptAndContestData && ptAndContestData[1] ? ptAndContestData[1] : {};
                        const matchContestWithCodeList = ptAndContestData && ptAndContestData[0] ? ptAndContestData[0] : [];

                        let joinedTeams = [];
                        for (const ptcDataItem of ptcData) {
                            var joinObj = {};
                            const ptObj = _.find(predictionList, { '_id': ptcDataItem.prediction_id });
                            const contstObj = _.find(matchContestWithCodeList, { 'contest_id': ptcDataItem.contest_id });

                            joinObj._id = ptcDataItem.contest_id;
                            joinObj.player_team = ptObj;
                            joinObj.contest = contstObj;
                            ptcDataItem.player_team = ptObj;
                            ptcDataItem.contest = contstObj;
                            joinObj.doc = ptcDataItem;
                            joinedTeams.push(joinObj);
                        }
                        let pointsData = {};
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
                                        myTeamIds.push({ "player_team_id": joined.prediction_id });
                                        myTeamNo.push((joined.team_count) ? joined.team_count : 1);
                                        winningAmt.push((joined.winning_amount) ? joined.winning_amount : 0);
                                    }
                                }
                                let customPrice = [];
                                let isWinner = false;
                                let isGadget = false;
                                let aakashLeague = (contestValue && contestValue.doc && contestValue.doc.contest && contestValue.doc.contest.amount_gadget == 'aakash') ? true : false;
                                if (contestValue && contestValue.contest && contestValue.contest.breakup) {
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
                                } else if (contestValue && contestValue.contest && contestValue.contest.contest_type && contestValue.contest.contest_type.indexOf('free') > -1 && contestValue.doc.rank == 1) {
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
                                contest[contestKey]['entry_fee'] = contestValue.contest.entry_fee;
                                contest[contestKey]['prize_money'] = contestValue.contest.winning_amount;
                                contest[contestKey]['total_teams'] = contestValue.contest.contest_size;
                                contest[contestKey]['category_id'] = contestValue.contest.category_id;
                                contest[contestKey]['contest_id'] = contestValue.doc.contest_id;
                                contest[contestKey]['total_winners'] = customBreakup, //(customBreakup && customBreakup.length) ? customBreakup.pop : {},//toalWinner;
                                    contest[contestKey]['teams_joined'] = joinedTeamCount;
                                contest[contestKey]['is_joined'] = (teamsJoined) ? true : false;
                                contest[contestKey]['multiple_team'] = false;
                                contest[contestKey]['invite_code'] = (inviteCode) ? inviteCode : '';
                                contest[contestKey]['breakup_detail'] = customPrice;
                                contest[contestKey]['my_team_ids'] = myTeamIds;
                                contest[contestKey]['team_number'] = myTeamNo;
                                contest[contestKey]['points_earned'] = (contestValue && contestValue.doc && contestValue.doc.points) ? contestValue.doc.points : 0;
                                contest[contestKey]['my_rank'] = (contestValue && contestValue.doc && contestValue.doc.rank) ? contestValue.doc.rank : 0;
                                contest[contestKey]['is_winner'] = isWinner;
                                contest[contestKey]['winning_amount'] = totalWinningAmount;
                                contest[contestKey]['use_bonus'] = useBonus;
                                contest[contestKey]['is_infinite'] = (contestValue.contest.infinite_contest_size == 1) ? true : false;
                                contest[contestKey]['infinite_breakup'] = finiteBreakupDetail;
                                contest[contestKey]['is_aakash_team'] = aakashLeague;
                                contest[contestKey]['maximum_team_size'] = 1;
                                contestKey++;
                            }
                        }
                        reviewStatus = '';
                        if (reviewMatch) {
                            if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                                reviewStatus = MatchStatus.IN_REVIEW;
                            }
                            if (reviewMatch.match_status == MatchStatus.MATCH_DELAYED) {
                                reviewStatus = MatchStatus.MATCH_DELAYED;
                            }
                        }
                        let myTeams = await LFPrediction.find({ 'user_id': decoded['user_id'], 'match_id': decoded['match_id'], sport: 1 }).countDocuments();
                        data1.joined_contest = contest;
                        data1.upcoming_match = upComingData;
                        data1.my_team_count = myTeams;
                        data1.my_teams = myTeams;
                        data1.my_contests = joinedContestIds && joinedContestIds.length > 0 ? joinedContestIds.length : 0;
                        data1.my_team_rank = myTeamRank;
                        data1.match_status = reviewStatus;
                        data1.match_type = "live-fantasy";
                    } else {
                        // Something went wrong
                        return res.send('Something went wrong!!');
                    }
                } else {
                    // No contest joined yet for this match and series
                    let resData = {
                        "joined_contest": [],
                        "upcoming_match": [],
                        "my_team_count": 0,
                        "my_teams": 0,
                        "my_contests": 0,
                        "my_team_rank":[],
                        "match_status": "",
                        "match_type": "live-fantasy"
                    }
                   return res.send(ApiUtility.success(resData));
                }
                return res.send(ApiUtility.success(data1));

            } else {
                
                return res.send(ApiUtility.success(data1));
            }

        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    liveMatchScore: async (req, res) => {
        try {
            let data = {};
            data.running_over = 3.1;
            data.over_done = 4;
            data.match_id = 42345;
            data.message = 'Test Message';
            data.live_score = "India - 10/1";
            data.server_time = moment(new Date()).format(config.DateFormat.datetime);
            var successObj = ApiUtility.success(data);
            // redis.setRedisForLf('lf-match-list-' + pmatch_id + '-' + sport, successObj);
            res.send(successObj);
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    }
}

function getLfMatchContest(filter, is_all) {
    is_all = false;
    
    return new Promise((resolve, reject) => {
        try {
            var is_joined = false;
            LiveFantasyMatchContest.aggregate([
                {
                    $match: filter
                },
                {
                    $group: {
                        _id: "$category_id",
                        category_name: { $first: "$category_name" },
                        description: { $first: "$category_description" },
                        status: { $first: "$status" },
                        sequence: { $first: "$category_seq" },
                        match_id: { $first: "$match_id" },
                        series_id: { $first: "$series_id" },
                        parent_match_id: { $first: "$parent_match_id" },
                        match_contest_id: { $first: "_id" },
                        contests: { "$push": "$$ROOT" }
                    }
                },
                {
                    $project: {
                        _id: "$_id",
                        match_id: "$match_id",
                        category_id: "$_id",
                        "category_title": "$category_name",
                        "sequence": "$sequence",
                        "category_desc": "$description",
                        "series_id": "$series_id",
                        "parent_match_id": "$parent_match_id",
                        "contests": {
                            $map: {
                                "input": "$contests",
                                as: "sec",
                                in: {
                                    "contest_id": "$$sec.contest_id",
                                    "parent_contest_id": "$$sec.parent_contest_id",
                                    "entry_fee": "$$sec.entry_fee",
                                    "prize_money": "$$sec.winning_amount",
                                    "is_full": "$$sec.is_full",
                                    "confirm_winning": { $cond: { if: { $eq: ["$$sec.confirmed_winning", "yes"] }, then: "yes", else: 'no' } },
                                    "is_gadget": { $cond: { if: { $eq: ["$$sec.amount_gadget", "gadget"] }, then: true, else: false } },
                                    "category_id": "$$sec.category_id",
                                    "is_auto_create": "$$sec.is_auto_create",
                                    "multiple_team": false,
                                    "invite_code": "$$sec.invite_code",
                                    "breakup_detail": {
                                        $map: {
                                            "input": "$$sec.breakup",
                                            as: "break",
                                            in: {
                                                "rank": { $cond: { if: { $eq: ["$$break.startRank", "$$break.endRank"] }, then: { $concat: ["Rank ", { $toString: "$$break.startRank" }] }, else: "$$break.name" } },
                                                "gadget_name": { $cond: { if: { $ne: ["$$break.gadget_name", ""] }, then: "$$break.gadget_name", else: "" } },
                                                "image": { $cond: { if: { $ne: ["$$break.image", ""] }, then: { $concat: [imageurl, "/", "$$break.image"] }, else: "" } },
                                                "price": { $cond: { if: { $gt: ["$$break.price_each", 0] }, then: { $trunc: ["$$break.price_each", 2] }, else: { $trunc: ["$$break.price", 2] } } },
                                            }
                                        }
                                    },
                                    "after_time_bonus": "$$sec.after_time_bonus",
                                    "before_time_bonus": "$$sec.before_time_bonus",
                                    "current_date": new Date(),
                                    "usable_bonus_time": '$$sec.usable_bonus_time',
                                    "use_bonus": { $cond: { if: { $ifNull: ["$$sec.usable_bonus_time", false] }, then: { $cond: { if: { $gt: [new Date(), '$$sec.usable_bonus_time'] }, then: { $toString: "$$sec.before_time_bonus" }, else: { $toString: "$$sec.after_time_bonus" } } }, else: { $toString: "$$sec.used_bonus" } } },
                                    "is_infinite": { $cond: { if: { $eq: ["$$sec.infinite_contest_size", 1] }, then: true, else: false } },
                                    "teams_joined": "$$sec.joined_users",
                                    "total_teams": "$$sec.contest_size",
                                    "total_winners": { $arrayElemAt: ["$$sec.breakup", -1] },
                                    "is_joined": is_joined,
                                    "infinite_breakup": { $cond: { if: { $eq: ["$$sec.infinite_contest_size", 1] }, then: { "winner_percent": "$$sec.winner_percent", "winner_amount": "$$sec.winning_amount_times" }, else: {} } },
                                    "is_aakash_team": { $cond: { if: { $eq: ["$$sec.amount_gadget", "aakash"] }, then: true, else: false } },
                                    "maximum_team_size": 1

                                }
                            }
                        },
                    }
                },
                { $sort: { category_seq: 1 } }
            ], (err, data) => {
                if (err) {
                    reject(err);
                }
                if (!err) {
                    if (is_all && data && data.length > 0) {
                        var conArry = [];
                        var dlength = data.length;
                        _.forEach(data, function (k, i) {
                            conArry.push(k.contests)
                            if (i === (dlength - 1)) {
                                var newArray = Array.prototype.concat.apply([], conArry);
                                resolve([{ "contests": newArray }]);
                            }
                        })
                    } else {
                        resolve(data);
                    }
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}
async function getPromiseForUserCoupons(key, defaultValue, user_id) {
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), status: 1 });
                
                if (cSaleData && cSaleData._id) {
                    redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(cSaleData));
                    data = JSON.stringify(cSaleData);
                } else {
                    data = defaultValue;
                }

            }
            resolve(data)
        })
    })
}
async function getPromiseUserteamCounts(key, defaultValue, user_id) {
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), status: 1 });
                
                if (cSaleData && cSaleData._id) {
                    redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(cSaleData));
                    data = JSON.stringify(cSaleData);
                } else {
                    data = defaultValue;
                }

            }
            resolve(data)
        })
    })
}
function parseUserPrediction(userPredictionData) {
    let userPredctionIds = [];
    for (const prop in userPredictionData) {
        
        if (hasOwnProperty.call(userPredictionData, prop)) {
            let teamData = userPredictionData[prop];
            let predictionIds = [];
            for (let team of teamData) {
                team.contest_id = prop;
                if (team.prediction_id) {
                    predictionIds.push(team.prediction_id);
                }
            }
            userPredctionIds.push({
                contest_id: prop,
                prediction_ids: predictionIds
            });
        }
    }
    return userPredctionIds;
}

function parseContestPredictionJoined(joinedTeamsCount) {
    let responseData = [];
    for (const prop in joinedTeamsCount) {
        
        if (hasOwnProperty.call(joinedTeamsCount, prop)) {
            if (joinedTeamsCount[prop] > 0) {
                responseData.push({
                    contest_id: prop,
                    count: joinedTeamsCount[prop]
                });
            }
        }
    }
    return responseData;
};

async function getLFRedisForMyTeamCount(keys) {
    try {
        return new Promise(async (resolve, reject) => {
            
            await redis.getRedisForLf(keys, function (err, teamCounts) {
                if (teamCounts) {
                    return resolve(teamCounts);
                } else {
                    return resolve(0);
                }
            })
        });
    } catch (error) {
        console.log('LF redis leaderboard > ', error);
    }
}