const mongoose = require('mongoose');
var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');

const AdminSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refered_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    referal_code: { type: String, default: '' },
    user_amount: { type: Number, default: 0 },
    first_depo_reward_amount: { type: Number, default: 0 },

    refered_by_amount: { type: Number, default: 0 },
    status: { type: String, enum: [1, 0], default: 1 },

}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('referal_code_detail', AdminSchema);