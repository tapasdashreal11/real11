var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var playingSchema = new Schema({
  "match_id": {
    "type": Number
  },
  "playing_11": {
    "type": [
      Number
    ]
  }
});

module.exports = mongoose.model('playing', playingSchema, 'playing');