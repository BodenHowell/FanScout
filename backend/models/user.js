const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    username: {
        type: String,
        required: function() {
            return this.isNew; // Only required for new users
        },
        unique: true,
        sparse: true, // Allow null values but ensure uniqueness when set
        lowercase: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters'],
        maxlength: [20, 'Username cannot be more than 20 characters'],
        match: [
            /^[a-zA-Z0-9_]+$/,
            'Username can only contain letters, numbers, and underscores'
        ]
    },
    email: {
        type: String,
        required: [true, 'Please provide an email'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
            'Please provide a valid email'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please provide a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false
    },
    avatar: {
        type: String,
        default: 'images/image_48fb0979.png'
    },
    portfolio: {
        totalValue: {
            type: Number,
            default: 0
        },
        totalShares: {
            type: Number,
            default: 0
        },
        isPublic: {
            type: Boolean,
            default: true
        },
        percentChange: {
            type: Number,
            default: 0
        },
        percentChangeWeekly: {
            type: Number,
            default: 0
        },
        percentChangeMonthly: {
            type: Number,
            default: 0
        },
        percentChangeYearly: {
            type: Number,
            default: 0
        },
        initialValue: {
            type: Number,
            default: 0
        },
        lastCalculated: {
            type: Date,
            default: Date.now
        }
    },
    accountBalance: {
        type: Number,
        default: 0,
        min: [0, 'Account balance cannot be negative']
    },
    ownership: {
        type: Map,
        of: Number,
        default: new Map()
    },
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastActive: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Encrypt password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) {
        return next();
    }
    
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Sign JWT and return
userSchema.methods.getSignedJwtToken = function() {
    return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE
    });
};

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Update last active timestamp
userSchema.methods.updateLastActive = async function() {
    this.lastActive = Date.now();
    await this.save();
};

// Check if model already exists to prevent recompilation
module.exports = mongoose.models.User || mongoose.model('User', userSchema);