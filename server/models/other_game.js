var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var otherGameSchema = new Schema({
	id: {
		type: String
	},
	match_id: {
		type: Number
	},
	sport: {
		type: Number
	},
	status: { type: Number, enum: [1, 0], default: 1 },
	sort: {
		type: Number
	},
	match_name: {
		type: String
	},
	match_logo: {
		type: String
	},
	game_code: {
		type: String
	},
	game_sub_url: {
		type: String
	},
	game_source: {
		type: String,
		default: "gamezop"
	},
}, {
	timestamps: true
});

module.exports = mongoose.model('other_games', otherGameSchema, 'other_games');
