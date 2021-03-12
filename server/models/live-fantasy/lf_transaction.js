var mongoose = require('mongoose');
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

var transactionSchema = new Schema({
	user_id: { type: ObjectId },
	contest_id: { type: ObjectId },
	match_id: { type: Number },
	details: {
		refund_winning_balance: {
			type: Number
		},
		refund_cash_balance: {
			type: Number
		},
		refund_bonus_amount: {
			type: Number
		},
		refund_extra_amount: {
			type: Number
		},
		cons_winning_balance: {
			type: Number
		},
		cons_cash_balance: {
			type: Number
		},
		cons_bonus_amount: {
			type: Number
		},
		cons_extra_amount: {
			type: Number
		},
		status: {
			type: Boolean
		}
	},
	txn_date: { type: Date },
	txn_amount: { type: Number },
	retantion_amount: { type: Number },
	currency: { type: String },
	local_txn_id: { type: String },
	added_type: { type: Number },
	sport: { type: Number },
	status: {
		type: Number,
		default: 1
	}
});

module.exports = mongoose.model('lf_transaction', transactionSchema, 'lf_transaction');