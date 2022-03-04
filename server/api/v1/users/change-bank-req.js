const Users = require("../../../models/user");
const ApiUtility = require("../../api.utility");


module.exports = async (req, res) => {
    try {
        var response = { status: false, message: "Invalid Request", data: {} };
        let userId = req.userId || null;
        const { is_cancel_req } = req.params;
        if (userId) {
            try {
                if(is_cancel_req){
                    let userData = await Users.findOne({ _id: userId });
                    if(userData && userData.change_bank_req){
                        await Users.updateOne({ _id: userId }, { $set: { change_bank_req: false }});
                        response["message"] = "You have successfully cancelled the bank change request!!";
                        response["status"] = true;
                        return res.json(response);
                     } else {
                        response["message"] = 'Invalid request!!';
                        return res.json(response);
                     }
                } else {
                    const result = await Users.updateOne({ _id: userId }, { $set: { change_bank_req: true }});
                    if (result && result.nModified) {
                        response["message"] = "You have successfully submit your bank change request.";
                        response["status"] = true;
                        return res.json(response);
                    } else {
                        response["message"] = 'Something went wrong!!';
                        return res.json(response);
                    }
                }
            } catch (err) {
                response["message"] = err.message;
                return res.json(response);
            }
        } else {
            response["message"] = "Invalid User";
            return res.json(response);
        }
    } catch (error) {
        res.send(ApiUtility.failed(error.message));
    }
};
