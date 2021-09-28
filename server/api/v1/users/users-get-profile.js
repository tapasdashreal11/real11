const Users = require("../../../models/user");
const { Validator } = require("node-input-validator");
const logger = require("../../../../utils/logger")(module);
const { rowTextToJson } = require("../common/helper");

module.exports = async (req, res) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let params = req.body;
    let constraints = { user_id: "required", language: "required" };

    let validator = new Validator(params, constraints);
    let matched = await validator.check();
    if (!matched) {
      response["message"] = "Required fields missing";
      response["errors"] = validator.errors;
      return res.json(response);
    }

    try {
      let user = await Users.findOne({ _id: params.user_id }).select(
        "_id phone user_id city fair_play_violation bonous_percent type full_name first_name last_name team_name date_of_birth gender country state postal_code address image fb_id google_id refer_id cash_balance winning_balance bonus_amount reward_level status is_updated email_verified sms_notify total_balance is_youtuber bonus_type bonus_percent referal_code_detail refer_able avatar email extra_amount bank_account_verify pen_verify change_bank_req"
      );
      if (user) {
        const userData = rowTextToJson(user);
        let data = userData;
        data.winngs_amount = userData.winning_balance ? userData.winning_balance.toFixed(2) : 0;
        data.deposit_amount = userData.cash_balance ? userData.cash_balance.toFixed(2) : 0;
        data.bonus = userData.bonus_amount ? userData.bonus_amount.toFixed(2) : 0;
        data.extra_amount = userData.extra_amount ? userData.extra_amount.toFixed(2) : 0;
        data.total_balance = userData.total_balance ? userData.total_balance.toFixed(2) : 0;
        if(user.bank_account_verify== 2 && user.pen_verify==2 && user.email_verified == 1){
          data.account_verified = true;
        } else {
          data.account_verified = false;
        }

        data.is_profile_complete = false;
        if (user.first_name !== '' && user.email !== '' && user.phone !== '' && user.address !== '' && user.city !== user.postal_code !== '') {
            data.is_profile_complete = true;
        }
        data.name = userData.first_name + userData.last_name;
        data.pincode = userData.postal_code;
        data.dob = userData.date_of_birth || '';
        data.change_bank_req = userData && userData.change_bank_req ? userData.change_bank_req: false ;
        data.fair_play_violation = user && user.fair_play_violation && user.fair_play_violation == 1 ? true : false;

        delete data.postal_code;
        response["message"] = "Successfully";
        response["status"] = true;
        response["data"] = data;
        return res.json(response);
      } else {
        response["message"] = "Mobile no / email is not registered with us.";
        return res.json(response);
      }
    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("ERROR", error.message);
    response["message"] = error.message;
    return res.json(response);
  }
};
