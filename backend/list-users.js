const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');

dotenv.config();

async function listUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        const users = await User.find({}, 'name username email _id accountBalance');
        console.log('All users:');
        users.forEach(user => {
            console.log(`ID: ${user._id}`);
            console.log(`Name: ${user.name}`);
            console.log(`Username: ${user.username}`);
            console.log(`Email: ${user.email}`);
            console.log(`Balance: $${user.accountBalance || 0}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listUsers();