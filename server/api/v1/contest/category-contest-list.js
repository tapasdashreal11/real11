const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const Category = require('../../../models/category');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const { RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const Helper = require('./../common/helper');
module.exports = async (req, res) => {
    try {
        let data = [];
        let data1 = {};
        var user_id = req.userId;
        const { match_id, category_id ,sport } = req.params;
        let match_sport = sport ? parseInt(sport) : 1;
        var finalResult = {};
        var match_contest_dataall = [];         
        if (category_id) {
            
            let filter = {
                "match_id": parseInt(match_id),
                "sport":match_sport,
                is_full: { $ne: 1 }
            };
            var match_contest_data = await (new ModelService(Category)).getMatchContest({ "_id": ObjectId(category_id) }, filter, user_id, 100);
            redis.setRedis(RedisKeys.MATCH_CONTEST_LIST_CATEGORY + match_id + category_id, match_contest_data);
            var match_contest_dataallmatch = await (new ModelService(Category)).getMatchContest({}, filter, user_id, 10, true);
            match_contest_dataall = match_contest_dataallmatch;
        } else if (match_id) {
            //console.log('** Not From Redis ***');
            let filter = {
                "match_id": parseInt(match_id),
                "sport":match_sport,
                is_full: { $ne: 1 }
            };
            var match_contest_data = await (new ModelService(Category)).getMatchContest({ status: 1 }, filter, user_id, 10, true);
            redis.setRedis(RedisKeys.MATCH_CONTEST_All_LIST + match_id, match_contest_data);

            let userTeamIds = {};
            let joinedContestIds = [];
            let joinedTeamsCount = {};
            for (const matchContests of match_contest_data) {
                ////////console.log("matchContests.contests", matchContests.contests.length)
                for (const contest of matchContests.contests) {
                    joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                    if (contest.my_team_ids && contest.my_team_ids.length > 0) {
                        userTeamIds[contest.contest_id] = contest.my_team_ids;
                    }
                }
            }

            redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
            redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(Helper.parseUserTeams(userTeamIds)));

            finalResult['user_team_ids'] = Helper.parseUserTeams(userTeamIds),
                finalResult['joined_teams_count'] = Helper.parseContestTeamsJoined(joinedTeamsCount)
            match_contest_dataall = match_contest_data;

        }

        var myContestCount = 0;
        var myTeamsCount = 0;

        if (user_id) {
            myTeamsCount = await PlayerTeam.find({ 'user_id': user_id, 'match_id': match_id,'sport':match_sport }).countDocuments();
            myContestCount = await PlayerTeamContest.aggregate([{
                $match: { 'user_id': user_id, 'match_id': parseInt(match_id),'sport':match_sport }
            },
            {
                $group: { _id: "$contest_id", count: { $sum: 1 } }
            }
            ]);
            redis.redisObj.set('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, myTeamsCount);
            redis.redisObj.set('user-contest-count-' + match_id + '-' + match_sport + '-' + user_id, myContestCount.length);
        }

        let userTeamIds = {};
        let joinedContestIds = [];
        let joinedTeamsCount = {};
        for (const matchContests of match_contest_dataall) {
            ////////console.log("matchContests.contests", matchContests.contests.length)
            for (const contest of matchContests.contests) {
                joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                if (contest.my_team_ids && contest.my_team_ids.length > 0) {
                    userTeamIds[contest.contest_id] = contest.my_team_ids;
                }
            }
        }

        joinedContestIds = _.map(myContestCount, '_id');
        redis.redisObj.set('user-contest-joinedContestIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(joinedContestIds));
        redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
        redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(Helper.parseUserTeams(userTeamIds)));

        finalResult['user_team_ids'] = Helper.parseUserTeams(userTeamIds),
        finalResult['joined_teams_count'] = Helper.parseContestTeamsJoined(joinedTeamsCount)
        finalResult['match_contest'] = match_contest_data;
        finalResult['total'] = match_contest_data.length;
        finalResult['my_teams'] = myTeamsCount;
        finalResult['joined_contest_ids'] = joinedContestIds;
        finalResult['my_contests'] = (myContestCount && myContestCount.length > 0) ? myContestCount.length : 0;
        res.send(ApiUtility.success(finalResult));
       
    } catch (error) {
        console.log("error categoryContestList", error);
        return res.send(ApiUtility.failed(error.message));
    }

}