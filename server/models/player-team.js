var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var playerTeamSchema = new Schema({
  "id": {
    "type": "String"
  },
  "user_id": {
    "type": ObjectId
  },
  "series_id": {
    "type": Number
  },
  "match_id": {
    "type": Number
  },
  "captain": {
    "type": Number
  },
  "vice_captain": {
    "type": Number
  },
  "one_five_x": {
    "type": Number,default:0
  },
  "two_x": {
    "type": Number,default:0
  },
  "three_x": {
    "type": Number,default:0
  },
  "four_x": {
    "type": Number,default:0
  },
  "five_x": {
    "type": Number,default:0
  },
  "x_system": {
    "type": Number,default:0
  },
  "x_counter": {
    "type": Number,default:2
  },
  "substitute": {
    "type": "String"
  },
  "substitute_status": {
    "type": "String"
  },
  "points": {
    "type": Number
  },
  "status": {
    "type": Number
  },
  "sport": {
    "type": Number
  },
  "team_count": {
    "type": Number
  },
  "players": [{
    "type": Number
  }],
  playerStr:{
    type:String
  }
},{
  timestamps:true
});

module.exports = mongoose.model('player_team', playerTeamSchema, 'player_team');