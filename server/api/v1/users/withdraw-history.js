const async = require('async');
const Transactions = require("../../../models/transaction");
const User = require("../../../models/user");
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const { transaction_type } = require('../../../constants/permissions');
const { isError } = require('lodash');
const moment = require('moment');

module.exports = async (req, res, dbs) => {
  try {
    var response = { status: false, message: "Invalid Request", data: {} };
    let userId = req.userId;
    result = [];
    try {
      var d = new Date();
      d.setDate(d.getDate() - 60);
      var filter = { "user_id": userId, added_type:{$in:[11,12,13]},  "txn_date":{ $gt: d.toISOString()} }
      let usersData = await Transactions.find(filter, {"txn_date":1, "added_type":1, "txn_amount":1, "local_txn_id":1, "txn_date":1}).sort({"txn_date": -1 }).limit(50);

      if(usersData && usersData.length > 0){
        var newArr = [];
        var fnData = [];
        _.forEach(usersData, function(i, k){
          newArr.push({
            "_id": i._id,
            "amount": i.txn_amount.toString(),
            "txn_type": (i.added_type)? transaction_type[parseInt(i.added_type)] : "",
            "transaction_id": i.local_txn_id,
            "txn_date": moment(i.txn_date).add('5.5', 'hours').format("YYYY-MM-DD,HH:mm:ss"),
            "date": moment(i.txn_date).format("YYYY-MM-DD"),
          });

          if(k === (usersData.length - 1)){
            var fnData = _.chain(newArr)
            .groupBy("date")
            .map((value, key) => ({ _id: key, date: key, info: value }))
            .value()

            response["message"] = null;
            response["status"] = true;
            response["data"] = fnData;
            return res.json(response);
          }
        })
      }else{
        response["message"] = null;
        response["status"] = true;
        response["data"] = usersData;
        return res.json(response);
      }
    } catch (err) {
      response["message"] = err.message;
      return res.json(response);
    }
  } catch (error) {
    logger.error("LOGIN_ERROR", error.message);
    res.send(ApiUtility.failed(error.message));
  }
};
