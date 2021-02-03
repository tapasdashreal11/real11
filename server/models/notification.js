const mongoose = require('mongoose');
// var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');

// {"id":"1","user_id":"33424","nitification_type":"3","unique_string":"",
// "title":"Transaction","notification":"Your transaction is successful.",
// "match_data":"","date":"2019-06-18","status":"1","is_send":"1"}


/*const AdminSchema = mongoose.Schema({
  nitification_type: String,
  unique_string: String,
  user_id: String,
 
  title: String,
  notification: String,
  match_data: String,
  date: String,  
  is_send: { type: String, enum: [1,0] },
  status: { type: String, enum: [1,0] }  
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);*/

// AdminSchema.plugin(mongoosePaginate);
//module.exports = mongoose.model('Notification', AdminSchema);
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

const AdminSchema = mongoose.Schema({
  notification_type: Number,
  unique_string: String,
  user_id: {
    type: ObjectId
  },
  title: String,
  notification: String,
  match_data: String,
  date: Date,  
  retention_bonous: { type: Object,default:{}},
  is_send: { type: Number, enum: [1,0] },
  status: { type: Number, enum: [1,0] }  
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('Notification', AdminSchema,'notifications');