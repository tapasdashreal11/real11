const mongoose = require('mongoose');
var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');


// "id" : "1",
//     "first_name" : "Amit",
//     "last_name" : "Yadav",
//     "role_id" : "1",
//     "email" : "rohit@mailinator.com",
//     "phone" : "9649545044",
//     "password" : "$2y$10$smX8dYwNKdzL.s7tEL21H.WHuA0nqmPNnRaM6mWtvogKg30TC07OK",
//     "team_name" : "ADMIZ472R3",
//     "date_of_bith" : "1994-08-16",
//     "gender" : "1",
//     "country" : "India",
//     "state" : "Uttar Pardesh",
//     "city" : "Ghaziabad",
//     "postal_code" : "201001",
//     "address" : "Ghaziabad",
//     "image" : "user_1553922379.png",
//     "fb_id" : "",
//     "google_id" : "",
//     "refer_id" : "",
//     "otp" : "",
//     "otp_time" : "2020-03-04 03:02:20",
//     "is_login" : "0",
//     "last_login" : "0000-00-00 00:00:00",
//     "device_id" : "ksbjiojgr3q904tjdfg834jnelr834laj809239fjs",
//     "device_type" : "iphone",
//     "module_access" : null,
//     "current_password" : null,
//     "language" : "en",
//     "cash_balance" : "3",
//     "winning_balance" : "18",
//     "bonus_amount" : "177",
//     "reward_level" : null,
//     "status" : "1",
//     "is_updated" : "0",
//     "email_verified" : "0",
//     "verify_string" : "1551414690YWRtaW5AZ21haWwuY29t",
//     "sms_notify" : "1",
//     "auth_token" : "5366h41n3yc15b145u3j",
//     "is_youtuber" : "0",
//     "bonus_type" : "0",
//     "bonus_percent" : "0.00",
//     "refer_able" : "1",
//     "created" : "2017-08-30 00:00:00",
//     "modified" : "2018-10-05 18:14:34"


const AdminSchema = mongoose.Schema({
    first_name: { type: String, default: '' },
    last_name: { type: String, default: '' },
    role_id: { type: Number, default: 2 },
    email: { type: String, unique: true },
    new_email: { type: String, default: '' },
    phone: { type: String, unique: true },
    team_name: { type: String, default: '', unique: true },
    password: String,
    date_of_birth: { type: String, default: '' },
    city: { type: String, default: '' },
    gender: { type: String, default: 1 },
    country: { type: String, default: '' },
    state: { type: String, default: '' },
    postal_code: { type: String, default: '' },
    address: { type: String, default: '' },
    image: { type: String, default: '' },
    fb_id: { type: String, default: null },
    google_id: { type: String, default: null },
    refer_id: { type: String, default: '' , unique: true},
    otp: String,
    otp_time: String,
    is_login: { type: Boolean, default: 0 },
    last_login: { type: String, default: '' },
    device_id: { type: String, default: '' },
    device_type: { type: String, default: '' },
    module_access: String,
    current_password: String,
    language: { type: String, default: 'en' },
    cash_balance: { type: Number, default: 0.00 },
    winning_balance: { type: Number, default: 0.00 },
    bonus_amount: { type: Number, default: 0.00 }, //TO BE REMOVED
    cons_winning_balance: { type: Number, default: 0.00 },
	cons_cash_balance: { type: Number, default: 0.00 },
	cons_bonus_amount: { type: Number, default: 0.00 },
	refund_winning_balance: { type: Number, default: 0.00 },
	refund_cash_balance: { type: Number, default: 0.00 },
	refund_bonus_amount: { type: Number, default: 0.00 },
	bonus_balance: { type: Number, default: 0.00 },
	total_balance: { type: Number, default: 0.00 },
    reward_level: { type: Number, default: 0 },
    status: { type: Number, enum: [1,0], default: 0 },
    is_updated: { type: Boolean, default: 0 },
    mobile_verify: { type: Boolean, default: true },
    change_bank_req: { type: Boolean, default: false},
    email_verified: { type: Number, enum: [1,0], default: 0 },
    verify_string: String,
    sms_notify: { type: Boolean, default: 1 },
    auth_token: { type: String, default: '' },
    is_youtuber: { type: Boolean, default: 0 },
    bonus_type: { type: Number, default: 0 },
    bonus_percent: { type: Number, default: 0 },
    // refer_able: { type: Boolean, default: 1 },
    refer_able: { type: Number, default: 0 },
    avatar: { type: String, default: '' },
    pen_verify: { type: Number, enum: [1,0,2], default: 0 },
    bank_account_verify: { type: Number, enum: [1,0,2], default: 0 },
    fair_play_violation: { type: Number, enum: [1,0], default: 0 },
    pan_reject_reason: { type: String, default: '' },
    bank_reject_reason: { type: String, default: '' },
    extra_amount: { type: Number, default: 0 },
    perday_extra_amount: { type: Number, default: 0 },
    extra_amount_date: { type: Date },
    affiliate_amount : { type: Number, default: 0 },
    ip_address:{ type:String },
    clevertap_id:{ type:String,default: '' },
    appsflayer_id:{ type:String,default: '' },
    isFirstPaymentAdded:{ type:Number,default: 2 }, // default  wiil be 2 after added it will be 1
    instant_withdraw: { type: Number, enum: [1,0], default: 0 },
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

AdminSchema.statics.setTransactionDetail = function(user_id, winning_balance=0, cash_balance=0, bonus_balance=0, total_balance=0, cons_cash_balance=0, cons_winning_balance=0, cons_bonus_amount=0, refund_cash_balance=0, refund_winning_balance=0, refund_bonus_amount=0,extra_amount=0, extra_amount_date=null,perday_extra_amount=0) {
    let updateUserData = {
        cons_winning_balance:cons_winning_balance,
        cons_cash_balance: cons_cash_balance,
        cons_bonus_amount:cons_bonus_amount,
        refund_winning_balance:refund_winning_balance,
        refund_cash_balance:refund_cash_balance,
        refund_bonus_amount:refund_bonus_amount,
        winning_balance:winning_balance,
        cash_balance:cash_balance,
        bonus_amount:bonus_balance,
        total_balance:total_balance
    }
    //console.log(user_id,updateUserData)
    this.update({_id:user_id},{$set:updateUserData}).exec();
}

AdminSchema.statics.setTransactionDetailInc = function(user_id, winning_balance=0, cash_balance=0, bonus_balance=0, total_balance=0, cons_cash_balance=0, cons_winning_balance=0, cons_bonus_amount=0, refund_cash_balance=0, refund_winning_balance=0, refund_bonus_amount=0,extra_amount=0, extra_amount_date=null,perday_extra_amount=0) {
    
    let updateUserData = {
        cons_winning_balance   :   cons_winning_balance,
        cons_cash_balance      :   cons_cash_balance,
        cons_bonus_amount      :   cons_bonus_amount,
        refund_winning_balance :   refund_winning_balance,
        refund_cash_balance    :   refund_cash_balance,
        refund_bonus_amount    :   refund_bonus_amount,
        total_balance          :   total_balance,
        extra_amount_date      :   extra_amount_date,
        perday_extra_amount    :   perday_extra_amount
    }
    //console.log(user_id,updateUserData)
    // db.foobar.update({name:"foobar"},{$set:{foo:{bar:"bar"}},$inc:{"counts.foo":1}},true);
    this.update({_id:user_id}, {$set:updateUserData, $inc: { cash_balance:-cash_balance, bonus_amount:-bonus_balance, winning_balance:-winning_balance,extra_amount:-extra_amount }}).exec();
}
// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('User', AdminSchema);