var mongoose = require('mongoose');
var Schema = mongoose.Schema;
let ObjectId = require('mongodb').ObjectID;

var otherGamesContest = new Schema({
    id: {
        type: Number
    },
    match_id: {
        type: Number
    },
    contest_id: {
        type: ObjectId
    },
    parent_contest_id: {
        type: ObjectId
    },
    category_id: {
        type: ObjectId
    },
    invite_code: {
        type: String
    },
    joined_users: {
        type: Number,
        default: 0
    },
    is_full: {
        type: Number,
        default: 0
    },
    category_name: { type: String, default: '' },
    category_description: { type: String, default: '' },
    category_seq: { type: Number },
    status: { type: Number, enum: [1, 0], default: 1 },
    is_auto_create: { type: Number, enum: [1, 0], default: 0 },
    admin_create: { type: Number, enum: [1, 0], default: 0 },
    sport: { type: Number },
    contest: { type: Object },
    is_private: {type: Number, default: 0 },
},{
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
});

module.exports = mongoose.model('other_games_contest', otherGamesContest, 'other_games_contest');