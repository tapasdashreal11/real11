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

/** This function for upload on s3 bucket */
async function createTeamOnS3(key, team) {

    return new Promise((resolve, reject) => {
        const params = {
            Key: key,
            Body: JSON.stringify(team),
            Bucket: process.env.S3_BUCKET_TEAM
        };

        s3.putObject(params, function (err, data) {
            if (err) {
                // reject(err.message)
                resolve(false);
            } else {
                // resolve(data);
                if (data && data.ETag) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });

}

const multipleUserTeamS3Bucket = async (prefix, match_id, user_id, sport) => {
    let allJoinedTeamTeams = [];
    let params = { Bucket: process.env.S3_BUCKET_TEAM };
    if (prefix) params.Prefix = prefix;
    try {
        const response = await s3.listObjects(params).promise();
        await Promise.all(response.Contents.map(async (item) => {
            const joinedTeam = await singleUserTeamS3Bucket(item.Key, match_id, user_id, sport)
            if (typeof joinedTeam === 'object' && joinedTeam !== null) {
                allJoinedTeamTeams.push(joinedTeam);
            }
        }));
        return allJoinedTeamTeams;
    } catch (error) {
        console.log("err0r");
        throw error;
    }
}

const singleUserTeamS3Bucket = async (key, match_id, user_id, sport) => {
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

/** This function for upload join contest details on s3 bucket */
async function saveDataOnS3(key, saveData) {
    return new Promise((resolve, reject) => {
        const params = {
            Key: key,
            Body: JSON.stringify(saveData),
            Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS
        };

        s3.putObject(params, function (err, data) {
            if (err) {
                // reject(err.message)
                resolve(false);
            } else {
                // resolve(data);
                if (data && data.ETag) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            }
        });
    });
}

/** This function for delete join contest details on s3 bucket */
async function deleteDataOnS3(key) {
    return new Promise((resolve, reject) => {
        const params = {
            Key: key,
            Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS
        };

        s3.deleteObject(params, function (err, data) {
            if (err) {
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

/** This function for upload PTC data on s3 bucket */
async function savePTCDataArrOnS3(saveData, callType) {
    return await new Promise((resolve, reject) => {
        let keyArr = [];
        let keyArrRedis = [];
        for(const sData of saveData) {
            var s3key = process.env.S3_FOLDER_PLAYER_TEAM_CONTEST+"/"+sData.match_id+"_"+sData.sport+"/"+sData.contest_id+"_"+sData.user_id+"_"+sData._id+".json";
            if(callType == "H2H") {
                s3key = process.env.S3_FOLDER_PLAYER_TEAM_CONTEST+"/"+sData.match_id+"_"+sData.sport+"/"+sData.parent_contest_id+"_"+sData.contest_id+"_"+sData.user_id+"_"+sData._id+".json";
            }
            keyArr.push(s3key);
            let redisKey = `${redisKeys.PLAYER_TEAM_CONTEST}${sData.match_id}-${sData.sport}-${sData.contest_id}-${sData.user_id}`;
            keyArrRedis.push(redisKey);
            const params = {
                Key: s3key,
                Body: JSON.stringify(sData),
                Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS
            };

            s3.putObject(params, function (err, data) {
                if (err) {
                    deletePTCDataOnS3(keyArr, keyArrRedis);
                    // reject(err.message)
                    resolve(false);
                } else {
                    if (data && data.ETag) {
                        // resolve(true);
                        redisEnt.setRedis(`${redisKeys.PLAYER_TEAM_CONTEST}${sData.match_id}-${sData.sport}-${sData.contest_id}-${sData.user_id}`, sData._id.toString(), sData);
                    } else {
                        deletePTCDataOnS3(keyArr, keyArrRedis);
                    }
                }
            });
        }
        resolve(saveData);
        
    });
}

/** This function for delete PTC data on s3 bucket */
async function deletePTCDataOnS3(keyArrS3, keyArrRedis) {
    return new Promise((resolve, reject) => {
        for(const key of keyArrS3) {
            const params = {
                Key: key,
                Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS
            };
            s3.deleteObject(params, function (err, data) {
                if (err) {
                    resolve(false);
                } else {
                    // resolve(true);
                }
            });

        }
        for(const key of keyArrRedis) {
            redisEnt.redisObj.del(key);

        }
        resolve(true);
    });
}

/** This function for count PTC data on s3 bucket */
async function getPTCCountS3(prefix) {
    return new Promise((resolve, reject) => {
        let params = { Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS };
        if (prefix) params.Prefix = prefix;
        
        s3.listObjectsV2(params, function (err, data) {
            if (err) {
                resolve(0);
            } else {
                resolve(data['KeyCount']);
            }
        });
    });
}

const multipleDataS3Bucket = async (prefix) => {
    let allJoinedPTC = [];
    let params = { Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS };
    if (prefix) params.Prefix = prefix;
    try {
        const response = await s3.listObjects(params).promise();
        await Promise.all(response.Contents.map(async (item) => {
            const joinedPtc = await singleDataS3Bucket(item.Key)
            if (typeof joinedPtc === 'object' && joinedPtc !== null) {
                allJoinedPTC.push(joinedPtc);
            }
        }));
        return allJoinedPTC;
    } catch (error) {
        console.log("err0r");
        throw error;
    }
}

const singleDataS3Bucket = async (key) => {
    return await new Promise((resolve, reject) => {

        const params = {
            Key: key,
            Bucket: process.env.S3_BUCKET_JOINED_CONTEST_DETAILS
        };

        s3.getObject(params, function (err, data) {
            if (err) {
                // reject(err)
                resolve(false);
            } else {
                let finalData = JSON.parse(data.Body.toString());
                resolve(finalData);
            }
        });

    });
}

module.exports = {
    createTeamOnS3,
    multipleUserTeamS3Bucket,
    singleUserTeamS3Bucket,
    saveDataOnS3,
    deleteDataOnS3,
    savePTCDataArrOnS3, // Use for upload an array on s3
    getPTCCountS3,
    multipleDataS3Bucket,
};