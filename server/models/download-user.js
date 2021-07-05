const mongoose = require('mongoose');
const DUserSchema = mongoose.Schema({
    dcode: { type: String, default: ''},
    clevertap_id:{ type:String,default: '' }
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('user-download', DUserSchema);