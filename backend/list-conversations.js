const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');
const Conversation = require('./models/message');

dotenv.config();

async function listConversations() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        const conversations = await Conversation.find({}).populate('participants', 'username name');
        console.log('All conversations:');
        conversations.forEach(conv => {
            console.log(`ID: ${conv._id}`);
            console.log(`Participants: ${conv.participants.map(p => p.username).join(', ')}`);
            console.log(`Messages: ${conv.messages.length}`);
            console.log('---');
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

listConversations();