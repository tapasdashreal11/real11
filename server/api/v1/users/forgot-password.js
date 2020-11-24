
const Users = require("../../../models/user");
const EmailTemplate = require("../../../models/email");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const config = require('../../../config');
const { sendMail} = require("../common/helper");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = {
      email: "required"
    };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing !";
      response["errors"] = validator.errors;
      return res.json(response);
    }

    try {
      let user = await Users.findOne({ email: params.email });
      if (user) {
        // console.log(user);return false;
        let verifyStr = Buffer.from(user.email).toString('base64');
        let emailLink = new Date().getTime() + verifyStr;
        let emailTemplate = await EmailTemplate.findOne({ subject: "forgot_password" });
        if(emailTemplate) {
          var rootUrl = `${req.protocol}://${req.get('host')}`;
          var passwordResetUrl  = `${rootUrl}${'/api/v1/reset-password-view'}/${encodeURIComponent(emailLink)}`;
          
          emailTemplate.template  = emailTemplate.template.replace('{{user}}',user.first_name);
          emailTemplate.template  = emailTemplate.template.replace('{{link}}',passwordResetUrl);
          const to  = user.email;
          const from = config.supportEmail;
          const subject = emailTemplate.email_name;
          const message  =  emailTemplate.template;
          sendMail(to, from, subject, message);
        }
        
        let updatedData = {};
        updatedData.verify_string = emailLink;
        response["message"] = "Email has been sent successfully";
        const result = await Users.update({ _id: user._id }, { $set: updatedData });

        response["status"] = true;
        response["data"] = {};
        return res.json(response);
      } else {
        response["message"] = "Invalid email address !";
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

















