var mongoose = require('mongoose');

var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var lfMatchesSchema = new Schema({
	match_id: { type: Number },
	series_id: { type: Number },
	sport: { type: Number },
	date: { type: Date },
	date_str: { type: String },
	time: { type: Date },
	time_str: { type: String },
	type: { type: String },
	localteam: { type: String },
	localteam_id: { type: Number },
	localteam_short_name: { type: String },
	local_team_name: { type: String },
	local_flag: { type: String, default: null },
	visitorteam: { type: String },
	visitorteam_id: { type: Number },
	visitorteam_short_name: { type: String },
	visitor_team_name: { type: String },
	visitor_flag: { type: String, default: null },
	contest_count: { type: Number, default: 0 },
	match_status: { type: String },
	status: { type: Number, enum: [1, 0], default: 1 },
	sort: { type: Number },
	win_flag: { type: Number },
	generate_excel: { type: Date },
	pdf_created: { type: Number },
	series_name: { type: String },
	parent_id: { type: Number },
	inning_number: { type: Number },
	lineup_status: { type: Number },
	winning_set: { type: Boolean, default: false },
	is_offer_added: { type: Number, default: 2 },
	over_parent_id: { type: Number },
	start_over: { type: Number },
	end_over: { type: Number },
	over_count: { type: Number },
	// over_match: {type:Boolean, default: false},
	match_counter: { type: Number, default: 0 },
	match_scores:{type:Object, default: {}},
	ball_update:{type:Object, default: {}},
	is_contest_stop: { type: Number, default: 0 },
	live_ball: { type: Number, default: 0 },
}, {
	timestamps: true
});

module.exports = mongoose.model('lf_matches', lfMatchesSchema, 'lf_matches');