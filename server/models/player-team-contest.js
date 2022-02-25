var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = mongoose.Types.ObjectId;

var playerTeamContestSchema = new Schema({
  id: {
    type: String
  },
  player_team_id: {
    type: ObjectId
  },
  category_id: {
    type: ObjectId
  },
  team_count: {
    type: Number,
    default: 1
  },
  team_name: {
    type: String,
    default: ''
  },
  avatar: {
    type: String,
    default: ''
  },
  match_id: {
    type: Number
  },
  series_id: {
    type: Number
  },
  contest_id: {
    type: ObjectId
  },
  parent_contest_id: {
    type: ObjectId
  },
  user_id: {
    type: ObjectId
  },
  sport: {
    type: Number
  },
  counter: {
    type: Number
  },
  previous_rank: {
    type: Number
  },
  winning_amount: {
    type: Number
  },
  price_win: {
    type: Number
  },
  winning_amount_distributed: {
    type: Number,
    enum: [1,0],
    default: 0
  },
  match_start_notification: {
    type: Number,
    enum: [1,0],
    default: 0
  },
  match_end_notification: {
    type: Boolean
  },
  winning_amount_notification: {
    type: Boolean
  },
	is_cancelled: {
    type: Number,
		default:0
  },
	total_amount: {
    type: Number,  default: 0
  },
	bonus_amount: {
    type: Number, default: 0
  },
	rank: {
    type: Number, default: 0
  },
  points: {
    type: Number, default: 0
  },
  pid: {
    type: ObjectId
  },
  by_user: {
    type: ObjectId
  },
  isCreatedBy: {
    type: String
  },
  p_type: {
    type: String
  },  
  isPermainan: {
    type: Boolean
  }
},{
  timestamps:true
});

playerTeamContestSchema.statics.getIdsByMatchId = function(match_id, user_id, contestIds){
  return this.find({
    match_id:match_id,
    contest_id: { $in: contestIds },
    user_id:user_id
  }).exec();
}

playerTeamContestSchema.statics.getUserTeamByMatchId = function(match_id, contest_id, user_id, sport){
  
  return this.aggregate([
    {
      $match: {
        match_id:parseInt(match_id),
        sport:parseInt(sport),
        contest_id:ObjectId(contest_id),
        user_id:ObjectId(user_id)
      },
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
    {
      $sort : {"rank": 1}
    },
    {
      $limit:15,
    },
  ]);
  
  
}

playerTeamContestSchema.statics.getAllTeamsByMatchId = function(match_id, contest_id, user_id, sport, aakashId) {
  if(aakashId) {
    return this.aggregate([
      {
        $match: {
          match_id:parseInt(match_id),
          sport: sport,
          contest_id:ObjectId(contest_id),
          // user_id:{$nin:[ObjectId(user_id),ObjectId(aakashId)]}
          user_id:{$ne:ObjectId(user_id)}
        },
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
      {
        $sort : {"rank": 1}
      },
      {
        $limit:100,
      },
    ]);
  } else {
    return this.aggregate([
      {
        $match: {
          match_id:parseInt(match_id),
          sport: sport,
          contest_id:ObjectId(contest_id),
          // user_id:{$ne:ObjectId(user_id)}
        },
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
      {
        $sort : {"rank": 1}
      },
      {
        $limit:100,
      },
    ]);
  }
}

module.exports = mongoose.model('player_team_contest', playerTeamContestSchema, 'player_team_contest');