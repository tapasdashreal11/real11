'use strict'

const express = require('express');
const router = express.Router();
const config = require('./config');
const logger = require('../utils/logger')(module);
const multer = require('multer');
const path = require('path');
const amazonS3 = require('./controllers/amazon-s3');
const auth = require('../lib/auth');
const redis = require('../lib/redis');
const passport = require('passport');

const AWS = require('aws-sdk');
const fs = require('fs');
const ID = '';
const SECRET = '';

// test routeing 
// The name of the bucket that you have created
// const BUCKET_NAME = 'real11-images';
const BUCKET_NAME = process.env.BUCKET_NAME || 'real11-prod-images';
const FILE_PERMISSION = 'public-read'
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY || ID,
    secretAccessKey: process.env.AWS_SECRET_KEY || SECRET
});

const mobikwikController = require('./controllers/mobikwik-controller');

const usersLogin = require('./api/v1/users/users-login.api');
const usersSignup = require('./api/v1/users/users-signup.api');
const changeBankReq = require('./api/v1/users/change-bank-req');
// const usersDeleteAccount = require('./api/v1/users/users-delete-account');
const usersFriendReferral = require('./api/v1/users/users-friend-referral-details');
const usersReferralList = require('./api/v1/users/users-referral-list');
const usersBankDetails = require('./api/v1/users/users-get-bank-details');
const usersProfile = require('./api/v1/users/users-get-profile');
const usersLogout = require('./api/v1/users/users-logout');
const usersUpdateDetails = require('./api/v1/users/users-update-details');
const changePassword = require('./api/v1/users/users-change-password');
const forgotPassword = require('./api/v1/users/forgot-password');
const {userCouponPurchase,userCouponList,userCouponWalletAmount,userCouponRevoke} = require('./api/v1/users/user-coupon-sale');
const {signAndEncrypt,signAndEncryptForOperation,verifySignature} = require('./api/v1/users/user-amazon-pay');
const {
    resetPasswordView,
    resetPassword
} = require('./api/v1/users/reset-password');

const usersVerifyOtp = require('./api/v1/users/users-verify-otp');
const {usersVerifyRF,sharedContestCounts,userRefJoinContestMeta} = require('./api/v1/users/user-verify-referal');
const {
    profile,
    getAffiliateAmount
} = require('./api/v1/users/users-profile');
const editUserTeamName = require('./api/v1/users/edit-user-team-name');
const { seriesList } = require('./api/v1/series.api');
const { bannerList,depositBannerList, playstoreBannerList } = require('./api/v1/banner.api');
const loginWithEmail = require('./api/v1/users/users-email-login');
const transactionHistoryNew = require('./api/v1/users/transation-history-new');
const { teamProfileComparision, teamProfilePaging } = require('./api/v1/users/team-profile-comparision');
const withdrawHistory = require('./api/v1/users/withdraw-history');
const { joinedContestList,joinedContestListUpcoming } = require('./api/v1/contest/joined-contest-list');
const askToAakash = require('./api/v1/users/ask-to-aakash-api');
const { favouriteContestCreate,retentionBonousCreate,retentionBonousThreeType } = require('./api/v1/users/retantion-data-scrip');
const userAppDownlad = require('./api/v1/users/user-app-download');
const youtuberAffilWinTransfer = require('./api/v1/users/youtuber_win_transfer');

const { joinedContestMatches } = require('./api/v1/contest/joined-contest-matches');
const { joinedContestMatchesNew } = require('./api/v1/contest/joined-contest-matches-new');
const  joinContest  = require('./api/v1/contest/join-contest');
const  joinContestNew  = require('./api/v1/contest/join-contest');
const  joinContestOtherGames  = require('./api/v1/contest/other-games-join-contest');
const  otherGamesCancelContest  = require('./api/v1/contest/other-games-cancel-contest');
const  otherGamesTransationHistory  = require('./api/v1/contest/other-games-transation');
const  {createPrivateContest}  = require('./api/v1/contest/private-contest-create');
const  {gameZopMatchList}  = require('./api/v1/contest/other-gamezop-match');
const  gameZopContestList = require('./api/v1/contest/other-gamezop-contest');
const  gamezopJoinContest  = require('./api/v1/contest/other-gamezop-joincontest');
const  gamezopMatchStatus  = require('./api/v1/contest/other-gamezop-match-status');
const  gamezopMatchResult  = require('./api/v1/contest/other-gamezop-match-result');
const  gamezopMatchResultForuser  = require('./api/v1/contest/other-gamezop-match-wining');
const  { createPrivateContestOG }  = require('./api/v1/contest/other-game-private-contest-create');

