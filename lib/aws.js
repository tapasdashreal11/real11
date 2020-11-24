'use strict'
var logger = require('../utils/logger')(module);
var Promise = require('bluebird');
const AWS = require('aws-sdk');

const config = {
    accessKey: process.env.S3_ACCESS_KEY,
    secretKey: process.env.S3_SECRET_KEY,
    bucket: process.env.S3_BUCKET,
    region: process.env.S3_REGION,
};

const s3 = new AWS.S3({
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
    region: config.region,
});

module.exports.deleteFile = function (key) {
  return new Promise(function (resolve, reject) {
      var bucketInstance = new AWS.S3();
      var params = {
          Bucket:  config.bucket,
          Key: key,
      };
      bucketInstance.deleteObject(params, function (err, data) {
          if (err) {
              logger.error(`Error deleting image. Error: ${err}`);
              reject(`unable to delele image from Amazon S3 ${err}`);
          } else {
              resolve(key);
          }
      });
  });
}
