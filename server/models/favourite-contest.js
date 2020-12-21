var mongoose = require('mongoose');
const db = require('../db');
var conn = db.getAnalysisDb();
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
    
var favouriteContest = new Schema({
    id: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    status:{
        type: Number,default:1
    },
    contest_data: {
        type: Array
    },
    created: {
        type: Date, default: Date.now()
    }
});
module.exports = conn.model('favourite_contest', favouriteContest, 'favourite_contest');