
const { isEmpty } = require('lodash');
const request = require('request');

const facebookEntryService = (fbData,fbUrl) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(fbData)){
            console.log(fbData);
            //const bData = JSON.parse(JSON.stringify(appsflyerdata));
            var options = {
                "method": "POST",
                "url": fbUrl+"?access_token=EAAHLiM2ETPEBAPK53iQgv6l5AIbZBoMkulrqUsai2StS32TafDN2Kr3mq8ZCktLvPNFK12tgZAjPHZAGC6ZAbTcHCUho5ZCTu6TtP3iZAbRqEesXuxw9kEZAkzsFCwHPESBbaGSZBQ07sf2bSgbNrnq7Dj1k54VbPYMZBuhodbtzQvoEOU4FCUe9PPIhi0pwZAJQvYZD", 
                "json": true,
                "headers": {'Content-Type': 'application/json'},
                "body":fbData
            };
            request(options, function (error,res,body) {
                console.log('fb res**',body);
                return resolve(body);
            });
           
        } else {
            return resolve();
        }
    })
}


module.exports = {
    facebookEntryService
};