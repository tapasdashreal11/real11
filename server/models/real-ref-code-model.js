const mongoose = require('mongoose');
const realReferalCode = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    referal_code: { type: String, default: '' },
    sub_referal_code: { type: String, default: 'IPL200' },
    use_status: { type: String, enum: [1, 0], default: 1 } // used status default value 1 and after used it become 2
}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);
module.exports = mongoose.model('real_referal_code', realReferalCode,'real_referal_code');