/*
* Desc: Config.js contains all configuration variables and keys needed in the application
* Usage: To create a new config key, use config.<your key name >. Then import the config.js in your module
*
*/

var config = module.exports;
const PRATE_ENV = process.env.PRATE_ENV; //The PRATE_ENV is set by the production.env on the AWS instances('test', 'staging', 'production')
const RUNNING_ON_AWS = (PRATE_ENV && PRATE_ENV !== '');


config.express = {
  port: process.env.APP_PORT || 3003,
  ip: '127.0.0.1'
};

config.appName = "Real11 Admin";
config.supportEmail = "support@real11.com";
config.system = {
  allowFacebookLogin: false,
  allowFacebookSignup: false,
  allowGoogleLogin: false,
  allowPhoneSignup: false,
  allowPhoneLogin: false,
}

config.dbConnection = {
  dbName: process.env.MONGO_DB || 'real11Node',
  string: process.env.DB_PR || 'mongodb://real11:real11dev#123@ip-172-31-40-1.ap-south-1.compute.internal:27027,ip-172-31-37-102.ap-south-1.compute.internal:27027,ip-172-31-36-75.ap-south-1.compute.internal:27027/real11?authSource=admin&replicaSet=real11-mongo-rs1',
  mongoURI: process.env.DB_PR,
  mongoURIFORANALYSIS: process.env.DB_PR_ANALYSIS,  
  mysql: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.SQLDB_USER,
    password: process.env.SQLDB_PASSWORD,
    dbName: process.env.SQLDB_NAME || 'real_11'
  }
 };

config.mailgun = {
  key: process.env.MAILGUN_API_KEY,
  attachment_dir: './dist/public/email_attachments/',
};

// Email Provider
config.emailProvider = {
  name: 'PureSMTP',
}

config.paytm = {
  mid:"rYfMjp59942238184300",//Real1118493922950513
  env: 'prod',//'dev',
  key:'hX1wv4y4HesuA371', //rtnD1e5&aTnQYzS7
  statusUrl: 'https://securegw.paytm.in/merchant-status/getTxnStatus',
  hostname: 'securegw.paytm.in', //for prod securegw.paytm.in
  callback: "https://merchant.com/callback",
  websiteName: "DEFAULT"
}

config.payubiz = {
  key:'rBajE2',
  salt:'t4ixqHwW'
}

config.mobikwik = {
  merchantIdentifier: process.env.MOBIKWIK_MERCHANT_ID,
  secret: process.env.MOBIKWIK_SECRET
}

// Sender Email Credentials and configurations
// config.smtp = {
//   port: "587",
//   username: 'info@real11.com',
//   password: '4yi&I!Z.lPXq',
//   fromEmail:'info@real11.com',
//   host: "mailer.datanetfantasy.co.in"
// }

config.smtp = {
  port: "587",
  username: 'marketinglyg7r0',
  password: 'marketinglyg7r0_070e6285170a1f31595e0e7f7b3e8db7',
  fromEmail: "info@real11.com", //'info@real11.com',
  host: "smtp.pepipost.com"
}

config.auth = {
  'facebook': {
    'clientID': '1556842837659191', // your App ID
    'clientSecret': '7abd7c14a319fb2cf065a0e4ce476532', // your App Secret
    'callbackURL': process.env.FACEBOOK_AUTH_CB_URL // 'http://localhost:8080/auth/facebook/callback'
  },
  'google': {
    'clientID': '514893100906-v9re7vgp91d54c6s58jroo2lhtvahr4p.apps.googleusercontent.com',
    'clientSecret': 'TNuQ80LETNeGSwqPr_P0ivtt',
    'callbackURL': process.env.GOOGLE_AUTH_CB_URL // 'http://localhost:8080/auth/google/callback'
  },
  'twitter': {
    'consumerKey': 'your-consumer-key-here',
    'consumerSecret': 'your-client-secret-here',
    'callbackURL': process.env.TWITTER_AUTH_CB_URL // 'http://localhost:8080/auth/twitter/callback'
  }
}

config.google = {
  "googleLatLong": "http://maps.googleapis.com/maps/api/geocode/json",
  "distanceMatrix": "https://maps.googleapis.com/maps/api/distancematrix/json",
  "key": process.env.GOOGLE_MAP_API_KEY, // Deprecated, use maps_key instead
  "maps_key": process.env.GOOGLE_MAP_API_KEY, // "AIzaSyA6c7T6R-2o_IKhRzZdvrhDu7qRyZPm_ek"
};

config.gamezop_api_key = "c9fe3d98-3197-11ec-8d3d-0242ac130003";

config.email = {
  feedback: 'rajatjain4061@gmail.com'
}

//defaults
config.defaults = {

}

//Set configs based on production env
if (PRATE_ENV === 'production') {
  config.express.ip = '0.0.0.0'
  config.express.isOnProduction = true;
} else {
  config.express.isOnProduction = false;
}

//Set base url of app
if (PRATE_ENV === 'production') {
  config.base_url = 'https://real11.com';
} else if (PRATE_ENV === 'staging'){
  config.base_url = 'https://staging-real11.com';
} else {
  config.base_url = 'http://52.66.207.107:4500';
}


