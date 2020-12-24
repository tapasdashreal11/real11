const async = require('async');
const Notifications = require("../../../models/notification");
const ObjectId = require('mongoose').Types.ObjectId;
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');


module.exports = async (req, res) => {
  try {
    
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let userId = req.userId;

    try {
      let result = await Notifications.find({ user_id: ObjectId(userId) }).sort({ _id: -1 }).limit(25);

      if (!_.isEmpty(result)) {
        response["message"] = null;
        response["status"] = true;
        response["data"] = result;
        return res.json(response);

      } else {
        response["message"] = "No Records found.";
        return res.json(response);
      }
    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
