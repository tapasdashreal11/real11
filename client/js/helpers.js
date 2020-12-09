(function($) {
    'use strict';
    //Validate that required dependencies are available to load helpers
    //functions 
    if (window.$ && window.localforage && window.Promise) {

        $.extend({
            /**
            * Promised based Ajax request
            * @param{Object} requestParams - Request parameters for request 
            */
            promisedAjax: function(requestParams) {
                return new Promise(function(resolve, reject) {
                    if (!requestParams.url) {
                        reject(new Error('Missing data or url parameters for request.'))
                    } else {
                        $.ajax({
                            //Default request type is GET
                            type: requestParams.type || 'GET',
                            url: requestParams.url,
                            data: requestParams.data || null,
                            contentType: requestParams.contentType || 'application/x-www-form-urlencoded; charset=UTF-8',
                            dataType: requestParams.dataType,
                            success: function(response) { resolve(response); },
                            error: function(error) { reject(error); }
                        })
                    } 
                })
            },
            /**
             * Validate a image file size and format
             * @params {Object} - key: {name, size}
             */
            validateImage : function(imageData) {
                const maxFileSize = 52428800; // 50MByte in bytes
                const isValidFormat = new RegExp(/\.(jpe?g|png|gif|bmp)$/i);
                return (isValidFormat.test(imageData.name) && imageData.size < maxFileSize);
            },
            /**
             * Generate a random string with given length
             * @param{Number} strLength
             */
            generateRandomString : function(strLength) {
                const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
                let result = '';
                for (let i = strLength; i > 0; --i) result += chars[Math.round(Math.random() * (chars.length - 1))];
                return result;
            },
            /**
             * Validate string input 
             * @param{String} str
             */
            isEmpty: function(str) {
                return !str || str.trim().length == 0;
            },

            /**
             * Get user current location address details
             * @param {Object} options - Optionally pass lat and lng to get address
             */
            getCurrentLocation: function(options) {
                const settings = $.extend({}, options);
                settings.detectCurrentPosition = () => {
                    return new Promise((resolve, reject) => {
                        if (!navigator.geolocation) {
                            reject(new Error('Geolocation detection not supported or is disabled'));
                        }
                        navigator.geolocation.getCurrentPosition((position) => {
                            const coordinates = {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude
                            };
                            resolve(coordinates);
                        }, (err) => reject(err));
                    })
                };
            },
            objectKeysToCamelCase : (obj) => {
                let formattedObj = {};
                for (let key in obj) {
                    let formattedKey = $.strToCamelCase(key);
                    formattedObj[formattedKey] = obj[key];
                }
                return formattedObj;
            },
            strToCamelCase : (str) => {
                return str.replace(/['_'](.)/g, (match, chr) => chr.toUpperCase());
            }
        });
    } else {
        console.error('Unable to load helpers functions, missing some required dependecies');
    }
})(jQuery)
