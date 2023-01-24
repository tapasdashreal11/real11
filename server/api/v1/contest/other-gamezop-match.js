const OtherGame = require('../../../models/other_game');
const ApiUtility = require('../../api.utility');
const config = require('../../../config');
const moment = require('moment');
const request = require('request');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
var imageurl = config.imageBaseUrl;
module.exports = {
    gameZopMatchList: async (req, res) => {
        try {
            let redisKey = 'other-game-match-list';
            let gameMatchList = await getPromiseMatchList(redisKey, "{}");
            let dataItem = gameMatchList ? JSON.parse(gameMatchList) : {};
            if (dataItem && dataItem.other_games) {
                dataItem['server_time'] = moment(new Date()).format(config.DateFormat.datetime);
                var successObj = ApiUtility.success(dataItem);
                res.send(successObj);
            } else {
                let data = {};
                let otherGamesMatch = await getGameZopMatchList();
                let gamesMatch = await OtherGame.find({status:1}).sort({sort:1});
                let matchListData =[];
                if (otherGamesMatch && otherGamesMatch.games && gamesMatch &&  gamesMatch.length>0) {
                    let filtered_array = _.filter(
                        gamesMatch, function (o) {
                            if(o && o.game_code){
                                let zopData = _.find(otherGamesMatch.games, {code:o.game_code});
                                if(zopData && zopData.code){
                                    let itemObj =  zopData;
                                    itemObj.match_id = o.match_id;
                                    itemObj.local_match_name = o.match_name ? o.match_name : "";
                                    itemObj.match_img = o && o.match_logo ? imageurl+"/"+o.match_logo :'';
                                    itemObj.game_source = o && o.game_source ? o.game_source :'';
                                    matchListData.push(itemObj);
                                    return itemObj;
                                }
                            }
                        }
                    );
                    data.total = matchListData.length;
                    data.other_games = matchListData;
                    data.server_time = moment(new Date()).format(config.DateFormat.datetime);
                    var successObj = ApiUtility.success(data);
                    redis.setRedis(redisKey, data)
                    res.send(successObj);
                } else {
                    data.total = 0;
                    data.other_games = [];
                    data.server_time = moment(new Date()).format(config.DateFormat.datetime);
                    var successObj = ApiUtility.success(data);
                    res.send(successObj);
                }
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
            "headers": { 'Content-Type': 'application/json' }
        };
        request(options, function (error, res, body) {
            if (error) {
                return reject(error);
            } else {
                return resolve(body);
            }

        });
    })
}

async function getPromiseMatchList(key, defaultValue) {
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue;
            }
            resolve(data)
        })
    })
}