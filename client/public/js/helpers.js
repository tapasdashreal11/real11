"use strict";!function(e){window.$&&window.localforage&&window.Promise?e.extend({promisedAjax:function(n){return new Promise(function(t,r){n.url?e.ajax({type:n.type||"GET",url:n.url,data:n.data||null,contentType:n.contentType||"application/x-www-form-urlencoded; charset=UTF-8",dataType:n.dataType,success:function(e){t(e)},error:function(e){r(e)}}):r(new Error("Missing data or url parameters for request."))})},validateImage:function(e){var n=52428800,t=new RegExp(/\.(jpe?g|png|gif|bmp)$/i);return t.test(e.name)&&e.size<n},generateRandomString:function(e){for(var n="0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",t="",r=e;r>0;--r)t+=n[Math.round(Math.random()*(n.length-1))];return t},isEmpty:function(e){return!e||0==e.trim().length},getCurrentLocation:function(n){var t=e.extend({},n);t.detectCurrentPosition=function(){return new Promise(function(e,n){navigator.geolocation||n(new Error("Geolocation detection not supported or is disabled")),navigator.geolocation.getCurrentPosition(function(n){var t={lat:n.coords.latitude,lng:n.coords.longitude};e(t)},function(e){return n(e)})})}},objectKeysToCamelCase:function(n){var t={};for(var r in n){var o=e.strToCamelCase(r);t[o]=n[r]}return t},strToCamelCase:function(e){return e.replace(/['_'](.)/g,function(e,n){return n.toUpperCase()})}}):console.error("Unable to load helpers functions, missing some required dependecies")}(jQuery);
//# sourceMappingURL=helpers.js.map
