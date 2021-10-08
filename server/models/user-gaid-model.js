var mongoose = require('mongoose');
var Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;
var userGaidMetaSchema = new Schema({
    user_gaid: {
        type: String
    },
    counter: {
        type: Number, default: 0
    }
});
module.exports = mongoose.model('user_gaid_meta', userGaidMetaSchema, 'user_gaid_meta');