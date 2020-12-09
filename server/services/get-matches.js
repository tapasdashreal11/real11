const request = require('request');
const Promise = require('bluebird');
const moment = require('moment');
const util = require('./util');
const config = require('../config');


module.exports = {
    getMatches: (db) => {
        console.log("Get Matches")
        const Series = db.collection("series");
        const SeriesSquad = db.collection("series_squad");
        const MstTeams = db.collection("mst_teams");
        util.genrateToken((token) => {
            if (token) {
                this.getMatchList(token, (matchlist)=> {
                    if (matchlist && matchlist.length > 0) {
                        for (const match of matchlist) {

                            const match_id = match.match_id;
                            const name = match.title;
                            const short_name = match.short_title;
                            let format =  'other';
                            if (match.format == 1 || match.format == 4 || match.format == 5 || match.format == 7 || match.format == 9) {
                                format = 'ODI';
                            } else if (match.format == 3 || match.format == 6 || match.format == 8 || match.format == 10) {
                                format = 'T20';
                            } else if (match.format == 2) {
                                format = 'TEST';
                            } else {
                                format = 'other';
                            }
                            //Get Teams
                            const team1id = match.teama.team_id;
                            const team2id = match.teamb.team_id;

                            //Get Teams
                            const team1 = {
                                team_id:team1id,
                                team_name: match.teama.name,
                                team_short_name: match.teama.short_name,
                            };
                            const team2 = {
                                team_id: team2id,
                                team_name: match.teamb.name,
                                team_short_name: match.teamb.short_name,
                            };
                            //Get Series
                            const series_id = match.competition.cid;
                            const season = match.competition.title;
                            const series = {
                                file_path: '',
                                id_api: series_id,
                                name: season,
                                squads_file: '',
                                short_name: season,
                            };
                            const matchData = {
                                series_id: series_id,
                                date: moment(match.date_start).format(config.DateFormat.date),
                                time: moment(match.date_start).format(config.DateFormat.time),
                                type: format,
                                match_id: match_id,
                                localteam: match.teama.name,
                                localteam_id: team1id,
                                visitorteam: match.teamb.name,
                                visitorteam_id: team2id,
                                status: 0,
                                match_status: 'Not Started',
                                win_flag: '0',
                            }

                            Promise.all([
                                MstTeams.update({team_id: team1.team_id}, team2, {upsert: true}), 
                                MstTeams.update({team_id: team1.team_id}, team2, {upsert: true}),
                                Series.update({id_api: series_id}, series, {upsert: true}),
                            ]).then((results) => {
                                SeriesSquad.update({series_id: series_id, match_id: match_id}, matchData, {upsert: true}, (error, result)=> {
                                    if (error) {
                                        console.error("getMatches SeriesSquad.update error =>", error)
                                    }
                                })

                            }).catch((error)=> console.error("getMatches Promise.all error =>", error))

                        }
                    }
                })
            }
        })
    },
    getMatchList: (token, cb) => {
        var options = {
            'method': 'GET',
            'url': config.CRICKET_API.URL + 'v2/matches/?token='+token+'&status=1&per_page=50&paged=1',
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
            if (response.body && response.body.status && response.body.status === "ok" && response.body.response && response.body.response.items) {
                return cb(response.body.response.items);
            }
            return cb();
        });
    }
}