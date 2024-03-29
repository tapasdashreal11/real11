const Series = require("../../../models/series");
const MeagaLbTotalPoint = require("../../../models/mega-lb-total-point");
const SeriesLbTotalPoint = require("../../../models/series-lb-total-point");
const WeekLbTotalPoint = require("../../../models/week-lb-total-point");
const _ = require('lodash');
const { ObjectId } = require("mongodb");
const redis = require('../../../../lib/redis');
const config = require('../../../config');
var imageurl = config.imageBaseUrl;
module.exports = {
    megaLeaderBoardTotalPointsCal: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { s_id, user_id, rank, page } = req.params;
            let userRank = rank > 0 ? rank : 600; // Only make redis under 500 rank users so we pass default 600
            let v_page = page ? parseInt(page) : 1;
            let v_skip = v_page ? (v_page - 1) * 20 : 0;
            let v_limit = 20;
            let redisKeyForMegaTotalPoints = 'mega-lb-total-points-' + "-" + s_id + "-" + user_id + "-" + page;
            redis.getRedisForLf(redisKeyForMegaTotalPoints, async (err, data) => {
                if (data) {
                    console.log("redis data is coming mega leader");
                    response["data"] = data;
                    response["message"] = "";
                    response["status"] = true;
                    return res.json(response);
                } else {
                    let seriesData = await Series.find({ mega_leaderboard: 1, id_api: s_id });
                    if (seriesData && seriesData.length > 0) {
                        let data = await MeagaLbTotalPoint.find({ series_id: s_id, user_id: user_id }).skip(v_skip).limit(v_limit).sort({ _id: -1 });
                        if (userRank <= 500) {
                            redis.setRedisForLf(redisKeyForMegaTotalPoints, data);
                        }
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
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    },
    seriesLeaderBoardTotalPointsCal: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { s_id, user_id, rank, page } = req.params;
            let userRank = rank > 0 ? rank : 600; // Only make redis under 500 rank users so we pass default 600
            let v_page = page ? parseInt(page) : 1;
            let v_skip = v_page ? (v_page - 1) * 20 : 0;
            let v_limit = 20;
            let redisKeyForSeriesTotalPoints = 'series-lb-total-points-' + "-" + s_id + "-" + user_id + "-" + page;
            redis.getRedisForLf(redisKeyForSeriesTotalPoints, async (err, data) => {
                if (data) {
                    console.log("redis data is coming series leader");
                    response["data"] = data;
                    response["message"] = "";
                    response["status"] = true;
                    return res.json(response);
                } else {
                    let seriesData = await Series.find({ series_leaderboard: 1, id_api: s_id });
                    if (seriesData && seriesData.length > 0) {
                        let data = await SeriesLbTotalPoint.find({ series_id: s_id, user_id: user_id }).skip(v_skip).limit(v_limit).sort({ _id: -1 });
                        if (userRank <= 500) {
                            redis.setRedisForLf(redisKeyForSeriesTotalPoints, data);
                        }
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
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    },
    weekLeaderBoardTotalPointsCal: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { s_id, user_id, rank, page, w_count } = req.params;
            let userRank = rank > 0 ? rank : 600; // Only make redis under 500 rank users so we pass default 600
            let v_page = page ? parseInt(page) : 1;
            let v_skip = v_page ? (v_page - 1) * 20 : 0;
            let v_limit = 20;
            let redisKeyForWeekTotalPoints = 'week-lb-total-points-' + "-" + s_id +"-"+w_count +"-" + user_id + "-" + page;
            redis.getRedisForLf(redisKeyForWeekTotalPoints, async (err, data) => {
                if (data) {
                    console.log("redis data is coming for week leader");
                    response["data"] = data;
                    response["message"] = "";
                    response["status"] = true;
                    return res.json(response);
                } else {
                    let seriesData = await Series.find({ week_leaderboard: 1, id_api: s_id });
                    if (seriesData && seriesData.length > 0) {
                        let data = await WeekLbTotalPoint.find({ series_id: s_id, week_count: w_count, user_id: user_id }).skip(v_skip).limit(v_limit).sort({ _id: -1 });
                        if (userRank <= 500) {
                            redis.setRedisForLf(redisKeyForWeekTotalPoints, data);
                        }
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
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    }
};