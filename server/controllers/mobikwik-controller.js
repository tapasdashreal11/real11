
const Transaction = require('../models/transaction');
const User = require('../models/user');
var sha256 = require('js-sha256');
const config = require('../config');

module.exports.showForm = async function (req, res) {
    const transactionId = req.params.transactionId;
    let transaction = await Transaction.findById(transactionId);
    // console.log(transaction);return false
    if(transaction){
        let user = await User.findById(transaction.user_id);
        if(user){
            let date = new Date();
            let mobikwikParams = {
                email: user.email,
                amount: transaction.txn_amount.toFixed(2),
                cell: Number(user.phone),
                orderId: transaction._id,
                mid: config.mobikwik.mid,
                merchantname: "Real11",
                redirecturl: `${req.protocol}://${req.get('host')}/mobikwik/callback`,
                showmobile: true,
                // version: "refid"
                // currency: 'INR',
                // merchantIdentifier: config.mobikwik.merchantIdentifier,
                // merchantIpAddress:'127.0.0.1',
                // mode:1,
                // purpose:1,
                // returnUrl:`${req.protocol}://${req.get('host')}/mobikwik/callback`,
                // txnDate: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
                // txnType:1,
                // zpPayOption:1
            }
            let checksumString = "";
            for(const param of Object.keys(mobikwikParams)){
                checksumString += `${param}=${mobikwikParams[param]}`;
                // if(Object.keys(mobikwikParams)[Object.keys(mobikwikParams).length-1] !== param){
                    checksumString += '&'
                // }
            }
            let checksum = sha256.hmac(config.mobikwik.secret, checksumString);
            console.log(checksumString, checksum);
            // return false
            return res.render('payment-gateway/mobikwik', {checksum:checksum,mobikwikParams:mobikwikParams});
        }
    }
};

module.exports.callback = async function(req, res){
    console.log(req.body);
    if(req.body && req.body.responseCode && req.body.responseCode == "100"){
        return res.redirect('/mobikwik/callback/success');
    } else {
        return res.redirect('/mobikwik/callback/failure');
    }
}