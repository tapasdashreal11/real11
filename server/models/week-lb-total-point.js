var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var weekLeaderBoardTotalPointsSchema = new Schema({
    id: {
        type: String
    },
    series_id: {
        type: Number,
    },
    match_id: {
        type: Number,
    },
    sport: {
        type: Number
    },
    user_id: {
        type: ObjectId
    },
    total_points: {
        type: Number,
    },
    week_count: {
        type: Number,
    },
    series_name: {
        type: String, default:''
    },
    visitor_flag: {
        type: String, default:''
    },
    local_flag: {
        type: String,default:''
    },
    localteam_short_name: {
        type: String,default:'TBA'
    },
    visitorteam_short_name: {
        type: String,default:'TBA'
    },
});
module.exports = mongoose.model('week_lb_total_points', weekLeaderBoardTotalPointsSchema, 'week_lb_total_points');