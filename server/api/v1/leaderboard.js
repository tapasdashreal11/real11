const config = require('../../config');
const AWS = require('aws-sdk');
const AmazonDaxClient = require('amazon-dax-client');
const ApiUtility = require('../api.utility');
const { RedisKeys } = require('../../constants/app');
const redis = require('../../../lib/redis');
const User = require('../../models/user');
const Contest = require('../../models/contest');
const MatchContest = require('../../models/match-contest');
const PlayerTeam = require('../../models/player-team');
const PlayerTeamContest = require('../../models/player-team-contest');
const moment = require('moment');

AWS.config.update(config.aws_remote_config);
 
var ddbClient = new AWS.DynamoDB.DocumentClient()
var daxClient = null;

let end = config.dynomoEndpoint;

//var dax = new AmazonDaxClient({endpoints: [end], region: "ap-south-1"})
//daxClient = new AWS.DynamoDB.DocumentClient({service: dax });

// console.log("data cmooingon dexclient", daxClient)
var docClient = daxClient != null ? daxClient : ddbClient;

const getMatchStatus = async (match_id) => {

    const params = {
        KeyConditionExpression: 'match_id =:match_id',
        IndexName:"match_id-index",
        ExpressionAttributeValues: {
            ':match_id': Number(match_id)
        },

        TableName: config.series_squad_table
    };
    // console.log("gos insdie the logs-------------", docClient)
    var result = await docClient.query(params).promise()
    // console.log('match_status',result);
    if (result.Items && result.Items.length > 0) {
        let match_s = result.Items[0].match_status
        return match_s
        // return [match_s, result.Items[0]]
    }
    else {
        return [false, false]
    }
}

const getUserTeamByMatchId =async (match_id, contest_id, user_id)=>{
    console.log("match_id",match_id, "contest_id",contest_id, "user_id",user_id);
    const params = {
        KeyConditionExpression:'match_id =:match_id',
        IndexName:"match_id-index",
        FilterExpression: 'contest_id =:contest_id AND user_id =:user_id',
        ExpressionAttributeValues: {
            ':match_id': Number(match_id),
            ':contest_id': String(contest_id),
            ':user_id': String(user_id)
        },

        TableName: "player_team_contest"
    };

    var result1 = await docClient.query(params).promise()
    // console.log('my_teams',result1);
    if (result1.Items && result1.Items.length > 0) {
        return result1.Items
    }
    else {
        return [];
    }

}

