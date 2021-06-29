
const Transaction = require('../models/transaction');
const User = require('../models/user');
var sha256 = require('js-sha256');
const config = require('../config');
const ApiUtility = require("../api/api.utility");

module.exports.showForm = async function (req, res) {
    const transactionId = req.params.transactionId;
    let transaction = await Transaction.findById(transactionId);
    if(transaction){
        let user = await User.findById(transaction.user_id);
        console.log(user);
        return false
        if(user){
            let txnDate = new Date();
            let month = ("0" + (txnDate.getMonth() + 1)).slice(-2);
            let date = ("0" + (txnDate.getDate())).slice(-2);
            let mobikwikParams = {
                amount: transaction.txn_amount.toFixed(2) * 100,
                buyerEmail: user.email,
                currency: 'INR',
                // debitorcredit: "netbanking",
                merchantIdentifier: config.mobikwik.merchantIdentifier,
                merchantIpAddress:'127.0.0.1',
                mode:1,
                orderId:transaction._id,
                purpose:0,
                returnUrl:`${req.protocol}://${req.get('host')}/mobikwik/callback`,
                txnDate: `${txnDate.getFullYear()}-${month}-${date}`,
                txnType:12,
                zpPayOption:1
            }
            console.log(mobikwikParams,"mobikwik");
            let checksumString = "";
            for(const param of Object.keys(mobikwikParams)){
                checksumString += `${param}=${mobikwikParams[param]}`;
                // if(Object.keys(mobikwikParams)[Object.keys(mobikwikParams).length-1] !== param){
                    checksumString += '&'
                // }
            }
            let checksum = sha256.hmac(config.mobikwik.secret, checksumString);
            // console.log(checksum, mobikwikParams );
            return res.render('payment-gateway/mobikwik', {checksum:checksum,mobikwikParams:mobikwikParams});
        }
    }
};

module.exports.callback = async function(req, res){
    // console.log(req.body,"body");
    if(req.body && req.body.responseCode && req.body.responseCode == "100"){
        return res.send(ApiUtility.success(req.body, 'Transaction Successfully.')); 
    } else {
        return res.send(ApiUtility.failed('Transaction Failed..'));
    }
}