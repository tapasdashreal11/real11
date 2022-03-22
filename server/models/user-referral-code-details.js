const mongoose = require('mongoose');
var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');

const AdminSchema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    refered_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    referal_code: { type: String, default: '' },
    sub_referal_code: { type: String, default: '' },
    user_amount: { type: Number, default: 0 },
    first_depo_reward_amount: { type: Number, default: 0 },

    refered_by_amount: { type: Number, default: 0 },
    status: { type: String, enum: [1, 0], default: 1 },
    is_refered_by_full: { type: Number, enum: [1, 0], default: 0 },
    is_user_full: { type: Number, enum: [1, 0], default: 0 },
    is_referedby_deposit_full: { type: Number, enum: [1, 0], default: 0 },
    
    refered_by_deposit: { type: Number, default: 0 },
    user_amount_total: { type: Number, default: 0 },
    refered_by_amount_total: { type: Number, default: 0 },
    refered_by_deposit_total: { type: Number, default: 0 },

}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('referal_code_detail', AdminSchema);