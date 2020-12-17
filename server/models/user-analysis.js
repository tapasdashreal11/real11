var mongoose = require('mongoose');
const dbConf = require('../config').dbConnection;
const { mongoURIFORANALYSIS } = dbConf;
var conn = mongoose.createConnection(mongoURIFORANALYSIS,{ useNewUrlParser: true});
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
    created: {
        type: Date, default: Date.now()
    }
});
module.exports = conn.model('user_analysis', userAnalysis, 'user_analysis');