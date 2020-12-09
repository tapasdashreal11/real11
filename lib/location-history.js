const LocationHistory = require('../server/models/location-history');
const Promise = require('bluebird');
var logger = require('../utils/logger')(module);

module.exports.addHistory = function(req,data){
    return new Promise(function (resolve, reject) {
        if(req.session.user){
            var locationHistory = new LocationHistory();
            
            if(req.body.lat && req.body.lng){
                locationHistory.location = {
                    lat: req.body.lat,
                    lng: req.body.lng
                };
            }
            
            if(req.headers['user-agent']){
                locationHistory.userAgent = req.headers['user-agent'];
            }

            if(data.address){
                locationHistory.address = data.address;
            }
            
            locationHistory.userId = req.session.user._id;    
            locationHistory.save();
        }
        resolve([]);
    });
}
