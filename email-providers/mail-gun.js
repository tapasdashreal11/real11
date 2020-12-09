'use strict'
var logger = require('../utils/logger')(module);
var config = require('../server/config');
var Mailgun = require('mailgun-js');
var Promise = require('bluebird');
const path = require('path');

// var API_KEY = config.mailgun.key;
var DOMAIN = 'sandbox0f1be9f22e6049fe8abdce60acdc9c0d.mailgun.org';
var DEFAULT_FROM_EMAIL = 'support@real11.com';

module.exports.sendEmail = function(requestData) {
    console.log("function Called");
    return new Promise(function(resolve, reject) {

      //MailGun

      //SendGrid

      //PureSMTP
  

      var mailgun = new Mailgun({ apiKey: "9b14044b89b16708d2739080643ae432-898ca80e-ee5031dd",  domain: DOMAIN });
      var data = {
          from: (requestData.fromEmail) ? requestData.fromEmail : DEFAULT_FROM_EMAIL,
          to: requestData.recipient,
          subject: requestData.subject,
          html: requestData.message
      };

      if(requestData.attachment !== undefined){
          var filepath = path.join(config.mailgun.attachment_dir, requestData.attachment);
          data.attachment = filepath;
      }

      mailgun.messages().send(data, function(error, body) {
         if (error) {
           logger.error(`EmailSender.js error: There was an error sending email to ${requestData.recipient}.${error}`);
           reject(error);
         } else {
           logger.info(`EmailSender.js submitted new email to ${requestData.recipient}`);
           resolve({message:'Email has been sent', response:body});
         }
      });
    })
}

