const mqtt = require('mqtt')
const config = require('../server/config');
const mqttTopics = require('../server/constants/mqtt-topics');
const { cli } = require('winston/lib/winston/config');
const client = mqtt.connect(config.mqtt);
// console.log(client);
// var connected = false
// client.on('connect', () => {
//     console.log("Connected to MQTT Server")
//     connected = true;
// })

// client.on('error', (err) => {
//     console.log("Failed to connected to MQTT Server",err);
// })

module.exports = {
    publishContestTeamCounts: (matchId, message) => {
        // client.publish(mqttTopics.matchContestCount(matchId),message)
    },
    publishUserJoinedTeamCounts: (matchId, userId, message) => {
        // client.publish(mqttTopics.userJoinedTeamCounts(matchId, userId),message)
    },
    publishUserJoinedContestCounts: (matchId, userId, message) => {
        // client.publish(mqttTopics.userJoinedContestCounts(matchId, userId),message)
    }
}