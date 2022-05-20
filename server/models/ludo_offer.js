var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;
var ludoOfferSchema = new Schema({
    id: {
        type: String
    },
    user_id: {
        type: ObjectId
    },
    match_id:{type: Number},
    status: {
        type: Number, default: 1
    },
    expiry_date_str: { type: String },
    expiry_date: { type: Date },
    contest_bonous: {
        type: Array,default:[]  //contest wise bounous with different amount
    }
},{
    timestamps:true
  });
module.exports = mongoose.model('other_games_offer', ludoOfferSchema, 'other_games_offer');