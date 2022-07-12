const mqtt = require('mqtt')
const config = require('../server/config');
const mqttTopics = require('../server/constants/mqtt-topics');
const { cli } = require('winston/lib/winston/config');
//const client = mqtt.connect(config.ludo_mqtt);
 let conf = { host: '13.126.182.36', port: 1883, username:  "otherGamesMqtt",password: "Real11#531",
 keepalive: 1
 }

 /*let conf = { host: '43.204.255.77', port: 1883, username:"ludoMQTT_real11",password:"real11@2022"
 keepalive: 1
 }*/ // live
 console.log(config.other_games_mqtt);
const client = mqtt.connect(config.other_games_mqtt);
 var connected = false
 client.on('connect', () => {
     //console.log("Connected to LUDO MQTT Server**************")
     connected = true;
 })

 client.on('error', (err) => {
     console.log("Failed to connected to Other game  MQTT Server",err);
 })
module.exports = {
    publishOtherGameJoinedUserCounts: (matchId,contest_id, message) => {
        console.log("Hello Inside",matchId,contest_id);
         client.publish(mqttTopics.otherGamesContestCounts(matchId,contest_id),message)
    },

}