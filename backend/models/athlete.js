const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    labels: [String],
    data: [Number]
});

const athleteSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Athlete name is required'],
        unique: true,
        trim: true
    },
    details: {
        type: String,
        required: true
    },
    avatar: {
        type: String,
        required: true
    },
    sport: {
        type: String,
        required: true,
        enum: ['nfl', 'nba', 'ncaaf', 'ncaab', 'soccer', 'f1', 'tennis', 'ufc', 'golf', 'track', 'mlb', 'nhl']
    },
    quantity: {
        type: Number,
        required: true,
        min: 0
    },
    stats: {
        type: Map,
        of: String
    },
    bio: {
        type: String,
        default: ''
    },
    // Market data
    currentPrice: {
        type: Number,
        required: true,
        min: 0
    },
    dailyChange: {
        type: Number,
        default: 0
    },
    dailyChangePercent: {
        type: Number,
        default: 0
    },
    previousClose: {
        type: Number,
        required: true
    },
    afterHoursPrice: {
        type: Number,
        default: null
    },
    afterHoursChange: {
        type: Number,
        default: null
    },
    afterHoursChangePercent: {
        type: Number,
        default: null
    },
    // Price history
    d1: priceHistorySchema,
    d5: priceHistorySchema,
    m1: priceHistorySchema,
    m6: priceHistorySchema,
    ytd: priceHistorySchema,
    y1: priceHistorySchema,
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt timestamp before saving
athleteSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Virtual for market cap
athleteSchema.virtual('marketCap').get(function() {
    return this.currentPrice * this.quantity;
});

// Ensure virtuals are included in JSON output
athleteSchema.set('toJSON', { virtuals: true });

// Check if model already exists to prevent recompilation
module.exports = mongoose.models.Athlete || mongoose.model('Athlete', athleteSchema);