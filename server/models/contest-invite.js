var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var contestInviteSchema = new Schema({
    id: {
        type: String
    },
    refer_code: {
        type: String, default: ''
    },
    refer_by_user: {
        type: ObjectId
    },
    refered_user: {
        type: ObjectId
    },
    contest_id: {
        type: ObjectId
    },
    match_id: {
        type: Number
    },
    series_id: {
        type: Number
    },
    sport: {
        type: Number
    },
    use_status: {
        type: Number, default: 0
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('contest_invite', contestInviteSchema, 'contest_invite');