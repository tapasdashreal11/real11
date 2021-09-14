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
        let data1 = {};
        let startTime = Date.now();
        const user_id = req.userId;
        const {contest_id, match_id, sport,ptc_id } = req.body;
        let match_sport = sport ? parseInt(sport) : 3;
        let decoded = {
            match_id: parseInt(match_id),
            contest_id: contest_id,
            user_id: user_id
        }
        
        if(contest_id && match_id && user_id){
           let ptcItem  = await OtherGamesPtc.findOne({_id:ptc_id});
           if(ptcItem && ptcItem._id){
            const doc = await OtherGamesContest.findOneAndUpdate({ 'match_id': decoded['match_id'],'is_full':0, 'sport': match_sport,'joined_users':{$gt:0} ,'contest_id': contest_id }, { $inc: { joined_users: -1 },$set: { is_full: 0 } });
            if(doc){
                await OtherGamesPtc.updateOne({_id:ptc_id},{$set:{is_deleted:1}});
                
                return res.send(ApiUtility.success(data1, 'Contest cancel successfully.'));
            } else {
                console.log('in elase');
                return res.send(ApiUtility.failed("Something went wrong!!"));
     
            }
            
           }
         } else {
            console.log('last elase');
           return res.send(ApiUtility.failed("Something went wrong!!"));

         }

       
    } catch (error) {
        console.log(error);
        return res.send(ApiUtility.failed(error.message));
    }
}

