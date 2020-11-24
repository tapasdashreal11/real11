const request = require('request');
const config = require('../config');

module.exports = {
    groupBy: (array, key) => {
        return array.reduce(function(rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
    },
    sortBy: (objs, key) => {
        function compare(a, b) {
            if (a[key] < b[key]) {
                return -1;
            }
            if (a[key] > b[key]) {
                return 1;
            }
            return 0;
        }
        return objs.sort(compare);
    },
    sortByDesc: (objs, key) => {
        function compare(a, b) {
            if (a[key] > b[key]) {
                return -1;
            }
            if (a[key] < b[key]) {
                return 1;
            }
            return 0;
        }
        return objs.sort(compare);

    },
    setMongoIndex: (db) => {
        db.collection("series_squad").createIndex({series_id:-1, match_id:-1, date: -1, match_status: -1 })
        db.collection("series").createIndex({ id_api: -1 })
        db.collection("live_score").createIndex({ seriesId: -1, matchId: -1, playerId: -1 })
        db.collection("player_teams").createIndex({ match_id: -1 })
        db.collection("mst_teams").createIndex({ team_id: -1 })
        db.collection("player_team_contests").createIndex({ match_id: -1, series_id: -1, contest_id: -1 })
    },

    genrateToken: (cb) => {

        var options = {
            'method': 'POST',
            'url': config.CRICKET_API.URL + 'v2/auth',
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
            if (response.body && response.body.status && response.body.status === "ok" && response.body.response && response.body.response.token) {
                return cb(response.body.response.token);
            }
            return cb();
        });
    }
}