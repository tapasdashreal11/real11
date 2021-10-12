const OtherGame = require('../../../models/other_game');
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const moment = require('moment');
const request = require('request');
const _ = require("lodash");

module.exports = {
    gameZopMatchList: async (req, res) => {
        try {
            let data = {};
               let otherGamesMatch = await getGameZopMatchList();
               if(otherGamesMatch && otherGamesMatch.games){
                let filtered_array = _.filter(
                    otherGamesMatch.games, function(o) {
                        if(_.isEqual(o.code,"SkhljT2fdgb")){
                                let itemObj = o;
                                itemObj.match_id = 111;
                            return itemObj;
                        }
                     }
                     );
                    data.total = filtered_array.length;
                    data.other_games = filtered_array; 
                    data.server_time = moment(new Date()).format(config.DateFormat.datetime);
                    var successObj = ApiUtility.success(data);
                    res.send(successObj);
               } else {
                    data.total = 0;
                    data.other_games = []; 
                    data.server_time = moment(new Date()).format(config.DateFormat.datetime);
                    var successObj = ApiUtility.success(data);
                    res.send(successObj);
               }
        } catch (error) {
            console.log(error);
            res.send(ApiUtility.failed(error.message));
        }
    }
}

/**
 * This is used to get data from gamezop third party
 */
async function getGameZopMatchList() {
    return new Promise((resolve, reject) => {
        var options = {
            "method": "GET",
            "url": "https://pub.gamezop.com/v3/games?id=3472&lang=en",
            "json": true,
            "headers": {'Content-Type': 'application/json'}
        };
         request(options, function (error,res,body) {
             if(error){
                return reject(error);
             }else{
                return resolve(body);
             }
            
        });
    })
}

