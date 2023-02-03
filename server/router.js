'use strict'

const express = require('express');
const router = express.Router();
const config = require('./config');
const logger = require('../utils/logger')(module);
const multer = require('multer');
const path = require('path');
const amazonS3 = require('./controllers/amazon-s3');
const auth = require('../lib/auth');
const redis = require('../lib/redis');

const AWS = require('aws-sdk');
const fs = require('fs');
const ID = '';
const SECRET = '';

// test routeing 
// The name of the bucket that you have created
// const BUCKET_NAME = 'real11-images';
const BUCKET_NAME = process.env.BUCKET_NAME || 'real11-prod-images';
const FILE_PERMISSION = 'public-read'
const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY || ID,
    secretAccessKey: process.env.AWS_SECRET_KEY || SECRET
});


const verifyBankDetailsNew = require('./api/v1/users/verify-bank-new');
const verifyPanDetails = require('./api/v1/users/verify-pan');
const verifyAadhaarDetail = require('./api/v1/users/verify-aadhaar-detail');

const { imageFilter } = require("./api/v1/common/helper");
const submitAadhaarOtp = require('./api/v1/users/submit-aadhaar-otp');
const verifyAadhaarOcr = require('./api/v1/users/verify-aadhaar-ocr');
/** update player image */
const playerImageDirPath = path.resolve('server', 'public', 'images');


const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, playerImageDirPath);
    },

    filename: (req, file, cb) => {
        let fileName = (req.userId || 'img') + '-' + Date.now() + path.extname(file.originalname);
        cb(null, fileName);
    },

});

const uploadFile = (uploadFile, fileName, mimetype="image/png") => {
    try {
        // Read content from the file
        const fileContent = fs.readFileSync(uploadFile);

        // Setting up S3 upload parameters
        const params = {
            Bucket: BUCKET_NAME,
            Key: fileName, // File name you want to save as in S3
            Body: fileContent,
            ACL: FILE_PERMISSION,
            ContentType: mimetype
        };

        // Uploading files to the bucket
        s3.upload(params, function(err, data) {
            if (err) {
                console.log('err', err)
                throw err;
            }
            console.log(`File uploaded successfully. ${data.Location}`);
        });
    } catch (error) {
        console.log(error)
    }
};

const upload = multer({ storage, fileFilter: imageFilter, limits: { fileSize: config.maxPhotoUploadSize } });
/*
 * ROUTER MIDDLEWARE
 */
//All routes will be redirect to HTTPS on production
var https_port = process.env.HTTPS_PORT || '';
if (config.express.isOnProduction || https_port) {
    router.use(function(req, res, next) {
        var host = req.get('host');
        //console.log("host = " + host + ", protocol: " + req.protocol);
        if (req.get('x-forwarded-proto') != "https" && req.protocol != 'https') {
            // res.set('x-forwarded-proto', 'https');
            res.redirect('https://' + host + req.url);
        } else {
            next();
        }
    });
}

router.get('/',function(req,res){
	return res.send("Welcome")
})

router.post('/api/v1/verify-aadhaar-detail', auth.authenticate.jwtLogin, verifyAadhaarDetail);
router.post('/api/v1/submit-aadhaar-otp', auth.authenticate.jwtLogin, submitAadhaarOtp);
router.post(
    "/api/v1/verify-aadhaar-ocr",
    auth.authenticate.jwtLogin,
    [
      upload.fields([
        { name: "front_image", maxCount: 1 },
        { name: "back_image", maxCount: 1 },
      ]),
      function (req, res, next) {
        const frontFileName = req?.files?.front_image[0]?.filename;
        const frontFilePath = playerImageDirPath + "/" + frontFileName;
        const backFileName = req?.files?.back_image[0]?.filename;
        const backFilePath = playerImageDirPath + "/" + backFileName;
        uploadFile(frontFilePath, frontFileName);
        uploadFile(backFilePath, backFileName);
        const front_image = {
          value: fs.createReadStream(frontFilePath),
          options: { filename: frontFilePath, contentType: null },
        };
        const back_image = {
          value: fs.createReadStream(backFilePath),
          options: { filename: backFilePath, contentType: null },
        };
        req.body = { ...req.body, front_image, back_image };
        return next();
      },
    ],
    verifyAadhaarOcr
  );


//API ROUTES//
router.post('/api/v1/verify-pan-detail', auth.authenticate.jwtLogin, [
    upload.single('image'),
    function(req, res, next) {
        const fileName = req.file && req.file.filename;
        let filePath = playerImageDirPath + '/' + fileName;
        uploadFile(filePath, fileName);
        req.body.image = fileName || '';
        return next();
    },
], verifyPanDetails);

router.post('/api/v1/verify-bank-detail', auth.authenticate.jwtLogin, [
    upload.single('image'),
    function(req, res, next) {
        const fileName = req.file && req.file.filename;
        let filePath = playerImageDirPath + '/' + fileName;
        uploadFile(filePath, fileName);
        req.body.image = fileName || '';
        return next();
    },
], verifyBankDetailsNew);


/*
 * ERROR HANDLING
 */
router.use(function(req, res, next) {
    logger.error(`Requested URL not found. URL: ${req.url}`)
        //notify.log(req,'',`404 Requested URL not found. URL: ${req.url}`);
    res.status(404);
    res.render('404');
});

//TO DO: Create appropriate error handlers for client side errors
// - Check for error code and rennder appropriate error view
router.use(function(err, req, res, next) {
    logger.error(`500 Internal server error occured. Error stack: ${err.stack || err}`)
        //notify.log(req,'',err);
    res.render('500');
});


module.exports = router;