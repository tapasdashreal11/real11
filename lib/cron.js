'use strict';

var cron = require('node-cron');
var Promise = require('bluebird');
var logger = require('../utils/logger')(module);
//for scraping
logger = require('../utils/logger')(module);
var sem = require('semaphore')(1);  // only one instance of semaphore is allowed
const Sequelize = require('sequelize');
var crypto = require('./crypto');
const moment = require('moment');
const  config = require('../server/config');
//for rating reminders
const User = require('../server/models/user');
const ScheduledJobs = require('../server/models/common/scheduled-jobs');

//return in 24 hour units, of utc
function getCurrentTimeStart() {
    var d = new Date();
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
/*      var ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12;
      h = h ? h : 12; // the hour '0' should be '12' */
      h = h < 10 ? "0" + h : h; //prefix hour with 0, so that 09:30am < 10:00 am
    if(m<30){
         m="00";
    }
    else{
        m="30"
    }
//    return h + ":" + m +ampm;
    return h + ":" + m;

}
//return in 24 hour units of utc
function getCurrentTimeEnd() {
    var d = new Date();
    var h = d.getUTCHours();
    var m = d.getUTCMinutes();
/*      var ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12;
      h = h ? h : 12; // the hour '0' should be '12'
*/    if(m<30){
         m="30";
    }
    else if(m>30 && h>=23){ //stay in same day
         m="59";
    }
    else{
        h=parseInt(h)+1;
        m="00"
    }
      h = h < 10 ? "0" + h : h; //prefix hour with 0, so that 09:30am < 10:00 am
//    return h + ":" + m +ampm; //return 24 hour unit
    return h + ":" + m ;
}

module.exports.masterCronEveryMinute = function () {
    const expression = "* * * * *";
    if (cron.validate(expression)) {
        logger.info(`[masterCronEveryMinute] - Cron scheduled for every minute (${expression})`);
        global.masterCronEveryMinute = cron.schedule(expression, function () {
            var currentTime = moment(Date.now()).utc().format('Y-MM-DD H:m');
            logger.info(currentTime);
            ScheduledJobs.find({dateTime:currentTime}).then(currentJobs => {
                logger.info(`${currentJobs.length} Notifications will be fired`)
                currentJobs.forEach(function(job){
                    if(job.type == 'OrderNotifications'){
                        
                    }
                });
            })
        }, true);
    } else {
        logger.error(`invalid cron expression: ${expression}`);
    }
}
