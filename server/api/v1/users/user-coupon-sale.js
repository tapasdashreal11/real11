const { ObjectId } = require('mongodb');
const _ = require("lodash");
const Coupon = require("../../../models/coupon");
const Users = require("../../../models/user");
const CouponSale = require("../../../models/coupon-sale");
const Transaction = require("../../../models/transaction");
const redis = require('../../../../lib/redis');
const { TransactionTypes } = require('../../../constants/app');
const { startSession } = require('mongoose');
const moment = require('moment');
const config = require('../../../config');
var imageurl = config.imageBaseUrl;
module.exports = {
    userCouponList: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            const user_id = req.userId;
            let result = { coupon_list: [], my_coupons: {}, img_url:imageurl };
            let redisKeyForVipCouponsList = 'vip-coupons-list';
            let redisKeyForUserMyCoupons = 'my-coupons-' + user_id;
            try {
                if (user_id) {
                    let couponList = await getPromiseForCouponData(redisKeyForVipCouponsList, "[]");
                    if (couponList && couponList.length > 0) {
                        let mycouponList = await getPromiseForCouponData(redisKeyForUserMyCoupons, "{}");
                        if (mycouponList && mycouponList.user_id) {
                            result.my_coupons = mycouponList;
                        } else {
                            const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id) });
                            // console.log('cSaleData***********', cSaleData);
                            result.my_coupons = cSaleData || {};
                            redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(cSaleData || {}));
                        }

                        result.coupon_list = couponList;
                        response["data"] = result;
                        response["status"] = true;
                        response["message"] = "";
                        return res.json(response);
                    } else {
                        let proObj = { 'user_id': 1, 'coupon_name': 1, 'coupon_amount': 1, 'expiry_date': 1, 'coupon_credit': 1, 'coupon_sale_count': 1, 'coupon_img': 1, 'coupon_contest_data': 1, 'description': 1, 'coupon_img': 1 };
                        const cData = await Coupon.find({ status: 1 }).limit(20).sort({ _id: -1 });
                       // let saleObj = { 'coupon_credit': 1, 'coupon_used': 1, 'status': 1, 'user_id': 1, 'coupon_id': 1, 'coupon_contest_data': 1 };
                        const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), status: 1 }).sort({ _id: -1 });
                        result.coupon_list = cData || [];
                        result.my_coupons = cSaleData || {};
                        //console.log('cSaleData***', cSaleData);
                        redis.redisObj.set(redisKeyForVipCouponsList, JSON.stringify(cData || []));
                        redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(cSaleData || {}));
                        response["data"] = result;
                        response["status"] = true;
                        response["message"] = "";
                        return res.json(response);
                    }
                } else {
                    return res.json(response);
                }
            } catch (err) {
                response["data"] = result;
                response["message"] = err.message;
                return res.json(response);
            }
        } catch (error) {
            response["data"] = result;
            response["message"] = error.message;
            return res.json(response);
        }
    },
    userCouponPurchase: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { coupon_id } = req.params;
            const user_id = req.userId;
            const session = await startSession()
            session.startTransaction();
            const sessionOpts = { session, new: true };
            try {
                const cData = await Coupon.findOne({ _id: ObjectId(coupon_id), status: 1 });
                const uData = await Users.findOne({ _id: ObjectId(user_id) }, { cash_balance: 1, winning_balance: 1 });
                //console.log("cData******", cData);
                if (uData && uData._id && cData && cData._id) {
                    const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), expiry_date: { $gte: new Date() } });
                    if (cSaleData && cSaleData._id && cSaleData.status == 1) {
                        await session.abortTransaction();
                        session.endSession();
                        response["message"] = "You have already purchased the coupon!!";
                        return res.json(response);
                    } else {
                        // coupon is not purchased by this user_id now can purchase coupon
                        let entryFee = cData.coupon_amount;
                        if (entryFee > 0) {
                            const paymentCal = await calCualteFee(cData.coupon_amount, uData.cash_balance, uData.winning_balance);
                            let cashAmount = paymentCal.cash_amount;
                            let winAmount = paymentCal.winnging_amount;
                            if (entryFee == (winAmount + cashAmount)) {
                                const cUpdatedDoc = await Coupon.findOneAndUpdate({ _id: cData._id }, { $inc: { coupon_sale_count: 1 } }, sessionOpts);
                                if (cUpdatedDoc) {
                                    let couponSaleCount = cUpdatedDoc.coupon_sale_count;

                                    if (cData && cData.coupon_limit < couponSaleCount) {
                                        // console.log("coupon purchase last response ----------***********", couponSaleCount);
                                        await session.abortTransaction();
                                        session.endSession();
                                        let response = {};
                                        response.status = false;
                                        response.message = "This Coupon limit has been fullfiled, please purchase other coupon!!";
                                        response.error_code = null;
                                        return res.json(response);
                                    }
                                    const couponDuration = cData.coupon_duration ? cData.coupon_duration:1;
                                    let couponExpireDateUp =  moment().utc().add(couponDuration,'days').toDate();
                                    let csaleObj = {is_repeat: cData.is_repeat,series_id: cData.series_id,is_private: cData.is_private,coupon_name: cData.coupon_name, description:cData.description,coupon_contest_data: cData.coupon_contest_data, status: 1, user_id: uData._id, coupon_id: cData._id, coupon_used: 0, coupon_credit: cData.coupon_credit, expiry_date: couponExpireDateUp };

                                    await CouponSale.findOneAndUpdate({ user_id: ObjectId(user_id) }, csaleObj, { upsert: true, new: true, session: session });
                                    let txnEntity = {};
                                    txnEntity.user_id = user_id;
                                    txnEntity.txn_amount = cData.coupon_amount;
                                    txnEntity.currency = 'INR';
                                    txnEntity.txn_date = Date.now();
                                    txnEntity.created = Date.now();
                                    let date = new Date();
                                    txnEntity.local_txn_id = 'DD' + date.getFullYear() + date.getMonth() + date.getDate() + Date.now() + user_id;
                                    txnEntity.added_type = TransactionTypes.COUPON_PURCHASE_TXN; // Coupon purchase txn
                                    txnEntity.status = 1; // status
                                    await Users.updateOne({ _id: user_id }, { $inc: { cash_balance: -cashAmount, winning_balance: -winAmount } }, sessionOpts);
                                    await Transaction.create([txnEntity], { session: session });
                                    await session.commitTransaction();
                                    session.endSession();
                                    redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(csaleObj || {}));
                                    response["status"] = true;
                                    response["message"] = "Coupon Purchase Successfully!!";
                                    return res.json(response);

                                } else {
                                    await session.abortTransaction();
                                    session.endSession();
                                    // console.log('Error in else *****');
                                    let response = {};
                                    response.status = false;
                                    response.message = "This Coupon limit has been fullfiled, please purchase other coupon!!";
                                    response.error_code = null;
                                    return res.json(response);
                                }

                            } else {
                                await session.abortTransaction();
                                session.endSession();
                                response["message"] = "You have low case balance in your wallet. Please add money to purchase the coupon!!";
                                return res.json(response);
                            }
                        } else if (entryFee == 0) {
                            const cUpdatedDoc = await Coupon.findOneAndUpdate({ _id: cData._id }, { $inc: { coupon_sale_count: 1 } }, sessionOpts);
                            if (cUpdatedDoc) {
                                let couponSaleCount = cUpdatedDoc.coupon_sale_count;

                                if (cData && cData.coupon_limit < couponSaleCount) {
                                   // console.log("coupon purchase last response ----------***********", couponSaleCount);
                                    await session.abortTransaction();
                                    session.endSession();
                                    let response = {};
                                    response.status = false;
                                    response.message = "This Coupon limit has been fullfiled, please purchase other coupon!!";
                                    response.error_code = null;
                                    return res.json(response);
                                }
                                const couponDuration = cData.coupon_duration ? cData.coupon_duration:1;
                                let couponExpireDateUp =  moment().utc().add(couponDuration,'days').toDate();
                                let csaleObj = {is_repeat: cData.is_repeat,series_id: cData.series_id,is_private: cData.is_private,coupon_name: cData.coupon_name, description:cData.description, coupon_contest_data: cData.coupon_contest_data, status: 1, user_id: uData._id, coupon_id: cData._id, coupon_used: 0, coupon_credit: cData.coupon_credit, expiry_date: couponExpireDateUp };
                                await CouponSale.findOneAndUpdate({  user_id: ObjectId(user_id) }, csaleObj, { upsert: true, new: true, session: session });

                                await session.commitTransaction();
                                session.endSession();
                                redis.redisObj.set('my-coupons-' + user_id, JSON.stringify(csaleObj || {}));
                                response["status"] = true;
                                response["message"] = "Coupon Purchase Successfully!!";
                                return res.json(response);

                            } else {
                                await session.abortTransaction();
                                session.endSession();
                                // console.log('Error in else *****');
                                let response = {};
                                response.status = false;
                                response.message = "This Coupon limit has been fullfiled, please purchase other coupon!!";
                                response.error_code = null;
                                return res.json(response);
                            } 


                        }
                    }

                } else {
                    await session.abortTransaction();
                    session.endSession();
                    response["message"] = "Something went wrong!!";
                    return res.json(response);
                }
            } catch (err) {
                await session.abortTransaction();
                session.endSession();
                console.log("*****err.message", err.message);
                response["message"] = 'Something went wrong!!';
                return res.json(response);
            } finally {
                // ending the session
                session.endSession();
            }
        } catch (error) {
            response["message"] = error.message;
            return res.json(response);
        }
    },
    userCouponWalletAmount: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { coupon_id } = req.params;
            const user_id = req.userId;
            try {
                const cData = await Coupon.findOne({ _id: ObjectId(coupon_id), status: 1 });
                const uData = await Users.findOne({ _id: ObjectId(user_id) }, { cash_balance: 1, winning_balance: 1 });
                //console.log("cData******", cData);
                let cashAmount = 0;
                let winAmount = 0;
                if (uData && uData._id && cData && cData._id) {
                    const cSaleData = await CouponSale.findOne({ user_id: ObjectId(user_id), expiry_date: { $gte: new Date() } });
                    if (cSaleData && cSaleData._id && cSaleData.status && cSaleData.status == 1) {

                        response["message"] = "You have already purchased the coupon!!";
                        return res.json(response);
                    } else {
                        // coupon is not purchased by this user_id now can purchase coupon
                        const paymentCal = await calCualteFee(cData.coupon_amount, uData.cash_balance, uData.winning_balance);
                        cashAmount = paymentCal.cash_amount;
                        winAmount = paymentCal.winnging_amount;
                        var data = {
                            "coupon_amount": cData.coupon_amount,
                            "cash_balance": uData.cash_balance || 0,
                            "winning_balance": uData.winning_balance || 0,
                            "payment_cal": paymentCal
                        }
                        response["status"] = true;
                        response["data"] = data;
                        let entryFee = cData.coupon_amount;
                        if (entryFee == (winAmount + cashAmount)) {
                            response["message"] = "";
                        } else {
                            response["status"] = true;
                            response["message"] = "You have low case balance to purchase the coupon. Please add sufficient amount to purchase the coupon!!";
                        }
                        return res.json(response);
                    }

                } else {
                    response["message"] = "Something went wrong!!";
                    return res.json(response);
                }
            } catch (err) {
                response["message"] = err.message;
                return res.json(response);
            }
        } catch (error) {
            response["message"] = error.message;
            return res.json(response);
        }
    },
    userCouponRevoke: async (req, res) => {
        var response = { status: false, message: "Invalid Request", data: {} };
        try {
            let { coupon_id } = req.params;
            const user_id = req.userId;
            try {
                if (coupon_id && user_id) {
                    const cSaleData = await CouponSale.findOneAndUpdate({ user_id: ObjectId(user_id), coupon_id: ObjectId(coupon_id) }, { $set: { status: 0 } });
                    if (cSaleData) {
                        response["status"] = true;
                        response["message"] = "";
                        return res.json(response);
                    } else {
                        response["message"] = "Something went wrong!!";
                        response["status"] = false;
                        return res.json(response);
                    }

                } else {
                    response["message"] = "Something went wrong!!";
                    return res.json(response);
                }
            } catch (err) {
                response["message"] = err.message;
                return res.json(response);
            }
        } catch (error) {
            response["message"] = error.message;
            return res.json(response);
        }
    }
};

async function getPromiseForCouponData(key, defaultValue) {
    return new Promise((resolve, reject) => {
        redis.redisObj.get(key, async (err, data) => {
            if (err) {
                reject(defaultValue);
            }
            if (data == null) {
                data = defaultValue;
            }
            resolve(JSON.parse(data))
        })
    })
}

async function calCualteFee(entryFee, cash_balance, winnging_balance) {
    let remainingFee = entryFee;
    let dedCashAmount = 0;
    let dedWinngingBalance = 0;
    if (remainingFee) {
        if (cash_balance && cash_balance > 0) {
            dedCashAmount = (cash_balance > remainingFee) ? remainingFee : cash_balance;
            remainingFee = (cash_balance < remainingFee) ? remainingFee - cash_balance : 0;
        }
    }
    if (remainingFee) {
        if (winnging_balance && winnging_balance > 0) {
            dedWinngingBalance = (winnging_balance > remainingFee) ? remainingFee : winnging_balance;
            remainingFee = (winnging_balance < remainingFee) ? remainingFee - winnging_balance : 0;
        }
    }

    return { cash_amount: dedCashAmount, winnging_amount: dedWinngingBalance }

}