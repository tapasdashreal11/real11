const mongoose = require('mongoose');
var _ = require('lodash');


const PaymentOptionsSchema = mongoose.Schema({
    options_type: { type: String, default: '' },
    deposit_pay_gateway: { type:[] },
}, {
        timestamps: true,

    }
);

module.exports = mongoose.model('payment_options', PaymentOptionsSchema);
