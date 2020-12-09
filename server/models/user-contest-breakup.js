var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var userContestBreakupSchema = new Schema({
    // "id": Number,
    contest_size_start: { type: Number, default: 0},
    "contest_size_end": { type: Number, default: 0},
    "winner": { type: Number, default: 0},
    "rank": { type: String, default: ''},
    "percent_prize": { type: Number, default: 0},
    "created": { "type": Date },
});

module.exports = mongoose.model('user_contest_breakup', userContestBreakupSchema, 'user_contest_breakup');