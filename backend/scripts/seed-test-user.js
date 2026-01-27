const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Athlete = require('../models/athlete');
const Transaction = require('../models/transaction');
const Conversation = require('../models/message');

// Load env vars
dotenv.config({ path: '../.env' });

async function seedTestUser() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/fanscout');

  // 1. Create or update the test user
  const email = 'admin@fanscout.com';
  const password = 'admin!';
  const name = 'Admin User';

  let user = await User.findOne({ email });
  if (!user) {
    user = new User({ name, email, password });
    await user.save();
    console.log('Test user created');
  } else {
    // Update password if needed
    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      user.password = password;
      await user.save();
      console.log('Test user password updated');
    }
  }

  // 2. Give the user some portfolio ownership
  // Ownership data from Oldfiles/data.js
  const ownershipData = {
    "LeBron James": 255,
    "Brock Purdy": 450,
    "Carlo Emilion": 150,
    "Daniel Jay Park": 0,
    "Mark Rojas": 120,
    "Tahaad Pettiford": 620,
    "Caitlin Clark": 20,
    "Ryan Williams": 10,
    "Elena Petrova": 0,
    "Javier \"El Fuego\" Rios": 630,
    "Kenji Tanaka": 0,
    "Aisha Okoro": 0,
    "Sam 'The Rocket' Burns": 75,
    "Serena Williams": 50,
    "Lionel Messi": 15,
    "Patrick Mahomes": 20
  };
  const allAthletes = await Athlete.find({ name: { $in: Object.keys(ownershipData) } });
  const userOwnership = {};
  allAthletes.forEach(a => {
    userOwnership[a.name] = ownershipData[a.name] || 0;
  });
  user.ownership = userOwnership;
  user.portfolio = {
    totalValue: allAthletes.reduce((sum, a) => sum + (userOwnership[a.name] || 0) * a.currentPrice, 0),
    totalShares: Object.values(userOwnership).reduce((a, b) => a + b, 0)
  };
  await user.save();
  console.log('Test user portfolio updated');

  // 3. Add a few transactions
  await Transaction.deleteMany({ user: user._id });
  for (const a of allAthletes) {
    await Transaction.create({
      user: user._id,
      athleteName: a.name,
      athlete: a._id,
      type: 'buy',
      quantity: userOwnership[a.name] || 1,
      pricePerShare: a.currentPrice,
      totalAmount: (userOwnership[a.name] || 1) * a.currentPrice,
      status: 'completed',
      date: new Date(Date.now() - Math.floor(Math.random() * 1000000000))
    });
  }
  console.log('Test user transactions seeded');

  // 4. Add a sample conversation
  const otherUser = await User.findOne({ email: { $ne: email } }) || user;
  const convo = await Conversation.create({
    participants: [user._id, otherUser._id],
    messages: [
      { text: 'Hey, want to trade shares?', sent: false, time: '2m' },
      { text: 'Sure, what do you have in mind?', sent: true, time: '1m' },
      { text: 'Sent you an offer for LeBron.', sent: false, time: '1h', offer: JSON.stringify({ price: '$1200', quantity: 2, total: '$2400', athlete: 'LeBron James Shares' }) }
    ]
  });
  console.log('Test user conversation seeded');

  await mongoose.disconnect();
  console.log('Done!');
}

seedTestUser().catch(e => { console.error(e); process.exit(1); }); 