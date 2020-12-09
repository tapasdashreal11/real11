'use strict'
var logger = require('../utils/logger')(module);
var config = require('../server/config');
var Promise = require('bluebird');


const accountSid = config.twilio.accountSid;
const authToken = config.twilio.authToken;
const phoneNumber = config.twilio.phoneNumber;
const faxesNumber = config.twilio.faxesNumber;

var twilio = require('twilio');
var client = new twilio(accountSid, authToken);

module.exports.sendSms = function (requestData) {
  return new Promise(function (resolve, reject) {

    var data = {
      from: (requestData.from) ? requestData.from : phoneNumber,
      to: `${requestData.recipient}`,
      message: requestData.message
    };

    logger.info(data);

    client.messages.create({
        body: data.message,
        to: data.to,
        from: data.from
      }).then((message) => {
        logger.info(`SMS Sender sent new sms to ${requestData.recipient}`);
        resolve(message)
      }).catch((error) => {
        logger.error(`SMS Sender error: There was an error sending sms to ${requestData.recipient}.${error}`);
        reject(error);
      });
  });
}

module.exports.sendFax = function (requestData) {
  return new Promise(function (resolve, reject) {
    var data = {
      from: (requestData.from) ? requestData.from : faxesNumber,
      to: `${requestData.to}`,
      mediaUrl: requestData.mediaUrl
    };

    logger.info(data);
    // 
    return client.fax.faxes
    .create({
      from: data.from,
      to: data.to,
      mediaUrl: data.mediaUrl
    })
    .then((message) => {
      logger.info(`FAX Sender: Fax was sent to ${requestData.to}`);
      resolve(message)
    })
    .catch((error) => {
      logger.error(`FAX Sender error: There was an error sending fax to ${requestData.to}.${error}`);
      reject(error);
    })
  })
}

module.exports.lookupNumber = function(numberPhone, code = 'US') {
  return new Promise(function (resolve, reject) {
    client.lookups.phoneNumbers(numberPhone)
      .fetch({countryCode: code})
      .then(phone_number => resolve(phone_number))
      .catch((error) => {
        logger.error(`Look up number phone error: ${error}`);
        reject(error);
      })
  })
}

module.exports.sendSingleSMS = function sendSingleSMS(options) {
  return new Promise(function (resolve, reject) {
      lookupNumber(options.to).then((result) => {
          if(result && result.phoneNumber) {
              const to = result.phoneNumber;
              client.messages.create({
                  body: options.message,
                  to: to,
                  from: phoneNumber
              })
              .then((message) => {
                  logger.info(`Send sms to ${to} success.`);
                  resolve(message);
              })
          } else {
              logger.error(`Look up number phone not found: ${options.to}`);
              reject(new Error('Look up number phone not found'));
          }
      })
      .catch((error) => {
          logger.error(error);
          reject(new Error('Look up number phone not found'));
      });
  })
}
