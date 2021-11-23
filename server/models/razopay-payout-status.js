const mongoose = require('mongoose');
const razopayPayoutStatus = mongoose.Schema({
    payout_id: { type: String },
    fund_account_id: { type: String},
    user_id: { type: mongoose.Schema.Types.ObjectId },
    withdraw_id: { type: mongoose.Schema.Types.ObjectId },
    transaction_id: { type: mongoose.Schema.Types.ObjectId },
    status: {type: Number,default:0}, // default 0 case of pending.becomes 1 in case of processed else 2
    reverse_status: {type: Number,default:2}, // default value is 2 if any case of reverse/failed/cancelled then it becomes 1 
    txn_amount: {type: Number},
    msz: { type: String},
    utr: { type: String,default:''},
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('razopay_payout_status', razopayPayoutStatus,'razopay_payout_status');