var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;
var unityGamesPtcSchema = new Schema({
	team_name: { type: String, default:''},
	match_id: { type: Number },
	sport: { type: Number },
	contest_id: { type: mongoose.Schema.Types.ObjectId },
	user_id: { type: mongoose.Schema.Types.ObjectId},
	rank: { type: Number,default:0 },
	winning_amount: { type: Number,default:0 },
	winning_amount_distributed: { type: Number, enum: [1, 0], default: 0 },
	match_end_notification: { type: Boolean },
	winning_amount_notification: { type: Number,default:0 },
	points: { type: Number ,default:0},
	commision: { type: Number,default:0 },
	is_deleted: { type: Number, default: 0 },  // contest cancel 
	user_score: { type: Object,default:{} },
	price_win: { type: Number,default:0 },
	zop_match_id: { type: Number },
	unity_room_id: {type: Number},
	game_code: { type: String},
	avatar: { type: String},
	join_contest_detail: {
		deduct_bonus_amount: {type: Number,default:0},
		deduct_winning_amount: {type: Number,default:0},
		deduct_deposit_cash: {type: Number,default:0},
		deduct_extra_amount: {type: Number,default:0},
		total_amount: {type: Number,default:0},
		admin_comission: {type: Number,default:0},
		retention_bonus:{type: Number,default:0}
	}
},{
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
});
module.exports = mongoose.model('unity_games_ptc', unityGamesPtcSchema, 'unity_games_ptc');