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
        //console.log('call in redis***');
        const { match_id,sport } = req.params;
        const user_id = req.userId;
        let match_sport = sport ? parseInt(sport) : 1;
        let filter = {
            "match_id": parseInt(match_id),
            "sport":match_sport,
            is_full: { $ne: 1 }
        }; 
        let queryArray =[
            (new ModelService(Category)).getMatchContestLatest({status:1}, filter, 5)
        ];
        if (user_id) {
            queryArray.push(
                PlayerTeam.find({ user_id: user_id, match_id: match_id,sport: match_sport }).countDocuments(),
                PlayerTeamContest.find({ user_id: ObjectId(user_id), match_id: parseInt(match_id),sport:match_sport },{_id:1,contest_id:1,player_team_id:1}).exec()
            )
        }
        const mcResult = await Promise.all(queryArray);
        if(mcResult && mcResult.length>0){
            let myTeamsCount = 0;
            let myContestCount = [];
            let match_contest_data = mcResult && mcResult[0] ? mcResult[0]:[]
            let userTeamIds = {};
            let joinedContestIds = [];
            let joinedTeamsCount = {};
            if (user_id) {
                myTeamsCount = mcResult && mcResult[1] ? mcResult[1]:0;
                myContestCount = mcResult && mcResult[2] ? mcResult[2]:[];
                //console.log(myContestCount);
                
            
                const contestGrpIds = myContestCount && myContestCount.length >0 ? _.groupBy(myContestCount,'contest_id'):{};
                joinedContestIds = myContestCount && myContestCount.length >0 ? _.uniqWith( _.map(myContestCount, 'contest_id'),_.isEqual):[];
                
                redis.redisObj.set('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, myTeamsCount);
                redis.redisObj.set('user-contest-count-' + match_id + '-' + match_sport + '-' + user_id, joinedContestIds.length || 0);

                for(const contsIds of joinedContestIds){
                    userTeamIds[contsIds] = contestGrpIds[contsIds];
                 }
            }
            
            for (const matchContests of match_contest_data) {
                for (const contest of matchContests.contests) {
                    joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                    contest.my_team_ids = myContestCount && _.filter(myContestCount,{contest_id:contest.contest_id})?_.filter(myContestCount,{contest_id:contest.contest_id}):[];
                }
            }
            redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
            redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(Helper.parseUserTeams(userTeamIds)));
            redis.redisObj.set('user-contest-joinedContestIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(joinedContestIds));
            redis.setRedis(RedisKeys.MATCH_CONTEST_LIST + req.params.match_id, match_contest_data);
            var finalResult = ApiUtility.success({
                match_contest: match_contest_data,
                my_teams: myTeamsCount,
                my_contests: joinedContestIds.length || 0,
                joined_contest_ids: joinedContestIds,
                user_team_ids: Helper.parseUserTeams(userTeamIds),
                joined_teams_count: Helper.parseContestTeamsJoined(joinedTeamsCount)
            });
            return res.send(finalResult);
        } else {
           return res.send(ApiUtility.failed('Something went wrong!!'));
        }

      } catch(error){
            return res.send(ApiUtility.failed('Something went wrong!!'));
    }

}