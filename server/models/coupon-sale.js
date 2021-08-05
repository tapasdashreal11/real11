var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var couponSaleSchema = new Schema({
    id: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    coupon_id: {
        type: ObjectId
    },
    coupon_name: { type: String, default: '' },
    description: { type: String, default: '' },
    coupon_credit: {
        type: Number, default: 0
    },
    coupon_used: {
        type: Number, default: 0
    },
    coupon_contest_data: {
        type: Array, default: []
    },
    status: {
        type: Number, default: 1
    },
    series_id: { type: Number, default: 0 },
    is_private: { type: Number, default: 0 },
    is_repeat: { type: Number, default: 2 }, //default 2 for not repeatable 
    expiry_date: { type: Date },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('coupon_sale', couponSaleSchema, 'coupon_sale');