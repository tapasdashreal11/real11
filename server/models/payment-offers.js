const mongoose = require('mongoose');
var _ = require('lodash');

const AdminSchema = mongoose.Schema({
    coupon_code: { type: String, default: '' },
    min_amount: { type: Number, default:  0},
    max_cashback_amount: { type: Number, default:  0},
    max_cashback_percent: { type: Number, default:  0},
    usage_limit: { type: String, default:  0},
    per_user_limit: { type: String, default:  0},
    expiry_date: { type: String, default: '' },
    status: { type: Number, enum: [1,0], default: 1 },
    first_deposite: { type: Number, enum: [1,0], default: 0 },
    coupon_type: { type: String, default: '' },
    deposit_percent: { type: Number, default: 0 },
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);


AdminSchema.statics.getTotalCount = function(){
    return this.find({}).countDocuments().exec();
},
module.exports = mongoose.model('coupon_code', AdminSchema, 'coupon_codes');