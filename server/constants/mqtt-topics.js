const mqttTopics = {
    MATCH_CONTEST_COUNT:'real11/match-contest-count/',
    matchContestCount: (match_id) => mqttTopics.MATCH_CONTEST_COUNT + match_id,
    userJoinedTeamCounts: (match_id, userId) => `real11/user-contest-team-count/${match_id}/${userId}`,
    userJoinedContestCounts: (match_id, userId) => `real11/user-joined-contest-count/${match_id}/${userId}`,
}
module.exports = mqttTopics