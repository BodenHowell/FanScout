const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/database');
const User = require('../models/user');

const setupAdminFollowing = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('Connected to MongoDB');

        const admin = await User.findOne({email: 'admin@fanscout.com'});
        if (!admin) {
            console.log('Admin user not found');
            process.exit(1);
        }
        
        console.log('Admin user following:', admin.following);
        
        if (admin.following.length === 0) {
            // Add some following relationships for testing
            const otherUsers = await User.find({email: {$ne: 'admin@fanscout.com'}}).limit(3);
            admin.following = otherUsers.map(u => u._id);
            
            // Add admin to their followers lists
            for (const user of otherUsers) {
                if (!user.followers.includes(admin._id)) {
                    user.followers.push(admin._id);
                    await user.save();
                }
            }
            
            await admin.save();
            console.log('Updated admin following:', admin.following);
            console.log('Admin now follows:', otherUsers.map(u => u.name));
        } else {
            console.log('Admin already has following relationships');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

setupAdminFollowing();