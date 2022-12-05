const SeriesSquad = require('../../../models/series-squad');
const SeriesPlayer = require('../../../models/series-player');
const PlayerRecord = require('../../../models/player-record');
const ApiUtility = require('../../api.utility');
const PlayerTeamService = require('../../Services/PlayerTeamService');

const { ObjectId } = require('mongodb');
const moment = require('moment');
const config = require('../../../config');
const _ = require("lodash");
const redis = require('../../../../lib/redis');

module.exports = {
    
    playerList: async (req, res) => {
        try {
            const { series_id, match_id } = req.params;
            let matchDetail = await SeriesSquad.getActiveMatch(series_id, match_id);
            if (!matchDetail) {
                res.send(ApiUtility.failed('Active Match Not Found'));
            }
            let seriesPlayers = await SeriesPlayer.find({
                series_id: series_id,
                team_id: { $in: [matchDetail.localteam_id, matchDetail.visitorteam_id] }
            }).lean();
            let playerList = [];
            for (const playerObj of seriesPlayers) {
                let player = { ...playerObj };
                player['player_point'] = "0"; //Get Player Point from Live Score
                player['player_points'] = "0";
                player['selected_by'] = "0%";
                player['captain_selected'] = "0%";
                player['vice_captain_selected'] = "0%";
                let playerRecord = await PlayerRecord.findOne({ player_id: player.player_id });
                player['player_record'] = playerRecord;
                if (playerRecord) {
                    player['player_record']['id'] = player['player_record']['_id']
                }
                if (playerRecord && playerRecord.image) {
                    player['player_record']['image'] = player['player_record']['image']; // config.imageBaseUrl + '/player_image/' + player['player_record']['image'];
                }

                let playing = matchDetail.playing_11;
                if (playing) {
                    player['is_playing_show'] = 1;
                    player['is_playing'] = (playing.indexOf(player['player_id']) > -1) ? 1 : 0;
                } else {
                    player['is_playing_show'] = 0;
                    player['is_playing'] = 0;
                }
                playerList.push(player);
            }
            res.send(ApiUtility.success(playerList));
        } catch (error) {
            res.send(ApiUtility.failed(error.message));
        }
    },
    /*********************New code by Ayon*********************************/
    playerListn: async (req, res) => {
        PlayerTeamService.getCachePlayerList(req.params, (err, playerList) => {
            if (err) {
                return res.send(ApiUtility.failed(err.message));
            } else {
                playerList.server_time = moment(new Date()).format(config.DateFormat.datetime);
                return res.send(ApiUtility.success(playerList));
            }
        })
    },
}

