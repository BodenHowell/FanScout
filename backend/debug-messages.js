const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');
const Conversation = require('./models/message');

dotenv.config();

async function debugMessages() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        const conversations = await Conversation.find({}).populate('participants', 'username name');
        
        conversations.forEach(conv => {
            console.log(`\nConversation ${conv._id}:`);
            console.log(`Participants: ${conv.participants.map(p => `${p.name} (${p._id})`).join(', ')}`);
            console.log('Messages:');
            conv.messages.forEach((msg, index) => {
                console.log(`  ${index + 1}. "${msg.text}"`);
                console.log(`     Sender: ${msg.sender} (type: ${typeof msg.sender})`);
                console.log(`     Sent: ${msg.sent}`);
                console.log(`     Time: ${msg.time}`);
            });
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

debugMessages();