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
            let data1 = {
                lf_match:[],
                lf_total:0
            };
            let sport   =   parseInt(req.params.sport || 1);
            const upCommingMatch = await (new ModelService(SeriesSquad)).getMatchList(sport);
            if(sport==1){
              const lFMatch = await (new ModelService(SeriesSquad)).getMatchLiveFantasyList(sport);
              data1['lf_match'] = lFMatch || [];
              data1['lf_total'] = lFMatch.length || 0;
            }
            let liveData = [];
            let finishData = [];
            data1.upcoming_match = upCommingMatch;
            data1.total = upCommingMatch.length;
            data1.live_match = liveData;
            data1.completed_match = finishData;
            data1.version_code = 52;
            data1.message_show = 0;
            data1.message = 'Test Message';
            data1.show_ludo = false;
            data1.show_new_ludo = false;
            data1.show_phonepe = false;
            data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
            data1.apk_url = `http://apk.real11.com/Real11.apk`;
            
            var successObj = ApiUtility.success(data1);
            redis.setRedis('match-list-' + sport, successObj)
            res.send(successObj);
        } catch (error) {
            console.log(error);
            sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
    fiveOverliveFantasyMatchList: async (req, res) => {
        try {
            let data1 = {};
            let { pmatch_id, sport } = req.params;
            if(pmatch_id){
                let  upCommingMatch = await SeriesSquad.find({live_fantasy_parent_id:parseInt(pmatch_id),status:1,sport:sport,time: { $gte: new Date() }, match_status: "Not Started"}).sort({time:1});
                let liveData = [];
                let finishData = [];
                let mList = [];
                if(upCommingMatch && upCommingMatch.length>0){
                    mList = upCommingMatch.map(item => {
                        let itemClone = JSON.parse(JSON.stringify(item));
                        itemClone.star_date = moment(item.date).utc().format('YYYY-MM-DD');
                        itemClone.star_time = moment(item.time).utc().format('HH:mm');
                        return itemClone;
                    });
                }
                data1.upcoming_match = mList; 
                data1.total = mList.length;
                data1.live_match = liveData;
                data1.completed_match = finishData;
                data1.message = 'Test Message';
                data1.match_type = "five-over";
                data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
                var successObj = ApiUtility.success(data1);
                redis.setRedis('fiveover-match-list-' + pmatch_id, successObj)
                res.send(successObj);
            }else{
                res.send(ApiUtility.failed("invalid params"));
            }
           
        } catch (error) {
            console.log(error);
            sendMailToDeveloper(req, error.message);  //send mail to developer to debug purpose
            res.send(ApiUtility.failed(error.message));
        }
    },
}

