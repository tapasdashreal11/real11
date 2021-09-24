const mqtt = require('mqtt')
const config = require('../server/config');
const mqttTopics = require('../server/constants/mqtt-topics');
const { cli } = require('winston/lib/winston/config');
//const client = mqtt.connect(config.ludo_mqtt);
const client = mqtt.connect("tcp://65.1.31.106:1883",{
    username: "mqtt",
    password:"123456",
  })
// console.log(client);
 var connected = false
 client.on('connect', () => {
     console.log("Connected to LUDO MQTT Server")
     connected = true;
 })

 client.on('error', (err) => {
     console.log("Failed to connected to LUDO  MQTT Server",err);
 })
module.exports = {
    publishJoinContestOthergame: (matchId,contest_id, message) => {
        console.log("Hello Inside",matchId,contest_id);
         client.publish(mqttTopics.otherGameJoineContestKey(matchId,contest_id),message)
    },
    publishUserNotificationCounts: (user_id, message) => {
        console.log("user notifcation count",user_id);
         client.publish(mqttTopics.userNotificationCounts(user_id),message)
    }
}