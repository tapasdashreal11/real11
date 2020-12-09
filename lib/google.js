const maps = require('@google/maps');
const db = require('mongoose').connection;
const config = require('../server/config');

// initialize client
const mapsClient = maps.createClient({
  key: config.google.key
});

// export the Google Maps Client
module.exports.client = mapsClient;

// export promisified versions of all the client methods
Object.keys(mapsClient).forEach((prop) => {
  module.exports[prop] = (params) => new Promise((resolve, reject) => {
    mapsClient[prop](params, (err, response) => {
      if(err) {
        reject(err);
      } else {
        resolve(response.json.results);
      }

      process.nextTick(() => {
        db.collection('google_maps_logs').insertOne({
          method: prop,
          time: new Date,
          params,
          error: err,
          response
        });
      })
    })
  });
});

// export backwards "compatible" methods
module.exports.getDistanceMatrix = module.exports.distanceMatrix;
module.exports.getGeocode = module.exports.geocode;
