const { ObjectId } = require('mongodb');
const Tokens = require("../../../models/token");
const logger = require("../../../../utils/logger")(module);

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    
    const notificationId = req.query.id;
    const userId = req.userId;

    try {
      response["message"] = "Logout successfully";
      let result = await Tokens.deleteOne({ _id: notificationId, user_id: new ObjectId(userId) });
      
      response["message"] = 'Deleted successfully';
      response["status"] = true;      
      return res.json(response);

    } catch (err) {
      logger.error(error.message);
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    response["message"] = err.message;
    return res.json(response);
  }
};
