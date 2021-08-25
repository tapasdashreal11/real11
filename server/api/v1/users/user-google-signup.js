const { ObjectId } = require('mongodb');
const BankDetails = require("../../../models/user-bank-details");
const Users = require("../../../models/user");
const Tokens = require("../../../models/token");
const PanDetails = require("../../../models/user-pan-details");
const UserReferral = require("../../../models/user-referral-code-details");
const Profile = require("../../../models/user-profile");
const { Validator } = require("node-input-validator");
const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const logger = require("../../../../utils/logger")(module);
const { currentDateTimeFormat, createUserReferal, generateTransactionId, generateClientToken, createTeamName, sendSMTPMail } = require("../common/helper");
const config = require('../../../config');
const _ = require('lodash');
const moment = require('moment');
const redis = require('../../../../lib/redis');
const Helper = require('./../common/helper');
const { appsFlyerEntryService } = require("./appsflyer-api");
const { facebookEntryService } = require("./facebook-api");
var sha256 = require('sha256');
const { RedisKeys } = require('../../../constants/app');

module.exports = {
    userGoogleSignIn: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let appsflyerURL = "";
            let params = req.body;
            let constraints = { google_id: "required", email: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            try {
                var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                let userGmailsignup = await Users.findOne({ google_id: params.google_id, email: params.email });
                if (userGmailsignup && userGmailsignup._id) {
                    if (_.isEmpty(userGmailsignup.phone) || _.isUndefined(userGmailsignup.phone) || _.isNull(userGmailsignup.phone)) {
                        response["message"] = "Please enter your phone number.";
                        response["status"] = true;
                        response["data"] = {_id: userGmailsignup._id, user_id: userGmailsignup._id, email: userGmailsignup.email, google_id: userGmailsignup.google_id };
                        response["login_success"] = false;
                        response["otp_status"] = false;
                        return res.json(response);
                    } else {
                        if (userGmailsignup && userGmailsignup.status) {
                            var finalResponse = {};
                            finalResponse = userGmailsignup;
                            finalResponse.is_youtuber = (finalResponse.is_youtuber == 1) ? true : false;
                            let tokendata = {};
                            tokendata.language = userGmailsignup.language || 'en';
                            tokendata._id = userGmailsignup._id;
                            tokendata.id = userGmailsignup._id;
                            tokendata.phone = userGmailsignup.phone;
                            tokendata.email = userGmailsignup.email;

                            await Tokens.deleteMany({ "userId": ObjectId(userGmailsignup._id) });
                            let token = await generateClientToken(tokendata);
                            await Users.updateOne({ _id: userGmailsignup._id }, { $set: { otp: '', otp_time: '', token: token } });
                            let tokenInsertData = {};
                            tokenInsertData.userId = new ObjectId(userGmailsignup._id);
                            tokenInsertData.token = token;
                            tokenInsertData.device_id = params.device_id;
                            tokenInsertData.device_type = params.device_type;
                            finalResponse.token = token;

                            Tokens.create(tokenInsertData);
                            try {
                                delete finalResponse.password;
                                delete finalResponse.otp;
                            } catch (eror) { }
                            //****************Set Toen In Redis**************** */
                            var newTokenObj = { user_id: userGmailsignup._id, token: token }
                            redis.setRedisLogin(RedisKeys.USER_AUTH_CHECK + userGmailsignup._id, newTokenObj);
                            //************************************************************** */
                            response["message"] = "Successfully login!!";
                            response["status"] = true;
                            response["token"] = token;
                            response["data"] = finalResponse;
                            response["login_success"] = true;
                            return res.json(response);

                        } else {
                            var otpRes = await sendOtp(userGmailsignup);
                            return res.json(otpRes);
                        }
                    }
                } else {
                    let userEmail = await Users.findOne({ email: params.email }, { _id: 1, google_id: 1, email: 1, phone: 1 });
                    if (!userEmail) {
                        let insertData = {};
                        insertData.google_id = params.google_id;
                        insertData.email = params.email;
                        insertData.language = params.language || 'en';
                        insertData.invite_code = params.invite_code;
                        insertData.clevertap_id = params.clevertap_id || '';
                        insertData.appsflayer_id = params.appsflayer_id || '';
                        insertData.refer_id = createUserReferal(10);
                        insertData.isFirstPaymentAdded = 2;
                        insertData.is_beginner_user = 1;
                        if (params && params.user_gaid) {
                            insertData.user_gaid = params.user_gaid;
                        }
                        if (params && params.dcode) {
                            insertData.dcode = params.dcode;
                        }
                        if (params && params.device_id)
                            insertData.device_id = params.device_id;

                        if (params && params.device_type) {
                            insertData.device_type = params.device_type;
                            if (params.device_type == "Android") {
                                appsflyerURL = config.appsFlyerAndroidUrl;
                            } else {
                                appsflyerURL = config.appsFlyeriPhoneUrl;
                            }
                        }
                        insertData.team_name = createTeamName(params.email);
                        insertData.bonus_amount = config.referral_bouns_amount;
                        insertData.extra_amount = 25; // first time user signup
                        insertData.image = '';
                        insertData.status = 0;
                        insertData.avatar = 'boy.png';
                        insertData.refer_able = 1;

                        let full_name = params.name;

                        if (params.name && full_name != '') {
                            full_name = full_name.split(' ');

                            let firstName = full_name[0];
                            let lastName = '';
                            if (full_name[1]) {
                                lastName = full_name[1];
                            }
                            insertData.first_name = firstName;
                            insertData.last_name = lastName;

                        }
                        var otp = Math.floor(100000 + Math.random() * 900000);
                        insertData.otp = otp;
                        let otp_time = currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
                        insertData.otp_time = otp_time;

                        insertData.ip_address = userIp;

                        response["message"] = "Registered successfully.Please enter your mobile number";

                        const user = await Users.create(insertData);
                        try {
                            if (params && params.device_id) {
                                Helper.sendNotificationFCM(insertId, 12, params.device_id, 'Welcome !!', 'Complete next step to successfully singup.');
                            }
                        } catch (errr) { }
                        const insertId = user._id;
                        insertData.user_id = insertId;

                        try {
                            if (insertId) {
                                let redisKeyForUserCategory = 'user-category-' + insertId;
                                let userCatObj = {
                                    is_super_user: 0,
                                    is_dimond_user: 0,
                                    is_beginner_user: 1,
                                    is_looser_user: 0
                                };
                                redis.setRedisForUserCategory(redisKeyForUserCategory, userCatObj);
                            }
                        } catch (errrrrr) {
                            console.log('insertId*** errrr', insertId, errrrrr);
                        }

                        response["status"] = true;
                        response["data"] = { user_id: insertId, email: params.email, google_id: params.google_id };
                        response["login_success"] = false;
                        response["otp_status"] = false;
                        response["google_signup_status"] = true;
                        // After successfully signup entery data in appsflyer
                        try {
                            if (params && params.appsflayer_id) {
                                let event_val = {
                                    "appsflyer_id": params.appsflayer_id || '',
                                    "af_customer_user_id": params.clevertap_id || '',
                                    "af_email": params.email || '',
                                    'advertising_id': params && params.user_gaid ? params.user_gaid : ''
                                };
                                var signUpBody = {
                                    "eventName": "SignUp",
                                    "appsflyer_id": params.appsflayer_id || '',
                                    "customer_user_id": insertId || '',
                                    "eventTime": new Date(),
                                    'advertising_id': params && params.user_gaid ? params.user_gaid : '',
                                    "eventValue": JSON.stringify(event_val)
                                };

                                if (!_.isEmpty(params.email)) {
                                    appsFlyerEntryService(signUpBody, appsflyerURL);
                                    try {
                                        let fb_event = {
                                            "data": [
                                                {
                                                    "event_name": "CompleteRegistration",
                                                    "event_time": parseInt(new Date().getTime() / 1000),
                                                    "event_source_url": "real11.com/s2",
                                                    "opt_out": false,
                                                    "event_id": Math.floor(1000000 + Math.random() * 9000000),
                                                    "user_data": {
                                                        "em": params && params.email ? sha256(params.email) : null,
                                                        "fbc": params && params.fbc_id ? params.fbc_id : null,
                                                        "fn": insertData && insertData.team_name ? sha256(insertData.team_name) : null,
                                                        "client_ip_address": userIp || "172.17.0.5",
                                                        "client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                                    },
                                                    "custom_data": {
                                                        "value": 1,
                                                        "currency": "INR"
                                                    },
                                                    "action_source": "website"
                                                }
                                            ]
                                        }
                                        facebookEntryService(fb_event, '');
                                    } catch (errfb) { }

                                }
                            }

                        } catch (errr) {
                            console.log('errr', errr);
                        }
                        return res.json(response);
                    } else {
                        await Users.findOneAndUpdate({ _id: userEmail._id }, { $set: { google_id: params.google_id, status: 0 } });
                        if (userEmail && userEmail.phone && !_.isEmpty(userEmail.phone)) {
                            userEmail['google_id'] = params.google_id;
                            let otpRes = await sendOtp(userEmail);
                            return res.json(otpRes);
                        } else {
                            response["message"] = "Please enter your phone number.";
                            response["status"] = true;
                            response["data"] = { user_id: userEmail._id, email: userEmail.email, google_id: userEmail.google_id };
                            response["login_success"] = false;
                            response["otp_status"] = false;
                            return res.json(response);
                        }
                    }
                }
            } catch (err) {
                console.log("google signup errro", err);
                response["message"] = "Something went wrong !!";
                return res.json(response);
            }
        } catch (error) {
            logger.error("Google_ERROR", error.message);
            var response = { status: false, message: "Something went wrong. Please try again!!", data: {} };
            //send mail to developer to debug purpose
            Helper.sendMailToDeveloper(req, error.message);  
            return res.json(response);
        }
    },
    userGoogleSignUpDetailAdd: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { phone: "required", google_id: "required", email: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            let userGmailsignup = await Users.findOne({ google_id: params.google_id, email: params.email }, { _id: 1, google_id: 1, email: 1, phone: 1 });
            console.log('params.phone****',params);
            console.log('userGmailsignup****',userGmailsignup);
            if (userGmailsignup && userGmailsignup._id && params.phone && _.size(params.phone) > 9) {
                let phone_number = userGmailsignup.phone ? userGmailsignup.phone : '';
                if (!_.isEmpty(phone_number) && phone_number.length > 1) {
                    if (_.isEqual(phone_number, params.phone)) {
                        var otpRes = await sendOtp(userGmailsignup);
                        return res.json(otpRes);
                    } else {
                        response["message"] = "You have already registered with " + phone_number + " number on this account!!";
                        response["errors"] = validator.errors;
                        return res.json(response);
                    }
                } else {
                    let userEmailData = await Users.findOne({ phone: params.phone }, { _id: 1 });
                    if (userEmailData && userEmailData._id) {
                        response["message"] = "This mobile number is already registered!!";
                        return res.json(response);
                    } else {
                        await Users.updateOne({ _id: userGmailsignup._id }, { $set: { temp_phone: params.phone } });
                        userGmailsignup['phone'] = params.phone;
                        var otpRes = await sendOtp(userGmailsignup);
                        return res.json(otpRes);
                    }

                }
            } else {
                response["message"] = "Invalid data!!";
                response["errors"] = validator.errors;
                return res.json(response);
            }
        } catch (err) {
            console.log('update signup err', err);
            var response = { status: false, message: "Something went wrong. Please try again!!", data: {} };
            //send mail to developer to debug purpose
            Helper.sendMailToDeveloper(req, err.message);
            return res.json(response);
        }
    },
    userSignup: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let appsflyerURL = "";
            let params = req.body;
            let constraints = { mobile_number: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }

            try {
                var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                const beforeHalfHrDate = moment().add(-30, 'm').toDate();
                let userCount = await Users.find({ created: { $gt: beforeHalfHrDate }, ip_address: userIp }).countDocuments();
                if (userCount >= 20) {
                    response["message"] = "There is some technical issue, please try after some time.";
                    return res.json(response);
                }
                if (params && params.mobile_number && _.size(params.mobile_number) > 9) {
                    console.log('params***',params);
                    let userPhone = await Users.findOne({ phone: params.mobile_number }, { _id: 1, google_id: 1, email: 1, phone: 1 });
                    if (!userPhone) {
                        let referal_code_detail = {};
                        if (!_.isEmpty(params.invite_code)) {
                            var caps_invite_code = params.invite_code.toUpperCase();
                            let inviteDetails = await Users.findOne({ refer_id: caps_invite_code });
                            if (!_.isEmpty(inviteDetails)) {
                                referal_code_detail.referal_code = caps_invite_code;
                                referal_code_detail.refered_by = new ObjectId(inviteDetails._id);
                                referal_code_detail.user_amount = config.total_user_ref_earned;
                                referal_code_detail.status = 1;
                            } else {
                                response["message"] = "Invalid invite code.";
                                return res.json(response);
                            }
                        }

                        // now start
                        let insertData = {};
                        insertData.temp_phone = params.mobile_number;
                        insertData.language = params.language;
                        insertData.invite_code = params.invite_code;
                        insertData.clevertap_id = params.clevertap_id || '';
                        insertData.appsflayer_id = params.appsflayer_id || '';
                        insertData.refer_id = createUserReferal(10);
                        insertData.isFirstPaymentAdded = 2;
                        insertData.is_beginner_user = 1;
                        if (params && params.user_gaid) {
                            insertData.user_gaid = params.user_gaid;
                        }
                        if (params && params.dcode) {
                            insertData.dcode = params.dcode;
                        }
                        if (params && params.device_id)
                            insertData.device_id = params.device_id;

                        if (params && params.device_type) {
                            insertData.device_type = params.device_type;
                            if (params.device_type == "Android") {
                                appsflyerURL = config.appsFlyerAndroidUrl;
                            } else {
                                appsflyerURL = config.appsFlyeriPhoneUrl;
                            }
                        }
                        let userName = await getUserName();
                        insertData.team_name = userName + new Date().getUTCMilliseconds().toString() ;
                        insertData.bonus_amount = config.referral_bouns_amount;
                        insertData.extra_amount = 25; // first time user signup
                        insertData.image = '';
                        insertData.status = 0;
                        insertData.avatar = 'boy.png';
                        insertData.refer_able = 1;
                        let full_name = params.name;

                        if (params.name && full_name != '') {
                            full_name = full_name.split(' ');

                            let firstName = full_name[0];
                            let lastName = '';
                            if (full_name[1]) {
                                lastName = full_name[1];
                            }
                            insertData.first_name = firstName;
                            insertData.last_name = lastName;

                        }
                        var otp = Math.floor(100000 + Math.random() * 900000);
                        insertData.otp = otp;
                        let otp_time = currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
                        insertData.otp_time = otp_time;

                        insertData.ip_address = userIp;

                        response["message"] = "Registered successfully.";

                        const user = await Users.create(insertData);

                        const insertId = user._id;
                        let transId = generateTransactionId('credit', insertId);

                        const msg = otp + " is the OTP for your Real11 account. Never share your OTP with anyone.";
                        let userMobile = params.mobile_number || '';
                        sendSMS(userMobile, msg)
                            .then(() => { })
                            .catch(err => {
                                console.log("error in sms API ", err);
                                logger.error("MSG_ERROR", err.message);
                            });

                        let bank_details = {};
                        bank_details.user_id = insertId;
                        await BankDetails.create(bank_details);
                        await Profile.create(bank_details);
                        await PanDetails.create(bank_details);
                        try {
                            if (params && params.device_id) {
                                Helper.sendNotificationFCM(insertId, 12, params.device_id, 'Welcome Bonus!!', 'Kick start your journey with 100% deposit bonus. Make your initial deposit in wallet to avail this reward.');
                            }
                        } catch (errr) { }

                        try {
                            if (insertId) {
                                let redisKeyForUserCategory = 'user-category-' + insertId;
                                let userCatObj = { is_super_user: 0, is_dimond_user: 0, is_beginner_user: 1, is_looser_user: 0 };
                                redis.setRedisForUserCategory(redisKeyForUserCategory, userCatObj);
                            }
                        } catch (redisErr) {
                            console.log('insertId*** redisErr', insertId, redisErr);
                        }

                        insertData.user_id = insertId;
                        insertData.otp = 0;

                        if (!_.isEmpty(referal_code_detail)) {
                            referal_code_detail.user_id = insertId;
                            await UserReferral.create(referal_code_detail);
                        }
                        console.log('hello down****');
                        response["status"] = true;
                        response["data"] = { _id: user._id,user_id: user._id, email: user.email, phone: params.mobile_number, google_id: user.google_id };
                        response["login_success"] = false;
                        response["otp_status"] = true;
                        // After successfully signup entery data in appsflyer
                        try {
                            if (params && params.appsflayer_id) {
                                let event_val = {
                                    "appsflyer_id": params.appsflayer_id || '',
                                    "af_customer_user_id": params.clevertap_id || '',
                                    "af_email": params.email || '',
                                    "af_mobile": params.mobile_number || '',
                                    'advertising_id': params && params.user_gaid ? params.user_gaid : ''
                                };
                                var signUpBody = {
                                    "eventName": "SignUp",
                                    "appsflyer_id": params.appsflayer_id || '',
                                    "customer_user_id": insertId || '',
                                    "eventTime": new Date(),
                                    'advertising_id': params && params.user_gaid ? params.user_gaid : '',
                                    "eventValue": JSON.stringify(event_val)
                                };

                                if (_.isEmpty(params.invite_code)) {
                                    appsFlyerEntryService(signUpBody, appsflyerURL);
                                    try {
                                        let fb_event = {
                                            "data": [
                                                {
                                                    "event_name": "CompleteRegistration",
                                                    "event_time": parseInt(new Date().getTime() / 1000),
                                                    "event_source_url": "real11.com/s2",
                                                    "opt_out": false,
                                                    "event_id": Math.floor(1000000 + Math.random() * 9000000),
                                                    "user_data": {
                                                        "em": params && params.email ? sha256(params.email) : null,
                                                        "ph": params && params.mobile_number ? sha256(params.mobile_number) : null,
                                                        "fbc": params && params.fbc_id ? params.fbc_id : null,
                                                        "fn": insertData && insertData.team_name ? sha256(insertData.team_name) : null,
                                                        "client_ip_address": userIp || "172.17.0.5",
                                                        "client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                                    },
                                                    "custom_data": {
                                                        "value": 1,
                                                        "currency": "INR"
                                                    },
                                                    "action_source": "website"
                                                }
                                            ]
                                        }
                                        facebookEntryService(fb_event, '');
                                    } catch (errfb) { }

                                }
                            }

                        } catch (errr) {
                            console.log('errr', errr);
                        }
                        return res.json(response);

                    } else {
                        response['message'] = 'This number is already registered!!' 
                        return res.json(response);
                    }
                } else {
                    return res.json(response);
                }
            } catch (err) {
                response["message"] = err.message;
                return res.json(response);
            }
        } catch (error) {
            logger.error("LOGIN_ERROR", error.message);
            var response = { status: false, message: "Something went wrong. Please try again!!", data: {} };
            //send mail to developer to debug purpose
            Helper.sendMailToDeveloper(req, error.message);
            return res.json(response);
        }
    },
    userNormalSignUpDetailUpdate: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { phone: "required", password: "required", email: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            let userGmailsignup = await Users.findOne({ phone: params.phone }, { _id: 1, google_id: 1, email: 1, phone: 1 });
            if (userGmailsignup && userGmailsignup._id) {
                let userEmailData = await Users.findOne({ email: params.email }, { _id: 1 });
                if (userEmailData) {
                    response["message"] = "This email is already registered!!";
                    return res.json(response);
                } else {
                    await Users.updateOne({ _id: userGmailsignup._id }, { $set: { password: params.password, email: params.email } });
                    response["message"] = "Updated successfully!!";
                    response["status"] = true;
                    return res.json(response);
                }

            } else {
                response["message"] = "Invalid data!!";
                response["errors"] = validator.errors;
                return res.json(response);
            }
        } catch (err) {
            var response = { status: false, message: "Invalid Request", data: {} };
             //send mail to developer to debug purpose
             Helper.sendMailToDeveloper(req, error.message);
            return res.json(response);
        }


    },
    userAvtarUpdate: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            const user_id = req.userId;
            let constraints = { avatar: "required"};
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            let userGmailsignup = await Users.findOneAndUpdate({ _id: user_id }, { $set: { avatar: params.avatar} });
            if (userGmailsignup && userGmailsignup._id) {
                response["message"] = "Updated successfully!!";
                response["status"] = true;
                return res.json(response);

            } else {
                response["message"] = "Invalid data!!";
                response["errors"] = validator.errors;
                return res.json(response);
            }
        } catch (err) {
            var response = { status: false, message: "Invalid Request", data: {} };
            return res.json(response);
        }


    }
}

