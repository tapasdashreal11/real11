var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var couponSaleSchema = new Schema({
    id: {
        type: String
    },
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
    coupon_contest_data: { type: Array, default: [] },
    description: { type: String, default: '' },
    coupon_expiry :{ type: Date},
    coupon_limit :{type: Number},
    coupon_duration :{type: Number},
    series :{type: Number,default:0},
    is_private :{type: Number,default:0},
    is_repeat :{type: Number,default:2}, //default 2 for not repeatable 
    createAt: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('coupon', couponSaleSchema, 'coupon');