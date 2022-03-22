const mongoose = require('mongoose');
var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');




const AdminSchema = mongoose.Schema({
    
    account_number: { type: String, default: null },
    ifsc_code: { type: String, default: null },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },    
    bank_name: { type: String, default: null },
    branch: { type: String, default: null },
    bank_image: { type: String, default: null },    
    beneficiary_id: { type: String, default: null },
    is_verified: { type: String, enum: [1,0], default: 0 },
    api_verified: { type: Number, enum: [1,0], default: 1 },
    is_instant_verify: { type: Number, enum: [1,0], default: 0 },
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('bank_detail', AdminSchema);