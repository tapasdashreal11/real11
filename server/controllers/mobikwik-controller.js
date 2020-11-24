
const Transaction = require('../models/transaction');
const User = require('../models/user');
var sha256 = require('js-sha256');
const config = require('../config');

module.exports.showForm = async function (req, res) {
    const transactionId = req.params.transactionId;
    let transaction = await Transaction.findById(transactionId);
    if(transaction){
        let user = await User.findById(transaction.user_id);
        if(user){
            let date = new Date();
            let mobikwikParams = {
                amount: transaction.txn_amount.toFixed(2) * 100,
                buyerEmail: user.email,
                currency: 'INR',
                merchantIdentifier: config.mobikwik.merchantIdentifier,
                merchantIpAddress:'127.0.0.1',
                mode:1,
                orderId:transaction.order_id,
                purpose:1,
                returnUrl:`${req.protocol}://${req.get('host')}/mobikwik/callback`,
                txnDate: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
                txnType:1,
                zpPayOption:1
            }
            let checksumString = "";
            for(const param of Object.keys(mobikwikParams)){
                checksumString += `${param}=${mobikwikParams[param]}`;
                // if(Object.keys(mobikwikParams)[Object.keys(mobikwikParams).length-1] !== param){
                    checksumString += '&'
                // }
            }
            let checksum = sha256.hmac(config.mobikwik.secret, checksumString);
            return res.render('payment-gateway/mobikwik', {checksum:checksum,mobikwikParams:mobikwikParams});
        }
    }
};

module.exports.callback = async function(req, res){
    if(req.body && req.body.responseCode && req.body.responseCode == "100"){
        return res.redirect('/mobikwik/callback/success');
    } else {
        return res.redirect('/mobikwik/callback/failure');
    }
    //return res.send(req.body);
}