//const  joinContestNewOne  = require('./api/v1/contest/join-contest-session-new-one');
//const  joinContestNewOne  = require('./api/v1/contest/join-contest-session-pro');
const  permJoinContest  = require('./api/v1/contest/perm-join-contest');
const  joinContestNewOne  = require('./api/v1/contest/join-contest-head-to-head');
const  joinContestNewOne1  = require('./api/v1/contest/join-contest-head-to-head-redis');
const  joinContestMultipleTeam1  = require('./api/v1/contest/join-contest-multiple-team');
const  joinContestMultipleTeam  = require('./api/v1/contest/join-contest-multiple-pro');
const  joinContestMultipleTeamNew  = require('./api/v1/contest/join-contest-multiple-redis');
//const  joinContest  = require('./api/v1/contest/join-contest-session');
//const  joinContest  = require('./api/v1/contest/join-contest-new');
const  otherGameContestList  = require('./api/v1/contest/other-games-contest');  // not in use for now
const  contestList  = require('./api/v1/contest/contest-list');  // not in use for now
const  contestListNew  =   require('./api/v1/contest/contest-m-list');  // require('./api/v1/contest/contest-list-new');
const  contestListNewLatest  = require('./api/v1/contest/contest-m-list');
const  { contestDetailNew,contestLeaderboard, contestDetail,contestDetailNewLatest,contestLeaderboardLatest,contestDetailLatest }  = require('./api/v1/contest/contest-detail');
const  { contestPrizeBreakup }  = require('./api/v1/contest/contest-prize-breakup');
const  { applyContestInviteCode }  = require('./api/v1/contest/apply-contest-invite-code');
const  categoryContestList  = require('./api/v1/contest/category-contest-list');
const  { otherGamesMatch }  = require('./api/v1/contest/other_games_match');
const  { otherGameContestWallet }  = require('./api/v1/contest/other-games-wallet');
const  otherGameWinningDis   = require('./api/v1/contest/other-games-wining-dis');
const  CreateRazopayFundAccount   = require('./api/v1/users/create-razopay-fund-ac');
const  RazopayWithdrawReq   = require('./api/v1/users/razopay-withdraw-req');
const  RazopayWebhook   = require('./api/v1/users/razopay-webhook');

const  { weekLeaderBoardSeriesApi,weekLeaderBoardSeriesWeeksData,seriesLeaderBoardData,megaLeaderBoardData }  = require('./api/v1/users/week-leaderboard-series-api');
const  { megaLeaderBoardTotalPointsCal,seriesLeaderBoardTotalPointsCal,weekLeaderBoardTotalPointsCal}  = require('./api/v1/users/leaderboard-total-points');

const {userResendOtp,userRefStaticData,userGoogleSignIn,userGoogleSignUpDetailAdd,userAppleSignUpDetailAdd,userSignup,userNormalSignUpDetailUpdate,userAvtarUpdate,userAppleSignIn,userAddInFairPlayViolation,userDeactivate} = require('./api/v1/users/user-google-signup');
const appSettingApi = require("./api/v1/common/app-settings");
const user_offers = require("./api/v1/common/app-analysis-api");
const { 
   // contestList,
    // contestDetail,
    // joinedContestList,
    joinContestWalletAmount,
    joinContestWalletAmountMultiple,
    joinContestWithMultipleTeam,
   // categoryContestList,
    switchTeam,
    // contestPrizeBreakup,
    beforeJoinContest,
    applyCouponCode,
    createContest,
    addBulkContestMatch,
} = require('./api/v1/contest.api');

const {
    createTransactionId,
    generatePayubizChecksum,
    generatePaytmChecksum,
    updateTransaction,
    updateTransactionFromWebhook,
    updateTransactionPhonePeWebhook,
    updateTransactionMobikwikWebhook,
    checkTransactionStatus,
    couponForAddCash,
    generatePhonePeChecksum,
    checkPhonePeTransactionStatus,
    checkMobikwikTransactionStatus,
    generatePayUMoneyHash,
    checkPayUMoneyTransactionStatus,
    generateCashfreeToken,
    updateTransactionCashfreeWebhook
} = require('./api/v1/transaction.api');

const { matchList,fiveOverliveFantasyMatchList } = require('./api/v1/contest/match-list');
const { playerList, playerListn } = require('./api/v1/contest/player-list');
const { playerTeamList, previewPlayerTeamList,playerTeamListn } = require('./api/v1/contest/player-team-list');
const { createTeam } = require('./api/v1/contest/create-team');
const { createTeamNew } = require('./api/v1/contest/create-team-new');
const { seriesPlayerList, seriesPlayerListNew } = require('./api/v1/contest/series-player-list');
const { seriesPlayerDetail } = require('./api/v1/contest/series-player-detail');
const {
    // createTeam,
    leaderboard,
    teamScore,
    entryPerTeam,
    // seriesPlayerList
} = require('./api/v1/match.api');

