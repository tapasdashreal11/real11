
const { isEmpty } = require('lodash');
const request = require('request');

const appsFlyerEntryService = (appsflyerdata,appsflyerUrl) => {
    return new Promise((resolve, reject) => {
        return resolve();
        if(!isEmpty(appsflyerdata)){
            //const bData = JSON.parse(JSON.stringify(appsflyerdata));
            var options = {
                "method": "POST",
                "url": appsflyerUrl, 
                "json": true,
                "headers": {'authentication':"BUvaUbjej7PNorfc5Kmpzg",'Content-Type': 'application/json'},
                "body":appsflyerdata
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