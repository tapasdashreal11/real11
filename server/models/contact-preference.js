'use strict';
var mongoose = require('mongoose');

var preferenceSchema = mongoose.Schema({
  byEmail: {
    type: Boolean,
    default: true
  },
  bySms: {
    type: Boolean,
    default: true
  },
  // I oumou add the bypostalMail block to add it to the database schema
  byPostalMail: {
    type: Boolean,
    default: true
  },
  never: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model('ContactPreference', preferenceSchema);
