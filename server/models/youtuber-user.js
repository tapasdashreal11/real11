var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var youtuberSchema = new Schema({
    id: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    youtuber_code: {
        type: Number
    },
    sport: {
        type: Number, default: 1
    },
    status: {
        type: Number, default: 1
    },
    created_at: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('youtuber_user', youtuberSchema, 'youtuber_user');