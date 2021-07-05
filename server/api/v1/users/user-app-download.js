const DUsers = require("../../../models/download-user");
module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    const { dcode,clevertap_id } = req.params;
    if (!dcode) {
      response["message"] = "Required fields missing";
      return res.json(response);
    }
    console.log('dcode',dcode);
    let d_data = {};
    d_data.dcode = dcode;
    d_data.clevertap_id = clevertap_id || '';
    await DUsers.create(d_data);
    response["message"] = "Successfully Done!!";
    return res.json(response);
  } catch (error) {
    response["message"] = error.message;
    return res.json(response);
  }
};
