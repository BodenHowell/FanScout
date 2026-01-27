const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    // Who receives this notification
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    // Who triggered this notification
    actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Type of notification
    type: {
        type: String,
        required: true,
        enum: [
            'message',           // New direct message
            'post_liked',        // Someone liked your post
            'comment_liked',     // Someone liked your comment
            'new_follow',        // Someone followed you
            'new_post',          // Someone you follow posted
            'post_comment',      // Someone commented on your post
            'comment_reply',     // Someone replied to your comment
            'post_reply',        // Someone replied to your post
            'mention',           // Someone mentioned you
            'offer_made',        // Someone made an offer
            'offer_received',    // Someone made you an offer
            'offer_accepted'     // Your offer was accepted
        ]
    },
    
    // Action description
    action: {
        type: String,
        required: true
    },
    
    // Related content
    target: {
        // The object this notification is about
        targetType: {
            type: String,
            enum: ['Post', 'Comment', 'Message', 'User', 'Offer'],
            required: false
        },
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: false,
            refPath: 'target.targetType'
        }
    },
    
    // Additional data for the notification
    data: {
        // Post preview text
        postPreview: String,
        
        // Comment text for quotes
        commentText: String,
        
        // Message content preview
        messagePreview: String,
        
        // Offer details
        offerDetails: {
            athlete: String,
            position: String,
            quantity: Number,
            price: String,
            totalValue: String
        },
        
        // Any additional metadata
        metadata: mongoose.Schema.Types.Mixed
    },
    
    // Read status
    isRead: {
        type: Boolean,
        default: false,
        index: true
    },
    
    // When notification was read
    readAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, type: 1 });

// Static methods
notificationSchema.statics.createNotification = async function(notificationData) {
    try {
        // Prevent self-notifications
        if (notificationData.recipient.toString() === notificationData.actor.toString()) {
            return null;
        }
        
        // Check for duplicate notifications (prevent spam)
        const duplicate = await this.findOne({
            recipient: notificationData.recipient,
            actor: notificationData.actor,
            type: notificationData.type,
            'target.targetId': notificationData.target?.targetId,
            createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Within last 5 minutes
        });
        
        if (duplicate) {
            return duplicate;
        }
        
        // Create the notification
        const notification = new this(notificationData);
        await notification.save();
        
        // Populate references for return
        await notification.populate([
            { path: 'actor', select: 'username name avatar' },
            { path: 'recipient', select: 'username name' }
        ]);
        
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
};

// Instance methods
notificationSchema.methods.markAsRead = async function() {
    if (!this.isRead) {
        this.isRead = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

// Format notification for frontend
notificationSchema.methods.toNotificationObject = function() {
    const timeAgo = getTimeAgo(this.createdAt);
    
    return {
        id: this._id,
        type: this.type,
        username: this.actor.username || this.actor.name,
        action: this.action,
        time: timeAgo,
        avatar: this.actor.avatar || 'images/placeholder_athlete.png',
        hasDot: !this.isRead,
        isRead: this.isRead,
        category: this.getCategory(),
        
        // Target information
        postId: this.target?.targetType === 'Post' ? this.target.targetId : undefined,
        commentId: this.target?.targetType === 'Comment' ? this.target.targetId : undefined,
        messageId: this.target?.targetType === 'Message' ? this.target.targetId : undefined,
        userId: this.target?.targetType === 'User' ? this.target.targetId : undefined,
        
        // Additional data
        content: this.data?.messagePreview,
        postPreview: this.data?.postPreview,
        quote: this.data?.commentText,
        comment: this.data?.commentText,
        postImage: this.data?.postImage,
        offerDetails: this.data?.offerDetails,
        conversationId: this.data?.conversationId,
        
        // Action button
        hasButton: this.hasActionButton(),
        buttonText: this.getButtonText(),
        
        // Timestamps
        timestamp: this.createdAt,
        createdAt: this.createdAt,
        readAt: this.readAt
    };
};

notificationSchema.methods.getCategory = function() {
    switch (this.type) {
        case 'message':
            return 'messages';
        case 'offer_made':
        case 'offer_received':
        case 'offer_accepted':
            return 'offers';
        default:
            return 'social';
    }
};

notificationSchema.methods.hasActionButton = function() {
    return ['new_follow', 'offer_made', 'offer_received', 'message'].includes(this.type);
};

notificationSchema.methods.getButtonText = function() {
    switch (this.type) {
        case 'new_follow':
            return 'Follow Back';
        case 'offer_made':
        case 'offer_received':
            return 'View Offer';
        case 'message':
            return 'Reply';
        default:
            return null;
    }
};

// Helper function for time formatting
function getTimeAgo(date) {
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w`;
    
    return date.toLocaleDateString();
}

module.exports = mongoose.model('Notification', notificationSchema);