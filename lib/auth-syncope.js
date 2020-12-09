'use strict';
/**
 * This script handles syncope API via swagger library.  The code and sample usage can be found here:
 *
 *    https://github.com/swagger-api/swagger-js/
 *
 * To test the library, curl can be use as follows (this creates new user):
 */
//curl http://localhost:3001/register  \
//  -H 'Origin: http://localhost:3001' \
//  -H 'Accept-Encoding: gzip, deflate, br' \
//  -H 'Accept-Language: en-US,en;q=0.8' \
//  -H 'Upgrade-Insecure-Requests: 1' \
//  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/56.0.2924.87 Safari/537.36'
//  -H 'Content-Type: application/x-www-form-urlencoded' \
//  -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8' \
//  -H 'Cache-Control: max-age=0' \
//  -H 'Referer: http://localhost:3001/register' \
//  -H 'Connection: keep-alive' \
//  -H 'DNT: 1' \
//  --data 'email=test@home.com&password=123OneComplexPassw0rD' --compressed ;

var JSON_URL = process.env.SYNCOPE_BASE_URL + '/syncope/rest/swagger.json';
var SYNCOPE_DOMAIN = 'Master';

var Swagger = require('swagger-client');
var passport = require('passport');
var logger = require('../utils/logger')(module);

var client;
new Swagger({
  url: JSON_URL,
  usePromise: true
}).then(function (cli) {
  logger.info('swagger-client Library loaded successfully!');
  client = cli;
}).catch(function (error) {
  logger.error("Failed loading swagger-client Library: " + JSON.stringify(error));
});

/************************************************************************
 * Following Functions will be exported in module.
 *
 * To add REST API Entry with swagger, open 'JSON_URL' link (/syncope/rest/swagger.json), find the entry you want to
 * implement under 'paths' node (e.g. /users/self), use the value under 'tags' array to scope this method in client,
 * and 'operationId' value for the actual method.  Payload should be added as specified in 'parameters', expect
 * responses to match what's in 'responses' node.  You should add '{responseContentType: 'application/json'}' to
 * return JSON data, whenever 'produces' has more than one entry.
 */
var exports = module.exports = {};


//////////////////////////////////////
// START REST API Wrapper
//////////////////////////////////////
/**
 * User Self-Registration function.
 * @param {Object} regInfo - a JS object with fields:
 *    username:  (string, an email address)
 *    password:  (clear-text password string)
 *    firstName: (string)
 *    lastName:  (string)
 *    remember:  (boolean)
 * @param {Function} successCb - A function that will be called with a single User data parameter.
 * @param {Function} errorCb - A function that will be called with a single Error data parameter.
 */
exports.register = function (regInfo, successCb, errorCb) {
  var user = {
    "realm": "/",
    "username": regInfo.username,
    "password": regInfo.password,
    "plainAttrs": [
      {
        "schema": "firstname",
        "values": [regInfo.firstname]
      },
      {
        "schema": "lastname",
        "values": [regInfo.lastname]
      },
      {
        "schema": "referralId",
        "values": [regInfo.referralId]
      },
      {
        "schema": "referrerId",
        "values": [regInfo.referrerId]
      },
      {
        "schema": "customerReferralPct",
        "values": [regInfo.customerReferralPct]
      }
    ],
    "@class": "org.apache.syncope.common.lib.to.UserTO"
  };
  client._users_self.create({
    body: user,
    storePassword: true,
    'X-Syncope-Domain': SYNCOPE_DOMAIN
  }, {
    responseContentType: 'application/json'
  }).then(function (userResponse) {
    handleResponse(userResponse, successCb, errorCb);
  }).catch(function (error) {
    handleResponse(error, successCb, errorCb);
  });
};

/**
 * Sends and email to user with a token for password reset.  See the following details for email config:
 * http://syncope.apache.org/docs/reference-guide.html#e-mail-configuration
 * @param {Object} username - the user's email address.
 * @param {String} securityAnswer - answer to provided security question.
 * @param {Function} successCb - A function that will be called with user's password reset token.
 * @param {Function} errorCb - A function that will be called with a single Error data parameter.
 */
exports.requestPasswordReset = function (username, securityAnswer, successCb, errorCb) {
  client._users_self.requestPasswordReset({
    body: securityAnswer,
    username: username,
    'X-Syncope-Domain': SYNCOPE_DOMAIN
  }, {
    responseContentType: 'application/json'
  }).then(function () {
    // Now, that we successfully reset the password, we need to get the token:
    adminGetUser(username, function(user) {
      successCb(user.token);
    }, errorCb);
  }).catch(function (error) {
    errorCb(handleResponse(error, successCb, errorCb));
  });
}

