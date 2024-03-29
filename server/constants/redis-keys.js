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
    ADD_CASH_BANNER_LIST:'add-cash-banner-list',
    PLAYSTORE_BANNER_LIST:'playstore-banner-list',
    CONTEST_DETAIL_API_DATA:'contest-detail-api-',
    MY_MATCHES_LIST:'my-matches-list-',
    PLAYER_STATS:'player-stats-',
    USER_AUTH_CHECK:'user-auth-', //user_id
    getMatchPlayerListKey: (match_id, sport) => redisKeys.MATCH_PLAYER_LIST + match_id + '-' + sport,
    getMatchPlayerStatsKey: (match_id, sport) => redisKeys.PLAYER_STATS + match_id + '-' + sport,
    getUserDataKey: (user_id) => redisKeys.USER_DATA + user_id,
    getContestDetailAPIKey: (match_id, contest_id) => redisKeys.CONTEST_DETAIL_API_DATA + match_id + '-' + contest_id,

    // Redis Ent
    PLAYER_LIST: 'player-list-', //series_id-team_id
    MATCH_PREVIEW: 'match-preview-', //sport-series_id-match_id-player_team_id
    USER_CREATED_TEAMS: 'userteam-', //match_id-sport-user_id
    USER_REFFERAL: 'user-referal-', //invite_code
    JOINED_CONTEST_DETAILS: 'joined_contest_details-', //match_id-sport-user_id-contest_id
    PLAYER_TEAM_CONTEST: 'player_team_contest-', //match_id_sport_contest_user_id
}
    
module.exports = redisKeys