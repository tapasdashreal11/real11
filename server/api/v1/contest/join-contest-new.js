const config = require('../../../config');
const User = require('../../../models/user');
const Contest = require('../../../models/contest');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const Category = require('../../../models/category');
const PointSystem = require('../../../models/point-system');
const UserContestBreakup = require('../../../models/user-contest-breakup');
const ReferralCodeDetails = require('../../../models/user-referral-code-details');
const MyContestModel = require('../../../models/my-contest-model');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/transaction');
const PaymentOffers = require('../../../models/payment-offers');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const UserCouponCodes = require('../../../models/user-coupon-codes');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const AWS = require('aws-sdk');
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const Helper = require('./../common/helper');
const db = require('../../../db');

module.exports = async (req, res) => {
    try {
        console.log('IPL Join conest api *******************');
        let data1 = {};
        let startTime = Date.now();
        const user_id = req.userId;
        const { } = req.params;
        const { team_id, contest_id, series_id, match_id, sport } = req.body;
        let match_sport = sport ? parseInt(sport) : 1;

        let decoded = {
            match_id: parseInt(match_id),
            series_id: parseInt(series_id),
            contest_id: contest_id,
            user_id: user_id
        }

        var totalContestKey = 0;
        var mycontId = 0;
        if (match_id && series_id && contest_id && user_id) {
            let indianDate = Date.now();
            indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
            let apiList = [
                User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1, "extra_amount_date": 1, "extra_amount_date": 1, "perday_extra_amount": 1, "referal_code_detail": 1, "email": 1 }),
                SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }),
                PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }).countDocuments(),
                redis.getRedis('contest-detail-' + contest_id),
                MatchContest.findOne({ 'match_id': decoded['match_id'], 'sport': match_sport, 'contest_id': contest_id }),
                // redis.getRedis('match-contest-detail-' + decoded['match_id'] + '-' + contest_id)
            ];
            if (!team_id) {
                apiList.push(PlayerTeam.findOne({ 'user_id': user_id, 'match_id': decoded['match_id'], 'sport': match_sport, 'series_id': decoded['series_id'] }));
            }
            var results = await Promise.all(apiList);
            if (results && results.length > 0) {
                let authUser = results[0] ? results[0] : {};
                if (authUser) {
                    let liveMatch = results[1] ? results[1] : {};

                    if (liveMatch) {
                        let ctime = Date.now();
                        let mtime = liveMatch.time;
                        if (mtime < ctime) {
                            return res.send(ApiUtility.failed('Match has been started.'));
                        } else {
                            let teamId = team_id ? team_id : (results[5] && results[5]._id ? results[5]._id : '');
                            if (teamId && teamId != null && teamId != '') {
                                // console.log(teamId);return false;
                                let matchContest = results[4] ? results[4] : {};
                                if (!matchContest) {

                                    return res.send(ApiUtility.failed('Match Contest Not Found'));
                                }
                                let contestData = results[3] ? results[3] : '';
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
                                let joinedContestWithTeamCounts = results[2] ? results[2] : 0;
                                let maxTeamSize = 9;

                                if (joinedContestWithTeamCounts < maxTeamSize) {
                                    if (!playerTeamRes) {
                                        if ((!contestData.multiple_team && joinedContestWithTeamCounts >= 1) || ((contestData.multiple_team !== 'yes') && joinedContestWithTeamCounts >= 1)) {
                                            return res.send(ApiUtility.failed('Multiple Teams Not Allowed'));
                                        } else {
                                            try {
                                                await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: 1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true }).then(async function (doc) {
                                                    if (!doc)
                                                        return res.send(ApiUtility.failed("something went wrong!!."));
    
                                                    let incData = doc; //await MatchContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id });
                                                    let joinedContest1 = incData.joined_users;
                                                    console.log('counts*******joinedContest1', joinedContest1);
                                                    var mcCountResNew = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport,'series_id': series_id, 'contest_id': contest_id }).countDocuments();
    
                                                    if (contestData && contestData.contest_size < joinedContest1 && infinteStatus) {
                                                        console.log("Going in the last response ----------***********", contestData.contest_size, joinedContest1);
                                                        await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                        let response = {};
                                                        response.status = false;
                                                        response.message = "This contest is full, please join other contest.";
                                                        response.error_code = null;
                                                        return res.json(response);
                                                    }
    
                                                    let joinStatus = false;
    
                                                    joinStatus = joinedContest && (joinedContest < contestData.contest_size || contestData.infinite_contest_size == 1) ? true : (joinedContest == 0 ? true : false);
                                                    // console.log("joinStatus***", joinStatus); return false;
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
                                                        // console.log(contest); return false;
    
                                                        let useableBonusPer = contestData.used_bonus || 0;
                                                        let contestType = contestData.contest_type;
                                                        let entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                                                        // console.log(entryFee);
                                                        // return false;
                                                        try {
                                                            let cashAmount = 0;
                                                            let winAmount = 0;
                                                            let bonusAmount = 0;
                                                            let extraAmount = 0;
                                                            let remainingFee = 0;
                                                            let userWalletStatus = false;
    
                                                            if (matchContest.usable_bonus_time) {
                                                                if (moment().isBefore(matchContest.usable_bonus_time)) {
                                                                    useableBonusPer = matchContest.before_time_bonus;
                                                                } else {
                                                                    useableBonusPer = matchContest.after_time_bonus;
                                                                }
                                                            } else {
                                                                useableBonusPer = contestData.used_bonus || 0;
                                                            }
    
                                                            if (contestType == 'Paid') {
    
                                                                const paymentCal = await joinContestPaymentCalculation(useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount);
    
                                                                cashAmount = paymentCal.cashAmount;
                                                                winAmount = paymentCal.winAmount;
                                                                bonusAmount = paymentCal.bonusAmount;
                                                                extraAmount = paymentCal.extraAmount;
                                                                let saveData = paymentCal.saveData;
                                                                let perdayExtraAmount = paymentCal.perdayExtraAmount;
    
                                                                // console.log("******************* firstt *******************");return false;
                                                                if (Object.keys(saveData).length > 0) {
                                                                    let date = new Date();
                                                                    let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + user_id;
                                                                    userId = user_id;
                                                                    let txnId = joinContestTxnId;
                                                                    let status = TransactionTypes.JOIN_CONTEST;
                                                                    let txnAmount = entryFee;
                                                                    let withdrawId = 0;
                                                                    if (entryFee == (winAmount + cashAmount + bonusAmount + extraAmount)) {
                                                                        // Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId, contest_id, match_id);
    
                                                                        let cons_cash_balance = bonusAmount;
                                                                        let cons_winning_balance = winAmount;
                                                                        let cons_bonus_amount = cashAmount;
                                                                        let refund_cash_balance = null;
                                                                        let refund_winning_balance = null;
                                                                        let refund_bonus_amount = null;
                                                                        let extra_amount_date = indianDate;
                                                                        let perday_extra_amount = saveData['perday_extra_amount'] ? saveData['perday_extra_amount'] : perdayExtraAmount;
                                                                        let winning_balance = authUser['winning_balance'] - winAmount;
                                                                        let cash_balance = authUser['cash_balance'] - cashAmount;
                                                                        let bonus_balance = authUser['bonus_amount'] - bonusAmount;
                                                                        let extra_amount = authUser['extra_amount'] - extraAmount;
                                                                        let total_balance = winning_balance + cash_balance + bonus_balance + extra_amount;
    
                                                                        try {
                                                                            let updateUserData = {
                                                                                cons_winning_balance: cons_winning_balance,
                                                                                cons_cash_balance: cons_cash_balance,
                                                                                cons_bonus_amount: cons_bonus_amount,
                                                                                refund_winning_balance: refund_winning_balance,
                                                                                refund_cash_balance: refund_cash_balance,
                                                                                refund_bonus_amount: refund_bonus_amount,
                                                                                total_balance: total_balance,
                                                                                extra_amount_date: extra_amount_date,
                                                                                perday_extra_amount: perday_extra_amount
                                                                            }
    
                                                                            let entity = {
                                                                                user_id: userId,
                                                                                contest_id: contest_id,
                                                                                match_id: match_id,
                                                                                sport:match_sport,
                                                                                txn_amount: txnAmount,
                                                                                currency: "INR",
                                                                                txn_date: Date.now(),
                                                                                local_txn_id: txnId,
                                                                                added_type: parseInt(status)
                                                                            };
    
                                                                            let walletRes = await User.update({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } })
    
                                                                            if (walletRes && walletRes.nModified > 0) {
                                                                                await Transaction.create(entity);
                                                                                userWalletStatus = true;
                                                                            }
    
                                                                        } catch (error) {
                                                                            await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                            console.log('join contest amount deduct and transaction > ', error);
                                                                            let userWalletData = await User.findOne({ _id: user_id }, { "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1 });
                                                                            if (userWalletData) {
                                                                                userWalletData.winning_balance = (_.isNaN(userWalletData.winning_balance) || _.isNull(userWalletData.winning_balance)) ? 0 : userWalletData.winning_balance;
                                                                                userWalletData.cash_balance = (_.isNaN(userWalletData.cash_balance) || _.isNull(userWalletData.cash_balance)) ? 0 : userWalletData.cash_balance;
                                                                                userWalletData.bonus_amount = (_.isNaN(userWalletData.bonus_amount) || _.isNull(userWalletData.bonus_amount)) ? 0 : userWalletData.bonus_amount;
                                                                                userWalletData.extra_amount = (_.isNaN(userWalletData.extra_amount) || _.isNull(userWalletData.extra_amount)) ? 0 : userWalletData.extra_amount;
                                                                                await User.updateOne({ _id: user_id }, { $set: userWalletData });
                                                                            }
                                                                            return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                                        }
                                                                    } else {
                                                                        await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                        return res.send(ApiUtility.failed('Insufficient Balance!!'));
                                                                    }
                                                                } else {
                                                                    await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport,'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                    return res.send(ApiUtility.failed('something went wrong!!'));
    
                                                                }
                                                            }
                                                            let totalEntryAmount = cashAmount + winAmount + bonusAmount + extraAmount;
                                                            // console.log(totalEntryAmount);
                                                            // return false;
    
                                                            if (contestType == "Free" || (contestType == "Paid" && totalEntryAmount > 0 && totalEntryAmount == entryFee && userWalletStatus)) {
                                                                try {
                                                                    contest.bonus_amount = bonusAmount;
                                                                    contest.sport = match_sport;
                                                                    let getCountKey = 0;
    
                                                                    let playerTeamContestId = newContestId;
                                                                    if (contestType == "Paid" && totalEntryAmount == entryFee) {
                                                                        
                                                                        getCountKey = await Promise.all([
                                                                            //getContestCount(contest, user_id, match_id, series_id, contest_id,match_sport,liveMatch),
                                                                            getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId,match_sport,liveMatch),
                                                                            // MatchContest.updateOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: 1 } }),
                                                                            Contest.saveJoinContestDetail(decoded, bonusAmount, winAmount, cashAmount, newContestId, contestData, extraAmount,match_sport)
                                                                        ]);
                                                                    } else {
                                                                        getCountKey = await Promise.all([
                                                                            getContestCount(contest, user_id, match_id, series_id, contest_id,match_sport,liveMatch)
    
                                                                        ]);
                                                                    }
                                                                    var mcCountResNew = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'sport': match_sport,'series_id': series_id, 'contest_id': contest_id }).countDocuments();
                                                                    if (contestData.contest_size === mcCountResNew) {
                                                                        await MatchContest.updateOne({ _id: ObjectId(matchContest._id) }, { $set: { "is_full": 1 } });
                                                                    }
    
                                                                    totalContestKey = (getCountKey && getCountKey.length > 0) ? getCountKey[0] : 0;
                                                                    // console.log(totalContestKey,'***************** contest count ******************');
                                                                } catch (error) {
                                                                    await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport,'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                    console.log('save join contest > player_team_contest > ', error);
                                                                    return res.send(ApiUtility.failed(error.message));
                                                                }
                                                                // TODO: Save Contest
                                                                let playerContest = {};
                                                                playerContest.id = newContestId;
                                                                if (playerContest.id) {
    
                                                                    if (contestData) {
                                                                        // var isAutoCreateStatus   =   (contestData.auto_create && contestData.auto_create.includes("yes")) ? true : false;
                                                                        var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
                                                                        // if (contestData.auto_create && contestData.auto_create == "yes") {
                                                                        if (isAutoCreateStatus) {
                                                                        
                                                                            //var mcCountRes = await MatchContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id, 'series_id': series_id });
                                                                            var mcCountRes = await PlayerTeamContest.find({ 'match_id': decoded['match_id'],'sport': match_sport, 'series_id': series_id, 'contest_id': contest_id }).countDocuments();
                                                                            //if (mcCountRes && mcCountRes._id) {
                                                                                console.log('join contest auto create ****** ',mcCountRes,contestData.contest_size);
                                                                            if (mcCountRes == contestData.contest_size) {
                                                                                const autores = await Promise.all([
                                                                                    MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport,'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } }),
                                                                                    contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId,match_sport,liveMatch)
                                                                                ]);
                                                                               
                                                                            }
                                                                        }
                                                                        let joinedTeamsCountKey = `${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`;
                                                                        redis.getRedis(joinedTeamsCountKey, (err, data) => {
                                                                            if (data) {
                                                                                let userContests = data;
                                                                                if (userContests[contest_id]) {
                                                                                    userContests[contest_id] = joinedContest + 1;
                                                                                } else {
                                                                                    userContests[contest_id] = joinedContest + 1;
                                                                                }
                                                                                data = userContests;
                                                                            } else {
                                                                                data = {}
                                                                                data[contest_id] = joinedContest + 1;
                                                                            }
                                                                            mqtt.publishContestTeamCounts(match_id, JSON.stringify(data));
                                                                            redis.setRedis(joinedTeamsCountKey, data);
                                                                        });
    
                                                                        let joinedContestCountData = {};
                                                                        joinedContestCountData[contest_id] = joinedContest + 1;
                                                                        mqtt.publishContestTeamCounts(match_id, JSON.stringify(joinedContestCountData));
    
                                                                        redis.redisObj.get('user-teams-count-' + match_id + '-' + match_sport +  '-' + user_id, (err, data) => {
                                                                            let count = (data) ? parseInt(data) : 1;
                                                                            // mqtt.publishUserJoinedTeamCounts(match_id,user_id,JSON.stringify({team_count:count}))
                                                                            redis.redisObj.del('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id) //force user to get data from db
                                                                        });
    
                                                                        let joinedContestKey = `${RedisKeys.CONTEST_JOINED_LIST}${series_id}-${match_id}-${user_id}`;
                                                                        redis.redisObj.del(joinedContestKey); //force user to get data from db
                                                                        console.log("************ Set my matches in redis ************")
                                                                        // console.log('**********************',totalContestKey, '****************');
                                                                        try {
                                                                            //console.log("user_id", user_id, decoded['match_id'])
                                                                            let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id +"_"+match_sport;
                                                                            var datsse = moment().subtract('30', 'days').toDate();
                                                                            let filterm = {
                                                                                "user_id": user_id,
                                                                                "createdAt": { $gte: datsse }
                                                                            };
                                                                            let sortm = { createdAt: -1 }
                                                                            let serverTimeu = moment(Date.now()).format(config.DateFormat.datetime);
                                                                            redis.getRedis(matchContestUserKey, function (err, contestData) { // Get Redis
                                                                                if (!contestData) {
                                                                                    getMatchRedisData(0, { "user_id": user_id, "pagesize": 25 }, {}, sortm, match_sport, function (results) {
                                                                                        results['server_time'] = serverTimeu;
                                                                                        redis.setRedis(matchContestUserKey, results);
                                                                                    })
                                                                                } else {
                                                                                    SeriesSquad.findOne({ 'match_id': parseInt(match_id), 'sport': match_sport, 'series_id': parseInt(series_id) }).then(function (data) {
                                                                                        let conIndex = _.findIndex(contestData.upcoming_match, { "match_id": decoded['match_id'] });
                                                                                        if (conIndex < 0) {
                                                                                            var newLiveArray = {
                                                                                                "_id": mycontId || 0,
                                                                                                "match_id": parseInt(match_id),
                                                                                                "series_id": parseInt(series_id),
                                                                                                "match_status": "Not Started",
                                                                                                "local_team_id": parseInt(data.localteam_id),
                                                                                                "local_team_name": data.localteam_short_name || data.localteam,
                                                                                                // "local_team_flag": config.imageBaseUrl + data.local_flag || "",
                                                                                                "visitor_team_id": parseInt(data.visitorteam_id),
                                                                                                "visitor_team_name": data.visitorteam_short_name || data.visitorteam,
                                                                                                // "visitor_team_flag": config.imageBaseUrl + data.local_flag || "",
                                                                                                "local_team_flag": data.local_flag ? config.imageBaseUrl + '/' + data.local_flag : "",
                                                                                                "visitor_team_flag": data.visitor_flag ? config.imageBaseUrl + '/' + data.visitor_flag : "",
                                                                                                "series_name": data.series_name,
                                                                                                "star_date": moment(data.time).format("YYYY-MM-DD"),
                                                                                                "star_time": moment(data.time).format("HH:mm"),
                                                                                                "server_time": serverTimeu,
                                                                                                "sort_time": data.time,
                                                                                                // "total_contest": totalContestKey
                                                                                            };
    
                                                                                            if (totalContestKey > 0) {
                                                                                                newLiveArray['total_contest'] = totalContestKey;
                                                                                            }
    
                                                                                            contestData.upcoming_match.push(newLiveArray);
    
                                                                                            var newContDataSort = _.sortBy(contestData.upcoming_match, ['sort_time', 'desc']);
    
                                                                                            contestData.upcoming_match = newContDataSort;
                                                                                            contestData['server_time'] = serverTimeu;
    
                                                                                            redis.setRedis(matchContestUserKey, contestData);
    
                                                                                        } else {
                                                                                            if (totalContestKey > 0) {
                                                                                                contestData.upcoming_match[conIndex]['total_contest'] = totalContestKey;
                                                                                            }
    
                                                                                            var newContDataSort = _.sortBy(contestData.upcoming_match, ['sort_time', 'desc']);
                                                                                            contestData.upcoming_match = newContDataSort;
                                                                                            contestData['server_time'] = serverTimeu;
                                                                                            redis.setRedis(matchContestUserKey, contestData);
                                                                                        }
                                                                                    });
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            console.log("updateing redis > join contest  > ", error);
                                                                            return res.send(ApiUtility.failed(error.message));
                                                                        }
                                                                        // add bonus cash to user who shared his/her referal code
    
                                                                        return res.send(ApiUtility.success(data1, 'Contest Joined successfully.'));
                                                                    }
                                                                } else {
                                                                    return res.send(ApiUtility.failed("Some error."));
                                                                }
                                                            } else {
                                                                console.log("check balance error. ");
                                                                await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport,'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                return res.send(ApiUtility.failed("Something went wrong!!"));
                                                            }
                                                        } catch (error) {
                                                            await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'sport': match_sport,'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true })
                                                            console.log("join contest condition true > ", error);
                                                            return res.send(ApiUtility.failed(error.message));
                                                        }
                                                    } else {
                                                        let response = {};
                                                        await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'sport': match_sport, 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                        var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id,'sport': match_sport, is_full: { $ne: 1 } }).sort({ _id: -1 });
    
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
                                                });
    
                                            } catch (errorr111) {
                                                return res.send(ApiUtility.failed("Something went wrong!!."));
                                            }
                                        }
                                        
                                    } else {
                                        return res.send(ApiUtility.failed("Already Joined Contest."));
                                    }
                                } else {
                                    return res.send(ApiUtility.failed("You can not add more than 9 teams."));
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


async function getContestCount(contest, user_id, match_id, series_id, contest_id,contestData, parentContestId,match_sport,liveMatch){
    try {
        return new Promise(async (resolve, reject) => {    
            PlayerTeamContest.create(contest).then((newPTC) => {
                

                let redisKey = 'user-contest-joinedContestIds-' + user_id + '-' + match_id + '-' + match_sport;
                redis.getRedis(redisKey, (err, data) => {
                    if (data) {
                        let userContests = data;
                        userContests.push(contest_id);
                        data = userContests;
                    } else {
                        data = [contest_id];
                    }
                    var uniqueContestIds = data.filter((value, index, self) => {
                        return self.indexOf(value) === index;
                    });
                    var newMyModelobj = {
                        'match_id': match_id,
                        "series_id": series_id,
                        "contest_id": contest_id,
                        "user_id": user_id,
                        "sport": match_sport,
                        "player_team_contest_id": newPTC._id,
                        "match_status": 'Not Started',
                        "total_contest": uniqueContestIds.length
                        //'$inc' : { "total_contest": 1 }
                    }

                    totalContestKey = uniqueContestIds.length
                    MyContestModel.findOneAndUpdate({ match_id: match_id,sport: match_sport, user_id: user_id }, newMyModelobj, { upsert: true, new: true }).then((MyContestModel) => {
                    
                        mycontId = MyContestModel._id || 0;
                    });
                    mqtt.publishUserJoinedContestCounts(match_id, user_id, JSON.stringify({ contest_count: uniqueContestIds.length }))
                    redis.setRedis(redisKey, data);
                    return resolve(totalContestKey);
                });
               
            });
        })
    } catch (error) {
     //console.log("error getContestCount", error)   
    }
}


async function contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId,match_sport,liveMatch) {
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
        entity.created = new Date();
        if (parentContestId) {
            entity.parent_id = parentContestId;
        } else {
            entity.parent_id = contestData._id;
        }
        entity.is_auto_create = 2;
        // console.log('cResult************** before');
        const cResult = await Contest.create(entity);
        // return false;
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
            entityM.invite_code = '1Q' + Math.random().toString(36).slice(-6);
            entityM.created = new Date();
            entityM.localteam = liveMatch.localteam || '';
            entityM.localteam_id = liveMatch.localteam_id || '';
            entityM.visitorteam = liveMatch.visitorteam || '';
            entityM.visitorteam_id = liveMatch.visitorteam_id || '';
            entityM.is_auto_create = 1;
            entityM.admin_create = 0;
            entityM.joined_users = 0;
            entityM.sport = match_sport;
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
                breakup: contestData.breakup
            };


            const dd = await MatchContest.create(entityM);
           


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
                console.log('eorr in auto create redis***');
            }


            return cResult;
        } else {
            console.log('something went wrong autocreate***************************wrong in auto crete');
            return {}
        }

    } catch (error) {
        console.log('sometjhing went wrong in autocreate***************************wrong in auto error');
        return {}
    }



}
/**
 * This is used to payment calculation before join paid contest
 * @param {*} useableBonusPer 
 * @param {*} authUser 
 * @param {*} entryFee 
 * @param {*} winAmount 
 * @param {*} cashAmount 
 * @param {*} bonusAmount 
 * @param {*} extraAmount 
 */
