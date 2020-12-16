// const SeriesSquad = require('../../models/series-squad');
// const SeriesPlayer = require('../../models/series-player');
// const Series = require('../../models/series');
const PlayerRecord = require('../../models/player-record');
const PlayerTeam = require('../../models/player-team');
// const PlayerTeamTemp = require('../../models/player-team-temp');
// const LeaderboardFlag = require('../../models/leaderboard-flag');
// const PlayerTeamContest = require('../../models/player-team-contest');

const MatchContest = require('../../models/match-contest');
// const Team = require('../../models/team');
const User = require('../../models/user');
const LiveScore = require('../../models/live-score');
// const Contest = require('../../models/contest');
const PointsBreakup = require('../../models/points-breakup');
const ApiUtility = require('../api.utility');
const { ObjectId } = require('mongodb');
const moment = require('moment');
const config = require('../../config');
// const fs = require('fs');
// const pdf = require('html-pdf');
const ModelService = require("../ModelService");
// const asyncp = require("async");
const _ = require("lodash");
const redis = require('../../../lib/redis');
const mqtt = require('../../../lib/mqtt');
// const PlayerTeamService = require('../Services/PlayerTeamService');
// const { sendMailToDeveloper } = require('./common/helper');
const { RedisKeys } = require('../../constants/app');


