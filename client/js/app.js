const isMobile = ( /android|webos|iphone|ipod|blackBerry|iemobile|opera Mini/i.test(navigator.userAgent.toLowerCase()) );

let user_login = document.getElementById('is-logged-in') && document.getElementById('is-logged-in').value || false;
let current_url = window.location.href;
let redirect_to = localStorage.url_before_logging_in;
if(user_login && redirect_to && !current_url.includes('users') && redirect_to != current_url){
    localStorage.url_before_logging_in = '';
    window.location.href = redirect_to;
}

jQuery(document).ready(function ($) {

    $('.flat-slider').bootstrapSlider({
        min: 0,
        max: 100,
        tooltip: 'hide',
        formatter: function (value) {
            return;
        }
    });

    $('.range-slider').bootstrapSlider({
        min: 0,
        max: 100,
        range: true,
        values: [40, 60]
    });
    // manage all ajax requests
    $.xhrPool = []; 
    $.ajaxSetup({
        beforeSend: function(jqXHR) {
            $.xhrPool.push(jqXHR);
        },
        complete: function(jqXHR) {
            var index = $.xhrPool.indexOf(jqXHR);
            if (index > -1) {
                $.xhrPool.splice(index, 1);
            }
        }
    });
    $.xhrPool.abortAll = function() {
        $(this).each(function(idx, jqXHR) { 
            jqXHR.abort();
        });
        $.xhrPool.length = 0
    };
    //Navigation Handlers
    $('.logout-btn').click(function(e) {
        e.preventDefault();
        $.xhrPool.abortAll();
        $.post('/users/logout', function() {
            //Reload page to update view
            document.location.replace('/users/login');
        });
    });
});

function attach(path) {
    return new Promise(function (cb) {
        var el = document.createElement('script');
        el.onload = el.onerror = cb;
        el.src = path;
        document.getElementsByTagName("head")[0].appendChild(el);
    });
};

var numberFormat = function(num, f=2) {
    num = Number(num);
    let _number =  Number.parseFloat(num);
    if(isNaN(_number)) _number = 0;
    return _number.toFixed(f);
}

/*
Generate a random hex id
*/
function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}