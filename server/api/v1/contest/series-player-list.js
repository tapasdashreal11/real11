const PlayerRecord = require('../../../models/player-record');
const PlayerTeam = require('../../../models/player-team');

const User = require('../../../models/user');
const LiveScore = require('../../../models/live-score');
const PointsBreakup = require('../../../models/points-breakup');
const ApiUtility = require('../../api.utility');
// const { ObjectId } = require('mongodb');
// const moment = require('moment');
// const config = require('../../../config');
// const ModelService = require("../../ModelService");
const _ = require("lodash");
// const redis = require('../../../../lib/redis');
// const mqtt = require('../../../../lib/mqtt');
// const { RedisKeys } = require('../../../constants/app');
const SeriesPlayer = require('../../../models/series-player');

module.exports = {
    
    seriesPlayerList: async (req, res) => {
        try {
            let totalTeam = "0";
            let percent = '0';
            let result = [];
            let data = [];
            let data1 = {};
            const user_id = req.userId;
            const { series_id, match_id, is_player_state, contest_id} = req.params;
            let sport   =   parseInt(req.params.sport) || 1;
            let decoded = {
                user_id,
                series_id: parseInt(series_id),
                match_id: parseInt(match_id),
                sport: parseInt(sport),
                contest_id,
                is_player_state
            }

            if (decoded['user_id'] && decoded['series_id'] && decoded['match_id']) {

                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    // let totalTeam = await PlayerTeam.find({ 'series_id': series_id, 'match_id': match_id }).countDocuments();
                    // console.log(totalTeam);
                    let liveScore;

                    if (decoded['is_player_state']) {
                        liveScore = await LiveScore.aggregate([
                            {
                                $match: { 'series_id': series_id, 'match_id': match_id, "sport": sport }
                            },
                            {
                                $group: {
                                    _id: "$point",
                                    point: { $sum: 1 }
                                }
                            }
                        ]);
                    } else {
                        liveScore = await LiveScore.find({ 'series_id': decoded["series_id"], 'match_id': decoded["match_id"] });
                    }

                    if(sport == 1) {
                        cricketPreview(decoded, liveScore, function (result) {
                            return res.send(result);
                        });
                    } else {
                        footabllPreview(decoded, liveScore, function (result) {
                            return res.send(result);
                        });
                    }
                    
                } else {
                    return res.send(ApiUtility.failed("Security check failed."));
                }
            } else {
                return res.send(ApiUtility.failed("User id, language, Series id, Match id are Empty."));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    }
}

async function cricketPreview(decoded, liveScore, cb) {
    // console.log(liveScore);return false;
    let userId  =   decoded['user_id'];
    let sport  =   decoded['sport'];
    let totalTeam = "0";
    let percent = '0';
    let result = [];
    let data = [];
    let data1 = {};
    
    let player_list = [];
    for (const value of liveScore) {
        player_list.push(value.player_id);
    }
    
    playerRecord = await PlayerRecord.find({ 'player_id': { $in: player_list }, sport: sport });
    
    let playerData = {};
    for (const value of playerRecord) {
        playerData[value.player_id] = value;
    }
    
    // console.log(playerData);
    if (liveScore) {
        for (const row of liveScore) {
            let teamNo = [];
            // console.log("user_id:", req.userId, "players:", row.player_id, 'series_id:', series_id, 'match_id:', match_id)
            let isInContest = await PlayerTeam.aggregate([
                { $match: { user_id: userId, "players": row.player_id, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"], sport: sport } },
                // {
                //     $lookup: {
                //         from: 'player_team_contest',
                //         as: 'player_team_contest',
                //         let: { player_team_id: '$_id' },
                //         pipeline: [
                //             {
                //                 $match: {
                //                     $expr: {
                //                         $and: [
                //                             { $eq: ['$player_team_id', '$$player_team_id'] },
                //                         ]
                //                     }
                //                 }
                //             },
                //         ]
                //     }
                // },
            ]);
            // console.log(isInContest.length, "player", row.player_id)
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            /* let selectedBy = await PlayerTeam.aggregate([
                { $match: { "players": row.player_id, 'series_id':decoded['series_id'],'match_id':decoded['match_id'], sport: sport } },
                {
                    $lookup: {
                    from: 'player_team_contest',
                    as: 'player_team_contest',
                    let: { player_team_id: '$_id' },
                    pipeline: [
                        {
                        $match: {
                            $expr: {
                            $and: [
                                { $eq: ['$player_team_id', '$$player_team_id'] },
                            ]
                            }
                        }
                        },
                    ]
                    }
                },
            ]);
            if(totalTeam > 0){
                percent = ((selectedBy.length/totalTeam)*100).toFixed(0)+'%';
            } */

            // val = this.getPlayerImage(row.playerId,series_id);
            let val = playerData[row.player_id];
            // console.log(val.playing_role);
            let playerRecord = {};
            if (decoded['is_player_state']) {
                playerBrackup = await PointsBreakup.aggregate([
                    {
                        $match: { 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], 'player_id': row.player_id, 'sport': sport }
                    },
                    {
                        $group: {
                            _id: $player_id,
                            'in_starting': { $sum: 1 },
                            'in_starting_point': { $sum: 1 },
                            'runs': { $sum: 1 },
                            'runs_point': { $sum: 1 },
                            'fours': { $sum: 1 },
                            'fours_point': { $sum: 1 },
                            'sixes': { $sum: 1 },
                            'sixes_point': { $sum: 1 },
                            'strike_rate': { $sum: 1 },
                            'strike_rate_point': { $sum: 1 },
                            'century_halfCentury': { $sum: 1 },
                            'century_halfCentury_point': { $sum: 1 },
                            'duck_out': { $sum: 1 },
                            'duck_out_point': { $sum: 1 },
                            'wickets': { $sum: 1 },
                            'wickets_point': { $sum: 1 },
                            'maiden_over': { $sum: 1 },
                            'maiden_over_point': { $sum: 1 },
                            'economy_rate': { $sum: 1 },
                            'economy_rate_point': { $sum: 1 },
                            'bonus': { $sum: 1 },
                            'bonus_point': { $sum: 1 },
                            'catch': { $sum: 1 },
                            'catch_point': { $sum: 1 },
                            'run_outStumping': { $sum: 1 },
                            'run_outStumping_point': { $sum: 1 },
                            'run_out': { $sum: 1 },
                            'run_out_point': { $sum: 1 },
                            'total_point': { $sum: 1 },
                        }
                    }
                ]);
            } else {
                playerBrackup = await PointsBreakup.find({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], 'player_id': row.player_id, 'inning_number': row.inning_number, 'sport': sport })
            }
            if (playerBrackup) {
                for (const value of playerBrackup) {
                    playerRecord['starting11'] = {
                        'actual': value.in_starting,
                        'points': value.in_starting_point
                    };

                    playerRecord['runs'] = {
                        'actual': value.runs,
                        'points': value.runs_point
                    };

                    playerRecord['fours'] = {
                        'actual': value.fours,
                        'points': value.fours_point
                    };

                    playerRecord['sixes'] = {
                        'actual': value.sixes,
                        'points': value.sixes_point
                    };

                    playerRecord['strike_rate'] = {
                        'actual': value.strike_rate,
                        'points': value.strike_rate_point
                    };

                    playerRecord['half_century'] = {
                        'actual': value.century_halfCentury,
                        'points': value.century_halfCentury_point
                    };

                    playerRecord['duck'] = {
                        'actual': value.duck_out,
                        'points': value.duck_out_point
                    };

                    playerRecord['wickets'] = {
                        'actual': value.wickets,
                        'points': value.wickets_point
                    };

                    playerRecord['maiden_over'] = {
                        'actual': value.maiden_over,
                        'points': value.maiden_over_point
                    };

                    playerRecord['eco_rate'] = {
                        'actual': value.economy_rate,
                        'points': value.economy_rate_point
                    };

                    playerRecord['bonus'] = {
                        'actual': value.bonus,
                        'points': value.bonus_point
                    };

                    playerRecord['catch'] = {
                        'actual': value.catch,
                        'points': value.catch_point
                    };

                    let actual = value.run_outStumping + value.run_out;

                    let pointsRun = value.run_outStumping_point + value.run_out_point;
                    playerRecord['run_outStumping'] = {
                        'actual': actual,
                        'points': pointsRun
                    };

                    playerRecord['total_point'] = {
                        'actual': 0,
                        'points': value.total_point
                    };
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            
            result.push({
                'player_id': row.player_id,
                'player_role': val.playing_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'player_credit': val['player_credit'],
                'selection_percent': "0%",  //percent,
                'points': row.point,
                'in_contest': (isInContest.length > 0) ? true : false,
                'team_number': Array.from(new Set(teamNo)), //teamNum,
                'player_breckup': playerRecord,
                'in_dream_team': dreamPlayers ? true : false,
                'is_local_team': (row.team_type === "localteam") ? true : false
            });
        }
        data1 = result;
        status = true;
        cb(ApiUtility.success(result));
        // return res.send(ApiUtility.success(result));
    } else {
        cb(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
    }
} 

async function footabllPreview(decoded, liveScore, cb) {
    let userId  =   decoded['user_id'];
    let sport  =   decoded['sport'];
    let totalTeam = "0";
    let percent = '0';
    let result = [];
    let data = [];
    let data1 = {};
    
    let player_list = [];
    for (const value of liveScore) {
        player_list.push(value.player_id);
    }
    
    playerRecord = await SeriesPlayer.find({ 'player_id': { $in: player_list }, 'sport': sport });
    let playerData = {};
    for (const value of playerRecord) {
        playerData[value.player_id] = value;
    }
    
    if (liveScore) {
        for (const row of liveScore) {
            let teamNo = [];
            // console.log("user_id:", req.userId, "players:", row.player_id, 'series_id:', series_id, 'match_id:', match_id)
            let isInContest = await PlayerTeam.aggregate([
                { $match: { user_id: userId, "players": row.player_id, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"], sport: sport } },
                // {
                //     $lookup: {
                //         from: 'player_team_contest',
                //         as: 'player_team_contest',
                //         let: { player_team_id: '$_id' },
                //         pipeline: [
                //             {
                //                 $match: {
                //                     $expr: {
                //                         $and: [
                //                             { $eq: ['$player_team_id', '$$player_team_id'] },
                //                         ]
                //                     }
                //                 }
                //             },
                //         ]
                //     }
                // },
            ]);
            // console.log(isInContest.length, "player", row.player_id)
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            /* let selectedBy = await PlayerTeam.aggregate([
                { $match: { "players": row.player_id, 'series_id':decoded['series_id'],'match_id':decoded['match_id'] } },
                {
                    $lookup: {
                    from: 'player_team_contest',
                    as: 'player_team_contest',
                    let: { player_team_id: '$_id' },
                    pipeline: [
                        {
                        $match: {
                            $expr: {
                            $and: [
                                { $eq: ['$player_team_id', '$$player_team_id'] },
                            ]
                            }
                        }
                        },
                    ]
                    }
                },
            ]);
            if(totalTeam > 0){
                percent = ((selectedBy.length/totalTeam)*100).toFixed(0)+'%';
            } */

            // val = this.getPlayerImage(row.playerId,series_id);
            let val = playerData[row.player_id];
            let playerRecord = {};
            // if (decoded['is_player_state']) {
            //     playerBrackup = await PointsBreakup.aggregate([
            //         {
            //             $match: { 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], 'player_id': row.player_id }
            //         },
            //         {
            //             $group: {
            //                 _id: $player_id,
            //                 'minutes_played': { $sum: 1 },
            //                 'in_starting_point': { $sum: 1 },
            //                 'runs': { $sum: 1 },
            //                 'runs_point': { $sum: 1 },
            //                 'fours': { $sum: 1 },
            //                 'fours_point': { $sum: 1 },
            //                 'sixes': { $sum: 1 },
            //                 'sixes_point': { $sum: 1 },
            //                 'strike_rate': { $sum: 1 },
            //                 'strike_rate_point': { $sum: 1 },
            //                 'century_halfCentury': { $sum: 1 },
            //                 'century_halfCentury_point': { $sum: 1 },
            //                 'duck_out': { $sum: 1 },
            //                 'duck_out_point': { $sum: 1 },
            //                 'wickets': { $sum: 1 },
            //                 'wickets_point': { $sum: 1 },
            //                 'maiden_over': { $sum: 1 },
            //                 'maiden_over_point': { $sum: 1 },
            //                 'economy_rate': { $sum: 1 },
            //                 'economy_rate_point': { $sum: 1 },
            //                 'bonus': { $sum: 1 },
            //                 'bonus_point': { $sum: 1 },
            //                 'catch': { $sum: 1 },
            //                 'catch_point': { $sum: 1 },
            //                 'run_outStumping': { $sum: 1 },
            //                 'run_outStumping_point': { $sum: 1 },
            //                 'run_out': { $sum: 1 },
            //                 'run_out_point': { $sum: 1 },
            //                 'total_point': { $sum: 1 },
            //             }
            //         }
            //     ]);
            // } else {
            // }
            playerBrackup = await PointsBreakup.find({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], 'player_id': row.player_id })
            // console.log(playerBrackup);
            if (playerBrackup) {
                for (const value of playerBrackup) {
                    playerRecord['minutes_played'] = {
                        'actual': value.minutes_played,
                        'points': 0 //value.in_starting_point
                    };
                    playerRecord['goal'] = {
                        'actual': value.goal,
                        'points': value.goal_point //value.runs_point
                    };

                    playerRecord['assist'] = {
                        'actual': value.assist,
                        'points': value.assist_point //value.fours_point
                    };

                    playerRecord['passes'] = {
                        'actual': value.passes,
                        'points': value.passes_point //value.sixes_point
                    };

                    playerRecord['shots_on_target'] = {
                        'actual': value.shots_on_target,
                        'points': value.shots_on_target_point //value.strike_rate_point
                    };

                    playerRecord['goal_saved'] = {
                        'actual': 0, //value.goal_scored,
                        'points': 0 //value.century_halfCentury_point
                    };

                    playerRecord['penalty_saved'] = {
                        'actual': value.penalty_saved || 0,
                        'points': value.penalty_saved_point //value.century_halfCentury_point
                    };

                    playerRecord['penalty_missed'] = {
                        'actual': value.penalty_missed || 0,
                        'points': value.penalty_missed_point //value.duck_out_point
                    };

                    playerRecord['clean_sheet'] = {
                        'actual': value.wickets || 0,
                        'points': value.clean_sheet_point //value.wickets_point
                    };

                    playerRecord['tackle_won'] = {
                        'actual': value.tackle_won || 0,
                        'points': value.tackle_won_point //value.maiden_over_point
                    };

                    playerRecord['goals_conceded'] = {
                        'actual': value.goals_conceded || 0,
                        'points': value.goals_conceded_point //value.economy_rate_point
                    };

                    playerRecord['yellow_card'] = {
                        'actual': value.yellow_card || 0,
                        'points': value.yellow_card_point //value.bonus_point
                    };

                    playerRecord['red_card'] = {
                        'actual': value.red_card || 0,
                        'points': value.red_card_point //value.catch_point
                    };

                    playerRecord['own_goal'] = {
                        'actual': value.own_goal || 0,
                        'points': value.own_goal_point //value.catch_point
                    };

                    playerRecord['is_playing_eleven'] = {
                        'actual': value.in_starting || 0,
                        'points': value.in_starting_point //value.catch_point
                    };

                    playerRecord['substitute'] = {
                        'actual': value.in_substitute || 0,
                        'points': value.in_substitute_point //value.catch_point
                    };

                    playerRecord['chance_created'] = {
                        'actual': value.chance_created || 0,
                        'points': value.chance_created_point //value.catch_point
                    };

                    playerRecord['interception_won'] = {
                        'actual': value.interception_won || 0,
                        'points': value.interception_won_point //value.catch_point
                    };

                    playerRecord['blocked_shot'] = {
                        'actual': value.blocked_shot || 0,
                        'points': value.blocked_shot_point //value.catch_point
                    };

                    playerRecord['clearance'] = {
                        'actual': value.clearance || 0,
                        'points': value.clearance_point //value.catch_point
                    };

                    // let actual = value.run_outStumping + value.run_out;

                    // let pointsRun = value.run_outStumping_point + value.run_out_point;
                    // playerRecord['run_outStumping'] = {
                    //     'actual': actual,
                    //     'points': pointsRun
                    // };

                    playerRecord['total_point'] = {
                        'actual': 0,
                        'points': value.total_point
                    };
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            result.push({
                'player_id': row.player_id,
                'player_role': val.player_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'player_credit': val['player_credit'],
                'selection_percent': "0%",  //percent,
                'points': row.point,
                'in_contest': (isInContest.length > 0) ? true : false,
                'team_number': Array.from(new Set(teamNo)), //teamNum,
                'player_breckup': playerRecord,
                'in_dream_team': dreamPlayers ? true : false,
                'is_local_team': (row.team_type === "localteam") ? true : false
            });
        }
        data1 = result;
        status = true;
        cb(ApiUtility.success(result));
        // return res.send(ApiUtility.success(result));
    } else {
        cb(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
    }
} 