const mongoose = require('mongoose');
const razopayPayoutStatus = mongoose.Schema({
    payout_id: { type: String },
    fund_account_id: { type: String},
    user_id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    withdraw_id: { type: mongoose.Schema.Types.ObjectId },
    transaction_id: { type: mongoose.Schema.Types.ObjectId },
    status: {type: Number,default:0},
    msz: { type: String},
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('razopay_payout_status', razopayPayoutStatus,'razopay_payout_status');