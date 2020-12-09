var sender = require('../lib/email-sender');
var url = require('url');
module.exports.log = function (req, funcName, message) {
    try {
        let currentSite = req.headers.host;
        let fromSites   = process.env.MAIL_NOTIFY_FROM_SITES.split(',');
        let currentUser = (req.session.user) ? req.session.user : null;
        console.log("Error email from site: " + fromSites);
        console.log("The current site is: " + currentSite);
        console.log("MAIL_NOTIFY_FROM: " + process.env.MAIL_NOTIFY_FROM);
        console.log("MAIL_NOTIFY_TO: " + process.env.MAIL_NOTIFY_TO);
        if (fromSites.includes(currentSite) && currentSite != 'localhost:3003'){
          var link = req != null ? url.format({
            protocol: req.protocol,
            host: req.get('host'),
            pathname: req.originalUrl
          }) : funcName;
          var data = {
            fromEmail: process.env.MAIL_NOTIFY_FROM,
            recipient: process.env.MAIL_NOTIFY_TO,
            subject: 'Critical error at: ' + link,
            message: `<p>User ${currentUser.local.email} just encountered an error at this URL: ${link}</p>
                      <p>Here is a little information that may help us troubleshoot: </p>
                      <p>${message}</p>`
          }
          sender.sendEmail(data)
          .then(function (msg) {
            console.log("Email sent to: " + process.env.MAIL_NOTIFY_TO);
          })
          .catch(function (err) {
            console.log('Found error', err)
          })
        }
    } catch (e) {
      console.log('Error send mail notify!');
      console.log(e);
    }
}
