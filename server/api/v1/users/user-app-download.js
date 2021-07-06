const DUsers = require("../../../models/download-user");
module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    const { dcode,clevertap_id } = req.params;
    var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!dcode) {
      return res.json(response);
    }
    let d_data = {};
    d_data.dcode = dcode;
    d_data.clevertap_id = clevertap_id || '';
    d_data.ip_address = userIp;
    await DUsers.create(d_data);
    response["message"] = "Successfully Done!!";
    return res.json(response);
  } catch (error) {
    response["message"] = error.message;
    return res.json(response);
  }
};
