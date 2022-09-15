var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var quizQuestionSubmitSchema = new Schema({
  "id": {
    "type": "String"
  },
  "question_id": {
    "type": ObjectId
  },
  "user_id": {
    "type": ObjectId
  },
  "question": {
    "type": "String"
  },
  "write_ans": {
    "type": Object
  },
  "user_ans": {
    "type": Object
  },
  option: { type: Array },
  "question_point": {
    "type": Number
  },
  "status": {
    "type": Number
  }
},{
  timestamps:true
});

module.exports = mongoose.model('quiz_question_submit', quizQuestionSubmitSchema, 'quiz_question_submit');