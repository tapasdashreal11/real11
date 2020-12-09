require('dotenv').config();
var mqtt = require('../../lib/mqtt');
var redis = require('../../lib/redis');
const duration = process.env.MQTT_DURATION || 5000;

(() => {
    console.log("MQTT Publisher Started")
    setInterval(() => {
        console.log(`running a task every ${duration/1000}th sec`);
        redis.redisObj.keys("contest-joined-teams-count*",(err, keys) => {
            if(keys.length > 0){
                for(const key of keys){
                    redis.redisObj.get(key,(err, data) => {
                        if (err) console.log(err);
                        let keyChunks = key.split('-');
                        let matchId = keyChunks[keyChunks.length - 1];
                        mqtt.publishContestTeamCounts(matchId,data);
                    })
                }
            } else {
                console.log("No keys found")
            }
        })
        redis.redisObj.get('*',(err,data)=>{
            console.log(err, data);
            mqtt.publishContestTeamCounts()
        })
    },duration)
})()