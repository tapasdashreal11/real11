'use strict';
var mongoose = require('mongoose');
var sanitize = require('mongo-sanitize');
var validator = require('validator');

var logger = require('../../utils/logger')(module);

var ContactPreference = require('./contact-preference');

var contactSchema = mongoose.Schema({
  firstName : {
    type: String,
    default: "",
  },
  middleName : String,
  lastName: {
    type: String,
    default: "",
  },
  phone: String, // validator.isMobilePhone(num, locale)
  birthday: Date,
  zipcodes: String,
  gender: {
    type: String,
    enum: ['Male', 'Female', 'Other', 'N/A'],
    default: 'N/A'
  },
  contactPreferences: {
    type: ContactPreference.schema,
    default: new ContactPreference()
  },
});

///////////////////////////////////
// PROPERTIES
///////////////////////////////////
contactSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});
contactSchema.virtual('givenName').get(function () {
  return this.firstName;
});
contactSchema.virtual('surname').get(function () {
  return this.lastName;
});
contactSchema.virtual('birthdayStr').get(function () {
  if (!this.birthday) return "";
  var bd = this.birthday;
  var mon = bd.getMonth() + 1;
  mon = (mon < 10) ? `0${mon}` : `${mon}`;
  var day = bd.getDate();
  day = (day < 10) ? `0${day}` : `${day}`;
  var year = bd.getFullYear();
  // return `${year}-${mon}-${day}`;
  return `${mon}/${day}/${year}`;
});

module.exports = mongoose.model('ContactInfo', contactSchema);
