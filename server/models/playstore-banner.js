var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;

var bannerSchema = new Schema({
	"sequence": {
		"type": Number
	},
	"banner_type": {
		"type": Number
	},
	"image": {
		"type": String
	},
	// "offer_id": {
	//   "type": Number
	// },
	// "series_id": {
	//   "type": Number
	// },
	// "match_id": {
	//   "type": Number
	// },
	"status": {
		"type": Number,
		"default": 1
	},
	"url": { "type": String, "default": '' },
}, {
	timestamps: true
});

bannerSchema.statics.getTotalCount = function (cond) {
	return this.find(cond).count().exec();
}

module.exports = mongoose.model('playstore_banner', bannerSchema, 'playstore_banner');