const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const OtherGamesContest = require('../../../models/other_games_contest');
const OtherGames = require('../../../models/other_game');
const ObjectId = require('mongoose').Types.ObjectId;
const OtherGameTransaction = require('../../../models/other-games-transaction');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const _ = require("lodash");
const { Validator } = require("node-input-validator");

module.exports = async (req, res) => {
    try {
        const {roomId, matchId, scores} = req.body;
        let response = {};
        let constraints = { roomId: "required", matchId: "required",scores: "required" };
        var apiKey = req.headers['api-key']; 
        let validator = new Validator(req.body, constraints);
        let matched = await validator.check();
        let decoded = { match_id: 111 };
        let match_sport = 3;
        if (!matched) {
            response["success"] = false;
            response["scores"] = [];
            return res.json(response);
        }
        let rankData = scores.map(s => {
            return {rank:s.rank,user_id:ObjectId(s.sub),score:s.score}
        });
        if(_.isEqual(apiKey,config.gamezop_api_key)){
            if(rankData && rankData.length>0){
                let userIds = _.map(rankData,'user_id');
                let zopmatchId = parseInt(matchId);
                let playerTeamRes = await OtherGamesPtc.find({contest_id:ObjectId(roomId),zop_match_id:zopmatchId,user_id:{$in:userIds},is_deleted:0,winning_amount_distributed:0});
    
                let matchContestData = await OtherGamesContest.findOne({ 'contest_id':ObjectId(roomId), sport: match_sport });
                if (matchContestData && matchContestData._id && matchContestData.contest) {
                    let contestData = matchContestData.contest;
                    var playerContestData = playerTeamRes.filter(item => Number(item.winning_amount) == 0);
                    let breakup = contestData.breakup ? _.sortBy(contestData.breakup, ['startRank']) : [];
                    if (playerContestData && playerContestData.length > 0 ) {
                       let transactionData = [];
                       let finalScoreData = [];
                        for (const contestTeam of playerContestData) {
                            let oPTCuserItem = _.find(rankData, { user_id: contestTeam.user_id});
                            if (oPTCuserItem && oPTCuserItem.user_id) {
                                let rank = oPTCuserItem.rank ? oPTCuserItem.rank : 0;
                                let score = oPTCuserItem.score ? oPTCuserItem.score : 0;
                                let finalScoreDataObj ={rank:rank,score: score,sub:""+oPTCuserItem.user_id,currencyIcon: "icon.png"};
                                const txnId = (new Date()).getTime() + contestTeam.user_id;
                                
                                let rankDataGroup = rankData.reduce(function(rv, x) {
                                    (rv[x['rank']] = rv[x['rank']] || []).push(x);
                                    return rv;
                                }, {});
                                let win_amount = 0;
                                let pricewin_amount = 0;
                                let rankItem = breakup && breakup.length>0 ?  breakup.find((item) => oPTCuserItem.rank >= item.startRank && oPTCuserItem.rank <= item.endRank):{};
                                if (rankItem && breakup && breakup.length>0) {
                                    let perTeamPrice = rankItem.price_each ? rankItem.price_each :0;
                                    if (rankDataGroup.hasOwnProperty(rank) && perTeamPrice >0) {
                                        const priceGroup = rankDataGroup[rank];
                                        const priceWin = perTeamPrice / priceGroup.length;
                                        if(priceWin>0) await User.updateOne({ _id: oPTCuserItem.user_id }, { $inc: { winning_balance: parseFloat(priceWin) } })
                                        win_amount = priceWin;
                                        pricewin_amount = priceWin;
                                        transactionData.push({"match_id": decoded['match_id'],"contest_id": contestTeam.contest_id,"local_txn_id": txnId,"txn_date": new Date(),"txn_amount": pricewin_amount,"currency": "INR","added_type": 4,
                                        "status": 1,
                                        "created": new Date(),
                                        "sport": match_sport,
                                        "user_id": oPTCuserItem.user_id,
                                        "txn_id": "",
                                        });
                                     }
                                    
                                }
                                finalScoreDataObj['prize'] = pricewin_amount;
                                finalScoreData.push(finalScoreDataObj);
                                await OtherGamesPtc.updateOne({ _id: contestTeam._id }, { $set: { "price_win": pricewin_amount,"points":score, "winning_amount": win_amount, "rank": rank, "winning_amount_distributed": 1, "winning_amount_notification": 1 } });
                            }
                        }
                        if(transactionData && transactionData.length>0){
                            console.log("***transactionData",transactionData);
                            await OtherGameTransaction.insertMany(transactionData, { ordered: false });
                        }
                        let response = {};
                        response.success = true;
                        response.scores = finalScoreData;
                        console.log('response',response);
                        return res.json(response);
                    } else {
                        // already distributed and update score
                        response["success"] = false;
                         response["scores"] = [];
                        return res.json(response);
                    }
                } else {
                    response["success"] = false;
                    response["scores"] = [];
                    return res.json(response);
                }
    
            }else{
                response["success"] = false;
                response["scores"] = [];
                return res.json(response);
            }
        } else {
            let response = {};
            response["success"] = false;
            response["message"] = "Wrong api key!!";
            return res.json(response);
        }
        
    } catch (error) {
        let response = {};
        console.log("error",error);
        response["success"] = false;
        response["scores"] = [];
        return res.json(response);
    }
}

