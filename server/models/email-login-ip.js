const mongoose = require('mongoose');

const emailLoginIp = mongoose.Schema({
    
    ip 	: { type: String, default: '' }
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

module.exports = mongoose.model('email_login_ip', emailLoginIp);
