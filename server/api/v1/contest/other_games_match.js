const OtherGame = require('../../../models/other_game');
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const moment = require('moment');

module.exports = {
    otherGamesMatch: async (req, res) => {
        try {
            let data1 = {};
            let otherGamesMatch = await OtherGame.find({status:1}).sort({sort:1});
                data1.other_games = otherGamesMatch; 
                data1.total = otherGamesMatch.length;
                data1.server_time = moment(new Date()).format(config.DateFormat.datetime);
                var successObj = ApiUtility.success(data1);
                res.send(successObj);
        } catch (error) {
            console.log(error);
            res.send(ApiUtility.failed(error.message));
        }
    },
}