/**
 * Once the user requested password reset, use a combination of provided time-sensitive token and a new password
 * to change it.
 * @param {String} token - provided during Password Reset Request
 * @param {String} newPassword - new password value
 * @param {Function} successCb
 * @param {Function} errorCb - A function that will be called with a single Error data parameter.
 */
exports.confirmPasswordReset = function (token, newPassword, successCb, errorCb) {
  client._users_self.confirmPasswordReset({
    body: newPassword,
    token: token,
    'X-Syncope-Domain': SYNCOPE_DOMAIN
  }, {
    responseContentType: 'application/json'
  }).then(successCb).catch(errorCb);
};

/**
 * Changes the existing password.
 * @param {String} newPassword - new password value
 * @param {Function} successCb
 * @param {Function} errorCb - A function that will be called with a single Error data parameter.
 */
exports.changePassword = function (newPassword, successCb, errorCb) {
  client._users_self.changePassword({
    password: newPassword,
    'X-Syncope-Domain': SYNCOPE_DOMAIN
  }, {responseContentType: 'application/json'}).then(successCb).catch(errorCb);
};

/**
 * User Login function.
 * @param {String} username - String, an email address
 * @param {String} password - String, clear-text password
 * @param {Function} successCb - A function that will be called with a single User data parameter.
 * @param {Function} errorCb - A function that will be called with a single Error data parameter.
 */
exports.login = function (username, password, successCb, errorCb) {
  client._users_self.read({
    'X-Syncope-Domain': SYNCOPE_DOMAIN
  }, {
    responseContentType: 'application/json',
    clientAuthorizations: {
      easyapi_basic: new Swagger.PasswordAuthorization(username, password),
    }
  }).then(function (userResponse) {
    handleResponse(userResponse, successCb, errorCb);
  }).catch(function (errorResponse) {
    handleResponse(errorResponse, successCb, errorCb);
  });
};

function adminGetUser(username, successCb, errorCb) {
  client._users.search({
    'X-Syncope-Domain': SYNCOPE_DOMAIN,
    fiql: `username==${username}`
  }, {
    responseContentType: 'application/json',
    clientAuthorizations: {
      easyapi_basic: new Swagger.PasswordAuthorization(
        process.env.SYNCOPE_ADMIN_USER,
        process.env.SYNCOPE_ADMIN_PASSWORD
      ),
    }
  }).then(function (userResponse) {
    handleResponse(userResponse, successCb, errorCb);
  }).catch(function (errorResponse) {
    handleResponse(errorResponse, successCb, errorCb);
  });
}
//////////////////////////////////////
// END REST API Wrapper
//////////////////////////////////////


//////////////////////////////////////
// START Passport Wrapper
//////////////////////////////////////
/**
 * Passes the authentication strategy to the auth framework, returning a standard middleware signature.
 * @param {String} strategy
 */
exports.authenticate = function (strategy, successCb, errorCb) {
  return passport.authenticate(strategy,
    function (err, user, info) {
      if (err) {
        errorCb(err);
      } else if (!user) {
        errorCb({message: 'Unknown Error'});
      } else {
        successCb(user);
      }
    });
}
//////////////////////////////////////
// END Passport Wrapper
//////////////////////////////////////

/**
 * Prevent unauthorized requests from passing through
 * @param {Object} req - Current HTTP Request object
 * @param {Object} res - Current HTTP Response object
 * @param {Function} next - The following chain action
 * @returns {Function} - when user is authenticated, continue the request, otherwise return Unauthorized response
 */
exports.authenticationRequired = function (req, res, next) {
  if (req.session.user) {
    return next();
  }

  // TODO: Redirect to login?
  var status = 400;
  var message = 'Unauthorized';
  res.status(status);
  res.json({
    status: status,
    message: message
  });
  res.end();
};

/**
 * Makes sure that the session user is set based on request
 * @param {Object} req - Current HTTP Request object
 * @param {Object} res - Current HTTP Response object
 * @param {Function} next - The following chain action
 * @returns {Function} - when user is authenticated, continue the request, otherwise return Unauthorized response
 */
exports.getUser = function (req, res, next) {
  if (req.user) { //check if user is logged in
    req.session.user = req.user;
  } else {
    //No session was found, so set user account to null
    req.user = null;
    req.session.user = null;
  }
  //Save the session state
  req.session.save(function (err) {
    if (err) logger.error('Error updating session', err);
  });
  // finishing processing the middleware and run the route
  if (next) next();
}


