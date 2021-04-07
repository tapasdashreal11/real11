const config = require('../../../config');
const User = require('../../../models/user');
const MatchContest = require('../../../models/match-contest');
const PlayerTeam = require('../../../models/player-team');
const PlayerTeamContest = require('../../../models/player-team-contest');
const ApiUtility = require('../../api.utility');
const ObjectId = require('mongoose').Types.ObjectId;
const moment = require('moment');
const _ = require("lodash");
const redis = require('../../../../lib/redis');
const mqtt = require('../../../../lib/mqtt');
const { toLower } = require('lodash');


module.exports = {
    
    applyContestInviteCode: async (req, res) => {
        try {
            let matchData = {};
            let user_id = req.userId;
            const { invite_code } = req.params;
            let decoded = {
                user_id: user_id,
                invite_code: invite_code,
            }
            if (decoded) {
                // console.log(decoded['invite_code'],toLower(decoded['invite_code']));return false
               let contestCode  = [
                    {'code':'VIKAS877','name':'Vikas'},
                    {'code':'SAURABH11','name':'Surab'}
                  ]
                if (decoded['invite_code'] && decoded['user_id']) {
                    
                    let ddinvite_code = decoded['invite_code'];
                    let codeItem = _.find(contestCode, {code: ddinvite_code.toUpperCase() });
                    if(codeItem && codeItem.code){
                      // work for contest Invite
                      let contestMatch =   await getRedisContestCodeData(toLower(decoded['invite_code']));
                    
                      if(!contestMatch || contestMatch == false) {
                          var regCode = new RegExp(["^", decoded['invite_code'], "$"].join(""), "i");
                          contestMatch = await MatchContest.aggregate([
                              {
                                  $match: { 'invite_code': regCode,is_full:{$ne:1} }
                              },
                              {
                                  $lookup: {
                                      from: 'series_squad',
                                      let: { matchId: "$match_id", sport: "$sport" },
                                      pipeline: [{
                                          $match: {
                                              $expr: {
                                                  $and: [
                                                      { $eq: ["$match_id", "$$matchId"] },
                                                      { $eq: ["$sport", "$$sport"] }
                                                  ]
                                              }
                                          }
                                      }],
                                      as: 'series_squad'
                                  }
                              },
                              {
                                  $unwind: "$series_squad"
                              },
                              { $limit: 1 }
                          ])
                      }
                      
                     
                      if (contestMatch && contestMatch.length === 1) {
                          redis.setRedis("contest-invite-conde-"+ toLower(decoded['invite_code']), contestMatch);
                          contestMatch = contestMatch[0]
                          let authUser = await User.findOne({ '_id': decoded['user_id'] });
                          if (authUser) {
                              if (contestMatch) {
                                  let seriesSquad = contestMatch.series_squad;
                                  let totalContest = seriesSquad.contest_count;
                                  let localTeamFlag = '';
                                  let visitorTeamFlag = '';
  
                                  let finalDate = moment(seriesSquad.time).utc().format(config.DateFormat.date);
                                  let finalTime = moment(seriesSquad.time).utc().format(config.DateFormat.time);
                                  let ctime = Date.now();
                                  let mtime = seriesSquad.time;
                                  
                                  let sdateTime = moment(seriesSquad.time).utc();
                                  let cdateTime = moment(new Date()).utc();
                                  // console.log('seriesSquad',seriesSquad);
                                  var isAfter = moment(sdateTime).isBefore(cdateTime);
                                  // console.log('isAfter',isAfter);
                                  if (isAfter) {
                                      return res.send(ApiUtility.failed('Match has been started.'));
                                  }
  
                                  matchData['series_id'] = contestMatch.series_id;
                                  matchData['match_id'] = contestMatch.match_id;
                                  matchData['series_name'] = seriesSquad.series_name ? seriesSquad.series_name : '';
                                  matchData['local_team_id'] = contestMatch.localteam_id;
                                  matchData['local_team_name'] = seriesSquad.localteam_short_name ? seriesSquad.localteam_short_name : contestMatch.localteam;
                                  matchData['local_team_flag'] = localTeamFlag;
                                  matchData['visitor_team_id'] = contestMatch.visitorteam_id;
                                  matchData['visitor_team_name'] = seriesSquad.visitorteam_short_name ? seriesSquad.visitorteam_short_name : contestMatch.visitorteam;
                                  matchData['visitor_team_flag'] = visitorTeamFlag;
                                  matchData['star_date'] = finalDate;
                                  matchData['star_time'] = finalTime;
                                  matchData['total_contest'] = totalContest ? totalContest : 0;
                                  matchData['sport'] = contestMatch.sport;
                                  // console.log("contestMatch",contestMatch);
                                  if (contestMatch.contest) {
                                      matchData['contest_id'] = contestMatch.contest_id;
                                      matchData['category_id'] = contestMatch.category_id;
                                      let myTeamIds = [];
                                      let teamsJoined = await PlayerTeamContest.find({'match_id': seriesSquad.match_id, 'contest_id': contestMatch.contest._id, 'user_id': decoded['user_id'], 'sport':contestMatch.sport }, { player_team_id: 1 });
  
                                      if (teamsJoined) {
                                          for (const joined of teamsJoined) {
                                              myTeamIds.push(joined.player_team_id);
                                          }
                                      }
                                      matchData['is_joined'] = (teamsJoined && teamsJoined.length > 0) ? true : false;
                                      matchData['my_teams_count'] = 0;
                                      matchData['my_team_ids'] = myTeamIds;
                                      
                                      return res.send(ApiUtility.success(matchData));
                                  } else {
                                      return res.send(ApiUtility.failed("Data not found"));
                                  }
                                  
                              } else {
                                  return res.send(ApiUtility.failed('The unique code looks invalid! Please check again.'));
                              }
                          } else {
                              return res.send(ApiUtility.failed("Security check failed."));
                          }
                      } else {
                          return res.send(ApiUtility.failed("Data not found"));
                      }

                    } else {
                        return res.send(ApiUtility.failed("Invalid Code!!"));
                    }
                    
                } else {
                    return res.send(ApiUtility.failed('Invalid user id.'));
                }
            } else {
                return res.send(ApiUtility.failed('Please check if invite code or user id is empty'));
            }
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
}


async function getRedisContestCodeData(inviteCode) {
    try {
        // inviteCode =    inviteCode.toLower();
        // console.log(inviteCode);return false;
        return new Promise(async (resolve, reject) => {
            let redisKey = 'contest-invite-conde-' + inviteCode;
            await redis.getRedis(redisKey, function (err, contestData) {
                if (contestData) {
                    return resolve(contestData);
                } else {
                    return resolve(false);
                }
            })
        });
    } catch (error) {
        console.log('redis contest invite code > ', error);
    }
}
