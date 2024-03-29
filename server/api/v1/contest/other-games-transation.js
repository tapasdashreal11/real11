const async = require('async');
const OGTransactions = require("../../../models/other-games-transaction");
const User = require("../../../models/user");
const { ObjectId } = require('mongodb');
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const { transaction_type } = require('../../../constants/permissions');
const { isError } = require('lodash');
const moment = require('moment');

module.exports = async (req, res, dbs) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };
		let userId=  req.userId;
		result    =  [];
		try {
			var tzOffset = 5.5 * 1000 * 60 * 60;
			var filter = { "user_id": userId,status: true }
			let usersData = await OGTransactions.find(filter, {"txn_date":1, "added_type":1, "txn_amount":1, "local_txn_id":1, "txn_date":1,"retantion_amount":1, "withdraw_commission":1}).sort({"txn_date": -1 }).limit(50);
			if(usersData && usersData.length > 0){
				var newArr = [];
				_.forEach(usersData, function(i, k){
					newArr.push({
						"_id": i._id,
						"sign_type": (_.indexOf([3, 11, 12, 13,23], i.added_type) >=0)? '-' : '+' ,
						"amount": i && i.txn_amount ? "" +i.txn_amount:"0",
						"txn_type": (i.added_type)? transaction_type[parseInt(i.added_type)] : "",
						"transaction_id": i.local_txn_id,
						"retantion_amount":i.retantion_amount || 0,
						"withdraw_commission":i.withdraw_commission || 0,
						"txn_date": new Date(i.txn_date).toLocaleString("en-US", {timeZone: 'Asia/Kolkata'}),
						//"txn_date": moment(i.txn_date).add('5.5', 'hours').format("YYYY-MM-DD,HH:mm:ss"),
						"team_name": "",
						"date": moment(i.txn_date).format("YYYY-MM-DD"),
					});

					if(k === (usersData.length - 1)){
						var fnData = _.chain(newArr)
						.groupBy("date")
						// `key` is group's name (color), `value` is the array of objects
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
