const QuizQuestionSubmit = require("../../../models/quiz-question-submit");
const QuizQuestion = require("../../../models/quiz-question");
const _ = require('lodash');
const { ObjectId } = require("mongodb");
const redis = require('../../../../lib/redis');
module.exports = {
    quizQuestion: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try { 
            const user_id = req.userId;
            // Here we are use LF redis for question list store..
            let redisKeyQuizQuestion = 'quiz-quesionlist';
            redis.getRedisForLf(redisKeyQuizQuestion, async (err, data) => {
                if (data) {
                    console.log("redis data is coming mega leader");
                    response["data"] = data;
                    response["message"] = "";
                    response["status"] = true;
                    return res.json(response);
                } else {
                    let quizData = await QuizQuestion.find({ status:1 });
                    if (quizData && quizData.length > 0) {
                        redis.setRedisForLf(redisKeyQuizQuestion, quizData);

                        response["data"] = quizData ? quizData : [];
                        response["message"] = "";
                        response["status"] = true;
                    } else {
                        response["data"] = [];
                        response["message"] = "No Data found!!";
                        response["status"] = false;
                    }
                    return res.json(response);
                }
            });
        } catch (err) {
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    },
    quizQuestionAnsSubmit: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try { 
            let { q_id, option_id } = req.params;
            const user_id = req.userId;
           
            let quizData = await QuizQuestionSubmit.find({ question_id:ObjectId(q_id),user_id: user_id,});
                    if (quizData && quizData.length > 0) {
                        response["data"] = [];
                        response["message"] = "You have already attend this question";
                        response["status"] = true;
                    } else {
                        let question = QuizQuestion.findOne({_id:ObjectId(q_id)});
                        if(question && question._id){
                             let queSubmit = {};
                             queSubmit.question = question.question;
                             queSubmit.option = question.option;
                             queSubmit.question_id = question._id;
                             queSubmit.write_ans = question.ans;
                             queSubmit.user_ans = option_id;
                             queSubmit.user_id = user_id;
                             queSubmit.question_point = question.question_point;
                             queSubmit.status = 1;
                            await QuizQuestionSubmit.create(queSubmit);
                            response["data"] = [];
                            response["message"] = "Answer Submit Successfully";
                            response["status"] = true;
                        }else{
                            response["data"] = [];
                            response["message"] = "No Data found!!";
                            response["status"] = false;
                        }
                    }
                    return res.json(response);

        } catch (err) {
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    },
    userSubmitedQuestionList: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try { 
            const user_id = req.userId;
            let quizData = await QuizQuestionSubmit.find({user_id: user_id});
                    if (quizData && quizData.length > 0) {
                        const dateAdded = (obj) => {
                            obj.date = moment(obj.created).format("YYYY-MM-DD")
                            return obj;
                        };
                        let newArr = quizData.map(dateAdded);
                        var listByDate = _.chain(newArr)
						.groupBy("date")
						.map((value, key) => ({ _id: key, date: key, info: value }))
                        .value()
                        
                        response["data"] = listByDate || [];
                        response["message"] = "";
                        response["status"] = true;
                    } else {
                        response["data"] = [];
                        response["message"] = "No Data found!!";
                        response["status"] = false;
                    }
                    return res.json(response);

        } catch (err) {
            response["msg"] = "Something went wrong!!";
            return res.json(response);
        }
    }
};