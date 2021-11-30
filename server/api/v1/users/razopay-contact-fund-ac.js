
const { isEmpty } = require('lodash');
const request = require('request');
const config = require('../../../config');

const razopayUserContact = (contactData) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(contactData)){
            var options = {
                "method": "POST",
                "url": config.RAZOPAY_API.BASIC_URL+"contacts",
                "json": true,
                "headers": {'Content-Type': 'application/json'},
                "body": contactData,
                "auth": {
                    user: config.RAZOPAY_API.USER_NAME,
                    password: config.RAZOPAY_API.PASSWORD
                  }
            };
            console.log(options);
             request(options, function (error,res,body) {
                return resolve(body);
            });
           
        }else{
            return resolve();
        }
    })
}

const razopayFundAccount = (fundAcData) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(fundAcData)){
            var options = {
                "method": "POST",
                "url": config.RAZOPAY_API.BASIC_URL+"fund_accounts",
                "json": true,
                "headers": {'Content-Type': 'application/json'},
                "body": fundAcData,
                "auth": {
                    user: config.RAZOPAY_API.USER_NAME,
                    password: config.RAZOPAY_API.PASSWORD
                  }
            };
             request(options, function (error,res,body) {
                return resolve(body);
            });
           
        }else{
            return resolve();
        }
    })
}

const razopayPayoutToUserFundAc = (fundAcData,WIthdrawId) => {
    return new Promise((resolve, reject) => {
        if(!isEmpty(fundAcData)){
            var options = {
                "method": "POST",
                "url": config.RAZOPAY_API.BASIC_URL+"payouts",
                "json": true,
                "headers": {
					'Content-Type': 'application/json',
					"X-Payout-Idempotency": WIthdrawId
				},
                "body": fundAcData,
                "auth": {
                    user: config.RAZOPAY_API.USER_NAME,
                    password: config.RAZOPAY_API.PASSWORD
                  }
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
    razopayUserContact,
    razopayFundAccount,
    razopayPayoutToUserFundAc
};