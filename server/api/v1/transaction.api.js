const ApiUtility = require('../api.utility');
const { ObjectId } = require('mongodb');
// const moment = require('moment');
const config = require('../../config');
// const fs = require('fs');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');
const PhonePeTransaction = require('../../models/phonepe_transaction');
const PaymentOffers = require('../../models/payment-offers');
const UserCouponCodes = require('../../models/user-coupon-codes');
const { TransactionTypes } = require('../../constants/app');
var sha512 = require('js-sha512');
const paytm = require('../../../lib/paytm/checksum');
const paytmAllInOne = require('../../../lib/paytm/PaytmChecksum')
const request = require('request');
const { sendSMTPMail, sendSMTPMailTemplate } = require("./common/helper.js");
const https = require('https');
const _ = require('lodash');
const redis = require('../../../lib/redis');
var sha256 = require('sha256');
const fetch = require('node-fetch');
const { registerCustomQueryHandler } = require('puppeteer');
const { appsFlyerEntryService } = require("./users/appsflyer-api");
const { facebookEntryService } = require("./users/facebook-api");

module.exports = {

    checkTransactionStatus: async (req, res) => {
        const { order_id, mid } = req.body;
        if (order_id && mid) {
            var paytmParams = {};
            paytmParams.body = {

                "mid": mid,
                "orderId": order_id,
            };

            paytmAllInOne.generateSignature(JSON.stringify(paytmParams.body), config.paytm.key).then(function (checksum) {

                paytmParams.head = {

                    "signature": checksum
                };

                var post_data = JSON.stringify(paytmParams);

                var options = {
                    hostname: config.paytm.hostname,
                    port: 443,
                    path: '/v3/order/status',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': post_data.length
                    }
                };

                // Set up the request
                var response = "";
                var post_req = https.request(options, function (post_res) {
                    post_res.on('data', function (chunk) {
                        response += chunk;
                    });

                    post_res.on('end', function () {
                        response = JSON.parse(response)

                        if (response.body && response.body.resultInfo.resultStatus == "TXN_SUCCESS") {

                            return res.send(ApiUtility.success(response.body))

                        }
                        else {
                            return res.send(ApiUtility.failed(response.body.resultInfo.resultMsg))
                        }

                    });
                });

                // post the data
                post_req.write(post_data);
                post_req.end();
            })
        }
        else {
            return res.send(ApiUtility.failed("Please provide valid params"));
        }

    },
    createTransactionId: async (req, res) => {
        try {
            const userId = req.userId;
            const { order_id, txn_amount, gateway, coupon_id, discount_amount } = req.body;
            let decoded = {
                order_id,
                txn_amount,
                user_id: userId,
                gateway: gateway,
                coupon_id: coupon_id,
                discount_amount: discount_amount,
            }
            if (decoded) {
                if (decoded['order_id'] && decoded['user_id'] && decoded['txn_amount']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });

                    if (authUser) {
                        let txnEntity = {};
                        txnEntity.user_id = decoded['user_id'];
                        // txnEntity.order_id       =   decoded['order_id'];
                        txnEntity.txn_amount = decoded['txn_amount'];
                        txnEntity.currency = 'INR';
                        txnEntity.gateway_name = gateway;
                        txnEntity.txn_date = Date.now();
                        txnEntity.created = Date.now();
                        if (decoded['coupon_id']) {
                            txnEntity.coupon_id = decoded['coupon_id'];
                        }
                        if (decoded['discount_amount']) {
                            txnEntity.discount_amount = decoded['discount_amount'];
                        }
                        let date = new Date();
                        txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                        txnEntity.added_type = TransactionTypes.CASH_DEPOSIT; // Deposit Cash status
                        txnEntity.status = 0; // status
                        let transaction = await Transaction.create(txnEntity);
                        return res.send(ApiUtility.success({ transactionId: transaction._id }));
                    } else {
                        return res.send(ApiUtility.failed('User not found.'));
                    }
                } else {
                    return res.send(ApiUtility.failed("Please check all details."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            return res.send(ApiUtility.failed(error.message));
        }
    },
    generatePayubizChecksum: async (req, res) => {
        try {
            let data1 = {};
            const userId = req.userId;
            const { order_id, txn_amount } = req.body;
            let decoded = {
                order_id,
                txn_amount,
                user_id: userId
            }
            if (decoded) {
                if (decoded['order_id'] && decoded['user_id'] && decoded['txn_amount']) {
                    let authUser = await User.findOne({ '_id': decoded['user_id'] });

                    if (authUser) {
                        let date = new Date();
                        let txnId = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                        let KEY = config.payubiz.key;
                        let SALT = config.payubiz.salt;
                        let checksumString = `${KEY}|${txnId}|${txn_amount}|Add money to wallet|${authUser.team_name}|${authUser.email}|||||||||||${SALT}`;
                        let checksum = sha512(checksumString);
                        let hash = checksum.toString('hex');
                        return res.send(ApiUtility.success({ checksum: hash }));
                    } else {
                        return res.send(ApiUtility.failed('User Not Found.'));
                    }
                } else {
                    return res.send(ApiUtility.failed("Please check all details."));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    generatePaytmChecksum: async (req, res) => {
        try {
            const userId = req.userId;
            const { MID, WEBSITE, CHANNEL_ID, INDUSTRY_TYPE_ID, ORDER_ID, CUST_ID, TXN_AMOUNT, CALLBACK_URL, EMAIL, MOBILE_NO, PAYMENT_MODE, PAYMENT_CHANNEL, gateway_name } = req.body;
            let authUser = await User.findOne({ '_id': userId });

            if (authUser) {
                let params = {}
                if (gateway_name == "PAYTM_ALL_IN_ONE") {

                    params.body = {
                        "requestType": "Payment",
                        "mid": MID,
                        "websiteName": config.paytm.websiteName,
                        "orderId": ORDER_ID,
                        "callbackUrl": CALLBACK_URL,
                        "txnAmount": {
                            "value": TXN_AMOUNT,
                            "currency": "INR",
                        },
                        "enablePaymentMode": [{
                            "mode": PAYMENT_MODE == "UPI_INTENT" ? "UPI" : PAYMENT_MODE,
                            "channelse": [PAYMENT_CHANNEL]
                        }],
                        "userInfo": {
                            "custId": CUST_ID,
                            "email": EMAIL,
                            "mobile": MOBILE_NO


                        },
                    }
                    if (!PAYMENT_MODE) {
                        try {
                            delete params.body.enablePaymentMode
                        }
                        catch (error) {
                            console.log(error);
                        }
                    }
                    paytmAllInOne.generateSignature(JSON.stringify(params.body), config.paytm.key).then(function (checksum) {


                        params.head = {
                            "signature": checksum
                        };
                        var post_data = JSON.stringify(params);

                        var options = {

                            hostname: config.paytm.hostname,
                            port: 443,
                            path: '/theia/api/v1/initiateTransaction?mid=' + config.paytm.mid + '&orderId=' + ORDER_ID,
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': post_data.length
                            }
                        };

                        var response = "";
                        var post_req = https.request(options, function (post_res) {
                            post_res.on('data', function (chunk) {
                                response += chunk;
                            });

                            post_res.on('end', function () {
                                response = JSON.parse(response)

                                if (response.body && response.body.resultInfo.resultStatus != 'F') {
                                    response = response.body
                                    let flag = false
                                    if (response && response.txnToken && PAYMENT_MODE == "UPI_INTENT" && flag == true) {
                                        var paytmParams = {};

                                        paytmParams.body = {
                                            "requestType": "NATIVE",
                                            "mid": config.paytm.mid,
                                            "orderId": ORDER_ID,
                                            "paymentMode": PAYMENT_MODE
                                        };

                                        paytmParams.head = {
                                            "txnToken": response.txnToken
                                        };

                                        var post_data = JSON.stringify(paytmParams);
                                        var options = {

                                            hostname: config.paytm.hostname,

                                            port: 443,
                                            path: '/theia/api/v1/processTransaction?mid=' + config.paytm.mid + '&orderId=' + ORDER_ID,
                                            method: 'POST',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Content-Length': post_data.length
                                            }
                                        };

                                        var resProcess = "";


                                        var post_req = https.request(options, function (post_res) {
                                            post_res.on('data', function (chunk) {
                                                resProcess += chunk;
                                            });

                                            post_res.on('end', function () {

                                                resProcess = JSON.parse(resProcess)

                                                if (resProcess.body && resProcess.body.resultInfo.resultStatus != 'F') {

                                                    resProcess = {
                                                        "deepLink": resProcess.body.deepLinkInfo.deepLink,
                                                        "txnToken": response.txnToken
                                                    }
                                                    return res.send(ApiUtility.success(resProcess))
                                                }
                                                else {
                                                    return res.send(ApiUtility.failed(response.body.resultInfo.resultMsg));
                                                }

                                            });
                                        })
                                        post_req.write(post_data);
                                        post_req.end();


                                    }
                                    else {
                                        return res.send(ApiUtility.success(response))
                                    }


                                }
                                else {
                                    return res.send(ApiUtility.failed(response.body.resultInfo.resultMsg));
                                }

                            });
                        });
                        post_req.write(post_data);
                        post_req.end();


                    }).catch(err => {
                        return res.send(ApiUtility.failed(err.message));
                    });

                }
                else {
                    let params = {};
                    params['MID'] = MID;
                    params['WEBSITE'] = WEBSITE;
                    params['CHANNEL_ID'] = CHANNEL_ID;
                    params['INDUSTRY_TYPE_ID'] = INDUSTRY_TYPE_ID;
                    params['ORDER_ID'] = ORDER_ID;
                    params['CUST_ID'] = CUST_ID;
                    params['TXN_AMOUNT'] = TXN_AMOUNT;
                    params['CALLBACK_URL'] = CALLBACK_URL;
                    params['EMAIL'] = EMAIL;
                    params['MOBILE_NO'] = MOBILE_NO;
                    paytm.genchecksum(params, config.paytm.key, function (err, checksum) {
                        if (err) {
                            return res.send(ApiUtility.failed(err.message));
                        }
                        return res.send(ApiUtility.success({ checksum: checksum }));
                    });
                }

            } else {
                return res.send(ApiUtility.failed('User Not Found.'));
            }
        } catch (error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },
    updateTransaction: async (req, res) => {
        try {
            const user_id = req.userId;
            var userIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const { gateway_name, order_id, txn_id, banktxn_id, txn_date, txn_amount, currency, coupon_id, discount_amount } = req.body;
            let decoded = {
                user_id,
                gateway_name,
                order_id,
                txn_id,
                banktxn_id,
                txn_date,
                txn_amount,
                currency,
                coupon_id,
                discount_amount
            };
            if (decoded) {
                if (decoded['gateway_name'] == 'PAYTM_ALL_IN_ONE') {
                    var paytmParams = {};

                    paytmParams.body = {
                        "mid": config.paytm.mid,
                        "orderId": decoded['order_id'],
                    };
                    paytmAllInOne.generateSignature(JSON.stringify(paytmParams.body), config.paytm.key).then(function (checksum) {

                        paytmParams.head = {
                            "signature": checksum
                        };

                        var post_data = JSON.stringify(paytmParams);

                        var options = {

                            hostname: config.paytm.hostname,
                            port: 443,
                            path: '/v3/order/status',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': post_data.length
                            }
                        };

                        // Set up the request
                        var response = "";
                        var post_req = https.request(options, function (post_res) {
                            post_res.on('data', function (chunk) {
                                response += chunk;
                            });

                            post_res.on('end', async function () {
                                response = JSON.parse(response)
                                var c_discount_amount = 0;
                                // console.log(response.body.txnAmount);
                                // return false;
                                if (response.body && response.body.resultInfo.resultStatus == 'TXN_SUCCESS') {
                                    response = response.body

                                    if (decoded['user_id'] && decoded['gateway_name'] && decoded['order_id'] && decoded['txn_id'] && decoded['banktxn_id'] && decoded['txn_date'] && decoded['txn_amount'] && decoded['currency']) {

                                        let authUser = await User.findOne({ '_id': decoded['user_id'] });
                                        if (authUser) {

                                            let txnEntity = {};
                                            let isCouponUsed = 0;
                                            let date = new Date();
                                            txnEntity.user_id = decoded['user_id'];
                                            txnEntity.order_id = decoded['order_id'];
                                            txnEntity.txn_id = decoded['txn_id'];
                                            txnEntity.banktxn_id = decoded['banktxn_id'];
                                            if (decoded['coupon_id']) {
                                                txnEntity.coupon_id = decoded['coupon_id'];
                                            }
                                            if (decoded['discount_amount']) {
                                                txnEntity.discount_amount = decoded['discount_amount'];
                                            }
                                            txnEntity.txn_date = Date.now(); //decoded['txn_date'];
                                            // txnEntity.txn_amount =   decoded['txn_amount'];
                                            txnEntity.currency = decoded['currency'];
                                            // txnEntity.gateway_name  =    decoded['gateway_name'];
                                            txnEntity.gateway_name = (decoded['gateway_name'] == 'PAYUBIZZ') ? "PAYUBIZ" : decoded['gateway_name'];
                                            txnEntity.checksum = decoded['checksum'];
                                            txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                            txnEntity.added_type = TransactionTypes.CASH_DEPOSIT; // Deposit Cash status
                                            txnEntity.status = true

                                            // if txnEntity
                                            if (txnEntity) {
                                                let users = authUser

                                                let txnData = {};
                                                if (decoded['gateway_name'] !== 'PAYTM_ALL_IN_ONE') {
                                                    txnData = await Transaction.findOne({ _id: decoded['txn_id'], status: false });
                                                } else if (decoded['gateway_name'] === "PAYTM_ALL_IN_ONE") {
                                                    txnData = await Transaction.findOne({ _id: decoded['order_id'], status: false });
                                                }

                                                // Manage tnxdata
                                                if (txnData && Number(txnData.txn_amount) == Number(response.txnAmount)) {
                                                    if (decoded['coupon_id'] && decoded['discount_amount'] > 0) {
                                                        var start = new Date();
                                                        start.setHours(0,0,0,0);
                                                        let couponCode = await PaymentOffers.findOne({ '_id': decoded['coupon_id'],expiry_date:{$gte:start.toISOString()} });

                                                        if (couponCode) {
                                                            if (decoded['txn_amount'] >= couponCode.min_amount) {
                                                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'user_id': decoded['user_id'], 'status': 1 }).countDocuments();
                                                                if (appkiedCount <= couponCode.per_user_limit) {
                                                                    let r = 0;
                                                                    if (couponCode.usage_limit != 0) {
                                                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'status': 1 }).countDocuments();
                                                                        if (allAppkiedCount > couponCode.usage_limit) {
                                                                            r = 1;
                                                                        }
                                                                    }

                                                                    if (r == 0) {

                                                                        if (couponCode.max_cashback_percent > 0) {
                                                                            discountPercent = couponCode.max_cashback_percent;
                                                                            discountAmount = (discountPercent / 100) * decoded['txn_amount'];
                                                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                                                discountAmount = couponCode.max_cashback_amount;
                                                                            }
                                                                        } else {
                                                                            discountAmount = couponCode.max_cashback_amount;
                                                                        }

                                                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                                                        decoded['discount_amount'] = parseFloat(decoded['discount_amount']).toFixed(2);
                                                                        if (discountAmount <= decoded['discount_amount']) {

                                                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': decoded['coupon_id'], user_id: decoded['user_id'], status: 0 }, { $set: { status: 1 } });
                                                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                                                let txnType = '';
                                                                                isCouponUsed = 1;
                                                                                if (couponCode.coupon_type === 'extra') {
                                                                                    users.extra_amount = parseFloat(users.extra_amount) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                                                } else if(couponCode.coupon_type === 'extra_deposite') {
                                                                                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.EXTRA_DEPOSITE;
                                                                                } else {
                                                                                    users.bonus_amount = parseFloat(users.bonus_amount) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.COUPON_BONUS
                                                                                }
                                                                                c_discount_amount = discountAmount; 
                                                                                let date = new Date();
                                                                                let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                                                Transaction.saveTransaction(users.id, txnId, txnType, discountAmount);
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                let txn_status = false;
                                                // console.log(Number(txnData.txn_amount), Number(response.txnAmount))
                                                // return false;
                                                if (txnData && Number(txnData.txn_amount) == Number(response.txnAmount)) {
                                                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(txnData.txn_amount);
                                                    try{
                                                        if(users && users.isFirstPaymentAdded && users.isFirstPaymentAdded == 2 && isCouponUsed == 0){
                                                            let amountAdded  = parseFloat(txnData.txn_amount);
                                                            let finalAmount = amountAdded > 2000 ? 2000: amountAdded;
                                                            users.bonus_amount = parseFloat(users.bonus_amount)+ (finalAmount);
                                                            let date = new Date();
                                                            let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                            Transaction.saveTransaction(users.id, txnId, TransactionTypes.FIRST_DEPOSITE_BONUS, finalAmount);
                                                            try{
                                                                let appsflyerURL = "";
                                                                if(authUser.device_type == "Android"){
                                                                  appsflyerURL =  config.appsFlyerAndroidUrl;
                                                                } else {
                                                                  appsflyerURL = config.appsFlyeriPhoneUrl;
                                                                }
                                                                
                                                                if(authUser && authUser.appsflayer_id) {
                                                                    let event_val = { 
                                                                        "af_customer_user_id": authUser.clevertap_id || '',
                                                                        "af_email":  authUser.email || '', 
                                                                        "af_mobile": authUser.mobile_number || '',
                                                                        "af_revenue": txnData.txn_amount, 
                                                                        "af_currency": "INR", 
                                                                        "txn_id": txnData._id || '', 
                                                                        "clevertap_id": authUser.clevertap_id || '',
                                                                        "appsflyer_id": authUser.appsflayer_id || '', 
                                                                        "user_id": authUser._id || '', 
                                                                        "coupon_id": coupon_id || '', 
                                                                        "discount_amount": c_discount_amount,
                                                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: ''
                                                                      };
                                                                    var tData = {
                                                                        "eventName": "FirstDepositS2S",
                                                                        "appsflyer_id": authUser.appsflayer_id || '',
                                                                        "eventCurrency": 'INR', 
                                                                        "eventTime" : new Date(),
                                                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: '',
                                                                        "customer_user_id": decoded['user_id'] || '',  
                                                                        "eventValue":JSON.stringify(event_val)
                                                                        };
                                                                         appsFlyerEntryService(tData,appsflyerURL);
                                                                       
                                                                 }
                                                                 
                                                                } catch(appslyererrr){
                                                                  console.log('errr in transaction for appsflyer',appslyererrr);
                                                                }
                                                          } else {
                                                            try{
                                                                let appsflyerURL = "";
                                                                if(authUser.device_type == "Android"){
                                                                  appsflyerURL =  config.appsFlyerAndroidUrl;
                                                                } else {
                                                                  appsflyerURL = config.appsFlyeriPhoneUrl;
                                                                }
                                                                
                                                                if(authUser && authUser.appsflayer_id) {
                                                                    let event_val = { 
                                                                        "af_customer_user_id": authUser.clevertap_id || '',
                                                                        "af_email":  authUser.email || '', 
                                                                        "af_mobile": authUser.mobile_number || '',
                                                                        "af_revenue": txnData.txn_amount, 
                                                                        "af_currency": "INR", 
                                                                        "txn_id": txnData._id || '', 
                                                                        "clevertap_id": authUser.clevertap_id || '',
                                                                        "appsflyer_id": authUser.appsflayer_id || '', 
                                                                        "user_id": authUser._id || '', 
                                                                        "coupon_id": coupon_id || '', 
                                                                        "discount_amount": c_discount_amount,
                                                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: ''
                                                                      };
                                                                    var tData = {
                                                                        "eventName": "s2sCashDeposite",
                                                                        "appsflyer_id": authUser.appsflayer_id || '',
                                                                        "eventCurrency": 'INR', 
                                                                        "eventTime" : new Date(),
                                                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: '',
                                                                        "customer_user_id": decoded['user_id'] || '',  
                                                                        "eventValue":JSON.stringify(event_val)
                                                                        };
                                                                         appsFlyerEntryService(tData,appsflyerURL);
                                                                       
                                                                 }
                                                                 
                                                                } catch(appslyererrr){
                                                                  console.log('errr in transaction for appsflyer',appslyererrr);
                                                                }
                                                          }
                                                          try{
                                                            let fb_event = {
                                                               "data": [
                                                                 {
                                                                "event_name": "Purchase",
                                                                "event_time": parseInt(new Date().getTime()/ 1000),
                                                                "event_source_url": "real11.com/deposits2s",
                                                                "opt_out": false,
                                                                "event_id":Math.floor(1000000 + Math.random() * 9000000),
                                                                "user_data": {
                                                                  "em":authUser && authUser.email ? sha256(authUser.email):null,
                                                                  "ph":authUser && authUser.mobile_number ? sha256(authUser.mobile_number):null,   
                                                                  "client_ip_address": userIp || "172.17.0.5",
                                                                  "client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                                                  },
                                                                  "custom_data": {
                                                                    "value": txnData.txn_amount,
                                                                    "currency": "INR"
                                                                  },
                                                                  "action_source": "website"
                                                                }
                                                                ]
                                                              }
                                                              facebookEntryService(fb_event,'');
                                                           }catch(errfb){}
                                                    } catch(errrrr){
                                                        console.log('first time user is coming errrr*****',errrrr);
                                                    }

                                                    let res = await User.update({ '_id': decoded['user_id'] }, { $set: { isFirstPaymentAdded:1,cash_balance: users.cash_balance, bonus_amount: users.bonus_amount, extra_amount: users.extra_amount } });
                                                    await Transaction.updateOne({ _id: txnData._id }, { $set: txnEntity });

                                                    txn_status = true;
                                                }

                                                if (txn_status == true) {
                                                    sendSMTPMailTemplate(req, "Amount Deposite", "deposite/deposite-main.ejs", authUser.email, authUser.first_name, txnData.txn_amount, txnData._id);
                                                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                                                } else {
                                                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                                                }
                                            }

                                        }
                                    }
                                    else {
                                        return res.send(ApiUtility.failed('Please check all details are correct or not.'));
                                    }

                                    // return res.send(ApiUtility.success(response));
                                }
                                else {
                                    return res.send(ApiUtility.failed(response.body.resultInfo.resultMsg));
                                }
                            });
                        });

                        // post the data
                        post_req.write(post_data);
                        post_req.end();
                    });
                } else if (decoded['gateway_name'] == 'PHONEPE') {
                    await checkPhonePeStatus(txn_id, async function(result) {
                        let response   =   JSON.parse(result.body);
                        if(response && response.success == true && response.code == "PAYMENT_SUCCESS") {
                            await updateTransactionAllGetway(decoded, function(txn_res) {
                                // sendSMTPMailTemplate(req, "Amount Deposite", "deposite/deposite-main.ejs", authUser.email, authUser.first_name, txnData.txn_amount, txnData._id);
                                return res.send(txn_res);
                            });
                        } else {
                            return res.send(ApiUtility.failed(response.message));
                        }
                    });
                } else {
                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                }
            } else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }

        } catch (error) {
            console.log(error)
            return res.send(ApiUtility.failed(error.message));
        }
    },
    updateTransaction_old: async (req, res) => {
        try {
            const user_id = req.userId;
            const { gateway_name, order_id, txn_id, banktxn_id, txn_date, txn_amount, currency, coupon_id, discount_amount } = req.body;
            let decoded = {
                user_id,
                gateway_name,
                order_id,
                txn_id,
                banktxn_id,
                txn_date,
                txn_amount,
                currency,
                coupon_id,
                discount_amount


            };
            if (decoded) {
                if (decoded['gateway_name'] == 'PAYTM_ALL_IN_ONE') {
                    var paytmParams = {};

                    paytmParams.body = {
                        "mid": config.paytm.mid,
                        "orderId": decoded['order_id'],
                    };
                    paytmAllInOne.generateSignature(JSON.stringify(paytmParams.body), config.paytm.key).then(function (checksum) {

                        paytmParams.head = {
                            "signature": checksum
                        };

                        var post_data = JSON.stringify(paytmParams);

                        var options = {

                            hostname: config.paytm.hostname,
                            port: 443,
                            path: '/v3/order/status',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': post_data.length
                            }
                        };

                        // Set up the request
                        var response = "";
                        var post_req = https.request(options, function (post_res) {
                            post_res.on('data', function (chunk) {
                                response += chunk;
                            });

                            post_res.on('end', async function () {
                                response = JSON.parse(response)

                                if (response.body && response.body.resultInfo.resultStatus == 'TXN_SUCCESS') {
                                    response = response.body

                                    if (decoded['user_id'] && decoded['gateway_name'] && decoded['order_id'] && decoded['txn_id'] && decoded['banktxn_id'] && decoded['txn_date'] && decoded['txn_amount'] && decoded['currency']) {

                                        let authUser = await User.findOne({ '_id': decoded['user_id'] });
                                        if (authUser) {

                                            let txnEntity = {};

                                            let date = new Date();
                                            txnEntity.user_id = decoded['user_id'];
                                            txnEntity.order_id = decoded['order_id'];
                                            txnEntity.txn_id = decoded['txn_id'];
                                            txnEntity.banktxn_id = decoded['banktxn_id'];
                                            if (decoded['coupon_id']) {
                                                txnEntity.coupon_id = decoded['coupon_id'];
                                            }
                                            if (decoded['discount_amount']) {
                                                txnEntity.discount_amount = decoded['discount_amount'];
                                            }
                                            txnEntity.txn_date = Date.now(); //decoded['txn_date'];
                                            // txnEntity.txn_amount =   decoded['txn_amount'];
                                            txnEntity.currency = decoded['currency'];
                                            // txnEntity.gateway_name  =    decoded['gateway_name'];
                                            txnEntity.gateway_name = (decoded['gateway_name'] == 'PAYUBIZZ') ? "PAYUBIZ" : decoded['gateway_name'];
                                            txnEntity.checksum = decoded['checksum'];
                                            txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                            txnEntity.added_type = TransactionTypes.CASH_DEPOSIT; // Deposit Cash status
                                            txnEntity.status = true

                                            // if txnEntity
                                            if (txnEntity) {
                                                let users = authUser

                                                let txnData = {};
                                                if (decoded['gateway_name'] !== 'PAYTM_ALL_IN_ONE') {
                                                    txnData = await Transaction.findOne({ _id: decoded['txn_id'], status: false });
                                                } else if (decoded['gateway_name'] === "PAYTM_ALL_IN_ONE") {
                                                    txnData = await Transaction.findOne({ _id: decoded['order_id'], status: false });
                                                }

                                                // Manage tnxdata
                                                if (txnData) {
                                                    if (decoded['coupon_id'] && decoded['discount_amount'] > 0) {
                                                        let couponCode = await PaymentOffers.findOne({ '_id': decoded['coupon_id'] });

                                                        if (couponCode) {
                                                            if (decoded['txn_amount'] >= couponCode.min_amount) {
                                                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'user_id': decoded['user_id'], 'status': 1 }).countDocuments();
                                                                if (appkiedCount <= couponCode.per_user_limit) {
                                                                    let r = 0;
                                                                    if (couponCode.usage_limit != 0) {
                                                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'status': 1 }).countDocuments();
                                                                        if (allAppkiedCount > couponCode.usage_limit) {
                                                                            r = 1;
                                                                        }
                                                                    }

                                                                    if (r == 0) {

                                                                        if (couponCode.max_cashback_percent > 0) {
                                                                            discountPercent = couponCode.max_cashback_percent;
                                                                            discountAmount = (discountPercent / 100) * decoded['txn_amount'];
                                                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                                                discountAmount = couponCode.max_cashback_amount;
                                                                            }
                                                                        } else {
                                                                            discountAmount = couponCode.max_cashback_amount;
                                                                        }

                                                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                                                        decoded['discount_amount'] = parseFloat(decoded['discount_amount']).toFixed(2);
                                                                        if (discountAmount <= decoded['discount_amount']) {

                                                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': decoded['coupon_id'], user_id: decoded['user_id'], status: 0 }, { $set: { status: 1 } });
                                                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                                                let txnType = '';
                                                                                if (couponCode.coupon_type === 'extra') {
                                                                                    users.extra_amount = parseFloat(users.extra_amount) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                                                } else if(couponCode.coupon_type === 'extra_deposit') {
                                                                                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.EXTRA_DEPOSITE;
                                                                                } else {
                                                                                    users.bonus_amount = parseFloat(users.bonus_amount) + parseFloat(discountAmount);
                                                                                    txnType = TransactionTypes.COUPON_BONUS
                                                                                }
                                                                                let date = new Date();
                                                                                let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                                                Transaction.saveTransaction(users.id, txnId, txnType, discountAmount);
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                let txn_status = false;
                                                if (txnData) {
                                                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(txnData.txn_amount);
                                                    let res = await User.update({ '_id': decoded['user_id'] }, { $set: { cash_balance: users.cash_balance, bonus_amount: users.bonus_amount, extra_amount: users.extra_amount } });
                                                    await Transaction.updateOne({ _id: txnData._id }, { $set: txnEntity });

                                                    txn_status = true;
                                                }

                                                if (txn_status == true) {
                                                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                                                } else {
                                                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                                                }
                                            }

                                        }
                                    }
                                    else {
                                        return res.send(ApiUtility.failed('Please check all details are correct or not.'));
                                    }

                                    // return res.send(ApiUtility.success(response));
                                }
                                else {
                                    return res.send(ApiUtility.failed(response.body.resultInfo.resultMsg));
                                }

                            });
                        });

                        // post the data
                        post_req.write(post_data);
                        post_req.end();
                    });
                }
                else {
                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                }
            }
            else {
                return res.send(ApiUtility.failed("You are not authenticated user."));
            }

        } catch (error) {
            console.log(error)
            return res.send(ApiUtility.failed(error.message));
        }
    },

    updateTransactionPhonePeWebhook: async(response, xVerifyString, bodyResponse, gateway = null, cb) => {
        try {
            let transactionId   =   response.data.transactionId;
            const txnAmount = response.data.amount;
            txnData = await Transaction.findOne({ _id: ObjectId(transactionId) });
            
            // In case of call back dont need to check status
            if(txnData && txnData.status == false) {
                
                const verifyKey =   await verifyPhonePeTokenKey(bodyResponse);
                const responseAmount    =   txnData.txn_amount * 100;
                if(verifyKey == xVerifyString && txnAmount == responseAmount) {
                    await module.exports.updateTransactionFromWebhook(transactionId, gateway);
                    cb({"message":"Amount Added successfully.", "status": true});
                } else {
                    cb({"message": "Token or amount not verified.", "status": false})
                }
            } else {
                cb({"message": "Amount already added in your wallet.", "status": false})
            }
        } catch(error) {
            console.log(error);
            cb({"message": error.message, "status": false});
        }
    },

    updateTransactionFromWebhook: async (transactionId, gateway = null, txnAmount = 0) => {
        
        try {
            let txnData;
            // objectid.isValid('53fbf4615c3b9f41c381b6a3')
            txnData = await Transaction.findOne({ _id: ObjectId(transactionId) });
            var c_discount_amount = 0;
            var coupon_id = '';
            // console.log(gateway);
            // return false;
            if (txnData && txnData._id && txnData.status == false && Number(txnAmount) == Number(txnData.txn_amount)) {
                // console.log("enter");return false
                let authUser = await User.findOne({ '_id': txnData.user_id });
                if (!txnData.status && authUser) {
                    let isCouponUsed = 0;
                    if (txnData.coupon_id && txnData.discount_amount && txnData.discount_amount > 0) {
                        let couponCode = await PaymentOffers.findOne({ '_id': txnData.coupon_id });
                        if (couponCode) {
                            if (txnData.txn_amount >= couponCode.min_amount) {
                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': txnData.coupon_id, 'user_id': authUser._id, 'status': 1 }).countDocuments();
                                if (appkiedCount <= couponCode.per_user_limit) {
                                    let r = 0;
                                    if (couponCode.usage_limit != 0) {
                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': txnData.coupon_id, 'status': 1 }).countDocuments();
                                        if (allAppkiedCount > couponCode.usage_limit) {
                                            r = 1;
                                        }
                                    }

                                    if (r == 0) {
                                        if (couponCode.max_cashback_percent > 0) {
                                            discountPercent = couponCode.max_cashback_percent;
                                            discountAmount = (discountPercent / 100) * txnData.txn_amount;
                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                discountAmount = couponCode.max_cashback_amount;
                                            }
                                        } else {
                                            discountAmount = couponCode.max_cashback_amount;
                                        }

                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                        txnData.discount_amount = parseFloat(txnData.discount_amount).toFixed(2);
                                        if (discountAmount <= txnData.discount_amount) {
                                            
                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': txnData.coupon_id, user_id: authUser._id, status: 0 }, { $set: { status: 1 } });
                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                let txnType = '';
                                                isCouponUsed = 1;
                                                if (couponCode.coupon_type === 'extra') {
                                                    authUser.extra_amount = parseFloat(authUser.extra_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                } else if(couponCode.coupon_type === 'extra_deposite') {
                                                    authUser.cash_balance = parseFloat(authUser.cash_balance) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_DEPOSITE;
                                                } else {
                                                    authUser.bonus_amount = parseFloat(authUser.bonus_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.COUPON_BONUS
                                                }
                                                c_discount_amount = discountAmount; 
                                                coupon_id = txnData.coupon_id;
                                                let date = new Date();
                                                txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + authUser._id;
                                                Transaction.saveTransaction(authUser.id, txnId, txnType, discountAmount);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    try{
                        if(authUser && authUser.isFirstPaymentAdded && authUser.isFirstPaymentAdded == 2 && isCouponUsed == 0){
                            let amountAdded  = parseFloat(txnData.txn_amount);
                            let finalAmount = amountAdded > 2000 ? 2000: amountAdded;
                            authUser.bonus_amount = parseFloat(authUser.bonus_amount)+ (finalAmount);
                            let date = new Date();
                            let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + authUser._id;
                            Transaction.saveTransaction(authUser._id, txnId, TransactionTypes.FIRST_DEPOSITE_BONUS, finalAmount);
                            try{
                                let appsflyerURL = "";
                                if(authUser.device_type == "Android"){
                                  appsflyerURL =  config.appsFlyerAndroidUrl;
                                } else {
                                  appsflyerURL = config.appsFlyeriPhoneUrl;
                                }
                                
                                if(authUser && authUser.appsflayer_id) {
                                    let event_val = { 
                                        "af_customer_user_id": authUser.clevertap_id || '',
                                        "af_email":  authUser.email || '', 
                                        "af_mobile": authUser.mobile_number || '',
                                        "af_revenue": txnData.txn_amount, 
                                        "af_currency": "INR", 
                                        "txn_id": txnData._id || '', 
                                        "clevertap_id": authUser.clevertap_id || '',
                                        "appsflyer_id": authUser.appsflayer_id || '', 
                                        "user_id": authUser._id || '', 
                                        "coupon_id": coupon_id || '', 
                                        "discount_amount": c_discount_amount,
                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: ''
                                      };
                                    var tData = {
                                        "eventName": "FirstDepositS2S",
                                        "appsflyer_id": authUser.appsflayer_id || '',
                                        "eventCurrency": 'INR', 
                                        "eventTime" : new Date(),
                                        'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: '',
                                        "customer_user_id": authUser._id || '',  
                                        "eventValue":JSON.stringify(event_val)
                                        };
                                         appsFlyerEntryService(tData,appsflyerURL);
                                       
                                 }
                                 
                                } catch(appslyererrr){
                                  console.log('errr in transaction for appsflyer',appslyererrr);
                                }
                          } else {
                            try {
                                    let appsflyerURL = "";
                                    if(authUser.device_type == "Android"){
                                    appsflyerURL =  config.appsFlyerAndroidUrl;
                                    } else {
                                    appsflyerURL = config.appsFlyeriPhoneUrl;
                                    }
                                    
                                    if(authUser && authUser.appsflayer_id) {
                                        let event_val = { 
                                            "af_customer_user_id": authUser.clevertap_id || '',
                                            "af_email":  authUser.email || '', 
                                            "af_mobile": authUser.mobile_number || '',
                                            "af_revenue": txnData.txn_amount, 
                                            "af_currency": "INR", 
                                            "txn_id": txnData._id || '', 
                                            "clevertap_id": authUser.clevertap_id || '',
                                            "appsflyer_id": authUser.appsflayer_id || '', 
                                            "user_id": authUser._id || '', 
                                            "coupon_id": coupon_id || '', 
                                            "discount_amount": c_discount_amount,
                                            'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: ''
                                        };
                                        var tData = {
                                            "eventName": "s2sCashDeposite",
                                            "appsflyer_id": authUser.appsflayer_id || '',
                                            "eventCurrency": 'INR', 
                                            "eventTime" : new Date(),
                                            'advertising_id': authUser && authUser.user_gaid ? authUser.user_gaid: '',
                                            "customer_user_id": authUser._id || '',  
                                            "eventValue":JSON.stringify(event_val)
                                            };
                                            appsFlyerEntryService(tData,appsflyerURL);
                                        
                                    }
                                 
                                } catch(appslyererrr){
                                  console.log('errr in transaction for appsflyer',appslyererrr);
                                }
                          }
                          try{
                            let fb_event = {
                               "data": [
                                 {
                                "event_name": "Purchase",
                                "event_time": parseInt(new Date().getTime()/ 1000),
                                "event_source_url": "real11.com/deposits2s",
                                "opt_out": false,
                                "event_id":Math.floor(1000000 + Math.random() * 9000000),
                                "user_data": {
                                  "em":authUser && authUser.email ? sha256(authUser.email):null,
                                  "ph":authUser && authUser.mobile_number ? sha256(authUser.mobile_number):null,  
                                  "client_ip_address": authUser && authUser.ip_address ? authUser.ip_address: "172.17.0.5",
                                  "client_user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                  },
                                  "custom_data": {
                                    "value": txnData.txn_amount,
                                    "currency": "INR"
                                  },
                                  "action_source": "website"
                                }
                                ]
                              }
                              facebookEntryService(fb_event,'');
                           }catch(errfb){}
                    } catch(errrrr){
                        console.log('first time user is coming errrr*****',errrrr);
                    }

                    authUser.cash_balance = parseFloat(authUser.cash_balance) + parseFloat(txnData.txn_amount);
                    User.updateOne({ '_id': ObjectId(authUser._id) }, {isFirstPaymentAdded:1, cash_balance: authUser.cash_balance, bonus_amount: authUser.bonus_amount, extra_amount: authUser.extra_amount }, { new: true }).then((data) => {
                        // console.log("MyContestModel-------", data);
                        if (data && data.nModified == 1) {
                            Transaction.updateOne({ '_id': ObjectId(transactionId) }, { $set: { status: true, txn_id: transactionId } }).then((txnData) => {

                            });
                        }
                    });
                }
            } else {
                console.error("Invalid UserId")
            }
        } catch (error) {
            console.log(error)
            //return res.send(ApiUtility.failed(error.message));
        }
    }, 
    updateTransactionFromWebhook_old: async (transactionId, gateway = null) => {
        try {
            let txnData;
            // objectid.isValid('53fbf4615c3b9f41c381b6a3')
            txnData = await Transaction.findOne({ _id: ObjectId(transactionId) });

            if (txnData && txnData._id && txnData.status == false) {
                let authUser = await User.findOne({ '_id': txnData.user_id });
                if (!txnData.status && authUser) {
                    if (txnData.coupon_id && txnData.discount_amount && txnData.discount_amount > 0) {
                        let couponCode = await PaymentOffers.findOne({ '_id': txnData.coupon_id });
                        if (couponCode) {
                            if (txnData.txn_amount >= couponCode.min_amount) {
                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': txnData.coupon_id, 'user_id': authUser._id, 'status': 1 }).countDocuments();
                                if (appkiedCount <= couponCode.per_user_limit) {
                                    let r = 0;
                                    if (couponCode.usage_limit != 0) {
                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': txnData.coupon_id, 'status': 1 }).countDocuments();
                                        if (allAppkiedCount > couponCode.usage_limit) {
                                            r = 1;
                                        }
                                    }

                                    if (r == 0) {
                                        if (couponCode.max_cashback_percent > 0) {
                                            discountPercent = couponCode.max_cashback_percent;
                                            discountAmount = (discountPercent / 100) * txnData.txn_amount;
                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                discountAmount = couponCode.max_cashback_amount;
                                            }
                                        } else {
                                            discountAmount = couponCode.max_cashback_amount;
                                        }

                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                        txnData.discount_amount = parseFloat(txnData.discount_amount).toFixed(2);
                                        if (discountAmount <= txnData.discount_amount) {
                                            /* let couponCode =    await UserCouponCodes.updateOne({'coupon_code_id':txnData.coupon_id,user_id:authUser._id,status:0},{$set:{status : 1}});
                                            if(couponCode && couponCode.nModified > 0) {
                                                if(txnData.txn_amount >= 500) {
                                                    authUser.extra_amount   =   parseFloat(authUser.extra_amount) + parseFloat(discountAmount);
                                                } else {
                                                    authUser.bonus_amount   =   parseFloat(authUser.bonus_amount) + parseFloat(discountAmount);
                                                }
                                                let date = new Date();
                                                txnId   =   'CB'+date.getFullYear() + date.getMonth() + date.getDate() + Date.now()+authUser._id;
                                                Transaction.saveTransaction(authUser.id,txnId,TransactionTypes.COUPON_BONUS,discountAmount);
                                            } */

                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': txnData.coupon_id, user_id: authUser._id, status: 0 }, { $set: { status: 1 } });
                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                let txnType = '';
                                                if (couponCode.coupon_type === 'extra') {
                                                    authUser.extra_amount = parseFloat(authUser.extra_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                } else if(couponCode.coupon_type === 'extra_deposite') {
                                                    authUser.cash_balance = parseFloat(authUser.cash_balance) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_DEPOSITE;
                                                } else {
                                                    authUser.bonus_amount = parseFloat(authUser.bonus_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.COUPON_BONUS
                                                }
                                                let date = new Date();
                                                txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + authUser._id;
                                                Transaction.saveTransaction(authUser.id, txnId, txnType, discountAmount);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    
                    authUser.cash_balance = parseFloat(authUser.cash_balance) + parseFloat(txnData.txn_amount);
                    User.updateOne({ '_id': ObjectId(authUser._id) }, { cash_balance: authUser.cash_balance, bonus_amount: authUser.bonus_amount, extra_amount: authUser.extra_amount }, { new: true }).then((data) => {
                        // console.log("MyContestModel-------", data);
                        if (data && data.nModified == 1) {
                            Transaction.updateOne({ '_id': ObjectId(transactionId) }, { $set: { status: true, txn_id: transactionId } }).then((txnData) => {

                            });
                        }
                    });
                }
            } else {
                console.error("Invalid UserId")
            }
        } catch (error) {
            console.log(error)
            //return res.send(ApiUtility.failed(error.message));
        }
    },

    couponForAddCash:async (req,res)=>{
        try{
            let user_id = req.userId;
            var start = new Date();
            start.setHours(0,0,0,0);
            let redisKeyForAddCashCoupon = 'add-cash-coupon-list';
            if(user_id){
            let couponCode = await PaymentOffers.find(
                {coupon_type:{$in:['extra','bonus','extra_deposite']},status:1,is_public:true, expiry_date:{$gte:start.toISOString()}}).limit(40);
                var fnData = _.chain(couponCode)
                              .groupBy("coupon_type")
                               .map((value, key) => ({ _id: key, coupon_type: key, info: value }))
                              .value()
            
            redis.setRedisForAddCashCoupon(redisKeyForAddCashCoupon, fnData);
            return res.send(ApiUtility.success(fnData));
           } else {
            return res.send(ApiUtility.failed("Something went wrong!!"));
           }
        }catch (error) {
            console.log(error)
            return res.send(ApiUtility.failed(error.message));
        }

    },
    generatePhonePeChecksum:async(req, res) => {
        try {
            let base64Body    =   req.body.base64_string || "";
            if(base64Body) {
                let checksum = sha256(base64Body + "/v4/debit" + process.env.PHONEPE_SALT_KEY) + "###" + process.env.PHONEPE_SALT_INDEX;
                
                return res.send(ApiUtility.success({"checksum": checksum},"Checksum genetated successfully."));
            } else {
                return res.send(ApiUtility.failed("Base64 String is empty."));
            }
        } catch(error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    },

    checkPhonePeTransactionStatus: async(req,res) => {
        try {
            let transactionId   =   req.body.transaction_id;
            const userId = req.userId;
            const txnAmount = req.body.amount;
            // let response    =   {}
            await checkPhonePeStatus(transactionId, async function(result) {
                let response    =   JSON.parse(result.body);
                // console.log(response);
                // return false;
                if(response && (response.code == "INTERNAL_SERVER_ERROR" || response.code == "PAYMENT_PENDING")) {
                    let createPhoneTxn  =   {
                        "transaction_id": transactionId,
                        "user_id": userId,
                        "status": response.code
                    }
                    await PhonePeTransaction.create(createPhoneTxn);
                    return res.send(ApiUtility.failed("Your transaction is under process, please try after some time."));
                } else {
                    const verifyKey =   await generateXVerifyKey(transactionId);
                   
                    const responseAmount=   response.data.amount;
                    if(verifyKey == result.header && txnAmount == responseAmount) {
                        response.status =   response.success;
                        return res.send(response);
                    } else {
                        return res.send(ApiUtility.failed('Amount not updated in your wallet.'));
                    }
                }
                
            });
        } catch(error) {
            console.log(error);
            return res.send(ApiUtility.failed(error.message));
        }
    }
}

async function checkPhonePeStatus(txnId, cb) {
    const url = process.env.PHONEPE_STATUS_URL + process.env.PHONEPE_ENDPOINT + process.env.PHONEPE_MURCHANT_ID+ '/'+ txnId +'/status';
    const verifyKey =   await generateXVerifyKey(txnId);
    const options = {
        "method": 'GET',
        "headers": {
            'Content-Type': 'application/json',
            'X-VERIFY': verifyKey
        },
        "url": url
    };
    request(options, async function (error, response) {
        if (error) throw new Error(error);
        
        let finalRespose    =   {
            "header": response.request ? response.request.headers["X-VERIFY"] : '',
            "body": response.body ? response.body : {}
        }
        cb(finalRespose);
    });
}

async function generateXVerifyKey(transactionId) {
    const verfyKey    =   sha256(process.env.PHONEPE_ENDPOINT + process.env.PHONEPE_MURCHANT_ID + "/"+ transactionId +"/status" + process.env.PHONEPE_SALT_KEY) + "###" + process.env.PHONEPE_SALT_INDEX
    return verfyKey;
}


async function verifyPhonePeTokenKey(callBackResponse) {
    const verfyKey    =   sha256(callBackResponse + process.env.PHONEPE_SALT_KEY) + "###" + process.env.PHONEPE_SALT_INDEX
    return verfyKey;
}

async function updateTransactionAllGetway(decoded, cb) {
    
    if (decoded['user_id'] && decoded['gateway_name'] && decoded['order_id'] && decoded['txn_id'] && decoded['banktxn_id'] && decoded['txn_date'] && decoded['txn_amount'] && decoded['currency']) {

        let authUser = await User.findOne({ '_id': decoded['user_id'] });
        if (authUser) {

            let txnEntity = {};
            let isCouponUsed = 0;
            let c_discount_amount = 0;
            let date = new Date();
            txnEntity.user_id = decoded['user_id'];
            txnEntity.order_id = decoded['order_id'];
            txnEntity.txn_id = decoded['txn_id'];
            txnEntity.banktxn_id = decoded['banktxn_id'];
            if (decoded['coupon_id']) {
                txnEntity.coupon_id = decoded['coupon_id'];
            }
            if (decoded['discount_amount']) {
                txnEntity.discount_amount = decoded['discount_amount'];
            }
            txnEntity.txn_date = Date.now(); //decoded['txn_date'];
            // txnEntity.txn_amount =   decoded['txn_amount'];
            txnEntity.currency = decoded['currency'];
            // txnEntity.gateway_name  =    decoded['gateway_name'];
            txnEntity.gateway_name = (decoded['gateway_name'] == 'PAYUBIZZ') ? "PAYUBIZ" : decoded['gateway_name'];
            txnEntity.checksum = decoded['checksum'];
            txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
            txnEntity.added_type = TransactionTypes.CASH_DEPOSIT; // Deposit Cash status
            txnEntity.status = true

            // if txnEntity
            if (txnEntity) {
                let users = authUser

                let txnData = {};
                if (decoded['gateway_name'] !== 'PAYTM_ALL_IN_ONE') {
                    txnData = await Transaction.findOne({ _id: decoded['txn_id'], status: false });
                } else if (decoded['gateway_name'] === "PAYTM_ALL_IN_ONE") {
                    txnData = await Transaction.findOne({ _id: decoded['order_id'], status: false });
                }

                // Manage tnxdata
                if (txnData) {
                    if (decoded['coupon_id'] && decoded['discount_amount'] > 0) {
                        var start = new Date();
                        start.setHours(0,0,0,0);
                        let couponCode = await PaymentOffers.findOne({ '_id': decoded['coupon_id'],expiry_date:{$gte:start.toISOString()} });

                        if (couponCode) {
                            if (decoded['txn_amount'] >= couponCode.min_amount) {
                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'user_id': decoded['user_id'], 'status': 1 }).countDocuments();
                                if (appkiedCount <= couponCode.per_user_limit) {
                                    let r = 0;
                                    if (couponCode.usage_limit != 0) {
                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'status': 1 }).countDocuments();
                                        if (allAppkiedCount > couponCode.usage_limit) {
                                            r = 1;
                                        }
                                    }

                                    if (r == 0) {

                                        if (couponCode.max_cashback_percent > 0) {
                                            discountPercent = couponCode.max_cashback_percent;
                                            discountAmount = (discountPercent / 100) * decoded['txn_amount'];
                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                discountAmount = couponCode.max_cashback_amount;
                                            }
                                        } else {
                                            discountAmount = couponCode.max_cashback_amount;
                                        }

                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                        decoded['discount_amount'] = parseFloat(decoded['discount_amount']).toFixed(2);
                                        if (discountAmount <= decoded['discount_amount']) {

                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': decoded['coupon_id'], user_id: decoded['user_id'], status: 0 }, { $set: { status: 1 } });
                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                let txnType = '';
                                                isCouponUsed = 1;
                                                if (couponCode.coupon_type === 'extra') {
                                                    users.extra_amount = parseFloat(users.extra_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                } else if(couponCode.coupon_type === 'extra_deposite') {
                                                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_DEPOSITE;
                                                } else {
                                                    users.bonus_amount = parseFloat(users.bonus_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.COUPON_BONUS
                                                }
                                                c_discount_amount = discountAmount;
                                                let date = new Date();
                                                let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                Transaction.saveTransaction(users.id, txnId, txnType, discountAmount);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                let txn_status = false;
                if (txnData) {
                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(txnData.txn_amount);
                    try{
                        if(users && users.isFirstPaymentAdded && users.isFirstPaymentAdded == 2 && isCouponUsed == 0){
                            let amountAdded  = parseFloat(txnData.txn_amount);
                            let finalAmount = amountAdded > 2000 ? 2000: amountAdded;
                            users.bonus_amount = parseFloat(users.bonus_amount)+ (finalAmount);
                            let date = new Date();
                            let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                            Transaction.saveTransaction(users.id, txnId, TransactionTypes.FIRST_DEPOSITE_BONUS, finalAmount);
                            try{
                                let appsflyerURL = "";
                                if(authUser.device_type == "Android"){
                                    appsflyerURL = config.appsFlyerAndroidUrl;
                                } else {
                                    appsflyerURL = config.appsFlyeriPhoneUrl;
                                }
                                if(authUser && authUser.appsflayer_id){
                                    let event_val = { 
                                        "af_customer_user_id": authUser.clevertap_id || '',
                                        "email":  authUser.email || '', 
                                        "mobile": authUser.mobile_number || '',
                                        "af_revenue": txnData.txn_amount, 
                                        "af_currency": "INR", 
                                        "txn_id": txnData._id || '', 
                                        "clevertap_id": authUser.clevertap_id || '',
                                        "appsflyer_id": authUser.appsflayer_id || '', 
                                        "user_id": authUser._id || '', 
                                        "coupon_id": decoded['coupon_id'] || '', 
                                        "discount_amount": c_discount_amount
                                      };
                                    var tData = {
                                      "eventName": "FirstDepositS2S",
                                      "appsflyer_id": authUser.appsflayer_id || '',
                                      "eventCurrency": 'INR',
                                      "eventTime" : new Date(),
                                      "customer_user_id": decoded['user_id'] || '', 
                                      "eventValue":JSON.stringify(event_val),
                                      };
                                      appsFlyerEntryService(tData,appsflyerURL);
                                     
                                }
                              } catch(appsflyererrr){
                                 console.log('errr in transaction for appsflyer',appsflyererrr);
                              }
                          } else {
                            try{
                                let appsflyerURL = "";
                                if(authUser.device_type == "Android"){
                                    appsflyerURL = config.appsFlyerAndroidUrl;
                                } else {
                                    appsflyerURL = config.appsFlyeriPhoneUrl;
                                }
                                if(authUser && authUser.appsflayer_id){
                                    let event_val = { 
                                        "af_customer_user_id": authUser.clevertap_id || '',
                                        "email":  authUser.email || '', 
                                        "mobile": authUser.mobile_number || '',
                                        "af_revenue": txnData.txn_amount, 
                                        "af_currency": "INR", 
                                        "txn_id": txnData._id || '', 
                                        "clevertap_id": authUser.clevertap_id || '',
                                        "appsflyer_id": authUser.appsflayer_id || '', 
                                        "user_id": authUser._id || '', 
                                        "coupon_id": decoded['coupon_id'] || '', 
                                        "discount_amount": c_discount_amount
                                      };
                                    var tData = {
                                      "eventName": "s2sCashDeposite",
                                      "appsflyer_id": authUser.appsflayer_id || '',
                                      "eventCurrency": 'INR',
                                      "eventTime" : new Date(),
                                      "customer_user_id": decoded['user_id'] || '', 
                                      "eventValue":JSON.stringify(event_val),
                                      };
                                      appsFlyerEntryService(tData,appsflyerURL);
                                     
                                }
                              } catch(appsflyererrr){
                                 console.log('errr in transaction for appsflyer',appsflyererrr);
                              }
                          }
                     }catch(errrrr){
                        console.log('first time user is coming errrr*****',errrrr);
                     }
                    
                    let res = await User.updateOne({ '_id': decoded['user_id'] }, { $set: { isFirstPaymentAdded:1,cash_balance: users.cash_balance, bonus_amount: users.bonus_amount, extra_amount: users.extra_amount } });
                    await Transaction.updateOne({ _id: txnData._id }, { $set: txnEntity });

                    txn_status = true;
                }
                if (txn_status == true) {
                    cb(ApiUtility.success({}, 'Amount added successfully'));
                } else {
                    cb(ApiUtility.success({}, 'Amount added successfully'));
                }
            }

        }
    } else {
        cb(ApiUtility.failed('Please check all details are correct or not.'));
    }
}

async function updateTransactionPaytmAllNew(decoded, transationStatus = false, cb) {

    if (decoded['user_id'] && decoded['gateway_name'] && decoded['order_id'] && decoded['txn_id'] && decoded['banktxn_id'] && decoded['txn_date'] && decoded['txn_amount'] && decoded['currency']) {

        let authUser = await User.findOne({ '_id': decoded['user_id'] });
        if (authUser) {

            let txnEntity = {};

            let date = new Date();
            txnEntity.user_id = decoded['user_id'];
            txnEntity.order_id = decoded['order_id'];
            txnEntity.txn_id = decoded['txn_id'];
            txnEntity.banktxn_id = decoded['banktxn_id'];
            if (decoded['coupon_id']) {
                txnEntity.coupon_id = decoded['coupon_id'];
            }
            if (decoded['discount_amount']) {
                txnEntity.discount_amount = decoded['discount_amount'];
            }
            txnEntity.txn_date = Date.now(); //decoded['txn_date'];
            // txnEntity.txn_amount =   decoded['txn_amount'];
            txnEntity.currency = decoded['currency'];
            // txnEntity.gateway_name  =    decoded['gateway_name'];
            txnEntity.gateway_name = (decoded['gateway_name'] == 'PAYUBIZZ') ? "PAYUBIZ" : decoded['gateway_name'];
            txnEntity.checksum = decoded['checksum'];
            txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
            txnEntity.added_type = TransactionTypes.CASH_DEPOSIT; // Deposit Cash status
            txnEntity.status = true

            // if txnEntity
            if (txnEntity) {
                let users = authUser

                let txnData = {};
                if (decoded['gateway_name'] !== 'WALLET') {
                    txnData = await Transaction.findOne({ _id: decoded['txn_id'], status: false });
                } else if (decoded['gateway_name'] === "WALLET") {
                    txnData = await Transaction.findOne({ _id: decoded['order_id'], status: false });
                    console.log("-----------Transaction result ------", txnData)
                }

                // Manage tnxdata
                if (txnData) {
                    if (decoded['coupon_id'] && decoded['discount_amount'] > 0) {
                        let couponCode = await PaymentOffers.findOne({ '_id': decoded['coupon_id'] });

                        if (couponCode) {
                            if (decoded['txn_amount'] >= couponCode.min_amount) {
                                let appkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'user_id': decoded['user_id'], 'status': 1 }).countDocuments();
                                if (appkiedCount <= couponCode.per_user_limit) {
                                    let r = 0;
                                    if (couponCode.usage_limit != 0) {
                                        let allAppkiedCount = await UserCouponCodes.find({ 'coupon_code_id': decoded['coupon_id'], 'status': 1 }).countDocuments();
                                        // print_r(allAppkiedCount);
                                        if (allAppkiedCount > couponCode.usage_limit) {
                                            r = 1;
                                        }
                                    }

                                    if (r == 0) {

                                        if (couponCode.max_cashback_percent > 0) {
                                            discountPercent = couponCode.max_cashback_percent;
                                            discountAmount = (discountPercent / 100) * decoded['txn_amount'];
                                            if (discountAmount > couponCode.max_cashback_amount) {
                                                discountAmount = couponCode.max_cashback_amount;
                                            }
                                        } else {
                                            discountAmount = couponCode.max_cashback_amount;
                                        }

                                        discountAmount = parseFloat(discountAmount).toFixed(2);
                                        decoded['discount_amount'] = parseFloat(decoded['discount_amount']).toFixed(2);
                                        if (discountAmount <= decoded['discount_amount']) {

                                            let updateCouponCode = await UserCouponCodes.updateOne({ 'coupon_code_id': decoded['coupon_id'], user_id: decoded['user_id'], status: 0 }, { $set: { status: 1 } });
                                            if (updateCouponCode && updateCouponCode.nModified > 0) {
                                                let txnType = '';
                                                if (couponCode.coupon_type === 'extra') {
                                                    users.extra_amount = parseFloat(users.extra_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.EXTRA_BONUS;
                                                } else {
                                                    users.bonus_amount = parseFloat(users.bonus_amount) + parseFloat(discountAmount);
                                                    txnType = TransactionTypes.COUPON_BONUS
                                                }
                                                let date = new Date();
                                                let txnId = 'CB' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + decoded['user_id'];
                                                Transaction.saveTransaction(users.id, txnId, txnType, discountAmount);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                let txn_status = false;
                if (txnData) {
                    users.cash_balance = parseFloat(users.cash_balance) + parseFloat(txnData.txn_amount);
                    await User.update({ '_id': decoded['user_id'] }, { $set: { cash_balance: users.cash_balance, bonus_amount: users.bonus_amount, extra_amount: users.extra_amount } });

                    await Transaction.updateOne({ _id: txnData._id }, { $set: txnEntity });

                    txn_status = true;
                }

                if (txn_status == true) {
                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                } else {
                    return res.send(ApiUtility.success({}, 'Amount added successfully'));
                }
            }

        }
    }
    else {
        return res.send(ApiUtility.failed('Please check all details are correct or not.'));
    }

}
