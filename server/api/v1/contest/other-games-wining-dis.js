const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const Transaction = require('../../../models/other-games-transaction');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const LFMyContestModel = require('../../../models/live-fantasy/lf-my-contest-model');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const ludoMqtt = require('../../../../lib/ludo-mqtt');
const { startSession } = require('mongoose');
const UserAnalysis = require("../../../models/user-analysis");
const ContestInvite = require("../../../models/contest-invite");
const CouponSale = require("../../../models/coupon-sale");


module.exports = async (req, res) => {
    try {
        const user_id =  "5f306f588ca80a10802ec53d" //req.userId;
        const { contest_id, match_id, sport, rank_data } = req.body;
        let match_sport = sport ? parseInt(sport) : 3;
        let decoded = {
            match_id: parseInt(match_id),
            contest_id: contest_id,
            user_id: user_id
        }

        var PlayerTeamContestFilter = { 'contest_id': contest_id, 'match_id': decoded['match_id'], is_deleted: 0, winning_amount_notification: 0 }
        let playerTeamRes = await OtherGamesPtc.find(PlayerTeamContestFilter);
        let matchContestData = await OtherGamesContest.findOne({ 'contest_id': decoded['contest_id'], sport: match_sport, match_id: match_id });
        if (matchContestData && matchContestData._id && matchContestData.contest && rank_data && rank_data.length > 0) {
            let contestData = matchContestData.contest;
            var playerContestData = playerTeamRes.filter(item => Number(item.winning_amount) == 0);
            let breakup = contestData.breakup ? contestData.breakup : [];
            if (playerContestData && playerContestData.length > 0) {
                for (const contestTeam of playerContestData) {
                   let rankData = rank_data.map(ri => {
                       let retutnData = {};
                       retutnData['user_id'] = ObjectId(ri.user_id);
                       retutnData['rank:'] = parseInt(ri.rank);
                       return retutnData;
                    });
                   console.log('rankData',rankData,'rank_data',rank_data);
                    let oPTCuserItem = _.find(rankData, { user_id: contestTeam.user_id});
                     console.log('oPTCuserItem',oPTCuserItem,'contestTeam',contestTeam);
                    if (oPTCuserItem && oPTCuserItem.user_id) {
                        let rank = oPTCuserItem.rank ? oPTCuserItem.rank : 0;
                        const txnId = (new Date()).getTime() + contestTeam.user_id;
                        let win_amount = 0;
                        let pricewin_amount = 0;
                        let rankItem = _.find(breakup, { startRank: oPTCuserItem.rank });
                        if (rankItem) {
                            let priceWin = rankItem.price_each;
                            await User.updateOne({ _id: oPTCuserItem.user_id }, { $inc: { winning_balance: parseFloat(priceWin) } })
                            win_amount = priceWin;
                            pricewin_amount = priceWin;
                        }
                        await Transaction.create({
                            "match_id": decoded['match_id'],
                            "contest_id": contestTeam.contest_id,
                            "local_txn_id": txnId,
                            "txn_date": new Date(),
                            "txn_amount": pricewin_amount,
                            "currency": "INR",
                            "added_type": 4,
                            "status": 1,
                            "created": new Date(),
                            "user_id": oPTCuserItem.user_id,
                            "txn_id": "",
                        });
                        await OtherGamesPtc.updateOne({ _id: contestTeam._id }, { $set: { "price_win": pricewin_amount, "winning_amount": win_amount, "rank": rank, "winning_amount_distributed": 1, "winning_amount_notification": 1 } });
                    }
                }
                return res.send(ApiUtility.success("Winning distributed successfully."));
            }
        } else {
            return res.send(ApiUtility.failed("Something went wrong!!"));
        }


    } catch (error) {
        return res.send(ApiUtility.failed(error.message));
    }
}
