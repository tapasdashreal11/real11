const config = require('../../config');
const User = require('../../models/user');
const Contest = require('../../models/contest');
const SeriesSquad = require('../../models/series-squad');
const MatchContest = require('../../models/match-contest');
const PlayerTeam = require('../../models/player-team');
const PlayerTeamContest = require('../../models/player-team-contest');
const Category = require('../../models/category');
const PointSystem = require('../../models/point-system');
const UserContestBreakup = require('../../models/user-contest-breakup');
const ReferralCodeDetails = require('../../models/user-referral-code-details');
const MyContestModel = require('../../models/my-contest-model');
const ApiUtility = require('../api.utility');
const Transaction = require('../../models/transaction');
const PaymentOffers = require('../../models/payment-offers');

const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const UserCouponCodes = require('../../models/user-coupon-codes');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../constants/app');
const ModelService = require("../ModelService");
const asyncp = require("async");
const _ = require("lodash");
const AWS = require('aws-sdk');
const redis = require('../../../lib/redis');
const mqtt = require('../../../lib/mqtt');
const Helper = require('./common/helper');
const db = require('../../db');
const { startSession } = require('mongoose');
const CouponSale = require("../../models/coupon-sale");

var imageurl = config.imageBaseUrl;

async function getMyContestList(skip, pagesize, filter, type, sort, sport, callback) {
    try {
        var data = await (new ModelService(MyContestModel)).myContestModel(skip, pagesize, sort, filter, sport, type);
        callback(null, data)
    } catch (error) {
        //console.log("error",error)
    }
}

