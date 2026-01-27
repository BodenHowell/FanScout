const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');

dotenv.config();

async function addBalance() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        // Find accountaa user
        const user = await User.findOneAndUpdate(
            { username: 'accountaa' },
            { $inc: { accountBalance: 10000 } },
            { new: true }
        );
        
        if (user) {
            console.log(`Successfully added $10,000 to user ${user.username}`);
            console.log(`New balance: $${user.accountBalance}`);
        } else {
            console.log('User accountaa not found');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

addBalance();