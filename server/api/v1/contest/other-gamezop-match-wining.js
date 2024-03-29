const config = require('../../../config');
const User = require('../../../models/user');
const ApiUtility = require('../../api.utility');
const OtherGamesPtc = require('../../../models/other-games-ptc');
const ObjectId = require('mongoose').Types.ObjectId;
const _ = require("lodash");
const { Validator } = require("node-input-validator");
var imageurl = config.imageBaseUrl;

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
        if(room_id){
            let playerTeamRes = await OtherGamesPtc.find({contest_id:ObjectId(room_id),is_deleted:0,winning_amount_distributed:1});
            let winuserList = playerTeamRes ? playerTeamRes : [];
            let winList = winuserList.map(s => {
                return {team_name:s.team_name,user_id:s.user_id,score:s.points,rank:s.rank,price_win:s.price_win,
                    avatar:_.isEqual( s.avatar, "boy.png") || _.isEqual( s.avatar, "") || !_.has( s, "avatar") ? imageurl+"/avatar20.png" : imageurl+"/"+s.avatar+".png"
                }
            });

            var finalResult = ApiUtility.success(winList);
            return res.send(finalResult);

        } else {
            return res.send(ApiUtility.failed('Something went wrong!!'));
        }
        
    } catch (error) {
        console.log("error",error);
        return res.send(ApiUtility.failed('Something went wrong!!'));
    }
}

