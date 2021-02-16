const async = require('async');
const Transactions = require("../../../models/transaction");
const User = require("../../../models/user");
const { ObjectId } = require('mongodb');
const ApiUtility = require("../../api.utility");
const logger = require("../../../../utils/logger")(module);
const _ = require('lodash');
const { TransactionTypes, MatchStatus, RedisKeys } = require('../../../constants/app');
const UserService = require('../../Services/UserService');
const { transaction_type } = require('../../../constants/permissions');
const { isError } = require('lodash');
const moment = require('moment');

module.exports = async (req, res, dbs) => {
	try {
		var response = { status: false, message: "Invalid Request", data: {} };

		let userId=  req.userId;
		result    =  [];
		try {
			let userData = await User.findOne({ '_id': userId }).select("team_name");
			var tzOffset = 5.5 * 1000 * 60 * 60;
			var filter = { "user_id": userId, $or: [{ status: { $exists: false } }, { status: true }] }


			let usersData = await Transactions.find(filter, {"txn_date":1, "added_type":1, "txn_amount":1, "local_txn_id":1, "txn_date":1,"retantion_amount":1, "withdraw_commission":1}).sort({"txn_date": -1 }).limit(100);

			if(usersData && usersData.length > 0){
			 
				var newArr = [];
				
				_.forEach(usersData, function(i, k){
					newArr.push({
						"_id": i._id,
						"sign_type": (_.indexOf([3, 11, 12, 13], i.added_type) >=0)? '-' : '+' ,
						"amount": i.txn_amount.toString(),
						"txn_type": (i.added_type)? transaction_type[parseInt(i.added_type)] : "",
						"transaction_id": i.local_txn_id,
						"retantion_amount":i.retantion_amount || 0,
						"withdraw_commission":i.withdraw_commission || 0,
						"txn_date": moment(i.txn_date).add('5.5', 'hours').format("YYYY-MM-DD,HH:mm:ss"),
						"team_name": userData.team_name || "",
						"date": moment(i.txn_date).format("YYYY-MM-DD"),
					});

					if(k === (usersData.length - 1)){
						var fnData = _.chain(newArr)
						// Group the elements of Array based on `color` property
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
			console.log("error11111", err)
			response["message"] = err.message;
			return res.json(response);
		}
	} catch (error) {
		console.log("error222", error)
		logger.error("LOGIN_ERROR", error.message);
		res.send(ApiUtility.failed(error.message));
	}
};
