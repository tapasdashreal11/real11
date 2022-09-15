var mongoose = require('mongoose');
var Schema = mongoose.Schema,
    ObjectId = Schema.ObjectId;

var quizQuestionSchema = new Schema({
  "id": {
    "type": "String"
  },
  "question": {
    "type": "String"
  },
  "ans": {
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

module.exports = mongoose.model('quiz_question', quizQuestionSchema, 'quiz_question');