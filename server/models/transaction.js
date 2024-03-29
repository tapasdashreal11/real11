var mongoose = require('mongoose');
var Schema = mongoose.Schema,ObjectId = Schema.ObjectId;

var transactionSchema = new Schema({
  id: {
    type: Number
  },
  user_id: {
    type: ObjectId, index: true
  },
  contest_id: {
    type: ObjectId
  },
  match_id: {
    type: Number
  },
  sport: {
    type: Number
  },
  order_id: {
    type: String
  },
  txn_id: {
    type: String
  },
  coupon_id: {
    type: ObjectId
  },
  discount_amount: {
    type: Number
  },
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
    refund_affiliate_amount: {
      type: Number
    },
    current_winning_balance: {
      type: Number
    },
    current_cash_balance: {
      type: Number
    },
    current_bonus_amount: {
      type: Number
    },
    current_extra_amount: {
      type: Number
    },
    current_affiliate_amount: {
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
    winning_balance: {
      type: Number
    },
    cash_balance: {
      type: Number
    },
    bonus_balance: {
      type: Number
    },
    total_balance: {
      type: Number
    },
    status: {
      type: Boolean
    }
  },
  banktxn_id: {
    type: String
  },
  utrnumber: {
    type: String
  },
  txn_date: {
    type: Date
  },
  txn_amount: {
    type: Number
  },
  retantion_amount: {
    type: Number,default:0
  },
  total_team_joined: {
    type: Number,default:1
  },
  contest_entry_fee: {
    type: Number
  },
  currency: {
    type: String
  },
  gateway_name: {
    type: String
  },
  checksum: {
    type: String
  },
  local_txn_id: {
    type: String
  },
  added_type: {
    type: Number
  },
  withdraw_id: {
    type: ObjectId
  },
  status: {
    type: Boolean,
    default:true
  },
  coupon_type: {
    type: String
  },
  approve_withdraw: {
    type: Date,
    default: null 
  },
  withdraw_commission: {
    type: Number,default:0
  },
  ip_address:{ type:String }
});


transactionSchema.statics.saveTransaction = function(userId = null, txnId=null, status = false, txnAmount = 0, withdrawId=null, contest_id= 0, match_id= 0) {

		let entity					=	{};
    entity.user_id		=	userId;
    if(contest_id) {
      entity.contest_id		=	contest_id;
    }
		entity.match_id		=	match_id;
		entity.txn_amount		=	txnAmount;
		entity.currency		=	"INR";
		entity.txn_date		=	Date.now();
		entity.local_txn_id	=	txnId;
    entity.added_type		=	parseInt(status);
    //entity.withdraw_id	=	(withdrawId) ? withdrawId : 0;
    if(withdrawId) {
      entity.withdraw_id	=	(withdrawId) ? withdrawId : '';
    }

		let result = this.create(entity);

		return trs_id = result._id;
  }
  

transactionSchema.statics.saveWithdrawTransaction = function(userId = null, txnId=null, status = false, txnAmount = 0, withdrawId=null, orderId= "", gatewayName= "", approveDate=null, instantWithdrawComm) {

  let entity				=	{};
  entity.user_id		=	userId;
  
  entity.txn_amount	=	txnAmount;
  entity.currency		=	"INR";
  entity.txn_date		=	Date.now();
  entity.local_txn_id	=	txnId;
  entity.added_type		=	parseInt(status);
  //entity.withdraw_id	=	(withdrawId) ? withdrawId : 0;
  if(withdrawId) {
    entity.withdraw_id	=	(withdrawId) ? withdrawId : '';
    entity.order_id	=	orderId || '';
    entity.gateway_name	=	gatewayName || '';
    entity.approve_withdraw	=	approveDate || '';
    entity.withdraw_commission	=	instantWithdrawComm || 0;
  }

  let result = this.create(entity);

  return trs_id = result._id;
}

module.exports = mongoose.model('transaction', transactionSchema, 'transaction');
