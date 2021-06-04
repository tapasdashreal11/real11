
const { isEmpty } = require('lodash');
const request = require('request');
const config = require('../../../config');

const appsFlyerEntryService = (appsflyerdata,appsflyerUrl) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(appsflyerdata)){
            var options = {
                "method": "POST",
                "url": appsflyerUrl,
                "json": true,
                "headers": {'authentication':"BUvaUbjej7PNorfc5Kmpzg",'Content-Type': 'application/json'},
                "body": appsflyerdata
            };
            request(options, function (error,res,body) {
                return resolve(body);
            });
           
        } else {
            return resolve();
        }
    })
}


module.exports = {
    appsFlyerEntryService
};