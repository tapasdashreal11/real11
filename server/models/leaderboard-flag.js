var mongoose = require('mongoose');
var Schema = mongoose.Schema

var leaderboardFlagSchema = new Schema({
    temp_collection:{
        type: Number
    },
    main_collection:{
        type: Number
    },
    last_collection_updated:{
        type: String
    },
    match_id:{
        type: Number
    }

    
});



module.exports = mongoose.model('leaderboard_flag', leaderboardFlagSchema, 'leaderboard_flag');