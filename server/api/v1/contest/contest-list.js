const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const Category = require('../../../models/category');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const { RedisKeys } = require('../../../constants/app');
const ModelService = require("../../ModelService");
const UserAnalysis = require("../../../models/user-analysis");
const FavouriteContest = require("../../../models/favourite-contest");
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const Helper = require('./../common/helper');
module.exports = async (req, res) => {
    try {
        const { match_id, sport,series_id } = req.params;
        const user_id = req.userId;
        let match_sport = sport ? parseInt(sport) : 1;
        let match_series_id = series_id ? parseInt(series_id) : 1;
        let filter = {
            "match_id": parseInt(match_id),
            "sport": match_sport,
            is_full: { $ne: 1 }
        };
        let userCategory = {is_super_user : 0,is_dimond_user : 0,is_beginner_user :0
        };
        let queryArray = [
            (new ModelService(Category)).getMatchContestLatest({ status: 1 }, filter, 5)
        ];
        if (user_id) {
            let redisKeyForUserCategory = 'user-category-' + user_id;
            queryArray.push(
                PlayerTeam.find({ user_id: user_id, match_id: parseInt(match_id), sport: match_sport }).countDocuments(),
                PlayerTeamContest.find({ user_id: ObjectId(user_id), match_id: parseInt(match_id), sport: match_sport }, { _id: 1, contest_id: 1, player_team_id: 1 }).exec(),
                getPromiseForAnalysis(redisKeyForUserCategory, userCategory)
            )
        }
        const mcResult = await Promise.all(queryArray);
        if (mcResult && mcResult.length > 0) {
            let myTeamsCount = 0;
            let myContestCount = [];
            
            let match_contest_data = mcResult && mcResult[0] ? mcResult[0] : []
            let userTeamIds = {};
            let joinedContestIds = [];
            let joinedTeamsCount = {};
            let userFavouriteContest = {};
           
            if (user_id) {
                myTeamsCount = mcResult && mcResult[1] ? mcResult[1] : 0;
                myContestCount = mcResult && mcResult[2] ? mcResult[2] : [];
                 userCategory = mcResult && mcResult.length > 3 && mcResult[3] ? JSON.parse(JSON.stringify(mcResult[3]))  : userCategory;
                console.log('userCategory*****',userCategory);
                const contestGrpIds = myContestCount && myContestCount.length > 0 ? _.groupBy(myContestCount, 'contest_id') : {};
                joinedContestIds = myContestCount && myContestCount.length > 0 ? _.uniqWith(_.map(myContestCount, 'contest_id'), _.isEqual) : [];

                redis.redisObj.set('user-teams-count-' + match_id + '-' + match_sport + '-' + user_id, myTeamsCount);
                redis.redisObj.set('user-contest-count-' + match_id + '-' + match_sport + '-' + user_id, joinedContestIds.length || 0);

                for (const contsIds of joinedContestIds) {
                    userTeamIds[contsIds] = contestGrpIds[contsIds];
                }
            }

            let redisKeyForFavouriteContest = 'favourite-contest-' + user_id;
            try {
                await redis.getRedisFavouriteContest(redisKeyForFavouriteContest, async (err, favData) => {
                    if (favData) {
                        userFavouriteContest = favData;
                        console.log('data redis favData****',favData,'match',match_id);
                        if(userFavouriteContest && userFavouriteContest._id && userFavouriteContest.contest_data && userFavouriteContest.contest_data.length){
                            for (const cData of userFavouriteContest.contest_data) {
                                cData.contest_id = ObjectId(cData.contest_id)
                            }
                        }
                    } else {
                        if (user_id) {
                            let userFavouriteConetsData = await FavouriteContest.findOne({ user_id: user_id, status: 1 });
                            if (userFavouriteConetsData && userFavouriteConetsData._id) {
    
                                redis.setRedisFavouriteContest(redisKeyForFavouriteContest, userFavouriteConetsData);
                                userFavouriteContest = userFavouriteConetsData;
                            } else {
                                //redis.setRedisFavouriteContest(redisKeyForFavouriteContest, {});
                                userFavouriteContest = {};
                            }
                        }
                    }
                    
                    for (const matchContests of match_contest_data) {
                        for (const contest of matchContests.contests) {
                            joinedTeamsCount[contest.contest_id] = contest.teams_joined || 0;
                            contest.my_team_ids = []; //myContestCount && _.filter(myContestCount, { contest_id: contest.contest_id }) ? _.filter(myContestCount, { contest_id: contest.contest_id }) : [];
                            //contest.is_favourite = userFavouriteContest && userFavouriteContest._id && userFavouriteContest.contest_data && userFavouriteContest.contest_data.length > 0 && _.find(userFavouriteContest.contest_data, { contest_id: contest.contest_id }) ? true : false;
                        }
                    }
                    redis.redisObj.set(`${RedisKeys.CONTEST_JOINED_TEAMS_COUNT}${match_id}`, JSON.stringify(joinedTeamsCount));
                    redis.redisObj.set('user-contest-teamIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(Helper.parseUserTeams(userTeamIds)));
                    redis.redisObj.set('user-contest-joinedContestIds-' + user_id + '-' + req.params.match_id + '-' + match_sport, JSON.stringify(joinedContestIds));
                    redis.setRedis(RedisKeys.MATCH_CONTEST_LIST + req.params.match_id, match_contest_data);
                    let newMatchContestData = match_contest_data;
                    try{
                         newMatchContestData = _.reject(newMatchContestData, function(e) {
                             console.log('e*********',e.category_id);
                            return (ObjectId(e.category_id).equals(ObjectId('600a7d84a3d2553aa779eae7')) && userCategory.is_beginner_user == 0 ) &&
                            (ObjectId(e.category_id).equals(ObjectId('600a7dfaa3d2553aa779eae8')) && userCategory.is_super_user == 0 )
                        });
                    }catch(eerrrr){}
                   
                    let resObj = {
                        match_contest: newMatchContestData,
                        my_teams: myTeamsCount,
                        my_contests: joinedContestIds.length || 0,
                        joined_contest_ids: joinedContestIds,
                        user_team_ids: Helper.parseUserTeams(userTeamIds),
                        joined_teams_count: Helper.parseContestTeamsJoined(joinedTeamsCount),
                        user_rentation_bonous: {},
                        user_favourite_contest: userFavouriteContest || {}
                    };
                    let redisKeyForUserAnalysis = 'app-analysis-' + user_id + '-' + match_id +  '-' + match_sport;
                    try {
                        redis.getRedisForUserAnaysis(redisKeyForUserAnalysis, async (err, data) => {
                            if (data) {
                                resObj['user_rentation_bonous'] = data;
                                console.log('data redis****',data,'match',match_id);
                            } else {
                                let fileds = { match_name: 1, match_id: 1, user_id: 1, series_id: 1, is_offer_type: 1, contest_ids: 1, sport: 1, offer_amount: 1, offer_percent: 1 };
                                let userAnalysisData = await UserAnalysis.findOne({ user_id: user_id, match_id: parseInt(match_id), sport: match_sport }, fileds);
                                if (userAnalysisData && userAnalysisData._id) {
                                    userAnalysisData.offer_amount = userAnalysisData.offer_amount ? parseFloat(userAnalysisData.offer_amount) : 0;
                                    userAnalysisData.offer_percent = userAnalysisData.offer_percent ? parseFloat(userAnalysisData.offer_percent) : 0;
                                    redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, userAnalysisData);
                                    resObj['user_rentation_bonous'] = userAnalysisData;
                                } else {
                                    //redis.setRedisForUserAnaysis(redisKeyForUserAnalysis, {});
                                    resObj['user_rentation_bonous'] = {};
                                }
                            }
                            var finalResult = ApiUtility.success(resObj);
                            return res.send(finalResult);
                        });
                    } catch (err) {
                        var finalResult = ApiUtility.success(resObj);
                        return res.send(finalResult);
                    }


                });
            } catch (errs) {
                console.log('contest list error in catch',errs);
                return res.send(ApiUtility.failed('Something went wrong!!'));
            }

        } else {
            return res.send(ApiUtility.failed('Something went wrong!!'));
        }

    } catch (error) {
        console.log('contest list error in catch',error);
        return res.send(ApiUtility.failed('Something went wrong!!'));
    }

}

async function getPromiseForAnalysis(key, defaultValue){
    return new Promise((resolve, reject) => {
        redis.userAnalysisRedisObj.get(key, (err, data) => {
            if (err) { 
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue
            }
            resolve(data)
        })
    })
}