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