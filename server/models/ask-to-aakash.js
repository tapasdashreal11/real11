var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var askToAakashSchema = new Schema({
    id: {
        type: String
    },
    user_name: {
        type: String, default: ''
    },
    question: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    phone: {
        type: String
    },
    status: {
        type: Number, default: 1
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('ask_to_aakash', askToAakashSchema, 'ask_to_aakash');