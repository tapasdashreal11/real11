const { ObjectId } = require('mongodb');
const _ = require("lodash");
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");
const redis = require('../../../../lib/redis');
module.exports = {
  favouriteContestCreate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
       console.log('test***');
      try {
        let {
            bulkdata
        } = req.body

        console.log('test***1');
        if(bulkdata && _.isArray(bulkdata) && bulkdata.length>0){
            if(bulkdata){
                for (const item of bulkdata) {
                    for (const cData of item.contest_data) {
                        cData.contest_id = ObjectId(cData.contest_id)
                    }
                }
                
                FavouriteContest.insertMany(bulkdata)
                .then(function(mongooseDocuments) {
                    console.log('test***3');
                    console.log(mongooseDocuments);
                    for (const resItem of mongooseDocuments) {
                        let redisKeyForFavouriteContest = 'favourite-contest-' + resItem.user_id;
                        redis.setRedisFavouriteContest(redisKeyForFavouriteContest, resItem);
                    }
                    
                    response['data'] = mongooseDocuments;
                    return res.json(response);
                })
                .catch(function(err) {
                    /* Error handling */
                    console.log('test***4');
                    return res.json(response);
                });
            }
           

        }
        
      } catch (err) {
        console.log(err);
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("ERROR", error.message);
      response["message"] = error.message;
      return res.json(response);
    }
  }
};
