var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;
var playerTeamContestSchema = new Schema({
	prediction_id: { type: mongoose.Schema.Types.ObjectId},
	parent_match_id: { type: Number },
	team_name: { type: String, default:''},
	team_count: { type: Number,default:1 },
	match_id: { type: Number },
	series_id: { type: Number },
	sport: { type: Number },
	contest_id: { type: mongoose.Schema.Types.ObjectId },
	user_id: { type: mongoose.Schema.Types.ObjectId},
	rank: { type: Number,default:0 },
	counter: { type: Number,default:0 },
	previous_rank: { type: Number,default:0 },
	winning_amount: { type: Number,default:0 },
	winning_amount_distributed: { type: Number, enum: [1, 0], default: 0 },
	// match_start_notification: { type: Number, enum: [1,0], default: 0 },
	match_end_notification: { type: Boolean },
	winning_amount_notification: { type: Number,default:0 },
	points: { type: Number ,default:0},
	commision: { type: Number,default:0 },
	is_cancelled: { type: Number, default: 0 }, // match cancel
	is_deleted: { type: Number, default: 0 },  // contest cancel 
	prediction: { type: Object },
	user_preview: { type: Object,default:{} },
	price_win: { type: Number,default:0 },
	join_contest_detail: {
		deduct_bonus_amount: {type: Number,default:0},
		deduct_winning_amount: {type: Number,default:0},
		deduct_deposit_cash: {type: Number,default:0},
		deduct_extra_amount: {type: Number,default:0},
		total_amount: {type: Number,default:0},
		admin_comission: {type: Number,default:0},
		retention_bonus:{type: Number,default:0}
	}
});
module.exports = mongoose.model('lf_joined_contest', playerTeamContestSchema, 'lf_joined_contest');