module.exports = {
    
    leaderboard: async (req, res) => {
        try {
            let data1 = {};
            let {
                series_id, contest_id, match_id,sport
            } = req.params
            let user_id = req.userId;
            let decoded = {
                user_id: user_id,
                match_id: parseInt(match_id),
                contest_id: contest_id,
                series_id: parseInt(series_id)
            }
            let match_sport = sport ? parseInt(sport) : 1;
            if (decoded) {
                if (decoded['user_id'] && decoded['series_id'] && decoded['match_id'] && decoded['contest_id']) {

                    /*let pdf_name = match_id + '_' + contest_id;
                    let fileUrl = config.express.staticFilesPath+"/leaderboard/"+pdf_name+'.pdf';
                    if(fs.existsSync(fileUrl)){
                        data1	=	{'url':fileUrl};
                        //return res.send(ApiUtility.success(data1));
                    }*/ 
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });
                    if (authUser) {
                        let details = await MatchContest.findOne({ match_id: match_id, sport: match_sport,'contest_id': contest_id })
                        if (!details) {
                            return res.send(ApiUtility.failed("Match Contest Not found"));
                        }
                        if (details) {
                            let pdfName = details.team_list_pdf ? config.imageBaseUrl + '/' + details.team_list_pdf : '';
                            data1 = { 'url': pdfName };
                            return res.send(ApiUtility.success(data1));
                        }
                    } else {
                        return res.send(ApiUtility.failed('User Detail not found.'));
                    }
                } else {
                    return res.send(ApiUtility.failed("User id, language, Series id, Match id are Empty."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    teamScore: async (req, res) => {
        try {
            let data1 = {};
            const user_id = req.userId;
            const { series_id, match_id } = req.params;

            let decoded = {
                series_id: parseInt(series_id),
                match_id: parseInt(match_id),
                user_id: user_id,
            }
            let sport = (decoded['sport']) ? decoded['sport'] : 1;
            if (decoded['series_id'] && decoded['match_id'] && decoded['user_id']) {
                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    let user = await LiveScore.aggregate([
                        {
                            $match: { 'series_id': decoded['series_id'], 'match_id': decoded['match_id'] }
                        },
                        {
                            $group: {
                                _id: "$team_id",
                                "doc": { "$first": "$$ROOT" },
                            }
                        }
                    ]);
                    if (user) {
                        for (var team of user) {
                            team = team.doc
                            if (team.team_type == 'localteam') {
                                // let score= "0";
                                // if(team.total_inning_score){
                                //     let part = team.total_inning_score.split(" ");
                                //     if(part.length == 4){
                                //         score = part[0]+'-'+team.wickets+' '+part[1]+part[2]+part[3];
                                //     }
                                // }
                                data1.local_team_score = team.total_inning_score;
                            } else {
                                // let score="0";
                                // if(team.total_inning_score){
                                //     let part = team.total_inning_score.split(" ");
                                //     if(part.length === 4){
                                //         score = part[0]+'-'+team.wickets+' '+part[1]+part[2]+part[3];
                                //     }
                                // }
                                data1.vistor_team_score = team.total_inning_score;
                            }

                            if (team.match_status == 'Not Started') {
                                data1.match_started = false;
                            } else {
                                data1.match_started = true;
                            }
                            data1.comment = team.comment;
                        }
                        return res.send(ApiUtility.success(data1));
                    } else {
                        return res.send(ApiUtility.failed('Match not started yet.'));
                    }
                } else {
                    return res.send(ApiUtility.failed('User Detail not found.'));
                }
            } else {
                return res.send(ApiUtility.failed("user id, series_id or match_id is empty."));
            }
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    entryPerTeam: async (req, res) => {
        try {
            let data1 = {};
            const user_id = req.userId;
            const { contest_size, winning_amount } = req.body;
            let decoded = {
                contest_size,
                winning_amount,
                user_id
            }

            if (decoded) {
                if (decoded['user_id'] && decoded['contest_size'] && decoded['winning_amount']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });

                    let commission = config.contest_commission;

                    if (authUser) {

                        let winningAmount = decoded['winning_amount'];

                        let contetSize = decoded['contest_size'];

                        let entryFee = 0;

                        if (winningAmount > 0) {
                            let percent = (winningAmount / 100) * parseFloat(commission);
                            let finalWinAmt = parseFloat(percent) + parseFloat(winningAmount);
                            entryFee = finalWinAmt / contetSize;
                        }

                        data1.entry_fee = entryFee;
                        return res.send(ApiUtility.success(data1));
                    } else {
                        return res.send(ApiUtility.failed("Security check failed."));
                    }
                } else {
                    return res.send(ApiUtility.failed('user_id, contest_size, or winning_amount are empty.'));
                }
            } else {
                return res.send(ApiUtility.failed("match id or series id are empty."));
            }
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    teamStates: async (req, res) => {
        try {
            let data = [];
            let data1 = {};
            const user_id = req.userId;
            if (decoded) {
                if (decoded['user_id'] && decoded['series_id']) {
                    let user = await User.findOne({ '_id': decoded['user_id'] }).select("id team_name image")
                    // let allSeriesTeam	=	await PlayerTeam.find().where(['PlayerTeams.series_id'=>decoded['series_id'],'user_id'=>decoded['user_id'],'points !='=>0])
                    //                     .group(['PlayerTeams.match_id'])
                    //                     .order(['SeriesSquad.date'=>'DESC','SeriesSquad.time'=>'DESC','PlayerTeams.points'=>'DESC'])
                    //                     .contain(['SeriesSquad'=>['LocalMstTeams','VisitorMstTeams']])
                    //                     .toArray();

                    let teamName = '';
                    let userImage = '';
                    let seriesName = '';
                    let totalPoints = '';
                    let totalRank = '';

                    if (user) {
                        teamName = user.team_name;
                        if (user.image) {
                            userImage = user.image; // config.imageBaseUrl + '/users/' + user.image;
                        }
                    }
                    let myRankPoints = getSeriesRanking(decoded['user_id'], decoded['series_id']);

                    if (myRankPoints) {
                        for (const myRank of myRankPoints) {
                            seriesName = myRank['series_name'];
                            totalPoints = myRank['points'];
                            totalRank = myRank['rank'];
                        }
                    }
                    matches = [];

                    if (allSeriesTeam) {
                        let key = 0;
                        for (const seriesTeam of allSeriesTeam) {
                            // teamPoints	=	await PlayerTeam.find()
                            //                 .where(['PlayerTeams.series_id'=>seriesTeam.series_id,'PlayerTeams.match_id'=>seriesTeam.match_id,'user_id'=>seriesTeam.user_id,'points !='=>0])
                            //                 .order(['PlayerTeams.points'=>'DESC','SeriesSquad.date'=>'DESC','SeriesSquad.time'=>'DESC'])
                            //                 .contain(['SeriesSquad'])
                            //                 .first();
                            matches[key]['local_team'] = (seriesTeam.series_squad.local_mst_team.team_short_name) ? seriesTeam.series_squad.local_mst_team.team_short_name : seriesTeam.series_squad.local_mst_team.team_name;
                            matches[key]['visitor_team'] = (seriesTeam.series_squad.visitor_mst_team.team_short_name) ? seriesTeam.series_squad.visitor_mst_team.team_short_name : seriesTeam.series_squad.visitor_mst_team.team_name;
                            matches[key]['team_count'] = 'T' + teamPoints.team_count;
                            matches[key]['points'] = teamPoints.points;
                            matches[key]['match_id'] = teamPoints.match_id;
                            key++;
                        }
                    }

                    data['team_name'] = teamName;
                    data['image'] = userImage;
                    data['series_name'] = seriesName;
                    data['total_points'] = totalPoints;
                    data['totalRank'] = totalRank;
                    data['point_detail'] = matches;
                    data1 = data;
                    return res.send(ApiUtility.success(data1));
                } else {
                    return res.send(ApiUtility.failed('Please check all details are filled correct.'));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    seriesPlayerList: async (req, res) => {
        try {
            let totalTeam = "0";
            let percent = '0';
            let result = [];
            let data = [];
            let data1 = {};
            const user_id = req.userId;
            const { series_id, match_id, is_player_state, contest_id } = req.params;
            let decoded = {
                user_id,
                series_id: parseInt(series_id),
                match_id: parseInt(match_id),
                contest_id,
                is_player_state
            }
            // console.log(decoded);
            if (decoded['user_id'] && decoded['series_id'] && decoded['match_id']) {

                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    // let totalTeam = await PlayerTeam.find({ 'series_id': series_id, 'match_id': match_id }).countDocuments();
                    // console.log(totalTeam);
                    let liveScore;

                    if (decoded['is_player_state']) {
                        liveScore = await LiveScore.aggregate([
                            {
                                $match: { 'series_id': series_id, 'match_id': match_id }
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
                    // console.log(liveScore);return false;
                    // let joinedContest = await PlayerTeamContest.aggregate([
                    //     {
                    //         $match: { 'match_id': parseInt(match_id), 'series_id': parseInt(series_id) }
                    //     },
                    //     {
                    //         $group: {
                    //             _id: "$contest_id",
                    //         }
                    //     }
                    // ]);

                    //console.log('Joined Contest',joinedContest, {'match_id':match_id,'series_id':series_id})
                    // if (contest_id) {
                    //     contestId = contest_id.split(",");
                    // } else {
                    //     let joinedContestIds = [];
                    //     for (const contest of joinedContest) {
                    //         joinedContestIds.push(contest._id);
                    //     }
                    //     contestId = joinedContestIds;
                    // }
                    // console.log(contestId);return false;
                    let player_list = [];
                    for (const value of liveScore) {
                        player_list.push(value.player_id);
                    }
                    
                    playerRecord = await PlayerRecord.find({ 'player_id': { $in: player_list } });
                    let playerData = {};
                    for (const value of playerRecord) {
                        playerData[value.player_id] = value;
                    }
                    
                    if (liveScore) {
                        for (const row of liveScore) {
                            let teamNo = [];
                            // console.log("user_id:", req.userId, "players:", row.player_id, 'series_id:', series_id, 'match_id:', match_id)
                            let isInContest = await PlayerTeam.aggregate([
                                { $match: { user_id: req.userId, "players": row.player_id, 'series_id': decoded["series_id"], 'match_id': decoded["match_id"] } },
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
                            if (decoded['is_player_state']) {
                                playerBrackup = await PointsBreakup.aggregate([
                                    {
                                        $match: { 'series_id': series_id, 'match_id': match_id, 'player_id': row.player_id }
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
                                playerBrackup = await PointsBreakup.find({ 'series_id': series_id, 'match_id': match_id, 'player_id': row.player_id, 'inning_number': row.inning_number })
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
                                'player_name': val['player_name'],
                                'player_image': val['player_image'],
                                'player_credit': val['player_credit'],
                                'selection_percent': "0%",  //percent,
                                'points': row.point,
                                'in_contest': (isInContest.length > 0) ? true : false,
                                'team_number': Array.from(new Set(teamNo)), //teamNum,
                                // 'player_breckup': playerRecord,
                                // 'in_dream_team': dreamPlayers ? true : false
                            });
                        }
                        data1 = result;
                        status = true;
                        return res.send(ApiUtility.success(result));
                    } else {
                        return res.send(ApiUtility.failed("Match scheduled to start soon. Refresh shortly to see fantasy scores of players."));
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

