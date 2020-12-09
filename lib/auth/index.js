'use strict';

var logger = require('../../utils/logger')(module);
var config = require('../../server/config');
const ObjectID = require('mongodb').ObjectID
// Login Strategies:
var localLogin = require('./local-login-strategy');
var facebookLogin = require('./facebook-login-strategy');
var facebookLoginMb = require('./facebook-loginmobile-strategy');
var jwtLogin = require('./jwt-login-strategy');

var googleLogin = require('./google-login-strategy');
var googleLoginMb = require('./google-loginmobile-strategy');

var User = require('../../server/models/user');
const Tokens = require("../../server/models/token");
var passport = require('passport');
var flash = require('connect-flash');
const { RedisKeys } = require('../../server/constants/app');
const redis = require('../redis');
const { ObjectId } = require('mongodb');

const noAuthApis = [
  '/api/v1/contest-list',
  '/api/v1/new-contest-list',
  '/api/v1/contest-detail',
  "/api/v1/player-list",
  "/api/v1/get-match-list",
  "/api/v1/banner-list",
  "/api/v1/contest-detail",
  "/api/v1/series-player-detail",
  "/api/v1/before-join-contest",
  "/api/v1/team-states",
  "/api/v1/player-team-list",
];

var exports = module.exports = {};
if (!Object.entries)
  Object.entries = function (obj) {
    var ownProps = Object.keys(obj),
      i = ownProps.length,
      resArray = new Array(i); // preallocate the Array
    while (i--)
      resArray[i] = [ownProps[i], obj[ownProps[i]]];

    return resArray;
  };

///////////////////////////////////////////////////////////
// Keep configuration localized here instead of server.js
//
// Set up Auth middleware
//////////////////////////////////////
exports.configureMiddleware = function (app) {
  // used to serialize the user for the session
  passport.serializeUser(function (user, done) {
    done(null, user.id);
  });

  // used to deserialize the user
  passport.deserializeUser(function (id, done) {
    User.findById(id, done);
  });

  // Install Login Strategies:
  localLogin(passport);
  // facebookLogin(passport);
  // facebookLoginMb(passport);
  // googleLogin(passport);
  // googleLoginMb(passport);
  jwtLogin(passport);

  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());
  logger.info('Auth middleware configured.')
};

// Pass Through the Auth routes:
exports.authenticate = {
  // Email/Password:
  localLogin: function (req, res, next) {
    return passport.authenticate('local-login', authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  // Facebook:
  facebookLogin: passport.authenticate('facebook', {
    authType: 'rerequest',
    scope: ['email','user_friends']
  }),
  facebookLoginCb: function (req, res, next) {
    return passport.authenticate('facebook', authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  facebookLoginMb: function (req, res, next) {
    return passport.authenticate('local-facebook',authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  // Google:
  googleLogin: passport.authenticate('google', { scope: 'profile email'}),
  googleLoginCb: function(req, res, next) {
    return passport.authenticate('google', authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  googleLoginMb: function (req, res, next) {
    return passport.authenticate('local-google',authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  jwtLogin: function (req, res, next) {
    return passport.authenticate('jwt', authenticationStrategyCallback(req, res, next))(req, res, next);
  },
  // Etc.
};

exports.authenticationRequired = function (req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    if (!req.xhr) req.session.redirectTo = req.originalUrl;
    res.redirect('/users/login/');
  }
}

// Check User Authenticated or Not
exports.CheckAuthentication = function (req, res, next) {
  if (req.isAuthenticated()) {
    return res.status(200).send({ status: 200, data: 'Authenticated' });
  } else {
    return res.status(401).send({ status: 401, data: 'NotAuthenticated' });
  }
}
//////////////////////////////////////
// END Set up Auth middleware
//////////////////////////////////////

/**
 * Enforces group permissions for required routes
 * @param {Array} routePermissions
 * @returns {Function} route handler to process request
 * @Example use: permisssionsRequire(["Admin"])
 */
exports.isAuthorized = (routePermissions = []) => {
  return (req, res, next) => {
    if (req.session.user) {
      if (req.session.user.profile) {
        const userPermissions = req.session.user.profile.permissionGroups;
        const userHasPermission = userPermissions.reduce((isGranted, userPermission) => {
          if (routePermissions.includes(userPermission)) isGranted = true;
          return isGranted;
        }, false);

        if (userHasPermission) next();
        else res.status(403).render('403');

      } else {
        res.redirect('/dashboard/')
      }
    } else {
      res.redirect('/users/login');
    }
  }
};


////////////////////////////////////
// PRIVATE METHODS
////////////////////////////////////
function authenticationStrategyCallback(req, res, next) {
  // console.log("authenticationStrategyCallback called");
  // Wrapping this anonymous function to pass req, res, and next:
  return (err, user, info) => {
    if (err) {
      return res.send({ status: 404, message: err });
    }
    // Check User's Profile and registration status:
    //console.log(user,info);
    if (user) {
        //Update the user last Login date
        // User.updateLastLogin(user.id);
        //console.log("user", user)
        if (user.registrationToken) {
          var errMsg = user.registrationToken.isExpired
            ? 'We are sorry - your previous registration has expired.  Please register again and confirm the email before logging in.'
            : 'We are sorry - you must confirm your registration by clicking on the link in your mailbox.  ' + 'If you no longer have it, please use the lost password functionality.';

          return res.send({ 'status': 'error', 'message': errMsg });
        }

        req.logIn(user, function (err) {
          if (err) {
            return res.send({ 'status': 'error', 'message': err.message });
          }
        });

        //console.log("user*****", user, req.headers)
        
        // req.userId = user._id;
        req.userId = ObjectID(user._id);        
        //**************************Check User Token From Redis************************ */
        redis.getRedis(RedisKeys.USER_AUTH_CHECK + user._id, (err, userAuthData) => {

          //console.log("userAuthData", userAuthData)
          if(userAuthData && userAuthData.token){
            var redisToken = 'JWT '+userAuthData.token; //userAuthData.token.split(' ').pop();
            // console.log("req.headers.authorization", req.headers.authorization)
            // console.log("redisToken", redisToken)
            if(req.headers.authorization !=  redisToken){
              return res.status(401).send({ 'status': 'error', 'message': "Invalid token" });
            }else{
              next();
            }
          }else{
            Tokens.findOne({"userId":ObjectId(user._id)}, {"token":1}).then((tokenData) => {
              if(tokenData && tokenData.token){
                var newTokenObj = {user_id : user._id, token : tokenData.token}
                redis.setRedis(RedisKeys.USER_AUTH_CHECK + user._id, newTokenObj);
              }          
            });
            next();
          }
        })
        //*************************************************************************** */

        
        // return res.send({ 'status': 'success', message:'Login Successfully',user: user });
    } else {
      let isAllowed = false;
      noAuthApis.map((item) => {
        if(req.url.indexOf(item) > -1){
          isAllowed = true;
        }
      })
      if(isAllowed){
          next();
      } else {
        return res.status(401).send({ 'status': 'error', 'message': "Please Login" });
      }
    }
  }
}
