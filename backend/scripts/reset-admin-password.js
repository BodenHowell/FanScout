const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/database');
const User = require('../models/user');

const resetAdminPassword = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('Connected to MongoDB');

        const admin = await User.findOne({email: 'admin@fanscout.com'});
        if (!admin) {
            console.log('Admin user not found');
            process.exit(1);
        }
        
        console.log('Found admin user:', admin.name, admin.email);
        
        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin!', salt);
        
        // Update password
        admin.password = hashedPassword;
        await admin.save();
        
        console.log('Admin password updated successfully');
        console.log('New credentials: admin@fanscout.com / admin!');
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetAdminPassword();