const mqtt = require('mqtt')
const config = require('../server/config');
const mqttTopics = require('../server/constants/mqtt-topics');
const { cli } = require('winston/lib/winston/config');
//const client = mqtt.connect(config.ludo_mqtt);
/*let conf = { host: '65.1.31.106', port: 1883, username:  "mqtt",password: "123456",
keepalive: 1
}*/
let conf = { host: '13.233.250.106', port: 1883, username:  "otherGamesMqtt",password: "Real11#531",
keepalive: 1
}
const client = mqtt.connect(conf);
 var connected = false
 client.on('connect', () => {
     console.log("Connected to LUDO MQTT Server**************")
     connected = true;
 })

 client.on('error', (err) => {
     //console.log("Failed to connected to LUDO  MQTT Server",err);
 })
module.exports = {
    publishJoinContestOthergame: (matchId,contest_id, message) => {
        console.log("Hello Inside",matchId,contest_id);
        // client.publish(mqttTopics.otherGameJoineContestKey(matchId,contest_id),message)
    },
    publishUserNotificationCounts: (user_id, message) => {
        console.log("user notifcation count",user_id);
        // client.publish(mqttTopics.userNotificationCounts(user_id),message)
    }
}