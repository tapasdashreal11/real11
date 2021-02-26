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
    status: {
        type: Number, default: 1
    },
    create_date: {
        type: Date, default: Date.now()
    }
});
module.exports = mongoose.model('coupon_sale', couponSaleSchema, 'coupon_sale');