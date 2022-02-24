var backendSDK = require('../../../../lib/amazonPay/PWAINBackendSDK');
var config = {
    'merchant_id': 'AZ4WQCLDT2DF0',
    'access_key': 'AKIAJPULB6OPFYQDYARA',
    'secret_key': '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',
    'base_url': 'amazonpay.amazon.in',
    'sandbox': true
};

module.exports = {
    signAndEncrypt: async (req, res) => {
        var client = new backendSDK(config);

        // This can be placed in your controller for a method
        // that is configured to receive a "GET" request from Mobile. If using POST then make //appropriate changes
        
          var responsemap = new Object();
          console.log("AWS signAndEncrypt req.query",req.query);
          //add the parameters as key value pair like below sample -
        
        for (var propName in req.query) {
            responsemap[propName] = req.query[propName];
            }
           // var client = new BackendSDK(config);
            var response = client.generateSignatureAndEncrypt(responsemap);	
        
            console.log("AWS signAndEncrypt response",response);
        //Pass signed and encrypted payload generated above back to your app  
          res.send(response);
    },
    signAndEncryptForOperation: async (req, res) => {
        
        // This can be placed in your controller for a method
        // that is configured to receive a "GET" request from Mobile. If using POST then make //appropriate changes

        var responsemap = new Object();

        //add the parameters as key value pair like below sample -
        console.log("AWS signAndEncryptForOperation req.query",req.query);
        for (var propName in req.query) {
            responsemap[propName] = req.query[propName];
        }
        responsemap['operationName'] = 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST';
        var client = new backendSDK(config);
        var response = client.generateSignatureAndEncrypt(responsemap);
        console.log("AWS signAndEncryptForOperation response",response);
        //Pass signed and encrypted payload generated above back to your app  
        res.send(response);
    },
    verifySignature: async (req, res) => {
        // that is configured to receive a "GET" request from Amazon Pay.
        //Create a map of all the parameters returned.
        var responsemap = new Object();
        console.log("AWS Vefify Sign req.query",req.query);
        //add the parameters as key value pair like below sample -
        for (var propName in req.query) {
            responsemap[propName] = req.query[propName];
        }

        var client = new backendSDK(config);
        var response = client.verifySignature(responsemap);

        // This will return "true" if the response has a valid signature from Amazon else it will return "false".
        console.log("AWS Vefify Sign resp",response);
        res.send(response);
    }
}