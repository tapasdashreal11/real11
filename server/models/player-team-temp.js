var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var playerTeamTempSchema = new Schema({
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
  
  "points": {
    "type": Number
  },
  
  "team_count": {
    "type": Number
  },
  "players": [{
    "type": Number
  }],
  
},
);

module.exports = mongoose.model('player_team_temp', playerTeamTempSchema, 'player_team_temp');