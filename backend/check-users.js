const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');

dotenv.config();

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        const users = await User.find({});
        console.log('All users in database:');
        users.forEach(user => {
            console.log(`- ${user.name} (username: "${user.username}", ID: ${user._id})`);
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkUsers();
