const mongoose = require('mongoose');
var _ = require('lodash');
var Schema = mongoose.Schema,ObjectId = Schema.ObjectId;


// {
//   "response": {
//       "status": true,
//       "message": "Success.",
//       "data": {
//           "team_name": "SAUR2C0E83",
//           "name": "saurabh ",
//           "contest_level": 1,
//           "paid_contest_count": 2,
//           "total_cash_amount": "3.50",
//           "total_winning_amount": "0.00",
//           "cash_bonus_amount": "48.50",
//           "invite_friend_code": "8bvk6js50E",
//           "contest_finished": 12,
//           "total_match": 9,
//           "total_series": 8,
//           "series_wins": 0,
//           "team_name_updated": 0,
//           "image": "http://real11images.real11.com/uploads/avetars/avatar1.png",
//           "refered_to_friend": [],
//           "gender": "Male",
//           "rewards": [],
//           "referal_bonus": "20",
//           "series_ranks": [],
//           "account_verified": true,
//           "mobile_verify": true,
//           "email_verify": true,
//           "pan_verify": true,
//           "bank_verify": true
//       }
//   }
// }


const AdminSchema = mongoose.Schema({
    
    contest_level: { type: Number, default: 0 },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },    
    paid_contest_count: { type: Number, default: 0.00 },  
    

    invite_friend_code: { type: String, default:""},
    contest_finished: { type: Number, default: 0 },
    total_match: { type: Number, default: 0 },
    total_series: { type: Number, default: 0 },
    series_wins: { type: Number, default: 0 },


    team_name_updated: { type: Number, default: 0 },
    rewards: { type: Array, default: []},
    referal_bonus: { type: String, default: 0 },
    series_ranks: { type: Array, default: []},

    account_verified: { type: Boolean, default: false },
    total_deposit: { type: Number, default: 0 },
    total_withdraw: { type: Number, default: 0 },
    total_joined_contest_amount: { type: Number, default: 0 },

    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);


module.exports = mongoose.model('user_profile', AdminSchema, 'user_profile');
