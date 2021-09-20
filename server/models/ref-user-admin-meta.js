const mongoose = require('mongoose');
const refUserAdminMeta = mongoose.Schema({
    user_id: { type: String },
    refer_id: { type: String },
    ref_count: { type: Number }
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('ref_user_admin_meta', refUserAdminMeta,'ref_user_admin_meta');