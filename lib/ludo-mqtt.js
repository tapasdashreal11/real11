const mqtt = require('mqtt')
const config = require('../server/config');
const mqttTopics = require('../server/constants/mqtt-topics');
const { cli } = require('winston/lib/winston/config');
const client = mqtt.connect(config.ludo_mqtt);
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
         client.publish(mqttTopics.otherGameJoineContestKey(matchId,contest_id),message)
    }
}