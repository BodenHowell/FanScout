const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');

dotenv.config();

async function addBalance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        const userId = '685c852750fcf7236732c366'; // bodenhowell user
        const balanceToAdd = 100000;
        
        const user = await User.findByIdAndUpdate(
            userId,
            { $inc: { accountBalance: balanceToAdd } },
            { new: true }
        );
        
        if (user) {
            console.log(`Successfully added $${balanceToAdd} to user ${user.username || user.name}`);
            console.log(`New balance: $${user.accountBalance}`);
        } else {
            console.log('User not found');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addBalance();