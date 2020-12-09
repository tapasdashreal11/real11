var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var customBreakupSchema = new Schema({
  "id": {
    "type": Number
  },
  "contest_id": {
    "type": Number
  },
  "name": {
    "type": String
  },
  "start": {
    "type": Number
  },
  "end": {
    "type": Number
  },
  "percentage": {
    "type": Number
  },
  "price": {
    "type": Number
  },
  "image": {
    "type": String
  },
  "created": {
    "type": Date
  },
  "modified": {
    "type": Date
  }
});

module.exports = mongoose.model('custom_breakup', customBreakupSchema);