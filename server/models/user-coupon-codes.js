var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var userCouponCodeSchema = new Schema({
  "coupon_code_id":ObjectId,
  "user_id":ObjectId,
  "applied_on":Date,
  "status":{type:Number,default:0}
});

module.exports = mongoose.model('user_coupon_codes', userCouponCodeSchema, 'user_coupon_codes');