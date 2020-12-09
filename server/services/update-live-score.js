const request = require('request');
const Promise = require('bluebird');
const moment = require('moment');
const _ = require('lodash');
const util = require('./util');


module.exports = {
    updateLiveScore: (db) => {
        const LiveScore = db.collection("live_score");
        const SeriesSquad = db.collection("series_squad");
        const SeriesPlayers = db.collection("series_players");
        const Playing = db.collection("playing");
        const date = moment().format(config.DateFormat.date);
        const pre_date = '2020-03-07';

        SeriesSquad.find({
            date: [{$lte: date}, {$gt: pre_date}],
            status: 1,
            match_status: [{$ne: 'Finished'}, {$ne: 'Cancelled'}, {$ne: 'postponed'}],
            win_flag: 0,
        }, (err, matches) => {
            if (err) {
                console.error("updateLiveScore > SeriesSquad.find > error => ", err)
            }
            if (matches && matches.length > 0) {
                util.genrateToken((token) => {
                    if (token) {
                        for (const match of matches) {
                            const match_key = match.match_id;
                            const series_id = match.series_id;
                            const match_id = match.id;
                            const match_type = match.type;
                            const team1 = match.localteam_id;
                            const team2 = match.visitorteam_id;
                            const getmtdatastatus = {};

                            this.getMatchesDetails(token, match_key, (match_detail) => {
                                if (!_.isEmpty(match_detail)) {
                                    const match_status = match_detail.status; // 1 = scheduled , 2 = completed, 3 = Live , 4 = canceled
                                    if (match_status == 2 && match_detail.verified == 'true') {
                                        getmtdatastatus['match_status'] = 'Finished';
                                    }
                                    if (match_status == 3) {
                                        getmtdatastatus['match_status'] = 'In Progress';
                                        this.cancelUnconfirmedContest(series_id, match_key);
                                    }
                                    if (match_status == 2 && match_detail.verified == 'false') {
                                        getmtdatastatus['match_status'] = 'In Progress';
                                    }
                                    if (match_status == 4) {
                                        getmtdatastatus['match_status'] = 'Cancelled';
                                        this.cancelAllContest(series_id, match_key);
                                    }
                                    SeriesSquad.findOne({'match_id': match_key}, (err, seriesSquad) => {
                                        if (err) {
                                            console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > error => ", err)
                                        }
                                        if (!_.isEmpty(seriesSquad)) {
                                            const ctime = moment().toDate().getTime();
                                            const mtime =  moment(seriesSquad.date+" "+ seriesSquad.time, config.DateFormat.date +" "+ config.DateFormat.time).toDate().getTime();

                                            if (mtime < ctime) {
                                                this.cancelUnconfirmedContest(series_id, match_key);
                                            }

                                            if (getmtdatastatus.match_status) {
                                                if (mtime < ctime) {
                                                    SeriesSquad.update({_id: seriesSquad._id}, {$set: {match_status: getmtdatastatus['match_status']}}, (err) =>{
                                                        if (err) {
                                                            console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > error => ", err)
                                                        }
                                                    })
                                                }
                                            }

                                            const comment = match_detail.status_note ? match_detail.status_note : '';

                                            // Get and Update Playing 11 Teams
                                            this.getMatchPlayingPlayers(token, match_key, (finalplayingteams) => {
                                                if (finalplayingteams && finalplayingteams.length > 15) {
                                                    
                                                    LiveScore.remove({matchId: match_key}, (err) => {
                                                        if (err) {
                                                            console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > LiveScore.remove > error => ", err)
                                                        }
                                                    })

                                                    Playing.update({match_id: match_key}, {match_id: match_key, playing_11: finalplayingteams}, {upsert: true}, (err) => {
                                                        if (err) {
                                                            console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > Playing.update > error => ", err)
                                                        }
                                                    })

                                                    for (const player_id of finalplayingteams) {
                                                        SeriesPlayers.findOne({series_id: series_id, player_id}, (err, player_detail) => {
                                                            if (err) {
                                                                console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > error => ", err)
                                                            }
                                                            if (!_.isEmpty(player_detail)) {
                                                                const team_id = player_detail.team_id;
                                                                const player_name = player_detail.player_name;
                                                                let team_type = 'visitorteam';
                                                                if (team_id == team1) {
                                                                    team_type = 'localteam';
                                                                }
                                                                const liveScoreData = {
                                                                    seriesId: series_id,
                                                                    matchId: match_key,
                                                                    teamId: team_id,
                                                                    teamType: team_type,
                                                                    matchType: match_type,
                                                                    playerId: player_id,
                                                                    playerName: player_name,
                                                                    point: 0,
                                                                    inning_number: 1
                                                                }
                                                                LiveScore.update({seriesId: liveScoreData.seriesId, matchId: liveScoreData.matchId, playerId: liveScoreData.playerId, inning_number: liveScoreData.inning_number },liveScoreData,{upsert: true}, (err) => {
                                                                    if (err) {
                                                                        console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > LiveScore.update > error => ", err)
                                                                    }
                                                                })
                                                            }
                                                        })
                                                    }
                                                    
                                                    if(!_.isEmpty(match_detail.innings)) {
                                                        for (const inning of match_detail.innings) {
                                                            let inning_number = inning.number;
                                                            if (inning_number == 1 || inning_number == 2) {
                                                                inning_number = 1;
                                                            } else if (inning_number == 3 || inning_number == 4) {
                                                                inning_number = 2;
                                                            }

                                                            const nseries_id = match_detail.competition.cid;

                                                            const nteam1 = match_detail.teama.team_id;
                                                            const nteam2 = match_detail.teamb.team_id;

                                                            const localteamScore = match_detail.teama.scores;
                                                            let local_runrate = 0;
                                                            if (localteamScore) {
                                                                local_runrate = Math.round((match_detail.teama.scores / match_detail.teama.overs * 100), 2);
                                                            }
                                                            const visitorteamScore = match_detail.teamb.scores;
                                                            let visitor_runrate = 0;
                                                            if (visitorteamScore) {
                                                                visitor_runrate = Math.round((match_detail.teamb.scores / match_detail.teamb.overs * 100), 2);
                                                            }
                                
                                                            const batsmens = inning.batsmen;
                                                            const bowlers = inning.bowlers;
                                                            const fielders = inning.fielder;

                                                            for (const batsmen of batsmens) {
                                                                const batsman_id = batsmen.batsman_id;
                                                                const live_score_data = {};
                                                                SeriesPlayers.findOne({series_id: nseries_id, player_id: batsman_id}, (err, batsman_detail) => {
                                                                    if (err) {
                                                                        console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > batsman_detail > error => ", err)
                                                                    }
                                                                    if (!_.isEmpty(batsman_detail)) {
                                                                        const team_id = batsman_detail.team_id;
                                                                        const player_name = batsman_detail.player_name;

                                                                        let team_type = 'visitorteam';
                                                                        if (team_id == nteam1) {
                                                                            team_type = 'localteam';
                                                                        }
                                                                        let team_score = 0;
                                                                        let run_rate = 0;
                                                                        if (team_id == team1) {
                                                                            team_score = localteamScore;
                                                                            run_rate = local_runrate;
                                                                        } else {
                                                                            team_score = visitorteamScore;
                                                                            run_rate = visitor_runrate;
                                                                        }

                                                                        //Get Batting Points
                                                                        let wickets = team_score.split('/');
                                                                        wickets = wickets[1];

                                                                        // Prepare insert data for insert
                                                                        live_score_data.seriesId = nseries_id;
                                                                        live_score_data.matchId = match_key;
                                                                        live_score_data.teamId = team_id;
                                                                        live_score_data.teamType = team_type; // To be find that
                                                                        live_score_data.matchType = match_type;
                                                                        live_score_data.matchStatus = getmtdatastatus['match_status'];
                                                                        live_score_data.comment = comment; // To be find
                                                                        live_score_data.playerId = batsman_id;
                                                                        live_score_data.playerName = player_name;
                                                                        live_score_data.point = 0;
                                                                        live_score_data.run_scored = batsmen.runs;
                                                                        live_score_data.status = batsmen.how_out;
                                                                        live_score_data.ball_faced = batsmen.balls_faced;
                                                                        live_score_data.s4 = batsmen.fours;
                                                                        live_score_data.s6 = batsmen.sixes;
                                                                        live_score_data.battingStrikeRate = batsmen.strike_rate;
                                                                        live_score_data.isCurrentBatsman = batsmen.batting == 'false' ? 0 : 1;
                                                                        live_score_data.inning_number = inning_number;
                                                                        live_score_data.extra_run_scored = 0;
                                                                        live_score_data.bowls = 0;
                                                                        live_score_data.wickets = wickets;
                                                                        live_score_data.total_inning_score = team_score;
                                                                        live_score_data.run_rate = run_rate;

                                                                        LiveScore.update({matchId: match_key, playerId: batsman_id, inning_number: inning_number}, live_score_data, {upsert: true}, (err) => {
                                                                            if (err) {
                                                                                console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > LiveScore.update > batsman > error => ", err)
                                                                            }
                                                                        })
                                                                    }
                                                                });
                                                            }

                                                            for (const bowler of bowlers) {
                                                                const bowler_id = bowler.bowler_id;
                                                                const live_score_data = {};
                                                                SeriesPlayers.findOne({series_id: nseries_id, player_id: bowler_id}, (err, bowler_detail) => {
                                                                    if (err) {
                                                                        console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > bowler_detail > error => ", err)
                                                                    }
                                                                    if (!_.isEmpty(bowler_detail)) {
                                                                        const team_id = bowler_detail.team_id;
                                                                        const player_name = bowler_detail.player_name;

                                                                        let team_type = 'visitorteam';
                                                                        if (team_id == nteam1) {
                                                                            team_type = 'localteam';
                                                                        }
                                                                        let team_score = 0;
                                                                        let run_rate = 0;
                                                                        if (team_id == team1) {
                                                                            team_score = localteamScore;
                                                                            run_rate = local_runrate;
                                                                        } else {
                                                                            team_score = visitorteamScore;
                                                                            run_rate = visitor_runrate;
                                                                        }


                                                                        let wickets = team_score.split('/');
                                                                        wickets = wickets[1];

                                                                        // Prepare insert data for insert
                                                                        live_score_data.seriesId = nseries_id;
                                                                        live_score_data.matchId = match_key;
                                                                        live_score_data.teamId = team_id;
                                                                        live_score_data.teamType = team_type; // To be find that
                                                                        live_score_data.matchType = match_type;
                                                                        live_score_data.matchStatus = getmtdatastatus['match_status'];
                                                                        live_score_data.comment = comment; // To be find
                                                                        live_score_data.playerId = bowler_id;
                                                                        live_score_data.playerName = player_name;
                                                                        live_score_data.point = 0;
                                                                        live_score_data.inning_number = inning_number;
                                                                        live_score_data.bowls = 0;
                                                                        live_score_data.wickets = wickets;
                                                                        live_score_data.total_inning_score = team_score;
                                                                        live_score_data.run_rate = run_rate;
                                                                        live_score_data.over_bowled = bowler.overs;
                                                                        live_score_data.maidens_bowled =  bowler.maidens_bowled;
                                                                        live_score_data.runs_conceded =  bowler.maidens;
                                                                        live_score_data.wickets_taken =  bowler.wickets;
                                                                        live_score_data.wide_balls =  bowler.wides;
                                                                        live_score_data.economy_rates_runs_conceded =  bowler.econ;
                                                                        live_score_data.no_balls =  bowler.noballs;
                                                                        live_score_data.isCurrentBowler =  bowler.bowling == 'false' ? 0 : 1;
                                                                        LiveScore.update({matchId: match_key, playerId: bowler_id, inning_number: inning_number}, live_score_data, {upsert: true}, (err) => {
                                                                            if (err) {
                                                                                console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > LiveScore.update > bowler > error => ", err)
                                                                            }
                                                                        })
                                                                    }
                                                                });

                                                            }

                                                            for (const fielder of fielders) {
                                                                const fielder_id = fielder.fielder_id;
                                                                const live_score_data = {};
                                                                SeriesPlayers.findOne({series_id: nseries_id, player_id: fielder_id}, (err, fielder_detail) => {
                                                                    if (err) {
                                                                        console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > fielder_detail > error => ", err)
                                                                    }
                                                                    if (!_.isEmpty(fielder_detail)) {
                                                                        const team_id = fielder_detail.team_id;
                                                                        const player_name = fielder_detail.player_name;

                                                                        let team_type = 'visitorteam';
                                                                        if (team_id == nteam1) {
                                                                            team_type = 'localteam';
                                                                        }
                                                                        let team_score = 0;
                                                                        let run_rate = 0;
                                                                        if (team_id == team1) {
                                                                            team_score = localteamScore;
                                                                            run_rate = local_runrate;
                                                                        } else {
                                                                            team_score = visitorteamScore;
                                                                            run_rate = visitor_runrate;
                                                                        }



                                                                        let wickets = team_score.split('/');
                                                                        wickets = wickets[1];

                                                                        // Prepare insert data for insert
                                                                        live_score_data.seriesId = nseries_id;
                                                                        live_score_data.matchId = match_key;
                                                                        live_score_data.teamId = team_id;
                                                                        live_score_data.teamType = team_type; // To be find that
                                                                        live_score_data.matchType = match_type;
                                                                        live_score_data.matchStatus = getmtdatastatus['match_status'];
                                                                        live_score_data.comment = comment; // To be find
                                                                        live_score_data.playerId = fielder_id;
                                                                        live_score_data.playerName = player_name;
                                                                        live_score_data.point = 0;
                                                                        live_score_data.inning_number = inning_number;
                                                                        live_score_data.bowls = 0;
                                                                        live_score_data.wickets = wickets;
                                                                        live_score_data.total_inning_score = team_score;
                                                                        live_score_data.run_rate = run_rate;
                                                                        live_score_data.stampCount = fielder.stumping;
                                                                        live_score_data.run_out_count =  fielder.runout_direct_hit;
                                                                        live_score_data.catch =  fielder.catches;
                                                                        live_score_data.thrower =  fielder.runout_thrower;
                                                                        live_score_data.hitter =  fielder.runout_catcher;
                                                                        
                                                                        LiveScore.update({matchId: match_key, playerId: fielder_id, inning_number: inning_number}, live_score_data, {upsert: true}, (err) => {
                                                                            if (err) {
                                                                                console.error("updateLiveScore > SeriesSquad.find > util.genrateToken > this.getMatchesDetails > SeriesSquad.findOne > SeriesSquad.update > this.getMatchPlayingPlayers > for > SeriesPlayers.findOne > LiveScore.update > fielder > error => ", err)
                                                                            }
                                                                        })
                                                                    }
                                                                });

                                                            }




                                                        }
                                                    }
                                                }
                                            });

                                            this.updatePoints(series_id, match_key);
                                        }

                                    });
                                }
                            });
                        }
                    }
                });
            }
        });
    },
    updatePoints: (series_id, match_key) => {

        const LiveScore = db.collection("live_score");
        const PointSystem = db.collection("point_system");
        const PointsBreakup = db.collection("points_breakup");
        const SeriesPlayers = db.collection("series_players");

        LiveScore.find({'seriesId': series_id, 'matchId': match_key}, (err, players_data) => {
            if (err) {
                console.error("updatePoints > LiveScore.find > error => ", err)
            }
            if (!_.isEmpty(players_data)) {
                PointSystem.find({}, (err, point_system) => {
                    if (err) {
                        console.error("updatePoints > LiveScore.find > PointSystem.find > error => ", err)
                    }
                    if (!_.isEmpty(point_system)) {
                        let point_system_obj = {};
                        for (let i = 0; i < point_system.length; i++) {
                            point_system_obj[point_system[i].matchType] = point_system[i];
                        }

                        SeriesPlayers.find({series_id: series_id}, (err, series_players) => {
                            if (err) {
                                console.error("updatePoints > LiveScore.find > PointSystem.find > SeriesPlayers.find > error => ", err)
                            }
                            
                            if (!_.isEmpty(series_players)) {
                                let series_players_obj = {};
                                for (let i = 0; i < series_players.length; i++) {
                                    series_players_obj[series_players[i].player_id] = series_players[i];
                                }

                                for (const player of players_data) {
                                    let halfCentury = 0, century = 0, wicket4 = 0, wicket5 = 0, points = 0, duck_out_point = 0, srates = 0, strike_rate_point = 0;
                
                                    let duck_out = 0;
                                    const runScored 		= (player.run_scored) ? player.run_scored : 0;
                                    const s4 			= (player.s4) ? player.s4 : 0;
                                    const s6 			= (player.s6) ? player.s6 : 0;
                                    const wicketsTaken 	= (player.wickets_taken) ? player.wickets_taken : 0;
                                    const maidensOver  	= (player.maidens_bowled) ? player.maidens_bowled : 0;
                                    const player_catch 			= (player.catch) ? player.catch : 0;
                                    const runOutCount 	= (player.run_out_count) ? player.run_out_count : 0;
                                    const runOutCount_thrower 	= (player.thrower) ? player.thrower : 0;
                                    const runOutCount_catcher 	= (player.hitter) ? player.hitter : 0;
                                    const stampCount		= (player.stampCount) ? player.stampCount : 0;
                                    const economyRate 	= (player.economy_rates_runs_conceded) ? player.economy_rates_runs_conceded : 0;
                                    const strikeRate 	= (player.battingStrikeRate) ? player.battingStrikeRate : 0;
                                    const ballFaced 		= (player.ball_faced) ? player.ball_faced : 0;
                                    const overBowled 	= (player.over_bowled) ? player.over_bowled : 0;
                                    let in_starting;
                                    let in_starting_point;
                                    let runs_point;
                                    let fours_point;
                                    let sixes_point;
                                    let wickets_point;
                                    let maiden_over_point;
                                    let catch_point;
                                    let run_outStumping_point;
                                    let run_out_point;
                                    let run_out_point_thrower;
                                    let run_out_point_catcher;

                                    let century_halfCentury_point = 0, bonus_point = 0,  economy_rate_point = 0, isCenturyHalfCentury = 0, bonus = 0, erates = 0;
                                    let points = 0;
                                    if (player.matchType == 'Test' || player.matchType == 'First-class') {
                                        const pointSystem = point_system_obj[3];
                                        const plyrType = (series_players_obj[player.playerId] && series_players_obj[player.playerId].test == 'True') ? series_players_obj[player.playerId].player_role : null;

                                        if (pointSystem && plyrType) {
                                            in_starting = 1;
                                            in_starting_point 			= pointSystem.othersStarting11;
                                            runs_point 				    = pointSystem.battingRun;
                                            fours_point 				= pointSystem.battingBoundary;
                                            sixes_point 				= pointSystem.battingSix;
                                            wickets_point 				= pointSystem.bowlingWicket;
                                            maiden_over_point 			= pointSystem.bowlingMaiden;
                                            catch_point 				= pointSystem.fieldingCatch;
                                            run_outStumping_point 		= pointSystem.fieldingStumpRunOut;
                                            run_out_point 		        = pointSystem.fieldingRunOutThrower;
                                            run_out_point_thrower 		= pointSystem.fieldingRunOutThrower;
                                            run_out_point_catcher 		= pointSystem.fieldingRunOutCatcher;
                    
                                            points = (pointSystem.othersStarting11 + (runScored * pointSystem.battingRun) + (s4 * pointSystem.battingBoundary) + (s6 * pointSystem.battingSix));
    
                                            if ((runScored >= '50') && (runScored <= '99')) {
                                                points = points + pointSystem.battingHalfCentury;
                                                century_halfCentury_point = pointSystem.battingHalfCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if (runScored >= '100') {
                                                points = points + pointSystem.battingCentury;
                                                century_halfCentury_point = pointSystem.battingCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if ((runScored == '0') && (plyrType != 'Bowler') && (player.status != 'Not out' || player.status != 'not out')) {
                                                points = points + pointSystem.battingDuck;
                                                duck_out_point = pointSystem.battingDuck;
                                                duck_out = 1;
                                            }
                                            if (wicketsTaken != '') {
                                                points = points + (wicketsTaken * pointSystem.bowlingWicket);
                                            }
                                            if (wicketsTaken == '4') {
                                                points = points + pointSystem.bowling4Wicket;
                                                bonus_point = pointSystem.bowling4Wicket;
                                                bonus = 1;
                                            }
                                            if (wicketsTaken >= '5') {
                                                points = points + pointSystem.bowling5Wicket;
                                                bonus_point = pointSystem.bowling5Wicket;
                                                bonus = 1;
                                            }
                                            if (maidensOver != '') {
                                                points = points + (maidensOver * pointSystem.bowlingMaiden);
                                            }
    
                                            points = points + (player_catch * pointSystem.fieldingCatch);
                                            points = points + (runOutCount * pointSystem.fieldingStumpRunOut);
                                            points = points + (runOutCount_thrower * pointSystem.fieldingRunOutThrower);
                                            points = points + (runOutCount_catcher * pointSystem.fieldingRunOutCatcher);
                                            points = points + (stampCount * pointSystem.fieldingStumpRunOut);
                                            points = (Math.round(points));
                                            
                                        }
                                    } else if (player.matchType == 'ODI') {
                                        const pointSystem = point_system_obj[2];
                                        const plyrType = (series_players_obj[player.playerId] && series_players_obj[player.playerId].odi == 'True') ? series_players_obj[player.playerId].player_role : null;

                                        if (pointSystem && plyrType) {
                                            
                                            in_starting = 1;
                                            in_starting_point 			= pointSystem.othersStarting11;
                                            runs_point 				    = pointSystem.battingRun;
                                            fours_point 				= pointSystem.battingBoundary;
                                            sixes_point 				= pointSystem.battingSix;
                                            wickets_point 				= pointSystem.bowlingWicket;
                                            maiden_over_point 			= pointSystem.bowlingMaiden;
                                            catch_point 				= pointSystem.fieldingCatch;
                                            run_outStumping_point 		= pointSystem.fieldingStumpRunOut;
                                            run_out_point 		        = pointSystem.fieldingRunOutThrower;
                                            run_out_point_thrower 		= pointSystem.fieldingRunOutThrower;
                                            run_out_point_catcher 		= pointSystem.fieldingRunOutCatcher;

                                            points = (pointSystem.othersStarting11 + (runScored * pointSystem.battingRun) + (s4 * pointSystem.battingBoundary) + (s6 * pointSystem.battingSix));
    
                                            if ((runScored >= '50') && (runScored <= '99')) {
                                                points = points + pointSystem.battingHalfCentury;
                                                century_halfCentury_point = pointSystem.battingHalfCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if (runScored >= '100') {
                                                points = points + pointSystem.battingCentury;
                                                century_halfCentury_point = pointSystem.battingCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if ((runScored == '0') && (plyrType != 'Bowler') && (player.status != 'Not out' || player.status != 'not out')) {
                                                points = points + pointSystem.battingDuck;
                                                duck_out_point = pointSystem.battingDuck;
                                                duck_out = 1;
                                            }
                                            if (wicketsTaken != '') {
                                                points = points + (wicketsTaken * pointSystem.bowlingWicket);
                                            }
                                            if (wicketsTaken == '4') {
                                                points = points + pointSystem.bowling4Wicket;
                                                bonus_point = pointSystem.bowling4Wicket;
                                                bonus = 1;
                                            }
                                            if (wicketsTaken >= '5') {
                                                points = points + pointSystem.bowling5Wicket;
                                                bonus_point = pointSystem.bowling5Wicket;
                                                bonus = 1;
                                            }
                                            if (maidensOver != '') {
                                                points = points + (maidensOver * pointSystem.bowlingMaiden);
                                            }
    
                                            points = points + (player_catch * pointSystem.fieldingCatch);
                                            points = points + (runOutCount * pointSystem.fieldingStumpRunOut);
                                            points = points + (runOutCount_thrower * pointSystem.fieldingRunOutThrower);
                                            points = points + (runOutCount_catcher * pointSystem.fieldingRunOutCatcher);
                                            points = points + (stampCount * pointSystem.fieldingStumpRunOut);

                                            if (overBowled >= 5) {
                                                if (economyRate < '2.5') {
                                                    points = points + pointSystem.odiEconomyLt2_5Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.odiEconomyLt2_5Runs;
                                                }
                                                if ((economyRate >= '2.5') && (economyRate <= '3.49')) {
                                                    points = points + pointSystem.odiEconomyGt2_5Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.odiEconomyGt2_5Runs;
                                                }
                                                if ((economyRate >= '3.5') && (economyRate <= '4.5')) {
                                                    points = points + pointSystem.odiEconomyGt3_5Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.odiEconomyGt3_5Runs;
                                                }
                                                if ((economyRate >= '4.6') && (economyRate <= '6.99')) {
                                                    points = points + 0;
                                                    erates = 1;
                                                    economy_rate_point = 0;
                                                }
                                                if ((economyRate >= '7') && (economyRate <= '8')) {
                                                    points = points - 2;
                                                    erates = 1;
                                                    economy_rate_point = -2;
                                                }
                                                if ((economyRate >= '8.1') && (economyRate <= '9')) {
                                                    points = points + pointSystem.odiEconomyGt8Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.odiEconomyGt8Runs;
                                                }
                                                if (economyRate > '9') {
                                                    points = points + pointSystem.odiEconomyGt9Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.odiEconomyGt9Runs;
                                                }
                                            }
                                            if (plyrType != 'Bowler') {
                                                if (ballFaced >= 20) {
                                                    if (strikeRate < '40') {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.odiStrikeLt40Runs;
                                                        strike_rate_point = pointSystem.odiStrikeLt40Runs;
                                                    }
                                                    if ((strikeRate >= '40') && (strikeRate <= '49.99')) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.odiStrikeGt40Runs;
                                                        strike_rate_point = pointSystem.odiStrikeGt40Runs;
                                                    }
                                                    if ((strikeRate >= '50') && (strikeRate <= '60')) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.odiStrikeGt50Runs;
                                                        strike_rate_point = pointSystem.odiStrikeGt50Runs;
                                                    }
                                                }
                                            }

                                            points = (Math.round(points));
                                            
                                        }
                                    } else if (player.matchType == 'T20') {
                                        const pointSystem = point_system_obj[1];
                                        const plyrType = (series_players_obj[player.playerId] && series_players_obj[player.playerId].t20 == 'True') ? series_players_obj[player.playerId].player_role : null;

                                        if (pointSystem && plyrType) {
                                            
                                            in_starting = 1;
                                            in_starting_point 			= pointSystem.othersStarting11;
                                            runs_point 				    = pointSystem.battingRun;
                                            fours_point 				= pointSystem.battingBoundary;
                                            sixes_point 				= pointSystem.battingSix;
                                            wickets_point 				= pointSystem.bowlingWicket;
                                            maiden_over_point 			= pointSystem.bowlingMaiden;
                                            catch_point 				= pointSystem.fieldingCatch;
                                            run_outStumping_point 		= pointSystem.fieldingStumpRunOut;
                                            run_out_point 		        = pointSystem.fieldingRunOutThrower;
                                            run_out_point_thrower 		= pointSystem.fieldingRunOutThrower;
                                            run_out_point_catcher 		= pointSystem.fieldingRunOutCatcher;
                                            points = (pointSystem.othersStarting11 + (runScored * pointSystem.battingRun) + (s4 * pointSystem.battingBoundary) + (s6 * pointSystem.battingSix));
    
                                            if ((runScored >= 50) && (runScored <= 99)) {
                                                points = points + pointSystem.battingHalfCentury;
                                                century_halfCentury_point = pointSystem.battingHalfCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if (runScored >= 100) {
                                                points = points + pointSystem.battingCentury;
                                                century_halfCentury_point = pointSystem.battingCentury;
                                                isCenturyHalfCentury = 1;
                                            }
                                            if ((runScored == 0) && (plyrType != 'Bowler') && (player.status != 'Not out' || player.status != 'not out')) {
                                                points = points + pointSystem.battingDuck;
                                                duck_out_point = pointSystem.battingDuck;
                                                duck_out = 1;
                                            }
                                            if (wicketsTaken != '') {
                                                points = points + (wicketsTaken * pointSystem.bowlingWicket);
                                            }
                                            if (wicketsTaken == 4) {
                                                points = points + pointSystem.bowling4Wicket;
                                                bonus_point = pointSystem.bowling4Wicket;
                                                bonus = 1;
                                            }
                                            if (wicketsTaken >= 5) {
                                                points = points + pointSystem.bowling5Wicket;
                                                bonus_point = pointSystem.bowling5Wicket;
                                                bonus = 1;
                                            }
                                            if (maidensOver != '') {
                                                points = points + (maidensOver * pointSystem.bowlingMaiden);
                                            }
    
                                            points = points + (player_catch * pointSystem.fieldingCatch);
                                            points = points + (runOutCount * pointSystem.fieldingStumpRunOut);
                                            points = points + (runOutCount_thrower * pointSystem.fieldingRunOutThrower);
                                            points = points + (runOutCount_catcher * pointSystem.fieldingRunOutCatcher);
                                            points = points + (stampCount * pointSystem.fieldingStumpRunOut);

                                            if (overBowled >= 2) {
                                                if (economyRate < 4) {
                                                    points = points + pointSystem.t20EconomyLt4Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyLt4Runs;
                                                }
                                                if ((economyRate >= 4) && (economyRate <= 4.99)) {
                                                    points = points + pointSystem.t20EconomyGt4Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyGt4Runs;
                                                }
                                                if ((economyRate >= 5) && (economyRate <= 6)) {
                                                    points = points + pointSystem.t20EconomyGt5Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyGt5Runs;
                                                }
                                                if ((economyRate >= 9) && (economyRate <= 10)) {
                                                    points = points + pointSystem.t20EconomyGt9Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyGt9Runs;
                                                }
                                                if ((economyRate >= 10.1) && (economyRate <= 11)) {
                                                    points = points + pointSystem.t20EconomyGt10Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyGt10Runs;
                                                }
                                                if (economyRate > 11) {
                                                    points = points + pointSystem.t20EconomyGt11Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t20EconomyGt11Runs;
                                                }
                                                if ((economyRate >= 8) && (economyRate <= 8.99)) {
                                                    points = points + 0;
                                                    erates = 1;
                                                    economy_rate_point = 0;
                                                }
                        
                                                if ((economyRate > 6) && (economyRate < 8)) {
                                                    points = points + 0;
                                                    erates = 1;
                                                    economy_rate_point = 0;
                                                }
                                            }
                        
                                            if (plyrType != 'Bowler') {
                                                if (ballFaced >= 10) {
                                                    if (strikeRate < 50) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t20StrikeLt50Runs;
                                                        strike_rate_point = pointSystem.t20StrikeLt50Runs;
                                                    }
                                                    if ((strikeRate >= 50) && (strikeRate <= 59.99)) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t20StrikeGt50Runs;
                                                        strike_rate_point = pointSystem.t20StrikeGt50Runs;
                                                    }
                                                    if ((strikeRate >= 60) && (strikeRate <= 70)) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t20StrikeGt60Runs;
                                                        strike_rate_point = pointSystem.t20StrikeGt60Runs;
                                                    }
                                                }
                                            }


                                            points = (Math.round(points));
                                            
                                        }

                                    } else if (player.matchType == 'T10') {
                                        const pointSystem = point_system_obj[4];
                                        const plyrType = (series_players_obj[player.playerId] && series_players_obj[player.playerId].t10 == 'True') ? series_players_obj[player.playerId].player_role : null;

                                        const pointSystem = point_system_obj[1];
                                        const plyrType = (series_players_obj[player.playerId] && series_players_obj[player.playerId].t20 == 'True') ? series_players_obj[player.playerId].player_role : null;

                                        if (pointSystem && plyrType) {
                                            
                                            in_starting = 1;
                                            in_starting_point 			= pointSystem.othersStarting11;
                                            runs_point 				    = pointSystem.battingRun;
                                            fours_point 				= pointSystem.battingBoundary;
                                            sixes_point 				= pointSystem.battingSix;
                                            wickets_point 				= pointSystem.bowlingWicket;
                                            maiden_over_point 			= pointSystem.bowlingMaiden;
                                            catch_point 				= pointSystem.fieldingCatch;
                                            run_outStumping_point 		= pointSystem.fieldingStumpRunOut;
                                            run_out_point 		        = pointSystem.fieldingRunOutThrower;
                                            run_out_point_thrower 		= pointSystem.fieldingRunOutThrower;
                                            run_out_point_catcher 		= pointSystem.fieldingRunOutCatcher;

                                            points = (pointSystem.othersStarting11 + (runScored * pointSystem.battingRun) + (s4 * pointSystem.battingBoundary) + (s6 * pointSystem.battingSix));

                                            if ((runScored >= '30') && (runScored < '50')) {
                                                points = points + pointSystem.t10Bonus30Runs;
                                                isCenturyHalfCentury 	= 1;
                                                century_halfCentury_point = pointSystem.t10Bonus30Runs;
                                            }
                                            if ((runScored >= '50')) {
                                                points = points + pointSystem.t10Bonus50Runs;
                                                isCenturyHalfCentury 	= 1;
                                                century_halfCentury_point = pointSystem.t10Bonus50Runs;
                                            }
                                            if ((runScored == '0') && (plyrType != 'Bowler') && (player.status != 'Not out' && player.status != 'not out')) {
                                                points = points + pointSystem.battingDuck;
                                                duck_out 		= 1;
                                                duck_out_point = pointSystem.battingDuck;
                                            }
                                            if (wicketsTaken != '') {
                                                points = points + (wicketsTaken * pointSystem.bowlingWicket);
                                            }
                                            if (wicketsTaken == '2') {
                                                points = points + pointSystem.t10bowling2Wicket;
                                                bonus_point = pointSystem.t10bowling2Wicket;
                                                bonus = 1;
                                            }
                                            if (wicketsTaken >= '3') {
                                                points = points + pointSystem.t10bowling3Wicket;
                                                bonus_point = pointSystem.t10bowling3Wicket;
                                                bonus = 1;
                                            }
                                            if (maidensOver != '') {
                                                points = points + (maidensOver * pointSystem.bowlingMaiden);
                                            }
                                            points = points + (player_catch * pointSystem.fieldingCatch);
                                            points = points + (runOutCount * pointSystem.fieldingStumpRunOut);
                                            points = points + (runOutCount_thrower * pointSystem.fieldingRunOutThrower);
                                            points = points + (runOutCount_catcher * pointSystem.fieldingRunOutCatcher);
                                            points = points + (stampCount * pointSystem.fieldingStumpRunOut);
                        
                        
                                            if (overBowled >= 1) {
                                                if (economyRate < '6') {
                                                    points = points + pointSystem.t10EconomyLt6Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyLt6Runs;
                                                }
                                                if ((economyRate >= '6') && (economyRate <= '6.99')) {
                                                    points = points + pointSystem.t10EconomyGt6Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyGt6Runs;
                                                }
                                                if ((economyRate >= '7') && (economyRate <= '8')) {
                                                    points = points + pointSystem.t10EconomyBt7_8Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyBt7_8Runs;
                                                }
                                                if ((economyRate >= '8') && (economyRate <= '10.99')) {
                                                    points = points + 0;
                                                    erates = 1;
                                                    economy_rate_point = 0;
                                                }
                                                if ((economyRate >= '11') && (economyRate <= '12')) {
                                                    points = points + pointSystem.t10EconomyBt11_12Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyBt11_12Runs;
                                                }
                                                if ((economyRate >= '12.01') && (economyRate <= '13')) {
                                                    points = points + pointSystem.t10EconomyBt12_13Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyBt12_13Runs;
                                                }
                                                if (economyRate > '13') {
                                                    points = points + pointSystem.t10EconomyGt13Runs;
                                                    erates = 1;
                                                    economy_rate_point = pointSystem.t10EconomyGt13Runs;
                                                }
                                            }
                        
                                            if (plyrType != 'Bowler') {
                                                if (ballFaced >= 5) {
                        
                                                    if (strikeRate < '80') {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t10StrikeLt80Runs;
                                                        strike_rate_point = pointSystem.t10StrikeLt80Runs;
                                                    }
                                                    if ((strikeRate >= '90') && (strikeRate <= '90.99')) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t10StrikeGt90Runs;
                                                        strike_rate_point = pointSystem.t10StrikeGt90Runs;
                                                    }
                                                    if ((strikeRate >= '80') && (strikeRate <= '89.99')) {
                        
                                                        srates = 1;
                                                        points = points + pointSystem.t10StrikeBt80_90Runs;
                                                        strike_rate_point = pointSystem.t10StrikeBt80_90Runs;
                                                    }
                                                }
                                            }

                                            points = (Math.round(points));
                                        }
                                    }

                                    LiveScore.update({_id: player._id}, {$set: {point: points}}, (err) => {
                                        if (err) {
                                            console.error("updatePoints > LiveScore.find > PointSystem.find > SeriesPlayers.find > LiveScore.update > error => ", err)
                                        }
                                    });

                                    const points_breakup_obj = {};
                                    const total_point_add = (in_starting_point + (runScored * runs_point) + (s4 * fours_point) + (s6 * sixes_point) + strike_rate_point + (isCenturyHalfCentury * century_halfCentury_point) + duck_out_point + (wickets_point * wicketsTaken) + (maiden_over_point * maidensOver) + economy_rate_point + bonus_point + (catch_point * player_catch) + (run_outStumping_point * stampCount) + (runOutCount * run_outStumping_point) + (runOutCount_thrower * run_out_point_thrower) + (runOutCount_catcher * run_out_point_catcher));

                                    points_breakup_obj.series_id					=	series_id;
                                    points_breakup_obj.match_id						=	match_key;
                                    points_breakup_obj.player_id					=	player.playerId;
                                    points_breakup_obj.inning_number				=	'1';
                                    points_breakup_obj.in_starting					=	in_starting;
                                    points_breakup_obj.in_starting_point			=	in_starting_point;
                                    points_breakup_obj.runs							=	runScored;
                                    points_breakup_obj.runs_point					=	(runScored * runs_point);
                                    points_breakup_obj.fours						=	s4;
                                    points_breakup_obj.fours_point					=	(s4 * fours_point);
                                    points_breakup_obj.sixes						=	s6;
                                    points_breakup_obj.sixes_point					=	(s6 * sixes_point);
                                    points_breakup_obj.strike_rate					=	srates;
                                    points_breakup_obj.strike_rate_point			=	strike_rate_point;
                                    points_breakup_obj.century_halfCentury			=	isCenturyHalfCentury;
                                    points_breakup_obj.century_halfCentury_point 	=	century_halfCentury_point;
                                    points_breakup_obj.duck_out						=	duck_out;
                                    points_breakup_obj.duck_out_point				=	duck_out_point;
                                    points_breakup_obj.wickets						=	wicketsTaken;
                                    points_breakup_obj.wickets_point				=	(wickets_point * wicketsTaken);
                                    points_breakup_obj.maiden_over					=	maidensOver;
                                    points_breakup_obj.maiden_over_point			=	(maiden_over_point * maidensOver);
                                    points_breakup_obj.economy_rate					=	erates;
                                    points_breakup_obj.economy_rate_point			=	economy_rate_point;
                                    points_breakup_obj.bonus						=	bonus;
                                    points_breakup_obj.bonus_point					=	bonus_point;
                                    points_breakup_obj.catch						=	player_catch;
                                    points_breakup_obj.catch_point					=	(catch_point * player_catch);
                                    points_breakup_obj.run_outStumping				=	stampCount;
                                    points_breakup_obj.run_outStumping_point		=	(run_outStumping_point * stampCount);
                                    points_breakup_obj.run_out						=	runOutCount + runOutCount_thrower + runOutCount_catcher;
                                    points_breakup_obj.run_out_point				=	(run_outStumping_point * runOutCount) + (runOutCount_thrower * run_out_point_thrower) + (runOutCount_catcher * run_out_point_catcher);
                                    points_breakup_obj.total_point					=	total_point_add;

                                    PointsBreakup.update({series_id: series_id, match_id: match_key, player_id: player.playerId}, points_breakup_obj, {upsert: true}, (err) => {
                                        if (err) {
                                            console.error("updatePoints > LiveScore.find > PointSystem.find > SeriesPlayers.find > PointsBreakup.update > error => ", err)
                                        }
                                    })
                                }
                            }
                        });
                    }
                });
            }
        });
    },
    cancelUnconfirmedContest: (series_id, match_key) => {
        
    }, 
    cancelAllContest: (series_id, match_key) => {

    }, 
    getMatchPlayingPlayers: (token, match_key, cb) => {
        var options = {
            'method': 'GET',
            'url': config.CRICKET_API.URL + 'v2/matches/'+match_key+'/squads/?token='+token,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'access_key': config.CRICKET_API.ACCESS_KEY,
                'secret_key': config.CRICKET_API.SECRET_KEY
            }
        };
        request(options, function(error, response) {
            if (error) throw new Error(error);
            console.log(response.body);
            if (response.body && response.body.status && response.body.status === "ok" && response.body.response) {
                const resp = response.body.response;
				const teama_players = resp.teama.squads;
                const teamb_players = resp.teamb.squads;
                let playing_players = [];
                for (let i = 0; i < teama_players.length; i++) {
                    if (teama_players[i] && teama_players[i].playing11 && teama_players[i].playing11 == "true") {
                        playing_players.push(teama_players[i].player_id)
                    }
                }
                for (let i = 0; i < teamb_players.length; i++) {
                    if (teamb_players[i] && teamb_players[i].playing11 && teamb_players[i].playing11 == "true") {
                        playing_players.push(teamb_players[i].player_id)
                    }
                }
                
                return cb(playing_players);
            }
            return cb();
        });
    }, 
    getMatchesDetails: (token, match_key, cb) => {
        var options = {
            'method': 'GET',
            'url': config.CRICKET_API.URL + 'v2/matches/'+match_key+'/scorecard/?token='+token,
            'headers': {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            form: {
                'access_key': config.CRICKET_API.ACCESS_KEY,
                'secret_key': config.CRICKET_API.SECRET_KEY
            }
        };
        request(options, function(error, response) {
            if (error) throw new Error(error);
            console.log(response.body);
            if (response.body && response.body.status && response.body.status === "ok" && response.body.response) {
                return cb(response.body.response);
            }
            return cb();
        });
    }
}