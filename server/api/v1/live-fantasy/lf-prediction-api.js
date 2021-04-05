const Prediction = require('../../../models/live-fantasy/lf-prediction');
const MatchList = require('../../../models/live-fantasy/lf-match-list-model');
const LFPlayerTeamContest = require('../../../models/live-fantasy/lf_joined_contest');
const ApiUtility = require('../../api.utility');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const config = require('../../../config');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const { RedisKeys } = require('../../../constants/app');
const Settings = require("../../../models/settings");

module.exports = {
    
    createPrediction: async (req, res) => {
        let {
            series_id, match_id, sport, team_count,prediction,prediction_array
        } = req.body
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        let data1 = {}, message = "";
        try {
            if (!series_id || !match_id || !sport || !_.isArray(prediction_array)) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
            let listKey = 'lf-user-prediction-list-' + match_id + '-' + series_id + '-' + user_id;
            let countRedisKey = 'lf-user-teams-count-' + match_id + '-' + series_id + '-' + user_id;
            let liveMatch = await MatchList.findOne({ match_id: match_id, series_id: series_id, sport: sport });
            if (liveMatch) {
                    let teamDataa = [];
                    team_count = await Prediction.find({
                        user_id: user_id,
                        match_id: match_id,
                        series_id: series_id,
                        sport: sport
                    }).count();
                    const totalTemCount = 10;
                    console.log('create pppp',prediction_array);
                    if(prediction_array && prediction_array.length<6){
                        return res.send(ApiUtility.failed("Prediction data is not in format!!"));
                     }
                    let new_predit_dic = {};
                    for (item in prediction_array){
                        new_predit_dic = {...new_predit_dic,...prediction_array[item]['value']}
                    }
                   
                    if (team_count < totalTemCount) {
                        team_count += 1;
                        let team = {
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            team_count: team_count,
                            sport: sport,
                            prediction: new_predit_dic,
                            prediction_array: prediction_array,
                            created: new Date()
                        };
                        let teamId = new ObjectId()
                        team._id = teamId;
                        redis.setRedisForLf(countRedisKey, team_count);
                        let newTeam    =   await Prediction.collection.insertOne(team);
                        message = "Prediction has been created successfully.";
                        data1.message = message;
                        if(newTeam && newTeam.ops){
                            console.log('newTeam ops****',newTeam.ops);
                            data1._id= newTeam.ops[0]._id;
                            data1.team_count = newTeam.ops[0].team_count;
                            data1.prediction_array= newTeam.ops[0].prediction_array;
                        }
                        redis.setRedisForLf(listKey, []);
                        return res.send(ApiUtility.success(data1));
                       
                    } else {
                        return res.send(ApiUtility.failed("You can not create prediction more than "+ totalTemCount + "."));
                    } 
                

            } else {
                message = "This Prediction is already created!!"
                return res.send(ApiUtility.failed(message));
            }
        } catch (error) {
            console.log("Create predction****", error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
    predictionList: async (req, res) => {
        let {
            series_id, match_id, sport
        } = req.params;
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        try {
            if (!series_id || !match_id || !sport) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
           let listKey = 'lf-user-prediction-list-' + match_id + '-' + series_id + '-' + user_id;
           let respons = {}
            respons.message = '';        
            redis.getRedisForLf(listKey, async (err, pListData) => {
               if (pListData && pListData.length>0) {
                   console.log('Prdction List data coming from redis***');
                   respons.list_data = pListData || [];
                   respons.match_type = "live-fantasy";
                   return res.send(ApiUtility.success(respons));
                } else {
                    let pList = await Prediction.find({
                        user_id: user_id,
                        match_id: match_id,
                        series_id: series_id
                    }).sort({"team_count":1});
                    console.log('Prdction List data coming from DB***');
                    respons.list_data = pList || [];
                    respons.match_type = "live-fantasy";
                    if(pList && pList.length>0){
                     redis.setRedisForLf(listKey, pList);
                    }
                    return res.send(ApiUtility.success(respons));
                }
            });
           
           
            
        } catch (error) {
            console.log("predction list error****", error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
    updatePrediction: async (req, res) => {
        let {
            series_id, match_id,record_id,prediction,prediction_array
        } = req.body
        let user_id = req.userId;
        let data1 = {}, message = "";
        try {
            if (!series_id || !match_id || !record_id || !_.isArray(prediction_array) || !user_id) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
            if(prediction_array && prediction_array.length < 6){
                return res.send(ApiUtility.failed("Prediction data not in format!!"));
             }
            let new_predit_dic = {};
            let listKey = 'lf-user-prediction-list-' + match_id + '-' + series_id + '-' + user_id;
            for (item in prediction_array){
                new_predit_dic = {...new_predit_dic,...prediction_array[item]['value']}
            }
            let updateData = {};
            if(prediction_array){
                updateData['prediction'] = new_predit_dic;
                updateData['prediction_array'] = prediction_array;
            }
            

            let liveMatch = await MatchList.findOne({ match_id: match_id, series_id: series_id });
            if (liveMatch && user_id && updateData && updateData.prediction) {
                    await Prediction.updateOne({_id:ObjectId(record_id) },{"$set":updateData});
                    let playerTeamRes = await LFPlayerTeamContest.findOne({prediction_id:ObjectId(record_id)});
                    if(playerTeamRes && playerTeamRes.prediction_id && new_predit_dic){
                        await LFPlayerTeamContest.updateOne({_id:ObjectId(playerTeamRes._id) },{"$set": {prediction : new_predit_dic}});
                     }

                    message = "Predication has been updated successfully.";
                    data1.message = message;
                    redis.setRedisForLf(listKey, []);
                    return res.send(ApiUtility.success(data1));

            } else {
                message = "Something went wrong!!"
                return res.send(ApiUtility.failed(message));
            }
        } catch (error) {
            console.log("update predction****", error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
    lfPointSystem: async (req, res) => {
        let user_id = req.userId;
        let respons = {}
        try {
           let point_manager = {
                '17' : 6,
                '1' : 4,
                '2' : 8,
                '3' : 16,
                '4' : 20,
                '5' : 50,
                '6' : 32,
                '7' : 70,
                '8' : 60,
                '9' : 120,
                '10' : 110,
                '11' : 130,
                '12' : 180,
                '13' : 140,
                '14' : 200,
                '15' : 240,
                '16' : 2,
            }
            respons.point_list = point_manager;
            respons.divide_by = 8;
            respons.point_sign = "-";

            return res.send(ApiUtility.success(respons));
            
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    }
}

