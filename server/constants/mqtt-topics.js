const mqttTopics = {
    MATCH_CONTEST_COUNT:'real11/match-contest-count/',
    matchContestCount: (match_id) => mqttTopics.MATCH_CONTEST_COUNT + match_id,
    userJoinedTeamCounts: (match_id, userId) => `real11/user-contest-team-count/${match_id}/${userId}`,
    userJoinedContestCounts: (match_id, userId) => `real11/user-joined-contest-count/${match_id}/${userId}`,
    otherGameJoineContestKey: (match_id, contest_id) => `real11/other-game-jc/${match_id}/${contest_id}`,
    userNotificationCounts: (user_id) => `real11/notification-count/${user_id}`,
    otherGamesContestCounts: (match_id,contest_id) => `real11-other-games/Joined-contest-count/${match_id}/${contest_id}`,
}
module.exports = mqttTopics