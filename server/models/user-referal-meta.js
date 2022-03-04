const mongoose = require('mongoose');

const userRefMetaSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refered_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    event: { type: String, default: '' },
    user_earn: { type: Number, default: 0 },
    refered_user_earn: { type: Number, default: 0 },
    status: { type: String, enum: [1, 0], default: 1 }
}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);
module.exports = mongoose.model('referal_code_detail', userRefMetaSchema);