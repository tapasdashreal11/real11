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

// The name of the bucket that you have created
// const BUCKET_NAME = 'real11-images';
const BUCKET_NAME = process.env.BUCKET_NAME || 'real11-images';
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
const {
    resetPasswordView,
    resetPassword
} = require('./api/v1/users/reset-password');

const usersVerifyOtp = require('./api/v1/users/users-verify-otp');
const {
    profile,
    getAffiliateAmount
} = require('./api/v1/users/users-profile');
const editUserTeamName = require('./api/v1/users/edit-user-team-name');
const { seriesList } = require('./api/v1/series.api');
const { bannerList } = require('./api/v1/banner.api');
const loginWithEmail = require('./api/v1/users/users-email-login');
const transactionHistoryNew = require('./api/v1/users/transation-history-new');
const { teamProfileComparision, teamProfilePaging } = require('./api/v1/users/team-profile-comparision');
const withdrawHistory = require('./api/v1/users/withdraw-history');
const { joinedContestList } = require('./api/v1/contest/joined-contest-list');
const askToAakash = require('./api/v1/users/ask-to-aakash-api');

const { joinedContestMatches } = require('./api/v1/contest/joined-contest-matches');
const  joinContest  = require('./api/v1/contest/join-contest');
const  joinContestNew  = require('./api/v1/contest/join-contest');
//const  joinContest  = require('./api/v1/contest/join-contest-session');
//const  joinContest  = require('./api/v1/contest/join-contest-new');
const  contestList  = require('./api/v1/contest/contest-list');
const  contestListNew  = require('./api/v1/contest/contest-list');
const  { contestDetailNew,contestLeaderboard, contestDetail }  = require('./api/v1/contest/contest-detail');
const  { contestPrizeBreakup }  = require('./api/v1/contest/contest-prize-breakup');
const  { applyContestInviteCode }  = require('./api/v1/contest/apply-contest-invite-code');
const  categoryContestList  = require('./api/v1/contest/category-contest-list');

const appSettingApi = require("./api/v1/common/app-settings");
const user_offers = require("./api/v1/common/app-analysis-api");
const { 
   // contestList,
    // contestDetail,
    // joinedContestList,
    joinContestWalletAmount,
    joinContestWithMultipleTeam,
    // applyContestInviteCode,
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
    checkTransactionStatus
} = require('./api/v1/transaction.api');

const { matchList } = require('./api/v1/contest/match-list');
const { playerList, playerListn } = require('./api/v1/contest/player-list');
const { playerTeamList, playerTeamListn } = require('./api/v1/contest/player-team-list');
const { createTeam } = require('./api/v1/contest/create-team');
const { seriesPlayerList } = require('./api/v1/contest/series-player-list');
const {
    // createTeam,
    leaderboard,
    teamScore,
    entryPerTeam,
    // seriesPlayerList
} = require('./api/v1/match.api');

const notificationList = require('./api/v1/users/notification-list');
const deleteNotifications = require('./api/v1/users/delete-notification');
const withdrawCash = require('./api/v1/users/withdraw-cash');
const verifyBankDetails = require('./api/v1/users/verify-bank');
const verifyPanDetails = require('./api/v1/users/verify-pan');
const addWithdrawRequest = require('./api/v1/users/withdraw-request');
const { verifyEmail, verifyAccountEmail } = require('./api/v1/users/verify-email');
// const { newLeaderboard } = require('./api/v1/leaderboard');
const paytmController = require('./controllers/paytm-controller');

const { imageFilter } = require("./api/v1/common/helper");
/** update player image */
const playerImageDirPath = path.resolve('server', 'public', 'images');

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, playerImageDirPath);

    },

    filename: (req, file, cb) => {
        let fileName = (req.userId || 'img') + '-' + Date.now() + path.extname(file.originalname);
        cb(null, fileName);

    },

});

