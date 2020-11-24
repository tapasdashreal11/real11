'use strict';

var paypal = require('paypal-rest-sdk');
var Promise = require('bluebird');
const logger = require('../utils/logger')(module);

logger.info("Paypal client Id: ", process.env.PAYPAL_CLIENTID);
logger.info("Paypal client secret: ", process.env.PAYPAL_CLIENT_SECRET);


paypal.configure({
    'mode': 'sandbox', //sandbox or live
    'client_id': process.env.PAYPAL_CLIENTID,
    'client_secret': process.env.PAYPAL_CLIENT_SECRET,
    'headers' : {
		'custom': 'header'
    }
});

module.exports.paymentCreate = function(create_payment_json){
	return new Promise(function(resolve, reject){
		paypal.payment.create(create_payment_json, function (error, payment) {
		    if (error) { reject(error); }
		    else { resolve(payment); }
		});
	});
};

module.exports.paymentExecute = function(paymentId, execute_payment_json, create_payment_json){
	return new Promise(function(resolve, reject){
		paypal.payment.execute(paymentId, execute_payment_json, function (error, payment) {
		    if (error) { reject(error); }
		    else { resolve(payment); }
		});
	});
};

module.exports.paymentUpdate = function(paymentId, update_payment_json){
	return new Promise(function(resolve, reject){
		paypal.payment.update(paymentId, update_payment_json, function (error, payment) {
		    if (error) { reject(error); }
		    else { resolve(payment); }
		});
	});
};

module.exports.paymentRefund = function(paymentId, update_payment_json){
	return new Promise(function(resolve, reject){
		paypal.sale.refund(paymentId, update_payment_json, function (error, payment) {
		    if (error) { reject(error); }
		    else { resolve(payment); }
		});
	});
};
