var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var seriesPlayerSchema = new Schema({
  "id": {
    "type": Number
  },
  "series_id": {
    "type": Number
  },
  "series_name": {
    "type": String
  },
  "team_id": {
    "type": Number
  },
  "team_name": {
    "type": String
  },
  "player_id": {
    "type": Number
  },
  "player_name": {
    "type": String
  },
  "player_role": {
    "type": String
  },
  "odi": {
    "type": String
  },
  "t20": {
    "type": String
  },
  "t10": {
    "type": String
  },
  "test": {
    "type": String
  },
  "BB": {
    "type": String
  },
  "is_record_fatch": {
    "type": Boolean
  },
  "sport": {
    "type": Number
  },
  "image": {
    "type": String
  },
  "player_credit": {
    "type":  Number
  },
  "player_status": {
    "type":  Number
  },
  "is_lastplayed": {
    "type":  Number,default:0
  },
  "batting_style": {
    "type":  String
  },
  "birth_place": {
    "type":  String
  },
  "bowling_style": {
    "type":  String
  },
  "date_of_birth": {
    "type":  String
  }
});

module.exports = mongoose.model('series_player', seriesPlayerSchema, 'series_players');