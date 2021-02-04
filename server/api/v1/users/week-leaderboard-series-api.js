const Series = require("../../../models/series");
const WeekLeaderboard = require("../../../models/week-leaderboard");
const _ = require('lodash');
const { ObjectId } = require("mongodb");
const redis = require('../../../../lib/redis');
module.exports = {
    weekLeaderBoardSeriesApi: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
           let seriesData = await Series.find({week_leaderboard:1});
           if(seriesData && seriesData.length>0){
            response["data"] = seriesData;
            response["message"] = "";
            response["status"] = true;
           } else {
            response["data"] = [];
            response["message"] = "";
            response["status"] = true;
           }
            
           return res.json(response);
        } catch (err) {
            response["msg"] = err.message;
            return res.json(response);
        }
    },
    weekLeaderBoardSeriesWeeksData: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        let {s_id,w_count} = req.params;
        const user_id = "5f306f588ca80a108031c7d0"; //req.userId;
        let redisKeyForWeekLeaderBorad = 'week-leaderboard-user-data-' + s_id + '-' + w_count;
        console.log(s_id,w_count);
        try { 
            if(user_id){
                //var wData = await WeekLeaderboard.find({series_id:s_id,week_count:w_count,user_id:ObjectId(auth_user_id)});
                redis.getRedisWeekLeaderboard(redisKeyForWeekLeaderBorad, async (err, data) => {
                    if (data) {
                        response["data"] = data;
                        response["message"] = "";
                        response["status"] = true;
                        return res.json(response);
                    } else {

                       await WeekLeaderboard.aggregate([
                            {
                                $match: {series_id:parseInt(s_id),week_count:parseInt(w_count)}
                            },
                            {
                                $lookup: {
                                    from: 'users',
                                    localField: "user_id",
                                    foreignField: "_id",
                                    as: 'user_detail',
                                }
                            },
                            {
                                $unwind: {
                                    path: "$user_detail",
                                    preserveNullAndEmptyArrays: false // optional
                                }
                            },
                            {
                                $project : {
                                    "user_id" : "$user_detail._id",
                                    "team_name" : "$user_detail.team_name",
                                    "total_points" : "$total_points",
                                    "pre_rank" : "$pre_rank",
                                    "current_rank" : "$current_rank",
                                    "series_id" : "$series_id"
                                }
                            }
                        ], (err, data) => {
                            if (err) {
                                
                            }
                            if (!err) {
                                console.log(data);
                                if(data && data.length>0){
                                    redis.setRedisWeekLeaderboard(redisKeyForWeekLeaderBorad, data);
                                    response["data"] = data;
                                    response["message"] = "";
                                    response["status"] = true;
                                    return res.json(response);
                                } else {
                                    response["data"] = [];
                                    response["message"] = "No data found!!";
                                    response["status"] = true;
                                    return res.json(response);
                                }
                            }
                        });
                    }
                  });
            }else{
                response["message"] = "Incorrect Params!!";
                return res.json(response);
            } 
           
        } catch (err) {
            response["msg"] = err.message;
            return res.json(response);
        }
    }
};