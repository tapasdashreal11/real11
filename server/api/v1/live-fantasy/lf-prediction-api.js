const Prediction = require('../../../models/live-fantasy/lf-prediction');
const MatchList = require('../../../models/live-fantasy/lf-match-list-model');
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
            series_id, match_id, sport, team_count,prediction
        } = req.body
        let user_id = req.userId;
        sport = parseInt(sport) || 1;
        let data1 = {}, message = "";
        try {
            if (!series_id || !match_id || !sport) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
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
                    if (team_count < totalTemCount) {
                        team_count += 1;
                        let team = {
                            user_id: user_id,
                            match_id: match_id,
                            series_id: series_id,
                            team_count: team_count,
                            sport: sport,
                            prediction: prediction,
                            created: new Date()
                        };
                        let teamId = new ObjectId()
                        team._id = teamId;
                        let newTeam    =   await Prediction.collection.insertOne(team);
                        message = "Prediction has been created successfully.";
                        data1.message = message;
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
           let pList = await Prediction.find({
                user_id: user_id,
                match_id: match_id,
                series_id: series_id,
                sport: sport
            });
           let respons = {}
            respons.message = '';
            respons.prediction = pList || [];
            return res.send(ApiUtility.success(respons));
            
        } catch (error) {
            console.log("Create predction****", error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
    updatePrediction: async (req, res) => {
        let {
            series_id, match_id,record_id,prediction
        } = req.body
        let user_id = req.userId;
        let data1 = {}, message = "";
        try {
            if (!series_id || !match_id || !record_id ||!prediction || !user_id) {
                return res.send(ApiUtility.failed('Please send proper data'));
            }
            let liveMatch = await MatchList.findOne({ match_id: match_id, series_id: series_id });
            if (liveMatch && user_id) {
                    await Prediction.updateOne({_id:ObjectId(record_id) },{"$set":{prediction:prediction}}); 
                    message = "Predication has been updated successfully.";
                    data1.message = message;
                    return res.send(ApiUtility.success(data1));

            } else {
                message = "Something went wrong!!"
                return res.send(ApiUtility.failed(message));
            }
        } catch (error) {
            console.log("update predction****", error)
            return res.send(ApiUtility.failed(error.message));
        }
    }
}

