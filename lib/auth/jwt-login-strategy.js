'use strict';

var JwtStrategy = require('passport-jwt').Strategy,
    ExtractJwt = require('passport-jwt').ExtractJwt;

var User = require('../../server/models/user');
var logger = require('../../utils/logger')(module);
var config = require('../../server/config');


var opts = {}
opts.jwtFromRequest = ExtractJwt.fromAuthHeaderWithScheme('JWT');
opts.secretOrKey = config.tokenSecret;

module.exports = function (passport) {
    // console.log('enter');return false
    passport.use('jwt', new JwtStrategy(opts, function(jwt_payload, done) {
        // console.log(jwt_payload);return false;
        logger.debug('Executing JWT Login Strategy', jwt_payload._id);
        process.nextTick(function () {
            // User.findOne({_id: jwt_payload.sub}, function (err, user) {
            //     // if there are any errors, return the error
            //     if (err) return done(err);
            //     // if no user is found, return the message
            //     if (!user) {
            //         return done('Invalid User');
            //     } else if (user && (user.isPhoneVerified == false && user.isEmailVerified == false)) {
            //         logger.error('User Phone or Email not verified');
            //         return done('User Phone or Email not verified');
            //     }
            //     return done(null, user, 'Login successful!');
            // });
            return done(null, jwt_payload, 'Login successful!');
        });
    }));
};
