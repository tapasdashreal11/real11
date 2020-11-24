const Settings = require("../../../models/settings");
const redis = require('../../../../lib/redis');
module.exports = async (req, res) => {
    var response = { status: false, message: "Invalid Request", data: {} };
    try {
        redis.getRedis('app-sport-setting',async (err, data) => {
            if(data){
                response["data"] = data;
            } else {
                let appSettingData = await Settings.findOne({},{priority_match_sport:1});
                redis.setRedis('app-sport-setting', appSettingData);
                response["data"] = appSettingData;
            }
            response["message"] = "";
            response["status"] = true;
            return res.json(response);
        });
    } catch (err) {
      console.log('catch',err);
      response["msg"] = err.message;
      return res.json(response);
    }
};
