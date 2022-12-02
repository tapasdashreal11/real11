// const config = require('../../config');
const User = require('../../../models/user');
const SeriesSquad = require('../../../models/series-squad');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const ApiUtility = require('../../api.utility');

const ObjectId = require('mongoose').Types.ObjectId;
const _ = require("lodash");
const s3Helper = require('../common/s3-helper');
const redis = require('../../../../lib/redis');
const redisKeys = require('../../../constants/redis-keys');
const redisEnt = require('../../../../lib/redisEnterprise');

async function switchTeamFn(id, team_id,count) {
    try {
        if(!_.isNull(team_id) && !_.isNull(id)){
            await PlayerTeamContest.findByIdAndUpdate(ObjectId(id), { "player_team_id": team_id,"team_count":count }, { new: true });
        }
        
    } catch (error) {

    }
}

module.exports = {
    switchTeamRedisEnt: async (req, res) => {
        try {
            const user_id = req.userId;
            const { match_id, series_id, contest_id, team_id } = req.body;
            let decoded = {
                match_id,
                series_id,
                contest_id,
                team_id,
                user_id
            };
            // console.log(sport);return false
            if (decoded['user_id'] && decoded['match_id'] && decoded['series_id'] && decoded['contest_id'] && decoded['team_id']) {
                let authUser = await User.findOne({ '_id': decoded['user_id'] });
                if (authUser) {
                    let liveMatch = await SeriesSquad.findOne({ 'match_id': decoded['match_id'], 'series_id': decoded['series_id'] });
                    
                    if (liveMatch) {
                        let ctime = new Date();
                        let mtime = liveMatch.time;
                        let sport = liveMatch && liveMatch.sport ? liveMatch.sport:1;
                        if (mtime < ctime) {
                            return res.send(ApiUtility.failed('Match Already Closed '));
                        }

                        if (decoded['team_id'] && decoded['team_id'].length > 0) {
                            var filter = {
                                'match_id': decoded['match_id'],
                                'series_id': decoded['series_id'],
                                'contest_id': decoded['contest_id'],
                                'user_id': decoded['user_id']
                            }
                            
                            var pleasrTeamData = await PlayerTeamContest.find(filter);
                            /** get data from redis first and s3 bucket if not found in redis */
                            let joinedTeamKey = `${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`;
                            let s3Key = match_id+"_"+sport+"/"+match_id + "_" + sport + "_" + user_id + "_";

                            let getData = [];
                            try {
                                getData = await redisEnt.getHashRedis(joinedTeamKey) //data from redis
                                if(_.isEmpty(getData)) {
                                    getData = await s3Helper.multipleUserTeamS3Bucket(s3Key, match_id,user_id,sport) // team by s3 bucket
                                }
                            } catch(error) {
                                return res.send(ApiUtility.failed(error.message));
                            }
                            /** get data from redis first and s3 bucket if not found in redis */
                            let teamIds =   [];
                            _.forEach(pleasrTeamData, async function (i, k) {
                                var pT = {};
                                if(getData) {
                                    let teamRes = _.find(getData, { '_id': decoded['team_id'][k] });
                                    if(typeof teamRes === 'object' && teamRes !== null) {
                                        pT = teamRes
                                    }
                                } else {
                                    pT = await PlayerTeam.findOne({'_id':decoded['team_id'][k]});
                                }
                                var count =  pT && pT.team_count ? pT.team_count:1;
                                // console.log(count);
                                await switchTeamFn(i._id, decoded['team_id'][k],count);
                                teamIds.push({"player_team_id": decoded['team_id'][k]});
                                if (k === (decoded['team_id'].length - 1)) {
                                    const matchContest = await MatchContest.findOne({ 'match_id': decoded['match_id'], 'sport': sport, 'contest_id': decoded['contest_id'] });
                                    if (matchContest && matchContest.category_slug && (_.isEqual(matchContest.category_slug, 'head-to-head') || _.isEqual(matchContest.category_slug, 'last-man-standing'))) {
                                       if(matchContest.is_full){
                                        let leaderboardKey = 'leaderboard-' + matchContest.sport + '-' + decoded['match_id'] + '-' + decoded['contest_id'];
                                        let allTeams = await PlayerTeamContest.find({
                                            match_id: decoded['match_id'],
                                            sport: matchContest.sport,
                                            contest_id: decoded['contest_id'] ,
                                            }).limit(10).sort({ _id: -1 });
                                           if (matchContest.contest && matchContest.contest.contest_size == allTeams.length) {
                                             await redis.setRedisLeaderboard(leaderboardKey, allTeams);
                                           }
                                        }
                                    }
                                    let myJoinedContestListKey = "joined-contest-list-" + match_id + "-" + series_id + "-" + user_id;
                                    let joindedContestlistdata = await getPromiseUserJoinedContestList(myJoinedContestListKey);
                                    if(joindedContestlistdata && joindedContestlistdata.joined_contest) {
                                        let currentContest = _.find(joindedContestlistdata.joined_contest, {"contest_id": contest_id});
                                        console.log("currentContest:", currentContest)
                                        if(currentContest && currentContest.my_team_ids) {
                                            currentContest.my_team_ids  =   teamIds;
                                        }
                                    }
                                    redis.setRedis(myJoinedContestListKey, joindedContestlistdata)
                                    console.log(teamIds,myJoinedContestListKey);
                                    
                                    return res.send(ApiUtility.success({}, "Team switched successfuly."));
                                }
                            });
                        } else {
                            return res.send(ApiUtility.failed('Please select Valid Team.'));
                        }
                    }
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed('Please check user id, match id, series id, contest id or team ids are blank.'));
            }
        } catch (error) {
            //////////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },

}

async function getPromiseUserJoinedContestList(key) {
    return new Promise((resolve, reject) => {
        redis.getRedisMyMatches(key, async (err, data) => {
            if (data == null) {
                data = {};
            }
            resolve(data)
        })
    })
}