const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/user');
const Conversation = require('./models/message');

dotenv.config();

async function deleteLatestMessageFromAccountToAdmin() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');
        
        // Find the admin user and account user
        const admin = await User.findOne({ username: 'admin' });
        const account = await User.findOne({ username: 'accountaa' });
        
        if (!admin || !account) {
            console.log('Admin or account user not found');
            process.exit(1);
        }
        
        console.log(`Admin ID: ${admin._id}`);
        console.log(`Account ID: ${account._id}`);
        
        // Find conversation between account and admin
        const conversation = await Conversation.findOne({
            participants: { $all: [account._id, admin._id] }
        });
        
        if (!conversation) {
            console.log('No conversation found between account and admin');
            process.exit(1);
        }
        
        console.log(`\nFound conversation with ${conversation.messages.length} messages`);
        
        // Find the most recent message FROM admin TO account
        let latestAdminMessageIndex = -1;
        let latestAdminMessage = null;
        
        for (let i = conversation.messages.length - 1; i >= 0; i--) {
            const message = conversation.messages[i];
            if (message.sender.toString() === admin._id.toString()) {
                latestAdminMessageIndex = i;
                latestAdminMessage = message;
                break;
            }
        }
        
        if (latestAdminMessageIndex === -1) {
            console.log('No messages found from admin to account');
            process.exit(0);
        }
        
        console.log(`\nLatest message from admin to account:`);
        console.log(`Message ${latestAdminMessageIndex + 1}: "${latestAdminMessage.text}"`);
        console.log(`Time: ${latestAdminMessage.time}`);
        console.log(`Sender ID: ${latestAdminMessage.sender}`);
        
        // Remove the message
        conversation.messages.splice(latestAdminMessageIndex, 1);
        
        // Update last message and time if needed
        if (conversation.messages.length > 0) {
            const lastMsg = conversation.messages[conversation.messages.length - 1];
            conversation.lastMessage = lastMsg.text;
            conversation.lastMessageTime = new Date();
        } else {
            conversation.lastMessage = '';
            conversation.lastMessageTime = new Date();
        }
        
        await conversation.save();
        
        console.log(`\n✅ Successfully deleted the latest message from admin to account`);
        console.log(`Conversation now has ${conversation.messages.length} messages`);
        
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

deleteLatestMessageFromAccountToAdmin();
