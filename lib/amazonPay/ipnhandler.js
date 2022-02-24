var crypto 		= require('crypto');
var request 	= require('request');
var URL 			= require('url');
var xml2js 		= require('xml2js')

function IpnHandler(response, callback) {
    var defaultHostPattern = /^sns\.[a-zA-Z0-9\-]{3,}\.amazonaws\.com(\.cn)?$/;

    var required = [
        'Message',
        'MessageId',
        'SignatureVersion',
        'Signature',
        'SigningCertURL',
        'Timestamp',
        'TopicArn',
        'Type'
    ];

    var signable = [
        'Message',
        'MessageId',
        'Subject',
        'SubscribeURL',
        'Timestamp',
        'Token',
        'TopicArn',
        'Type',
    ];

    for (var i = 0; i < required.length; i++) {
        if (!response.hasOwnProperty(required[i])) {
            return callback(new Error('Missing parameter on SNS response: ' + required[i]));
        }
    }

    if (response.SignatureVersion != 1) {
        return callback(new Error('Unknown SNS Signature version: ' + response.SignatureVersion));
    }

    var verifier = crypto.createVerify('SHA1');

    signable.forEach(function(key) {
        if (response.hasOwnProperty(key)) {
            verifier.update(key + '\n' + response[key] + '\n');
        }
    });

    var parsed = URL.parse(response.SigningCertURL);
    if (parsed.protocol !== 'https:' || parsed.path.substr(-4) !== '.pem' || !defaultHostPattern.test(parsed.host)) {
        return callback (new Error('The certificate is located on an invalid domain.'));
    }

    request(response.SigningCertURL, function(err, res, cert) {
        if (err) {
            return callback(err);
        }

        var isValid = verifier.verify(cert, response.Signature, 'base64');

        if (!isValid) {
            return callback (new Error('Signature mismatch, unverified response'));
        }

        if (response.Type != 'Notification') {
            return callback(null, response);
        }

        parseIPNMessage(response.Message, function(err, message) {
            if (err) {
                return callback(err);
            }

            callback(null, message);
        });
    });
}

function parseIPNMessage(message, callback) {
    message = safeJSONParse(message);
    if (!isObject(message) || !message.NotificationData) {
        return callback(null, message);
    }

    var type = message.NotificationType;

    var xmlKeys = {
        PaymentRefund: ['RefundNotification', 'RefundDetails'],
        PaymentCapture: ['CaptureNotification', 'CaptureDetails'],
        PaymentAuthorize: ['AuthorizationNotification', 'AuthorizationDetails'],
        OrderReferenceNotification: ['OrderReferenceNotification', 'OrderReference'],
        BillingAgreementNotification: ['BillingAgreementNotification', 'BillingAgreement']
    };

    xml2js.parseString(message.NotificationData, { explicitArray: false }, function(err, result) {
        if (err) {
            return callback(err);
        }

        var keys = xmlKeys[type] || [];
        message.NotificationData = new Response(type, result, keys[0], keys[1]);
        callback(null, message);
    });
}

function Response(method, rawResponse, primaryKey, subKey) {
    primaryKey = primaryKey || method + 'Response';
    subKey = subKey || method + 'Result';
    if (!rawResponse.hasOwnProperty(primaryKey)) {
        return rawResponse;
    }

    var _response = rawResponse[primaryKey];
    var _result = _response[subKey];

    if (_response.ResponseMetadata) {
        Object.defineProperty(this, 'requestId', {
            enumerable: false,
            get: function() {
                return _response.ResponseMetadata.RequestId;
            }
        });
    }

    return _result;
}

function safeJSONParse(data) {
    var parsed;
    try {
        parsed = JSON.parse(data);
    } catch (e) {
        parsed = data;
    }
    return parsed;
}

function isObject(obj) {
    return Object.prototype.toString.call(obj) === '[object Object]';
}

function safeObjectCast(obj) {
    if (!isObject(obj)) {
        return {};
    }
    return obj;
}
module.exports = IpnHandler;
