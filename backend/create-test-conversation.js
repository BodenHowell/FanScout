const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');
const Conversation = require('./models/message');

dotenv.config();

async function createTestConversation() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        // Find your user
        const user = await User.findOne({ username: 'bodenhowell' });
        if (!user) {
            console.log('User not found');
            process.exit(1);
        }
        
        // Create a test user to chat with
        const testUser = await User.findOneAndUpdate(
            { username: 'testuser' },
            {
                name: 'Test User',
                username: 'testuser',
                email: 'test@example.com',
                password: 'password123'
            },
            { upsert: true, new: true }
        );
        
        // Create a conversation
        const conversation = new Conversation({
            participants: [user._id, testUser._id],
            conversationType: 'user-to-user',
            messages: [
                {
                    text: 'Hey! How are you doing?',
                    sender: testUser._id,
                    sent: false,
                    time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                },
                {
                    text: 'Good! Want to trade some shares?',
                    sender: user._id,
                    sent: true,
                    time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                }
            ]
        });
        
        await conversation.save();
        console.log('Test conversation created successfully!');
        console.log('Conversation ID:', conversation._id);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

createTestConversation();