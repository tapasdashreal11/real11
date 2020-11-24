'use strict';

var FacebookStrategy = require('passport-facebook').Strategy;
var User = require('../../server/models/user');
var logger = require('../../utils/logger')(module);
var config = require('../../server/config');
var emailSender = require('../email-sender');
var emailGen = require('../email-template-generator').emailTemplateGenerator;


module.exports = function (passport) {
  passport.use(new FacebookStrategy({
      clientID: config.auth.facebook.clientID,
      clientSecret: config.auth.facebook.clientSecret,
      callbackURL: config.auth.facebook.callbackURL,
      profileFields: ['id', 'email']
    },
    function (token, refreshToken, profile, done) {
      logger.info('Executing Facebook Login Strategy', token, refreshToken, profile);

      // 1. Try to find the user via 'profile.id'
      // 2. If found, user's FB account is linked, just follow success route
      // 3. If not, try to see if 'User.local.email' matches 'profile.emails[0].value'
      // 4. If yes, link user's FB id to existing profile
      // 5. If not, create new user skipping confirmation path, and log them in
      //
      // asynchronous
      process.nextTick(function () {
        User.findOne({'facebook.id': profile.id}, function (err, user) {
          // if there are any errors, return the error
          if (err) return done(err);

          if (user) return done(null, user, 'Login successful!');
          else {
            // Look up user by email:
            if (profile.emails == null || profile.emails.length == 0) {
              done("Cannot access Facebook account's email.  It's required.");
            } else {
              const fbEmail = profile.emails[0].value;
             // User.findOne({'local.email': fbEmail}, function (err2, user2) {
              User.findOne({ $or: [ { "local.email" : fbEmail }, { "secondary.emails": fbEmail } ] }, function (err2, user2) { 
                // if there are any errors, return the error
                if (err) return done(err2);
                if (user2) {
                  // Connect FB:
                  user2.facebook.id = profile.id;
                  logger.info(`FOUND USER`);
                  user2.save((err3) => {
                    if (err3) throw err3;
                    else done(null, user2, 'Connected your Facebook account successfully!');
                  });
                } else {
                  user2 = new User();
                  user2.facebook.id = profile.id;
                  user2.local.email = fbEmail;
                  const tempPassword = User.generateTemporaryPassword()
                  user2.local.password = tempPassword;
                  logger.info(`CREATING USER: ${user2.facebook.id}, ${user2.local.email}`);
                  user2.save((err3) => {
                    if (err3) throw err3;
                    else {
                      sendRegistrationEmail(fbEmail, tempPassword).then((resp) => {
                        done(null, user2, 'Connected your Facebook account successfully!');
                      }).catch((err4) => done(err4));
                    }
                  });
                }
              });
            }
          }
        });
      });
    }));
};

function homeUrl() {
  const cb = config.auth.facebook.callbackURL;
  return config.auth.facebook.callbackURL.substring(0, cb.indexOf('/', 10));
}
function sendRegistrationEmail(email, tempPassword) {
  // Send user an email with login info:
  return emailGen('social-signup', {tempPassword: tempPassword, homeUrl: homeUrl()}).then(function(template) {
    logger.info('Generated [user-registration] template');
    return template.html;
  }).then(function(html) {
    // build email:
    var emailData = {
      recipient: email,
      subject: `${config.appName} registration email`,
      message: html
    };
    return emailData
  }).then(emailSender.sendEmail);
}
