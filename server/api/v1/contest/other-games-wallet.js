const { ObjectId } = require('mongodb');
const OtherGamesContest = require('../../../models/other_games_contest');
const CouponSale = require("../../../models/coupon-sale");
const LudoOffer = require("../../../models/ludo_offer");
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
    otherGameContestWallet: async (req, res) => {
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
            let userdata = await User.findOne({ _id: decoded['user_id'] });
            if(userdata && userdata.fair_play_violation && userdata.fair_play_violation ==1){
                return res.send(ApiUtility.failed("You can't join contest.You are under fair play violation!!"));
            }
            if (userdata) {
                adminPer = 0; //(setting.admin_percentage) ? setting.admin_percentage : 0;
                let useableBonusPer = adminPer;
                let entryFee = 0;
                    
                    matchContestData = await OtherGamesContest.findOne({ 'contest_id': decoded['contest_id'],sport: match_sport, match_id: match_id });
                    if(matchContestData && matchContestData._id && matchContestData.contest){
                        if (decoded['contest_id']) {
                            let contestData = {};  // await OtherGamesContest.findOne({ 'contest_id': decoded['contest_id'] });
                            //console.log("ludoOffer***",ludoOffer);
                             
                             contestData = matchContestData.contest;

                             entryFee = (contestData && contestData.entry_fee) ? contestData.entry_fee : 0;
                             
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
                                const ludoOffer = await LudoOffer.findOne({user_id:decoded['user_id'],status: 1,match_id: match_id,expiry_date:{$gte:new Date()}  });
                                
                                let pContestId = contest_id; //ObjectId(contest_id);
                                let prContestId = matchContestData && matchContestData.parent_contest_id ? String(matchContestData.parent_contest_id):matchContestData.contest_id;
                                if(ludoOffer && ludoOffer._id){
                                    let cBonus =  ludoOffer && ludoOffer.contest_bonous?ludoOffer.contest_bonous:[]; 
                                    let cBonusItem =  cBonus.find(function(el){
                                        if(ObjectId(el.contest_id).equals(ObjectId(prContestId)) || ObjectId(el.contest_id).equals(ObjectId(pContestId))){
                                            return el
                                          }
                                        });
                                     if(cBonusItem && cBonusItem.contest_id ){
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
                                        if (extraBalance && !userdata.xtra_cash_block) {
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
                                console.log("retention_bonus_amount",retention_bonus_amount);
                                data['cash_balance'] = (cashBalance) ? cashBalance : 0;
                                data['winning_balance'] = (winningBalance) ? winningBalance : 0;
                                data['usable_bonus'] = usableAmt ? parseFloat(usableAmt.toFixed(2)) : 0;
                                data['extra_amount'] = 0; //extraAmount ? parseFloat(extraAmount.toFixed(2)) : 0;
                                data['entry_fee'] = (entryFee) ? parseInt(entryFee) : 0;
                                data['user_offer_amount'] = (retention_bonus_amount) ? parseFloat(retention_bonus_amount.toFixed(2)) : 0;
                                data['calculated_entry_fee'] = (calEntryFees && _.isNumber(calEntryFees)) ? parseFloat(calEntryFees.toFixed(2)) : 0;
                                data['usable_bonus_percent'] = 0;
                                data['is_offer_applied'] = is_offer_applied;
                                data1 = data;
                                res.send(ApiUtility.success(data1)); 
                            });
                        } catch (err) {
                            consolelog('error in catch block in cache****',err);
                            return res.send(ApiUtility.failed("Something went wrong!!"));
                        }
                     } else {
                        return res.send(ApiUtility.failed("Contest not found."));
                    }
            } else {
                return res.send(ApiUtility.failed("User not found."));
            }
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    }
}
