const paytm = require('paytm-nodejs');
var config = require('../config');

const paytmConfig = {
    MID : config.paytm.mid, // Get this from Paytm console
    KEY : config.paytm.key, // Get this from Paytm console
    ENV : config.paytm.env, // 'dev' for development, 'prod' for production
    CHANNEL_ID : 'WAP',
    INDUSTRY : 'Retail',
    WEBSITE : 'DEFAULT',
    CALLBACK_URL : 'https://securegw.paytm.in/theia/paytmCallback?ORDER_ID=',  // webhook url for verifying payment
}

// Webhook controller function
exports.webhook = function(req,res){
    paytm.validate(paytmConfig,req.body,function(err,data){
        if(err){
            // handle err
        }
        console.log(data);
        if(data.status == 'verified'){
            // mark payment done in your db
        }
    })
}