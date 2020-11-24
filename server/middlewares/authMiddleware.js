const { includes, isEmpty } = require('lodash');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const Tokens = require("../models/token");
const config = require('../config');


const noAuthApis = [
  '/api/v1/contest-list',
  '/api/v1/new-contest-list',
  '/api/v1/contest-detail',
  "/api/v1/player-list",
  "/api/v1/get-match-list",
  "/api/v1/banner-list",
  "/api/v1/contest-detail",
  "/api/v1/series-player-detail",
  "/api/v1/before-join-contest",
  "/api/v1/team-states",
  "/api/v1/player-team-list",
];

const validateToken = async (user_id, token) => {
    try {
      let tokenData = await Tokens.findOne({ token: token, userId: new ObjectId(user_id)});
      if (tokenData) {
        return tokenData;
      } else {
        return false;
      }
    } catch (err) {
      console.log(err.message);
      let response;
      response["message"] = err.message;
      return res.json(response);
    }
}

// TODO: add 404 for not present routes
const authenticate = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, token");
  res.header("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");

  if (req.method !== "OPTIONS") {
    const requestUrl = req.url || '';
    let reqRoute = requestUrl.split('/').pop();
    if (reqRoute.indexOf('?') > 0) {// use test instead
      reqRoute = reqRoute.split('?')[0];
    }

    var token = req.headers['token'];
    //console.log('------------------',token, req.url)
    if (!isEmpty(token) && token !== "") {
      jwt.verify(token, config.tokenSecret, function (err, decoded) {
        if (err) {
          console.log('err',err.message);
          var response = { status: false, message: "Session expired, please login again"};
              return res.status(401).json(response);
        } else {
          req.decoded = decoded;
          validateToken(req.decoded._id, token).then((tokenData)=>{
            if(tokenData){
              req.userId = tokenData.userId;
              next();
            } else {
              var response = { status: false, message: "Session expired, please login again"};
              return res.status(401).json(response);
            }
          }).catch((err)=>{
            var response = { status: false, message: "Session expired, please login again"};
              return res.status(401).json(response);
          })
        }
      });
    } else {
      let isAllowed = false;
      //console.log('d******',req.url);
      noAuthApis.map((item) => {
        if(req.url.indexOf(item) > -1){
          isAllowed = true;
        }
      })
      if(isAllowed){
          next();
      } else {
          var response = { status: false, message: "Session expired, please login again"};
          return res.status(401).json(response);
      }
    }
  } else { next(); }

};



module.exports = {
  authenticate
};