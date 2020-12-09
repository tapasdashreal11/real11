var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = mongoose.Types.ObjectId;

var myContestModel = new Schema({
  id: {
    type: String
  },
  player_team_contest_id: {
    type: ObjectId
  },
  contest_id: {
    type: ObjectId
  },
  user_id: {
    type: ObjectId
  },
  match_id: {
    type: Number
  },
  sport: {
    type: Number
  },
  match_status: {
    type: String
  },
  series_id: {
    type: Number
  },
  total_contest: {
    type: Number
  }
},{
  timestamps:true
});

module.exports = mongoose.model('my_contest_models', myContestModel, 'my_contest_models');