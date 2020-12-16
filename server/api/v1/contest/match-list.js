const { ObjectId } = require('mongodb');
const SeriesSquad = require('../../../models/series-squad');
const ModelService = require("../../ModelService");
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const redis = require('../../../../lib/redis');
const moment = require('moment');
const _ = require("lodash");
const { sendMailToDeveloper } = require('./../common/helper');
// const fs = require('fs');
// const asyncp = require("async");
// const { RedisKeys } = require('../../constants/app');

module.exports = {
    matchList: async (req, res) => {
        try {
            let data1 = {};
            let sport   =   parseInt(req.params.sport || 1);
            const upCommingMatch = await (new ModelService(SeriesSquad)).getMatchList(sport);
            let liveData = [];
            let finishData = [];
            data1.upcoming_match = upCommingMatch;
            data1.total = upCommingMatch.length;
            data1.live_match = liveData;
            data1.completed_match = finishData;
            data1.version_code = 48;
            data1.message_show = 0;
            data1.message = 'Test Message';
            data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
            // data1.apk_url = `http://13.232.51.228:3005/img/Real11.apk`;
            data1.apk_url = `http://real11.com/Real11.apk`;

            var successObj = ApiUtility.success(data1);
            redis.setRedis('match-list', successObj)
            res.send(successObj);
        } catch (error) {
            console.log(error);
            sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
}

