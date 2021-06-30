const PlayerRecord = require('../../../models/player-record');
const PlayerTeam = require('../../../models/player-team');
const SeriesSquad = require('../../../models/series-squad');
const LiveScore = require('../../../models/live-score');
const PointsBreakup = require('../../../models/points-breakup');
const ApiUtility = require('../../api.utility');
const _ = require("lodash");
// const redis = require('../../../../lib/redis');
const SeriesPlayer = require('../../../models/series-player');

module.exports = {
    
    seriesPlayerDetail: async (req, res) => {
        try {
            let data1 = {};
            const { series_id, match_id,player_id} = req.params;
            let sport   =   parseInt(req.params.sport) || 1;
            let decoded = {
                series_id: parseInt(series_id),
                match_id: parseInt(match_id),
                sport: parseInt(sport),
                player_id: parseInt(player_id)
            }

            if (decoded['series_id'] && decoded['match_id'] && decoded['player_id']) {
                let apiList = [
                    SeriesSquad.find({'series_id': decoded["series_id"],'is_parent':true, 'parent_id':{$exists:false}}),
                    PlayerRecord.findOne({ 'player_id': decoded['player_id'], sport: sport })
                ];
                var results = await Promise.all(apiList);
                if(results && results.length>0){
                    // This array store all played match of plyer
                    let playedMatchData = [];
                    let sereiesMatches = results[0] ? results[0]:[];  // This will extract all series main match
                    let playerRecordsData = results[1] ? results[1]:{}; // This will extract player data 
                    // We fatch all match id for the series useing series records
                    let matchIds = sereiesMatches && sereiesMatches.length > 0 ? _.map(sereiesMatches,'match_id'):[]; 
                    if(matchIds && matchIds.length>0){
                       let playeLiveScoreData = await LiveScore.find({'player_id' :decoded['player_id'],'match_id':{$in:matchIds},'series_id': decoded["series_id"]});
                       let pointBreakeup = await PointsBreakup.find({'player_id' :decoded['player_id'],'match_id':{$in:matchIds},'series_id': decoded["series_id"]});

                        if(playeLiveScoreData && playeLiveScoreData.length>0) {
                            for (const liveScoreItem of playeLiveScoreData) {
                                let obj = sereiesMatches.find(o => o.match_id == liveScoreItem.match_id);
                                let pointsBreakupObj = pointBreakeup.find(o => o.match_id == liveScoreItem.match_id);
                                if(obj && obj.match_id){
                                    let data = {
                                        localteam: obj.localteam || '',
                                        localteam_id: obj.localteam_id || '',
                                        localteam_short_name: obj.localteam_short_name || '',
                                        series_name: obj.series_name || '',
                                        visitorteam: obj.visitorteam || '',
                                        visitorteam_id: obj.visitorteam_id || '',
                                        visitorteam_short_name: obj.visitorteam_short_name || '',
                                        date: obj.date || '',
                                        socre: liveScoreItem.point || 0,
                                        selected_by: pointsBreakupObj.selected_by || 0,
                                    }
                                    playedMatchData.push(data);
                                }
                            }
                        }
                        data1.player_record = playerRecordsData || {};
                        data1.match_played = playedMatchData || [];
                    }
                    return res.send(ApiUtility.success(data1));
                    
                } else {
                    return res.send(ApiUtility.failed("Something went wrong!!."));
                }
            } else {
                return res.send(ApiUtility.failed("Request Parameters not complete!!."));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    }
}
