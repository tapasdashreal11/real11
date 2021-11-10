var mongoose = require('mongoose');
var Schema = mongoose.Schema,
	ObjectId = Schema.ObjectId;
var otherGamesLudoLogsSchema = new Schema({
	error_txt: { type: String, default:''},
	room_id: { type: String }
},{
    timestamps: { createdAt: 'created', updatedAt: 'modified' },
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true }
});
module.exports = mongoose.model('other_games_ludo_log', otherGamesLudoLogsSchema, 'other_games_ludo_log');