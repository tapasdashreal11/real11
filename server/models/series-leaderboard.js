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
    sport: {
        type: Number,
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('series_leaderboard', weeklyLeaderBoardSchema, 'series_leaderboard');