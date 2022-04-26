var mongoose = require('mongoose');
var Schema = mongoose.Schema,
ObjectId = Schema.ObjectId;
var userOtherInfo = new Schema({ 
    user_id: { type: ObjectId },
    is_ludo_played: {
        type: Number, default: 0
    },
});
module.exports = mongoose.model('user_other_info', userOtherInfo, 'user_other_info');