async function switchTeamFn(id, team_id,count) {
    try {
        if(!_.isNull(team_id) && !_.isNull(id)){
            await PlayerTeamContest.findByIdAndUpdate(ObjectId(id), { "player_team_id": team_id,"team_count":count }, { new: true });
        }
        
    } catch (error) {

    }
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

async function updateMyContestModelTTT(sqs, status, cb) {
    try {
        if (sqs.length > 0) {
            var tttt = {
                "player_team_contest_id": sqs[0]._id,
                "match_id": sqs[0].match_id,
                "series_id": sqs[0].series_id,
                "contest_id": sqs[0].contest_id,
                "user_id": sqs[0].user_id,
                "match_status": status,
            };
            var mctdata = await MyContestModel.updateOne({ match_id: sqs[0].match_id, user_id: sqs[0].user_id }, tttt, { upsert: true });
            sqs.splice(0, 1)
            updateMyContestModelTTT(sqs, status, cb)
        } else {
            cb('done')
        }
    } catch (error) {
        ////////console.log("error8989", error)
    }
}

async function updateMyContestModel(sq, i, cb) {
    try {
        if (sq.length > 0) {
            var ptiData = await PlayerTeamContest.find({ "match_id": sq[0].match_id, "series_id": sq[0].series_id })
            if (ptiData.length > 0) {
                updateMyContestModelTTT(ptiData, sq[0].match_status, function (resss) {
                    i++
                    sq.splice(0, 1);
                    updateMyContestModel(sq, i, cb)
                })
            } else {
                i++
                sq.splice(0, 1);
                updateMyContestModel(sq, i, cb)
            }

        } else {
            cd('done')
        }
    } catch (error) {

    }
}

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

const getAllTeamsByMatchIdRedis = async (match_id, contest_id, user_id) => {
    let leaderboardRedis = 'leaderboard-' + match_id + '-' + contest_id

    return new Promise(async (resv, rej) => {
        await redis.getRedisLeaderboard(leaderboardRedis, function (err, reply) {
            if (!err) {
                const result = reply.reduce((index, obj) => {
                    if (obj.user_id != user_id && index.length < 100)
                        index.push(obj);
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
    addBulkContestMatch: async (req, res) => {
        try {
            var datsse = moment().subtract('30', 'days').toDate();
            var filter = { "date": { $gte: datsse } };

            var sq = await SeriesSquad.find(filter).sort({ "date": -1 });

            updateMyContestModel(sq, 0, function (tt) {
                return res.send(ApiUtility.success(tt));
            });

        } catch (error) {
            // console.log("error", error)
        }
    },
    contestList: async (req, res) => {
        try {
            const { match_id,sport } = req.params;
            const user_id = req.userId;
            let match_sport = sport ? parseInt(sport) : 1;
            let filter = {
                "match_id": parseInt(match_id),
                "sport":match_sport,
                is_full: { $ne: 1 }
            }; 
            // console.log("***start*****", req.params);return false;
            const match_contest_data = await (new ModelService(Category)).getMatchContest({ status: 1 }, filter, user_id, 5);
            let myTeamsCount = 0;
            let myContestCount = 0;

            if (user_id) {
                myTeamsCount = await PlayerTeam.find({ user_id: user_id, match_id: match_id,sport: match_sport}).countDocuments();
                    myContestCount = await PlayerTeamContest.aggregate([{
                        $match: { user_id: user_id, match_id: parseInt(match_id),sport: match_sport }
                    },
                    {
                        $group: { _id: "$contest_id", count: { $sum: 1 } }
                    }
                ]);
                redis.redisObj.set('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, myTeamsCount);
                redis.redisObj.set('user-contest-count-' + match_id + '-' + match_sport + '-' + user_id, myContestCount.length);
            }

            let userTeamIds = {};
            let joinedContestIds = [];
            let joinedTeamsCount = {};
            for (const matchContests of match_contest_data) {
                for (const contest of matchContests.contests) {
                    joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                    if (contest.my_team_ids && contest.my_team_ids.length > 0) {
                        userTeamIds[contest.contest_id] = contest.my_team_ids;
                    }
                }
            }

            joinedContestIds = _.map(myContestCount, '_id');
            
            redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
            redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(Helper.parseUserTeams(userTeamIds)));
            
            redis.redisObj.set('user-contest-joinedContestIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(joinedContestIds));
            redis.setRedis(RedisKeys.MATCH_CONTEST_LIST + req.params.match_id, match_contest_data);
            // console.log("joined_teams_count1111111", joinedContestIds)
            var finalResult = ApiUtility.success({
                match_contest: match_contest_data,
                my_teams: myTeamsCount,
                my_contests: myContestCount.length,
                joined_contest_ids: joinedContestIds,
                user_team_ids: Helper.parseUserTeams(userTeamIds),
                joined_teams_count: Helper.parseContestTeamsJoined(joinedTeamsCount)
            });
            res.send(finalResult);
        } catch (error) {
            // consolelog("error", error)
            res.send(ApiUtility.failed(error.message));
        }
    },
    joinedContestMatches: async (req, res) => {
        try {
            let data1 = {};
            const { pagesize, page, is_complete } = req.params;
            let user_id = req.userId;
            let decoded = {
                user_id: user_id,
                pagesize: (pagesize) ? parseInt(pagesize) : 25,
                page: (page) ? parseInt(page) : 1,
                is_complete: is_complete || "false"
            }
            // set server Time Start
            let serverTime = moment(Date.now()).format(config.DateFormat.datetime);
            let serverTimeForalc = moment().utc().toDate();

            if (decoded) {
                let currentDate = moment().utc().toDate();
                let oneMonthDate = moment().utc().add('30', 'days').toDate();
                let pastMonthDate = moment().utc().subtract('60', 'days').toDate();
                // ////////console.log("decoded",decoded);
                if (decoded['user_id']) {

                    let sort = { "createdAt": -1 }
                    let skip = (decoded.page - 1) * (decoded.pagesize);
                    let sport = 1;
                    var datsse = moment().subtract('30', 'days').toDate();
                    let filter = {};

                    // console.log(skip, decoded, filter, sort, sport, datsse)


                    let matchContestKey = RedisKeys.MY_MATCHES_LIST + user_id;
                    if (decoded.is_complete == 'true') {
                        asyncp.parallel({
                            upcoming_match: function (callback) {
                                callback(null, []);
                            },
                            live_match: function (callback) {
                                callback(null, []);
                            },
                            completed_match: function (callback) {
                                filter = {
                                    "$and": [
                                        { "user_id": user_id },
                                    ]
                                };
                                getMyContestList(skip, decoded.pagesize, filter, 'completed_match', sort, sport, callback);
                            }
                        },
                            function (err, results) {
                                if (err) {
                                    return res.send(ApiUtility.failed("Server error"));
                                } else {
                                    results['server_time'] = serverTime;
                                    return res.send(ApiUtility.success(results));
                                }
                            });
                    } else {
                        redis.getRedis(matchContestKey, function (err, contestData) { // Get Redis 
                            if (!contestData) {
                                getMatchRedisData(skip, decoded, filter, sort, sport, function (results) {
                                    results['server_time'] = serverTime;
                                    redis.setRedis(matchContestKey, results); // Set Redis                                
                                    return res.send(ApiUtility.success(results));
                                })
                            } else {
                                var newLiveArray = JSON.parse(JSON.stringify(contestData))
                                var contestDataUp = newLiveArray.upcoming_match.length;
                                if (contestDataUp > 0) {
                                    let key = 0;
                                    _.forEach(newLiveArray.upcoming_match, function (i, k) {
                                        if (i && moment(i.sort_time).toDate() < serverTimeForalc) {
                                            i["match_status"] = 'In Progress';
                                            newLiveArray.live_match.unshift(i);
                                            newLiveArray.upcoming_match.splice(k, 1)
                                        }
                                        key++;
                                    })
                                    if (key === contestDataUp) {
                                        newLiveArray['server_time'] = serverTime;
                                        console.log("contestDataUp-af", newLiveArray.upcoming_match.length, newLiveArray.live_match.length)
                                        redis.setRedis(matchContestKey, newLiveArray); // Set Redis
                                        return res.send(ApiUtility.success(newLiveArray));
                                    }
                                } else {
                                    contestData['server_time'] = serverTime;
                                    return res.send(ApiUtility.success(contestData));
                                }
                            }
                        });
                    }

                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed('Please check user id is blank.'));
            }
        } catch (error) {
            //////////consolelog(error);
            res.send(ApiUtility.failed(error.message));
        }
    },
    joinContestWalletAmount: async (req, res) => {
        try {
            let data = {};
            let data1 = {};
            //let sport = 1;
            let setting = config;
            let matchContestData = {}; 
            const { contest_id, entry_fee, match_id , series_id,sport } = req.body;
            let decoded = {
                user_id: req.userId,
                contest_id: contest_id || '',
                entry_fee: entry_fee,
                match_id: match_id,
                series_id:series_id
            }
            let match_sport = sport ? parseInt(sport) : 1;
            let match_series_id = series_id ? parseInt(series_id) : 1;
            let youtuber_code = 0;
            let is_offer_applied = false;
            let couponSaleData = [];
            // //////console.log(req.userId);
            let userdata = await User.findOne({ _id: decoded['user_id'] })
            if (userdata) {
                adminPer = 0; //(setting.admin_percentage) ? setting.admin_percentage : 0;
                let useableBonusPer = adminPer;
                let entryFee = 0;
                if (decoded['contest_id']) {
                    let contestData = await Contest.findOne({ '_id': decoded['contest_id'] });
                    const cSaleData = await CouponSale.findOne({user_id:ObjectId(req.userId),status: 1,expiry_date:{$gte:new Date()} });
                    //console.log("cSaleData***",cSaleData);
                     matchContestData = await MatchContest.findOne({ 'contest_id': decoded['contest_id'],sport: match_sport, match_id: match_id });
                     entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                     if(cSaleData && cSaleData._id){
                        couponSaleData =cSaleData.coupon_credit > cSaleData.coupon_used ? cSaleData.coupon_contest_data:[]; 
                     }
                    if (matchContestData && matchContestData.usable_bonus_time) {
                        //////console.log("matchInviteCode", matchContest, moment().isBefore(matchContest.usable_bonus_time))
                        if (moment().isBefore(matchContestData.usable_bonus_time)) {
                            useableBonusPer = matchContestData.before_time_bonus;
                        } else {
                            useableBonusPer = matchContestData.after_time_bonus;
                        }
                    } else {
                        useableBonusPer = (contestData && contestData.used_bonus) ? contestData.used_bonus : 0;
                    }

                    if (useableBonusPer == '') {
                        useableBonusPer = adminPer;
                    }
                    youtuber_code = matchContestData && matchContestData.youtuber_code ? matchContestData.youtuber_code: 0;
                    data['youtuber_code'] = youtuber_code;
                    data['contest_shareable'] = contestData && contestData.contest_shareable ? contestData.contest_shareable : 0;
                } else {
                    entryFee = decoded['entry_fee'];
                }
                let useAmount = eval((useableBonusPer / 100) * entryFee);
                // ////////console.log(useAmount);
                let usableAmt = 0;
                let extraAmount = 0;
                let cashBalance = 0;
                let winningBalance = 0;
                let redisKeyForRentation = 'app-analysis-' + decoded['user_id'] + '-' + decoded['match_id'] + '-' + match_sport;
                let userOfferAmount = 0;
                let retention_bonus_amount =0;
                let calEntryFees = entryFee;
                try {
                    redis.getRedisForUserAnaysis(redisKeyForRentation, async (err, rdata) => {
                        // console.log('couponSaleData****',couponSaleData,"matchContestData.category_id",matchContestData.category_id);
                        let catid = matchContestData.category_id;
                        if(couponSaleData && couponSaleData.length>0){
                            couponSaleData = couponSaleData.map(item => {
                                let container = {};
                                container.category_id = ObjectId(item.category_id);
                                container.offer_data = item.offer_data;
                                return container;
                            });
                            let  constestIdsData  =  _.find(couponSaleData,{category_id:ObjectId(catid)});
                            if(constestIdsData && constestIdsData.category_id){
                               let offDataArray = constestIdsData.offer_data;
                               // console.log('constestIdsData****',constestIdsData);
                               let offDataItem = _.find(offDataArray,{amount:entryFee});
                                  if(offDataItem){
                                   // console.log('offDataItem****',offDataItem);
                                   userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                   calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                   retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                  }
                                   
                             }
                           } 
                           if (rdata && entryFee>0 && userOfferAmount ==0) {
                            // console.log('popup redis before join contest *********');
                            userOfferAmount = rdata.is_offer_type == 1 ? rdata.offer_amount:eval((rdata.offer_percent/100)*entryFee);
                            let pContestId = contest_id; //ObjectId(contest_id);
                            let offerContests = rdata.contest_ids || [];
                            let prContestId = matchContestData && matchContestData.parent_contest_id ? String(matchContestData.parent_contest_id):pContestId;
                            let cBonus =  rdata && rdata.contest_bonous?rdata.contest_bonous:[];  //config && config.contest_bonous ? config.contest_bonous:[];
                            let cBonusItem = {};
                            if(rdata.is_offer_type == 3){
                                cBonusItem =  cBonus.find(function(el){
                                    if(ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))){
                                        return el
                                    }
                                });
                            }
                            if((userOfferAmount > 0 && rdata.is_offer_type === 1) || (userOfferAmount > 0 && rdata.is_offer_type == 2 && offerContests.length > 0  && (_.includes(offerContests,pContestId) || _.includes(offerContests,prContestId)))){
                                calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                
                            } else if(rdata.is_offer_type == 3 && cBonusItem && cBonusItem.contest_id ){
                                userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                is_offer_applied = true;
                            }    
                        }
                        
                         
                        if (userdata) {
                            if (decoded['contest_id']) {
                                if(retention_bonus_amount > 0){
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
                        data1 = data;
                        res.send(ApiUtility.success(data1)); 
                    });
                } catch (err) {
                    consolelog('error in catch block in cache****',err);
                    return res.send(ApiUtility.failed("Something went wrong!!"));
                }
                
            } else {
                return res.send(ApiUtility.failed("User not found."));
            }
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    joinContestWalletAmountMultiple: async (req, res) => {
        try {
            let data = {};
            let data1 = {};
            let setting = config;
            let matchContestData = {}; 
            const { total_team, contest_id, entry_fee, match_id , series_id, sport } = req.body;
            let decoded = { user_id: req.userId, contest_id: contest_id || '', entry_fee: entry_fee, match_id: match_id, series_id:series_id
            }
            let match_sport = sport ? parseInt(sport) : 1;
            let total_team_number = total_team ? parseInt(total_team) : 1;
            let match_series_id = series_id ? parseInt(series_id) : 1;
            let youtuber_code = 0;
            let is_offer_applied = false;
            let couponSaleData = [];
            let userdata = await User.findOne({ _id: decoded['user_id'] })
            if (userdata) {
                adminPer = 0; //(setting.admin_percentage) ? setting.admin_percentage : 0;
                let useableBonusPer = adminPer;
                let entryFee = 0;
                let totalCouponsToBeUsed =1;
                if (decoded['contest_id']) {
                    let contestData = await Contest.findOne({ '_id': decoded['contest_id'] });
                    const cSaleData = await CouponSale.findOne({user_id:ObjectId(req.userId),status: 1,expiry_date:{$gte:new Date()} });
                    
                     matchContestData = await MatchContest.findOne({ 'contest_id': decoded['contest_id'],sport: match_sport, match_id: match_id });
                     entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                     if(cSaleData && cSaleData._id){
                        couponSaleData =cSaleData.coupon_credit > cSaleData.coupon_used ? cSaleData.coupon_contest_data:[]; 
                        if(cSaleData.coupon_credit > cSaleData.coupon_used){
                          let couponRemainsCount   = cSaleData.coupon_credit - cSaleData.coupon_used;
                          console.log('couponRemainsCount***',couponRemainsCount,total_team_number);
                          totalCouponsToBeUsed = couponRemainsCount > total_team_number ? total_team_number: couponRemainsCount;
                        }
                     }
                    if (matchContestData && matchContestData.usable_bonus_time) {
                        if (moment().isBefore(matchContestData.usable_bonus_time)) {
                            useableBonusPer = matchContestData.before_time_bonus;
                        } else {
                            useableBonusPer = matchContestData.after_time_bonus;
                        }
                    } else {
                        useableBonusPer = (contestData && contestData.used_bonus) ? contestData.used_bonus : 0;
                    }

                    if (useableBonusPer == '') {
                        useableBonusPer = adminPer;
                    }
                    youtuber_code = matchContestData && matchContestData.youtuber_code ? matchContestData.youtuber_code: 0;
                    data['youtuber_code'] = youtuber_code;
                    data['contest_shareable'] = contestData && contestData.contest_shareable ? contestData.contest_shareable : 0;
                } else {
                    entryFee = decoded['entry_fee'];
                }
                let useAmountCal = eval((useableBonusPer / 100) * entryFee);
                let useAmount = eval(useAmountCal * total_team_number);
                let usableAmt = 0;
                let extraAmount = 0;
                let cashBalance = 0;
                let winningBalance = 0;
                let redisKeyForRentation = 'app-analysis-' + decoded['user_id'] + '-' + decoded['match_id'] + '-' + match_sport;
                let userOfferAmount = 0;
                let retention_bonus_amount =0;
                let calEntryFees = entryFee * total_team_number;
                let totalEntryFee = entryFee * total_team_number;
                try {
                    redis.getRedisForUserAnaysis(redisKeyForRentation, async (err, rdata) => {
                        let catid = matchContestData.category_id;
                        if(couponSaleData && couponSaleData.length>0){
                            couponSaleData = couponSaleData.map(item => {
                                let container = {};
                                container.category_id = ObjectId(item.category_id);
                                container.offer_data = item.offer_data;
                                return container;
                            });
                            let  constestIdsData  =  _.find(couponSaleData,{category_id:ObjectId(catid)});
                            if(constestIdsData && constestIdsData.category_id){
                               let offDataArray = constestIdsData.offer_data;
                               let offDataItem = _.find(offDataArray,{amount:entryFee});
                                  if(offDataItem){
                                   userOfferAmount = offDataItem.offer ? offDataItem.offer : 0;
                                   console.log('totalCouponsToBeUsed before***',totalCouponsToBeUsed,userOfferAmount);
                                   userOfferAmount = userOfferAmount * totalCouponsToBeUsed;
                                   console.log('totalCouponsToBeUsed***',totalCouponsToBeUsed,userOfferAmount);
                                   calEntryFees = userOfferAmount > entryFee ? 0: (entryFee - userOfferAmount );
                                   retention_bonus_amount = userOfferAmount > entryFee ? entryFee: userOfferAmount;
                                  }
                                   
                             }
                           } 
                           if (rdata && entryFee>0 && userOfferAmount ==0) {
                            userOfferAmount = rdata.is_offer_type == 1 ? rdata.offer_amount:eval((rdata.offer_percent/100)*entryFee);
                            let pContestId = contest_id; //ObjectId(contest_id);
                            let offerContests = rdata.contest_ids || [];
                            let prContestId = matchContestData && matchContestData.parent_contest_id ? String(matchContestData.parent_contest_id):pContestId;
                            let cBonus =  rdata && rdata.contest_bonous?rdata.contest_bonous:[];  //config && config.contest_bonous ? config.contest_bonous:[];
                            let cBonusItem = {};
                            if(rdata.is_offer_type == 3){
                                cBonusItem =  cBonus.find(function(el){
                                    if(ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))){
                                        return el
                                    }
                                });
                            }
                            if((userOfferAmount > 0 && rdata.is_offer_type === 1) || (userOfferAmount > 0 && rdata.is_offer_type == 2 && offerContests.length > 0  && (_.includes(offerContests,pContestId) || _.includes(offerContests,prContestId)))){
                                calEntryFees = userOfferAmount > totalEntryFee ? 0: (totalEntryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > totalEntryFee ? totalEntryFee: userOfferAmount;
                            } else if(rdata.is_offer_type == 3 && cBonusItem && cBonusItem.contest_id ){
                                userOfferAmount = cBonusItem.bonus_amount ? cBonusItem.bonus_amount : 0;
                                userOfferAmount = userOfferAmount  * total_team_number;
                                calEntryFees = userOfferAmount > totalEntryFee ? 0: (totalEntryFee - userOfferAmount );
                                retention_bonus_amount = userOfferAmount > totalEntryFee ? totalEntryFee: userOfferAmount;
                                is_offer_applied = true;
                            }    
                        }
                        if (userdata) {
                            if (decoded['contest_id']) {
                                if(retention_bonus_amount > 0){
                                    usableAmt = 0;
                                } else {
                                    if (useAmount > userdata.bonus_amount) {
                                        usableAmt = userdata.bonus_amount;
                                    } else {
                                        usableAmt = useAmount;
                                    }
                                }
                                let extraBalance = userdata.extra_amount || 0;
                                let remainingFee = retention_bonus_amount > 0 ? calEntryFees : totalEntryFee - usableAmt;
        
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
                        data['entry_fee'] = (totalEntryFee) ? parseInt(totalEntryFee) : 0;
                        data['user_offer_amount'] = (retention_bonus_amount) ? parseFloat(retention_bonus_amount.toFixed(2)) : 0;
                        data['calculated_entry_fee'] = (calEntryFees && _.isNumber(calEntryFees)) ? parseFloat(calEntryFees.toFixed(2)) : 0;
                        data['usable_bonus_percent'] = 0; //is_offer_applied;
                        data['is_offer_applied'] = is_offer_applied;
                        data1 = data;
                        res.send(ApiUtility.success(data1)); 
                    });
                } catch (err) {
                    consolelog('error in catch block in cache****',err);
                    return res.send(ApiUtility.failed("Something went wrong!!"));
                }
                
            } else {
                return res.send(ApiUtility.failed("User not found."));
            }
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    joinContestWithMultipleTeam: async (req, res) => {
        try {
            let data1 = {};
            let startTime = Date.now();
            const user_id = req.userId;
            const { } = req.params;
            //////console.log(req.body);
            const { team_ids, contest_id, series_id, match_id } = req.body;
            if (team_ids.length > 0) {
                if (team_ids.length <= 12) {
                    let totalContest = await PlayerTeamContest.countDocuments({ 'contest_id': ObjectId(contest_id), 'match_id': match_id, 'series_id': series_id });
                    let contestData = await redis.getRedis('contest-detail-' + contest_id);
                    if (!contestData) {
                        contestData = await Contest.findOne({ _id: ObjectId(contest_id) });
                        redis.setRedis('contest-detail-' + contest_id, contestData)
                    }
                    if (contestData && (contestData.contest_size - totalContest) >= team_ids.length || contestData.infinite_contest_size == 1) {
                        joinContestWithMultipleTeamRecursive(team_ids, match_id, series_id, contest_id, user_id, function (cbres, isJson) {
                            //////console.log('multiple_response:',cbres);
                            if (isJson) {
                                return res.json(cbres);
                            } else {
                                return res.send(cbres);
                            }
                        })
                    } else {
                        //////console.log('multiple_response:',ApiUtility.failed('You can not join this contest, contest size is less than team size.'));
                        return res.send(ApiUtility.failed('You can not join this contest, contest size is less than team size.'));
                    }
                } else {
                    return res.send(ApiUtility.failed('You can not join contest with more than 12 teams.'));
                }
            } else {
                return res.send(ApiUtility.failed('Team is not defined'));
            }

        } catch (error) {
            ////////console.log(error);
            res.send(ApiUtility.failed(error.message));
        }
    },
    checkContestData: async (req, res) => {
        try {

            const { match_id, contest_id } = req.params;

            var matchContestKeyAutoCreate = 'contest' + match_id + contest_id;

            MatchContest.updateMany({ match_id: match_id, contest_id: contestData._id }, { is_full: 1 });

            redis.getRedis(matchContestKeyAutoCreate, async (err, newCdata) => {
                return res.send(ApiUtility.success(newCdata));
            })
        } catch (error) {
            ////////console.log("match_id", match_id)
        }
    },

    categoryContestList: async (req, res) => {
        try {
            let data = [];
            let data1 = {};
            var user_id = req.userId;
            const { match_id, category_id } = req.params;
            var finalResult = {};
            var match_contest_dataall = [];

            //****************************************************By Sagar - Code Start******************************************************** */            
            if (category_id) {
                console.log('** Not From Redis ***');
                let filter = {
                    "match_id": parseInt(match_id),
                    is_full: { $ne: 1 }
                };
                var match_contest_data = await (new ModelService(Category)).getMatchContest({ "_id": ObjectId(category_id) }, filter, user_id, 100);
                redis.setRedis(RedisKeys.MATCH_CONTEST_LIST_CATEGORY + match_id + category_id, match_contest_data);
                var match_contest_dataallmatch = await (new ModelService(Category)).getMatchContest({}, filter, user_id, 10, true);
                match_contest_dataall = match_contest_dataallmatch;
            } else if (match_id) {
                console.log('** Not From Redis ***');
                let filter = {
                    "match_id": parseInt(match_id),
                    is_full: { $ne: 1 }
                };
                var match_contest_data = await (new ModelService(Category)).getMatchContest({ status: 1 }, filter, user_id, 10, true);
                redis.setRedis(RedisKeys.MATCH_CONTEST_All_LIST + match_id, match_contest_data);

                let userTeamIds = {};
                let joinedContestIds = [];
                let joinedTeamsCount = {};
                for (const matchContests of match_contest_data) {
                    ////////console.log("matchContests.contests", matchContests.contests.length)
                    for (const contest of matchContests.contests) {
                        joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                        if (contest.my_team_ids && contest.my_team_ids.length > 0) {
                            userTeamIds[contest.contest_id] = contest.my_team_ids;
                        }
                    }
                }

                redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
                redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id, JSON.stringify(Helper.parseUserTeams(userTeamIds)));

                finalResult['user_team_ids'] = Helper.parseUserTeams(userTeamIds),
                    finalResult['joined_teams_count'] = Helper.parseContestTeamsJoined(joinedTeamsCount)
                match_contest_dataall = match_contest_data;

            }

            var myContestCount = 0;
            var myTeamsCount = 0;

            if (user_id) {
                myTeamsCount = await PlayerTeam.find({ 'user_id': user_id, 'match_id': match_id }).countDocuments();
                myContestCount = await PlayerTeamContest.aggregate([{
                    $match: { 'user_id': user_id, 'match_id': parseInt(match_id) }
                },
                {
                    $group: { _id: "$contest_id", count: { $sum: 1 } }
                }
                ]);
                redis.redisObj.set('user-teams-count-' + match_id + '-' + user_id, myTeamsCount);
                redis.redisObj.set('user-contest-count-' + match_id + '-' + user_id, myContestCount.length);
            }

            let userTeamIds = {};
            let joinedContestIds = [];
            let joinedTeamsCount = {};
            for (const matchContests of match_contest_dataall) {
                ////////console.log("matchContests.contests", matchContests.contests.length)
                for (const contest of matchContests.contests) {
                    joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                    if (contest.my_team_ids && contest.my_team_ids.length > 0) {
                        userTeamIds[contest.contest_id] = contest.my_team_ids;
                    }
                }
            }

            joinedContestIds = _.map(myContestCount, '_id');
            redis.redisObj.set('user-contest-joinedContestIds-' + user_id + '-' + req.params.match_id, JSON.stringify(joinedContestIds));
            redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
            redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id, JSON.stringify(Helper.parseUserTeams(userTeamIds)));

            finalResult['user_team_ids'] = Helper.parseUserTeams(userTeamIds),
                finalResult['joined_teams_count'] = Helper.parseContestTeamsJoined(joinedTeamsCount)
            finalResult['match_contest'] = match_contest_data;
            finalResult['total'] = match_contest_data.length;
            finalResult['my_teams'] = myTeamsCount;
            finalResult['joined_contest_ids'] = joinedContestIds;
            finalResult['my_contests'] = (myContestCount && myContestCount.length > 0) ? myContestCount.length : 0;
            // console.log("joined_teams_count2222222222222", joinedContestIds)

            res.send(ApiUtility.success(finalResult));
            // ****************************************************By Sagar - Code End******************************************************** */ 

            // if (category_id) {
            //     console.log('** Not From Redis ******');
            //     //****************************************************By Sagar - Code Start******************************************************** */
            //     let filter = {
            //         "match_id": parseInt(match_id),
            //         is_full: { $ne: 1 }
            //     };
            //     //////////consolelog("filter", filter)

            //     filterCat = { "category_id": ObjectId(category_id), "match_id": parseInt(match_id), "is_full": { $ne: 1 }, "admin_create": { $ne: 1 } };

            //     const cat_Detail = await Category.findOne({"_id": ObjectId(category_id)});
            //     let myContestCount = 0;
            //     let myTeamsCount = 0;
            //     let netCatObj = {
            //         _id: cat_Detail._id,
            //         match_id: parseInt(match_id),
            //         category_id: cat_Detail._id,
            //         "category_title": cat_Detail.category_name,
            //         "sequence": cat_Detail.sequence,
            //         "category_desc": cat_Detail.description,
            //         category_image: (cat_Detail.image)?imageurl+"/"+cat_Detail.image : "",
            //     };
            //     const match_contest_data = await (new ModelService(MatchContest)).getMatchContestByCategory(filterCat, user_id, 45);
            //     if (match_contest_data.length > 0) {
            //         var newCatArray = [];
            //         _.forEach(match_contest_data, async function(i, k) {
            //             newCatArray.push({
            //                 "contest_id": i.contest._id,
            //                 "parent_id": i.contest.parent_id,
            //                 "entry_fee": i.contest.entry_fee,
            //                 "prize_money": i.contest.winning_amount,
            //                 "is_full": i.contest.is_full,
            //                 "confirm_winning": (i.contest.confirmed_winning == 'yes')?'yes':'no',
            //                 "is_gadget": (i.contest.amount_gadget == 'yes')? true: false,
            //                 "category_id": i.contest.category_id,
            //                 "is_auto_create": i.contest.is_auto_create,
            //                 "multiple_team": (i.contest.multiple_team == 'yes')? true: false,
            //                 "invite_code": i.invite_code,
            //                 "breakup_detail": contestCatMap(i.contest.breakup), 
            //                 "after_time_bonus": i.after_time_bonus,
            //                 "before_time_bonus": i.before_time_bonus,
            //                 "current_date": new Date(),
            //                 "usable_bonus_time": i.usable_bonus_time,
            //                 "use_bonus": numToString(i),
            //                 //{ $cond: { if: { $ifNull: ["$$sec.usable_bonus_time", false] }, then: { $cond: { if: { $gt: [new Date(), '$$sec.usable_bonus_time'] }, then: { $toString: "$$sec.before_time_bonus" }, else: { $toString: "$$sec.after_time_bonus" } } }, else: { $toString: "$$sec.contest.used_bonus" } } },
            //                 "is_infinite": (i.contest.infinite_contest_size == 1)? true : false,
            //                 "teams_joined": i.player_team_contest_count.length,
            //                 "total_teams": i.contest.contest_size,
            //                 "my_team_ids": i.player_team_contest,
            //                 "total_winners": i.contest.breakup.pop(),
            //                 "is_joined": false,
            //                 "infinite_breakup" : (i.contest.infinite_contest_size == 1)? {"winner_percent": i.contest.winner_percent, "winner_amount": i.contest.winning_amount_times} : {}
            //             });

            //             if(k === (match_contest_data.length - 1)){
            //                 netCatObj['contests'] = newCatArray;

            //                 if (user_id) {

            //                     myTeamsCount = await PlayerTeam.find({ 'user_id': user_id, 'match_id': match_id }).countDocuments();
            //                     myContestCount = await PlayerTeamContest.aggregate([{
            //                         $match: { 'user_id': user_id, 'match_id': parseInt(match_id) }
            //                     },
            //                     {
            //                         $group: { _id: "$contest_id", count: { $sum: 1 } }
            //                     }
            //                     ]);

            //                     redis.redisObj.set('user-teams-count-' + match_id + '-' + user_id, myTeamsCount);
            //                     redis.redisObj.set('user-contest-count-' + match_id + '-' + user_id, myContestCount.length);

            //                 }
            //                 res.send(ApiUtility.success({
            //                     match_contest: [netCatObj],
            //                     my_teams: myTeamsCount,
            //                     my_contests:  (myContestCount && myContestCount.length > 0) ? myContestCount.length : 0
            //                 }));
            //             }
            //         })
            //     } else {
            //         res.send(ApiUtility.success({
            //             match_contest: [],
            //             my_teams: myTeamsCount,
            //             my_contests:  myContestCount
            //         }));
            //     }

            //     //-----------------------------------------------------------------------------------------------------------------------//
            //     // var match_contest_data = await (new ModelService(Category)).getMatchContest({ "_id": ObjectId(category_id) }, filter, user_id, 100);

            //     // var myContestCount = 0;
            //     // var myTeamsCount = 0;
            //     // if (user_id) {

            //     //     myTeamsCount = await PlayerTeam.find({ 'user_id': user_id, 'match_id': match_id }).countDocuments();
            //     //     myContestCount = await PlayerTeamContest.aggregate([{
            //     //         $match: { 'user_id': user_id, 'match_id': parseInt(match_id) }
            //     //     },
            //     //     {
            //     //         $group: { _id: "$contest_id", count: { $sum: 1 } }
            //     //     }
            //     //     ]);

            //     //     redis.redisObj.set('user-teams-count-' + match_id + '-' + user_id, myTeamsCount);
            //     //     redis.redisObj.set('user-contest-count-' + match_id + '-' + user_id, myContestCount.length);

            //     // }

            //     // redis.setRedis(RedisKeys.MATCH_CONTEST_LIST_CATEGORY + match_id + category_id, match_contest_data);

            //     // res.send(ApiUtility.success({
            //     //     match_contest: match_contest_data,
            //     //     my_teams: myTeamsCount,
            //     //     my_contests: (myContestCount && myContestCount.length > 0) ? myContestCount.length : 0
            //     // }));

            //     //**************************************************** Code End******************************************************** */

            // } else if (match_id) {

            //     let filter = {
            //         "match_id": parseInt(match_id),
            //         is_full: { $ne: 1 }
            //     };
            //     const match_contest_data = await (new ModelService(Category)).getMatchContest({ status: 1 }, filter, user_id, 10, true);
            //     let myTeamsCount = 0;
            //     let myContestCount = 0;
            //     if (user_id) {
            //         myTeamsCount = await PlayerTeam.find({ user_id: user_id, match_id: match_id }).countDocuments();
            //         myContestCount = await PlayerTeamContest.aggregate([{
            //                 $match: { user_id: user_id, match_id: parseInt(match_id) }
            //             },
            //             {
            //                 $group: { _id: "$contest_id", count: { $sum: 1 } }
            //             }
            //         ]);
            //         redis.redisObj.set('user-teams-count-' + match_id + '-' + user_id, myTeamsCount);
            //         redis.redisObj.set('user-contest-count-' + match_id + '-' + user_id, myContestCount.length);
            //     }

            //     redis.setRedis(RedisKeys.MATCH_CONTEST_All_LIST + match_id, match_contest_data);

            //     res.send(ApiUtility.success({
            //         match_contest: match_contest_data,
            //         total: match_contest_data.length,
            //         my_teams: myTeamsCount,
            //         my_contests: myContestCount.length
            //     }));
            // } else {
            //     return res.send(ApiUtility.failed("Please send proper data"));
            // }
        } catch (error) {
            console.log("error categoryContestList", error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    switchTeam: async (req, res) => {
        try {
            const user_id = req.userId;
            const { match_id, series_id, contest_id, team_id } = req.body;
            let decoded = {
                match_id,
                series_id,
                contest_id,
                team_id,
                user_id
            };
            if (decoded['user_id'] && decoded['match_id'] && decoded['series_id'] && decoded['contest_id'] && decoded['team_id']) {
                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    let liveMatch = await SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] });
                    
                    if (liveMatch) {
                        let ctime = new Date();
                        let mtime = liveMatch.time;
                        if (mtime < ctime) {
                            return res.send(ApiUtility.failed('Match Already Closed '));
                        }

                        if (decoded['team_id'] && decoded['team_id'].length > 0) {
                            var filter = {
                                'match_id': decoded['match_id'],
                                'series_id': decoded['series_id'],
                                'contest_id': decoded['contest_id'],
                                'user_id': decoded['user_id']
                            }
                            
                            
                            var pleasrTeamData = await PlayerTeamContest.find(filter);
                            _.forEach(pleasrTeamData, async function (i, k) {
                                var pT = await PlayerTeam.findOne({'_id':decoded['team_id'][k]});
                                var count =  pT && pT.team_count ? pT.team_count:1;
                                switchTeamFn(i._id, decoded['team_id'][k],count);
                                if (k === (decoded['team_id'].length - 1)) {
                                    return res.send(ApiUtility.success({}, "Team switched successfuly."));
                                }
                            });


                            // let joinedContest	=	await PlayerTeamContest.updateMany({
                            //     'match_id':decoded['match_id'],
                            //     'series_id':decoded['series_id'],
                            //     'contest_id':decoded['contest_id'],
                            //     'user_id':decoded['user_id']
                            // },{$set:{player_team_id:team_id}});
                            // if(joinedContest) {
                            //     return res.send(ApiUtility.success({},"Team switched successfuly."));
                            // }
                        }
                    }
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed('Please check user id, match id, series id, contest id or team ids are blank.'));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    contestPrizeBreakup: async (req, res) => {
        try {
            const user_id = req.userId;
            let { contest_size } = req.params;
            contest_size = parseInt(contest_size);
            let decoded = {
                contest_size,
                user_id
            }
            if (decoded) {

                if (decoded['user_id'] && decoded['contest_size']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });

                    if (authUser) {
                        let breakup = await UserContestBreakup.aggregate([{
                            $match: {
                                'contest_size_start': { $lte: decoded['contest_size'] },
                                'contest_size_end': { $gte: decoded['contest_size'] }
                            }
                        },
                        {
                            $group: {
                                _id: "$winner",
                                "winner": { $first: "$winner" },
                                // "percent_prize" : "$percent_prize",
                            }
                        },
                        {
                            $sort: { winner: 1 }
                        }
                        ]);

                        // //////////consolelog(breakup);
                        // return false;
                        let prizeArray = [];

                        if (breakup) {
                            // let key = 0
                            for (const key in breakup) {
                                prizeArray[key] = {};
                                let winnerPrice = await UserContestBreakup.find({ "contest_size_start": { $lte: decoded['contest_size'] }, "contest_size_end": { $gte: decoded['contest_size'] }, winner: breakup[key].winner }).sort({ winner: 1 });

                                prizeArray[key]['title'] = breakup[key].winner;
                                if (winnerPrice) {
                                    let winnerKey = 0;
                                    prizeArray[key]['info'] = [];
                                    for (const winnerValue of winnerPrice) {
                                        prizeArray[key]['info'][winnerKey] = {};
                                        prizeArray[key]['info'][winnerKey]['rank_size'] = winnerValue.rank;
                                        prizeArray[key]['info'][winnerKey]['percent'] = winnerValue.percent_prize;
                                        winnerKey++;
                                    }
                                }
                            }
                        }

                        return res.send(ApiUtility.success(prizeArray));
                    } else {
                        return res.send(ApiUtility.failed("Security check failed."));
                    }
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed("match id or series id are empty."));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    beforeJoinContest: async (req, res) => {
        try {
            let data1 = {};
            const user_id = req.userId;
            const { series_id, match_id } = req.params;
            let decoded = {
                user_id,
                series_id,
                match_id
            }
            if (decoded) {
                if (decoded['series_id'] && decoded['match_id']) {
                    let seriesMatch = await SeriesSquad.findOne({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] });
                    if (seriesMatch) {
                        let pointSystem;
                        let matchType = seriesMatch.type;
                        if ((matchType == 'Test') || (matchType == 'First-class')) {
                            pointSystem = await PointSystem.findOne({ 'matchType': 'test' }).select("battingRun fieldingCatch bowlingWicket")
                        } else if (matchType == 'ODI') {
                            pointSystem = await PointSystem.findOne({ 'matchType': 'odi' }).select("battingRun fieldingCatch bowlingWicket")
                        } else if (matchType == 'T20') {
                            pointSystem = await PointSystem.findOne({ 'matchType': 't20' }).select("battingRun fieldingCatch bowlingWicket")
                        }

                        data1.run = (pointSystem) ? pointSystem.battingRun : 0;
                        data1.catch = (pointSystem) ? pointSystem.fieldingCatch : 0;
                        data1.wicket = (pointSystem) ? pointSystem.bowlingWicket : 0;
                        return res.send(ApiUtility.success(data1));
                    }
                } else {
                    return res.send(ApiUtility.failed("match id or series id are empty."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    createContest: async (req, res) => {
        try {
            let data1 = {};
            const user_id = req.userId;
            let { contest_size, series_id, match_id, team_id, winners_count, winning_amount, entry_fee } = req.body;
            match_id = parseInt(match_id);
            series_id = parseInt(series_id);
            entry_fee = parseFloat(entry_fee);
            let decoded = {
                contest_size,
                series_id,
                match_id,
                team_id,
                user_id,
                winners_count,
                winning_amount,
                entry_fee
            }
            let currentDate = moment().utc().toDate();
            return res.send(ApiUtility.failed("Private Contest is closed for now."));
            if (decoded) {
                let commission = config.contest_commission;
                if (decoded['user_id'] && decoded['contest_size'] && decoded['series_id'] && decoded['match_id'] && decoded['team_id'] && decoded['winners_count']) {

                    let authUser = await User.findOne({ '_id': decoded['user_id'] });
                    if (authUser) {
                        let liveMatch = await SeriesSquad.aggregate([{
                            $match: {
                                $expr: {
                                    $and: [
                                        { $lte: ["$time", currentDate] },
                                        { $eq: ["$status", 1] },
                                        { $eq: ["$win_flag", 0] },
                                        { $eq: ["$match_id", decoded.match_id] },
                                        { $eq: ["$series_id", decoded.series_id] },
                                        { $in: ["$match_status", [MatchStatus.MATCH_INPROGRESS]] }
                                    ]
                                }
                            }
                        },])

                        if (_.isEmpty(liveMatch)) {
                            let contest = {};
                            let saveData = {};
                            // create contest data
                            saveData['contest_size'] = decoded['contest_size'];
                            saveData['winning_amount'] = decoded['winning_amount'];
                            saveData['entry_fee'] = decoded['entry_fee'];
                            saveData['admin_comission'] = commission;
                            saveData['contest_type'] = (decoded['winning_amount'] > 0) ? 'Paid' : 'Free';
                            saveData['multiple_team'] = (decoded['join_multiple'] == 'yes') ? 'yes' : '0';
                            saveData['status'] = 1;
                            saveData['created'] = currentDate;
                            saveData['used_bonus'] = 0;
                            saveData['is_auto_create'] = 1;
                            saveData['confirmed_winning'] = '0';

                            // contest that are created on series by user
                            saveData.user_contest = {};
                            saveData.user_contest.user_id = decoded['user_id'];
                            saveData.user_contest.series_id = decoded['series_id'];
                            saveData.user_contest.match_id = decoded['match_id'];
                            saveData.user_contest.contest_name = decoded['contest_name'];

                            // contest price breakup
                            if (decoded['winning_amount'] > 0) {
                                let prizeBreakup = await UserContestBreakup.find({ "contest_size_start": { $lte: decoded['contest_size'] }, "contest_size_end": { $gte: decoded['contest_size'] }, winner: decoded['winners_count'] }).sort({ winner: 1 });

                                breakpArr = [];
                                if (prizeBreakup) {
                                    saveData['price_breakup'] = 1;
                                    let key = 0;
                                    for (const breakup of prizeBreakup) {
                                        breakpArr[key] = {};
                                        let winnigAmount = decoded['winning_amount'];
                                        let percent = breakup.percent_prize;
                                        let prizeMoney = (winnigAmount / 100) * percent;
                                        let priceRange = breakup.rank.split(" ");
                                        let startRank = (priceRange[1]) ? priceRange[1] : 0;
                                        let endRank = (priceRange[3]) ? priceRange[3] : priceRange[1];
                                        breakpArr[key].name = breakup.rank;
                                        breakpArr[key].startRank = startRank;
                                        breakpArr[key].endRank = endRank;
                                        breakpArr[key].percentage = breakup.percent_prize;
                                        breakpArr[key].price = prizeMoney;
                                        breakpArr[key].price_each = prizeMoney / (parseInt(endRank) - parseInt(startRank) + 1);

                                        key++;
                                    }
                                }

                                saveData['breakup'] = breakpArr;
                            }
                            // create contest invite code
                            inviteCode = Helper.createUserReferal(10);

                            // find match to add match  
                            let seriesMatch = await SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] }).select("_id match_id series_id localteam visitorteam localteam_id visitorteam_id match_status time");

                            // save contest with no category_id
                            let result = await Contest.create(saveData)
                            if (result) {
                                let contestData = result;
                                decoded['contest_id'] = result._id;
                                // create match Contest
                                if (seriesMatch) {
                                    matchContest = {};
                                    matchContest['match_id'] = seriesMatch.match_id;
                                    matchContest['series_id'] = seriesMatch.series_id;
                                    matchContest['localteam'] = seriesMatch.localteam;
                                    matchContest['visitorteam'] = seriesMatch.visitorteam;
                                    matchContest['localteam_id'] = seriesMatch.localteam_id;
                                    matchContest['visitorteam_id'] = seriesMatch.visitorteam_id;
                                    matchContest['match_status'] = seriesMatch.match_status;
                                    matchContest['invite_code'] = inviteCode;
                                    matchContest['contestStartDateTime'] = seriesMatch.time;
                                    matchContest['contest_id'] = decoded['contest_id'];
                                    matchContest['created'] = currentDate;
                                    matchContest['joined_users'] = 1;


                                    let matchContestResult = await MatchContest.create(matchContest);
                                }
                                // assign contest to series match
                                let teamContest = {};
                                teamContest.player_team_id = decoded['team_id'];
                                teamContest.match_id = decoded['match_id'];
                                teamContest.series_id = decoded['series_id'];
                                teamContest.contest_id = result._id;
                                teamContest.user_id = decoded['user_id'];
                                teamContest.total_amount = decoded['entry_fee'];


                                let playerTeamContest = await PlayerTeamContest.create(teamContest);
                                if (playerTeamContest) {
                                    // teamContest['$inc'] = { total_contest: 1 }
                                    let myContestCount = await PlayerTeamContest.aggregate([{
                                        $match: { user_id: decoded['user_id'], match_id: decoded['match_id'] }
                                    },
                                    {
                                        $group: { _id: "$contest_id", count: { $sum: 1 } }
                                    }
                                    ]);

                                    teamContest.total_contest = myContestCount.length;
                                    mqtt.publishUserJoinedContestCounts(decoded['match_id'], decoded['user_id'], JSON.stringify({ contest_count: myContestCount.length }))
                                    MyContestModel.updateOne({ match_id: decoded['match_id'], user_id: decoded['user_id'] }, teamContest, { upsert: true }).then((MyContestModel) => {
                                        //////////console.log("MyContestModel-------", MyContestModel)
                                    });

                                    let playerTeamContestId = playerTeamContest._id;
                                    //////////consolelog('joine_contest_id',playerTeamContestId);

                                    let user = authUser;

                                    if (user) {
                                        let contestType = result.contest_type;
                                        let entryFee = result ? result.entry_fee : 0;
                                        if (contestType == 'Paid') {

                                            let adminPer = config.admin_percentage;
                                            let useAmount = (adminPer / 100) * entryFee;
                                            let saveData = [];

                                            if (user) {
                                                let cashAmount = 0;
                                                let winAmount = 0;
                                                let bonusAmount = 0;
                                                let remainingFee = entryFee;
                                                userWallet = {};
                                                if (remainingFee) {
                                                    let cashBalance = user.cash_balance;
                                                    if (cashBalance) {
                                                        let cashBal = (cashBalance > remainingFee) ? cashBalance - remainingFee : 0;
                                                        cashAmount = (cashBalance > remainingFee) ? remainingFee : cashBalance;
                                                        remainingFee = (cashBalance < remainingFee) ? remainingFee - cashBalance : 0;
                                                        userWallet['cash_balance'] = cashBal;
                                                    }
                                                }

                                                if (remainingFee) {
                                                    let winningBal = user.winning_balance;
                                                    if (winningBal) {
                                                        let winningBal1 = (winningBal > remainingFee) ? winningBal - remainingFee : 0;
                                                        winAmount = (winningBal > remainingFee) ? remainingFee : winningBal;
                                                        remainingFee = (winningBal < remainingFee) ? remainingFee - winningBal : 0;
                                                        userWallet['winning_balance'] = winningBal1;
                                                    }
                                                }
                                                await PlayerTeamContest.findOneAndUpdate({ _id: playerTeamContestId }, { $set: { "bonus_amount": bonusAmount } });
                                                await Contest.saveJoinContestDetail(decoded, bonusAmount, winAmount, cashAmount, playerTeamContestId, contestData);


                                                // create transation log for joining Contest
                                                let date = new Date();
                                                let joinContestTxnId = 'JL' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                // Transaction Detail Code RG_VARUN
                                                let userId = decoded['user_id'];
                                                let txnId = joinContestTxnId;
                                                let status = TransactionTypes.JOIN_CONTEST;
                                                let txnAmount = entryFee;
                                                let withdrawId = 0;
                                                let contest_id = decoded['contest_id'];
                                                let match_id = decoded['match_id'];

                                                await Transaction.saveTransaction(userId, txnId, status, txnAmount, withdrawId, contest_id, match_id);


                                                let cons_cash_balance = cashAmount;
                                                let cons_winning_balance = winAmount;
                                                let cons_bonus_amount = null;
                                                let refund_cash_balance = null;
                                                let refund_winning_balance = null;
                                                let refund_bonus_amount = null;
                                                let winning_balance = authUser['winning_balance'] - winAmount;
                                                let cash_balance = authUser['cash_balance'] - cashAmount;
                                                let bonus_balance = authUser['bonus_amount'] - bonusAmount;
                                                let total_balance = winning_balance + cash_balance + bonus_balance;
                                                User.setTransactionDetail(user_id, winning_balance, cash_balance, bonus_balance, total_balance, cons_cash_balance, cons_winning_balance, cons_bonus_amount, refund_cash_balance, refund_winning_balance, refund_bonus_amount);

                                            }

                                        }
                                    }
                                }

                                data1.invite_code = inviteCode;

                                //**************************************************************************** */
                                let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id;
                                var datsse = moment().subtract('30', 'days').toDate();
                                let filterm = {
                                    "user_id": user_id,
                                    "createdAt": { $gte: datsse }
                                };
                                let sortm = { createdAt: -1 }
                                getMatchRedisData(0, { "user_id": user_id, pagesize: 25 }, {}, sortm, 1, function (results) {
                                    redis.setRedis(matchContestUserKey, results); // Set Redis
                                });
                                //********************************************************************************************* */


                                return res.send(ApiUtility.success(data1, 'You cantest created successfully.'));
                            }
                        } else {
                            return res.send(ApiUtility.failed('You can not create contest, match already started.'));
                        }
                    } else {
                        return res.send(ApiUtility.failed('Invalid user id.'));
                    }
                } else {
                    return res.send(ApiUtility.failed("match id or series id are empty."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    applyCouponCode: async (req, res) => {
        try {
            let data1 = {};
            let user_id = req.userId;
            const { coupon_code } = req.body;
            let decoded = {
                user_id,
                coupon_code
            };

            if (decoded && coupon_code.length > 0) {
                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    let currentDateTime = new Date(); //,'expiry_date':{$gte:currentDateTime}
                    // $couponData	=	$this->PaymentOffers->find()->where(['coupon_code LIKE'=>$decoded['coupon_code'],'expiry_date >='=>$currentDateTime,'status'=>ACTIVE])->first();
                    // //////console.log(currentDateTime,"expiry_date");
                    let firstDepostCode = ["FIRSTDEPOSIT"];
                    let ncoupon_code = coupon_code.toUpperCase();
                    if(firstDepostCode.indexOf(ncoupon_code ) > -1) {
                        if(authUser && authUser.isFirstPaymentAdded && authUser.isFirstPaymentAdded == 2){
                            return res.send(ApiUtility.success({applied:true}, 'Coupon applied successfully.'));
                        } else {
                            return res.send(ApiUtility.failed("This coupon is not valid for you!!."));
                        }
                        
                    }

                    var regCode = new RegExp(["^", coupon_code, "$"].join(""), "i");
                    var start = new Date();
                        start.setHours(0,0,0,0);
                    couponData = await PaymentOffers.findOne({ 'coupon_code': regCode, status: 1,expiry_date:{$gte:start.toISOString()} });
                    
                    if (couponData) {
                        let userCouponCount = await UserCouponCodes.find({ 'user_id': decoded['user_id'], 'coupon_code_id': couponData._id, 'status': 1 }).countDocuments();
                        if (userCouponCount >= couponData.per_user_limit && couponData.per_user_limit) {
                            return res.send(ApiUtility.failed('You have used your limit.'));
                        } else {
                            // const idArr     =   [ "606855256de28e3177251828","606855536de28e3177251829" ];
                            // let couponIndex =   idArr.indexOf((couponData._id).toString() );
                            // // console.log(idArr.indexOf((couponData._id).toString() ), 'enter');
                            // let userCouponMEGAPAAS = await UserCouponCodes.find({ 'user_id': decoded['user_id'], 'coupon_code_id': {$in: [ObjectId("606855256de28e3177251828"),ObjectId("606855536de28e3177251829")]}, 'status': 1 }).countDocuments();
                            
                            // if(userCouponMEGAPAAS >= 1 && couponIndex !== -1) {
                            //     // console.log("enter");
                            //     return res.send(ApiUtility.failed("You can not use same offer code multiple times."));
                            // }
                            if (couponData.usage_limit) {
                                let couponCount = await UserCouponCodes.find({ 'coupon_code_id': couponData._id, 'status': 1 }).countDocuments();
                                if (couponCount >= couponData.usage_limit) {
                                    return res.send(ApiUtility.failed('Coupon code has expired.'));
                                } else {
                                    let saveCouonData = {};
                                    saveCouonData['coupon_code_id'] = couponData.id;
                                    saveCouonData['user_id'] = decoded['user_id'];
                                    saveCouonData['applied_on'] = new Date();
                                    saveCouonData['min_amount'] = (couponData.min_amount) ? couponData.min_amount : 0;
                                    saveCouonData['in_percentage'] = (couponData.max_cashback_percent > 0) ? true : false;
                                    saveCouonData['created'] = new Date();
                                    if (couponData.max_cashback_percent > 0) {
                                        saveCouonData['discount_amount'] = couponData.max_cashback_percent;
                                        saveCouonData['max_discount'] = couponData.max_cashback_amount;
                                    } else {
                                        saveCouonData['discount_amount'] = couponData.max_cashback_amount;
                                        saveCouonData['max_discount'] = couponData.max_cashback_amount;
                                    }

                                    let result = await UserCouponCodes.create(saveCouonData);
                                    // userCoupon.status	=	ACTIVE;
                                    if (result) {
                                        saveCouonData.coupon_id = result.coupon_code_id;
                                        return res.send(ApiUtility.success(saveCouonData, 'Coupon applied successfully.'));
                                    }
                                }
                            } else {
                                let saveCouonData = {};
                                saveCouonData['coupon_code_id'] = couponData._id;
                                saveCouonData['user_id'] = decoded['user_id'];
                                saveCouonData['applied_on'] = new Date();
                                saveCouonData['min_amount'] = (couponData.min_amount) ? couponData.min_amount : 0;
                                saveCouonData['in_percentage'] = (couponData.max_cashback_percent > 0) ? true : false;
                                saveCouonData['created'] = new Date();
                                if (couponData.max_cashback_percent > 0) {
                                    saveCouonData['discount_amount'] = couponData.max_cashback_percent;
                                    saveCouonData['max_discount'] = couponData.max_cashback_amount;
                                } else {
                                    saveCouonData['discount_amount'] = couponData.max_cashback_amount;
                                    saveCouonData['max_discount'] = couponData.max_cashback_amount;
                                }
                                let result = await UserCouponCodes.create(saveCouonData);
                                if (result) {
                                    saveCouonData.coupon_id = result.coupon_code_id;
                                    data1 = saveCouonData;
                                    return res.send(ApiUtility.success(data1, 'Coupon applied successfully.'));
                                }
                            }
                        }
                    } else {
                        return res.send(ApiUtility.failed("Coupon Code is not valid."));
                    }
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                if (coupon_code.length === 0) {
                    return res.send(ApiUtility.failed("Coupon Code is missing"));
                } else {
                    return res.send(ApiUtility.failed("You are not authenticated user."));
                }

            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },

    joinContest: async (req, res) => {

        try {

            
            let data1 = {};
            let startTime = Date.now();

            const user_id = req.userId;
            const { } = req.params;
            const { team_id, contest_id, series_id, match_id } = req.body;

            let decoded = {
                match_id: parseInt(match_id),
                series_id: parseInt(series_id),
                contest_id: contest_id,
                user_id: user_id
            }

            var totalContestKey = 0;
            var mycontId = 0;
            if (match_id && series_id && contest_id && user_id) {
                // let authUser = await User.findById(user_id).maxTimeMS(60);
                let indianDate = Date.now();
                indianDate = new Date(moment(indianDate).format('YYYY-MM-DD'));
                let apiList = [
                    User.findById(user_id).select({ "winning_balance": 1, "cash_balance": 1, "bonus_amount": 1, "extra_amount": 1, "extra_amount_date": 1, "extra_amount_date": 1, "perday_extra_amount": 1, "referal_code_detail": 1, "email": 1 }),
                    SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] }),
                    PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] }).countDocuments(),
                    redis.getRedis('contest-detail-' + contest_id),
                    MatchContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id }),
                    // redis.getRedis('match-contest-detail-' + decoded['match_id'] + '-' + contest_id)
                ];
                if (!team_id) {
                    apiList.push(PlayerTeam.findOne({ 'user_id': user_id, 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] }));
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
                                if (teamId) {
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
                                    let joinedContest = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'series_id': series_id, 'contest_id': contest_id }).countDocuments();// (matchContest && matchContest.joined_users) ? matchContest.joined_users : 0

                                    var parentContestId = (contestData && contestData.parent_id) ? contestData.parent_id : contestData._id;
                                    let infinteStatus = contestData && contestData.infinite_contest_size != 1 ? true : false;

                                    if (contestData && contestData.contest_size == parseInt(joinedContest) && infinteStatus) {

                                        let response = {};
                                        var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, is_full: { $ne: 1 } }).sort({ _id: -1 });
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

                                    var PlayerTeamContestFilter = { 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'series_id': decoded['series_id'], 'player_team_id': teamId }

                                    let playerTeamRes = await PlayerTeamContest.findOne(PlayerTeamContestFilter);
                                    // let sameContest = await PlayerTeamContest.find({ 'contest_id': contest_id, 'user_id': user_id, 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] }).countDocuments();
                                    let joinedContestWithTeamCounts = results[2] ? results[2] : 0;
                                    let maxTeamSize = 9;

                                    if (joinedContestWithTeamCounts < maxTeamSize) {
                                        if (!playerTeamRes) {
                                            if ((!contestData.multiple_team && joinedContestWithTeamCounts >= 1) || ((contestData.multiple_team !== 'yes') && joinedContestWithTeamCounts >= 1)) {
                                                return res.send(ApiUtility.failed('Multiple Teams Not Allowed'));
                                            }
                                            //const session = await db.getMongoose().startSession();
                                            const session = await startSession()
                                            session.startTransaction();
                                            const sessionOpts = {  session, new: true };
                                            try{
                                                const doc = await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: 1 } }, sessionOpts);
                                                if(doc){
                                                     //**************************start************
                                                    console.log("Start Oneeccccc******");
                                                let incData = doc; //await MatchContest.findOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id });
                                                let joinedContest1 = incData.joined_users;
                                                console.log('counts*******joinedContest1', joinedContest1);
                                                //var mcCountResNew = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'series_id': series_id, 'contest_id': contest_id }).countDocuments();

                                                if (contestData && contestData.contest_size < joinedContest1 && infinteStatus) {
                                                    console.log("Going in the/ last response ----------***********", contestData.contest_size, joinedContest1);
                                                    //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                    
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
                                                                            txn_amount: txnAmount,
                                                                            currency: "INR",
                                                                            txn_date: Date.now(),
                                                                            local_txn_id: txnId,
                                                                            added_type: parseInt(status)
                                                                        };

                                                                        let walletRes = await User.update({ _id: user_id }, { $set: updateUserData, $inc: { cash_balance: -cashAmount, bonus_amount: -bonusAmount, winning_balance: -winAmount, extra_amount: -extraAmount } },sessionOpts);

                                                                        if (walletRes && walletRes.nModified > 0) {
                                                                            await Transaction.create(entity);
                                                                            userWalletStatus = true;
                                                                        }else{
                                                                              userWalletStatus = false;
                                                                              await session.abortTransaction();
                                                                              session.endSession();
                                                                              return res.send(ApiUtility.failed("Something went wrong, Please try again."));
                                                                        }

                                                                    } catch (error) {
                                                                       // await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                        console.log('join contest amount deduct and transaction > ', error);
                                                                        await session.abortTransaction();
                                                                              session.endSession();
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
                                                                    await session.abortTransaction();
                                                                    session.endSession();
                                                                    //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                    return res.send(ApiUtility.failed('Insufficient Balance!!'));
                                                                }
                                                            } else {
                                                                await session.abortTransaction();
                                                                     session.endSession();
                                                                 //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                return res.send(ApiUtility.failed('something went wrong!!'));

                                                            }
                                                        }
                                                        let totalEntryAmount = cashAmount + winAmount + bonusAmount + extraAmount;
                                                        // console.log(totalEntryAmount);
                                                        // return false;

                                                        if (contestType == "Free" || (contestType == "Paid" && totalEntryAmount > 0 && totalEntryAmount == entryFee && userWalletStatus)) {
                                                            try {
                                                                contest.bonus_amount = bonusAmount;
                                                                let getCountKey = 0;

                                                                let playerTeamContestId = newContestId;
                                                                totalContestKey = await getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId,session);
                                                                if (contestType == "Paid" && totalEntryAmount == entryFee) {
                                                                    // getCountKey = await Promise.all([
                                                                    //     // MatchContest.updateOne({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: 1 } }),
                                                                    // ]);
                                                                    await Contest.saveJoinContestDetail(decoded, bonusAmount, winAmount, cashAmount, newContestId, contestData, extraAmount);
                                                                }
                                                                
                                                                // else {
                                                                //     getCountKey = await Promise.all([
                                                                //         getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId)

                                                                //     ]);
                                                                // }
                                                                // var mcCountResNew = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'series_id': series_id, 'contest_id': contest_id }).countDocuments();
                                                                var mcCountResNew = await MatchContest.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'], 'contest_id': contest_id });
                                                                if (mcCountResNew && contestData.contest_size === mcCountResNew.joined_users) {
                                                                    await MatchContest.updateOne({ _id: ObjectId(matchContest._id) }, { $set: { "is_full": 1 } });
                                                                }

                                                                //totalContestKey = (getCountKey && getCountKey.length > 0) ? getCountKey[0] : 0;
                                                                // console.log(totalContestKey,'***************** contest count ******************');
                                                            } catch (error) {
                                                                await session.abortTransaction();
                                                                 session.endSession();
                                                               // await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                                console.log('save join contest > player_team_contest > ', error);
                                                                return res.send(ApiUtility.failed(error.message));
                                                            }
                                                            // TODO: Save Contest
                                                            let playerContest = {};
                                                            playerContest.id = newContestId;
                                                            if (playerContest.id) {
                                                                if (contestData) {
                                                                    
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

                                                                    redis.redisObj.get('user-teams-count-' + match_id + '-' + user_id, (err, data) => {
                                                                        let count = (data) ? parseInt(data) : 1;
                                                                        // mqtt.publishUserJoinedTeamCounts(match_id,user_id,JSON.stringify({team_count:count}))
                                                                        redis.redisObj.del('user-teams-count-' + match_id + '-' + user_id) //force user to get data from db
                                                                    });

                                                                    let joinedContestKey = `${RedisKeys.CONTEST_JOINED_LIST}${series_id}-${match_id}-${user_id}`;
                                                                    redis.redisObj.del(joinedContestKey); //force user to get data from db
                                                                    console.log("************ Set my matches in redis ************")
                                                                    // console.log('**********************',totalContestKey, '****************');
                                                                    try {
                                                                        //console.log("user_id", user_id, decoded['match_id'])
                                                                        let matchContestUserKey = RedisKeys.MY_MATCHES_LIST + user_id;
                                                                        var datsse = moment().subtract('30', 'days').toDate();
                                                                        let filterm = {
                                                                            "user_id": user_id,
                                                                            "createdAt": { $gte: datsse }
                                                                        };

                                                                        let sortm = { createdAt: -1 }
                                                                        let serverTimeu = moment(Date.now()).format(config.DateFormat.datetime);
                                                                        redis.getRedis(matchContestUserKey, function (err, contestData) { // Get Redis
                                                                            // console.log('redis data ******************',contestData.upcoming_match);
                                                                            if (!contestData) {
                                                                                getMatchRedisData(0, { "user_id": user_id, "pagesize": 25 }, {}, sortm, 1, function (results) {
                                                                                    results['server_time'] = serverTimeu;
                                                                                    redis.setRedis(matchContestUserKey, results);
                                                                                })
                                                                            } else {
                                                                                // console.log("REdis****22222222")
                                                                                SeriesSquad.findOne({ 'match_id': parseInt(match_id), 'series_id': parseInt(series_id) }).then(function (data) {
                                                                                    //console.log("Redis-***********")
                                                                                    // console.log("match_id", match_id);
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
                                                            await session.abortTransaction();
                                                            session.endSession();
                                                           // await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                            return res.send(ApiUtility.failed("Something went wrong!!"));
                                                        }
                                                    } catch (error) {
                                                        await session.abortTransaction();
                                                        session.endSession();
                                                        //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true })
                                                        console.log("join contest condition true > ", error);
                                                        return res.send(ApiUtility.failed(error.message));
                                                    }
                                                } else {
                                                    let response = {};
                                                    await session.abortTransaction();
                                                          session.endSession();
                                                    //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                    var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, is_full: { $ne: 1 } }).sort({ _id: -1 });

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
                                                //*******************************end***********
                                                }
                                            
                                            } catch(errorr){
                                                let response = {};
                                                await session.abortTransaction();
                                                      session.endSession();
                                                //await MatchContest.findOneAndUpdate({ 'match_id': decoded['match_id'], 'contest_id': contest_id }, { $inc: { joined_users: -1 } }, { upsert: true, 'new': true, setDefaultsOnInsert: true });
                                                var MatchContestData = await MatchContest.findOne({ 'parent_contest_id': parentContestId, match_id: match_id, is_full: { $ne: 1 } }).sort({ _id: -1 });

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
            // console.log(error);


            return res.send(ApiUtility.failed(error.message));
        }
    },

}

async function getContestCount(contest, user_id, match_id, series_id, contest_id, contestData, parentContestId,session) {
    try {
        return new Promise(async (resolve, reject) => {
           await PlayerTeamContest.create([contest],{session:session}).then(async (newDataPTC) => {
                
               var newPTC = newDataPTC && newDataPTC.length>0?newDataPTC[0]:{};

                // console.log("new ptc data is --------", newPTC);
                // console.log('contestData************** contestData',contestData);

                // console.log("new ptc data is --------", newPTC)

                await session.commitTransaction();
                      session.endSession();
                
                var isAutoCreateStatus = (contestData.auto_create && (contestData.auto_create.toLowerCase()).includes("yes")) ? true : false;
                if (isAutoCreateStatus) {
                    var mcCountRes = await PlayerTeamContest.find({ 'match_id': parseInt(match_id), 'contest_id': contest_id, 'series_id': parseInt(series_id) }).countDocuments();
                    console.log("newPTC.user_id*****",newPTC.user_id,"own id",user_id,"mcCountRes",mcCountRes);
                    if (mcCountRes == contestData.contest_size) {
                        console.log(contestData.contest_size, "************** auto create counter");
                        const autores = await Promise.all([
                            contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId),
                            MatchContest.findOneAndUpdate({ 'match_id': parseInt(match_id), 'contest_id': contest_id }, { $set: { joined_users: contestData.contest_size, "is_full": 1 } }),
                        ]);
                    }
                }
                let redisKey = 'user-contest-joinedContestIds-' + user_id + '-' + match_id;
                redis.getRedis(redisKey, (err, data) => {
                    ////console.log("contest_id", contest_id, data)
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

                    //////////console.log("uniqueContestIds", uniqueContestIds)

                    var newMyModelobj = {
                        'match_id': match_id,
                        "series_id": series_id,
                        "contest_id": contest_id,
                        "user_id": user_id,
                        "player_team_contest_id": newPTC._id,
                        "match_status": 'Not Started',
                        "total_contest": uniqueContestIds.length
                        //'$inc' : { "total_contest": 1 }
                    }

                    totalContestKey = uniqueContestIds.length

                    MyContestModel.findOneAndUpdate({ match_id: match_id, user_id: user_id }, newMyModelobj, { upsert: true, new: true }).then((MyContestModel) => {
                        mycontId = MyContestModel._id || 0;
                    });
                    mqtt.publishUserJoinedContestCounts(match_id, user_id, JSON.stringify({ contest_count: uniqueContestIds.length }))
                    redis.setRedis(redisKey, data);
                    
                    return resolve(totalContestKey);
                });
                // console.log("PlayerTeamContest000000000000000")
            });
        })
    } catch (error) {
        // console.log("error getContestCount", error)   
    }
}

function createAutoCrateCOntest(contestData, contest_count, series_id, match_id, contest_id) {
    return new Promise((resolve, reject) => {
        try {
            var autoCreateKey = 'contest' + match_id + contest_id;
            ////////console.log("autoCreateKey*****", autoCreateKey)
            var newArray = [];
            autoCreateContestFn(contestData, series_id, match_id, 10, 1, newArray, contest_id, function (result) {

                MatchContest.find({ "match_id": match_id, "parent_contest_id": ObjectId(contest_id) }, { "_id": 1 }).countDocuments().then(function (mccount) {
                    ////////console.log("mccount", mccount)
                    updateAutoCreateCount(match_id, contest_id, mccount);
                });
                var totalContestLength = contest_count + result.length;

                //////////console.log("result final******", result)
                redis.getRedis(autoCreateKey, async (err, datamct) => {
                    if (datamct && datamct.length > 0) {
                        ////////console.log("datamct**", datamct.length)
                        var contactArray = _.concat(datamct, result);
                        ////////console.log("contactArray****", contactArray.length)
                        redis.setRedis(autoCreateKey, contactArray);
                        resolve(contactArray)
                    } else {
                        redis.setRedis(autoCreateKey, result);
                        resolve(result)
                    }
                })

            })

        } catch (error) {
            ////////console.log("error111", error)
        }
    })
}

function autoCreateContestFn(contestData, series_id, match_id, length, i, newArray, parentContestId, fn) {
    try {
        //////////console.log('******',contestData, series_id, match_id, length, i)
        if (i <= length) {

            Contest.createAutoContest(contestData, series_id, match_id, 1, parentContestId, function (res) {
                i++;
                //////////console.log("res*****", res)
                newArray.push(res)
                autoCreateContestFn(contestData, series_id, match_id, length, i, newArray, parentContestId, fn)
            });
        } else {
            fn(newArray)
        }
    } catch (error) {
        ////////console.log("error22222", error)
    }
}

async function updateAutoCreateCount(match_id, contest_id, mccount) {
    try {
        ////////console.log(match_id, contest_id, mccount)
        MatchContest.updateOne({ "match_id": parseInt(match_id), "contest_id": ObjectId(contest_id) }, { "total_auto_create_contest": mccount }).then(function (mcupdated) {
            ////////console.log("updateAutoCreateCount***", mcupdated)
        });
        // var updateAutoCreateCount = await MatchContest.update({ "match_id": parseInt(match_id), "contest_id": ObjectId(contest_id) }, { "total_auto_create_contest": mccount });
        // ////////console.log("updateAutoCreateCount", updateAutoCreateCount)
    } catch (error) {
        ////////console.log("updateAutoCreateCount", updateAutoCreateCount)
    }
}

async function getJoinedContestData(match_id, contest_id) {
    try {
        return new Promise(async (resolve, reject) => {
            redis.getRedis('player-team-contest-count-' + match_id + '-' + contest_id, (err, joinedContest) => {
                if (joinedContest) {
                    return resolve(joinedContest);
                } else {
                    return resolve(false);
                }
                // //////console.log(joinedContest,'********','player-team-contest-count-' + match_id + '-' + contest_id);
            });
        });
    } catch (error) {
        ////////console.log('error', error)
    }
}

async function checkRedisKeyType(is_type, match_id, category_id, matchContestKeyAutoCreate, contestData, newContestobj, parentContestId, newCdata, contest_id) {
    try {

        console.log("\x1b[37m%s\x1b[0m", "is_type", is_type)
        console.log("\x1b[37m%s\x1b[0m", "match_id", match_id)
        console.log("\x1b[37m%s\x1b[0m", "category_id", category_id)
        console.log("\x1b[37m%s\x1b[0m", "matchContestKeyAutoCreate", matchContestKeyAutoCreate)
        console.log("\x1b[37m%s\x1b[0m", "parentContestId", parentContestId)
        console.log("\x1b[37m%s\x1b[0m", "contest_id", contest_id)
        console.log("\x1b[37m%s\x1b[0m", "contestData", contestData.category_id)
        console.log("\x1b[37m%s\x1b[0m", "newContestobj._id", newContestobj._id)
        console.log("\x1b[37m%s\x1b[0m", "newCdata", newCdata.length)

        return new Promise(async (resolve, reject) => {

            //*************************************default code start*********************************************************** */
            var key = RedisKeys.MATCH_CONTEST_LIST + match_id;
            redis.getRedis(key, (err, categories) => {
                if (categories) {
                    let catId = contestData.category_id.toString();
                    let catIndex = _.findIndex(categories, { "_id": catId });
                    ////////console.log("catIndex***", catIndex)
                    if (catIndex >= 0) {
                        let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                        ////////console.log("contestIndex***", contestIndex)
                        commonCodeForcheckRedisKeyType(key, contestIndex, categories, catIndex, newContestobj, parentContestId, newCdata, matchContestKeyAutoCreate);
                    }
                }
            });
            //*************************************default code end*********************************************************** */

            //*************************************all_category code start*********************************************************** */
            var key = RedisKeys.MATCH_CONTEST_LIST_CATEGORY + match_id + category_id;
            redis.getRedis(key, (err, categories) => {
                if (categories) {
                    var catIndex = 0;
                    let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                    ////////console.log("contestIndex***", contestIndex)
                    commonCodeForcheckRedisKeyType(key, contestIndex, categories, catIndex, newContestobj, parentContestId, newCdata, matchContestKeyAutoCreate);
                }
            });
            //*************************************all_category code end*********************************************************** */

            //*************************************show_all code start*********************************************************** */
            var key = RedisKeys.MATCH_CONTEST_All_LIST + match_id;
            redis.getRedis(key, (err, categories) => {
                if (categories) {
                    var catIndex = 0;
                    let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                    ////////console.log("contestIndex***", contestIndex)
                    commonCodeForcheckRedisKeyType(key, contestIndex, categories, catIndex, newContestobj, parentContestId, newCdata, matchContestKeyAutoCreate);
                }
            });
            //*************************************show_all code end*********************************************************** */
        })
    } catch (error) {
        //console.log("checkRedisKeyType", error)
    }
}

function commonCodeForcheckRedisKeyType(key, contestIndex, categories, catIndex, newContestobj, parentContestId, newCdata, matchContestKeyAutoCreate) {
    try {
        //console.log("\x1b[38m%s\x1b[0m", contestIndex, categories, catIndex, newContestobj, parentContestId, newCdata, matchContestKeyAutoCreate)
        if (contestIndex >= 0) {
            let newCOntestDeepObj = JSON.parse(JSON.stringify(categories[catIndex]['contests'][contestIndex]));

            //categories[catIndex]['contests'].splice(contestIndex,1);
            newCOntestDeepObj["contest_id"] = newContestobj._id;
            newCOntestDeepObj["parent_id"] = parentContestId;
            newCOntestDeepObj["invite_code"] = newContestobj.invite_code;
            newCOntestDeepObj["teams_joined"] = 0;
            newCOntestDeepObj["my_team_ids"] = [];
            newCOntestDeepObj["is_joined"] = false;
            //////////console.log("newCOntestDeepObj***", newCOntestDeepObj, categories[catIndex]['contests'])
            if (categories[catIndex]['contests'].length === 0) {
                categories[catIndex].contests.push(newCOntestDeepObj);
            } else {
                categories[catIndex].contests[contestIndex] = newCOntestDeepObj;
            }
            ////////console.log("categories*****", categories[catIndex].contests, matchContestKey)
            redis.setRedis(key, categories);
            //************************************************************* */                                                                                    
            newCdata.splice(0, 1);
            ////////console.log("newCdata", newCdata.length, matchContestKeyAutoCreate)
            redis.setRedis(matchContestKeyAutoCreate, newCdata);
            //************************************************************** */    
        } else {
            ////////console.log("else***********111111", newCdata)
            newCdata.splice(0, 1);
            ////////console.log("else***********2222222222", newCdata)
            redis.setRedis(matchContestKeyAutoCreate, newCdata);
        }
    } catch (error) {
        //console.log("commonCodeForcheckRedisKeyType", error)
    }
}

function contestCatMap(dataObj) {
    try {
        var newArray = [];
        _.forEach(dataObj, function (i) {
            newArray.push({
                "rank": (i.startRank == i.endRank) ? "Rank " + i.startRank.toString() : i.name,
                "gadget_name": (i.gadget_name != "") ? i.gadget_name : "",
                "image": (i.image != "") ? imageurl + "/" + i.image : "",
                "price": (i.price_each > 0) ? parseFloat(i.price_each.toFixed(2)) : parseFloat(i.price.toFixed(2))
            })
        })
        return newArray
    } catch (error) {
        console.log("eroor***", error)
    }
}

function numToString(i) {
    try {
        var timeStr = (i.usable_bonus_time) ? (new Date() > i.usable_bonus_time) ? i.before_time_bonus : i.after_time_bonus : i.contest.used_bonus;
        if (timeStr) {
            return timeStr.toString()
        } else {
            return null
        }

    } catch (error) {
        console.log("eroor***", error)
    }
}

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

async function contestAutoCreateAferJoin11(contestData, series_id, contest_id, match_id, parentContestId) {
    // This is used to auto create contest 
    return new Promise((resolve, reject) => {
        Contest.createAutoContest(contestData, series_id, match_id, 0, parentContestId, function (res, error) {
            if (error) {
                console.log('auto create error *****', error);
                reject(false);
            } else {
                //console.log('auto create res*****', res);
                let matchContestKey = RedisKeys.MATCH_CONTEST_LIST + match_id;
                redis.getRedis(matchContestKey, (err, categories) => {
                    let catId = contestData.category_id.toString();
                    let catIndex = _.findIndex(categories, { "_id": catId });
                    if (catIndex >= 0) {
                        let contestIndex = _.findIndex(categories[catIndex].contests, { "contest_id": contest_id });
                        if (contestIndex >= 0) {
                            let newCOntestDeepObj = JSON.parse(JSON.stringify(categories[catIndex]['contests'][contestIndex]))
                            categories[catIndex]['contests'].splice(contestIndex, 1);
                            newCOntestDeepObj["contest_id"] = res._id;
                            newCOntestDeepObj["parent_id"] = contest_id;
                            if (categories[catIndex]['contests'].length === 0) {
                                categories[catIndex].contests.push(newCOntestDeepObj);
                            } else {
                                categories[catIndex].contests.unshift(newCOntestDeepObj);
                            }
                            redis.setRedis(matchContestKey, categories);
                            // resolve(res);
                        }
                    }
                    resolve(res);
                });

            }

        })

    });
}

async function contestAutoCreateAferJoin(contestData, series_id, contest_id, match_id, parentContestId) {
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
            entityM.localteam = '';
            entityM.localteam_id = '';
            entityM.visitorteam = '';
            entityM.visitorteam_id = '';
            entityM.is_auto_create = 1;
            entityM.admin_create = 0;
            entityM.joined_users = 0;
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
                used_bonus:contestData.used_bonus,
                winner_percent:contestData.winner_percent,
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
