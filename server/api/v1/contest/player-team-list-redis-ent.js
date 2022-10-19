const SeriesSquad = require('../../../models/series-squad');
const SeriesPlayer = require('../../../models/series-player');
const PlayerRecord = require('../../../models/player-record');
const PlayerTeam = require('../../../models/player-team');
const LiveScore = require('../../../models/live-score')

const ApiUtility = require('../../api.utility');
const { ObjectId } = require('mongodb');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const redisEnt = require('../../../../lib/redisEnterprise');
const PlayerTeamService = require('../../Services/PlayerTeamService');
const AWS = require('aws-sdk');
const { isEmpty } = require('lodash');

module.exports = {

    playerTeamListRedisEnt: async (req, res) => {
        var _this = this;
        let { match_id, series_id, team_no, user_id, sport } = req.params;
        if (!user_id) {
            user_id = req.userId;
        }
        sport = sport || 1;

        match_id = parseInt(match_id);
        series_id = parseInt(series_id);

        if (!user_id || !match_id || !series_id) {
            return res.send(ApiUtility.failed('user id, match id or series id are empty.'));
        }
        let joinedTeamKey = `userteam-${match_id}-${sport}-${user_id}`;
        
        redisEnt.getRedis(joinedTeamKey, async (err, data) => {
            if (err) {
                let key = match_id + "_" + sport + "_" + user_id + "_";
                let data = await listAllObjectsFromS3Bucket(key, match_id,user_id,sport)
                if(isEmpty(data)) {
                    PlayerTeamService.getCachePlayerTeamList({ match_id, series_id, team_no, user_id, sport }, (err, playerList) => {
                        if (err) {
                            return res.send(ApiUtility.failed(err.message));
                        } else {
                            return res.send(ApiUtility.success(playerList));
                        }
                    })
                } else {
                    return res.send(ApiUtility.success(data));
                }
                
            } else {
                return res.send(ApiUtility.success(data));
            }
        });
    },

}

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
    Bucket: 'user-player-team'
});

async function listAllObjectsFromS3Bucket(prefix, match_id,user_id,sport) {
    let allJoinedTeamTeams = [];
    let params = { Bucket: 'user-player-team' };
    if (prefix) params.Prefix = prefix;
    try {
        const response = await s3.listObjects(params).promise();
        await Promise.all(response.Contents.map(async (item) => {
            const joinedTeam = await readTeamOns3(item.Key, match_id,user_id,sport)
            //allJoinedTeamTeams.push(joinedTeam);
            if(typeof joinedTeam === 'object' && joinedTeam !== null) {
                allJoinedTeamTeams.push(joinedTeam);
            }
        }));
        return allJoinedTeamTeams;
    } catch (error) {
        throw error;
    }
    
}

async function readTeamOns3(key, match_id,user_id,sport) { 
    return new Promise((resolve, reject) => {

        const params = {
            Key: key,
            Bucket: 'user-player-team'
        };
        
        s3.getObject(params, function (err, data) {
            if (err) {
                reject(err)
            } else {
                let finalData = JSON.parse(data.Body.toString());
                redisEnt.setRedis(`userteam-${match_id}-${sport}-${user_id}`, finalData._id, finalData);
                resolve(finalData);
            }
        });
        
    });
}
