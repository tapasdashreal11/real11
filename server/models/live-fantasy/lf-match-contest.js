var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var matchContestSchema = new Schema({
	match_id: { type: Number },
	series_id: { type: Number },
	sport: { type: Number },
	contest_id: { type: mongoose.Schema.Types.ObjectId, ref: 'contest' },
	category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'category' },
	category_name: { type: String },
	invite_code: { type: String },
	joined_users: { type: Number, default: 0 },
	isCanceled: { type: Number },
	is_full: { type: Number,default:0 },
	is_private: { type: Number },
	contestStartDateTime: { type: Date },
	parent_contest_id: { type: ObjectId },
	localteam: { type: String, default: '' },
	visitorteam: { type: String, default: '' },
	localteam_id: { type: Number, default: 0 },
	visitorteam_id: { type: Number, default: 0 },
	// series_id: { type: Number, default: 0 },
	match_status: { type: String, default: 0 },
	status: { type: Number, enum: [1, 0], default: 1 },
	is_auto_create: { type: Number, enum: [1, 0], default: 0 },
	admin_create: { type: Number, enum: [1, 0], default: 0 },
	total_auto_create_contest: { type: Number },
	team_list_pdf: { type: String },
	before_time_bonus: { type: Number },
	after_time_bonus: { type: Number },
	usable_bonus_time: { type: Date },

	// contest: { type: Object },
	entry_fee: { type: Number },
	winning_amount: { type: Number },
	contest_size: { type: Number },
	contest_type: { type: String },
	confirmed_winning: { type: String },
	amount_gadget: { type: String },
	multiple_team: { type: String },
	contest_size: { type: Number },
	infinite_contest_size: { type: Number },
	winning_amount_times: { type: Number },
	winner_percent: { type: Number },
	is_auto_create: { type: Number },
	auto_create: { type: String },
	used_bonus: { type: Number },
	is_private: { type: Number, default: 0 },
	maximum_team_size: { type: Number, default: 1 },
	contest_shareable: { gtype: Number, default: 0 },
	breakup: { type: Object }

}, {
	timestamps: true
});



module.exports = mongoose.model('lf_match_contest', matchContestSchema, 'lf_match_contest');