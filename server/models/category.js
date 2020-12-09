var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var categorySchema = new Schema({
  "id": {
    "type": "Number"
  },
  "category_name": {
    "type": "String"
  },
  "description": {
    "type": "String"
  },
  "image": {
    "type": "String"
  },
  "status": {
    "type": "Number"
  },
  "sport": {
    "type": "Number"
  },
  "sequence": {
    "type": "Number"
  },
  "created": {
    "type": "Date"
  },
  "modified": {
    "type": "Date"
  }
});

module.exports = mongoose.model('category', categorySchema, 'category');