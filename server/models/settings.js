const { Double } = require('mongodb');
var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var settingsSchema = new Schema({
	id: {
		type: String
	},
	priority_match_sport: {
		type: Number,default: 1
	},
	android_vc: {
		type: String
	},
	iphone_vc: {
		type: String
	},
	is_maintenance: {
		type: Boolean,default:false
	},
	sport_type: {
		type: Array
	},
	max_team_create: {
		type: Number
	}
});

module.exports = mongoose.model('settings', settingsSchema, 'settings');