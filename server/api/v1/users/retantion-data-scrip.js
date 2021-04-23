const { ObjectId } = require('mongodb');
const _ = require("lodash");
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");
const redis = require('../../../../lib/redis');
module.exports = {
  favouriteContestCreate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      try {
        let {
            bulkdata
        } = req.body
       await FavouriteContest.deleteMany({});
        return res.json(response);
       /* if(bulkdata && _.isArray(bulkdata) && bulkdata.length>0){
            if(bulkdata){
                for (const item of bulkdata) {
                    for (const cData of item.contest_data) {
                        cData.contest_id = ObjectId(cData.contest_id)
                    }
                }
                
                FavouriteContest.insertMany(bulkdata)
                .then(function(mongooseDocuments) {
                    for (const resItem of mongooseDocuments) {
                        let redisKeyForFavouriteContest = 'favourite-contest-' + resItem.user_id;
                        redis.setRedisFavouriteContest(redisKeyForFavouriteContest, resItem);
                    }
                    response["message"] = "Added Succesfully!!";
                    response["status"] = true;
                    response['data'] = mongooseDocuments;
                    return res.json(response);
                })
                .catch(function(err) {
                    
                    console.log('error in carch bulk',err);
                    return res.json(response);
                });
            }
           

        }*/
        
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      response["message"] = error.message;
      return res.json(response);
    }
  },
  retentionBonousCreate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      try {
        let {
            bulkdata
        } = req.body
        await UserAnalysis.deleteMany({});
        return res.json(response);

        if(bulkdata && _.isArray(bulkdata) && bulkdata.length>0){
            if(bulkdata){
                for (const item of bulkdata) {
                    if(item && item.contest_ids && item.contest_ids.length>0){
                        item.contest_ids = item.contest_ids.map(s => ObjectId(s));
                    }
                }
                UserAnalysis.insertMany(bulkdata)
                .then(function(mongooseDocuments) {
                    for (const resItem of mongooseDocuments) {
                        let redisKeyForUserAnalysis = 'app-analysis-' + resItem.user_id + '-' + resItem.match_id +  '-' + resItem.sport;
                        redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, resItem);
                    }
                    response["message"] = "Added Succesfully!!";
                    response["status"] = true;
                    response['data'] = mongooseDocuments;
                    return res.json(response);
                })
                .catch(function(err) {
                    /* Error handling */
                    console.log('error in carch bulk',err);
                    return res.json(response);
                });
            }
        }
        
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      response["message"] = error.message;
      return res.json(response);
    }
  }
};
