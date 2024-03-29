
const { isEmpty } = require('lodash');
const request = require('request');
const UserFbTrack = require("../../../models/user-fb-track");

const facebookEntryService = (fbData,fbUrl) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(fbData)){
            const bData = JSON.parse(JSON.stringify(fbData));
            var options = {
                "method": "POST",
                // "url": "https://graph.facebook.com/v11.0/560345878459615/events?access_token=EAAHLiM2ETPEBAPK53iQgv6l5AIbZBoMkulrqUsai2StS32TafDN2Kr3mq8ZCktLvPNFK12tgZAjPHZAGC6ZAbTcHCUho5ZCTu6TtP3iZAbRqEesXuxw9kEZAkzsFCwHPESBbaGSZBQ07sf2bSgbNrnq7Dj1k54VbPYMZBuhodbtzQvoEOU4FCUe9PPIhi0pwZAJQvYZD", 
                "url": "https://graph.facebook.com/v11.0/560345878459615/events?access_token=EAAHLiM2ETPEBAC2tOlgnNqayW9zwOGBiiFJUGye3fUADYtzwQs7MGNYa9vafTPEE8CQdhvtUT8T3fEQdHaWR3qilHJmLQ936hwfDTQaFiGgtyeHiGDlVx1ZAQdbWOzAzjrvYHRiDjP5CZAgClZAz0ldfo3AZCNHDc4kvncHWwjXyv3gxb0ZBwohMZBgnO71ssZD", 
                "json": true,
                "headers": {'Content-Type': 'application/json'},
                "body":bData
            };
            request(options, function (error,res,body) {
                const fdData = fbUrl ? JSON.parse(JSON.stringify(fbUrl)) : {};
                UserFbTrack.create({fbtrace_id:body.fbtrace_id,events_received:body.events_received,events_obj:fdData});
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