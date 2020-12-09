const { ObjectId } = require('mongodb');
const logger = require("../../../../utils/logger")(module);
const ApiUtility = require('../../api.utility');
const User = require("../../../models/user");

module.exports = async (req, res) => {
  try {
        let data1		=	{};
        const user_id =  req.userId;
        const { team_name } = req.body;
        let decoded = {
            user_id: user_id,
            team_name: team_name
        }

        if(decoded['user_id'] && decoded['team_name']) {
            let users	=	await User.findOne({'_id':decoded['user_id']});
            if(users) {
                if(users.is_updated == 0) {
                    var teamName = new RegExp(["^", decoded['team_name'], "$"].join(""), "i");
                    let userTeam	=	await User.findOne({'team_name':teamName});
                    if(!userTeam) {
                        users.team_name = team_name;
                        users.is_updated	=	1;
                        let updatedUser = await users.save();
                        if(updatedUser) {
                            data1.team_name	=	users.team_name;
                            return res.send(ApiUtility.success(data1));
                        } else {
                            return res.send(ApiUtility.failed('Team name could not save.'));
                        }
                    } else {
                        return res.send(ApiUtility.failed("Team name already exists with other user."));
                        // return res.send(ApiUtility.failed("Team name could not be same for two users."));
                    }
                } else {
                    return res.send(ApiUtility.failed('Team name already updated.'));
                }
            }else{
                return res.send(ApiUtility.failed("Invalid Users id."));
            }
        } else {
            return res.send(ApiUtility.failed("User id or team name is empty."));
        }
    } catch (error){
        console.log(error);
        return res.send(ApiUtility.failed(error.message));
    }
};
