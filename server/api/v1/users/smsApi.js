
const { isEmpty } = require('lodash');
var http = require("http");

const sendSMS = (mobile, message) => {
    return new Promise((resolve, reject) => {
        console.log("dd0***",!isEmpty(mobile),!isEmpty(message));
        if(!isEmpty(mobile) && !isEmpty(message)){
            console.log("dd200***");
            //var encodeMsg = encodeURI(message); 
            console.log("dd2434***");
            let SENDERID = 'IMReal';
            let route = 4;
            let countryCode = `91`;
            let smsAuthKey = '261610AJCwPyJoSj5c5aad29';
            let tempId = '60461d588d65c6109f642fb1';
            console.log("dd***");
            let newMob = countryCode + mobile;
            console.log("dd2***");
            var options = {
                "method": "GET",
                "hostname": "api.msg91.com",
                "port": null,
                "path": `/api/v5/otp?template_id=${tempId}&mobile=${newMob}&authkey=${smsAuthKey}&otp=${message}`,
                //"path": `/api/sendhttp.php?country=${countryCode}&sender=${SENDERID}&route=${route}&mobiles=${mobile}&authkey=${smsAuthKey}&message=${encodeMsg}`,
                "headers": {}
            };
            console.log(options);//
            
            var req = http.request(options, function (res) {
                var chunks = [];
    
                res.on("data", function (chunk) {
                    chunks.push(chunk);
                });
    
                res.on("end", function () {
                    return resolve();
                });
            });
    
            req.end();
        }else{
            return resolve();
        }
    })
}


module.exports = {
    sendSMS
};