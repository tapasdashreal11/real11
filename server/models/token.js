'use strict';
var mongoose = require('mongoose');
var crypto = require('../../lib/crypto');

var tokenSchema = mongoose.Schema({
  token: {
    type: String,
    default: crypto.randomString
  },
  device_type: {
    type: String,
    default: ''
  },

  device_id: {
    type: String,
    default: ''
  },

  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expireHours: {
    type: Number,
    default: 24
  }
},
{
  timestamps: { createdAt: 'created', updatedAt: 'modified' },
  toObject: { getters: true, setters: true },
  toJSON: { getters: true, setters: true }
});

tokenSchema.virtual('expireMilliseconds').get(function () {
  return (this.expireHours * 60 * 60 * 1000);
});

tokenSchema.virtual('isExpired').get(function () {
  var ageMillis = Date.now - this.createdAt;
  return (this.expireMilliseconds < ageMillis);
});

module.exports = mongoose.model('Token', tokenSchema);
