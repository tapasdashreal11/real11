const { ObjectId } = require('mongodb');
const _ = require("lodash");
const SeriesSquad = require("../../../models/series-squad");
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");
const Notification = require("../../../models/notification");
const redis = require('../../../../lib/redis');
module.exports = {
  favouriteContestCreate: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      try {
        let {
            bulkdata
        } = req.body
      
        if(bulkdata && _.isArray(bulkdata) && bulkdata.length>0){
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
           

        }
        
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
  },
  retentionBonousThreeType: async (req, res) => {
    try {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { sport, match_id, series_id, offer_data } = req.body;

            let decoded = { match_id: parseInt(match_id), series_id: parseInt(series_id) };

            if (match_id && series_id) {
                const seriesData = await SeriesSquad.findOne({ match_id: decoded['match_id'], series_id: decoded['series_id'] });
                if (seriesData && seriesData._id) {
                    if (seriesData.is_offer_added && seriesData.is_offer_added == 1) {
                        // Offer already added in this match
                        response["message"] = "Offer already added in this match";
                        return res.json(response);

                    } else {
                        // offer need to be add in this match
                        let offerUserData = offer_data || [];
                        if (offerUserData && offerUserData.length > 0) {
                            let bulkdata = [];
                            for (const item of offerUserData) {
                                let itemData = {
                                    "match_id": decoded['match_id'],
                                    "series_id": decoded['series_id'],
                                    "is_offer_type": 3,
                                    "sport": parseInt(sport),
                                    "offer_amount": 0,
                                    "offer_percent": 0,
                                    "match_name": "Admin Added Bonous",
                                    "contest_ids": [],
                                    "contest_bonous": item.offer_bonus,
                                    "user_id": item.user_id
                                }
                                bulkdata.push(itemData);
                            }

                            if (bulkdata && _.isArray(bulkdata) && bulkdata.length > 0) {
                                UserAnalysis.insertMany(bulkdata, { ordered: false })
                                    .then(async function (mongooseDocuments) {
                                        let notifyObjArray = [];
                                        for (const resItem of mongooseDocuments) {
                                            let redisKeyForUserAnalysis = 'app-analysis-' + resItem.user_id + '-' + resItem.match_id + '-' + resItem.sport;
                                            redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, resItem);
                                            let notifyObj = {
                                                user_id: resItem.user_id,
                                                notification_type: 11,
                                                title: seriesData.localteam + " VS " + seriesData.visitorteam + "!!",
                                                notification: "Offer code for this match successfully activated. You can now enter the contest for this match with the availed offer. !!",
                                                date: new Date(seriesData.date),
                                                status: 1,
                                                is_send: 1
                                            };
                                            notifyObjArray.push(notifyObj);
                                        }
                                        if (notifyObjArray.length > 0) {
                                            await Notification.insertMany(notifyObjArray, { ordered: false })
                                                .then(function (ddd) {
                                                })
                                                .catch(async function (err) {
                                                    /* Error handling */
                                                    console.log("Something has in notifiction create****", err);
                                                });
                                            await SeriesSquad.findOneAndUpdate({ match_id: decoded['match_id'], series_id: decoded['series_id'] }, { $set: { is_offer_added: 1 } });
                                            response["message"] = "Added Succesfully!!";
                                            response["status"] = true;
                                            response['data'] = mongooseDocuments;
                                            return res.json(response);
                                        }

                                    })
                                    .catch(async function (err) {
                                        /* Error handling */
                                        if (err && err.insertedDocs && err.insertedDocs.length > 0) {
                                            console.log('Bonous Entry from error due to duplicate ***');
                                            let notifyObjArray = [];
                                            for (const resItem of err.insertedDocs) {
                                                let redisKeyForUserAnalysis = 'app-analysis-' + resItem.user_id + '-' + resItem.match_id + '-' + resItem.sport;
                                                redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, resItem);
                                                let notifyObj = {
                                                    user_id: resItem.user_id,
                                                    notification_type: 11,
                                                    title: seriesData.localteam + " VS " + seriesData.visitorteam + "!!",
                                                    notification: "Offer code for this match successfully activated. You can now enter the contest for this match with the availed offer. !!",
                                                    date: new Date(seriesData.date),
                                                    status: 1,
                                                    is_send: 1
                                                };
                                                notifyObjArray.push(notifyObj);
                                            }
                                            if (notifyObjArray.length > 0) {
                                                await Notification.insertMany(notifyObjArray, { ordered: false })
                                                    .then(function (ddd) {
                                                    })
                                                    .catch(async function (err) {
                                                        /* Error handling */
                                                        console.log("Something has in notifiction create****", err);
                                                    });
                                                await SeriesSquad.findOneAndUpdate({ match_id: decoded['match_id'], series_id: decoded['series_id'] }, { $set: { is_offer_added: 1 } });
                                                response["message"] = "Added Succesfully!!";
                                                response["status"] = true;
                                                response['data'] = [];
                                                return res.json(response);
                                            }

                                        } else {
                                            console.log('Error at time of boous type 3 create in macth****', err);
                                            return res.json(response);
                                        }
                                    });
                            }
                        }else{
                          response["message"] = "No data in proper format";
                          return res.json(response);
                        }
                    }
                } else {
                    // Series data not found
                    return res.json(response);
                }
            } else {
                // match Id or series id are not in params
                return res.json(response);
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
