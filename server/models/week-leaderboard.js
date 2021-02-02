var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var weeklyLeaderBoardSchema = new Schema({
    id: {
        type: String
    },
    series_id: {
        type: Number,
    },
    series_name: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    week_start: {
        type: Date
    },
    week_end: {
        type: Date,
    },
    week_count: {
        type: Number,
    },
    total_points: {
        type: Number,
    },
    pre_rank: {
        type: Number,
    },
    current_rank: {
        type: Number,
    },
    win_distribute: {
        type: Number,default:0
    },
    win_price: {
        type: String,
    },
    win_msz: {
        type: String,default:''
    },
    match_ids: {
        type: Array,default:[]
    },
    sport: {
        type: Number,
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('week_leaderboard', weeklyLeaderBoardSchema, 'week_leaderboard');