//Set any configs that will need to run if we are running on any of the AWS instances
if (RUNNING_ON_AWS) {
  config.express.staticFilesPath = './dist/public';
} else {
  config.express.staticFilesPath = './client/public';
}

config.registration = {
  bypassEmail: false
};

config.tokenSecret = 'dfdsfsdfdsfd';
config.noAuthRoutes = ['login', 'verify-otp', 'signup'];
config.CRICKET_API = {
  URL: 'https://rest.entitysport.com/',
  ACCESS_KEY: '5d8e5148c337aa9833c798b8cc7c8c1a',
  SECRET_KEY: '6ca3a7909a9e0ff6f622884571f26b0c',
}

config.PAN_VERIFY_API = {
  URL: 'https://kyc-api.aadhaarkyc.io/api/v1/pan/pan',
  API_TOKEN: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDMyODIyNzIsIm5iZiI6MTYwMzI4MjI3MiwianRpIjoiNTM2MWNmNGYtNzcwYi00Y2UyLWJmYTEtYmY5N2QyNjI0NmY2IiwiZXhwIjoxOTE4NjQyMjcyLCJpZGVudGl0eSI6ImRldi5yZWFsMTFAYWFkaGFhcmFwaS5pbyIsImZyZXNoIjpmYWxzZSwidHlwZSI6ImFjY2VzcyIsInVzZXJfY2xhaW1zIjp7InNjb3BlcyI6WyJyZWFkIl19fQ.GRQOGCGPWBTTeRlAueJfjdFHD7TM8-UfRQlWmnzfJ5E',
}
config.BANK_VERIFY_API = {
  URL: process.env.CASHFREE_END_POINT || 'https://payout-gamma.cashfree.com/',
  API_TOKEN: 'Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE2MDMyODIyNzIsIm5iZiI6MTYwMzI4MjI3MiwianRpIjoiNTM2MWNmNGYtNzcwYi00Y2UyLWJmYTEtYmY5N2QyNjI0NmY2IiwiZXhwIjoxOTE4NjQyMjcyLCJpZGVudGl0eSI6ImRldi5yZWFsMTFAYWFkaGFhcmFwaS5pbyIsImZyZXNoIjpmYWxzZSwidHlwZSI6ImFjY2VzcyIsInVzZXJfY2xhaW1zIjp7InNjb3BlcyI6WyJyZWFkIl19fQ.GRQOGCGPWBTTeRlAueJfjdFHD7TM8-UfRQlWmnzfJ5E',
}

config.RAZOPAY_API = {
  BASIC_URL: 'https://api.razorpay.com/v1/',
  USER_NAME: process.env.RAZOPAY_USER_NAME,  //"rzp_test_8JVz4J7ikbp7Xq",
  PASSWORD: process.env.RAZOPAY_PASSWORD, //"ZUHnolptkSjsMB1Gz2cpf2d1",
  ACCOUNT_NUMBER: process.env.RAZOPAY_ACCOUNT_NUMBER, //"2323230094748663",
  WEBHOOK_SECRET: process.env.RAZOPAY_WEBHOOK_SECRET, //"123456789"
}

config.DateFormat = {
  date: 'YYYY-MM-DD',
  time: 'HH:mm',
  datetime: 'YYYY-MM-DD HH:mm:ss',
}

