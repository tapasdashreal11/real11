
const { isEmpty } = require('lodash');
const request = require('request');
const config = require('../../../config');

const panVerification = (panData) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(panData)){
            var options = {
                "method": "POST",
                "url": config.PAN_VERIFY_API.URL,
                "json": true,
                "headers": {'Authorization':config.PAN_VERIFY_API.API_TOKEN,'Content-Type': 'application/json'},
                "body": panData
            };
             request(options, function (error,res,body) {
                return resolve(body);
            });
           
        }else{
            return resolve();
        }
    })
}


module.exports = {
    panVerification
};