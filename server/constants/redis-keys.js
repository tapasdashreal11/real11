const redisKeys = {
    TIME_10_DAYS:864000,
    MATCH_CONTEST_LIST:'match-contest-list-',
    MATCH_CONTEST_LIST_CATEGORY:'match-contest-list-category',
    MATCH_CONTEST_All_LIST:'match-contest-all-list',
    JOINED_CONTEST_IDS:'joined-contest-ids-',
    CONTEST_JOINED_TEAMS_COUNT:'contest-joined-teams-count-',
    POINTS_BREAKUPS:'points-breakups',
    MATCH_PLAYER_LIST:'match-player-list-',
    CONTEST_JOINED_LIST:'contest-joined-list-',
    USER_DATA:'user-data-',
    BANNER_LIST:'banner-list',
    CONTEST_DETAIL_API_DATA:'contest-detail-api-',
    MY_MATCHES_LIST:'my-matches-list-',
    PLAYER_STATS:'player-stats-',
    USER_AUTH_CHECK:'user-auth-',
    getMatchPlayerListKey: (match_id, sport) => redisKeys.MATCH_PLAYER_LIST + match_id + '-' + sport,
    getMatchPlayerStatsKey: (match_id, sport) => redisKeys.PLAYER_STATS + match_id + '-' + sport,
    getUserDataKey: (user_id) => redisKeys.USER_DATA + user_id,
    getContestDetailAPIKey: (match_id, contest_id) => redisKeys.CONTEST_DETAIL_API_DATA + match_id + '-' + contest_id,
    }
    
    module.exports = redisKeys