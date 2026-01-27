const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    sent: {
        type: Boolean,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    date: {
        type: String
    },
    offer: {
        type: Object,
        default: null,
        validate: {
            validator: function(v) {
                if (!v) return true; // Allow null/undefined
                return typeof v === 'object' && 
                       typeof v.price === 'string' && 
                       typeof v.type === 'string' && 
                       typeof v.total === 'string' && 
                       typeof v.quantity === 'number' && 
                       typeof v.athlete === 'string';
            },
            message: 'Offer must be a valid offer object'
        }
    }
});

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    athleteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Athlete'
    },
    conversationType: {
        type: String,
        enum: ['user-to-user', 'user-to-athlete'],
        default: 'user-to-user'
    },
    messages: [messageSchema],
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageTime: {
        type: Date,
        default: Date.now
    },
    unreadCount: {
        type: Map,
        of: Number,
        default: new Map()
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamps
conversationSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    if (this.messages && this.messages.length > 0) {
        const lastMsg = this.messages[this.messages.length - 1];
        this.lastMessage = lastMsg.text;
        this.lastMessageTime = Date.now();
    }
    next();
});

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageTime: -1 });

// Check if model already exists to prevent recompilation
module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);