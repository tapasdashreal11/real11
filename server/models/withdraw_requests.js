const mongoose = require('mongoose');
var _ = require('lodash');



const AdminSchema = mongoose.Schema({

    refund_amount: { type: Number, default: 0 },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, default: '' },
    request_status: { type: Number, default: 0 },
    refund_initiate: { type: Number, default: 0 },
    approve_date: { type: Date, default: null },
    transfer_id: { type: String, default: null },
    reference_id: { type: String, default: null },
    amount: { type: Number, default: 0 },
    is_cancelled: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    wallet_type: { type: String, default: false },
    is_instant: { type: Number, enum: [1,0], default: 0 },
}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('withdraw_request', AdminSchema);
