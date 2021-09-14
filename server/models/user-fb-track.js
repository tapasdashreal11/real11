const mongoose = require('mongoose');
const fbTrackdminSchema = mongoose.Schema({
    fbtrace_id: { type: String },
    events_received: { type: Number },
    events_obj: { type: Object }
}, {
        timestamps: { createdAt: 'created', updatedAt: 'modified' },
        toObject: { getters: true, setters: true },
        toJSON: { getters: true, setters: true }
    }
);
module.exports = mongoose.model('user_fb_track', fbTrackdminSchema,'user_fb_track');