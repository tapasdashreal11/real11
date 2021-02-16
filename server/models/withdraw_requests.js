const mongoose = require('mongoose');
var _ = require('lodash');



const AdminSchema = mongoose.Schema({
    refund_amount: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    type: { type: String, default: '' },
    request_status: { type: Number, default: 0 }, //0=>pending/,1=>confirm,2=>reject request,3=>Pending_paytm,4=>Failed_paytm, 6=>pending_icici 	
    refund_initiate: { type: Number, default: 0 }, // 	0=no,1=yes,2=fail 
    approve_date: { type: Date, default: null },
    transfer_id: { type: String, default: null },
    reference_id: { type: String, default: null },
    amount: { type: Number, default: 0 },
    is_cancelled: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    message: { type: String, default: null },
    wallet_type: { type: String, default: false },
    is_instant: { type: Number, enum: [1,0], default: 0 },
    instant_withdraw_comm: {type: Number, default: 0},
    // withdraw_confirm_type: {type: Number}
}, {
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
}
);

module.exports = mongoose.model('withdraw_request', AdminSchema);
