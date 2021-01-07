// Public modules
const fs = require('fs');
const jwt = require('jsonwebtoken');
const moment = require('moment');
var _ = require('lodash');
const config = require('../../../config');
const sgMail = require('@sendgrid/mail');
// var Email = require('email-templates');
const { stringify } = require('querystring');
const ejs = require('ejs');
const path = require('path');
const nodemailer = require('nodemailer');
const Notification = require('../../../models/notification');
const FCM = require('fcm-push');
// const apn = require("apn");

let currentDate  =	moment().utc().toDate();
sgMail.setApiKey(config.sendgridApiKey);

const currentDateTimeFormat = (dateTimeFormat) => moment().utc().format(dateTimeFormat);
const tokenExpiresIn = '360h';

const generateError = (message = '', status = 500) => {
  let error = new Error(message);
  error.status = status;
  return error;
};

const shuffle = (string) => {
  var parts = string.split('');
  for (var i = parts.length; i > 0;) {
      var random = parseInt(Math.random() * i);
      var temp = parts[--i];
      parts[i] = parts[random];
      parts[random] = temp;
  }
  return parts.join('');
}

const generateTransactionId = (type, userId) => {

  let currentDate = new Date();
        let currentTimeStamp = Math.round(currentDate.getTime() / 1000);

        let day = currentDate.getDate();
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth() + 1;

        let prefix = 'DB';

        if (type == 'credit') {
            prefix = 'CR';
        }
        let refTransactionId = prefix + year + month + day + currentTimeStamp + userId;
        return refTransactionId;


}

const  createTeamName = ($userName = null) => {

  $userName	=	$userName.split('@');

  let splitUsername = $userName[0];
  $name = _.replace(splitUsername, ' ', '');
  
  $nameStr	=	$name.substr(0, 4);

  

  $string		=	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ9876543210';

  $strShuffled=	shuffle($string);

  $shuffleCode=	$strShuffled.substr(1, 6);

  $teamName	=	_.toUpper($nameStr + $shuffleCode);

  return $teamName;

  

}


const createUserReferal = ($length) => {
  $string		=	'0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ9630125478abcdefghijklmnopqrstuvwxyz9876543210';
    $strShuffled=	shuffle($string);
    
    $referCode	= $strShuffled.substr(1, $length);

		
		return $referCode;
};


const validatorMiddleware = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json(new ResponseData({
      result: { errors: errors.array() || [] },
      msg: invalid_data_err_msg,
    }));
  } else {
    next();
  }
};

const generateClientToken = (data, expiresIn = tokenExpiresIn) => {
  return new Promise((resolve, reject) => {
    jwt.sign(data, config.tokenSecret, { expiresIn }, function (err, token) {
      if (err) {
        console.log(err);
        return reject(err);
      }
      return resolve(token);
    });
  });
}

const rowTextToJson = (rowData = '') => JSON.parse(JSON.stringify(rowData));

const sendMail = (to, from, subject, message) => {
  try {
    const msg = {
      to: to,
      // from: { email : from, name: "Real11" },
      from: from,
      subject: subject,
      text: message,
      html: message,
    };
    sgMail.send(msg);
  }catch(error) {
    
  }
};

const sendMailToDeveloper = (req, message) => {
  try {
    let emailTemplate;

    let siteBaseUrl  = `${req.protocol}://${req.get('host')}`;
    let requestUrl =    siteBaseUrl+req.url;
    let requestMethod = req.method;
    let userDetail = req.decoded;
    let userToken = req.headers.token;
    let params  = {};
    if(requestMethod == 'POST') {
      params  = req.body;
    }
    
    ejs.renderFile(path.join(__dirname, "../../../../views/email-templates/developer-mail/html.ejs"), {
      errorMessage  : message,
      requestUrl    : requestUrl,
      requestMethod : requestMethod,
      token         : userToken,
      userDetail    : JSON.stringify(userDetail) || '',
      postRequest   : JSON.stringify(params) || '',
      requestTime   : currentDate
    })
    .then(result => {
      emailTemplate = result;
      // console.log(config.developerEmail);
      let emailList = config.developerEmail;
      
      if(Array.isArray(config.developerEmail) == false) {
        emailList = emailList.split(", ");
      }
      const messageObj = [
        {
          to: emailList,
          from: config.supportEmail,
          subject: "Development Error",
          html: emailTemplate
        },
      ];
      
      return sgMail.send(messageObj)
        .then(sent => {
          console.log("mail was sent");
        })
        .catch(err => {
          console.log("Error sending mail", err);
        });

    }).catch(err => {
      console.log("Error Rendering emailTemplate");
    });
  } catch(error) {
    console.log("could not send mail.");
  }
};

