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
    coupon_credit: {
        type: Number, default: 0
    },
    coupon_used: {
        type: Number, default: 0
    },
    status: {
        type: Number, default: 1
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('coupon_sale', couponSaleSchema, 'coupon_sale');