// HELPERS:
const moment = require('moment')
/**
 * Isolate FLASH access keys to only a few methods.
 * @param {Object} req - current route request
 * @param {String} err - error message
 */
function flashError(req, err) {
  req.flash('error', err);
};

/**
 * Isolate FLASH access keys to only a few methods.
 * @param {Object} req - current route request
 * @param {String} msg - notice message
 */
function flashSuccess(req, msg) {
  req.flash('success', msg);
};


function flashProfileSuccess(req, msg) {
  req.flash('profile_success', msg);
};


function flashProfileError(req, msg) {
  req.flash('profile_error', msg);
};

/**
 * Isolate FLASH access keys to only a few methods.
 * @param {Object} req - current route request
 * @return {Object} flash data of form {error: 'error', success: 'success'}
 */
function flashToView(req) {
  let uri_query = req.query.next;
  if(req.query.show) uri_query += '&show=' + req.query.show;
  if(uri_query){
      uri_query = encodeURIComponent(uri_query);
  }else{
    uri_query = '/'
  }
  return({
    error: req.flash('error'),
    success: req.flash('success'),
    profileSuccess: req.flash('profile_success'),
    profileError: req.flash('profile_error'),
    redirectTo: uri_query,
    preLoginEmail: req.session.preLoginEmail});
};

const getCurrentDateTime = () => (new Date().toISOString().slice(0, 19).replace('T', ' '));

const convertUtc = function(date_time){
    let dt = new Date(date_time);
    dt = moment(dt).format("YYYY-MM-DD HH:mm:ss");
    return moment.utc(dt);
}

module.exports = {
  flashError: flashError,
  flashSuccess: flashSuccess,
  flashProfileSuccess,
  flashProfileError,
  flashToView: flashToView,
  getCurrentDateTime,
  convertUtc
};
