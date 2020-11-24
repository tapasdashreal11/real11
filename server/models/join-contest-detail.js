var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var joinContestDetailsSchema = new Schema({
  id: {
    type: Number
  },
  user_id: {
    type: ObjectId
  },
  player_team_contest_id: {
    type: ObjectId
  },
  contest_id: {
    type: ObjectId
  },
  series_id: {
    type: Number
  },
  match_id: {
    type: Number
  },
  bonus_amount: {
    type: Number
  },
  winning_amount: {
    type: Number
  },
  deposit_cash: {
    type: Number
  },
  extra_amount: {
    type: Number
  },
  sport: {
    type: Number
  },
  wallet_type: {
    type: Number
  },
  total_amount: {
    type: Number
  },
  admin_comission: {
    type: Number
  }
},{
  timestamps:true
});

module.exports = mongoose.model('join_contest_detail', joinContestDetailsSchema, 'join_contest_detail');
