const mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

const AdminSchema = mongoose.Schema({
  user_id: {
    type: ObjectId
  },
  notication_count: { type: Number, default:0}
}
);
module.exports = mongoose.model('notifications-meta', AdminSchema,'notifications-meta');