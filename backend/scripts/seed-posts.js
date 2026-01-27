const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const connectDB = require('../config/database');
const User = require('../models/user');
const Post = require('../models/post');
const Comment = require('../models/comment');

// Sample post data
const samplePosts = [
    {
        text: "Just watched an incredible game! The way LeBron played in the 4th quarter was legendary 🏀 #NBA #LeBronJames",
        likes: 234,
        comments: 42,
        shares: 18,
        authorName: "SportsGuru23"
    },
    {
        text: "Tom Brady's performance this season has been absolutely phenomenal. The GOAT continues to prove why he's the greatest! 🐐 #NFL #TomBrady #GOAT",
        likes: 189,
        comments: 67,
        shares: 31,
        authorName: "FootballFan92"
    },
    {
        text: "Bought 500 shares of Patrick Mahomes today! 📈 This guy is going to dominate for years to come. Who else is bullish on KC? #PatrickMahomes #NFL",
        likes: 156,
        comments: 29,
        shares: 12,
        authorName: "InvestorPro"
    },
    {
        text: "Stephen Curry's 3-point shooting is just pure art. Watching him play is like watching poetry in motion 🎯 #StephenCurry #Warriors #NBA",
        likes: 298,
        comments: 81,
        shares: 45,
        authorName: "BasketballLover"
    },
    {
        text: "Aaron Rodgers with that Hail Mary! How does he keep pulling these off? The man is magic! ✨ #AaronRodgers #NFL #Packers",
        likes: 412,
        comments: 124,
        shares: 76,
        authorName: "PackersFan4Life"
    },
    {
        text: "Giannis Antetokounmpo is an absolute unit! The Greek Freak is unstoppable when he gets going 💪 #Giannis #Bucks #NBA",
        likes: 178,
        comments: 35,
        shares: 22,
        authorName: "MilwaukeeFan"
    },
    {
        text: "Josh Allen's arm strength is absolutely insane. That 60-yard bomb was a thing of beauty! 🚀 #JoshAllen #Bills #NFL",
        likes: 223,
        comments: 58,
        shares: 34,
        authorName: "BillsMafia"
    },
    {
        text: "Luka Dončić is the future of the NBA. This kid has skills that you just can't teach! 🔥 #LukaDoncic #Mavericks #NBA",
        likes: 267,
        comments: 71,
        shares: 41,
        authorName: "MavsNation"
    },
    {
        text: "Russell Wilson's leadership on and off the field is incredible. True champion mentality! 👑 #RussellWilson #NFL #Leadership",
        likes: 145,
        comments: 27,
        shares: 15,
        authorName: "SeahawksPride"
    },
    {
        text: "Ja Morant's athleticism is out of this world! That dunk tonight was absolutely nasty 🤯 #JaMorant #Grizzlies #NBA",
        likes: 334,
        comments: 89,
        shares: 52,
        authorName: "GrizzNation"
    },
    {
        text: "Cooper Kupp is having an MVP-caliber season! This guy is absolutely unstoppable in the slot 🏈 #CooperKupp #Rams #NFL",
        likes: 167,
        comments: 43,
        shares: 28,
        authorName: "RamsHouse"
    },
    {
        text: "Jayson Tatum's development has been incredible to watch. Future superstar right here! ⭐ #JaysonTatum #Celtics #NBA",
        likes: 201,
        comments: 56,
        shares: 33,
        authorName: "CelticsPride"
    }
];

// Sample comments data
const sampleComments = [
    "Absolutely agree! He's been phenomenal this season 🔥",
    "I'm not so sure about that, but he's definitely talented",
    "Best player in the league right now, no debate!",
    "Buying more shares tomorrow! 📈",
    "This guy is going to be a legend",
    "Solid investment choice! I'm in for 1000 shares",
    "Can't argue with those numbers!",
    "MVP for sure! 👑",
    "Trade of the century if you ask me",
    "Been following him since college, knew he'd be great!",
    "The stats don't lie! 📊",
    "Future Hall of Famer right there",
    "Incredible athlete, incredible person",
    "My portfolio thanks me for this pick!",
    "Best decision I made this year 💯"
];

const connectAndSeed = async () => {
    try {
        // Connect to database
        await connectDB();
        console.log('Connected to MongoDB');

        // Clear existing posts and comments
        await Post.deleteMany({});
        await Comment.deleteMany({});
        console.log('Cleared existing posts and comments');

        // Get all users
        const users = await User.find({}).limit(20);
        if (users.length === 0) {
            console.log('No users found. Please run the user seeding script first.');
            process.exit(1);
        }

        console.log(`Found ${users.length} users for seeding posts`);

        // Create posts
        const createdPosts = [];
        for (let i = 0; i < samplePosts.length; i++) {
            const postData = samplePosts[i];
            const randomUser = users[Math.floor(Math.random() * users.length)];
            
            const post = new Post({
                author: randomUser._id,
                content: {
                    text: postData.text,
                    media: []
                },
                metrics: {
                    likes: postData.likes,
                    comments: 0, // Will be updated when comments are added
                    shares: postData.shares
                },
                visibility: 'public',
                createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000) // Random time in last 7 days
            });

            // Add random users to likedBy array based on likes count
            const likersCount = Math.min(postData.likes, users.length);
            const likers = users.slice(0, likersCount).map(user => user._id);
            post.likedBy = likers;

            await post.save();
            createdPosts.push(post);
        }

        console.log(`Created ${createdPosts.length} posts`);

        // Create comments for posts
        let totalComments = 0;
        for (const post of createdPosts) {
            const originalPostData = samplePosts.find(p => p.text === post.content.text);
            const numComments = Math.min(originalPostData.comments, 15); // Limit to 15 comments per post
            
            for (let i = 0; i < numComments; i++) {
                const randomUser = users[Math.floor(Math.random() * users.length)];
                const randomCommentText = sampleComments[Math.floor(Math.random() * sampleComments.length)];
                
                const comment = new Comment({
                    post: post._id,
                    author: randomUser._id,
                    content: {
                        text: randomCommentText
                    },
                    metrics: {
                        likes: Math.floor(Math.random() * 50),
                        replies: 0
                    },
                    createdAt: new Date(post.createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) // Random time after post
                });

                // Add random likers to comment
                const commentLikersCount = Math.min(comment.metrics.likes, users.length);
                const commentLikers = users.slice(0, commentLikersCount).map(user => user._id);
                comment.likedBy = commentLikers;

                await comment.save();
                totalComments++;
            }

            // Update post comment count
            const actualCommentCount = await Comment.countDocuments({ post: post._id, parentComment: null });
            post.metrics.comments = actualCommentCount;
            await post.save();
        }

        console.log(`Created ${totalComments} comments`);

        // Create some following relationships
        for (const user of users.slice(0, 10)) { // First 10 users
            const randomFollows = users.slice(10, 15); // Follow users 10-15
            user.following = randomFollows.map(u => u._id);
            
            // Add this user to the followers list of the users they're following
            for (const followedUser of randomFollows) {
                if (!followedUser.followers.includes(user._id)) {
                    followedUser.followers.push(user._id);
                }
            }
            
            await user.save();
        }

        // Save all followed users
        for (const user of users.slice(10, 15)) {
            await user.save();
        }

        console.log('Created following relationships');

        console.log('✅ Seed data created successfully!');
        console.log(`📊 Summary:`);
        console.log(`   - Posts: ${createdPosts.length}`);
        console.log(`   - Comments: ${totalComments}`);
        console.log(`   - Users with posts: ${users.length}`);
        console.log(`   - Following relationships: 50`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
};

// Run seeding
connectAndSeed();