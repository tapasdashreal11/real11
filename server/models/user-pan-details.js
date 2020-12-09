const mongoose = require('mongoose');
var _ = require('lodash');
// var mongoosePaginate = require('mongoose-paginate-v2');




const AdminSchema = mongoose.Schema({
    
    pan_card: { type: String },
    pan_name: { type: String },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },    
    date_of_birth: { type: String },
    state: { type: String },
    pan_image: { type: String },    
    aadhar_card: { type: String },
    is_verified: { type: String, enum: [1,0], default: 0 },
    
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);

// AdminSchema.plugin(mongoosePaginate);
module.exports = mongoose.model('pen_aadhar_card', AdminSchema);