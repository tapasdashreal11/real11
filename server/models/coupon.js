const mongoose = require('mongoose');
var _ = require('lodash');


const AdminSchema = mongoose.Schema({
    coupon_name: { type: String, default: '' },
    coupon_amount: { type: Number, default:  0},
    per_user_limit: { type: String, default:  1},
    expiry_date: { type: String, default: '' },
    status: { type: Number, enum: [1,0], default: 1 },
    coupon_credit: { type: Number, enum: [1,0], default: 0 },
    coupon_type: { type: String, default: '' },
    coupon_offer: { type: Number, default: 0 },
    coupon_sale_count: { type: Number, default: 0 },
    coupon_img: { type: String, default: '' },
    coupon_contest_ids: { type: Array, default: [] },
    description: { type: String, default: '' }
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);


AdminSchema.statics.getTotalCount = function(cond){
    return this.find(cond).count().exec();
},
module.exports = mongoose.model('coupon', AdminSchema);