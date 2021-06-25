
const { isEmpty } = require('lodash');
const request = require('request');
const config = require('../../../config');

const appsFlyerEntryService = (appsflyerdata,appsflyerUrl) => {
    return new Promise((resolve, reject) => {
        const ddd = JSON.parse(JSON.stringify(appsflyerdata)) 
        console.log('ddd****',ddd);
        if(!isEmpty(appsflyerdata)){
            var options = {
                "method": "POST",
                "url": appsflyerUrl,
                "json": true,
                "headers": {'authentication':"BUvaUbjej7PNorfc5Kmpzg",'Content-Type': 'application/json'},
                "body":ddd
            };
            request(options, function (error,res,body) {
                console.log("**** applyer",body);
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