var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var settingsSchema = new Schema({
	id: {
		type: String
	},
	priority_match_sport: {
		type: Number,default: 1
	}
});

module.exports = mongoose.model('settings', settingsSchema, 'settings');