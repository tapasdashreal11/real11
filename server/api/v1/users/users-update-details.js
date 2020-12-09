const Users = require("../../../models/user");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);

// @params
// {
//   "state" : "",
//   "gender" : "Male",
//   "mobile" : "9529036853",
//   "user_id" : "827",
//   "address" : "",
//   "pincode" : "",
//   "language" : "en",
//   "city" : "",
//   "date_of_birth" : "12-02-2020",
//   "email" : "saurabhjain@mailinator.com",
//   "name" : "saurabh",
//   "country" : "India"
// }

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    // console.log('profile_params',params);
    // let constraints = { 
    //   language: "required",      
    //   user_id: "required"
    // };

    // let validator = new Validator(params, constraints);
    // let matched = await validator.check();
    // if (!matched) {
    //   response["message"] = "User id, language are Empty.";
    //   response["errors"] = validator.errors;
    //   return res.json(response);
    // }

    try {
      let userId = req.userId;
      // console.log('userId', userId);
      let user = await Users.findOne({ _id: userId });
      if (user) {

        let updatedData = {};


        let full_name = params.name;

        full_name = full_name.split(' ');

        let firstName = full_name[0];
        let lastName = '';
        if (full_name[1]) {
          lastName = full_name[1];
        }
        updatedData.state = params.state || '';
        updatedData.first_name = firstName || '';
        updatedData.last_name = lastName || '';
        updatedData.language = params.language || '';
        // updatedData.email = params.email || '';
        updatedData.date_of_birth = params.date_of_birth || '';
        // updatedData.phone = params.mobile || '';
        updatedData.address = params.address || '';
        updatedData.city = params.city || '';
        updatedData.state = params.state || '';


        updatedData.country = params.country || '';
        updatedData.postal_code = params.pincode || '';
        updatedData.gender = (params.gender == 'male' || params.gender == 'MALE') ? 'MALE' : 'FEMALE';
        updatedData.sms_notify = params.sms_notify || 1;

        response["message"] = "Profile updated successfully.";

        // console.log('updatedData____1',updatedData)
        const result = await Users.update({ _id: user._id }, { $set: updatedData });
        //  console.log('result', result)


        response["status"] = true;
        response["data"] = updatedData;
        return res.json(response);
      } else {
        response["message"] = "Invalid User id.";
        return res.json(response);
      }
    } catch (err) {
      response["msg"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
