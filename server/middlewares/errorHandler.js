// public modules
const Sentry = require('@sentry/node');
const multer = require('multer');
Sentry.init({ dsn: 'https://efae02966d9d413ea3872092fef01316@sentry.io/1332510' });

// private modules
const ResponseData = require('./../entities/responseData');

const defaultError = (err, req, res, next) => {

  Sentry.captureException(err);

  if (res.headersSent) {
    return next(err);
  }

  if(err instanceof multer.MulterError) {

    if(err.code === 'LIMIT_FILE_SIZE'){

      err.status = 422;
      err.message = 'File size should not be greater than 2mb.' 

    }

  }

  err.status = err.status || 500;
  res.status(err.status).send(new ResponseData({
    msg: err.message
  }));
}

module.exports = {defaultError};