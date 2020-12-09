const { pick, isEmpty } = require('lodash');
const moment = require('moment');

const { generatePasswordHash } = require('../helper/helper');

const generateHash = (req, res, next) => {

    const password = req.body.password;

    if(!isEmpty(password)) {

        generatePasswordHash(password).then((hash) => {

            req.body.password = hash;
            next();
    
        }).catch((err) => {
    
            next(err);
    
        });

    } else {

        next();

    }

};

const checkCouponExpiry = (req, res, next) => {

    if(!isEmpty(req.body.expiresOn)) {

        const endDate = moment(moment().format()).add(86390, 'seconds');//86400 seconds in a day
        const expiresOn = moment(req.body.expiresOn); 
        if(expiresOn.isSameOrAfter(endDate) === true) {

        next();

        } else {

        next({ message: 'Coupon is expiring too early, Minimum 24hrs of expiry is required.', status: 400 });

        }

    } else {

        next();

    }
    

}

module.exports = { generateHash, checkCouponExpiry };