async function joinContestPaymentCalculation(useableBonusPer, authUser, entryFee, winAmount, cashAmount, bonusAmount, extraAmount) {
    let useAmount = (useableBonusPer / 100) * entryFee;
    let saveData = {};
    let indianDate = Date.now();
    indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));

    if (authUser.bonus_amount && authUser.bonus_amount > 0) {
        if (useAmount <= authUser.bonus_amount) {
            remainingFee = entryFee - useAmount;
            saveData['bonus_amount'] = authUser.bonus_amount - useAmount;
            bonusAmount = useAmount;
        } else {
            remainingFee = entryFee - authUser.bonus_amount;
            saveData['bonus_amount'] = 0;
            bonusAmount = authUser.bonus_amount;
        }
    } else {
        remainingFee = entryFee;
    }

    let perdayExtraAmount = 0;
    if (remainingFee) {
        let extraBalance = authUser.extra_amount || 0;
        // console.log(extraBalance,'extra amount');
        let extraBal = 0;
        if (extraBalance && extraBalance > 0) {
            let perDayExtraAmt = 0;
            let perDayLimit = config.extra_bonus_perday_limit;
            if (String(authUser.extra_amount_date) == String(indianDate)) {
                perDayExtraAmt = authUser.perday_extra_amount;
            }
            // console.log(perDayExtraAmt, "perDayExtraAmt");
            let saveData = {};
            if (perDayExtraAmt < perDayLimit) {
                extraAmount = (extraBalance > remainingFee) ? remainingFee : extraBalance;
                extraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - perDayExtraAmt) : extraAmount;
                extraBal = (extraBalance > remainingFee) ? extraBalance - extraAmount : 0;

                remainingFee = (extraBalance < remainingFee && extraAmount < remainingFee) ? (extraAmount < remainingFee ? remainingFee - extraAmount : remainingFee - extraBalance) : remainingFee - extraAmount;

                saveData['extra_amount'] = extraBal;
                saveData['extra_amount_date'] = indianDate;
                perdayExtraAmount = ((perDayExtraAmt + extraAmount) > perDayLimit) ? (perDayLimit - extraAmount) : (perDayExtraAmt + extraAmount);
                saveData['perday_extra_amount'] = perdayExtraAmount;
            } else {
                perdayExtraAmount = perDayExtraAmt;
                saveData['perday_extra_amount'] = perdayExtraAmount;
            }
        } else {
            // remainingFee = entryFee;
            saveData['extra_amount'] = extraBal;
        }
        saveData['perday_extra_amount'] = perdayExtraAmount;
        saveData['extra_amount'] = extraBal;
    }
    // console.log('remaining fee', remainingFee, 'extraAmount', extraAmount);
    if (remainingFee) {
        let cashBalance = authUser.cash_balance;

        if (cashBalance) {
            let cashBal = (cashBalance > remainingFee) ? cashBalance - remainingFee : 0;
            cashAmount = (cashBalance > remainingFee) ? remainingFee : cashBalance;
            remainingFee = (cashBalance < remainingFee) ? remainingFee - cashBalance : 0;
            saveData['cash_balance'] = cashBal;
        }
    }

    if (remainingFee) {
        winningBal = authUser.winning_balance;
        if (winningBal) {
            winningBal1 = (winningBal > remainingFee) ? winningBal - remainingFee : 0;
            winAmount = (winningBal > remainingFee) ? remainingFee : winningBal;
            remainingFee = (winningBal < remainingFee) ? remainingFee - winningBal : 0;
            saveData['winning_balance'] = winningBal1;
        }
    }
    return { 'winAmount': winAmount, 'cashAmount': cashAmount, 'bonusAmount': bonusAmount, 'extraAmount': extraAmount, 'saveData': saveData, 'perdayExtraAmount': perdayExtraAmount };

}

function getMatchRedisData(skip, decoded, filter, sort, sport, cb) {
    try {
        var datsse = moment().subtract('10', 'days').toDate();
        asyncp.parallel({
            upcoming_match: function (callback) {
                filter = {
                    "user_id": decoded.user_id,
                };
                getMyContestList(skip, decoded.pagesize, filter, 'upcoming', sort, sport, callback);
            },
            live_match: function (callback) {
                filter = {
                    "$and": [
                        { "user_id": decoded.user_id },
                    ]
                };
                getMyContestList(skip, decoded.pagesize, filter, 'live', sort, sport, callback);
            },
            completed_match: function (callback) {
                callback(null, []);
            }
        },
            function (err, results) {
                if (err) {
                    return res.send(ApiUtility.failed("Server error"));
                } else {
                    cb(results);
                }
            });
    } catch (error) {
        //console.log("error", error)
    }
}

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        var data = await (new ModelService(MyContestModel)).myContestModel(skip, pagesize, sort, filter, sport, type);
        callback(null, data)
    } catch (error) {
        //console.log("error",error)
    }
}