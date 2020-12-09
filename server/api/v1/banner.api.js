const Banner = require('../../models/banner');
const User = require('../../models/user');
const ApiUtility = require('../api.utility');
const config = require('../../config');
const ModelService = require("../ModelService");
const redis = require('../../../lib/redis');
const { RedisKeys } = require('../../constants/app');

let ObjectId = require('mongodb').ObjectID;

module.exports = {
    bannerList: async (req, res) => {
        try {
            let bannerData = [];
            let bannerListKey = RedisKeys.BANNER_LIST; 
            redis.getRedis(bannerListKey, async (err, bannerData) =>{
                if(!bannerData){
                    bannerData = await (new ModelService(Banner)).getBannerList();
                    redis.setRedis(bannerListKey,bannerData,RedisKeys.TIME_10_DAYS);
                } else {
                    return res.send(ApiUtility.success(bannerData));
                }
            });

            // bannerData = await (new ModelService(Banner)).getBannerList();
            // return res.send(ApiUtility.success(bannerData));
        } catch (error){
            res.send(ApiUtility.failed(error.message));
        }
    },
}