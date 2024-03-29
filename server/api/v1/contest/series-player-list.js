const PlayerRecord = require('../../../models/player-record');
const PlayerTeam = require('../../../models/player-team');

const User = require('../../../models/user');
const LiveScore = require('../../../models/live-score');
const PointsBreakup = require('../../../models/points-breakup');
const ApiUtility = require('../../api.utility');
const _ = require("lodash");
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
                    } else if(sport == 2) {
                        footabllPreview(decoded, liveScore, function (result) {
                            return res.send(result);
                        });
                    } else {
                        kabaddiPreview(decoded, liveScore, function (result) {
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
    },
    seriesPlayerListNew: async (req, res) => {
        try {
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
                        // Comming Soon
                        cricketPreviewNew(decoded, liveScore, function (result) {
                            return res.send(result);
                        });
                    } else if(sport == 2) {
                        // Comming Soon
                        footabllPreviewNew(decoded, liveScore, function (result) {
                            return res.send(result);
                        });
                    } else {
                        kabaddiPreview(decoded, liveScore, function (result) {
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
    
    playerRecord = await PlayerRecord.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, sport: sport });
    
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
            ]);
            
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            let val = playerData[row.player_id];
            let playerRecord = {};
            let selectedPercent =   "";
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
                            'LBW_bowled_bonus': { $sum: 1 },
                            'LBW_bowled_bonus_point': { $sum: 1 },
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
                            'catch_bonus': { $sum: 1 },
                            'catch_bonus_point': { $sum: 1 },
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
                    playerRecord['LBW_bowled_bonus'] = {
                        'actual': value.LBW_bowled_bonus,
                        'points': value.LBW_bowled_bonus_point
                    };

                    playerRecord['duck'] = {
                        'actual': value.duck_out,
                        'points': value.duck_out_point
                    };

                    playerRecord['wickets'] = {
                        'actual': value.wickets,
                        'points': value.wickets_point
                    };

                    // playerRecord['wickets'] = {
                    //     'actual': value.wickets,
                    //     'points': value.wickets_point
                    // };

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

                    playerRecord['catch_bonus'] = {
                        'actual': value.catch_bonus,
                        'points': value.catch_bonus_point
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
                    selectedPercent  =  value.selected_by ? value.selected_by + "%" : '0.00' + "%";
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            
            result.push({
                'player_id': row.player_id,
                'player_role': row && row.playing_role ? row.player_role : val.playing_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'player_credit': val['player_credit'],
                'selection_percent': selectedPercent,  //percent,
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
    
    playerRecord = await SeriesPlayer.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, 'sport': sport });
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
            
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            let val = playerData[row.player_id];
            let playerRecord = {};
            let selectedPercent =   "";

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
                    selectedPercent  =  value.selected_by ? value.selected_by + "%" : '0.00' + "%";
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            result.push({
                'player_id': row.player_id,
                'player_role': row && row.player_role ? row.player_role : val.player_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'player_credit': val && val['player_credit'] ? val['player_credit'].toString() : '0',
                'selection_percent': selectedPercent,  //percent,
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

/** Cricket Player stats with dynamic keys */
async function cricketPreviewNew(decoded, liveScore, cb) {
    let userId  =   decoded['user_id'];
    let sport   =   decoded['sport'];
    
    let result = [];
    let data1 = {};
    
    let player_list = [];
    for (const value of liveScore) {
        player_list.push(value.player_id);
    }
    var results = await Promise.all([
        PlayerTeam.find({ user_id: userId, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"], sport: sport }),
        SeriesPlayer.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, 'sport': sport })
    ]);
    let playerRecord = results && results[1] ? results[1] : [];
    
    let playerData = {};
    for (const value of playerRecord) {
        playerData[value.player_id] = value;
    }
    let isInTeam = results && results[0] ? results[0] : [];
    if (liveScore) {
        for (const row of liveScore) {
            let teamNo = [];
            let isInContest = _.filter(isInTeam, key => key.players.includes(row.player_id) );
            
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            let val = playerData[row.player_id];
            let playerRecord = [];
            let selectedPercent =   "";
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
                            'LBW_bowled_bonus': { $sum: 1 },
                            'LBW_bowled_bonus_point': { $sum: 1 },
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
                            'catch_bonus': { $sum: 1 },
                            'catch_bonus_point': { $sum: 1 },
                            'total_point': { $sum: 1 },
                        }
                    }
                ]);
            } else {
                playerBrackup = await PointsBreakup.find({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'], 'player_id': row.player_id, 'inning_number': row.inning_number, 'sport': sport })
            }
            if (playerBrackup) {
                for (const value of playerBrackup) {
                    playerRecord['0'] = {
                        'key_name': "Starting 11",
                        'actual': value.in_starting == 1 ? "Yes" : "No",
                        'points': value.in_starting_point ? value.in_starting_point : 0
                    };
                    playerRecord['1'] = {
                        'key_name': "Runs",
                        'actual': value.runs ? value.runs.toString() : "0",
                        'points': value.runs_point ? value.runs_point : 0
                    };
                    playerRecord['2'] = {
                        'key_name': "4's",
                        'actual': value.fours ? value.fours.toString() : "0",
                        'points': value.fours_point ? value.fours_point : 0
                    };
                    playerRecord['3'] = {
                        'key_name': "6's",
                        'actual': value.sixes ? value.sixes.toString() : "0",
                        'points': value.sixes_point ? value.sixes_point : 0
                    };
                    playerRecord['4'] = {
                        'key_name': "S/R",
                        'actual': value.strike_rate ? value.strike_rate.toString() : "0",
                        'points': value.strike_rate_point ? value.strike_rate_point : 0
                    };
                    playerRecord['5'] = {
                        'key_name': "30/50/100",
                        'actual': value.century_halfCentury ? value.century_halfCentury.toString() : "0",
                        'points': value.century_halfCentury_point ? value.century_halfCentury_point : 0
                    };
                    playerRecord['6'] = {
                        'key_name': "Duck",
                        'actual': value.duck_out > 0 ? "Yes" : "No",
                        'points': value.duck_out_point ? value.duck_out_point : 0
                    };
                    playerRecord['7'] = {
                        'key_name': "Wickets",
                        'actual': value.wickets ? value.wickets.toString() : "0",
                        'points': value.wickets_point ? value.wickets_point : 0
                    };
                    playerRecord['8'] = {
                        'key_name': "LBW/Bowled Bonus",
                        'actual': value.LBW_bowled_bonus ? value.LBW_bowled_bonus.toString() : "0",
                        'points': value.LBW_bowled_bonus_point ? value.LBW_bowled_bonus_point : 0
                    };
                    playerRecord['9'] = {
                        'key_name': "2/3/4/5 Wicket Bonus",
                        'actual': value.bonus ? value.bonus.toString() : "0",
                        'points': value.bonus_point ? value.bonus_point : 0
                    };
                    playerRecord['10'] = {
                        'key_name': "Maiden Over",
                        'actual': value.maiden_over ? value.maiden_over.toString() : "0",
                        'points': value.maiden_over_point ? value.maiden_over_point : 0
                    };
                    playerRecord['11'] = {
                        'key_name': "E/R",
                        'actual': value.economy_rate ? value.economy_rate.toString() : "0",
                        'points': value.economy_rate_point ? value.economy_rate_point : 0
                    };
                    playerRecord['12'] = {
                        'key_name': "Catch",
                        'actual': value.catch ? value.catch.toString() : "0",
                        'points': value.catch_point ? value.catch_point : 0
                    };
                    playerRecord['13'] = {
                        'key_name': "Catch Bonus",
                        'actual': value.catch_bonus ? value.catch_bonus.toString() : "0",
                        'points': value.catch_bonus_point ? value.catch_bonus_point : 0
                    };
                    let actual     =   value.run_outStumping + value.run_out;
                    let pointsRun  =   value.run_outStumping_point + value.run_out_point;
                    playerRecord['14'] = {
                        'key_name': "Run Out/Stumping",
                        'actual': actual ? actual.toString() : "0",
                        'points': pointsRun ? pointsRun : 0
                    };
                    playerRecord['15'] = {
                        'key_name': "Total Point",
                        'actual': "0",
                        'points': value.total_point ? value.total_point : 0
                    };
                    selectedPercent  =  value.selected_by ? value.selected_by + "%" : '0.00' + "%";
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            result.push({
                'player_id': row.player_id,
                'player_role': row && row.player_role ? row.player_role : val.player_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'image': val && val.image ? val.image :'' ,
                'player_credit': val['player_credit'] ? val['player_credit'].toString() : '0',
                'selection_percent': selectedPercent,  //percent,
                'points': row.point,
                'in_contest': (isInContest.length > 0) ? true : false,
                'team_number': Array.from(new Set(teamNo)), //teamNum,
                'player_breckup': playerRecord,
                'in_dream_team': dreamPlayers ? true : false,
                'is_local_team': (row.team_type === "localteam") ? true : false
            });
        }
        data1 = result;
        cb(ApiUtility.success(result));
    } else {
        cb(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
    }
} 
/** Football Player stats with dynamic keys */
async function footabllPreviewNew(decoded, liveScore, cb) {
    let userId  =   decoded['user_id'];
    let sport   =   decoded['sport'];
    
    let result  =   [];
    let data1   =   {};
    
    let player_list = [];
    for (const value of liveScore) {
        player_list.push(value.player_id);
    }
    var results = await Promise.all([
        PointsBreakup.find({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] }),
        PlayerTeam.find({ user_id: userId, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"], sport: sport }),
        SeriesPlayer.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, 'sport': sport })
    ]);
    playerRecord = results[2] ? results[2] : [];
    let playerData = {};
    for (const value of playerRecord) {
        playerData[value.player_id] = value;
    }
    
    let playerBrackupData   =   [];
    let isInTeam            =   [];
    if(results && results.length > 0) {
        playerBrackupData   =   results[0] ? results[0] : [];
        isInTeam            =   results[1] ? results[1] : [];
    }
    if (liveScore) {
        for (const row of liveScore) {
            let teamNo = [];
            let isInContest = _.filter(isInTeam, key => key.players.includes(row.player_id) );
            
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            let val = playerData[row.player_id];
            let playerRecord = [];
            let selectedPercent =   "";

            playerBrackup = _.filter(playerBrackupData, key => key.player_id == row.player_id);
            // console.log(playerBrackup);
            if (playerBrackup) {
                for (const value of playerBrackup) {
                    playerRecord['0'] = {
                        'key_name': "Goals",
                        'actual': value.goal ? value.goal.toString() : "0",
                        'points': value.goal_point ? value.goal_point : 0
                    };
                    playerRecord['1'] = {
                        'key_name': "Assists",
                        'actual': value.assist ? value.assist.toString() : "0",
                        'points': value.assist_point ? value.assist_point : 0
                    };
                    playerRecord['2'] = {
                        'key_name': "Shots On Target",
                        'actual': value.shots_on_target ? value.shots_on_target.toString() : "0",
                        'points': value.shots_on_target_point ? value.shots_on_target_point : 0
                    };
                    playerRecord['3'] = {
                        'key_name': "Chances Created",
                        'actual': value.chance_created ? value.chance_created.toString() : "0",
                        'points': value.chance_created_point ? value.chance_created_point : 0
                    };
                    playerRecord['4'] = {
                        'key_name': "Passes Completed",
                        'actual': value.passes ? value.passes.toString() : "0",
                        'points': value.passes_point ? value.passes_point : 0
                    };
                    playerRecord['5'] = {
                        'key_name': "Tackles Won",
                        'actual': value.tackle_won ? value.tackle_won.toString() : "0",
                        'points': value.tackle_won_point ? value.tackle_won_point : 0
                    };
                    playerRecord['6'] = {
                        'key_name': "Interceptions Won",
                        'actual': value.interception_won ? value.interception_won.toString() : "0",
                        'points': value.interception_won_point ? value.interception_won_point : 0
                    };
                    playerRecord['7'] = {
                        'key_name': "Saves",
                        'actual': value.shots_saved  ? value.shots_saved.toString() : "0",
                        'points': value.shots_saved_point ? value.shots_saved_point : 0
                    };
                    playerRecord['8'] = {
                        'key_name': "penalties Saved",
                        'actual': value.penalty_saved ? value.penalty_saved.toString() : "0",
                        'points': value.penalty_saved_point ? value.penalty_saved_point : 0
                    };
                    playerRecord['9'] = {
                        'key_name': "Clean Sheet",
                        'actual': value.wickets ? value.wickets.toString() : "0",
                        'points': value.clean_sheet_point ? value.clean_sheet_point : 0
                    };
                    playerRecord['10'] = {
                        'key_name': "Minutes Played",
                        'actual': value.minutes_played ? value.minutes_played.toString() : "0",
                        'points': 0
                    };
                    playerRecord['11'] = {
                        'key_name': "Starting 11",
                        'actual': value.in_starting == 1 ? "Yes" : "No",
                        'points': value.in_starting_point ? value.in_starting_point : 0
                    };
                    playerRecord['12'] = {
                        'key_name': "Substitute",
                        'actual': value.in_substitute ? value.in_substitute.toString() : "0",
                        'points': value.in_substitute_point ? value.in_substitute_point : 0
                    };
                    playerRecord['13'] = {
                        'key_name': "Yellow Card",
                        'actual': value.yellow_card ? value.yellow_card.toString() : "0",
                        'points': value.yellow_card_point ? value.yellow_card_point : 0
                    };
                    playerRecord['14'] = {
                        'key_name': "Red Card",
                        'actual': value.red_card ? value.red_card.toString() : "0",
                        'points': value.red_card_point ? value.red_card_point : 0
                    };
                    playerRecord['15'] = {
                        'key_name': "Own Goal",
                        'actual': value.own_goal ? value.own_goal.toString() : "0",
                        'points': value.own_goal_point ? value.own_goal_point : 0
                    };                    
                    playerRecord['16'] = {
                        'key_name': "Goals Conceded",
                        'actual': value.goals_conceded ? value.goals_conceded.toString() : "0",
                        'points': value.goals_conceded_point ? value.goals_conceded_point : 0
                    };
                    playerRecord['17'] = {
                        'key_name': "Penalties Missed",
                        'actual': value.penalty_missed ? value.penalty_missed.toString() : "0",
                        'points': value.penalty_missed_point ? value.penalty_missed_point : 0
                    };
                    playerRecord['18'] = {
                        'key_name': "Total Points",
                        'actual': "0",
                        'points': value.total_point ? value.total_point : 0
                    };
                    
                    // playerRecord['blocked_shot'] = {
                    //     'key_name': "Starting 7",
                    //     'actual': value.blocked_shot || 0,
                    //     'points': value.blocked_shot_point //value.catch_point
                    // };

                    // playerRecord['clearance'] = {
                    //     'key_name': "Starting 7", 
                    //     'actual': value.clearance || 0,
                    //     'points': value.clearance_point //value.catch_point
                    // };

                    
                    selectedPercent  =  value.selected_by ? value.selected_by + "%" : '0.00' + "%";
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            result.push({
                'player_id': row.player_id,
                'player_role': row && row.player_role ? row.player_role : val.player_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'image': val && val.image ? val.image :'' ,
                'player_credit': val && val['player_credit'] ? val['player_credit'].toString() : '0',
                'selection_percent': selectedPercent,  //percent,
                'points': row.point,
                'in_contest': (isInContest.length > 0) ? true : false,
                'team_number': Array.from(new Set(teamNo)), //teamNum,
                'player_breckup': playerRecord,
                'in_dream_team': dreamPlayers ? true : false,
                'is_local_team': (row.team_type === "localteam") ? true : false
            });
        }
        data1 = result;
        cb(ApiUtility.success(result));
        // return res.send(ApiUtility.success(result));
    } else {
        cb(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
    }
} 
/** Kabaddi Player Stats */
async function kabaddiPreview(decoded, liveScore, cb) {
    let userId  =   decoded['user_id'];
    let sport   =   decoded['sport'];
    
    let result      =   [];
    let player_list =   [];
    
    for (const value of liveScore) {
        player_list.push(value.player_id);
    }
    var results = await Promise.all([
        PointsBreakup.find({ 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] }),
        PlayerTeam.find({ user_id: userId, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"], sport: sport }),
        SeriesPlayer.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, 'sport': sport })
    ]);
    playerRecord = results && results[2] ? results[2] : []; //await SeriesPlayer.find({ 'series_id': decoded["series_id"], 'player_id': { $in: player_list }, 'sport': sport });
    
    let playerData = {};
    for (const value of playerRecord) {
        playerData[value.player_id] = value;
    }
    
    let playerBrackupData   =   [];
    let isInTeam            =   [];
    if(results && results.length > 0) {
        playerBrackupData   =   results[0] ? results[0] : [];
        isInTeam            =   results[1] ? results[1] : [];
    }
    if (liveScore) {
        for (const row of liveScore) {
            let teamNo = [];
            let isInContest = _.filter(isInTeam, key => key.players.includes(row.player_id) );
            
            // console.log(row.player_id, isInContest);
            if (isInContest.length > 0) {
                for (const rows of isInContest) {
                    teamNo.push(rows.team_count);
                }
            }

            let val = playerData[row.player_id];
            let playerRecord = [];
            let selectedPercent =   "";

            let playerBrackup = _.filter(playerBrackupData, key => key.player_id == row.player_id)
            
            if (playerBrackup) {
                for (const value of playerBrackup) {
                    playerRecord['0'] = {
                        'key_name': "Starting 7",
                        'actual': value.in_starting == 1 ? "Yes" : "No",
                        'points': value.in_starting_point ? value.in_starting_point : 0
                    };

                    playerRecord['1'] = {
                        'key_name': "Substitute",
                        'actual': value.in_substitute ? value.in_substitute.toString() : "0",
                        'points': value.in_substitute_point ? value.in_substitute_point : 0
                    };
                    playerRecord['2'] = {
                        'key_name': "Raid Touch",
                        'actual': value.raid_touch ? value.raid_touch.toString() : "0" ,
                        'points': value.raid_touch_point ? value.raid_touch_point : 0
                    };
                    playerRecord['3'] = {
                        'key_name': "Raid Bonus",
                        'actual': value.raid_bonus ? value.raid_bonus.toString() : "0",
                        'points': value.raid_bonus_point ? value.raid_bonus_point : 0
                    };

                    playerRecord['4'] = {
                        'key_name': "Successful Tackle",
                        'actual': value.tackle_successful ? value.tackle_successful.toString() : "0",
                        'points': value.tackle_successful_point ? value.tackle_successful_point : 0
                    };

                    playerRecord['5'] = {
                        'key_name': "Super Tackle",
                        'actual': value.super_tackles ? value.super_tackles.toString() : "0",
                        'points': value.super_tackles_point ? value.super_tackles_point: 0
                    };

                    playerRecord['6'] = {
                        'key_name': "Pushing All Out",
                        'actual': value.pushing_all_out ? value.pushing_all_out.toString() : "0",
                        'points': value.pushing_all_out_point ? value.pushing_all_out_point : 0
                    };

                    playerRecord['7'] = {
                        'key_name': "Getting All Out",
                        'actual': value.getting_all_out ? value.getting_all_out.toString() : "0",
                        'points': value.getting_all_out_point ? value.getting_all_out_point : 0
                    };
                    
                    playerRecord['8'] = {
                        'key_name': "Unsuccessful Raid",
                        'actual': value.raid_unsuccessful ? value.raid_unsuccessful.toString() : "0",
                        'points': value.raid_unsuccessful_point ? value.raid_unsuccessful_point : 0 //value.raid_unsuccessful_point
                    };

                    playerRecord['9'] = {
                        'key_name': "Green Card",
                        'actual': value.green_card ? value.green_card.toString() : "0",
                        'points': value.green_card_point ? value.green_card_point : 0
                    };

                    playerRecord['10'] = {
                        'key_name': "Yellow Card",
                        'actual': value.yellow_card ? value.yellow_card.toString() : "0",
                        'points': value.yellow_card_point ? value.yellow_card_point : 0
                    };

                    playerRecord['11'] = {
                        'key_name': "Red Card",
                        'actual': value.red_card ? value.red_card.toString() : "0",
                        'points': value.red_card_point ? value.red_card_point : 0
                    };
                    
                    playerRecord['12'] = {
                        'key_name': "Super Raid",
                        'actual': value.super_raid ? value.super_raid.toString() : "0",
                        'points': value.super_raid_point ? value.super_raid_point : 0
                    };
                    
                    playerRecord['13'] = {
                        'key_name': "Unsuccessful Tackle",
                        'actual': value.tackle_unsuccessful ? value.tackle_unsuccessful.toString() : "0",
                        'points': value.tackle_unsuccessful_point ? value.tackle_unsuccessful_point : 0
                    };

                    playerRecord['14'] = {
                        'key_name': "Super 10",
                        'actual': value.super_ten > 0 ? "Yes" : "No",
                        'points': value.super_ten_point ? value.super_ten_point : 0
                    };

                    playerRecord['15'] = {
                        'key_name': "High Five",
                        'actual': value.high_five > 0 ? "Yes" : "No",
                        'points': value.high_five_point ? value.high_five_point : 0
                    };

                    playerRecord['16'] = {
                        'key_name': "Total Point",
                        'actual': "0",
                        'points': value.total_point
                    };
                    selectedPercent  =  value.selected_by ? value.selected_by + "%" : '0.00' + "%";
                }
            }

            let dreamPlayers = undefined;//DreamTeams.find().where(['series_id':series_id,'match_id':match_id,'player_id':row.playerId]).first();
            result.push({
                'player_id': row.player_id,
                'player_role': row && row.player_role ? row.player_role : val.player_role,
                'player_name': val['player_name'],
                'player_image': val['player_image'],
                'image': val && val.image ? val.image :'' ,
                'player_credit': val && val['player_credit'] ? val['player_credit'].toString() : '0',
                'selection_percent': selectedPercent,  //percent,
                'points': row.point,
                'in_contest': (isInContest.length > 0) ? true : false,
                'team_number': Array.from(new Set(teamNo)), //teamNum,
                'player_breckup': playerRecord,
                'in_dream_team': dreamPlayers ? true : false,
                'is_local_team': (row.team_type === "localteam") ? true : false
            });
        }
        data1 = result;
        cb(ApiUtility.success(result));
    } else {
        cb(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
    }
} 
