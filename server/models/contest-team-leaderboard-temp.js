var mongoose = require('mongoose');
var Schema = mongoose.Schema
let ObjectId = require('mongodb').ObjectID;
    
var leaderboardSchema = new Schema({
    player_team_id: {
        type: ObjectId
      },
      match_id: {
        type: Number
      },
      contest_id: {
        type: ObjectId
      },
      user_id: {
        type: ObjectId
      },
      rank: {
        type: Number
      },
      counter: {
        type: Number
      },
      previous_rank: {
        type: Number
      },
    
    
});

leaderboardSchema.statics.getUserTeamByMatchId = function(match_id, contest_id, user_id){

    return this.aggregate([
      {
        $match: {
          match_id:parseInt(match_id),
          contest_id:ObjectId(contest_id),
          user_id:ObjectId(user_id)
        },
      },
      {
        $sort : {"rank": 1}
      },
      {
        $limit: 9,
      },
      {
          $lookup: {
              from: 'users',
              localField: 'user_id',
              foreignField: '_id',
              as: 'user'
          }
      },
      {
          $unwind: "$user"
      },
    ]);
  }

module.exports = mongoose.model('contest_team_leaderboard_temp', leaderboardSchema, 'contest_team_leaderboard_temp');