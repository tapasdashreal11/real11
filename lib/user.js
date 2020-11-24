'use strict';

var Promise = require('bluebird');
const User = require('../server/models/user');
module.exports.userIdGet = function(param) {
  const userId = param.userHref;
  return User.findById(userId);
};

module.exports.userInfoGet = function(param) {
  const userId = param.userHref;
  return User.findById(userId).then((user) => {
    return (user ? {
      		"id": user.id,
      		"email": user.email,
      		"fullName": user.fullName	
      } : {});
    })
};

module.exports.parseUserName = function(user) {
  if (user){
    let firstName = '';
    let lastName  = '';
    if (user && user.profile && user.profile.contactInfo){
      firstName = user.profile.contactInfo.firstName;
      lastName  = user.profile.contactInfo.lastName;
    }
    const userName = (firstName || lastName) ? firstName + ' ' + lastName : user.local.email;
    return userName;
  }
  return '';
};
