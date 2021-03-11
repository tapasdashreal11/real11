var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var playerTeamContestSchema = new Schema({
	// player_team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'player_team', index: true },
	parent_match_id: { type: Number, default: 0 },
	match_id: { type: Number, default: 0 },
	series_id: { type: Number },
	sport: { type: Number },
	contest_id: { type: mongoose.Schema.Types.ObjectId },
	user_id: { type: mongoose.Schema.Types.ObjectId},
	rank: { type: Number,default:0 },
	counter: { type: Number },
	previous_rank: { type: Number },
	winning_amount: { type: Number },
	winning_amount_distributed: { type: Number, enum: [1, 0], default: 0 },
	// match_start_notification: { type: Number, enum: [1,0], default: 0 },
	match_end_notification: { type: Boolean },
	winning_amount_notification: { type: Number },
	points: { type: Number },
	commision: { type: Number },
	is_cancelled: { type: Number, default: 0 },
	is_deleted: { type: Number, default: 0 },
	prediction: { type:Object},
	join_contest_detail: {
		bonus_amount: {type: Number},
		winning_amount: {type: Number},
		deposit_cash: {type: Number},
		extra_amount: {type: Number},
		total_amount: {type: Number},
		admin_comission: {type: Number},
	}
});
module.exports = mongoose.model('lf_joined_contest', playerTeamContestSchema, 'lf_joined_contest');