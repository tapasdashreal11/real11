var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var teamSchema = new Schema({
	"id": {
		"type": Number
	},
	"team_id": {
		"type": Number
	},
	"team_name": {
		"type": String
	},
	"team_short_name": {
		"type": String
	},
	"flag": {
		"type": String
	},
	"status": {
		"type": Number
	},
	"sport": {
		"type": Number
	}
}, {
	timestamps: true
});

module.exports = mongoose.model('team', teamSchema, 'mst_teams');