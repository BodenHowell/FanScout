// Script to add fake historical portfolio data for existing users
const mongoose = require('mongoose');
const User = require('../models/user');
const Athlete = require('../models/athlete');
const Transaction = require('../models/transaction');
require('dotenv').config({ path: '../.env' });

// Connect to database
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/fanscout', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

async function seedPortfolioData() {
    try {
        console.log('🚀 Starting portfolio data seeding...');
        
        // Get all athletes for realistic portfolio distributions
        const athletes = await Athlete.find();
        console.log(`Found ${athletes.length} athletes`);
        
        // Sample user data with realistic portfolio distributions
        const sampleUsers = [
            {
                name: 'Alex Thompson',
                username: 'alex_trader',
                email: 'alex@example.com',
                password: 'password123',
                accountBalance: 15000,
                portfolio: {
                    isPublic: true,
                    initialValue: 95000,
                    percentChange: 15.2,
                    percentChangeWeekly: 8.5,
                    percentChangeMonthly: 15.2,
                    percentChangeYearly: 42.1
                },
                holdings: [
                    { athlete: 'LeBron James', shares: 45, avgPrice: 1850 },
                    { athlete: 'Patrick Mahomes', shares: 25, avgPrice: 2100 },
                    { athlete: 'Cristiano Ronaldo', shares: 60, avgPrice: 1200 }
                ]
            },
            {
                name: 'Maria Garcia',
                username: 'maria_investor',
                email: 'maria@example.com',
                password: 'password123',
                accountBalance: 8200,
                portfolio: {
                    isPublic: true,
                    initialValue: 112000,
                    percentChange: 22.8,
                    percentChangeWeekly: 12.3,
                    percentChangeMonthly: 22.8,
                    percentChangeYearly: 67.5
                },
                holdings: [
                    { athlete: 'Stephen Curry', shares: 55, avgPrice: 1650 },
                    { athlete: 'Tom Brady', shares: 30, avgPrice: 1950 },
                    { athlete: 'Lionel Messi', shares: 70, avgPrice: 1100 },
                    { athlete: 'Serena Williams', shares: 40, avgPrice: 850 }
                ]
            },
            {
                name: 'James Wilson',
                username: 'sports_fan_james',
                email: 'james@example.com',
                password: 'password123',
                accountBalance: 22000,
                portfolio: {
                    isPublic: true,
                    initialValue: 98000,
                    percentChange: 18.4,
                    percentChangeWeekly: 6.7,
                    percentChangeMonthly: 18.4,
                    percentChangeYearly: 52.3
                },
                holdings: [
                    { athlete: 'Brock Purdy', shares: 50, avgPrice: 600 },
                    { athlete: 'Ryan Williams', shares: 100, avgPrice: 18 },
                    { athlete: 'Elena Petrova', shares: 80, avgPrice: 35 }
                ]
            },
            {
                name: 'Lisa Chen',
                username: 'portfolio_lisa',
                email: 'lisa@example.com',
                password: 'password123',
                accountBalance: 35000,
                portfolio: {
                    isPublic: true,
                    initialValue: 145000,
                    percentChange: -5.6,
                    percentChangeWeekly: -2.1,
                    percentChangeMonthly: -5.6,
                    percentChangeYearly: -8.2
                },
                holdings: [
                    { athlete: 'Caitlin Clark', shares: 200, avgPrice: 10 },
                    { athlete: 'Tahaad Pettiford', shares: 150, avgPrice: 11 },
                    { athlete: 'Javier "El Fuego" Rios', shares: 80, avgPrice: 50 },
                    { athlete: 'Kenji Tanaka', shares: 100, avgPrice: 42 }
                ]
            },
            {
                name: 'David Miller',
                username: 'david_stocks',
                email: 'david@example.com',
                password: 'password123',
                accountBalance: 18500,
                portfolio: {
                    isPublic: true,
                    initialValue: 78000,
                    percentChange: 12.1,
                    percentChangeWeekly: 4.8,
                    percentChangeMonthly: 12.1,
                    percentChangeYearly: 35.7
                },
                holdings: [
                    { athlete: 'Carlo Emilion', shares: 100, avgPrice: 230 },
                    { athlete: 'Daniel Jay Park', shares: 80, avgPrice: 190 },
                    { athlete: 'Mark Rojas', shares: 60, avgPrice: 445 }
                ]
            }
        ];
        
        for (const userData of sampleUsers) {
            try {
                // Check if user already exists
                const existingUser = await User.findOne({ username: userData.username });
                if (existingUser) {
                    console.log(`User ${userData.username} already exists, updating portfolio...`);
                    
                    // Update portfolio data
                    existingUser.portfolio = userData.portfolio;
                    existingUser.accountBalance = userData.accountBalance;
                    
                    // Clear existing ownership and add new holdings
                    existingUser.ownership.clear();
                    let totalValue = 0;
                    let totalShares = 0;
                    
                    for (const holding of userData.holdings) {
                        const athlete = athletes.find(a => a.name === holding.athlete);
                        if (athlete) {
                            existingUser.ownership.set(holding.athlete, holding.shares);
                            totalValue += holding.shares * athlete.currentPrice;
                            totalShares += holding.shares;
                        }
                    }
                    
                    existingUser.portfolio.totalValue = totalValue;
                    existingUser.portfolio.totalShares = totalShares;
                    existingUser.portfolio.lastCalculated = new Date();
                    
                    await existingUser.save();
                    console.log(`✅ Updated ${userData.username} - Portfolio: $${totalValue.toLocaleString()}, Performance: ${userData.portfolio.percentChange}%`);
                } else {
                    // Create new user
                    const newUser = new User({
                        name: userData.name,
                        username: userData.username,
                        email: userData.email,
                        password: userData.password,
                        accountBalance: userData.accountBalance,
                        portfolio: userData.portfolio
                    });
                    
                    // Add holdings
                    let totalValue = 0;
                    let totalShares = 0;
                    
                    for (const holding of userData.holdings) {
                        const athlete = athletes.find(a => a.name === holding.athlete);
                        if (athlete) {
                            newUser.ownership.set(holding.athlete, holding.shares);
                            totalValue += holding.shares * athlete.currentPrice;
                            totalShares += holding.shares;
                        }
                    }
                    
                    newUser.portfolio.totalValue = totalValue;
                    newUser.portfolio.totalShares = totalShares;
                    newUser.portfolio.lastCalculated = new Date();
                    
                    await newUser.save();
                    console.log(`✅ Created ${userData.username} - Portfolio: $${totalValue.toLocaleString()}, Performance: ${userData.portfolio.percentChange}%`);
                }
            } catch (userError) {
                console.error(`❌ Error processing user ${userData.username}:`, userError.message);
            }
        }
        
        console.log('✅ Portfolio data seeding completed!');
        
        // Show summary
        const allUsers = await User.find({ 'portfolio.totalValue': { $gt: 0 } })
            .select('username name portfolio.totalValue portfolio.percentChangeMonthly portfolio.isPublic');
        
        console.log('\n📊 Summary of users with portfolios:');
        allUsers.forEach(user => {
            const visibility = user.portfolio.isPublic ? 'Public' : 'Private';
            console.log(`${user.username}: $${user.portfolio.totalValue.toLocaleString()} (${user.portfolio.percentChangeMonthly}%) - ${visibility}`);
        });
        
    } catch (error) {
        console.error('❌ Error seeding portfolio data:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the script
seedPortfolioData();