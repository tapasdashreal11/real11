// const db = require('../db').getMongo();
const util = require('./util');
const _ = require("lodash")

export const setRank = (db) => {
    const SeriesSquad = db.collection("series_squad")
    const LiveScore = db.collection("live_score")
    const PlayerTeams = db.collection("player_teams")
    const PlayerTeamContests = db.collection("player_team_contests")
    const newDate = new Date()
    SeriesSquad.find({
        'date': { $lte: newDate },
        status: 1,
        match_status: { $nin: ['Not Started', 'Cancelled'] },
        win_flag: 0
    }, { projection: { _id: 0, series_id: 1, match_id: 1 } }, (err, matches) => {
        if (err) {
            console.error(" setRank > SeriesSquad.find > error => ", err);
        }
        if (!_.isEmpty(matches)) {
            
            for (const matche of matches) {
                const seriesId		=	matche.series_id
                // const match		    =	matche.match
                const matcheId		=	matche.match_id
                
                LiveScore.find({matchId: matcheId}, { projection: { _id: 0, playerId: 1, point: 1, matchId: 1 } }, (err, liveScores) => {
                    if (err) {
                        console.error(" setRank > SeriesSquad.find > LiveScore.find > error => ", err);
                    }
                    if (!_.isEmpty(liveScores)) {

                        const liveScoresObj = {}
                        for (let lsIndex = 0; lsIndex < liveScores.length; lsIndex++) {
                            if (liveScores[lsIndex] && liveScores[lsIndex].playerId) {
                                liveScoresObj[liveScores[lsIndex].playerId] = liveScores[lsIndex];
                            }
                        }
                        if (!_.isEmpty(liveScoresObj)) {
                            PlayerTeams.find({match_id: matcheId}, { projection: { _id: 1, captain: 1, vice_captain: 1, players: 1 } }, (err, playerTeams) => {
                                if (err) {
                                    console.error(" setRank > SeriesSquad.find > LiveScore.find > PlayerTeams.find > error => ", err);
                                }
                                if (!_.isEmpty(playerTeams)) {
                                    const playerTeamsObj = {} 
                                    for (const playerTeam of playerTeams) {
                                        if (playerTeam && playerTeam._id && playerTeam.captain && playerTeam.vice_captain && playerTeam.players) {
                                            const players = playerTeam.players.split(",")
                                            const points = 0
                                            if (players && players.length > 0) {
                                                for (const player of players) {
                                                    if (liveScoresObj[player]) {
                                                        if (player == playerTeam.captain) {
                                                            points = points + (liveScoresObj[player].point * 2)
                                                        } else if (player == playerTeam.vice_captain) {
                                                            points = points + (liveScoresObj[player].point * 1.5)
                                                        } else {
                                                            points = points + liveScoresObj[player].point
                                                        }
                                                    }
                                                }
                                            }
                                            playerTeamsObj[playerTeam._id] = points
                                            PlayerTeams.update({_id: playerTeam._id}, {$set: {points: points}}, (err, result) => {
                                                if (err) { console.error(" setRank > SeriesSquad.find > LiveScore.find > PlayerTeams.find > PlayerTeams.update > error => ", err); }
                                            });
                                        }
                                    }

                                    if (!_.isEmpty(playerTeamsObj)) {
                                        PlayerTeamContests.aggregate([
                                            { 
                                                "$match": { 
                                                    match_id: matcheId, 
                                                    series_id: seriesId 
                                                } 
                                            },
                                            { 
                                                $group : {
                                                    _id : "$contest_id",
                                                    contest: { $push : "$$ROOT" }
                                                }
                                            }
                                        ], (err, playerTeamContests) => {
                                            if (err) {
                                                console.error(" setRank > SeriesSquad.find > LiveScore.find > PlayerTeams.find >  PlayerTeamContests.aggregate > error => ", err);
                                            }
                                            if (!_.isEmpty(playerTeamContests)) {
                                                for (const playerTeamContest of playerTeamContests) {
                                                    if (playerTeamContest && playerTeamContest.contest) {
                                                        let contest = playerTeamContest.contest
                                                        if (!_.isEmpty(contest)) {
                                                            for (let index = 0; index < contest.length; index++) {
                                                                contest[index].points = 0
                                                                if (contest[index].player_team_id && playerTeamsObj[contest[index].player_team_id]) {
                                                                    contest[index].points =  playerTeamsObj[contest[index].player_team_id].points
                                                                }
                                                            }
                                                            contest = util.sortByDesc(contest, 'points')
                                                            let contestG = util.groupBy(contest, 'points')
                                                            
                                                            let counterRank = 1
                                                            let counter	    = 1
                                                            for (const key in contestG) {
                                                                counterRank = counter;
                                                                if (contestG.hasOwnProperty(key)) {
                                                                    const rankTeams = contestG[key];
                                                                    for (const rankTeam of rankTeams) {
                                                                        PlayerTeamContests.update({_id: rankTeam._id}, {$set: {previous_rank:rankTeam.rank, rank:  counterRank, counter:  counter}}, (err, result) => {
                                                                            if (err) { console.error(" setRank > SeriesSquad.find > LiveScore.find > PlayerTeams.find >  PlayerTeamContests.aggregate > PlayerTeamContests.update > error => ", err); }
                                                                        });
                                                                        counter++
                                                                    }
                                                                    
                                                                }
                                                            }
                                                        }

                                                    }
                                                }
                                            }

                                        })
                                    }

                                }
                            })
                        }
                        
                    } else {
                        console.log(" setRank > SeriesSquad.find > LiveScore.find liveScores not fount.");
                    }
                })
            }
        } else {
            console.log(" setRank > SeriesSquad.find > matches not fount.");
        }
        
    });

    

}