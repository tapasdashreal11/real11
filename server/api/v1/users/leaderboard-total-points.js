const Series = require("../../../models/series");
const MeagaLbTotalPoint = require("../../../models/mega-lb-total-point");
const _ = require('lodash');
const { ObjectId } = require("mongodb");
const redis = require('../../../../lib/redis');
const config = require('../../../config');
var imageurl = config.imageBaseUrl;
module.exports = {
    megaLeaderBoardTotalPointsCal: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let {s_id} = req.params; 
            let userId = req.userId;
           let redisKeyForSeriesWeekBoardMeta = 'mega-lb-total-points-';
           redis.getRedisWeekLeaderboard(redisKeyForSeriesWeekBoardMeta, async (err, data) => {
            if (data) {
                 response["data"] = data;
                 response["message"] = "";
                 response["status"] = true;
                 return res.json(response);
            } else {
                let seriesData = await Series.find({mega_leaderboard:1,id_api:s_id});
                if(seriesData && seriesData.length>0){
                let data = await MeagaLbTotalPoint.find({series_id:s_id,user_id:userId});
                 // consoleredis.setRedisWeekLeaderboard(redisKeyForSeriesWeekBoardMeta, newSeriesData);
                 response["data"] = data ? data : [];
                 response["message"] = "";
                 response["status"] = true;
                } else {
                 response["data"] = [];
                 response["message"] = "No Data found!!";
                 response["status"] = false;
                }
                return res.json(response);
            }
           });
        } catch (err) {
            response["msg"] = err.message;
            return res.json(response);
        }
    }
};