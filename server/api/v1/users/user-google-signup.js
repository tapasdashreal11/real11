const { ObjectId } = require('mongodb');
// const BankDetails = require("../../../models/user-bank-details");
const Users = require("../../../models/user");
const PaymentOptions = require("../../../models/payment-options");
const Tokens = require("../../../models/token");
// const PanDetails = require("../../../models/user-pan-details");
const UserReferral = require("../../../models/user-referral-code-details");
const Profile = require("../../../models/user-profile");
const { Validator } = require("node-input-validator");
// const ApiUtility = require("../../api.utility");
const { sendSMS } = require("./smsApi");
const logger = require("../../../../utils/logger")(module);
const { currentDateTimeFormat, createUserReferal, generateTransactionId, generateClientToken, createTeamName, sendSMTPMail } = require("../common/helper");
const config = require('../../../config');
const _ = require('lodash');
const moment = require('moment');
const redis = require('../../../../lib/redis');
const redisEnt = require('../../../../lib/redisEnterprise');
const Helper = require('./../common/helper');
// var sha256 = require('sha256');
const { RedisKeys } = require('../../../constants/app');
const ReferalUsersAminMetaData = require("../../../models/ref-user-admin-meta");
const AppSettings = require("../../../models/settings");

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
                        response["data"] = { _id: userGmailsignup._id, user_id: userGmailsignup._id, email: userGmailsignup.email, google_id: userGmailsignup.google_id };
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
                               
                                finalResponse.temp_email = userGmailsignup && userGmailsignup.email ? userGmailsignup.email:"";
                                
                            } catch (eror) { }
                            //****************Set Toen In Redis**************** */
                            var newTokenObj = { user_id: userGmailsignup._id, token: token }
                            // redis.setRedisLogin(RedisKeys.USER_AUTH_CHECK + userGmailsignup._id, newTokenObj);
                            redisEnt.setNormalRedis(RedisKeys.USER_AUTH_CHECK + userGmailsignup._id, newTokenObj);
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
                        let rf_xtra_amount = 0;
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

                        if (params && params.app_source)
                            insertData.app_source = params.app_source;

                        if (params && params.device_type) {
                            insertData.device_type = params.device_type;
                            if (params.device_type == "Android") {
                                appsflyerURL = config.appsFlyerAndroidUrl;
                            } else {
                                appsflyerURL = config.appsFlyeriPhoneUrl;
                            }
                        }
                        insertData.team_name = createTeamName(params.email);
                        insertData.bonus_amount = 0;// config.referral_bouns_amount;
                        insertData.extra_amount = rf_xtra_amount; // first time user signup
                        insertData.image = '';
                        insertData.status = 0;
                        insertData.avatar = 'avatar20';
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
                        const insertId = user._id;
                        try {

                            if (params && params.device_id) {
                                Helper.sendNotificationFCM(insertId, 12, params.device_id, 'Welcome Bonus!!', 'Kick start your journey with 100% deposit bonus. Make your first deposit in wallet to avail this reward.');
                            }
                        } catch (errr) { }

                        insertData.user_id = insertId;
                        let bank_details = {};
                        bank_details.user_id = insertId;
                        // await BankDetails.create(bank_details);
                        await Profile.create(bank_details);
                        // await PanDetails.create(bank_details);

                        try {
                            if (insertId) {
                                let redisKeyForUserCategory = 'user-category-' + insertId;
                                let userCatObj = { is_super_user: 0, is_dimond_user: 0, is_beginner_user: 1, is_looser_user: 0 };
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

                    let userPhone = await Users.findOne({ phone: params.mobile_number }, { _id: 1, google_id: 1, email: 1, phone: 1 });
                    if (!userPhone) {
                        let referal_code_detail = {};
                        let insertData = {};
                        let rf_xtra_amount = 0;
                        if (!_.isEmpty(params.invite_code)) {
                            var caps_invite_code = params.invite_code.toUpperCase();
                            let real11Code = caps_invite_code.substring(0, 3);
                            let inviteDetails = {};
                            if (real11Code == "REL") {
                                inviteDetails = await Users.findOne({ refer_id: "IPL200" });
                                referal_code_detail.sub_referal_code = "IPL200";
                            } else {
                                inviteDetails = await Users.findOne({ refer_id: caps_invite_code });
                            }
                            //let inviteDetails = await Users.findOne({ refer_id: caps_invite_code });
                            if (!_.isEmpty(inviteDetails)) {
                                referal_code_detail.referal_code = caps_invite_code;
                                referal_code_detail.refered_by = new ObjectId(inviteDetails._id);
                                referal_code_detail.user_amount = 75; //config.total_user_ref_earned;
                                referal_code_detail.status = 1;
                                insertData.is_refered_by = true;
                                //ReferalUsersAminMetaData.findOneAndUpdate({_id:inviteDetails._id},{})
                                if (inviteDetails && !inviteDetails.is_youtuber) {
                                    let refral_counters = inviteDetails.ref_counter ? inviteDetails.ref_counter : 0;
                                    let refral_counters_used = inviteDetails.ref_counter_used ? inviteDetails.ref_counter_used : 0;
                                    let diffRef = refral_counters - refral_counters_used;
                                    let incObj = { ref_counter: 1 };
                                    if (refral_counters > refral_counters_used && diffRef > 9) {
                                        incObj['ref_counter_used'] = 10;
                                        let email = inviteDetails && inviteDetails.email ? inviteDetails.email : '';
                                        let phone = inviteDetails && inviteDetails.phone ? inviteDetails.phone : '';
                                        ReferalUsersAminMetaData.create({ email: email, phone: phone, user_id: inviteDetails._id, refer_id: caps_invite_code, ref_count: 10 });
                                        sendEmailToAdmin(caps_invite_code, email, phone);
                                    }
                                    await Users.findOneAndUpdate({ _id: inviteDetails._id }, { $inc: incObj });
                                }
                                if (referal_code_detail && referal_code_detail.sub_referal_code && _.isEqual(referal_code_detail.sub_referal_code, "IPL200")) {
                                    rf_xtra_amount = 75;
                                } else if (referal_code_detail && referal_code_detail.referal_code && _.isEqual(referal_code_detail.referal_code, "RWC100")) {
                                    rf_xtra_amount = 75;
                                }
                            } else {
                                response["message"] = "Invalid invite code.";
                                return res.json(response);
                            }
                        }
                        // now start
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
                        if (params && params.temp_email) {
                            insertData.temp_email = params.temp_email;
                        }
                        if (params && params.device_id)
                            insertData.device_id = params.device_id;
                            
                        if (params && params.app_source)
                            insertData.app_source = params.app_source;

                        if (params && params.device_type) {
                            insertData.device_type = params.device_type;
                            if (params.device_type == "Android") {
                                appsflyerURL = config.appsFlyerAndroidUrl;
                            } else {
                                appsflyerURL = config.appsFlyeriPhoneUrl;
                            }
                        }
                        let userName = await getUserName();
                        insertData.team_name = userName + new Date().getUTCMilliseconds().toString();
                        insertData.bonus_amount = 0; //config.referral_bouns_amount;
                        insertData.extra_amount = rf_xtra_amount; // first time user signup
                        insertData.image = '';
                        insertData.status = 0;
                        insertData.avatar = 'avatar20';
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
                        //  await BankDetails.create(bank_details);
                        await Profile.create(bank_details);
                        // await PanDetails.create(bank_details);
                        try {

                            if (params && params.device_id) {
                                Helper.sendNotificationFCM(insertId, 12, params.device_id, 'Welcome Bonus!!', 'Kick start your journey with 100% deposit bonus. Make your first deposit in wallet to avail this reward.');
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
                        response["status"] = true;
                        response["data"] = { _id: user._id, user_id: user._id, email: user.email, phone: params.mobile_number, google_id: user.google_id };
                        response["login_success"] = false;
                        response["otp_status"] = true;
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
            const user_id = req.userId;
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
                let userEmailData = await Users.findOne({ _id: { $ne: userGmailsignup._id }, email: params.email }, { _id: 1 });
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
            let constraints = { avatar: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            let userGmailsignup = await Users.findOneAndUpdate({ _id: user_id }, { $set: { avatar: params.avatar } });
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


    },
    userAppleSignIn: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { apple_id: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            try {
                var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                let qury_prms = { apple_id: params.apple_id };
                // if(params && params.email) qury_prms['email'] = params.email
                let userGmailsignup = await Users.findOne(qury_prms);
                if (userGmailsignup && userGmailsignup._id) {
                    if (_.isEmpty(userGmailsignup.phone) || _.isUndefined(userGmailsignup.phone) || _.isNull(userGmailsignup.phone)) {
                        response["message"] = "Please enter your phone number.";
                        response["status"] = true;
                        response["data"] = { _id: userGmailsignup._id, user_id: userGmailsignup._id, email: userGmailsignup.email, apple_id: userGmailsignup.apple_id };
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
                            tokendata.apple_id = userGmailsignup.apple_id;

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
                            // redis.setRedisLogin(RedisKeys.USER_AUTH_CHECK + userGmailsignup._id, newTokenObj);
                            redisEnt.setNormalRedis(RedisKeys.USER_AUTH_CHECK + userGmailsignup._id, newTokenObj);
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
                    let userEmail = await Users.findOne({ apple_id: params.apple_id }, { _id: 1, apple_id: 1, email: 1, phone: 1 });

                    if (params && params.email && !userEmail) {
                        userEmail = await Users.findOne({ email: params.email }, { _id: 1, apple_id: 1, email: 1, phone: 1 });
                    }
                    if (!userEmail) {
                        let insertData = {};
                        let rf_xtra_amount = 0;
                        insertData.apple_id = params.apple_id;
                        //insertData.email = params.email;
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
                        }

                        let userName = await getUserName();
                        insertData.team_name = userName + new Date().getUTCMilliseconds().toString();
                        insertData.bonus_amount = 0; //config.referral_bouns_amount;
                        insertData.extra_amount = rf_xtra_amount; // first time user signup
                        insertData.image = '';
                        insertData.status = 0;
                        insertData.avatar = 'avatar20';
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
                                Helper.sendNotificationFCM(insertId, 12, params.device_id, 'Welcome Bonus!!', 'Kick start your journey with 100% deposit bonus. Make your first deposit in wallet to avail this reward.');
                            }
                        } catch (errr) { }
                        const insertId = user._id;
                        insertData.user_id = insertId;
                        let bank_details = {};
                        bank_details.user_id = insertId;
                        // await BankDetails.create(bank_details);
                        await Profile.create(bank_details);
                        // await PanDetails.create(bank_details);

                        try {
                            if (insertId) {
                                let redisKeyForUserCategory = 'user-category-' + insertId;
                                let userCatObj = { is_super_user: 0, is_dimond_user: 0, is_beginner_user: 1, is_looser_user: 0 };
                                redis.setRedisForUserCategory(redisKeyForUserCategory, userCatObj);
                            }
                        } catch (errrrrr) {
                            console.log('insertId*** errrr', insertId, errrrrr);
                        }

                        response["status"] = true;
                        response["data"] = { user_id: insertId, email: params.email, apple_id: params.apple_id };
                        response["login_success"] = false;
                        response["otp_status"] = false;
                        response["apple_signup_status"] = true;

                        return res.json(response);
                    } else {
                        await Users.findOneAndUpdate({ _id: userEmail._id }, { $set: { status: 0 } });
                        if (userEmail && userEmail.phone && !_.isEmpty(userEmail.phone)) {
                            userEmail['apple_id'] = params.apple_id;
                            let otpRes = await sendOtp(userEmail);
                            return res.json(otpRes);
                        } else {
                            response["message"] = "Please enter your phone number.";
                            response["status"] = true;
                            response["data"] = { user_id: userEmail._id, email: userEmail.email, apple_id: userEmail.apple_id };
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
    userAppleSignUpDetailAdd: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { phone: "required", apple_id: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }

            let userGmailsignup = await Users.findOne({ apple_id: params.apple_id }, { _id: 1, apple_id: 1, email: 1, phone: 1 });

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
    userAddInFairPlayViolation: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { user_gaid: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }

            let userGaids = await Users.find({ user_gaid: params.user_gaid }, { _id: 1 });

            if (userGaids && userGaids.length > 5) {
                await Users.updateMany({ user_gaid: params.user_gaid }, { $set: { fair_play_violation: 1 } });
                response["message"] = "Done";
                response["status"] = true;
                return res.json(response);
            } else {
                response["message"] = "Invalid data!!";
                response["errors"] = validator.errors;
                return res.json(response);
            }
        } catch (err) {
            var response = { status: false, message: "Something went wrong. Please try again!!", data: {} };
            return res.json(response);
        }
    },
    userRefStaticData: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let ref_now = {
                heading: "How it Works?",
                sub_heading: "Get 75 on every referral.",
                icon: "ic_howitworks",
                data: [
                    {
                        icon: "ic_invite_friends_email",
                        txt: "₹10 Bonus",
                        sub_txt: "on Email Verification",
                    },
                    {
                        icon: "ic_invite_friends_20",
                        txt: "₹20 Bonus & ₹10 XtraCash",
                        sub_txt: "on Pan card Verification"
                    },
                    {
                        icon: "ic_invite_friends_bank_verify",
                        txt: "₹20 Bonus & ₹10 XtraCash",
                        sub_txt: "on Bank account Verification",
                    },
                    {
                        icon: "ic_firstdeposit",
                        txt: "₹5 XtraCash",
                        sub_txt: "on First Deposit",
                    }
                ]
            }
            let bank_change_req_txt = {
                'heading': "The following are some essential points that one should keep in mind while applying for a bank change request",
                points: [
                    { "item": "It typically takes 3 to 5 days to verify a bank account." },
                    { "item": "A bank account once verified with Real11, cannot be linked with another account on the platform." },
                    { "item": "You can only verify the bank account under your name." },
                    { "item": "A Non-Resident External account, Digital payments bank or any other account from Nagaland, Assam, Andhra Pradesh, Telangana, Odisha, Sikkim can't be verified since the game of skill is banned in these states." },
                    { "item": "You would not be able to change a bank account if your previous account verification/withdrawal is pending or in process." },
                ]
            }
            
            let depoistPaymentGateway   =   await depositPaymentOptions();
            // console.log(depoistPaymentGateway);
            if(!depoistPaymentGateway) {
                let paymentOptionsData  =   await PaymentOptions.findOne({"options_type":"payment" });
                if(paymentOptionsData) {
                    depoistPaymentGateway   =   paymentOptionsData["deposit_pay_gateway"];
                    redis.setRedis("deposit-payment-gateway",depoistPaymentGateway);
                }
            }
            // let depoistPaymentGateway = [{'type':'Card','options':[{'name':'Debit/Credit Card','type':'CASH_FREE','status':true,'offer_available':false,'offer_comment':'','show':'b','icon':'debit','mode':'DEBIT_CARD'},{'name':'Credit Card','type':'CASH_FREE','status':false,'offer_available':false,'offer_comment':'','show':'b','icon':'credit','mode':'CREDIT_CARD'}]},{'type':'Recommendation','options':[{'name':'PhonePe/BHIM UPI','type':'PHONEPE','status':false,'offer_available':true,'offer_comment':'This is testing offer to use for deposit','show':'a','icon':'phonepe_icon','mode':''}]},{'type':'Wallet','options':[{'name':'Paytm','type':'PAYTM_ALL_IN_ONE','status':true,'offer_available':true,'offer_comment':'Get flat 10% Paytm Cashback rewards on a min dep. of ₹30. T&C Apply.','show':'b','icon':'paytm1','mode':''},{'name':'PhonePe','type':'PHONEPE','status':true,'offer_available':false,'offer_comment':'Get upto ₹500 Cashback on first 5 txn. Min txn 500. T&C Apply.','show':'a','icon':'phonepe_icon','mode':''},{'name':'Other Wallets','type':'CASH_FREE','status':true,'offer_available':false,'show':'a','icon':'plus','mode':''},{'name':'MobiKwik','type':'MOBIKWIK','status':false,'offer_available':true,'show':'a','icon':'mobikwik','mode':''},{'name':'Other Wallet','type':'PAYUBIZ','status':false,'offer_available':false,'show':'b','icon':'payubiz','mode':''}]},{'type':'UPI/Google Pay/BHIM','options':[{'name':'Paytm UPI','type':'PAYTM_ALL_IN_ONE','status':true,'offer_available':false,'show':'b','icon':'plus','mode':'UPI_INTENT'}]},{'type':'NETBANKING','options':[{'name':'VIEW ALL Net Banking','type':'CASH_FREE','status':true,'offer_available':false,'show':'b','icon':'bankaccounticon','mode':'NET_BANKING'},{'name':'Paytm Net Banking','type':'PAYTM_ALL_IN_ONE','status':true,'offer_available':true,'offer_comment':'Get up to ₹60 Cashback on a min. transaction of ₹500 via Paytm Payments bank Net Banking! T&C Apply','show':'b','icon':'paytm1','mode':'NET_BANKING'},{'name':'Net Banking','type':'PAYUMONEY','status':false,'offer_available':false,'show':'b','icon':'payumoney','mode':''}],}]; 
           let sportTypes = [{"sport":1,"name":"Cricket","active":true,"allow":"b","icon":"cricket_selector"},{"sport":4,"name":"Kabaddi","active":true,"allow":"b","icon":"kabbadi_selector"},{"sport":3,"name":"Games","active":true,"allow":"a","icon":"game_selector"},{"sport":2,"name":"Football","active":true,"allow":"b","icon":"football_selector"}];
            response["message"] = "";
            response["data"] = {sport_type:sportTypes,max_team_create:20,total_earn:"5,000" ,ref_now: ref_now, bank_change_req_txt: bank_change_req_txt, deposit_pay_gateway: depoistPaymentGateway };
            response["status"] = true;
            return res.json(response);

        } catch (err) {
            return res.json(response);
        }
    },
    userResendOtp: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let params = req.body;
            let constraints = { mobile_number: "required", type: "required" };
            let validator = new Validator(params, constraints);
            let matched = await validator.check();
            if (!matched) {
                response["message"] = "Required fields missing";
                response["errors"] = validator.errors;
                return res.json(response);
            }
            try {
                var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
                if (params && params.mobile_number && _.size(params.mobile_number) > 9 && params.type) {
                    let query = {};
                    if (params.type == "login") {
                        query = { phone: params.mobile_number };
                    } else {
                        query = { temp_phone: params.mobile_number }
                    }
                    let userPhone = await Users.findOne(query, { _id: 1, email: 1, phone: 1, otp_time: 1 });
                    if (userPhone) {
                        let insertData = {};
                        let otp_time = currentDateTimeFormat("YYYY-MM-DD HH:mm:ss");
                        if (userPhone.otp_time) {
                            const expiration = moment(userPhone.otp_time);
                            const diff = expiration.diff(otp_time);
                            const diffDuration = moment.duration(diff);
                            console.log("Minutes:", diffDuration.minutes());
                            if (diffDuration.minutes() == 0) {
                                response['message'] = 'OTP already sent to your number or try after few minutes!!'
                                return res.json(response);
                            }
                        }
                        var otp = Math.floor(100000 + Math.random() * 900000);
                        insertData.otp = otp;
                        insertData.otp_time = otp_time;
                        await Users.findOneAndUpdate({ _id: userPhone._id }, { $set: insertData });
                        const msg = otp + " is the OTP for your Real11 account. Never share your OTP with anyone.";
                        let userMobile = params.mobile_number || '';
                        sendSMS(userMobile, msg)
                            .then(() => { })
                            .catch(err => {
                                console.log("error in sms API ", err);
                                logger.error("MSG_ERROR", err.message);
                            });

                        response["status"] = true;
                        response["data"] = {};
                        response["login_success"] = false;
                        response['message'] = 'OTP has been sent successfully!!'
                        return res.json(response);

                    } else {
                        response['message'] = 'Invalid Request!!'
                        return res.json(response);
                    }
                } else {
                    return res.json(response);
                }
            } catch (err) {
                console.log("err at otp resend", err);
                response["message"] = "Something went wrong!!";
                return res.json(response);
            }
        } catch (error) {
            logger.error("LOGIN_ERROR", error.message);
            var response = { status: false, message: "Something went wrong. Please try again!!", data: {} };
            return res.json(response);
        }
    },
    userDeactivate: async (req, res) => {
            var response = { status: false, message: "Invalid Request", data: {} };
            const user_id = req.userId;
            try {
                if (user_id) {
                    let user = await Users.findOneAndUpdate({_id:user_id,status:1},{$set:{status:0,mobile_verify:false}});
                    if (user) {
                        response["status"] = true;
                        response["data"] = {};
                        response['message'] = 'User deactivate successfully!!'
                        return res.json(response);
                    } else {
                        response['message'] = 'Invalid Request!!'
                        return res.json(response);
                    }
                } else {
                    return res.json(response);
                }
            } catch (err) {
                console.log("err at otp resend", err);
                response["message"] = "Something went wrong!!";
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
    let mailMessage = "<div><h3>OTP Request</h3><p>Hi,</p><p>Your One Time Password(OTP) is <b>" + otp + "</b></p><p>The password will expire in 10 minutes if not used.</p><p>If you have not made this request, please contact our customer support immediately.</p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>"
    let to = data.email;
    let subject = "One Time Password (OTP) login to Real11";
    //if(data && data.email) sendSMTPMail(to, subject, mailMessage);
    response["message"] = "Otp has been sent on you registered phone number, please enter otp to complete login.";
    await Users.updateOne({ _id: user._id }, { $set: { otp: otp, otp_time: otp_time } });

    response["status"] = true;
    response["data"] = { user_id: data._id, email: data.email, phone: data.phone, google_id: data.google_id, apple_id: data.apple_id };
    response["login_success"] = false;
    response["otp_status"] = true;
    return response;
}
/**
 * Generate random team/user name 
 */
async function getUserName() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (var i = 0; i < 10; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

async function sendEmailToAdmin(refer_id, email, phone) {
    let mailMessage = "<div><h3>Referal Used Awareness</h3><p>Hello Admin,</p><p>This Referal Id <b>" + refer_id + " phone " + phone + " email " + email + "</b> has been used upto 10 again </p><br/ ><p>Thank You,</p><p>Real11 Team</p></div>"
    let to = "amityadav@real11.com";
    // let to = "shashijangir@real11.com";
    let subject = "User Signup via Referal code " + refer_id + " other info " + email + " " + phone;
    sendSMTPMail(to, subject, mailMessage);
}

async function getPromiseForAppSetting(key, defaultValue) {
    return new Promise((resolve, reject) => {
      redis.redisObj.get(key, async (err, data) => {
        if (err) {
          reject(defaultValue);
        }
        if (data == null) {
          const appSettingData = await AppSettings.findOne({});
          if (appSettingData && appSettingData._id) {
            console.log('app setting coming from db*****');
            //data = JSON.stringify(appSettingData);
            data = appSettingData;
          } else {
            data = defaultValue;
          }
        }
        resolve(data)
      })
    })
}

async function depositPaymentOptions() {
    try {
        return new Promise(async (resolve, reject) => {
            let redisKey = 'deposit-payment-gateway';
            await redis.getRedis(redisKey, function (err, contestData) {
                if (contestData) {
                    return resolve(contestData);
                } else {
                    return resolve(false);
                }
            })
        });
    } catch (error) {
        console.log('redis leaderboard > ', error);
    }
}