const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Conversation = require('../models/message');
const User = require('../models/user');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

// Connect to DB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');

const seedMessages = async () => {
    try {
        // Delete existing conversations
        await Conversation.deleteMany({});
        console.log('Existing conversations deleted');

        // Get the test user ID
        const testUser = await User.findOne({ email: 'admin@fanscout.com' });
        if (!testUser) {
            console.error('Test user not found. Please run the user seed script first.');
            process.exit(1);
        }

        // Create sample conversations with proper ObjectIds
        const conversationsData = [
            {
                participants: [testUser._id, new mongoose.Types.ObjectId()],
                lastMessage: "Your bid on QB #11 is high!",
                lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                unreadCount: { [testUser._id.toString()]: 1 },
                messages: [
                    {
                        text: "Hey! I saw you're interested in Brock Purdy shares",
                        sender: new mongoose.Types.ObjectId(),
                        sent: false,
                        time: "2h",
                        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        text: "Yes, I think he's got great potential this season",
                        sender: testUser._id,
                        sent: true,
                        time: "1h",
                        date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        text: "Your bid on QB #11 is high!",
                        sender: new mongoose.Types.ObjectId(),
                        sent: false,
                        time: "2h",
                        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
                    }
                ]
            },
            {
                participants: [testUser._id, new mongoose.Types.ObjectId()],
                lastMessage: "I'm interested in your offer for Carlo Emilion",
                lastMessageTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
                unreadCount: { [testUser._id.toString()]: 0 },
                messages: [
                    {
                        text: "I'm interested in your offer for Carlo Emilion",
                        sender: new mongoose.Types.ObjectId(),
                        sent: false,
                        time: "3d",
                        date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
                        offer: {
                            price: "$234.00",
                            type: "buy",
                            total: "$35,100.00",
                            quantity: 150,
                            athlete: "Carlo Emilion"
                        }
                    }
                ]
            },
            {
                participants: [testUser._id, new mongoose.Types.ObjectId()],
                lastMessage: "LeBron shares are looking strong this week",
                lastMessageTime: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
                unreadCount: { [testUser._id.toString()]: 0 },
                messages: [
                    {
                        text: "What do you think about LeBron's performance?",
                        sender: testUser._id,
                        sent: true,
                        time: "1d",
                        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                    },
                    {
                        text: "LeBron shares are looking strong this week",
                        sender: new mongoose.Types.ObjectId(),
                        sent: false,
                        time: "1d",
                        date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ]
            },
            {
                participants: [testUser._id, new mongoose.Types.ObjectId()],
                lastMessage: "Thanks for the trade!",
                lastMessageTime: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
                unreadCount: { [testUser._id.toString()]: 0 },
                messages: [
                    {
                        text: "Thanks for the trade!",
                        sender: new mongoose.Types.ObjectId(),
                        sent: false,
                        time: "5d",
                        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
                    }
                ]
            }
        ];

        // Insert new conversations
        await Conversation.insertMany(conversationsData);
        console.log('Message data seeded successfully');

        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedMessages();

// --- Fix script to clean up invalid offer fields in messages ---
if (require.main === module) {
    const mongoose = require('mongoose');
    const Conversation = require('../models/message');
    const dotenv = require('dotenv');
    dotenv.config({ path: '../.env' });

    async function fixOffers() {
        await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
        const conversations = await Conversation.find({ 'messages.offer': { $type: 'string' } });
        let fixedCount = 0;
        for (const convo of conversations) {
            let changed = false;
            for (const msg of convo.messages) {
                if (typeof msg.offer === 'string') {
                    msg.offer = null;
                    changed = true;
                }
            }
            if (changed) {
                await convo.save();
                fixedCount++;
            }
        }
        console.log(`Fixed ${fixedCount} conversation(s) with invalid offer fields.`);
        await mongoose.disconnect();
    }

    fixOffers().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} 