const { notificationList,notificationRead } = require('./api/v1/users/notification-list');
const deleteNotifications = require('./api/v1/users/delete-notification');
const withdrawCash = require('./api/v1/users/withdraw-cash');
const verifyBankDetails = require('./api/v1/users/verify-bank');
const verifyBankDetailsNew = require('./api/v1/users/verify-bank-new');
const verifyPanDetails = require('./api/v1/users/verify-pan');
const addWithdrawRequest = require('./api/v1/users/withdraw-request');
const {realRefCodeGenerate,verifyReferal, verifyEmail, verifyAccountEmail ,updateUserFCMToken,verifyGmailAccount} = require('./api/v1/users/verify-email');
// const { newLeaderboard } = require('./api/v1/leaderboard');
const {emailReqOtp,verifyEmailWithOtp} = require('./api/v1/users/verify-email-new');
const paytmController = require('./controllers/paytm-controller');

const { imageFilter } = require("./api/v1/common/helper");
/** update player image */
const playerImageDirPath = path.resolve('server', 'public', 'images');

// live fantasy api section 
const { liveFantasyMatchList,liveFantasyMatchContestList,liveFantasyMatchContestWallet,lfJoinedContestList,liveMatchScore } = require('./api/v1/live-fantasy/lf-match-list');
const { createPrediction,predictionList,updatePrediction,lfPointSystem,predictionForUserItem } = require('./api/v1/live-fantasy/lf-prediction-api');
const lfJoinContest = require('./api/v1/live-fantasy/lf-join-contest');
const lfTransactionHistory = require('./api/v1/live-fantasy/lf-transation-history');
const { lfJoinedContestMatches } = require('./api/v1/live-fantasy/lf-joined-contest-matches');
const  { lfContestDetailNew,lfContestLeaderboard,lfLivecontestDetailLB }  = require('./api/v1/live-fantasy/lf-contest-detail');

// Unity Ludo

const  unityMatchResult  = require('./api/v1/contest/unity-match-result');
const  unityMatchStatus  = require('./api/v1/contest/unity-match-status');

// Quiz Question answer

const  {quizQuestion,quizQuestionAnsSubmit,userSubmitedQuestionList}  = require('./api/v1/quiz/quiz-question');


const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, playerImageDirPath);
    },

    filename: (req, file, cb) => {
        let fileName = (req.userId || 'img') + '-' + Date.now() + path.extname(file.originalname);
        cb(null, fileName);
    },

});

const uploadFile = (uploadFile, fileName, mimetype="image/png") => {
    try {
        // Read content from the file
        const fileContent = fs.readFileSync(uploadFile);

        // Setting up S3 upload parameters
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileName, // File name you want to save as in S3
            Body: fileContent,
            ACL: FILE_PERMISSION,
            ContentType: mimetype
        };

        // Uploading files to the bucket
        s3.upload(params, function(err, data) {
            if (err) {
                console.log('err', err)
                throw err;
            }
            console.log(`File uploaded successfully. ${data.Location}`);
        });
    } catch (error) {
        console.log(error)
    }
};

const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: config.maxPhotoUploadSize } });
/*
 * ROUTER MIDDLEWARE
 */
//All routes will be redirect to HTTPS on production
var https_port = process.env.HTTPS_PORT || '';
if (config.express.isOnProduction || https_port) {
    router.use(function(req, res, next) {
        var host = req.get('host');
        //console.log("host = " + host + ", protocol: " + req.protocol);
        if (req.get('x-forwarded-proto') != "https" && req.protocol != 'https') {
            // res.set('x-forwarded-proto', 'https');
            res.redirect('https://' + host + req.url);
        } else {
            next();
        }
    });
}

router.get('/',function(req,res){
	return res.send("Welcome")
})

//API ROUTES//
router.get('/api/v1/aws/sign-and-encrypt', signAndEncrypt);
router.get('/api/v1/aws/sign-and-encrypt-for-operation', signAndEncryptForOperation);
router.get('/api/v1/aws/verify-signature', verifySignature);

router.get('/api/v1/user-inactive',auth.authenticate.jwtLogin, userDeactivate); 
router.post('/api/v1/resend-otp', userResendOtp);
router.post('/api/v1/apple-login', userAppleSignIn); 
router.post('/api/v1/google-login', userGoogleSignIn); 
router.post('/api/v1/signup-data-upate', userGoogleSignUpDetailAdd); 
router.post('/api/v1/apple-signup-data-upate', userAppleSignUpDetailAdd);  
router.post('/api/v1/user-add-in-fairplay', userAddInFairPlayViolation);
router.post('/api/v1/user-game-signup', userSignup); 
router.post('/api/v1/signup-email-data-update',auth.authenticate.jwtLogin, userNormalSignUpDetailUpdate); 
router.post('/api/v1/user-avtar-update',auth.authenticate.jwtLogin, userAvtarUpdate); 
router.get('/api/v1/add_bulk_contest_match', addBulkContestMatch);
router.post('/api/v1/email-login', loginWithEmail);
router.post('/api/v1/addWithdrawRequest', auth.authenticate.jwtLogin, addWithdrawRequest);
router.get('/api/v1/series-list', auth.authenticate.jwtLogin, seriesList);
router.get('/api/v1/transation-history-new', auth.authenticate.jwtLogin, transactionHistoryNew);
router.post('/api/v1/profile', auth.authenticate.jwtLogin, profile);
router.get('/api/v1/withdraw-history', auth.authenticate.jwtLogin, withdrawHistory);
router.get('/api/v1/ref-txt', userRefStaticData);  
router.get('/api/v1/create-razopay-fund-ac', CreateRazopayFundAccount);
router.post('/api/v1/withdraw-razopay-req',auth.authenticate.jwtLogin, RazopayWithdrawReq);
router.post('/api/v1/withdraw-razopay-webhook', RazopayWebhook);

