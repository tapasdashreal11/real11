var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var predictionSchema = new Schema({
  "id": {
    "type": "String"
  },
  "user_id": {
    "type": ObjectId
  },
  "series_id": {
    "type": Number
  },
  "match_id": {
    "type": Number
  },
  "status": {
    "type": Number
  },
  "sport": {
    "type": Number
  },
  "team_count": {
    "type": Number
  },
  "prediction":{
      type:Object,default:{}
  }
},{
  timestamps:true
});

module.exports = mongoose.model('lf_prediction', predictionSchema, 'lf_prediction');