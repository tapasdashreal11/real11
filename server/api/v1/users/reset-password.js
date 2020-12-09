const Users = require("../../../models/user");
const EmailTemplate = require("../../../models/email");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const config = require('../../../config');
var help = require('../../../controllers/helpers');

module.exports = {
  resetPasswordView: async (req, res) => {
    try {
      if(req.params.verify_string && req.params.verify_string !== '') {
        var opts = help.flashToView(req);
        opts.token = req.params.verify_string;
        // console.log(opts.token);
        res.render('user/reset-password',opts);
        return false;
      } else {
        response["message"] = "Invalid URL!";
            return res.json(response);
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  },

  resetPassword: async (req, res) => {
    
    var opts = help.flashToView(req);
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let params = req.body;
      let constraints = {
        password: "required"
      };
  
      let validator = new Validator(params, constraints);
      let matched = await validator.check();
      if (!matched) {
        
        opts.message = "Required fields missing !";
        res.render('alert-msg',opts);
        return false;
      }
      
      try {
        let user = await Users.findOne({ verify_string: params.token });
        if (user) {
          let updatedData = {};
          updatedData.password = params.password;
          updatedData.verify_string = '';
          // response["message"] = "Email has been sent successfully";
          const result = await Users.update({ _id: user._id }, { $set: updatedData });
          
          opts.message = "Email has been sent successfully.";
          res.render('alert-msg',opts);
          return false;
          
        } else {
          opts.message = "Invalid URL!";
          res.render('alert-msg',opts);
          return false;
          
        }
      } catch (err) {
        opts.message = err.message;
        res.render('alert-msg',opts);
        return false;
        
      }
    } catch (error) {
      logger.error("LOGIN_ERROR", error.message);
      opts.message = error.message;
      res.render('alert-msg',opts);
      return false;
    }
  },


}

