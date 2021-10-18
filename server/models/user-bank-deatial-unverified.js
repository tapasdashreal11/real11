const mongoose = require('mongoose');
const AdminSchema = mongoose.Schema({
    account_number: { type: String, default: null },
    ifsc_code: { type: String, default: null },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },    
    bank_name: { type: String, default: null },
    branch: { type: String, default: null },
    bank_image: { type: String, default: null }
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('bank_detail_unverified', AdminSchema);