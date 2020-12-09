const LocalStrategy = require('passport-local').Strategy;
const User = require('../../server/models/user');
const logger = require('../../utils/logger')(module);
const emailSender = require('../email-sender');
const emailGen = require('../email-template-generator').emailTemplateGenerator;


module.exports = function (passport) {
  passport.use('local-google', new LocalStrategy({
    usernameField: 'email',
    passwordField: 'id',
    passReqToCallback: true
  },
    function (req, email, password, done) {
      logger.debug('Executing Login google Strategy', email, password);
      let infoData = req.body;
      let homeUrl = `${req.protocol}://${req.get('host')}`;
      process.nextTick(function () {
        User.findOne({ 'google.id': infoData.id }, function (err, user) {
          if (err) return done(err);

          if (user) return done(null, user, 'Login successful!');
          else {
            if (!infoData.email) {
              done("Cannot access Google account's email.  It's required.");
            } else {
              const ggEmail = infoData.email;
              //User.findOne({ 'local.email': ggEmail }, function (err2, user2) {
              User.findOne({ $or: [ { "local.email" : ggEmail }, { "secondary.emails": ggEmail } ] }, function (err, user2) {   
                if (err) return done(err2);
                if (user2) {
                  user2.google.id = infoData.id;
                  logger.info(`FOUND USER`);
                  user2.save((err3) => {
                    if (err3) throw err3;
                    else return done(null, user2, 'Connected your Google account successfully!');
                  });
                } else {
                  user2 = new User();
                  user2.google.id = infoData.id;
                  user2.local.email = ggEmail;
                  const tempPassword = User.generateTemporaryPassword()
                  user2.local.password = tempPassword;
                  logger.info(`CREATING USER: ${user2.google.id}, ${user2.local.email}`);
                  user2.save((err3) => {
                    if (err3) throw err3;
                    else {
                      sendRegistrationEmail(ggEmail, tempPassword, homeUrl).then((resp) => {
                        done(null, user2, 'Connected your Facebook account successfully!');
                        return true;
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


function sendRegistrationEmail(email, tempPassword, homeUrl) {
  // Send user an email with login info:
  return emailGen('social-signup', { tempPassword: tempPassword, homeUrl: homeUrl}).then(function(template) {
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
