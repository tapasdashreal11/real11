/**
 * @file This file contains an interface to create a request context for each
 *   individual request.
 *
 * Going forward we can add things like database connection and other request-
 *   specific data and objects to the requests in a clean and organized way
 *   with a standardized namespace.
 *
 * @todo more information we need should be collected under this field 'ctx'
 */
const db = require('./db');

/**
 * Adds a context field 'ctx' to every request which contains useful information
 *   about the current request.
 *
 * @example req.ctx.client.isMobileApp
 *
 * @param {express.Request} request
 * @param {express.Response} response
 * @param {callback} next
 * @public
 */
module.exports = function(request, response, next) {
  request.ctx = {
    client: extractClientInfo(request),
    mongoose: db.getMongoose,
    db: db.getMongo,
  };

  next();
};

// static regexes to determine clientInfo
const _regexIOS = /ip(od|ad|hone)/i;
const _regexAndroid = /android/i;

/**
 * @typedef {Object} clientInfo
 * @property {boolean} isUnknown - true if the clientInfo couldn't be determined
 * @property {boolean} isMobileApp - true if the client is a mobile app
 * @property {boolean} isBrowser - true if the client is a browser
 * @property {boolean} isIOS - true if the client is on iOS
 * @property {boolean} isAndroid - true if the client is on Android
 */

/**
 * Collects client information from the user-agent header
 *
 * @todo implement proper mobile app checks as soon as custom headers are in place
 * @todo implement more tests as needed
 * @param {express.Request} request
 * @returns {clientInfo}
 * @private
 */
const extractClientInfo = function(request) {
  /** @type {clientInfo} */
  const clientInfo = {
    isUnknown: true,
    isMobileApp: false,
    isBrowser: false,
    isIOS: false,
    isAndroid: false
  };

  const userAgent = (request.header('user-agent') || '').toString();

  // if we don't have a user-agent header, we return the default clientInfo
  if(!userAgent || userAgent.trim().length === 0) {
    return clientInfo;
  }

  return clientInfo;
};
