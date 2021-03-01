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
                    if (uData.cash_balance >= cData.coupon_amount) {
                        let csaleObj= {user_id: uData._id,coupon_id: cData._id,coupon_credit: cData.coupon_credit};
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
                        response["message"] = "You have low case balance in your wallet.Please add money to purchase this coupon!!";
                        return res.json(response);
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
    }
};