router.get('/api/v1/user-coupon-purchase/:coupon_id',auth.authenticate.jwtLogin, userCouponPurchase);
router.get('/api/v1/user-coupon-wallet/:coupon_id',auth.authenticate.jwtLogin, userCouponWalletAmount);
router.get('/api/v1/user-coupon-list', auth.authenticate.jwtLogin,userCouponList); //
router.get('/api/v1/user-coupon-revoke/:coupon_id', auth.authenticate.jwtLogin,userCouponRevoke); 

router.post('/api/v1/ask-to-aakash',auth.authenticate.jwtLogin, askToAakash);
router.post('/api/v1/edit-user-team-name', auth.authenticate.jwtLogin, editUserTeamName);
router.post('/api/v1/login', usersLogin);
router.post('/api/v1/signup', usersSignup);
router.get('/api/v1/banner-list', bannerList);
router.get('/api/v1/deposit-banner-list', depositBannerList);
router.get('/api/v1/playstore-banner-list', playstoreBannerList);
//router.get('/api/v1/contest-list/:match_id/:sport?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestList);
router.get('/api/v1/contest-list/:match_id/:sport?/:series_id?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestList); // not in use for now
router.get('/api/v1/contest-list-new/:match_id/:sport?/:series_id?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestListNew);
router.get('/api/v1/contest-list-new-latest/:match_id/:sport?/:series_id?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestListNewLatest);
router.get('/api/v1/contest-list-wredis/:match_id', auth.authenticate.jwtLogin, contestList);  // not in use for now
router.get('/api/v1/other-game-contest-list/:match_id/:sport',auth.authenticate.jwtLogin, otherGameContestList);   // not in use for now
router.get('/api/v1/category-contest-list/:match_id/:sport?/:category_id?', auth.authenticate.jwtLogin, categoryContestList);
router.get('/api/v1/category-contest-list/:match_id/:category_id?', auth.authenticate.jwtLogin, categoryContestList); //need to check in use or not
router.post('/api/v1/apply-coupon-code', auth.authenticate.jwtLogin, applyCouponCode);
router.post('/api/v1/create-contest',auth.authenticate.jwtLogin, createPrivateContest);
router.get('/api/v1/user-download/:dcode/:clevertap_id', userAppDownlad);
router.post('/api/v1/youtuber-affiliate-to-deposit', auth.authenticate.jwtLogin, youtuberAffilWinTransfer);

router.get('/api/v1/contest-leaderboard/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestLeaderboardLatest);
// router.get('/api/v1/new-contest-leaderboard/:match_id/:contest_id', auth.authenticate.jwtLogin, newLeaderboard);
// router.get('/api/v1/smtp-mail', auth.authenticate.jwtLogin, smtpMail);

router.get('/api/v1/team-states/:series_id', auth.authenticate.jwtLogin, (req, res) => {
    return res.send({
        "status": true,
        "message": "success",
        "data": []
    })
});
router.get('/api/v1/contest-prize-breakup/:contest_size/:sport?', auth.authenticate.jwtLogin, contestPrizeBreakup);
router.get('/api/v1/contest-detail/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetailLatest); // old
router.get('/api/v1/contest-detail-new/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetailNewLatest); // old
router.get('/api/v1/joined-contest-list/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, joinedContestList); //
router.get('/api/v1/joined-contest-list-upcoming/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, joinedContestListUpcoming);

router.get('/api/v1/contest-detail-new-latest/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetailNewLatest);
router.get('/api/v1/contest-detail-latest/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetailLatest);
router.get('/api/v1/contest-leaderboard-latest/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestLeaderboardLatest);
router.get('/api/v1/user-referral-earn/:page?',auth.authenticate.jwtLogin, userRefJoinContestMeta);

router.get('/api/v1/series-player-detail/:series_id/:match_id/:player_id/:sport', seriesPlayerDetail);
router.get('/api/v1/series-player-list/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, seriesPlayerList);
router.get('/api/v1/series-player-list-new/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, seriesPlayerListNew);
router.get('/api/v1/team-scores/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, teamScore);
router.get('/api/v1/before-join-contest/:series_id/:match_id', auth.authenticate.jwtLogin, beforeJoinContest);
router.get('/api/v1/player-team-list/:series_id/:match_id/:user_id?/:team_no?/:sport?', auth.authenticate.jwtLogin, playerTeamList);
router.get('/api/v1/preview-player-team-list/:series_id/:match_id/:player_team_id/:team_no/:sport/:cat_id?', auth.authenticate.jwtLogin, previewPlayerTeamList);
router.get('/api/v1/player-team-listn/:series_id/:match_id/:user_id?/:sport?/:team_no?', auth.authenticate.jwtLogin, playerTeamListn);
router.get('/api/v1/player-list/:series_id/:match_id/:sport?', playerList);
router.get('/api/v1/player-listn/:series_id/:match_id/:sport?', playerListn);
router.get('/api/v1/leaderboard/:series_id/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, leaderboard);
//router.post('/api/v1/create-team', auth.authenticate.jwtLogin, createTeam);
router.post('/api/v1/create-team', auth.authenticate.jwtLogin, createTeamNew);
router.post('/api/v1/join-contest-wallet-amount', auth.authenticate.jwtLogin, joinContestWalletAmount);
router.post('/api/v1/join-contest-wallet-amount-multple', auth.authenticate.jwtLogin, joinContestWalletAmountMultiple);
router.post('/api/v1/join-contest', auth.authenticate.jwtLogin, joinContest);
router.post('/api/v1/join-contest-with-multiple', auth.authenticate.jwtLogin, joinContestWithMultipleTeam);
router.post('/api/v1/join-contest-new', auth.authenticate.jwtLogin, joinContestNewOne); // 
router.post('/api/v1/perm-join-contest', permJoinContest); 
router.post('/api/v1/multiple-join-contest-new', auth.authenticate.jwtLogin, joinContestMultipleTeam);
router.post('/api/v1/other-games-wallet-amount', auth.authenticate.jwtLogin, otherGameContestWallet);
router.post('/api/v1/other-games-join-contest', auth.authenticate.jwtLogin, joinContestOtherGames);
router.post('/api/v1/other-games-cancel-contest', auth.authenticate.jwtLogin, otherGamesCancelContest);
router.get('/api/v1/other-games-transation-history', auth.authenticate.jwtLogin, otherGamesTransationHistory); 
router.post('/api/v1/other-games-wining-dis', otherGameWinningDis);
router.get('/api/v1/check-contest-ref-count/:match_id/:series_id/:contest_id',auth.authenticate.jwtLogin, sharedContestCounts);
router.get('/api/v1/gamezop-match-list', gameZopMatchList);
router.get('/api/v1/gamezop-contest-list/:match_id',auth.authenticate.jwtLogin, redis.cacheMiddle, gameZopContestList);
router.post('/api/v1/gamezop-games-join-contest',auth.authenticate.jwtLogin, gamezopJoinContest);
router.post('/gamezop/match-status',gamezopMatchStatus);
router.post('/gamezop/match-result',gamezopMatchResult); 
router.get('/api/v1/gamezop-game-win-list/:room_id',auth.authenticate.jwtLogin, gamezopMatchResultForuser);
router.post('/api/v1/other-games-create-private-contest',auth.authenticate.jwtLogin, createPrivateContestOG);

// Unity Ludo api 

router.post('/api/v1/unity-match-result', unityMatchResult); 
router.post('/api/v1/unity-match-status',unityMatchStatus);

// Quiz API

router.get('/api/v1/quiz-question-list',auth.authenticate.jwtLogin, quizQuestion);
router.get('/api/v1/quiz-question-submit/:q_id/:option_id',auth.authenticate.jwtLogin, quizQuestionAnsSubmit);
router.get('/api/v1/quiz-submited-list',auth.authenticate.jwtLogin, userSubmitedQuestionList);

router.post('/api/v1/switch-team', auth.authenticate.jwtLogin, switchTeam);
router.post('/api/v1/entry-per-team', auth.authenticate.jwtLogin, entryPerTeam);
router.post('/api/v1/generate-payubiz-checksum', auth.authenticate.jwtLogin, generatePayubizChecksum);
router.post('/api/v1/generate-paytm-checksum', auth.authenticate.jwtLogin, generatePaytmChecksum);
router.post('/api/v1/create-transaction-id', auth.authenticate.jwtLogin, createTransactionId);
router.get('/api/v1/joined-contest-matches/:is_complete?/:sport?', auth.authenticate.jwtLogin, joinedContestMatchesNew);
router.get('/api/v1/joined-contest-matches-new/:is_complete?/:sport?', auth.authenticate.jwtLogin, joinedContestMatchesNew);
router.get('/api/v1/apply-contest-invite-code/:invite_code',auth.authenticate.jwtLogin, applyContestInviteCode);
router.get('/api/v1/get-match-list/:sport?', redis.cacheMiddle, matchList);
router.get('/api/v1/other-match-list', otherGamesMatch);
router.get('/api/v1/five-over-match-list/:pmatch_id/:sport', fiveOverliveFantasyMatchList);
router.get('/api/v1/get-match-detail/:match_id/:sport/:series_id',  redis.cacheMiddle);
router.post('/api/v1/team-profile-comparision', auth.authenticate.jwtLogin, teamProfileComparision);
router.post('/api/v1/team-profile-paging', teamProfilePaging);
router.post('/api/v1/favouite-create', favouriteContestCreate); 
router.post('/api/v1/retention-bonous-create', retentionBonousCreate);
router.post('/api/v1/retention-bonous-three-create', retentionBonousThreeType);
router.get('/api/v1/week-leaderboard-series',auth.authenticate.jwtLogin, weekLeaderBoardSeriesApi);
router.get('/api/v1/week-leaderboard-series-data/:s_id/:w_count/:page',auth.authenticate.jwtLogin, weekLeaderBoardSeriesWeeksData);
router.get('/api/v1/series-leaderboard-data/:s_id/:page',auth.authenticate.jwtLogin, seriesLeaderBoardData);
router.get('/api/v1/mega-leaderboard-data/:s_id/:page',auth.authenticate.jwtLogin, megaLeaderBoardData); 

router.get('/api/v1/mega-leaderboard-total-data/:s_id/:user_id/:rank/:page?',auth.authenticate.jwtLogin, megaLeaderBoardTotalPointsCal); 
router.get('/api/v1/series-leaderboard-total-data/:s_id/:user_id/:rank/:page?',auth.authenticate.jwtLogin, seriesLeaderBoardTotalPointsCal); 
router.get('/api/v1/week-leaderboard-total-data/:s_id/:w_count/:user_id/:rank/:page?',auth.authenticate.jwtLogin, weekLeaderBoardTotalPointsCal);

router.get('/api/v1/user_offers/:series_id/:match_id/:sport',auth.authenticate.jwtLogin, user_offers);
router.get('/api/v1/app-setting', appSettingApi); 
router.post('/api/v1/verify-otp', usersVerifyOtp);
router.get('/api/v1/verify-rf-code/:invite_code/:contest_id/:series_id/:match_id/:sport',auth.authenticate.jwtLogin, usersVerifyRF);
router.get('/api/v1/bankDetails', auth.authenticate.jwtLogin, usersBankDetails);
router.post('/api/v1/personal_details', auth.authenticate.jwtLogin, usersProfile);
router.post('/api/v1/user-account-datail', auth.authenticate.jwtLogin, usersProfile);
router.post('/api/v1/verify-email', auth.authenticate.jwtLogin, verifyEmail);
router.get('/api/v1/verify-account-email/:verify_string', verifyAccountEmail);
router.get('/api/v1/get_affiliate_amount', auth.authenticate.jwtLogin, getAffiliateAmount);
router.post('/api/v1/update-fcm-token', auth.authenticate.jwtLogin, updateUserFCMToken);
router.post('/api/v1/signup-verify-referal', verifyReferal);
router.post('/api/v1/verify-gmail',auth.authenticate.jwtLogin,verifyGmailAccount);
router.post('/api/v1/referal-code-generate', realRefCodeGenerate);

router.post('/api/v1/change_pasword', auth.authenticate.jwtLogin, changePassword);
router.post('/api/v1/update-transactions', auth.authenticate.jwtLogin, updateTransaction);
router.post('/api/v1/check-transactions', auth.authenticate.jwtLogin, checkTransactionStatus); 
router.post('/api/v1/forgot-password', forgotPassword);
router.post('/api/v1/reset-password', resetPassword);
router.get('/api/v1/reset-password-view/:verify_string', resetPasswordView);
router.get('/api/v1/view-add-cash-coupon',auth.authenticate.jwtLogin,redis.cacheMiddle, couponForAddCash);
router.post('/api/v1/generate-phonepe-checksum',auth.authenticate.jwtLogin, generatePhonePeChecksum);
router.post('/api/v1/check-phonepe-transaction-status',auth.authenticate.jwtLogin, checkPhonePeTransactionStatus);
router.post('/api/v1/check-mobikwik-transaction-status',auth.authenticate.jwtLogin, checkMobikwikTransactionStatus);
router.post('/api/v1/generate-payumoney-hash', auth.authenticate.jwtLogin, generatePayUMoneyHash);
router.post('/api/v1/check-payumoney-transaction-status',auth.authenticate.jwtLogin, checkPayUMoneyTransactionStatus);
router.post('/api/v1/generate-cashfree-token',auth.authenticate.jwtLogin, generateCashfreeToken);


router.post('/api/v1/change_pasword', auth.authenticate.jwtLogin, changePassword);
router.post('/api/v1/update_personal_details', auth.authenticate.jwtLogin, usersUpdateDetails);
router.post('/api/v1/friend-referal-detail', auth.authenticate.jwtLogin, usersFriendReferral);
router.post('/api/v1/friend-referral-list/:page?/:pagesize?', auth.authenticate.jwtLogin, usersReferralList);
router.post('/api/v1/logout', auth.authenticate.jwtLogin, usersLogout);
router.get('/api/v1/notification-list', auth.authenticate.jwtLogin, notificationList);
router.get('/api/v1/deleteNotifications', auth.authenticate.jwtLogin, deleteNotifications);
router.post('/upload-images-to-amazons3', amazonS3.upload_images);
router.get('/api/v1/notification-read', auth.authenticate.jwtLogin, notificationRead);

// router.post('/verify-bank-detail', auth.authenticate.jwtLogin, verifyBankDetails);
// router.post('/update-pan', auth.authenticate.jwtLogin, deleteNotifications);
router.get('/api/v1/withdraw-cash', auth.authenticate.jwtLogin, withdrawCash);
router.get('/mobikwik/:transactionId', mobikwikController.showForm);
router.post('/mobikwik/callback', mobikwikController.callback);

router.get('/api/v1/change-bank-req/:is_cancel_req?',auth.authenticate.jwtLogin,changeBankReq);


router.post('/api/v1/email-req-otp', auth.authenticate.jwtLogin, emailReqOtp);
router.post('/api/v1/verify-email-with-otp', auth.authenticate.jwtLogin, verifyEmailWithOtp);

router.post('/cron/paytmwebhook', function(req, res) {
    console.log("paytm callback data", req.body)
    if (req.body.STATUS && req.body.STATUS == "TXN_SUCCESS") {
        updateTransactionFromWebhook(req.body.ORDERID, 'PAYTM', req.body.TXNAMOUNT);
    }
    return res.send({ status: 'success' });
});

router.post('/payumoney/webhook', function(req, res) {
    // https://real11.biz/payumoney/webhook
    console.log("payumoney callback data", req.body)
    // if (req.body.status && req.body.status == "Success") {
    //     updateTransactionFromWebhook(req.body.merchantTransactionId, 'payumoney', req.body.amount);
    // }
    return res.send({ status: 'success' });
});

router.post('/cron/bizwebhook', function(req, res) {
    console.log("payubiz callback data", req.body)
    if (req.body.status && req.body.status == "success") {
        // console.log(req.body.txnid);
        updateTransactionFromWebhook(req.body.txnid, 'payubiz', req.body.amount);
    }
    return res.send({ status: 'success' });
});

router.post('/phonePe/phonePewebhook', function(req, res) {
    console.log("phonePe callback data", req.body)
    console.log("phonePe callback x-verify string", req.headers["x-verify"]);
    // console.log(response, xVerifyString);
    if(req.body && req.body.response) {
        const buff = Buffer.from(req.body.response, 'base64');
        const response = JSON.parse(buff.toString('utf-8'));
        const xVerifyString =   req.headers["x-verify"];
        // console.log(response, xVerifyString);
        if (response && response.success == true && response.code == "PAYMENT_SUCCESS") {
            updateTransactionPhonePeWebhook(response, xVerifyString, req.body.response, 'PHONEPE', function(resResult) {
                return res.send(resResult)
            });
        } else {
            return res.send({ status: false, "message":"Something went wrong..!!" });
        }
    } else {
        return res.send({ status: false, "message":"Something went wrong..!!" });
    }
    // return res.send({ status: 'success' });
});

router.post('/mobikwik/webhook', function(req, res) {
    console.log("mobikwik callback data", req.body);
    console.log("mobikwik query param", req.query.realtime);
    if(req.body && req.body.txnData) {
        let response = JSON.parse(req.body.txnData);
        if(req.query && req.query.realtime == "true") {
            if(response && response.txns[0].responseCode) {
                updateTransactionMobikwikWebhook(response, req.body.txnData, 'MOBIKWIK', function(resResult) {
                    return res.send(resResult)
                });
            } else {
                return res.send({ status: false, "message":"Something went wrong..!!" });
            }
        } else {
            if(response && !response.txns[0].responseCode && response.txns[0].orderid) {
                updateTransactionMobikwikWebhook(response, req.body.txnData, 'MOBIKWIK', function(resResult) {
                    return res.send(resResult)
                });
            }
        }
    } else {
        return res.send({ status: false, "message":"Something went wrong..!!" });
    }
});

router.post('/cashfree/webhook', function(req, res) {
    console.log("cashfree callback data", req.body)
    // console.log("cashfree callback data type", typeof req.body )
    console.log("cashfree callback header", req.headers);
    if(req.body && req.body.data) {
        let bodyRes =   req.body.data;
        if (bodyRes && bodyRes.order && bodyRes.order.order_id !== "" && bodyRes.payment && bodyRes.payment.payment_status == "SUCCESS"  ) {
            updateTransactionCashfreeWebhook(bodyRes, req.body, req.headers, 'CASH_FREE', function(resResult) {
                return res.send(resResult)
            });
        }
    } else {
        return res.send({ status: false, "message":"Something went wrong..!!" });
    }
});


// live fantasy api section 
 router.get('/api/v1/lf-match-list/:pmatch_id/:sport', liveFantasyMatchList); 
 router.get('/api/v1/lf-contest-list/:match_id/:sport/:series_id',auth.authenticate.jwtLogin,redis.cacheMiddle,liveFantasyMatchContestList);
 router.post('/api/v1/lf-contest-wallet',auth.authenticate.jwtLogin,liveFantasyMatchContestWallet); //
 router.post('/api/v1/lf-prediction-add',auth.authenticate.jwtLogin,createPrediction); //
 router.get('/api/v1/lf-prediction-list/:series_id/:match_id/:sport',auth.authenticate.jwtLogin,predictionList); //
 router.post('/api/v1/lf-joincontest',auth.authenticate.jwtLogin,lfJoinContest); 
 router.get('/api/v1/lf-transation-history', auth.authenticate.jwtLogin, lfTransactionHistory);
 router.get('/api/v1/lf-joined-contest-list/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, lfJoinedContestList);
 router.get('/api/v1/lf-joined-contest-matches/:is_complete?/:sport?', auth.authenticate.jwtLogin, lfJoinedContestMatches);
 router.get('/api/v1/lf-contest-detail/:match_id/:contest_id/:series_id/:sport', auth.authenticate.jwtLogin, lfContestDetailNew);
 router.get('/api/v1/lf-contest-leaderboard/:match_id/:contest_id/:series_id/:sport', auth.authenticate.jwtLogin, lfContestLeaderboard);
 router.get('/api/v1/lf-live-leaderboard/:match_id/:contest_id/:series_id/:sport', auth.authenticate.jwtLogin, lfLivecontestDetailLB);
 router.post('/api/v1/lf-prediction-edit',auth.authenticate.jwtLogin,updatePrediction); 
 router.get('/api/v1/lf-point-system',auth.authenticate.jwtLogin,lfPointSystem);
 router.get('/api/v1/lf-match-live-score',liveMatchScore);
 router.get('/api/v1/lf-prediction-user-preview/:id',auth.authenticate.jwtLogin,predictionForUserItem);
 
 //old api with new name 
 router.post('/api/v1/game-login', usersLogin);
 router.post('/api/v1/game-signup', usersSignup);
 router.post('/api/v1/game-email-login', loginWithEmail);
 router.post('/api/v1/game-join-contest', auth.authenticate.jwtLogin, joinContestNewOne);
 router.post('/api/v1/game-multiple-join-contest', auth.authenticate.jwtLogin, joinContestMultipleTeam);
 router.post('/api/v1/game-update-transactions', auth.authenticate.jwtLogin, updateTransaction);
 router.post('/api/v1/game-add-withdraw-request', auth.authenticate.jwtLogin, RazopayWithdrawReq); // added some other addWithdrawRequest     
 /* router.get('/cron/paytmwebhook', function(req, res){
  console.log("paytm callback data",req.query)
  if(req.query.STATUS && req.query.STATUS == "TXN_SUCCESS"){
    updateTransactionFromWebhook(req.body.merchantTransactionId,'PAYTM');
  }
  return res.send({status:'success'});
});

router.post('/payumoney/webhook', function(req, res){
  console.log("payumoney callback data",req.body)
  if(req.body.status && req.body.status == "Success"){
    updateTransactionFromWebhook(req.body.merchantTransactionId);
  }
  return res.send({status:'success'});
});

router.post('/cron/bizwebhook', function(req, res){
  console.log("payubiz callback data",req.body)
  if(req.body.status && req.body.status == "Success"){
    console.log(req.body.merchantTransactionId);
    updateTransactionFromWebhook(req.body.merchantTransactionId);
  }
  return res.send({status:'success'});
}); */

router.post('/api/v1/verify-pan-detail', auth.authenticate.jwtLogin, [
    upload.single('image'),
    function(req, res, next) {
        const fileName = req.file && req.file.filename;
        let filePath = playerImageDirPath + '/' + fileName;
        uploadFile(filePath, fileName);
        req.body.image = fileName || '';
        return next();
    },
], verifyPanDetails);

router.post('/api/v1/verify-bank-detail', auth.authenticate.jwtLogin, [
    upload.single('image'),
    function(req, res, next) {
        const fileName = req.file && req.file.filename;
        let filePath = playerImageDirPath + '/' + fileName;
        uploadFile(filePath, fileName);
        req.body.image = fileName || '';
        return next();
    },
], verifyBankDetailsNew);

/*
 * ERROR HANDLING
 */
router.use(function(req, res, next) {
    logger.error(`Requested URL not found. URL: ${req.url}`)
        //notify.log(req,'',`404 Requested URL not found. URL: ${req.url}`);
    res.status(404);
    res.render('404');
});

//TO DO: Create appropriate error handlers for client side errors
// - Check for error code and rennder appropriate error view
router.use(function(err, req, res, next) {
    logger.error(`500 Internal server error occured. Error stack: ${err.stack || err}`)
        //notify.log(req,'',err);
    res.render('500');
});


module.exports = router;