const getAllTeamsByMatchId = async(match_id, contest_id, user_id)=>{
    const params = {
        KeyConditionExpression:'match_id =:match_id',
        IndexName:"match_id-index",
        FilterExpression: 'contest_id <>:contest_id AND user_id <> :user_id',
        ExpressionAttributeValues: {
            ':match_id': Number(match_id),
            ':contest_id':String(contest_id),
            ':user_id': String(user_id)
        },
        Limit: 100,

        TableName: config.player_team_contest_table
    };
    var result2 = await docClient.query(params).promise()
    // console.log('user_teams',result2);
    if (result2.Items && result2.Items.length > 0) {
        return result2.Items
    }
    else {
        return [];
    }
}
module.exports = {

    newLeaderboard: async (req, res) => {
        try { 
            const { match_id, contest_id } = req.params;
            const user_id = req.userId;
            console.log('my_user_id',user_id);
            let decoded = {
                match_id: parseInt(match_id),
                contest_id: contest_id,
                user_id: user_id,
            }

            let resMatchStatus = await getMatchStatus(match_id);
            let matchStatus = resMatchStatus[0]
            let reviewMatch = resMatchStatus[1]

            let reviewStatus = '';
            if (reviewMatch) {
                if (reviewMatch.match_status == 'Finished' && reviewMatch.win_flag == 0) {
                    reviewStatus = 'Under Review';
                } else if (reviewMatch.match_status == 'Delayed') {
                    reviewStatus = 'Delayed';
                }
            }


            let contestDataAPIKey = RedisKeys.getContestDetailAPIKey(match_id, contest_id);
            let contestData;
            if (reviewMatch == "In Progress") {
                contestData = await redis.getRedis(contestDataAPIKey);
            }
            if (!contestData) {
                let contestDetail = await Contest.findOne({ _id: contest_id });
                contestDetail = JSON.parse(JSON.stringify(contestDetail));
                let prizeMoney = 0;
                let totalTeams = 0;
                let teamsJoined = [];
                let toalWinner = 0;
                let entryfee = 0;
                let inviteCode = '';
                let teamData = [];
                let myTeamIds = [];
                let customPrice = [];
                matchInviteCode = await MatchContest.getInviteCode(match_id, contest_id);
                if (matchInviteCode && matchInviteCode.invite_code) {
                    inviteCode = matchInviteCode.invite_code;
                }

                let finiteBreakupDetail = {};

                if (contestDetail && contestDetail.infinite_contest_size == 1) {
                    finiteBreakupDetail.winner_percent = contestDetail.winner_percent;
                    finiteBreakupDetail.winner_amount = contestDetail.winning_amount_times;
                }

                let myTeams = await getUserTeamByMatchId(match_id,contest_id,user_id); //PlayerTeamContest.getUserTeamByMatchId(match_id, contest_id, user_id);
                let allTeams = await getAllTeamsByMatchId(match_id, contest_id, user_id);//PlayerTeamContest.getAllTeamsByMatchId(match_id, contest_id, user_id);
                let mergedTeam = [...myTeams, ...allTeams];
                let teamCount = 0;
                // console.log('team_length',mergedTeam, mergedTeam.length);
                for (const userTeam of mergedTeam) {
                    let player_ids = [];

                    let playerTeam = await PlayerTeam.findById(userTeam.player_team_id);
                    // console.log(playerTeam, 'dfsd');
                    if (playerTeam) {
                        let player_ids_array = playerTeam.players

                        for (const row of player_ids_array) {
                            player_ids.push(row.player_id);
                        }
                        let winAmount = (userTeam.winning_amount) ? userTeam.winning_amount : 0;
                        let userDetail  =   await User.findOne({_id:userTeam.user_id});
                        if (userDetail) {
                            // ////consolelog(playerTeam);
                            let teamUserDetail = userDetail; //userTeam.user;
                            teamData[teamCount] = {};
                            teamData[teamCount]['user_id'] = userTeam.user_id;
                            teamData[teamCount]['team_name'] = teamUserDetail.team_name;
                            teamData[teamCount]['user_image'] = ''; //(teamUserDetail.image) ? config.imageBaseUrl + '/avetars/' + teamUserDetail.image : "";
                            teamData[teamCount]['team_no'] = (playerTeam) ? playerTeam.team_count : 0;
                            teamData[teamCount]['rank'] = (userTeam.rank) ? userTeam.rank : 0;
                            teamData[teamCount]['previous_rank'] = userTeam.previous_rank || 0;
                            teamData[teamCount]['new_rank'] = userTeam.rankNew || 0;
                            teamData[teamCount]['point'] = playerTeam.points || 0;
                            // teamData[teamCount]['substitute_status']	=	playerTeam.substitute_status;
                            teamData[teamCount]['winning_amount'] = winAmount;
                        }
                    }
                    teamCount++;
                }

                let ranArr = [];
                let MyUser = [];
                // console.log('team_data',teamData.length);
                if (teamData) {
                    key = 0;
                    for (const teamss of teamData) {
                        if (teamss && teamss['user_id'] == decoded['user_id']) {
                            MyUser.push(teamss);
                            delete teamData[key];
                        }
                        key++;
                    }
                }

                teamData.filter((e) => {
                    return e;
                })

                if (teamData) {
                    for (const teamss of teamData) {
                        if (teamss) {
                            ranArr.push(teamss['rank']);
                        }
                    }
                }

                let teamRankData = MyUser.concat(teamData)

                if (!contestDetail.confirmed_winning || contestDetail.confirmed_winning == '' || contestDetail.confirmed_winning == '0') {
                    winComfimed = 'no';
                } else {
                    winComfimed = 'yes';
                }
                if (decoded['user_id']) {
                    teamsJoined = await PlayerTeamContest.find({ 'match_id': decoded['match_id'], 'contest_id': decoded['contest_id'], 'user_id': decoded['user_id'] })
                    if (teamsJoined) {
                        for (const joined of teamsJoined) {
                            myTeamIds.push({ "player_team_id": joined.player_team_id });
                        }
                    }
                }

                prizeMoney = contestDetail.winning_amount;
                totalTeams = contestDetail.contest_size;
                entryfee = contestDetail.entry_fee;
                multipleTeam = (contestDetail.multiple_team && contestDetail.multiple_team == 'yes') ? true : false;
                let joinedTeams = await PlayerTeamContest.find({ 'match_id': match_id, 'contest_id': contest_id }).countDocuments();
                let is_joined = (teamsJoined.length > 0) ? true : false;

                let bonusAmount = config.admin_percentage;
                let useBonus = 0;
                if (contestDetail.used_bonus != '') {
                    useBonus = contestDetail.used_bonus;
                } else if (contestDetail.entry_fee > 0) {
                    useBonus = bonusAmount;
                }
                // console.log('breakup',contestDetail.breakup);

                if (contestDetail.breakup) {
                    let key = 0;
                    if(contestDetail.amount_gadget == 'gadget') {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }
                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['gadget_name'] = customBreakup.gadget_name ? (customBreakup.gadget_name) : "";
                            customPrice[key]['image'] = customBreakup.image ? config.imageBaseUrl+ '/' + customBreakup.image : "";
                            key++;
                        }
                    } else {
                        for (const customBreakup of contestDetail.breakup) {
                            if (!customPrice[key]) {
                                customPrice[key] = {}
                            }

                            if (customBreakup.startRank == customBreakup.endRank) {
                                customPrice[key]['rank'] = 'Rank ' + customBreakup.startRank;
                            } else {
                                customPrice[key]['rank'] = customBreakup.name;
                            }

                            customPrice[key]['price'] = customBreakup.price_each ? (customBreakup.price_each).toFixed(2) : (customBreakup.price).toFixed(2);
                            // customPrice[key]['price']	=	customBreakup.price;
                            if (customBreakup.endRank) {
                                toalWinner = customBreakup.endRank;
                            } else {
                                toalWinner = customBreakup.startRank;
                            }
                            key++;
                        }
                    }
                }
                // ////consolelog(contestDetail.breakup);
                let contestData = {
                    match_status: (matchStatus) ? matchStatus.status : '',
                    prize_money: prizeMoney,
                    confirm_winning: winComfimed.toString(),
                    total_teams: totalTeams,
                    entry_fee: entryfee,
                    invite_code: inviteCode,
                    join_multiple_teams: multipleTeam,
                    total_winners: (contestDetail.breakup && contestDetail.breakup.length > 0) ? contestDetail.breakup.pop() : {}, //toalWinner,
                    teams_joined: joinedTeams,
                    is_joined: is_joined,
                    my_team_ids: myTeamIds,
                    joined_team_list: teamRankData,
                    breakup_detail: customPrice,
                    server_time: moment(Date.now()).format(config.DateFormat.datetime),
                    use_bonus: useBonus,
                    review_status: reviewStatus,
                    is_infinite: (contestDetail.infinite_contest_size == 1) ? true : false,
                    infinite_breakup: finiteBreakupDetail,
                }
                if (reviewMatch == "In Progress") {
                    redis.setRedis(contestDataAPIKey, contestData)
                }
                return res.send(ApiUtility.success(contestData));
            }

        } catch (error) {
            ////consolelog(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
}
