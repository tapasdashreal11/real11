const ApiUtility = require('../../api.utility');
const PlayerTeamServiceRedisEnt = require('../../Services/PlayerTeamServiceRedisEnt');
const SeriesSquad = require('../../../models/series-squad');
const _ = require("lodash");
const redis = require('../../../../lib/redis');

module.exports = {
    
    playerListRedisEnt: async (req, res) => {
        let matchData = await getMatchesTeams(req.params);
        req.params.localteamId = matchData.localteam_id
        req.params.visitorteamId = matchData.visitorteam_id
        
        PlayerTeamServiceRedisEnt.getCachePlayerList(req.params, (err, playerList) => {
            if (err) {
                return res.send(ApiUtility.failed(err.message));
            } else {
                return res.send(ApiUtility.success(playerList));
            }
        })
    },
}

async function getMatchesTeams(reqData) {
    let { series_id, match_id, sport } = reqData;
    series_id = parseInt(series_id)
    match_id  = parseInt(match_id)
    sport     = parseInt(sport) || 1;
    const results = await SeriesSquad.find({'series_id': series_id, 'match_id': match_id, 'sport': sport}, {localteam_id:1, visitorteam_id:1 });
    
    return results[0];
}