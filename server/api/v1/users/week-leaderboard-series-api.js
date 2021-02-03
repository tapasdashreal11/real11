const Series = require("../../../models/series");
const _ = require('lodash');
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
        try {  
           return res.json(response);
        } catch (err) {
            response["msg"] = err.message;
            return res.json(response);
        }
    }
};