const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      required: true,
      maxlength: 2000
    },
    media: [{
      type: {
        type: String,
        enum: ['image', 'video'],
        required: true
      },
      url: {
        type: String,
        required: true
      },
      thumbnail: String // For videos
    }]
  },
  metrics: {
    likes: {
      type: Number,
      default: 0
    },
    comments: {
      type: Number,
      default: 0
    },
    shares: {
      type: Number,
      default: 0
    }
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  sharedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    lowercase: true
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  visibility: {
    type: String,
    enum: ['public', 'followers', 'private'],
    default: 'public'
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for feed queries
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ createdAt: -1 });
PostSchema.index({ 'metrics.likes': -1 });
PostSchema.index({ tags: 1 });

// Virtual for populated author details
PostSchema.virtual('authorDetails', {
  ref: 'User',
  localField: 'author',
  foreignField: '_id',
  justOne: true
});

// Method to check if user liked the post
PostSchema.methods.isLikedBy = function(userId) {
  return this.likedBy.includes(userId);
};

// Method to toggle like
PostSchema.methods.toggleLike = function(userId) {
  const userIdStr = userId.toString();
  const index = this.likedBy.findIndex(id => id.toString() === userIdStr);
  
  if (index > -1) {
    // Unlike
    this.likedBy.splice(index, 1);
    this.metrics.likes = Math.max(0, this.metrics.likes - 1);
    return false;
  } else {
    // Like
    this.likedBy.push(userId);
    this.metrics.likes += 1;
    return true;
  }
};

// Method to add share
PostSchema.methods.addShare = function(userId) {
  const existingShare = this.sharedBy.find(share => 
    share.user.toString() === userId.toString()
  );
  
  if (!existingShare) {
    this.sharedBy.push({ user: userId });
    this.metrics.shares += 1;
  }
};

// Pre-save middleware to update timestamps
PostSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Pre-remove middleware to clean up related data
PostSchema.pre('remove', async function(next) {
  try {
    // Remove all comments for this post
    await mongoose.model('Comment').deleteMany({ post: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Post', PostSchema);