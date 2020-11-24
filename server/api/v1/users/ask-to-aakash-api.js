const AskToAakash = require("../../../models/ask-to-aakash");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = { 
      user_name: "required",  
      question: "required",
      phone: "required"
    };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing !";
      response["errors"] = validator.errors;
      return res.json(response);
    }
    try {
      let userId = req.userId;
      if(userId) {
        let updatedData = {};
        updatedData.user_name = params.user_name;
        updatedData.question = params.question;
        updatedData.phone = params.phone;
        updatedData.user_id =  userId;

        await AskToAakash.create(updatedData);
        response["message"] = "Your question has been posted successfully.";
        response["status"] = true;
        response["data"] = updatedData;
        return res.json(response);
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (err) {
      console.log('catch',err);
      response["msg"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    console.log('outer catch',error);
    return res.send(ApiUtility.failed(error.message));
  }
};
