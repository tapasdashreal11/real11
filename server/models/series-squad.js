var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var seriesSquadSchema = new Schema({
	id: {
		type: String
	},
	series_id: {
		type: Number
	},
	date_str: {
		type: String
	},
	time_str: {
		type: String
	},

	date: {
		type: Date
	},
	time: {
		type: Date
	},
	type: {
		type: String
	},
	match_id: {
		type: Number
	},
	localteam: {
		type: String
	},
	localteam_id: {
		type: Number
	},
	localteam_score: {
		type: String
	},
	localteam_stat: {
		type: String
	},
	visitorteam: {
		type: String
	},
	visitorteam_id: {
		type: Number
	},
	visitorteam_score: {
		type: String
	},
	visitorteam_stat: {
		type: String
	},
	sport: {
		type: Number
	},
	status: { type: Number, enum: [1, 0], default: 1 },
	sort: {
		type: Number
	},
	match_status: {
		type: String
	},
	guru_url: {
		type: String
	},
	win_flag: {
		type: Number
	},
	generate_excel: {
		type: Date
	},
	notification_status: {
		type: String
	},
	notification_title: {
		type: String
	},
	pdf_created: {
		type: Date
	},
	localteam_short_name: {
		type: String
	},
	visitorteam_short_name: {
		type: String
	},
	local_flag: {
		type: String
	},
	local_flag: {
		type: String,
		default: null
	},
	visitor_flag: {
		type: String,
		default: null
	},
	series_name: {
		type: String
	},
	notification_status: { type: String, default: '' },
	notification_title: { type: String, default: '' },
	contest_count: { type: Number, default: 0 },
	xfactors:{type:Array,default:[]},
	players: { type: Array, default: [] },
	playing_11: { type: Array, default: [] },
	parent_id: { type: Number },
	youtuber_distributed: { type: Boolean, default: 0 },
	inning_number: { type: Number },
}, {
	timestamps: true
});

seriesSquadSchema.statics.upcomingMatchList = function () {
	return this.find({
		time: { $gt: new Date() },
		status: 1
	}).exec();
}

seriesSquadSchema.statics.getMatchStatus = function (matchId) {
	return this.find({
		match_id: matchId
	}, { status: 1, _id: 0 }).exec();
}

seriesSquadSchema.statics.getActiveMatch = function (seriesId, matchId) {
	return this.findOne({
		series_id: seriesId,
		match_id: matchId,
		status: 1
	}).exec();
}

module.exports = mongoose.model('series_squad', seriesSquadSchema, 'series_squad');
