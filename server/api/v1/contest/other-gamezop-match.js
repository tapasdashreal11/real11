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
               let filtered_array = _.filter(
                otherGamesMatch.games, function(o) {
                    if(_.isEqual(o.code,"SkkV6MJD51Q") || _.isEqual(o.code,"SkhljT2fdgb") || _.isEqual(o.code,"41DxMOkGZ5g")){
                        let itemObj = o;
                        if(_.isEqual(o.code,"SkkV6MJD51Q"))
                           itemObj.match_id = 112;
                           if(_.isEqual(o.code,"SkhljT2fdgb"))
                           itemObj.match_id = 111;
                           if(_.isEqual(o.code,"41DxMOkGZ5g"))
                           itemObj.match_id = 113;  
                        return itemObj;
                    }
                 }
                 );
                data.total = filtered_array.length;
                data.other_games = filtered_array; 
                data.server_time = moment(new Date()).format(config.DateFormat.datetime);
                var successObj = ApiUtility.success(data);
                res.send(successObj);
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
            "url": "https://pub.gamezop.com/v3/games?id=peSLSV&lang=en",
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

