const mongoose = require('mongoose');
var _ = require('lodash');


const AdminSchema = mongoose.Schema({
    avetars: { type: String, default: '' },
    status: { type: Number, enum: [1,0], default: 1 }
    


   
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('user_avatar', AdminSchema);