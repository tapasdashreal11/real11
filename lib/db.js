"use strict";
var logger      = require('../utils/logger')(module);

module.exports = function () {

	var USERS_COLLECTION = 'users',
		ORDERS_COLLECTION = 'orders',
        PROFORMA_SALESRECEIPT_COLLECTION = 'proformaSalesReceipt',
        PROFORMA_BILL_COLLECTION = 'proformaBill',
	    db;


	return {
		configure: function (dbConnection) {
	       //db = mongo.db((config ? config : 'mongodb://localhost:27017/paypal_pizza'), {w : 1});
	       db = dbConnection;
		},

        insertOrder: function (order_id, user, restaurant, payment_id, state, totalPrice, orderItems, taxAmount, taxRate, tip, created_time, status, callback) {
            db.collection(ORDERS_COLLECTION).insert({order_id : order_id, user: user, restaurant: restaurant, payment_id : payment_id, state : state, totalPrice : totalPrice, orderItem: orderItems, taxAmount: taxAmount, taxRate: taxRate, tip: tip, created_time : created_time, status : status}, function (err, result) {
            logger.info(`db.collection(${ORDERS_COLLECTION}).insert({order_id : ${order_id}, user: ${user}, restaurant: ${restaurant}, payment_id : ${payment_id}, state : ${state}, totalPrice : ${totalPrice}, orderItems: ${orderItems}, taxAmount: ${taxAmount}, taxRate: ${taxRate}, tip: ${tip}, created_time : ${created_time}, status : ${status}}`);
				if (err) {
					logger.error("Order insertion error: " + err);
					callback(new Error(err));
				} else {
					callback(null, result);
				}
			});
		},
		updateOrder: function (order_id, state, status, created_time, callback) {
            db.collection(ORDERS_COLLECTION).update({order_id : order_id}, {$set : {created_time : created_time, state : state, status : status}}, function (err, update) {
                if (err) {
                    logger.error("Order insertion error: " + err);
                    callback(new Error(err));
                }
                else {
                    //console.log("Order insertion : " + update);
                    callback(null, update);
                }
            });
        },
        getOrders: function (userId, venueId, callback) {
            var user_id = userId.toString();
            db.collection(ORDERS_COLLECTION).find({'user.id' : user_id, venueId: venueId}, {limit : 10, sort : [['created_time', -1]]}, function (err, orders) {
                logger.info(`db.collection(${ORDERS_COLLECTION}).find({'user.id': ${user_id}}, {limit : 10, sort : [['created_time', -1]]})`);
                if (err) {
                    logger.error("error retrieving order:" + err);
                    callback(new Error(err));
                } else {
                	orders.toArray(function (err, orderItem) {
                        // console.log(" ... " + orderItem);
	                    callback(err, orderItem);
                    });
        		}
            });
        },
        getOrder: function (order_id, callback) {
            db.collection(ORDERS_COLLECTION).findOne({order_id : order_id}, function (err, order) {
                logger.info(`db.collection( ${ORDERS_COLLECTION}).findOne({order_id: ${order_id}} )`);
                if (err) {
                    logger.error("error retrieving order:" + err);
                    callback(new Error(err));
                } else {
                    //console.log(order);
                    callback(null, order);
                }
            });
        },
                
        getShoppingCartItem: function(callback){
             db.collection('shoppingCartItem').find({}).toArray(function(err, results){
				 if (err) {
				   logger.error(err);
	  			   callback(new Error(err));
				}
				else{
				   callback(null, results);
				}
		    });
		},

        insertProformaSalesReceipt: function(salesreceipt, callback) {
            var orderId     = salesreceipt.orderId;
            var status      = salesreceipt.status;
            // var CustomField = salesreceipt.CustomField;
            var Line        = salesreceipt.Line;
            var CustomerRef = salesreceipt.CustomerRef;
            var CustomerMemo = salesreceipt.CustomerMemo;
            var TotalAmt    = salesreceipt.TotalAmt;
            var ApplyTaxAfterDiscount = salesreceipt.ApplyTaxAfterDiscount;
            var Balance     = salesreceipt.Balance;
            var PaymentMethodRef   = salesreceipt.PaymentMethodRef;
            var PaymentRefNum = salesreceipt.PaymentRefNum;
            var DepositToAccountRef = salesreceipt.DepositToAccountRef;
            var created_time  = salesreceipt.Time;

            db.collection(PROFORMA_SALESRECEIPT_COLLECTION).insert(
            {
                'orderId' : orderId, 'status': status, 'Line': Line, 
                'CustomerRef': CustomerRef, 'CustomerMemo': CustomerMemo, 'TotalAmt': TotalAmt, 
                'ApplyTaxAfterDiscount': ApplyTaxAfterDiscount, 'Balance': Balance, 
                'PaymentMethodRef': PaymentMethodRef, 'PaymentRefNum': PaymentRefNum, 
                'DepositToAccountRef': DepositToAccountRef, 'created_time': created_time 
            }, function (err, result) {
                logger.info(`db.collection(${PROFORMA_SALESRECEIPT_COLLECTION}).insert({salesreceipt: ${salesreceipt}`);
                if (err) {
                    logger.error("Proforma SalesReceipt insertion error: " + err);
                    callback(new Error(err));
                } else {
                    callback(null, result);
                }
            });
        },

        insertProformaBill: function(bill, callback) {
            var orderId         = bill.orderId;
            var status          = bill.status;
            var SalesTermRef    = bill.SalesTermRef;
            var PrivateNote     = bill.PrivateNote;
            var Line            = bill.Line;
            var VendorRef       = bill.VendorRef;
            var TotalAmt        = bill.TotalAmt;
            var TotalAmtOrigin  = bill.TotalAmtOrigin;
            var created_time    = bill.Time;

            db.collection(PROFORMA_BILL_COLLECTION).insert(
            {
                'orderId' : orderId, 'status': status, 'Line': Line, 
                'VendorRef': VendorRef, 'TotalAmt': TotalAmt, 'TotalAmtOrigin': TotalAmtOrigin,
                'SalesTermRef': SalesTermRef, 'PrivateNote': PrivateNote,
                'created_time': created_time 
            }, function (err, result) {
                logger.info(`db.collection(${PROFORMA_BILL_COLLECTION}).insert({bill: ${bill}`);
                if (err) {
                    logger.error("Proforma Bill insertion error: " + err);
                    callback(new Error(err));
                } else {
                    callback(null, result);
                }
            });
        },

        getProformaSalesReceipt: function (orderId, callback) {
            db.collection(PROFORMA_SALESRECEIPT_COLLECTION).findOne({orderId : orderId}, function (err, proformaSalesReceipt) {
                // logger.info(`db.collection( ${PROFORMA_SALESRECEIPT_COLLECTION}).findOne({orderId: ${orderId}} )`);
                if (err) {
                    logger.error("error retrieving order:" + err);
                    callback(new Error(err));
                } else {
                    callback(null, proformaSalesReceipt);
                }
            });
        },

        proformaSalesReceiptUpdate: function (CustomField, id, callback) {
            var now = (new Date()).toISOString().replace(/\.[\d]{3}Z$/, 'Z ');
            db.collection(PROFORMA_SALESRECEIPT_COLLECTION).update({_id: id}, {$set : {CustomField: CustomField, updated_time: now}}, function (err, proformaSalesReceipt) {
                // logger.info(`db.collection( ${PROFORMA_SALESRECEIPT_COLLECTION}).findOne({orderId: ${orderId}} )`);
                if (err) {
                    logger.error("error retrieving order:" + err);
                    callback(new Error(err));
                } else {
                    callback(null, proformaSalesReceipt);
                }
            });
        },

    };
};
