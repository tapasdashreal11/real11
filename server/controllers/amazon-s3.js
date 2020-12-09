'use strict'
const AWS = require('aws-sdk');
const ObjectId = require('mongodb').ObjectId;

function init_connection(){
    AWS.config.update({
        accessKey: process.env.S3_ACCESS_KEY,
        secretKey: process.env.S3_SECRET_KEY,
        bucket: process.env.S3_BUCKET,
        region: process.env.S3_REGION,
    });
    return new AWS.S3();
}

module.exports.upload_images = async function (req, res) {
    let images = req.body.images;
    const s3 = init_connection();
    console.log(process.env.S3_ACCESS_KEY,process.env.S3_SECRET_KEY, process.env.S3_BUCKET,process.env.S3_REGION, )
    let params = {
        Bucket: process.env.S3_BUCKET,
        ACL: 'public-read',
        ContentEncoding: 'base64',
    }
    let JS_PromiseAll = [];
    images.forEach((item)=>{
        const base64_data = new Buffer(item.replace(/^data:image\/\w+;base64,/, ""), 'base64')
        const type = item.split(';')[0].split('/')[1]

        const key = (new ObjectId()).toString();
        params.Key = key;
        params.Body = base64_data;
        params.ContentType = `image/${type}`;

        let JS_promise = new Promise((resolve, reject)=>{
            s3.upload(params, (err, data) => {
                if (err) { return reject(err) }
                return resolve({url: data.Location})
            });
        })
        JS_PromiseAll.push(JS_promise);
    })

    let uploadImages = await Promise.all(JS_PromiseAll);
    uploadImages = uploadImages.map((item)=>{
        return item.url
    });
    return res.status(200).send({data:uploadImages});
}