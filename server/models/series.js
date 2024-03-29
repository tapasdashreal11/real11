var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var seriesSchema = new Schema({
	id: {
		type: String
	},
	file_path: {
		type: String
	},
	id_api: {
		type: Number
	},
	name: {
		type: String
	},
	squads_file: {
		type: String
	},
	short_name: {
		type: String
	},
	status: {
		type: Number
	},
	sport: {
		type: Number
	},
	winning_breakup: {
		type: Number
	},
	elite_winning_breakup: {
		type: Number
	},
	winners: {
		type: Number
	},
	winners_amount: {
		type: Number
	},
	elite_winners: {
		type: Number
	},
	elite_winners_amount: {
		type: Number
	},
	leaderboard_status: {
		type: Number
	},
	is_leaderboard: {
		type: Number
	},
	is_elite: {
		type: Number
	},
	series_weeks: {
		type: Array,default:[]
	  },
	tab_data: {
		type: Array
	},
    week_leaderboard: {
		type: Number,default:0
	  },
    series_leaderboard: {
		type: Number,default:0
	  },
	mega_leaderboard: {
		type: Number,default:0
	  },
	start_date: {
		type: Date
	},
	end_date: {
		type: Date
	}
});

module.exports = mongoose.model('series', seriesSchema, 'series');