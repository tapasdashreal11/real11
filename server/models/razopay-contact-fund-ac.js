const mongoose = require('mongoose');
const razopayFundAc = mongoose.Schema({
    contact_id: { type: String },
    fund_account_id: { type: String},
    user_id: { type: mongoose.Schema.Types.ObjectId, unique: true },
    change_bank_req_accept: {type: Boolean, default: false},
    old_func_account_id: { type: mongoose.Schema.Types.ObjectId, unique: true },
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('razopay_fund_ac', razopayFundAc,'razopay_fund_ac');