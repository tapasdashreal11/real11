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
               // console.log('other game list from redis***');
                dataItem['server_time'] = moment(new Date()).format(config.DateFormat.datetime);
                var successObj = ApiUtility.success(dataItem);
                res.send(successObj);
            } else {
               // console.log('other game list from db***');
                let data = {};
                let otherGamesMatch = await getGameZopMatchList();
                let gamesMatch = await OtherGame.find({status:1}).sort({sort:1});
                let matchListData =[];
                if (otherGamesMatch && otherGamesMatch.games && gamesMatch &&  gamesMatch.length>0) {
                   
                    let filtered_array = _.filter(
                        gamesMatch, function (o) {
                            if (_.isEqual(o.match_id, 111)) {
                                // Ludo
                                
                                let ddd = _.find(otherGamesMatch.games, {code:"SkhljT2fdgb"});
                                console.log('ludo***',ddd);
                                let itemObj =  ddd;
                                itemObj.match_id = 111;
                                itemObj.match_img = o && o.match_logo ? imageurl+"/"+o.match_logo :'';
                                matchListData.push(itemObj);
                                return itemObj;
                                
                            }else if (_.isEqual(o.match_id, 112)) {
                                // Solitaire Gold
                                let ddd = _.find(otherGamesMatch.games, {code:"rkPlk2T7qAr"});
                                console.log('ddd solitire',ddd);
                                let itemObj = ddd;
                                itemObj.match_id = 112;
                                itemObj.match_img = o && o.match_logo ? imageurl+"/"+o.match_logo :'';
                                matchListData.push(itemObj);
                                return itemObj;
                            } else if (_.isEqual(o.match_id, 113)) {
                                // Knife Flip
                                let ddd = _.find(otherGamesMatch.games, {code:"H1PJn6mqAr"});
                                console.log('ddd knife',ddd);
                                let itemObj = ddd;
                                itemObj.match_id = 113;
                                itemObj.match_img = o && o.match_logo ? imageurl+"/"+o.match_logo :'';
                                matchListData.push(itemObj);
                                return itemObj;
                            }
                        }
                    );

                    /**let filtered_array = _.filter(
                        otherGamesMatch.games, function (o) {
                            if (_.isEqual(o.code, "SkhljT2fdgb")) {
                                // Ludo
                                let itemObj = o;
                                itemObj.match_id = 111;
                                itemObj.match_img = gamesMatch && gamesMatch.length >0 && gamesMatch[0].match_logo ? imageurl+"/"+gamesMatch[0].match_logo :'';
                                return itemObj;
                            }else if (_.isEqual(o.code, "rkPlk2T7qAr")) {
                                // Solitaire Gold
                                let itemObj = o;
                                itemObj.match_id = 112;
                                itemObj.match_img = gamesMatch && gamesMatch.length >0 && gamesMatch[0].match_logo ? imageurl+"/"+gamesMatch[1].match_logo :'';
                                return itemObj;
                            }else if (_.isEqual(o.code, "H1PJn6mqAr")) {
                                // Knife Flip
                                let itemObj = o;
                                itemObj.match_id = 113;
                                itemObj.match_img = gamesMatch && gamesMatch.length >0 && gamesMatch[0].match_logo ? imageurl+"/"+gamesMatch[2].match_logo :'';
                                return itemObj;
                            }
                        }
                    );*/
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