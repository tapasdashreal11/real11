// Public modules
// const moment = require('moment');
var _ = require('lodash');
const AWS = require('aws-sdk');
const redisKeys = require('../../../constants/redis-keys');
const redisEnt = require('../../../../lib/redisEnterprise');

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY,
  secretAccessKey: process.env.AWS_SECRET_KEY,
  Bucket: process.env.S3_BUCKET_TEAM
});

const multipleUserTeamS3Bucket = async (prefix, match_id,user_id,sport) =>{
  let allJoinedTeamTeams = [];
  let params = { Bucket: process.env.S3_BUCKET_TEAM };
  if (prefix) params.Prefix = prefix;
  try {
      const response = await s3.listObjects(params).promise();
      await Promise.all(response.Contents.map(async (item) => {
          const joinedTeam = await singleUserTeamS3Bucket(item.Key, match_id,user_id,sport)
          if(typeof joinedTeam === 'object' && joinedTeam !== null) {
              allJoinedTeamTeams.push(joinedTeam);
          }
      }));
      return allJoinedTeamTeams;
  } catch (error) {
      console.log("err0r");
      throw error;
  }
}

const singleUserTeamS3Bucket = async (key, match_id,user_id,sport) =>{ 
  return await new Promise((resolve, reject) => {

      const params = {
          Key: key,
          Bucket: process.env.S3_BUCKET_TEAM
      };
      
      s3.getObject(params, function (err, data) {
          if (err) {
              // reject(err)
              resolve(false);
          } else {
              let finalData = JSON.parse(data.Body.toString());
              redisEnt.setRedis(`${redisKeys.USER_CREATED_TEAMS}${match_id}-${sport}-${user_id}`, finalData._id, finalData);
              resolve(finalData);
          }
      });
      
  });
}

module.exports = {
  multipleUserTeamS3Bucket,
  singleUserTeamS3Bucket
};