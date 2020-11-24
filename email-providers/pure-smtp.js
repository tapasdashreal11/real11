'use strict';

const nodeMailer = require('nodemailer');
const Promise = require('bluebird');
const config = require('../server/config')
const logger = require('../utils/logger')(module);

module.exports.sendEmail = function(requestData){
   return new Promise(function(resolve,reject) {
    const transproter = nodeMailer.createTransport({
        service: config.smtp.service,
        auth: {
            user: config.smtp.username,
            pass: config.smtp.password,
        },
    });
    var mailOptions ={
        from: config.smtp.fromEmail,
        to: requestData.recipient,
        subject: requestData.subject,
        html: requestData.message
    };

    transproter.sendMail(mailOptions, function(err, info){
        if (err) {
            logger.error(`PureSMTP.js error: There was an error sending email to ${requestData.recipient}.${err}`);
            reject(err);
          } else {
            logger.info(`PureSMTP.js submitted new email to ${requestData.recipient}`);
            resolve({message:'Email has been sent' +" "+ info.response });
          }
    });
   })
}