///////////////////////////////////////////////////////////
// Keep configuration localized here instead of server.js
//
// Set up Auth middleware
//////////////////////////////////////
exports.configureMiddleware = function (app) {
  var LocalStrategy = require('passport-local').Strategy;
  // 1. Password-based Authentication:
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true
    },
    function (req, username, password, cb) {
      logger.info("Executing local Auth strategy", username);
      var successCb = function (user) {
        cb(null, user);
      };
      var errorCb = function (error) {
        cb(error);
      };
      if (req.session.user) {
        if (req.session.user.username != username) {
          // Wrong user in the session, reset session and login:
          req.session.reset();
          exports.login(username, password, successCb, errorCb);
        } else {
          // This user exists, just return successCb(user):
          successCb(req.session.user);
        }
      } else {
        // No user session, just login:
        exports.login(username, password, successCb, errorCb);
      }
    }
  ));

  passport.serializeUser(function (user, cb) {
    // TODO: Consider other serialization mechanisms, this one is not too efficient
    cb(null, JSON.stringify(user));
  });

  passport.deserializeUser(function (serializedUser, cb) {
    // TODO: Consider other serialization mechanisms, this one is not too efficient
    cb(null, JSON.parse(serializedUser));
  });

  app.use(passport.initialize());
  app.use(passport.session());
  logger.info('Auth middleware configured.')
}
//////////////////////////////////////
// END Set up Auth middleware
//////////////////////////////////////


//////////////////////////////////////
// START Helper Methods
//////////////////////////////////////
/**
 * Map REST API response to either data via successCb or error via errorCb
 * @param {Object} response - raw http response to examine
 * @param {Function} successCb - result of response handling
 * @param {Function} errorCb - error response handling
 */
function handleResponse(response, successCb, errorCb) {
  switch (response.status) {
    case 200: // USER FOUND
      var obj = response.obj;
      if (obj) {
        if (obj.result && obj.result.length == 1) {
          successCb(convertUserResponseToUser(obj.result[0]));
        } else {
          successCb(convertUserResponseToUser(obj));
        }
      } else {
        logger.error("auth.handleResponse CODE 200", response);
        errorCb({
          code: response.status,
          message: 'Unknown Error with seemingly successful login'
        });
      }
      break;
    case 201: // USER CREATED
      if (response.obj && response.obj.entity) {
        successCb(convertUserResponseToUser(response.obj.entity));
      } else {
        logger.error("auth.handleResponse CODE 201", response);
        errorCb({
          code: response.status,
          message: 'Unknown Error with seemingly successful registration'
        });
      }
      break;
    case 401:
      errorCb({
        code: response.status,
        message: 'Sorry, we were unable to log you in.  Please try again or reset.'
      });
      break;
    case 404:
      errorCb({
        code: response.status,
        message: 'Sorry, the email address you entered does not exist.  Please check.'
      });
      break;
    case 409:
      if (response.obj) {
        errorCb({
          code: response.status,
          message: 'This email already exists.  Try to login, reset password, or use another email address.'
        });
      } else {
        logger.error("auth.handleResponse CODE 409", response);
      }
      break;
    default:
      logger.error(`auth.handleResponse CODE ${response.status}`, response);
      errorCb({
        code: response.status,
        message: 'Unknown Error'
      });
      break;
  }
}
/**
 * This function is used to transform the data from IMS to our internal storage
 * @param {Object} userResponse - the de-normalized user object
 * @return {Object} - normalized user object for session storage
 */
function convertUserResponseToUser(userResponse) {
  var user = {};
  var obj = userResponse;
  user.key = user.href = obj.key;
  user.email = user.username = obj.username;
  user.token = obj.token;
  user.customData = {};
  for (var i = 0; i < obj.plainAttrs.length; i++) {
    var firstVal = obj.plainAttrs[i].values[0];
    switch (obj.plainAttrs[i].schema) {
      case 'firstname':
        user.givenName = firstVal;
        break;
      case 'lastname':
        user.surname = firstVal;
        break;
      case 'referralId':
        user.customData.referralId = firstVal;
        break;
      case 'referrerId':
        user.customData.referrerId = firstVal;
        break;
      case 'customerReferralPct':
        user.customData.customerReferralPct = firstVal;
        break;
      default:
      // NO-OP
    }
  }
  user.fullName = user.givenName + ' ' + user.surname;
  return user;
}
//////////////////////////////////////
// END Helper Methods
//////////////////////////////////////