const parseUserTeams = (userTeamData) => {
  let userTeamIds = [];
  for (const prop in userTeamData) {
    if (hasOwnProperty.call(userTeamData, prop)) {
      let teamData = userTeamData[prop];
      let playerTeamIds = [];
      for(let team of teamData){
        team.contest_id = prop;
        if(team.player_team_id){
          playerTeamIds.push(team.player_team_id);
        }
      }
      userTeamIds.push({
        contest_id:prop,
        player_team_ids: playerTeamIds
      });
    }
  }
  return userTeamIds;
};

const parseContestTeamsJoined = (joinedTeamsCount) => {
  let responseData = [];
  for (const prop in joinedTeamsCount) {
    if (hasOwnProperty.call(joinedTeamsCount, prop)) {
      if(joinedTeamsCount[prop] > 0){
        responseData.push({
          contest_id:prop,
          count: joinedTeamsCount[prop]
        });
      }
    }
  }
  return responseData;
};

const sendSMTPMail = (to, subject, message) => {
  try {
    var transporter = nodemailer.createTransport( ({
      tls: {
        rejectUnauthorized: false
      },
      host: config.smtp.host,
      secureConnection: false,
      port: config.smtp.port,
      name : "Real11",
      auth: {
        user: config.smtp.username,
        pass: config.smtp.password
        }
    }));

    var mailOptions = {
      from: config.smtp.fromEmail,
      // from: { email : config.smtp.fromEmail, name: "Real11" },
      to: to,
      subject: subject,
      text: message,
      html: message,
    };
      
    transporter.sendMail(mailOptions, function(error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log(info);
      }
    });
  }catch(error) {
    // console.log(info);
  }
};

const sendNotificationFCM = (uid,notiType,deviceToken,title,notification) => {
  try {
    console.log('fsdfdsfdsfsdf****');
    let payload     = {};
    payload.badge_count = '1';
    payload.message = notification;
    payload.title   = title;
    const message = {
        to: deviceToken,
        collapse_key: 'green',
        notification: {
            title: title,
            body: notification
        },
        data: payload,
    };
     console.log(message);
    const fcm = new FCM(config.fcmKey);
    try{
        let send = fcm.send(message);
        let notifyObj  = {
          user_id:  uid,
          notification_type : notiType,
          title:  title,
          notification: notification,
          date: new Date(),
          status :  1,
          is_send:  1
        };
        Notification.create(notifyObj, () => { })
      }catch(error){
        
    }
  } catch(error) {
    console.log("fsfsfsfsf errorrr",error);
  }
};

const sendNotificationAPNS = (uid,notiType,deviceToken,title,notification) => {
  return false;
  try {
    let payload     = {};
    payload.badge_count = '1';
    payload.message = notification;
    payload.title   = title;
    const message = {
        to: deviceToken,
        collapse_key: 'green',
        notification: {
            title: title,
            body: notification
        },
        data: payload,
    };
    // console.log(message);return false;
    const fcm = new FCM(config.fcmKey);
    try{
        let send = fcm.send(message);
        let notifyObj  = {
          user_id:  uid,
          notification_type : notiType,
          title:  title,
          notification: notification,
          date: new Date(),
          status :  1,
          is_send:  1
        };
        Notification.create(notifyObj, () => { })
      }catch(error){
        
    }
  } catch(error) {
    console.log(error);
  }
};

module.exports = {
  currentDateTimeFormat,
  generateClientToken,
  rowTextToJson,
  createUserReferal,
  createTeamName,
  generateTransactionId,
  sendMail,
  sendMailToDeveloper,
  parseUserTeams,
  parseContestTeamsJoined,
  sendSMTPMail,
  sendNotificationFCM,
  sendNotificationAPNS
};