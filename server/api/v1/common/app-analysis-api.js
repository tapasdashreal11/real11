const UserAnalysis = require("../../../models/user-analysis");
const redis = require('../../../../lib/redis');
module.exports = async (req, res) => {
    let { match_id, sport, series_id } = req.params;
    const user_id = req.userId;
    var response = { status: false, message: "Invalid Request", data: {} };
    if (match_id && series_id && user_id) {
        let match_sport = sport ? parseInt(sport) : 1;
        let prams_match_id = match_id ? parseInt(match_id) : 1;
        let prams_series_id = series_id ? parseInt(series_id) : 1;
        // redis keys 
        let redisKey = 'app-analysis-' + user_id + '-' + prams_match_id + '-' + prams_series_id;
        try {
            redis.getRedisForUserAnaysis(redisKey, async (err, data) => {
                if (data) {
                    console.log('hello redis ');
                    response["data"] = data;
                } else {
                    let fileds = { match_name: 1, match_id: 1, user_id: 1, series_id: 1, is_offer_type: 1, contest_ids: 1, sport: 1, offer_amount: 1, offer_percent: 1 };
                    let userAnalysisData = await UserAnalysis.findOne({ user_id: user_id, match_id: prams_match_id, series_id: prams_series_id, sport: match_sport }, fileds);
                    if (userAnalysisData && userAnalysisData._id) {
                        userAnalysisData.offer_amount = userAnalysisData.offer_amount? parseFloat(userAnalysisData.offer_amount):0;
                        userAnalysisData.offer_percent = userAnalysisData.offer_percent? parseFloat(userAnalysisData.offer_percent):0;
                        redis.setRedisForUserAnaysis(redisKey, userAnalysisData);
                        response["status"] = true;
                        response["data"] = userAnalysisData;
                    } else {
                        response["status"] = false;
                        response["data"] = {};
                    }
                }
                response["message"] = "";
                return res.json(response);
            });
        } catch (err) {
            console.log('catch', err);
            response["msg"] = err.message;
            return res.json(response);
        }
    } else {
        return res.json(response);
    }

};
