const Notifications = require("../../../models/notification");
const NotificationMeta = require("../../../models/notification-meta");
const ObjectId = require('mongoose').Types.ObjectId;
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const ludoMqtt = require('../../../../lib/ludo-mqtt');

module.exports = {
  notificationList: async (req, res) => {
    try {

      var response = { status: false, message: "Invalid Request", data: {} };
      let userId = req.userId;
      try {
        let result = await Notifications.find({ user_id: ObjectId(userId) }).sort({ _id: -1 }).limit(25);

        if (!_.isEmpty(result)) {

          let filtered_array = _.filter(
            result, function (o) {
                if(o && o.date){
                   let new_item = o;
                   var s = new Date(o.date).toLocaleString("en-US", {timeZone: 'Asia/Kolkata'});
                   new_item.data =s; 
                   new_item.new_data =s; 
                  return new_item;
                }
            }
        );
          response["message"] = null;
          response["status"] = true;
          response["data"] = filtered_array;
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
  },
  notificationRead: async (req, res) => {
    try {
      var response = { status: false, message: "Invalid Request", data: {} };
      let userId = req.userId;
      try {
        if (userId) {
            await NotificationMeta.findOneAndUpdate({ user_id: ObjectId(userId) }, { $set: { notification_count: 0 } }, { new: true }).then((countsItem) => {
            response["data"] = countsItem;
            let cCount = 0;
            ludoMqtt.publishUserNotificationCounts(userId, "" + cCount);
          });
          response["message"] = '';
          response["status"] = true;
          return res.json(response);
        } else {
          response["message"] = "Something Wrong Wrong!!";
          return res.json(response);
        }
      } catch (err) {
        response["message"] = err.message;
        return res.json(response);
      }
    } catch (error) {
      logger.error("NOTIFICATION_READ_ERROR", error.message);
      res.send(ApiUtility.failed(error.message));
    }
  }
}
