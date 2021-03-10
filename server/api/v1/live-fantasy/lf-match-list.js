const { ObjectId } = require('mongodb');
const LiveFantasyMatchList = require('../../../models/live-fantasy/lf-match-list-model');
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const redis = require('../../../../lib/redis');
const moment = require('moment');
const _ = require("lodash");
const { sendMailToDeveloper } = require('./../common/helper');


module.exports = {
    liveFantasyMatchList: async (req, res) => {
        try {
            let data1 = {};
            let {pmatch_id,sport} = req.params;
            const upCommingMatch = await LiveFantasyMatchList.find({over_parent_id:pmatch_id,time: {$gte: new Date()}, status:1,match_status:"Not Started"}).limit(40).sort({_id:-1});
            let liveData = [];
            let finishData = [];
            data1.upcoming_match = upCommingMatch;
            data1.total = upCommingMatch.length;
            data1.live_match = liveData;
            data1.completed_match = finishData;
            data1.message = 'Test Message';
            data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
            var successObj = ApiUtility.success(data1);
            redis.setRedisForLf('lf-match-list-'+ pmatch_id + '-' + sport, successObj);
            res.send(successObj);
        } catch (error) {
            console.log(error);
            sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
}

