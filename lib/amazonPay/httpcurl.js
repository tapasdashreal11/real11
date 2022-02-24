var request = require('request');

module.exports = function HttpCurl(configC) {
    var config = {};
    var header = false;
    var accessToken = null;
    var curlResponseInfo = null;


    if (Object.keys(configC).length > 0) {
        var config = configC;
    } else {
        throw ('Pass config params here');
    }



    this.setHttpHeader = function() {
        header = true;
    }

    this.setAccessToken = function(accesstoken) {
        accessToken = accesstoken;
    }



    var commonCurlParams = function(url, userAgent) {
        var option = {};
        option['url'] = url;
        if (userAgent) {
            option['useragent'] = userAgent;
        }
        return option;
    }

    var execute = function(ch, callBack) {
        request(ch, callBack)
    }

    this.httpPost = function(url, userAgent, parameters) {
        var ch = commonCurlParams(url, userAgent);
        ch['verbose'] = true;
        ch['data'] = parameters;
        ch['headers'] = false;
        execute(ch, callBack);
    }

    this.httpGet = function(url, userAgent, callBack) {
        var ch = commonCurlParams(url, userAgent);
        if (header) {
            ch['headers'] = { 'Authorization': 'bearer ' + accessToken, 'x-amz-sdk-version' : 'Node-v1.0' };
        }
        execute(ch, callBack);
    }

}
