var mongoose = require('mongoose');
var Schema = mongoose.Schema, ObjectId = Schema.ObjectId;

var phonePeTransactionSchema = new Schema({
	transaction_id: {
		type: ObjectId,
	},
	user_id: {
		type: ObjectId,
	},
	status: {
		type: String,
		default: ""
	},
}, {
	timestamps: true
}
);

module.exports = mongoose.model('phonepe_transaction', phonePeTransactionSchema, 'phonepe_transaction');
