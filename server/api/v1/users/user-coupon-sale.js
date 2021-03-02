const { ObjectId } = require('mongodb');
const _ = require("lodash");
const Coupon = require("../../../models/coupon");
const Users = require("../../../models/user");
const CouponSale = require("../../../models/coupon-sale");
const Transaction = require("../../../models/transaction");
const redis = require('../../../../lib/redis');
const { TransactionTypes } = require('../../../constants/app');
const { startSession } = require('mongoose');
module.exports = {
    userCouponList: async (req, res) => {
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let { user_id } = req.body;
            let result = { coupon_list:[], my_coupons:[] };
            try {
                const cData = await Coupon.find({status: 1 }).limit(20).sort({_id:-1});
                const cSaleData = await CouponSale.find({user_id:ObjectId(user_id),status: 1 }).sort({_id:-1});
                result.coupon_list = cData;
                result.my_coupons = cSaleData; 
                redis.redisObj.set('my-coupons-'+ user_id, cSaleData);
                response["data"] = result;
                response["status"] = true;
                response["message"] = "";
                return res.json(response);
                
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
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let { coupon_id, user_id } = req.body;
            const session = await startSession()
            session.startTransaction();
            const sessionOpts = { session, new: true };
            try {
                const cData = await Coupon.findOne({ _id: ObjectId(coupon_id), status: 1 });
                const uData = await Users.findOne({ _id: ObjectId(user_id) }, { cash_balance: 1 });
                console.log("cData******",cData);
                if (uData && uData._id && cData && cData._id ) {
                  const cSaleData  = await CouponSale.findOne({coupon_id:ObjectId(coupon_id),user_id:ObjectId(user_id),status:1});
                  if(cSaleData && cSaleData._id){

                    await session.abortTransaction();
                    session.endSession();
                    response["message"] = "You have already purchased this coupon!!";
                    return res.json(response);
                   } else {
                     // coupon is not purchased by this user_id now can purchase coupon
                     if (uData.cash_balance >= cData.coupon_amount) {
                        let csaleObj= {user_id: uData._id,coupon_id: cData._id,coupon_credit: cData.coupon_credit,expiry_date:cData.expiry_date};
                        await CouponSale.create([csaleObj],{ session: session });
                        await Users.update({ _id: user_id }, {$inc: { cash_balance: -cData.coupon_amount} },sessionOpts);
                        await Coupon.update({ _id: cData._id }, {$inc: { coupon_sale_count: +1} },sessionOpts);
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
                        await Transaction.create([txnEntity],{ session: session });
                        await session.commitTransaction();
                        session.endSession();

                        response["status"] = true;
                        response["message"] = "Coupon Purchase Successfully!!";
                        return res.json(response);
                    } else {
                        await session.abortTransaction();
                        session.endSession();
                        response["message"] = "You have low case balance in your case  wallet.Please add money to purchase the coupon!!";
                        return res.json(response);
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
                console.log("*****err.message",err.message);
                response["message"] = err.message;
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
        try {
            var response = { status: false, message: "Invalid Request", data: {} };
            let { coupon_id, user_id } = req.body;
            try {
                const cData = await Coupon.findOne({ _id: ObjectId(coupon_id), status: 1 });
                const uData = await Users.findOne({ _id: ObjectId(user_id) }, { cash_balance: 1 });
                console.log("cData******",cData);
                if (uData && uData._id && cData && cData._id ) {
                  const cSaleData  = await CouponSale.findOne({coupon_id:ObjectId(coupon_id),user_id:ObjectId(user_id),status:1});
                  if(cSaleData && cSaleData._id){
                    response["message"] = "You have already purchased this coupon!!";
                    return res.json(response);
                   } else {
                     // coupon is not purchased by this user_id now can purchase coupon
                     var data = {
                        "coupon_amount":cData.coupon_amount,
                        "case_balance":cData.cash_balance,
                    }
                    response["status"] = true;
                    response["data"] = data;
                    if (uData.cash_balance >= cData.coupon_amount) {
                        response["message"] = "";
                    } else {
                        response["status"] = false;
                        response["message"] = "You have low case balance to purchase the coupon.Please add sufficient amount to purchase the coupon!";
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
    }
};
