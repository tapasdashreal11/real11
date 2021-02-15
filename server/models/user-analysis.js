var mongoose = require('mongoose');
const db = require('../db');
var conn = db.getAnalysisDb();
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
    
var userAnalysis = new Schema({
    id: {
        type: String
    },
    match_name:{
        type:String
    },
    match_id: {
        type: Number
    },
    user_id: {
        type: ObjectId
    },
    contest_ids: {
        type: Array
    },
    is_offer_type: {
        type: Number
    },
    sport: {
        type: Number
    },
    offer_amount: {
        type: Number
    },
    offer_percent: {
        type: Number
    },
    series_id: {
        type: Number
    },
    is_offer_repeat: {
        type: Number,default:2  // 2 means not repeat or 1 means repeat the offer
    },
    contest_bonous: {
        type: Array,default:[]  // offer type 3 is contest wise bounous with different amount
    },
    created: {
        type: Date, default: Date.now()
    }
});
module.exports = conn.model('user_analysis', userAnalysis, 'user_analysis');