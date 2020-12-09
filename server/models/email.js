const mongoose = require('mongoose');
var _ = require('lodash');

const AdminSchema = mongoose.Schema({
    
    email_name 	: { type: String, default: '' },
    subject: { type: String, default: '' },    
    template: { type: String, default: '' },
    status: { type: String, default: 1 },

    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

module.exports = mongoose.model('email_templates', AdminSchema);