const uploadFile = (uploadFile, fileName) => {
    try {
        // Read content from the file
        const fileContent = fs.readFileSync(uploadFile);

        // Setting up S3 upload parameters
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileName, // File name you want to save as in S3
            Body: fileContent,
            ACL: FILE_PERMISSION
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

//API ROUTES//
router.get('/api/v1/add_bulk_contest_match', addBulkContestMatch);
router.post('/api/v1/email-login', loginWithEmail);
router.post('/api/v1/addWithdrawRequest', auth.authenticate.jwtLogin, addWithdrawRequest);
router.get('/api/v1/series-list', auth.authenticate.jwtLogin, seriesList);
router.get('/api/v1/transation-history-new', auth.authenticate.jwtLogin, transactionHistoryNew);
router.post('/api/v1/profile', auth.authenticate.jwtLogin, profile);
router.get('/api/v1/withdraw-history', auth.authenticate.jwtLogin, withdrawHistory);

router.post('/api/v1/ask-to-aakash',auth.authenticate.jwtLogin, askToAakash);
router.post('/api/v1/edit-user-team-name', auth.authenticate.jwtLogin, editUserTeamName);
router.post('/api/v1/login', usersLogin);
router.post('/api/v1/signup', usersSignup);
router.get('/api/v1/banner-list', bannerList);
//router.get('/api/v1/contest-list/:match_id/:sport?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestList);
router.get('/api/v1/contest-list/:match_id/:sport?/:series_id?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestList);
router.get('/api/v1/contest-list-new/:match_id/:sport?/:series_id?', auth.authenticate.jwtLogin, redis.cacheMiddle, contestListNew);
router.get('/api/v1/contest-list-wredis/:match_id', auth.authenticate.jwtLogin, contestList);
router.get('/api/v1/category-contest-list/:match_id/:sport?/:category_id?', auth.authenticate.jwtLogin, categoryContestList);
router.post('/api/v1/apply-coupon-code', auth.authenticate.jwtLogin, applyCouponCode);
router.post('/api/v1/create-contest', auth.authenticate.jwtLogin, createContest);

router.get('/api/v1/contest-leaderboard/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestLeaderboard);
// router.get('/api/v1/new-contest-leaderboard/:match_id/:contest_id', auth.authenticate.jwtLogin, newLeaderboard);
// router.get('/api/v1/smtp-mail', auth.authenticate.jwtLogin, smtpMail);

router.get('/api/v1/team-states/:series_id', auth.authenticate.jwtLogin, (req, res) => {
    return res.send({
        "status": true,
        "message": "success",
        "data": []
    })
});
router.get('/api/v1/contest-prize-breakup/:contest_size', auth.authenticate.jwtLogin, contestPrizeBreakup);
router.get('/api/v1/contest-detail/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetail);
router.get('/api/v1/contest-detail-new/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, contestDetailNew);
router.get('/api/v1/joined-contest-list/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, joinedContestList);
router.get('/api/v1/series-player-list/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, seriesPlayerList);
router.get('/api/v1/team-scores/:series_id/:match_id/:sport?', auth.authenticate.jwtLogin, teamScore);
router.get('/api/v1/before-join-contest/:series_id/:match_id', auth.authenticate.jwtLogin, beforeJoinContest);
router.get('/api/v1/player-team-list/:series_id/:match_id/:user_id?/:team_no?/:sport?', auth.authenticate.jwtLogin, playerTeamList);
router.get('/api/v1/player-team-listn/:series_id/:match_id/:user_id?/:sport?/:team_no?', auth.authenticate.jwtLogin, playerTeamListn);
router.get('/api/v1/player-list/:series_id/:match_id/:sport?', playerList);
router.get('/api/v1/player-listn/:series_id/:match_id/:sport?', playerListn);
router.get('/api/v1/leaderboard/:series_id/:match_id/:contest_id/:sport?', auth.authenticate.jwtLogin, leaderboard);
router.post('/api/v1/create-team', auth.authenticate.jwtLogin, createTeam);
router.post('/api/v1/join-contest-wallet-amount', auth.authenticate.jwtLogin, joinContestWalletAmount);
router.post('/api/v1/join-contest', auth.authenticate.jwtLogin, joinContest);
router.post('/api/v1/join-contest-new', auth.authenticate.jwtLogin, joinContestNew);
router.post('/api/v1/join-contest-with-multiple', auth.authenticate.jwtLogin, joinContestWithMultipleTeam);

router.post('/api/v1/switch-team', auth.authenticate.jwtLogin, switchTeam);
router.post('/api/v1/entry-per-team', auth.authenticate.jwtLogin, entryPerTeam);
router.post('/api/v1/generate-payubiz-checksum', auth.authenticate.jwtLogin, generatePayubizChecksum);
router.post('/api/v1/generate-paytm-checksum', auth.authenticate.jwtLogin, generatePaytmChecksum);
router.post('/api/v1/create-transaction-id', auth.authenticate.jwtLogin, createTransactionId);
router.get('/api/v1/joined-contest-matches/:is_complete?/:sport?', auth.authenticate.jwtLogin, joinedContestMatches);
router.get('/api/v1/apply-contest-invite-code/:invite_code', auth.authenticate.jwtLogin, applyContestInviteCode);
router.get('/api/v1/get-match-list/:sport?',  matchList);
router.get('/api/v1/get-match-detail/:match_id/:sport/:series_id',  redis.cacheMiddle);
router.post('/api/v1/team-profile-comparision', auth.authenticate.jwtLogin, teamProfileComparision);
router.post('/api/v1/team-profile-paging', teamProfilePaging);

router.get('/api/v1/user_offers/:series_id/:match_id/:sport',auth.authenticate.jwtLogin, user_offers);
router.get('/api/v1/app-setting', appSettingApi); 
router.post('/api/v1/verify-otp', usersVerifyOtp);
router.get('/api/v1/bankDetails', auth.authenticate.jwtLogin, usersBankDetails);
router.post('/api/v1/personal_details', auth.authenticate.jwtLogin, usersProfile);
router.post('/api/v1/user-account-datail', auth.authenticate.jwtLogin, usersProfile);
router.post('/api/v1/verify-email', auth.authenticate.jwtLogin, verifyEmail);
router.get('/api/v1/verify-account-email/:verify_string', verifyAccountEmail);
router.get('/api/v1/get_affiliate_amount', auth.authenticate.jwtLogin, getAffiliateAmount);

router.post('/api/v1/change_pasword', auth.authenticate.jwtLogin, changePassword);
router.post('/api/v1/update-transactions', auth.authenticate.jwtLogin, updateTransaction);
router.post('/api/v1/check-transactions', auth.authenticate.jwtLogin, checkTransactionStatus); 
router.post('/api/v1/forgot-password', forgotPassword);
router.post('/api/v1/reset-password', resetPassword);
router.get('/api/v1/reset-password-view/:verify_string', resetPasswordView);

router.post('/api/v1/change_pasword', auth.authenticate.jwtLogin, changePassword);
router.post('/api/v1/update_personal_details', auth.authenticate.jwtLogin, usersUpdateDetails);
router.post('/api/v1/friend-referal-detail', auth.authenticate.jwtLogin, usersFriendReferral);
router.post('/api/v1/friend-referral-list/:page?/:pagesize?', auth.authenticate.jwtLogin, usersReferralList);
router.post('/api/v1/logout', auth.authenticate.jwtLogin, usersLogout);
router.get('/api/v1/notification-list', auth.authenticate.jwtLogin, notificationList);
router.get('/api/v1/deleteNotifications', auth.authenticate.jwtLogin, deleteNotifications);
router.post('/upload-images-to-amazons3', amazonS3.upload_images);

// router.post('/verify-bank-detail', auth.authenticate.jwtLogin, verifyBankDetails);
// router.post('/update-pan', auth.authenticate.jwtLogin, deleteNotifications);
router.get('/api/v1/withdraw-cash', auth.authenticate.jwtLogin, withdrawCash);
router.get('/mobikwik/:transactionId', mobikwikController.showForm);
router.post('/mobikwik/callback', mobikwikController.callback);

router.get('/api/v1/change-bank-req',auth.authenticate.jwtLogin,changeBankReq);

router.post('/cron/paytmwebhook', function(req, res) {
    console.log("paytm callback data", req.body)
    if (req.body.STATUS && req.body.STATUS == "TXN_SUCCESS") {
        updateTransactionFromWebhook(req.body.ORDERID, 'PAYTM');
    }
    return res.send({ status: 'success' });
});

router.post('/payumoney/webhook', function(req, res) {
    console.log("payumoney callback data", req.body)
    if (req.body.status && req.body.status == "Success") {
        updateTransactionFromWebhook(req.body.merchantTransactionId);
    }
    return res.send({ status: 'success' });
});

router.post('/cron/bizwebhook', function(req, res) {
    console.log("payubiz callback data", req.body)
    if (req.body.status && req.body.status == "success") {
        console.log(req.body.txnid);
        updateTransactionFromWebhook(req.body.txnid);
    }
    return res.send({ status: 'success' });
});

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
], verifyBankDetails);

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