config.redis = {
  // host: 'localhost', //'reall11redis.kayq2e.0001.aps1.cache.amazonaws.com',
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.leaderboard_redis = {
  host: process.env.LEARBOARD_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.lf_redis = {
  host: process.env.LF_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.lf_redis_leaderboard = {
  host: process.env.LF_LEADER_BOARD_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.useranalysis_redis = {
  // host: 'localhost', //'redis-leaderboard.k6nkix.ng.0001.aps1.cache.amazonaws.com',
  host: process.env.USER_ANALYSIS_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.login_redis = {
  host: process.env.LOGIN_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.my_matches_redis = {
  host: process.env.MY_MATCHES_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.my_teams_redis = {
  host: process.env.MY_TEAAMS_REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
}

config.mqtt = {
  host: process.env.MQTT_HOST || '13.235.132.140',
  port: process.env.MQTT_PORT || 1883,
  username: process.env.MQTT_USER || "",
  password: process.env.MQTT_PASS || "",
}

config.ludo_mqtt = {
  host: process.env.LUDO_MQTT_HOST || '13.232.103.230',
  port: process.env.LUDO_MQTT_PORT || 1883,
  username: process.env.LUDO_MQTT_USER || "",
  password: process.env.LUDO_MQTT_PASS || "",
}

config.other_games_mqtt = {
  host: process.env.OTHER_GAME_MQTT_HOST || '',
  port: process.env.OTHER_GAME_MQTT_PORT || 1883,
  username: process.env.OTHER_GAME_USER || "",
  password: process.env.OTHER_GAME_PASS || "",
  keepalive: 1
}
 
// This is used to define cat for user according to contest cat
config.user_category = {
  beginner_cat: '600a7d84a3d2553aa779eae7',
  super_cat:'608f9b833f625d05d4529c16',
  dimond_cat:'608f907c3f625d05d4529c0f',
  looser_cat:'60e6acade5696160409cfd59'
}
config.user_category_prod = {
  beginner_cat: '6013ab6f53fe1866314c58ec',
  super_cat:'6013aba953fe1866314c58ed',
  dimond_cat:'6013abf553fe1866314c58ee',
  looser_cat:'60ebe0a81de3382a0b48cde2'
}

config.private_category = {
  id: '61385d45a67c543121311a6b',
  cat_name:'Friend Private Contest',
  cat_des:'Join with your friends'
}
config.youtuber_bcode = [
  {'code':'NM333','name':'shashi','applied':true},
  {'code':'FC111','name':'fcg','applied':true},
  {'code':'AD007','name':'anurag','applied':true},
  {'code':'KS001','name':'kisan','applied':true},
  {'code':'AK21','name':'ak','applied':true},
  {'code':'GT999','name':'gt','applied':true},
  {'code':'CR222','name':'cr','applied':true},
  {'code':'SG457','name':'saurab','applied':true}
]

config.contest_bonous = [
  {'contest_id':'5f306f878ca80a108035d6fb','bonus_amount':241.0},
  {'contest_id':'5f306f888ca80a10803c063f','bonus_amount':378}, 
  {'contest_id':'5f306f878ca80a108035d6f5','bonus_amount':175},
  {'contest_id':'5f306f878ca80a108035d6f9','bonus_amount':157}, 
  {'contest_id':'5f306f878ca80a108035d6f3','bonus_amount':50},
  {'contest_id':'5f306f878ca80a108035d6e9','bonus_amount':71},
  {'contest_id':'5f7a31328d4c9c0ac0d9e725','bonus_amount':101},
  {'contest_id':'5f306f8e8ca80a108075128b','bonus_amount':44},
  {'contest_id':'5f306f8e8ca80a108075119b','bonus_amount':55},
  {'contest_id':'5f306f878ca80a108035d6df','bonus_amount':28},
  {'contest_id':'5f306f878ca80a108035e25f','bonus_amount':24},
  {'contest_id':'5fc65886fec9f41e8fd9f7bf','bonus_amount':600},
  {'contest_id':'5f306f878ca80a108036133b','bonus_amount':200},
  {'contest_id':'5f306f878ca80a108035d60b','bonus_amount':151},
  {'contest_id':'5f306f878ca80a108035da89','bonus_amount':200},
  {'contest_id':'5f306f878ca80a10803612bd','bonus_amount':96},
  {'contest_id':'5f306f878ca80a10803612d7','bonus_amount':91},
  {'contest_id':'5f306f908ca80a1080930daf','bonus_amount':51},
  {'contest_id':'5f306f878ca80a108035d5f9','bonus_amount':15},
  {'contest_id':'5f306f878ca80a108035e237','bonus_amount':15}
]

config.admin_percentage = 10.00;
config.contest_commission = 10.00;
config.referral_bouns_amount = 50.00;
config.min_withdraw_amount = 200.00;
config.extra_bonus_percent_amount = 20;
config.extra_bonus_perday_limit = 500;
config.total_user_ref_earned = 75;

// Appsflyer URL for Android and iphone
config.appsFlyerAndroidUrl = "https://api2.appsflyer.com/inappevent/os.real11";
config.appsFlyerAndroidPlaystorUrl = "https://api2.appsflyer.com/inappevent/ps.real11";
// config.appsFlyerAndroidPlaystorProUrl = "https://api2.appsflyer.com/inappevent/ps.pro.real11";
config.appsFlyerAndroidPlaystorProUrl = "https://api2.appsflyer.com/inappevent/ps.cash.real11";
config.appsFlyeriPhoneUrl = "https://api2.appsflyer.com/inappevent/id1455728625";

config.imageBaseUrl = process.env.IMAGE_BASE_URL || 'https://real11-images.s3.ap-south-1.amazonaws.com';
// config.imageBaseUrl = process.env.IMAGE_BASE_URL || 'https://real-11-dev.s3.ap-south-1.amazonaws.com'; 

config.maxPhotoUploadSize = 6 * 1024 * 1024; // 6M
config.sendgridApiKey = "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"; 
config.fcmKey = process.env.FCM_KEY || "";

config.developerEmail = process.env.DEVELOPER_EMAIL || 'nidhimittal@real11.com';


config.series_squad_table= 'series_squad',
config.player_team_table= 'player_team',
config.player_team_contest_table ='player_team_contest',
config.aws_local_config= {
  //Provide details for local configuration
}
config.dynomoEndpoint = process.env.dynomoEndpoint || "real11board.dqgxma.clustercfg.dax.use2.cache.amazonaws.com:8111"
config.aws_remote_config= {
  accessKeyId: process.env.AWSAccessKeyId || 'AKIAX6QEEIHVI2WOTOJ2' ,
  secretAccessKey: process.env.AWSSecretKey || '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',
  region: 'ap-south-1',
}

config.withdraw_commission = 10
config.ent_redis = {
  host: process.env.ENT_REDIS_HOST || 'localhost',
  port: 16433
}

