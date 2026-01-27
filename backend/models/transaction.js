const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    athleteName: {
        type: String,
        required: true
    },
    athlete: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Athlete',
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['buy', 'sell']
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    pricePerShare: {
        type: Number,
        required: true,
        min: 0
    },
    totalAmount: {
        type: Number
    },
    fee: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'cancelled', 'failed'],
        default: 'completed'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Calculate total amount before saving
transactionSchema.pre('save', function(next) {
    this.totalAmount = this.quantity * this.pricePerShare;
    if (this.type === 'sell') {
        this.fee = this.totalAmount * 0.01; // 1% fee for selling
    }
    next();
});

// Index for faster queries
transactionSchema.index({ user: 1, date: -1 });
transactionSchema.index({ athlete: 1, date: -1 });

// Check if model already exists to prevent recompilation
module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);