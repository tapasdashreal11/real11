const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const ObjectId = require('mongoose').Types.ObjectId;
const _ = require("lodash");
const { Validator } = require("node-input-validator");

module.exports = async (req, res) => {
    try {
        const {room_id} = req.params;
        const user_id = req.userId;
        let constraints = { room_id: "required"};
        let validator = new Validator(req.params, constraints);
        let matched = await validator.check();
        if (!matched) {
            return res.send(ApiUtility.failed('Parameters are not properly !!'));
        }
        if(roomId && user_id){
            let playerTeamRes = await OtherGamesPtc.find({contest_id:ObjectId(room_id),is_deleted:0,winning_amount_distributed:1});
            let winuserList = playerTeamRes ? playerTeamRes : [];
            var finalResult = ApiUtility.success(winuserList);
            return res.send(finalResult);

        } else {
            return res.send(ApiUtility.failed('Something went wrong!!'));
        }
        
    } catch (error) {
        console.log("error",error);
        return res.send(ApiUtility.failed('Something went wrong!!'));
    }
}

