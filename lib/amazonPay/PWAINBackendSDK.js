var crypto = require('crypto');
var fs = require('fs');
var ini = require('./ini');
var path = require('path');
var wrap = require('./wordwrap');
var HttpCurl = require('./httpcurl');
var parseString = require('xml2js').parseString;

function PWAINBackendSDK(params) {

    // Create private functions with var keyword and public functions with this keyword same thing applies on variable scopes.

    var fields = [];
    var config = {
        'merchant_id': null,
        'secret_key': null,
        'access_key': null,
        'base_url': null,
        'application_name': null,
        'application_version': null,
        'currency_code': null,
        'client_id': null,
        'region': null,
        'sandbox': null,
        'platform_id': null,
        'application_name': null,
        'application_version': null,
        'content_type': null
    };

    var params_SignAndEncrypt = {

        "orderTotalAmount": true,
        "orderTotalCurrencyCode": true,
        "sellerOrderId": true,
        "customInformation": false,
        "sellerNote": false,
        "transactionTimeout": false,
        "isSandbox": false,
        "sellerStoreName": false
    };

    var params_verifySignature = {
        "description": true,
        "reasonCode": true,
        "status": true,
        "signature": false,
        "sellerOrderId": false,
        "amazonOrderId": false,
        "transactionDate": false,
        "orderTotalAmount": false,
        "orderTotalCurrencyCode": false,
        "customInformation": false
    };

    var params_SignAndEncryptGetChargeRequest =  {
        "transactionId" : true,
        "transactionIdType" : true
    };

    var params_verifySignatureForProcessChargeResponse = {
        "transactionId" : true,
        "signature" : false,
        "payUrl" : false
    };

    var params_verifySignatureForChargeStatus = {
        "transactionStatusCode" : true,
        "transactionStatusDescription" : true,
        "transactionId" : false,
        "merchantTransactionId" : false,
        "signature" : false,
        "transactionValue" : false,
        "transactionCurrencyCode" : false,
        "merchantCustomData" : false,
        "transactionDate" : false
    };

    var params_fetchTransactionDetails = {
        "transactionId" : true,
        "transactionIdType" : true 
    }

    var params_refund = {
        "amazon_transaction_id": true,
        "amazon_transaction_type": true,
        "refund_reference_id": true,
        "refund_amount": true,
        "currency_code": true,
        "merchant_id": false,
        "seller_refund_note": false,
        "soft_descriptor": false,
    }

    var params_refundDetails = {
        "amazon_refund_id" : true,
        "merchant_id" : false,
    }

    var params_listOrderReference = {
        "queryId": true,
        "merchant_id": false,
        "startTime": false,
        "endTime": false
    }

    var serviceUrl = 'amazonpay.amazon.in';
    var urlScheme = 'POST';
    var path = '/';
    var userAgent = null;
    var HTTP_POST = 'POST'
    var validateNotNull = function(value, message) {
        if (!(typeof value !== 'undefined' && value)) {
            throw (message + ' cannot be null.');
        }
    };

    var checkConfigKeys = function(configParams) {
        for (var prop in configParams) {
            if (prop in config) {
                config[prop] = configParams[prop];
            } else {
                throw ('Key ' + prop + ' is either not part of the configuration or has incorrect Key name. check the config array key names to match your key names of your config array.');
            }
        }
    }

    var canWrite = function(path, callback) {
        fs.access(path, fs.W_OK, function(err) {
            callback(null, !err);
        });
    }

    // Constructor
    if (Object.keys(params).length > 0) {
        checkConfigKeys(params);
        canWrite(__dirname + "/PayWithAmazon/config.ini", function(err, isWritable) {
            if (!isWritable) throw ("config.ini is not writable")
        });

    } else {
        throw ('paramsArray cannot be null.');
    }

    var getField = function(fieldName, parameters) {
        if (fieldName in parameters) {
            return parameters[fieldName];
        } else {
            return null;
        }
    }

    var getMandatoryField = function(fieldName, parameters) {
        var value = getField(fieldName, parameters);
        if (validateNotNull(value, fieldName)) {
            throw ("Error with json message - mandatory field " + fieldName + " cannot be found or is empty");
        }
        return value;
    }


    var checkForRequiredParameters = function(parameters, fields) {

        for (var key in fields) {
            if (fields[key]) {
                var value = getMandatoryField(key, parameters);
            } else {
                var value = getField(key, parameters);
            }
        }

        for (var key in parameters) {
            if (!fields.hasOwnProperty(key)) {
                throw ("Error with json message - provided field " + key + " should not be part of input");
            }
        }
    }

    var addParametersForEncryption = function(parameters) {
        parameters['sellerId'] = config['merchant_id'];
        // parameters['isSandbox'] = true;
        parameters['startTime'] = Math.floor(new Date().getTime() / 1000);
        // parameters['startTime'] = 1491902069;
        return parameters;
    }

    var stripslashes = function(str) {
        return str.replace(/\\(.)/mg, "$1");
    }
    var utf8_encode = function(argString) {
        if (argString === null || typeof argString === 'undefined') {
            return '';
        }

        var string = (argString + ''); // .replace(/\r\n/g, "\n").replace(/\r/g, "\n");
        var utftext = '',
            start, end, stringl = 0;

        start = end = 0;
        stringl = string.length;
        for (var n = 0; n < stringl; n++) {
            var c1 = string.charCodeAt(n);
            var enc = null;

            if (c1 < 128) {
                end++;
            } else if (c1 > 127 && c1 < 2048) {
                enc = String.fromCharCode(
                    (c1 >> 6) | 192, (c1 & 63) | 128
                );
            } else if ((c1 & 0xF800) != 0xD800) {
                enc = String.fromCharCode(
                    (c1 >> 12) | 224, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
                );
            } else { // surrogate pairs
                if ((c1 & 0xFC00) != 0xD800) {
                    throw new RangeError('Unmatched trail surrogate at ' + n);
                }
                var c2 = string.charCodeAt(++n);
                if ((c2 & 0xFC00) != 0xDC00) {
                    throw new RangeError('Unmatched lead surrogate at ' + (n - 1));
                }
                c1 = ((c1 & 0x3FF) << 10) + (c2 & 0x3FF) + 0x10000;
                enc = String.fromCharCode(
                    (c1 >> 18) | 240, ((c1 >> 12) & 63) | 128, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
                );
            }
            if (enc !== null) {
                if (end > start) {
                    utftext += string.slice(start, end);
                }
                utftext += enc;
                start = end = n + 1;
            }
        }

        if (end > start) {
            utftext += string.slice(start, stringl);
        }

        return utftext;
    }


    var urlEncode = function(value, path) {
        encodedString = stripslashes(encodeURIComponent(utf8_encode(value)));
        if (path) { // no variable found as input encoded, Also we are always using path = false as input
            encodedString = str_replace('%2F', '/', encoded);
        }
        return encodedString;
    }

    var urlEncodeParams = function(parameters) {
        for (var key in parameters) {
            if(key=='sellerNote' || key=='sellerStoreName')
            {
                parameters[key]=parameters[key].replace('%2F', '/');
                
            }
            parameters[key] = urlEncode(parameters[key], false);
        }
        return parameters;
    }

    var addDefaultParameters = function(parameters) {
        parameters['AWSAccessKeyId'] = config['access_key'];
        parameters['SignatureMethod'] = 'HmacSHA256';
        parameters['SignatureVersion'] = 2;
        return parameters;
    }

    var getParametersAsString = function(parameters) {
        var queryParameters = [];
        for (key in parameters) {
            queryParameters.push(urlEncode(key, false) + '=' + parameters[key]);
        }
        return queryParameters.join('&');
    }

    var calculateStringToSignV2 = function(parameters) {
        data = HTTP_POST;
        data += "\n";
        data += serviceUrl;
        data += "\n";
        data += path;
        data += "\n";
        data += getParametersAsString(parameters);
        return data;
    }

    var getSign = function(data, secretKey) {
        return crypto.createHmac('SHA256', secretKey).update(data).digest('base64');
    }



    function orderKeys(obj, expected) {

        var keys = Object.keys(obj).sort(function keyOrder(k1, k2) {

            if (k1 < k2) return -1;
            else if (k1 > k2) return +1;
            else return 0;
        });

        var i, after = {};
        for (i = 0; i < keys.length; i++) {
            after[keys[i]] = obj[keys[i]];
            delete obj[keys[i]];
        }

        for (i = 0; i < keys.length; i++) {
            obj[keys[i]] = after[keys[i]];
        }
        return obj;
    }



    var signParameters = function(parameters) {
        parameters = urlEncodeParams(parameters);
        parameters = addDefaultParameters(parameters);
        var seq_parameters = orderKeys(parameters);
        var stringToSign = calculateStringToSignV2(seq_parameters);
        var sign = getSign(stringToSign, config['secret_key']);
        parameters['Signature'] = sign;
        return parameters;
    }

    var calculateSignForEncryption = function(parameters) {
        validateNotNull(parameters, "parameters");
        parameters = addParametersForEncryption(parameters);
        serviceUrl = 'amazonpay.amazon.in';
        urlScheme = 'POST';
        path = '/';
        signParameters(parameters);
        return parameters;
    }


    var getParametersToEncrypted = function(parameters) {
        parameters = urlEncodeParams(parameters);
        delete parameters['SignatureMethod'];
        delete parameters['SignatureVersion'];
        return parameters;
    }

    var getSecureRandomKey = function(value) {
        return crypto.randomBytes(value);
    }

    var getPublicKey = function() {

        if (fs.existsSync(__dirname + "/PayWithAmazon/config.ini")) {
            var iniData = ini.parse(fs.readFileSync(__dirname + "/PayWithAmazon/config.ini", 'utf-8'))
            var key = iniData.publicKey;
            var publicKey = "-----BEGIN PUBLIC KEY-----\n" + wrap(key, { width: 64, newline: '\r\n', cut: true }) + "\n-----END PUBLIC KEY-----";
            return publicKey;
        } else {
            throw Error("Config file does not exist");
        }
        throw Error("The key has not been generated.");
    }

    var openssl_public_encrypt = function(toEncrypt, relativeOrAbsolutePathToPublicKey) {
        var publicKey = relativeOrAbsolutePathToPublicKey;
        var encrypted = crypto.publicEncrypt(publicKey, toEncrypt);
        return encrypted.toString('base64');
    };

    var assert = function(condition, message) {
        if (!condition)
            throw Error("Assert failed:" + (typeof message !== "undefined" ? ": " + message : ""));
    };

    var is_string = function(check) {
        return (typeof check === 'string' || check instanceof String);
    }

    var is_integer = function(value) {
        return (typeof value === 'number' && (value % 1) === 0);
    }

    var encryptWithPHP71 = function(K, key_length, IV, P, A, tag_length) {
        tag_length = (tag_length) ? tag_length : 128;
        var mode = 'aes-' + 128 + '-gcm';
        var cipher = crypto.createCipheriv(mode, K, IV);
        cipher.setAutoPadding(false);
        var encrypted = cipher.update(P, 'utf8', 'binary');
        encrypted += cipher.final('binary');
        encrypted += cipher.getAuthTag().toString('binary');
        var buffer = new Buffer(encrypted, 'binary');
        var encodedString = buffer.toString('base64');
        return encodedString;
    }



    var encrypt = function(K, IV, P, A, tag_length) {

        tag_length = (tag_length) ? tag_length : 128;

        // assert(is_string(K), 'The key encryption key must be a binary string.');


        key_length = K.length * 8;

        // assert(is_string(IV), 'The Initialization Vector must be a binary string.');

        assert(is_string(P), 'The data to encrypt must be null or a binary string.');

        assert(is_string(A), 'The Additional Authentication Data must be null or a binary string.');

        assert(is_integer(tag_length), 'Invalid tag length. Supported values are: 128, 120, 112, 104 and 96.');

        assert(([128, 120, 112, 104, 96].indexOf(tag_length) >= 0), 'Invalid tag length. Supported values are: 128, 120, 112, 104 and 96.');

        return encryptWithPHP71(K, key_length, IV, P, A, tag_length);

    }


    var encryptAndAppendTag = function(K, IV, P, A, tag_length) {
        tag_length = (tag_length) ? tag_length : 128;
        return encrypt(K, IV, P, A, tag_length);
    }

    this.generateSignatureAndEncrypt = function(parameters) {

        try{
            if (!parameters['operationName']) {
                checkForRequiredParameters (parameters, params_SignAndEncrypt);
                var operation = 'SIGN_AND_ENCRYPT';
            } else if (parameters['operationName'] == 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST') {
                var operation = parameters['operationName'];
                delete parameters['operationName']
                checkForRequiredParameters (parameters,params_SignAndEncryptGetChargeRequest);
            } 
            else {
               throw (operation + ' is not a valid operation for sign and encrypt.');
            }

            var encryptedResponse = {};
            var parameters1 = calculateSignForEncryption(parameters);
            var parametersToEncrypt = getParametersToEncrypted(parameters1);
            var dataToEncrpyt = getParametersAsString(parametersToEncrypt);
            var sessionKey = getSecureRandomKey(16);
            var pubKey = getPublicKey();
            var encryptedSessionKey = openssl_public_encrypt(sessionKey, pubKey);
            var iv = getSecureRandomKey(12);
            
            var encyptedData = encryptAndAppendTag(sessionKey, iv, dataToEncrpyt, '');
            encryptedResponse['payload'] = urlEncode(encyptedData);
            encryptedResponse['key'] = urlEncode(encryptedSessionKey);
            encryptedResponse['iv'] = urlEncode(iv.toString("base64"));
            encryptedResponseAsString = getParametersAsString(encryptedResponse);
        }
        catch (err) {
            updateCountMetrics(err)
            throw (err);
        } finally {
        }
        return encryptedResponseAsString;
    }

    var getBaseUrlDynamically = function() {
        return null;
    }

    var getBaseUrl = function getBaseUrl() {
        var baseUrl = getBaseUrlDynamically();
        if (!baseUrl) {
            baseUrl = config['base_url'];
        }
        return baseUrl;
    }

    var constructPaymentUrl = function(queryParameters, redirectUrl) {
        var baseUrl = getBaseUrl();
        var processPaymentUrl = baseUrl + '/initiatePayment?' + queryParameters + '&redirectUrl=' + urlEncode(redirectUrl);
        return processPaymentUrl;
    }

    var QueryStringToJSON = function(parameters) {
        var pairs = parameters.slice().split('&');

        var result = {};
        pairs.forEach(function(pair) {
            pair = pair.split('=');
            result[pair[0]] = decodeURIComponent(pair[1] || '');
        });

        return JSON.parse(JSON.stringify(result));
    }

    this.getProcessPaymentUrl = function(parameters, redirectUrl) {
        // parameters = QueryStringToJSON(parameters);
        validateNotNull(redirectUrl, "Redirect Url");
        validateNotNull(redirectUrl, "Invalid redirect URL. Please remember to input http:// or https:// as well. URL scheme");
        queryParameters = this.generateSignatureAndEncrypt(parameters);
        return constructPaymentUrl(queryParameters, redirectUrl);
    }



    // here we are handling response

    var calculateSignForVerification = function(parameters) {
        validateNotNull(parameters, "parameters");
        serviceUrl = 'amazonpay.amazon.in';
        urlScheme = 'POST';
        path = '/';
        return signParameters(parameters);
    }

    var updateCountMetrics = function(metrics) {
        fs.appendFile(__dirname + "/PayWithAmazon/metrics/countMetrics.txt", metrics + '\n', function(err) {
            if(err) throw (err);
            console.log("The count metric has been updated successfully.")
        });
    }

    var updateLatencyMetrics = function(totalTime, operation) {

        fs.appendFile(
            __dirname + "/PayWithAmazon/metrics/countMetrics.txt",
            operation + ' ' + 'totalTime ' + totalTime + '\n',
            function(err) {
                if (err) throw (err);
                console.log("The latency metric has been updated successfully.")
            }
        );

    }

    var getFileSize = function() {
        var size = 0;
        if (fs.existsSync(__dirname + "/PayWithAmazon/metrics/latencyMetrics.txt")) {
            var file1 = fs.statSync(__dirname + '/PayWithAmazon/metrics/latencyMetrics.txt');
            size += size + file1.size;
        }

        if (fs.existsSync(__dirname + "/PayWithAmazon/metrics/countMetrics.txt")) {
            file2 = fs.statSync(__dirname + '/PayWithAmazon/metrics/countMetrics.txt');
            size += size + file2.size;
        }
        return size;
    }

    var parseLatencyFile = function() {
        var pattern = '/(?<operation>\w+)\s+(?<key>\w+)\s+(?<time>\d+(\.\d{1,6})?)/i';
        // if(fs.existsSync( __dirname + '/PayWithAmazon/metrics/latencyMetrics.txt')){
        //   $lines = file( __dirname + '/PayWithAmazon/metrics/latencyMetrics.txt');
        //   $title = 'data';
        //   $json_data=array();
        //   foreach ($lines as $line_num => $line) {
        //     preg_match($pattern,$line,$result);
        //     $json_data[]=preg_grep_keys('/operation|key|time/',$result);
        //   }

        //   return json_encode($json_data);
        // }
        // else{
        //   return null;
        // }
    }

    var postMetrics = function() {
        // $config = parse_ini_file(dirname(__DIR__). "/PayWithAmazon/config.ini");
        var iniData = ini.parse(fs.readFileSync(__dirname + "/PayWithAmazon/config.ini", 'utf-8'));
        var metricsSize = getFileSize();
        if ((iniData['lastFetchedTimeForPostingMetrics'] < (Math.floor(new Date().getTime() / 1000) - 300)) || (metricsSize) > 500000) {
            var data = [];
            data['latency'] = parseLatencyFile();


        }
    }

    this.verifySignature = function(paymentResponseMap) {
        try {
            validateNotNull(paymentResponseMap, "paymentResponseMap");

            if(paymentResponseMap['verificationOperationName'] == 'VERIFY_PROCESS_CHARGE_RESPONSE') {
                delete paymentResponseMap['verificationOperationName']
                checkForRequiredParameters (paymentResponseMap,params_verifySignatureForProcessChargeResponse);           
            } else if (paymentResponseMap['verificationOperationName'] == 'VERIFY_CHARGE_STATUS') {
                delete paymentResponseMap['verificationOperationName']
                checkForRequiredParameters (paymentResponseMap, params_verifySignatureForChargeStatus);            
            } else {
                checkForRequiredParameters(paymentResponseMap, params_verifySignature);
            }   

            providedSignature = paymentResponseMap['signature'];
            delete paymentResponseMap['signature']
            validateNotNull(providedSignature, "ProvidedSignature");
            calculatedSignature = calculateSignForVerification(paymentResponseMap);
        } catch (err) {
            updateCountMetrics(err)
            throw (err);
        } finally {
            // updateLatencyMetrics ( totalTime, 'VERIFY_SIGNATURE' );
            // postMetrics();
            // $this->execInBackground ( "php recordPublisher.php" );
            // $this->execInBackground ( "php dynamicConfig.php" );

        }
        return (calculatedSignature['Signature'] == providedSignature);

    }

    // refund feature started here 
    var keysToLowerCase = function(obj) {
        var keys = Object.keys(obj);
        var n = keys.length;
        while (n--) {
            var key = keys[n]; // "cache" it, for less lookups to the array
            if (key !== key.toLowerCase()) { // might already be in its lower case version
                obj[key.toLowerCase()] = obj[key] // swap the value to a new lower case key
                delete obj[key] // delete the old key
            }
        }
        return (obj);
    }

    var setDefaultValues = function(parameters, fieldMappings, requestParameters) {
        if (!requestParameters['merchant_id']) {
            parameters['SellerId'] = config['merchant_id'];
        }

        if (fieldMappings['platform_id']) {
            if (!requestParameters['platform_id'] && config['platform_id'])
                parameters[fieldMappings['platform_id']] = config['platform_id'];
        }

        // if (fieldMappings['currency_code']) {
        //   if (!requestParameters['currency_code']) {
        //     parameters[fieldMappings['currency_code']] = requestParameters['currency_code'].toUppercase();
        //   } else {
        //     parameters[fieldMappings['currency_code']] = config['currency_code'].toUppercase();
        //   }
        // }
        // console.log(parameters);
        return parameters;
    }
    var getFormattedTimestamp = function() {
        return new Date().toISOString();
    }

    var createServiceUrl = function(action) {
        serviceUrl = 'amazonpay.amazon.in';
        kdsServiceUrl = 'https://' + serviceUrl + '/v2/payments/' + action;
        path = '/';
        urlScheme = 'GET';

    }

    var calculateSignatureAndParametersToString = function(parameters) {
        parameters['Timestamp'] = getFormattedTimestamp();
        createServiceUrl(parameters['Action']);
        delete parameters['Action'];
        parameters = signParameters(parameters);
        parameters['Signature'] = urlEncode(parameters['Signature']);
        parameters['isSandbox'] = config['sandbox'];
        parameters = getParametersAsString(parameters);
        return parameters;
    }


    var invokeGet = function(parameters, endpoint, callBack) {
        try {
            var httpCurlRequest = new HttpCurl(config);
            httpCurlRequest.setHttpHeader()
            httpCurlRequest.httpGet(endpoint + '?' + parameters, userAgent, function(err, response, body) {
                parseString(response.body,{trim: true,ignoreAttrs: true, mergeAttrs:true, explicitChildren: true, explicitArray: false}, function(parserr, result) {
                    result['statusCode'] = response.statusCode;
                    result = (result) ? result : false;
                    callBack(result);
                })
            });
        } catch (e) {
            throw (e);
        }
    }

    var invokeGetDetails = function(parameters, endpoint, callBack) {
        try {
            var httpCurlRequest = new HttpCurl(config);
            httpCurlRequest.httpGet(endpoint + '?' + parameters, userAgent, function(err, response, body) {
                    var result = JSON.parse(response.body);
                    result['statusCode'] = response.statusCode;
                    result = (result) ? result : false;
                    callBack(result);
            });
        } catch (e) {
            throw (e);
        }
    }

    var calculateSignatureAndPost = function(parameters, callBack) {
        // Call the signature and Post function to perform the actions. Returns XML in array format
        parametersString = calculateSignatureAndParametersToString(parameters);
        response = invokeGet(parametersString, kdsServiceUrl, callBack);
    }


    var setParametersAndPost = function(parameters, fieldMappings, requestParameters, callBack) {
        /* For loop to take all the non empty parameters in the $requestParameters and add it into the $parameters array,
         * if the keys are matched from $requestParameters array with the $fieldMappings array
         */
        for (key in requestParameters) {
            if (!Array.isArray(requestParameters[key])) {
                var value = requestParameters[key].trim();
            }

            if (fieldMappings[key]) {
                value = requestParameters[key];
            }
            parameters[fieldMappings[key]] = value;
        }
        parameters = setDefaultValues(parameters, fieldMappings, requestParameters);
        responseObject = calculateSignatureAndPost(parameters, callBack);
    }

    this.RefundInit = function(requestParameters, callBack) {
        try {
            parameters = {};
            parameters['Action'] = 'refund';
            requestParameters = keysToLowerCase(requestParameters);
            checkForRequiredParameters(requestParameters, params_refund)
            var fieldMappings = {
                'merchant_id': 'SellerId',
                'amazon_transaction_id': 'AmazonTransactionId',
                'amazon_transaction_type': 'AmazonTransactionIdType',
                'refund_reference_id': 'RefundReferenceId',
                'refund_amount': 'RefundAmount.Amount',
                'currency_code': 'RefundAmount.CurrencyCode',
                'seller_refund_note': 'SellerRefundNote',
                'soft_descriptor': 'SoftDescriptor',
                'content_type': 'ContentType'
            }
            responseObject = setParametersAndPost(parameters, fieldMappings, requestParameters, callBack);
        } catch (e) {
            throw (e);
        }

    }

    this.getRefundDetails = function(requestParameters, callBack) {
        try {
            checkForRequiredParameters(requestParameters, params_refundDetails)
            parameters = {};
            parameters['Action'] = 'refund/details';
            requestParameters = keysToLowerCase(requestParameters);
            fieldMappings = {
                'merchant_id': 'SellerId',
                'amazon_refund_id': 'AmazonRefundId'
            };
            responseObject = setParametersAndPost(parameters, fieldMappings, requestParameters, callBack);
        } catch (e) {
            throw (e);
        }
    }

    this.fetchTransactionDetails = function(requestParameters, callBack) {
        try {
            checkForRequiredParameters (requestParameters, params_fetchTransactionDetails);
            if (requestParameters['transactionIdType']!='TRANSACTION_ID') {
                throw ("Transaction Type is not supported.");
            }
            requestParameters['operationName'] = 'SIGN_AND_ENCRYPT_GET_CHARGE_STATUS_REQUEST';
            var getChargeStatusRequest = this.generateSignatureAndEncrypt(requestParameters);
            var serviceUrl = 'https://amazonpay.amazon.in/v2/payments/chargeStatus';
            responseObject = invokeGetDetails(getChargeStatusRequest, serviceUrl, callBack);
        } catch (e) {
            throw (e);
        }
    }

this.listOrderReference = function(requestParameters, callBack) {
    try {
        checkForRequiredParameters(requestParameters,params_listOrderReference)
        parameters = {};
        parameters['Action'] = 'orderReference';
        parameters['QueryIdType'] = 'SellerOrderId';
        parameters['QueryId'] = requestParameters['queryId'];
        parameters['PaymentDomain'] = 'IN_INR';
        if(requestParameters['startTime']!=null)
            parameters['CreatedTimeRange.StartTime'] = requestParameters['startTime'];
        if(requestParameters['endTime']!=null)
            parameters['CreatedTimeRange.EndTime'] = requestParameters['endTime'];
        requestParameters = keysToLowerCase(requestParameters);
        var fieldMappings = {
            'merchant_id': 'SellerId'
        }
        responseObject = setParametersAndPost(parameters, fieldMappings, requestParameters, callBack);
    } catch (e) {
        throw (e);
    }

}
}
module.exports = PWAINBackendSDK;
