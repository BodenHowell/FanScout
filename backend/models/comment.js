const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    text: {
      type: String,
      required: true,
      maxlength: 500
    }
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  metrics: {
    likes: {
      type: Number,
      default: 0
    },
    replies: {
      type: Number,
      default: 0
    }
  },
  likedBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
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

// Indexes for efficient queries
CommentSchema.index({ post: 1, createdAt: 1 });
CommentSchema.index({ author: 1, createdAt: -1 });
CommentSchema.index({ parentComment: 1, createdAt: 1 });

// Virtual for populated author details
CommentSchema.virtual('authorDetails', {
  ref: 'User',
  localField: 'author',
  foreignField: '_id',
  justOne: true
});

// Virtual for populated replies with author details
CommentSchema.virtual('repliesWithDetails', {
  ref: 'Comment',
  localField: 'replies',
  foreignField: '_id'
});

// Method to check if user liked the comment
CommentSchema.methods.isLikedBy = function(userId) {
  return this.likedBy.includes(userId);
};

// Method to toggle like
CommentSchema.methods.toggleLike = function(userId) {
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

// Method to add reply
CommentSchema.methods.addReply = function(replyId) {
  if (!this.replies.includes(replyId)) {
    this.replies.push(replyId);
    this.metrics.replies += 1;
  }
};

// Method to remove reply
CommentSchema.methods.removeReply = function(replyId) {
  const index = this.replies.findIndex(id => id.toString() === replyId.toString());
  if (index > -1) {
    this.replies.splice(index, 1);
    this.metrics.replies = Math.max(0, this.metrics.replies - 1);
  }
};

// Pre-save middleware to update timestamps
CommentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Post-save middleware to update post comment count
CommentSchema.post('save', async function(doc) {
  try {
    const Post = mongoose.model('Post');
    const post = await Post.findById(doc.post);
    if (post) {
      const commentCount = await mongoose.model('Comment').countDocuments({ 
        post: doc.post,
        parentComment: null // Only count top-level comments
      });
      post.metrics.comments = commentCount;
      await post.save();
    }

    // If this is a reply, update parent comment
    if (doc.parentComment) {
      const parentComment = await mongoose.model('Comment').findById(doc.parentComment);
      if (parentComment) {
        parentComment.addReply(doc._id);
        await parentComment.save();
      }
    }
  } catch (error) {
    console.error('Error updating post comment count:', error);
  }
});

// Pre-remove middleware to clean up references
CommentSchema.pre('remove', async function(next) {
  try {
    // Remove this comment from parent replies if it's a reply
    if (this.parentComment) {
      const parentComment = await mongoose.model('Comment').findById(this.parentComment);
      if (parentComment) {
        parentComment.removeReply(this._id);
        await parentComment.save();
      }
    }

    // Remove all replies to this comment
    await mongoose.model('Comment').deleteMany({ parentComment: this._id });

    // Update post comment count
    const Post = mongoose.model('Post');
    const post = await Post.findById(this.post);
    if (post) {
      const commentCount = await mongoose.model('Comment').countDocuments({ 
        post: this.post,
        parentComment: null
      });
      post.metrics.comments = Math.max(0, commentCount - 1);
      await post.save();
    }

    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Comment', CommentSchema);