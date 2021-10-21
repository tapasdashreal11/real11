const Series = require("../../../models/series");
const WeekLeaderboard = require("../../../models/week-leaderboard");
const SeriesLeaderboard = require("../../../models/series-leaderboard");
const _ = require('lodash');
const { ObjectId } = require("mongodb");
const redis = require('../../../../lib/redis');
const config = require('../../../config');
var imageurl = config.imageBaseUrl;
module.exports = {
    weekLeaderBoardSeriesApi: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
           let redisKeyForSeriesWeekBoardMeta = 'series-week-leaderboard-meta';
           redis.getRedisWeekLeaderboard(redisKeyForSeriesWeekBoardMeta, async (err, data) => {
            if (data) {
                 response["data"] = data;
                 response["message"] = "";
                 response["status"] = true;
                 return res.json(response);
            } else {
                let seriesData = await Series.find({$or:[{week_leaderboard:1},{series_leaderboard:1}]});
                if(seriesData && seriesData.length>0){
                 let newSeriesData = seriesData.map((val)=>{
                     let return_data = JSON.parse(JSON.stringify(val));
                     return_data['img_path']= imageurl+"/";
                     return return_data;
                 });
                 redis.setRedisWeekLeaderboard(redisKeyForSeriesWeekBoardMeta, newSeriesData);
                 response["data"] = newSeriesData;
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
    },
    weekLeaderBoardSeriesWeeksData: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        let {s_id,w_count,page} = req.params;
        let v_page = page ? parseInt(page): 0;
        let v_skip = v_page ?  v_page*500: 0;
        let v_limit = 500;
        const user_id = req.userId;
        let redisKeyForWeekLeaderBorad = 'week-leaderboard-user-data-' + s_id + '-' + w_count+'-'+v_page;
        
        let myTeamData = { "user_id" : user_id,"team_name" : "My Team","total_points" : 0,"current_rank" : 0,"gadget_name":"","win_msz":"","win_distribute":0,"win_widget":""}
        try { 
            if(user_id && s_id && w_count){
                var myWData = await WeekLeaderboard.findOne({series_id:parseInt(s_id),week_count:parseInt(w_count),user_id:ObjectId(user_id)});
                if(myWData && myWData._id){
                    myTeamData['total_points'] = myWData.total_points;
                    myTeamData['current_rank'] = myWData.current_rank;
                    myTeamData['gadget_name'] = myWData.gadget_name ? myWData.gadget_name:"";
                    myTeamData['win_msz'] = myWData.win_msz ? myWData.win_msz:"";
                    myTeamData['win_distribute'] = myWData.win_distribute ? myWData.win_distribute:0;
                    myTeamData['win_widget'] = myWData.win_widget ? (imageurl + "/" + myWData.win_widget):'';
                }
                redis.getRedisWeekLeaderboard(redisKeyForWeekLeaderBorad, async (err, data) => {
                    if (data) {
                        let finalData = mergedTeam = [...[myTeamData], ...data];
                        response["data"] = finalData;
                        response["message"] = "";
                        response["status"] = true;
                        return res.json(response);
                    } else {

                       await WeekLeaderboard.aggregate([
                            {
                                $match: {series_id:parseInt(s_id),week_count:parseInt(w_count)}
                            },{$sort: {current_rank: 1}},
                            {
                                $skip: v_skip
                            },
                            {
                                $limit: v_limit
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
                                    "avatar" : "$user_detail.avatar",
                                    "total_points" : "$total_points",
                                    "current_rank" : "$current_rank",
                                    "gadget_name":{ $ifNull: [ "$gadget_name", '' ] },
                                    "win_msz":{ $ifNull: [ "$win_msz", '' ] },
                                    "win_distribute":{ $ifNull: [ "$win_distribute", 0 ] },
                                    "win_widget":{$cond: { if: { $ne: [ "$win_widget", '' ] }, then: { $concat: [ imageurl, "/", "$win_widget" ] }, else : ''}},
                                }
                            }
                        ], (err, data) => {
                            if (err) {
                                
                            }
                            if (!err) {
                                if(data && data.length>0){
                                    redis.setRedisWeekLeaderboard(redisKeyForWeekLeaderBorad, data);
                                    let finalData = mergedTeam = [...[myTeamData], ...data];
                                    response["data"] = finalData;
                                    response["message"] = "";
                                    response["status"] = true;
                                    return res.json(response);
                                } else {
                                    response["data"] = [];
                                    response["message"] = "No data found!!";
                                    response["status"] = false;
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
    },
    seriesLeaderBoardData: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        let {s_id,page} = req.params;
        let v_page = 0; // page ? parseInt(page): 0;
        let v_skip = v_page ?  v_page*500: 0;
        let v_limit = 500;
        const user_id = req.userId;
        let redisKeyForseriesLeaderBoard = 'series-leaderboard-user-data-' + s_id +'-'+v_page;
        let myTeamData = { "user_id" : user_id,"team_name" : "My Team","total_points" : 0,"current_rank" : 0,"gadget_name":"","win_msz":"","win_distribute":0,"win_widget":""}
        try { 
            if(user_id && s_id){
                var myWData = await SeriesLeaderboard.findOne({series_id:parseInt(s_id),user_id:ObjectId(user_id)});
                if(myWData && myWData._id){
                    myTeamData['total_points'] = myWData.total_points;
                    myTeamData['current_rank'] = myWData.current_rank;
                    myTeamData['gadget_name'] = myWData.gadget_name ? myWData.gadget_name:"";
                    myTeamData['win_msz'] = myWData.win_msz ? myWData.win_msz:"";
                    myTeamData['win_distribute'] = myWData.win_distribute ? myWData.win_distribute:0;
                    myTeamData['win_widget'] = myWData.win_widget ? (imageurl + "/" + myWData.win_widget):'';
                }
                redis.getRedisWeekLeaderboard(redisKeyForseriesLeaderBoard, async (err, data) => {
                    if (data) {
                        let finalData = mergedTeam = [...[myTeamData], ...data];
                        response["data"] = finalData;
                        response["message"] = "";
                        response["status"] = true;
                        return res.json(response);
                    } else {

                       await SeriesLeaderboard.aggregate([
                            {
                                $match: {series_id:parseInt(s_id)}
                            },{$sort: {current_rank: 1}},
                            {
                                $skip: v_skip
                            },
                            {
                                $limit: v_limit
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
                                    "avatar" : "$user_detail.avatar",
                                    "total_points" : "$total_points",
                                    "current_rank" : "$current_rank",
                                    "gadget_name":{ $ifNull: [ "$gadget_name", '' ] },
                                    "win_msz":{ $ifNull: [ "$win_msz", '' ] },
                                    "win_distribute":{ $ifNull: [ "$win_distribute", 0 ] },
                                    "win_widget":{$cond: { if: { $ne: [ "$win_widget", '' ] }, then: { $concat: [ imageurl, "/", "$win_widget" ] }, else : ''}},
                                }
                            }
                        ], (err, data) => {
                            if (err) {
                                
                            }
                            if (!err) {
                                if(data && data.length>0){
                                    redis.setRedisWeekLeaderboard(redisKeyForseriesLeaderBoard, data);
                                    let finalData = mergedTeam = [...[myTeamData], ...data];
                                    response["data"] = finalData;
                                    response["message"] = "";
                                    response["status"] = true;
                                    return res.json(response);
                                } else {
                                    response["data"] = [];
                                    response["message"] = "No data found!!";
                                    response["status"] = false;
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