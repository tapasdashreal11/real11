var mongoose = require('mongoose');
var Schema = mongoose.Schema;
let ObjectId = require('mongodb').ObjectID;

var matchContestSchema = new Schema({
  id: {
    type: Number
  },
  match_id: {
    type: Number
  },
  series_id: { //added in v2s
    type: Number
  },
  contest_id: {
    type: mongoose.Schema.Types.ObjectId, ref: 'contest'
  },
  parent_contest_id: {
    type: ObjectId
  },
  category_id: {
    type: mongoose.Schema.Types.ObjectId, ref: 'category'
  },
  created: {
    type: Date
  },
  invite_code: {
    type: String
  },
  joined_users: {
    type: Number,
    default: 0
  },
  isCanceled: {
    type: Number
  },
  youtuber_code: {
    type: Number
  },
  is_full: {
    type: Number,
    default:0
  },
  is_private: {
    type: Number,
    default:0
  },
  is_virtual_contest: {
    type: Number,
    default:0
  },
  category_name: { type: String, default: '' },
  category_description: { type: String, default: '' },
  category_seq: { type: Number },

  contestStartDateTime: { type: Date },

  localteam: { type: String, default: '' },
  visitorteam: { type: String, default: '' },
  localteam_id: { type: Number, default: 0 },
  visitorteam_id: { type: Number, default: 0 },
  match_status: { type: String, default: 0 },
  status: { type: Number, enum: [1,0], default: 1 },
  is_auto_create: { type: Number, enum: [1,0], default: 0 },
  admin_create: { type: Number, enum: [1,0], default: 0 },
  team_list_pdf: { type: String },
  total_auto_create_contest: { type: Number },
  before_time_bonus: { type: Number },
  after_time_bonus: { type: Number },
  usable_bonus_time: { type: Date },
  sport: { type: Number },
  contest: { type: Object },
});

matchContestSchema.statics.getContestsByContestIds = function(matchId, contestIds){
  return this.find({
    match_id: matchId,
    // contest_id: { $in: contestIds },
    is_full: { $ne: 1 },
  }).exec();
}

matchContestSchema.statics.getMatchContestCount = function(matchId){
  return this.find({
    match_id: matchId
  }).countDocuments().exec();
}

matchContestSchema.statics.getInviteCode = function(matchId, contestId, sport) {
  return this.findOne({
    match_id: matchId,
    sport: sport,
    contest_id: ObjectId(contestId),
  },{invite_code:1, before_time_bonus :1, after_time_bonus :1, usable_bonus_time:1, _id:0}).exec();
}

module.exports = mongoose.model('match_contest', matchContestSchema, 'match_contest');