const mongoose = require('mongoose');
var _ = require('lodash');

const AdminSchema = mongoose.Schema({
    first_name: { type: String, default: '' },
    last_name: { type: String, default: '' },
    role_id: { type: Number, default: 2 },
    email: { type: String },
    new_email: { type: String, default: '' },
    phone: { type: String },
    team_name: { type: String, default: '', unique: true },
    password: String,
    date_of_birth: { type: String, default: '' },
    city: { type: String, default: '' },
    gender: { type: String, default: 'MALE' },
    country: { type: String, default: '' },
    state: { type: String, default: '' },
    postal_code: { type: String, default: '' },
    address: { type: String, default: '' },
    image: { type: String, default: '' },
    fb_id: { type: String, default: null },
    google_id: { type: String, default: null },
    apple_id: { type: String, default: null },
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
    is_youtuber: { type: Number, default: 0 },
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
    isFirstPaymentAdded:{ type:Number,default: 0 }, // default  wiil be 0 after added it will be 1
    is_super_user:{ type:Number,default: 0 }, // default  wiil be 0 after added it will be 1
    is_dimond_user:{ type:Number,default: 0 }, // default  wiil be 0 after added it will be 1
    is_beginner_user:{ type:Number,default: 0 }, // default  wiil be 0 after added it will be 1
    is_looser_user:{ type:Number,default: 0 }, // default  wiil be 0 after added it will be 1
    instant_withdraw: { type: Number, enum: [1,0], default: 0 },
    media_partner_name: {type: String, default: ''},
    user_gaid: {type: String},
    dcode: {type: String}, 
    temp_phone: {type: String,default: ''},
    temp_email: {type: String},
    is_refered_by: { type: Boolean, default: false},
    ref_counter: { type: Number, default: 0 },
    ref_counter_used: { type: Number, enum: [1,0], default: 0 },
    xtra_cash_block: { type: Number, enum: [1,0], default: 0 },
    bonus_amount_block: { type: Number, enum: [1,0], default: 0 },
    bank_request_date: {type: Date},
    bank_xtra_amount: {type: Number, default: 0},
    win_dis_status: { type: Boolean, default: false},
    app_source: {type: String},
    user_type: {type: Number}
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