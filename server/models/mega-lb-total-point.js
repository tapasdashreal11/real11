var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var megaLeaderBoardTotalPointsSchema = new Schema({
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
    }
});
module.exports = mongoose.model('mega_lb_total_points', megaLeaderBoardTotalPointsSchema, 'mega_lb_total_points');