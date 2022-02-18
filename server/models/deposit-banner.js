var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var bannerSchema = new Schema({
  "sequence": {
    "type": Number
  },
  "banner_type": {
    "type": Number
  },
  "image": {
    "type": String
  },
  "offer_id": {
    "type": Number
  },
  "series_id": {
    "type": Number
  },
  "match_id": {
    "type": Number
  },
  "status": {
    "type": Number
  },
  "sport": {
    "type": Number
  }
});

module.exports = mongoose.model('deposite_banner', bannerSchema, 'deposite_banner');