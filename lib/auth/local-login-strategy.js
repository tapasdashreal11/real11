'use strict';

var LocalStrategy = require('passport-local').Strategy;
var User = require('../../server/models/user');
var logger = require('../../utils/logger')(module);
var emailSender = require('../../lib/email-sender');
var emailGen = require('../../lib/email-template-generator').emailTemplateGenerator;
var config = require('../../server/config');

module.exports = function (passport) {
    passport.use('local-login', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true
        },
        function (req, email, password, done) {
            logger.debug('Executing Local Login Strategy', email, password);
            if (email) email = email.toLowerCase();
            // asynchronous
            process.nextTick(function () {
                //User.findOne({'local.email': email}, function (err, user) {
                //to allow user to login from his mail or any of the secondary emails
                User.findOne({$or: [{"local.email": email}, {"secondary.emails": email}]}, function (err, user) {
                    // if there are any errors, return the error
                    if (err) return done(err);
                    
                    // if no user is found, return the message
                    //if (!user) return done(null, false, req.flash('error', 'Email does not exist.'));
                    if (!user) {
                        return done('This email is not registered. Would you like to create an account with email ' + email + '?');
                    } else if (user && user.local.password == null || user.local.password == undefined) {
                        logger.error('User has not set any password yet');
                        var rootUrl = `${req.protocol}://${req.get('host')}`;
                        user.setRegistrationToken();
                        return user.save().then(function (updatedUser) {
                            var data = {
                                newRegistrationUrl: `${rootUrl}/users/register/${encodeURIComponent(updatedUser.registrationToken.token)}`,
                                homeUrl: rootUrl,
                            };
                            if (config.registration.bypassEmail) {
                                //TODO: need to test this
                                return done({'redirect': data.newRegistrationUrl});
                            } else {
                                emailGen('user-registration', data)
                                    .then(function (template) {
                                        logger.info('Generated [user-registration] template');
                                        return template.html;
                                    })
                                    .then(function (html) {
                                        var emailData = {
                                            recipient: user.local.email,
                                            subject: `${config.appName} registration email`,
                                            message: html
                                        };
                                        return emailData
                                    })
                                    .then(emailSender.sendEmail)
                                    .then(function (resp) {
                                        logger.info("SENT: ", resp);
                                    });
                                return done('An email validation link was just emailed to you at ' + email + ', please verify your email and follow the instructions to complete your registration. We\'re happy to have you as part of our community!');
                            }
                        });
                    }

                    //if (!user.isPasswordValid(password)) return done(null, false, req.flash('error', 'Oops! Wrong password.'));
                    if (email == user.local.email) {
                        if (!user.isPasswordValid(password)) return done('Oops! Wrong password.');
                        // all is well, return user
                        else return done(null, user, 'Login successful!');
                    } else {
                        user.secondary.forEach((data) => {
                            if (email == data.emails) {
                                if (data.status == 'verified') {
                                    if (!user.isPasswordValid(password)) return done('Oops! Wrong password.');
                                    // all is well, return user
                                    else return done(null, user, 'Login successful!');
                                } else {
                                    return done('Oops! This Email is not verified with your account yet,Please try with another one.')
                                }
                            }
                        });
                    }


                });
            });
        }));
};
