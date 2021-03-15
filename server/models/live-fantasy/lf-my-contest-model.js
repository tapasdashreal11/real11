var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = mongoose.Types.ObjectId;

var lfMyContestModel = new Schema({
  id: {
    type: String
  },
  user_id: {
    type: ObjectId
  },
  match_id: {
    type: Number
  },
  parent_match_id: {
    type: Number
  },
  sport: {
    type: Number
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

module.exports = mongoose.model('lf_my_contest_models', lfMyContestModel, 'lf_my_contest_models');