const redisKeys = require('./redis-keys');

module.exports = {
    TransactionTypes: {
        CASH_DEPOSIT:1,
        MOBILE_VERIFY:2,
        JOIN_CONTEST:3,
        WON_CONTEST:4,
        FRIEND_JOIN_CONTEST:5,
        REFUND:6,
        LEVEL_UP:7,
        COUPON_BONUS:8,
        WITHDRAWAL:9,
        FRIEND_USED_INVITE:10,
        TRANSACTION_PENDING:11,
        TRANSACTION_REJECT:12,
        TRANSACTION_CONFIRM:13,
        ADMIN_ADDED:14,
        ADMIN_DEDUCTED:15,
        LEAGUE_REFER_BONUS:16,
        MATCH_REFUND:17,
        TDS:18,
        EXTRA_BONUS: 19,
        BONUS_WIN: 20,
        EXTRA_DEPOSITE: 21,
        FIRST_DEPOSITE_BONUS: 22,
        COUPON_PURCHASE_TXN: 23,
        WEEKLY_LEADERBOARD_WIN:24
    },
    MatchStatus:{
        IN_REVIEW: 'Under Review',
        MATCH_FINISH:'Finished',
        MATCH_NOTSTART:'Not Started',
        MATCH_INPROGRESS:'In Progress',
        MATCH_CANCELLED:'Cancelled',
        MATCH_DELAYED:'Delayed',
    },
    RedisKeys:redisKeys
}