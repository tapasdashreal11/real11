const { ObjectId } = require('mongodb');
const _ = require("lodash");
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");

module.exports = {
  favouriteContestCreate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };

      try {
        let {
            bulkdata
        } = req.body


        if(bulkdata && _.isArray(bulkdata) && bulkdata.length>0){
            if(bulkdata &&  bulkdata.contest_data && bulkdata.contest_data.length){
                for (const cData of bulkdata.contest_data) {
                    cData.contest_id = ObjectId(cData.contest_id)
                }
            }
            FavouriteContest.insertMany(bulkdata)
            .then(function(mongooseDocuments) {
                console.log(mongooseDocuments);
                response['data'] = mongooseDocuments;
                return res.json(response);
            })
            .catch(function(err) {
                /* Error handling */
                return res.json(response);
            });

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
