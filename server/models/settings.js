var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var settingsSchema = new Schema({
	id: {
		type: String
	},
	priority_match_sport: {
		type: Number,default: 1
	},
	android_vc: {
		type: String
	},
	iphone_vc: {
		type: String
	},
	is_maintenance: {
		type: Boolean,default:false
	},
	sport_type: {
		type: Array
	},
	max_team_create: {
		type: Number
	},
	is_week_board: { type: Number,default:0 },
    is_vpass: { type: Number, default:0 },
    is_phonepe_available: { type: Number, default:0 },
    phonepe_merchant_id: { type: String },
    youtber_codes: { type: String },
    contest_invite_codes: { type: String },
    is_paytm_offer: { type: Number },
    is_instant_withdraw: { type: Number, dafault: 0 },
    instant_withdraw_msg: { type: String, dafault: "" },
	leaderbord_popup_img: { type: String, default: "" },
	match_id: { type: Number, dafault: 0 },
});

module.exports = mongoose.model('settings', settingsSchema, 'settings');