/**
 * Send otp funnction is used to send otp phone message on registered numbers
 * @param user
 */
async function sendOtp(user) {
    var response = {}
    let data = user;
    var otp = Math.floor(100000 + Math.random() * 900000);
    user.otp = otp;
    let otp_time = currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
    user.otp_time = otp_time;
    data.otp = "0";
    data.otp_time = otp_time;
    const msg = otp + " is the OTP for your Real11 account. Never share your OTP with anyone.";
    let userMobile = user.phone || '';
    sendSMS(userMobile, msg)
        .then(() => { })
        .catch(err => {
            console.log("error in sms API ", err);
            logger.error("MSG_ERROR", err.message);
        });
    let mailMessage = "<div><h3>OTP Request</h3><p>Hi,</p><p>You One Time Password(OTP) is <b>" + otp + "</b></p><p>The password will expire in 10 minnutes if not used.</p><p>If you have not made this request, please contact our customer support immidiately.</p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>"
    let to = data.email;
    let subject = "One Time Password (OTP) login to Real11";
    //if(data && data.email) sendSMTPMail(to, subject, mailMessage);
    response["message"] = "Otp has been sent on you registered phone number, please enter otp to complete login.";
    await Users.updateOne({ _id: user._id }, { $set: { otp: otp, otp_time: otp_time } });

    response["status"] = true;
    response["data"] = { user_id: data._id, email: data.email, phone: data.phone, google_id: data.google_id };
    response["login_success"] = false;
    response["otp_status"] = true;
    return response;
}
/**
 * Generate random team/user name 
 */
async function getUserName()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < 11; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}