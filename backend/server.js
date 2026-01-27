// server.js - Node.js backend for FanScout App with MongoDB
const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/database');
const errorHandler = require('./middleware/error');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

// Import models
const User = require('./models/user');
const Athlete = require('./models/athlete');
const Transaction = require('./models/transaction');
const Conversation = require('./models/message');
const Post = require('./models/post');
const Comment = require('./models/comment');
const Notification = require('./models/notification');

// Import middleware
const { protect } = require('./middleware/auth');
const { 
    authValidation, 
    transactionValidation, 
    messageValidation, 
    ownershipValidation,
    queryValidation 
} = require('./middleware/validation');

// Import controllers
const authController = require('./controllers/auth-controller');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN?.split(',') || '*',
        credentials: true
    }
});

const PORT = process.env.PORT || 3000;

// Helper function to create notifications
async function createNotification(notificationData) {
    try {
        const notification = await Notification.createNotification(notificationData);
        if (notification) {
            // Emit real-time notification via WebSocket to the recipient
            io.to(notification.recipient.toString()).emit('new-notification', notification.toNotificationObject());
            return notification;
        }
    } catch (error) {
        console.error('Error creating notification:', error);
    }
    return null;
}

// Middleware
app.use(cors({
    origin: (origin, callback) => callback(null, true),
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend/assets'))); // Serve frontend assets

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../frontend/assets/uploads/'))
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname))
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: function (req, file, cb) {
        // Check file type - allow images and videos
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image and video files are allowed!'), false);
        }
    }
});

// Socket.IO Authentication Middleware
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('No token provided'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
    } catch (error) {
        next(new Error('Invalid token'));
    }
};

// Socket.IO Connection Handling
io.use(authenticateSocket);

io.on('connection', (socket) => {
    console.log('User connected:', socket.user.username);
    
    // Join user to their own room for private messages
    socket.join(socket.userId);
    
    // Handle joining conversation rooms
    socket.on('join-conversation', (conversationId) => {
        socket.join(`conversation-${conversationId}`);
        console.log(`User ${socket.user.username} joined conversation ${conversationId}`);
    });
    
    // Handle leaving conversation rooms
    socket.on('leave-conversation', (conversationId) => {
        socket.leave(`conversation-${conversationId}`);
        console.log(`User ${socket.user.username} left conversation ${conversationId}`);
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.username);
    });
});

// Auth routes
app.post('/api/auth/register', authValidation.register, authController.register);
app.post('/api/auth/login', authValidation.login, authController.login);
app.get('/api/auth/me', protect, authController.getMe);
app.put('/api/auth/updatedetails', protect, authValidation.updateDetails, authController.updateDetails);
app.put('/api/auth/updatepassword', protect, authController.updatePassword);
app.post('/api/auth/logout', protect, authController.logout);

// User follow/unfollow routes
app.post('/api/users/follow/:username', protect, async (req, res, next) => {
    try {
        const targetUser = await User.findOne({ username: req.params.username });
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const currentUser = await User.findById(req.user.id);
        
        // Don't allow following yourself
        if (targetUser._id.toString() === currentUser._id.toString()) {
            return res.status(400).json({ success: false, error: 'Cannot follow yourself' });
        }

        // Check if already following
        if (currentUser.following.includes(targetUser._id)) {
            return res.status(400).json({ success: false, error: 'Already following this user' });
        }

        // Add to following and followers
        currentUser.following.push(targetUser._id);
        targetUser.followers.push(currentUser._id);

        await currentUser.save();
        await targetUser.save();

        // Create notification for new follow
        await createNotification({
            recipient: targetUser._id,
            actor: currentUser._id,
            type: 'new_follow',
            action: 'started following you',
            target: {
                targetType: 'User',
                targetId: currentUser._id
            }
        });

        res.json({ success: true, message: 'User followed successfully' });
    } catch (err) {
        next(err);
    }
});

app.post('/api/users/unfollow/:username', protect, async (req, res, next) => {
    try {
        const targetUser = await User.findOne({ username: req.params.username });
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const currentUser = await User.findById(req.user.id);

        // Check if not following
        if (!currentUser.following.includes(targetUser._id)) {
            return res.status(400).json({ success: false, error: 'Not following this user' });
        }

        // Remove from following and followers
        currentUser.following = currentUser.following.filter(id => id.toString() !== targetUser._id.toString());
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUser._id.toString());

        await currentUser.save();
        await targetUser.save();

        res.json({ success: true, message: 'User unfollowed successfully' });
    } catch (err) {
        next(err);
    }
});

// Search users by username
app.get('/api/users/search/:query', protect, async (req, res, next) => {
    try {
        const { query } = req.params;
        const users = await User.find({
            username: { $regex: query, $options: 'i' }
        }).limit(10).select('username name avatar');

        res.json({ success: true, data: users });
    } catch (err) {
        next(err);
    }
});

// Get users for leaderboard
app.get('/api/users/leaderboard', protect, async (req, res, next) => {
    try {
        console.log('Leaderboard endpoint called by user:', req.user?.username || 'unknown');
        console.log('Request user ID:', req.user?.id || req.user?._id);
        const { limit = 50, sortBy = 'performance' } = req.query;
        
        // Get all users with public portfolios
        let users = await User.find({})
            .select('username name avatar portfolio accountBalance createdAt isActive')
            .limit(parseInt(limit) * 2);
            
        console.log(`Found ${users.length} total users for leaderboard`);
        
        // Filter for public portfolios (default to public if not set)
        users = users.filter(user => user.portfolio?.isPublic !== false);
        console.log(`After privacy filter: ${users.length} users`);

        // Update portfolio stats for all users and filter those with portfolios
        const usersWithMetrics = [];
        for (const user of users) {
            try {
                await updatePortfolioStats(user);
                await user.save();
            } catch (updateError) {
                console.error(`Error updating portfolio stats for user ${user.username}:`, updateError);
                continue;
            }

            const portfolioValue = user.portfolio?.totalValue || 0;
            if (portfolioValue > 0) {
                usersWithMetrics.push({
                    _id: user._id,
                    username: user.username,
                    name: user.name,
                    avatar: user.avatar,
                    portfolioValue: portfolioValue,
                    performancePercent: user.portfolio?.percentChangeMonthly || 0,
                    percentChangeWeekly: user.portfolio?.percentChangeWeekly || 0,
                    percentChangeMonthly: user.portfolio?.percentChangeMonthly || 0,
                    percentChangeYearly: user.portfolio?.percentChangeYearly || 0,
                    accountBalance: user.accountBalance,
                    createdAt: user.createdAt,
                    rank: 0
                });
            }
        }

        // If there are too few users, create some sample users for demonstration
        if (usersWithMetrics.length < 10) {
            const sampleUsers = [
                { username: 'alex_trader', name: 'Alex Thompson', portfolioValue: 125000, performance: 15.2 },
                { username: 'maria_investor', name: 'Maria Garcia', portfolioValue: 198000, performance: 22.8 },
                { username: 'sports_fan_james', name: 'James Wilson', portfolioValue: 156000, performance: 18.4 },
                { username: 'portfolio_lisa', name: 'Lisa Chen', portfolioValue: 187000, performance: -5.6 },
                { username: 'david_stocks', name: 'David Miller', portfolioValue: 142000, performance: 12.1 },
                { username: 'emily_pro', name: 'Emily Johnson', portfolioValue: 176000, performance: 9.3 },
                { username: 'robert_trader', name: 'Robert Taylor', portfolioValue: 192000, performance: 25.7 },
                { username: 'jessica_investor', name: 'Jessica Davis', portfolioValue: 168000, performance: -2.1 },
                { username: 'michael_fan', name: 'Michael Brown', portfolioValue: 134000, performance: 7.8 },
                { username: 'amanda_stocks', name: 'Amanda White', portfolioValue: 215000, performance: 31.2 },
                { username: 'john_pro', name: 'John Smith', portfolioValue: 189000, performance: 19.5 },
                { username: 'sarah_trader', name: 'Sarah Johnson', portfolioValue: 203000, performance: 14.3 },
                { username: 'mike_investor', name: 'Mike Davis', portfolioValue: 178000, performance: 6.7 },
                { username: 'emma_fan', name: 'Emma Wilson', portfolioValue: 234000, performance: 28.9 },
                { username: 'kevin_stocks', name: 'Kevin Lee', portfolioValue: 167000, performance: 11.2 }
            ];

            sampleUsers.forEach(sampleUser => {
                if (!usersWithMetrics.find(u => u.username === sampleUser.username)) {
                    usersWithMetrics.push({
                        _id: `sample_${sampleUser.username}`,
                        username: sampleUser.username,
                        name: sampleUser.name,
                        avatar: 'images/image_48fb0979.png',
                        portfolioValue: sampleUser.portfolioValue,
                        performancePercent: sampleUser.performance,
                        percentChangeWeekly: sampleUser.performance * 0.7,
                        percentChangeMonthly: sampleUser.performance,
                        percentChangeYearly: sampleUser.performance * 2.5,
                        accountBalance: 10000,
                        createdAt: new Date(),
                        rank: 0
                    });
                }
            });
        }

        // Sort by the specified criteria
        if (sortBy === 'value') {
            usersWithMetrics.sort((a, b) => b.portfolioValue - a.portfolioValue);
        } else {
            usersWithMetrics.sort((a, b) => b.performancePercent - a.performancePercent);
        }

        // Set ranks and limit results
        const finalResults = usersWithMetrics
            .slice(0, parseInt(limit))
            .map((user, index) => ({ ...user, rank: index + 1 }));

        res.json({ success: true, data: finalResults });
    } catch (err) {
        console.error('Leaderboard error:', err);
        if (err.message && err.message.includes('User not found')) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        next(err);
    }
});

// Get following users for leaderboard
app.get('/api/users/following/leaderboard', protect, async (req, res, next) => {
    try {
        const { sortBy = 'performance' } = req.query;
        const currentUser = await User.findById(req.user.id)
            .populate('following', 'username name avatar portfolio accountBalance createdAt');

        let followingUsers = [];

        // Get real following users and update their portfolio stats
        if (currentUser && currentUser.following && currentUser.following.length > 0) {
            console.log(`Current user follows ${currentUser.following.length} users`);
            for (const followedUser of currentUser.following) {
                // Only include users with public portfolios
                if (followedUser.portfolio?.isPublic !== false) {
                    try {
                        await updatePortfolioStats(followedUser);
                        await followedUser.save();
                        followingUsers.push(followedUser);
                        console.log(`Added following user: ${followedUser.username} with portfolio value: ${followedUser.portfolio?.totalValue}`);
                    } catch (error) {
                        console.error(`Error updating stats for following user ${followedUser.username}:`, error);
                    }
                }
            }
        } else {
            console.log('Current user has no following users');
        }

        // If there are fewer than 3 following users, add some sample users for demonstration
        if (followingUsers.length < 3) {
            const sampleFollowing = [
                { username: 'trader_alex', name: 'Alex Thompson', portfolioValue: 125000, performance: 18.3 },
                { username: 'maria_investor', name: 'Maria Garcia', portfolioValue: 98000, performance: 12.7 },
                { username: 'sports_fan_james', name: 'James Wilson', portfolioValue: 156000, performance: 24.1 },
                { username: 'portfolio_lisa', name: 'Lisa Chen', portfolioValue: 87000, performance: -3.2 },
                { username: 'david_stocks', name: 'David Miller', portfolioValue: 142000, performance: 16.8 }
            ];

            // Add sample users to simulate people you might be following
            const combinedUsers = [...followingUsers];
            sampleFollowing.slice(0, 5 - followingUsers.length).forEach(sampleUser => {
                combinedUsers.push({
                    _id: `sample_following_${sampleUser.username}`,
                    username: sampleUser.username,
                    name: sampleUser.name,
                    avatar: 'images/image_48fb0979.png',
                    portfolio: { 
                        totalValue: sampleUser.portfolioValue,
                        percentChangeMonthly: sampleUser.performance,
                        percentChangeWeekly: sampleUser.performance * 0.6,
                        percentChangeYearly: sampleUser.performance * 3.2,
                        isPublic: true
                    },
                    accountBalance: 10000
                });
            });
            followingUsers = combinedUsers;
        }

        // Add performance metrics to following users
        const followingWithMetrics = followingUsers.map((user, index) => {
            const portfolioValue = user.portfolio?.totalValue || 0;
            
            return {
                _id: user._id,
                username: user.username,
                name: user.name,
                avatar: user.avatar,
                portfolioValue: portfolioValue,
                performancePercent: user.portfolio?.percentChangeMonthly || 0,
                percentChangeWeekly: user.portfolio?.percentChangeWeekly || 0,
                percentChangeMonthly: user.portfolio?.percentChangeMonthly || 0,
                percentChangeYearly: user.portfolio?.percentChangeYearly || 0,
                accountBalance: user.accountBalance,
                rank: 0
            };
        });

        // Sort by the specified criteria
        if (sortBy === 'value') {
            followingWithMetrics.sort((a, b) => b.portfolioValue - a.portfolioValue);
        } else {
            followingWithMetrics.sort((a, b) => b.performancePercent - a.performancePercent);
        }

        // Set ranks
        followingWithMetrics.forEach((user, index) => user.rank = index + 1);

        res.json({ success: true, data: followingWithMetrics });
    } catch (err) {
        next(err);
    }
});

// Update portfolio privacy settings
app.patch('/api/portfolio/privacy', protect, async (req, res, next) => {
    try {
        const { isPublic } = req.body;
        
        if (typeof isPublic !== 'boolean') {
            return res.status(400).json({
                success: false,
                error: 'isPublic must be a boolean value'
            });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        user.portfolio.isPublic = isPublic;
        await user.save();

        res.json({
            success: true,
            data: {
                isPublic: user.portfolio.isPublic,
                message: `Portfolio is now ${isPublic ? 'public' : 'private'}`
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get user profile with follow status
app.get('/api/users/:username', protect, async (req, res, next) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .populate('followers', 'username name avatar')
            .populate('following', 'username name avatar');
            
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const currentUser = await User.findById(req.user.id);
        const isFollowing = currentUser.following.includes(user._id);
        const isFollower = user.following.includes(currentUser._id);

        res.json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                username: user.username,
                avatar: user.avatar,
                followersCount: user.followers.length,
                followingCount: user.following.length,
                followers: user.followers.map(follower => ({
                    id: follower._id,
                    name: follower.name,
                    username: follower.username,
                    avatar: follower.avatar
                })),
                following: user.following.map(following => ({
                    id: following._id,
                    name: following.name,
                    username: following.username,
                    avatar: following.avatar
                })),
                isFollowing,
                isFollower,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        next(err);
    }
});

// Profile picture upload
app.post('/api/auth/upload-avatar', protect, upload.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Update user's avatar path in database
        const avatarPath = `uploads/${req.file.filename}`;
        const user = await User.findByIdAndUpdate(
            req.user.id, 
            { avatar: avatarPath }, 
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            data: {
                avatar: avatarPath,
                user: user
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get all athletes with filtering
app.get('/api/athletes', queryValidation.filter, async (req, res, next) => {
    try {
        const { sport, minPrice, maxPrice, sortBy = 'name', order = 'asc' } = req.query;
        
        // Build filter
        const filter = {};
        if (sport && sport !== 'all') filter.sport = sport;
        if (minPrice || maxPrice) {
            filter.currentPrice = {};
            if (minPrice) filter.currentPrice.$gte = parseFloat(minPrice);
            if (maxPrice) filter.currentPrice.$lte = parseFloat(maxPrice);
        }

        // Build sort
        const sortOptions = {};
        if (sortBy === 'marketCap') {
            // Sort by virtual field requires aggregation
            const athletes = await Athlete.aggregate([
                { $match: filter },
                { 
                    $addFields: { 
                        marketCap: { $multiply: ['$currentPrice', '$quantity'] } 
                    } 
                },
                { $sort: { marketCap: order === 'asc' ? 1 : -1 } }
            ]);
            return res.json(athletes);
        } else {
            const sortField = sortBy === 'change' ? 'dailyChangePercent' : sortBy;
            sortOptions[sortField] = order === 'asc' ? 1 : -1;
        }

        const athletes = await Athlete.find(filter).sort(sortOptions);
        res.json(athletes);
    } catch (err) {
        next(err);
    }
});

// Get single athlete by name
app.get('/api/athletes/:name', async (req, res, next) => {
    try {
        const athlete = await Athlete.findOne({ name: req.params.name });
        if (!athlete) {
            return res.status(404).json({ success: false, error: 'Athlete not found' });
        }
        res.json(athlete);
    } catch (err) {
        next(err);
    }
});

// Get ownership data for authenticated user
app.get('/api/ownership', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        const ownership = Object.fromEntries(user.ownership);
        res.json(ownership);
    } catch (err) {
        next(err);
    }
});

// Update ownership (buy/sell shares)
app.post('/api/ownership', protect, ownershipValidation.update, async (req, res, next) => {
    try {
        const { athleteName, quantity, type } = req.body;
        const user = await User.findById(req.user.id);
        
        const currentOwnership = user.ownership.get(athleteName) || 0;
        let newQuantity;

        if (type === 'buy') {
            newQuantity = currentOwnership + quantity;
        } else if (type === 'sell') {
            newQuantity = Math.max(0, currentOwnership - quantity);
            if (quantity > currentOwnership) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Insufficient shares' 
                });
            }
        }

        user.ownership.set(athleteName, newQuantity);
        await user.save();

        res.json({ success: true, newQuantity });
    } catch (err) {
        next(err);
    }
});

// Create new conversation with user
app.post('/api/messages/new', protect, async (req, res, next) => {
    try {
        const { username } = req.body;
        
        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is required' });
        }

        const targetUser = await User.findOne({ username });
        if (!targetUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        if (targetUser._id.toString() === req.user.id) {
            return res.status(400).json({ success: false, error: 'Cannot message yourself' });
        }

        // Check if conversation already exists
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user.id, targetUser._id] },
            conversationType: 'user-to-user'
        }).populate('participants', 'username name avatar');

        if (!conversation) {
            // Create new conversation
            conversation = await Conversation.create({
                participants: [req.user.id, targetUser._id],
                conversationType: 'user-to-user',
                messages: []
            });
            
            conversation = await conversation.populate('participants', 'username name avatar');
        }

        const otherParticipant = conversation.participants.find(
            p => p._id.toString() !== req.user.id
        );

        const formatted = {
            id: conversation._id,
            name: otherParticipant.name,
            username: otherParticipant.username,
            avatar: otherParticipant.avatar || 'images/image_48fb0979.png',
            lastMessage: conversation.lastMessage,
            time: getRelativeTime(conversation.lastMessageTime),
            unread: false,
            messages: conversation.messages
        };

        res.json({ success: true, data: formatted });
    } catch (err) {
        next(err);
    }
});

// Get messages/conversations for authenticated user
app.get('/api/messages', protect, async (req, res, next) => {
    try {
        const conversations = await Conversation.find({ 
            participants: req.user.id 
        })
        .populate('participants', 'username name avatar')
        .populate('athleteId', 'name avatar')
        .sort('-lastMessageTime');

        // Format for frontend
        const formattedConversations = conversations.map(conv => {
            if (conv.conversationType === 'user-to-user') {
                const otherParticipant = conv.participants.find(
                    p => p._id.toString() !== req.user.id
                );
                
                return {
                    id: conv._id,
                    name: otherParticipant?.name || 'Unknown',
                    username: otherParticipant?.username,
                    avatar: otherParticipant?.avatar || 'images/image_48fb0979.png',
                    lastMessage: conv.lastMessage,
                    time: getRelativeTime(conv.lastMessageTime),
                    unread: conv.unreadCount.get(req.user.id) > 0,
                    messages: conv.messages,
                    conversationType: 'user-to-user'
                };
            } else {
                // Legacy athlete conversations
                return {
                    id: conv._id,
                    name: conv.athleteId?.name || 'Unknown',
                    avatar: conv.athleteId?.avatar || 'images/image_48fb0979.png',
                    lastMessage: conv.lastMessage,
                    time: getRelativeTime(conv.lastMessageTime),
                    unread: conv.unreadCount.get(req.user.id) > 0,
                    messages: conv.messages,
                    conversationType: 'user-to-athlete'
                };
            }
        });

        res.json(formattedConversations);
    } catch (err) {
        next(err);
    }
});

// Get single message thread
app.get('/api/messages/:id', protect, async (req, res, next) => {
    try {
        const conversation = await Conversation.findById(req.params.id)
            .populate('participants', 'name avatar')
            .populate('athleteId', 'name avatar');
            
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Check if user is a participant (convert ObjectIds to strings for comparison)
        const userIsParticipant = conversation.participants.some(p => p._id.toString() === req.user.id);
        if (!userIsParticipant) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Mark as read
        conversation.unreadCount.set(req.user.id, 0);
        await conversation.save();

        const otherParticipant = conversation.participants.find(
            p => p._id.toString() !== req.user.id
        );

        const formatted = {
            id: conversation._id,
            name: otherParticipant?.name || conversation.athleteId?.name || 'Unknown',
            avatar: otherParticipant?.avatar || conversation.athleteId?.avatar || 'images/image_48fb0979.png',
            lastMessage: conversation.lastMessage,
            time: getRelativeTime(conversation.lastMessageTime),
            unread: false,
            messages: conversation.messages
        };

        res.json(formatted);
    } catch (err) {
        next(err);
    }
});

// Send a message
app.post('/api/messages/:id', protect, messageValidation.send, async (req, res, next) => {
    try {
        const conversation = await Conversation.findById(req.params.id);
        
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Check if user is a participant (convert ObjectIds to strings for comparison)
        const userIsParticipant = conversation.participants.some(p => p.toString() === req.user.id);
        if (!userIsParticipant) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        const { text, offer } = req.body;
        const newMessage = {
            text,
            sender: req.user.id,
            sent: true,
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            ...(offer && { offer })
        };

        conversation.messages.push(newMessage);
        
        // Update unread count for other participants
        conversation.participants.forEach(participantId => {
            if (participantId.toString() !== req.user.id) {
                const currentUnread = conversation.unreadCount.get(participantId) || 0;
                conversation.unreadCount.set(participantId, currentUnread + 1);
            }
        });

        await conversation.save();

        // Create notifications for message recipients
        for (const participantId of conversation.participants) {
            if (participantId.toString() !== req.user.id) {
                // Check if message contains an offer
                if (offer && typeof offer === 'object') {
                    // Create offer-specific notification
                    await createNotification({
                        recipient: participantId,
                        actor: req.user.id,
                        type: 'offer_received',
                        action: `sent you a ${offer.type} offer`,
                        target: {
                            targetType: 'Message',
                            targetId: newMessage._id
                        },
                        data: {
                            messagePreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                            conversationId: conversation._id,
                            offerDetails: {
                                type: offer.type,
                                price: offer.price,
                                quantity: offer.quantity,
                                total: offer.total,
                                athlete: offer.athlete
                            }
                        }
                    });
                } else {
                    // Create regular message notification
                    await createNotification({
                        recipient: participantId,
                        actor: req.user.id,
                        type: 'message',
                        action: 'sent you a message',
                        target: {
                            targetType: 'Message',
                            targetId: newMessage._id
                        },
                        data: {
                            messagePreview: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
                            conversationId: conversation._id
                        }
                    });
                }
            }
        }

        // Broadcast message to all participants in real-time
        conversation.participants.forEach(participantId => {
            if (participantId.toString() !== req.user.id) {
                // Send to specific user
                io.to(participantId.toString()).emit('new-message', {
                    conversationId: conversation._id,
                    message: newMessage,
                    conversation: {
                        id: conversation._id,
                        lastMessage: conversation.lastMessage,
                        lastMessageTime: conversation.lastMessageTime,
                        unreadCount: conversation.unreadCount.get(participantId) || 0
                    }
                });
            }
        });

        // Also broadcast to conversation room
        io.to(`conversation-${conversation._id}`).emit('message-sent', {
            conversationId: conversation._id,
            message: newMessage
        });

        res.json({ success: true, message: newMessage });
    } catch (err) {
        next(err);
    }
});

// Accept an offer in a conversation
app.post('/api/messages/:conversationId/accept-offer/:messageId', protect, async (req, res, next) => {
    try {
        const { conversationId, messageId } = req.params;
        
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
            return res.status(404).json({ success: false, error: 'Conversation not found' });
        }

        // Check if user is a participant
        const userIsParticipant = conversation.participants.some(p => p.toString() === req.user.id);
        if (!userIsParticipant) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }

        // Find the message with the offer
        const message = conversation.messages.id(messageId);
        if (!message || !message.offer) {
            return res.status(404).json({ success: false, error: 'Offer not found' });
        }

        // Check if user is trying to accept their own offer
        if (message.sender.toString() === req.user.id) {
            return res.status(400).json({ success: false, error: 'Cannot accept your own offer' });
        }

        // Get the offer details
        const offer = message.offer;
        const athleteName = offer.athlete.replace(' Shares', '');
        const offerType = offer.type; // 'buy' or 'sell'
        const quantity = offer.quantity;
        const pricePerShare = parseFloat(offer.price.replace('$', ''));
        const totalAmount = parseFloat(offer.total.replace('$', ''));

        // Get both users
        const acceptingUser = await User.findById(req.user.id);
        const offeringUser = await User.findById(message.sender);

        if (!acceptingUser || !offeringUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Get athlete info for validation
        const athlete = await require('./models/athlete').findOne({ name: athleteName });
        if (!athlete) {
            return res.status(404).json({ success: false, error: 'Athlete not found' });
        }

        // Execute the trade based on offer type
        if (offerType === 'buy') {
            // Offering user wants to BUY shares from accepting user
            const acceptingUserShares = acceptingUser.ownership.get(athleteName) || 0;
            
            // Check if accepting user has enough shares to sell
            if (acceptingUserShares < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Insufficient shares. You only have ${acceptingUserShares} shares of ${athleteName}` 
                });
            }
            
            // Check if offering user has enough balance
            if (offeringUser.accountBalance < totalAmount) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Offering user has insufficient balance' 
                });
            }
            
            // Execute transfer: accepting user sells shares to offering user
            acceptingUser.ownership.set(athleteName, acceptingUserShares - quantity);
            acceptingUser.accountBalance += totalAmount;
            
            const offeringUserShares = offeringUser.ownership.get(athleteName) || 0;
            offeringUser.ownership.set(athleteName, offeringUserShares + quantity);
            offeringUser.accountBalance -= totalAmount;
            
        } else if (offerType === 'sell') {
            // Offering user wants to SELL shares to accepting user
            const offeringUserShares = offeringUser.ownership.get(athleteName) || 0;
            
            // Check if offering user has enough shares to sell
            if (offeringUserShares < quantity) {
                return res.status(400).json({ 
                    success: false, 
                    error: 'Offering user has insufficient shares' 
                });
            }
            
            // Check if accepting user has enough balance
            if (acceptingUser.accountBalance < totalAmount) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Insufficient balance. You need $${totalAmount.toFixed(2)} but only have $${acceptingUser.accountBalance.toFixed(2)}` 
                });
            }
            
            // Execute transfer: accepting user buys shares from offering user
            const acceptingUserShares = acceptingUser.ownership.get(athleteName) || 0;
            acceptingUser.ownership.set(athleteName, acceptingUserShares + quantity);
            acceptingUser.accountBalance -= totalAmount;
            
            offeringUser.ownership.set(athleteName, offeringUserShares - quantity);
            offeringUser.accountBalance += totalAmount;
        }

        // Update portfolio stats for both users
        await updatePortfolioStats(acceptingUser);
        await updatePortfolioStats(offeringUser);

        // Save both users
        await acceptingUser.save();
        await offeringUser.save();

        // Add confirmation message to conversation
        const confirmationMessage = {
            text: `Offer accepted! ${quantity} shares of ${athleteName} transferred for $${totalAmount.toFixed(2)}`,
            sender: req.user.id,
            sent: true,
            time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        };

        conversation.messages.push(confirmationMessage);
        await conversation.save();

        // Broadcast to all participants
        conversation.participants.forEach(participantId => {
            io.to(participantId.toString()).emit('offer-accepted', {
                conversationId: conversation._id,
                message: confirmationMessage,
                tradeDetails: {
                    athleteName,
                    quantity,
                    totalAmount,
                    type: offerType,
                    acceptedBy: acceptingUser.username || acceptingUser.name
                }
            });
        });

        res.json({ 
            success: true, 
            message: 'Offer accepted successfully',
            tradeDetails: {
                athleteName,
                quantity,
                totalAmount,
                type: offerType
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get transaction history
app.get('/api/transactions', protect, queryValidation.pagination, async (req, res, next) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (page - 1) * limit;

        const transactions = await Transaction.find({ user: req.user.id })
            .populate('athlete', 'name')
            .sort('-date')
            .limit(limit)
            .skip(skip);

        res.json(transactions);
    } catch (err) {
        next(err);
    }
});

// Add new transaction
app.post('/api/transactions', protect, transactionValidation.create, async (req, res, next) => {
    try {
        console.log('Transaction request body:', req.body); // Debug log
        const { athleteName, type, quantity, pricePerShare } = req.body;
        
        // Find athlete
        const athlete = await Athlete.findOne({ name: athleteName });
        if (!athlete) {
            return res.status(404).json({ success: false, error: 'Athlete not found' });
        }

        // Check user's ownership for sell transactions
        const user = await User.findById(req.user.id);
        const currentOwnership = user.ownership.get(athleteName) || 0;

        if (type === 'sell' && quantity > currentOwnership) {
            return res.status(400).json({ 
                success: false, 
                error: 'Insufficient shares to sell' 
            });
        }

        // Create transaction
        const transaction = await Transaction.create({
            user: req.user.id,
            athleteName,
            athlete: athlete._id,
            type,
            quantity,
            pricePerShare
        });

        // Update user ownership
        if (type === 'buy') {
            user.ownership.set(athleteName, currentOwnership + quantity);
        } else {
            user.ownership.set(athleteName, currentOwnership - quantity);
        }

        // Update portfolio stats
        await updatePortfolioStats(user);
        await user.save();

        res.json({ 
            success: true, 
            transaction: await transaction.populate('athlete', 'name') 
        });
    } catch (err) {
        next(err);
    }
});

// Get portfolio statistics
app.get('/api/portfolio/stats', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        const athletes = await Athlete.find();
        
        let totalValue = 0;
        let totalShares = 0;
        let totalValueOneMonthAgo = 0;

        for (const [athleteName, shares] of user.ownership || new Map()) {
            if (shares > 0) {
                const athlete = athletes.find(a => a.name === athleteName);
                if (athlete) {
                    totalShares += shares;
                    totalValue += shares * athlete.currentPrice;
                    
                    // Calculate value one month ago
                    const pastPrice = athlete.m1?.data?.[0] || athlete.currentPrice;
                    totalValueOneMonthAgo += shares * pastPrice;
                }
            }
        }

        const valueChangePercent = totalValueOneMonthAgo > 0 
            ? ((totalValue - totalValueOneMonthAgo) / totalValueOneMonthAgo) * 100 
            : 0;

        // Update portfolio stats first
        await updatePortfolioStats(user);
        await user.save();

        res.json({
            totalShares,
            totalValue,
            valueChangePercent,
            sharesChangePercent: 33, // You can calculate this based on transaction history
            accountBalance: user.accountBalance || 0,
            percentChange: user.portfolio.percentChange || 0,
            percentChangeWeekly: user.portfolio.percentChangeWeekly || 0,
            percentChangeMonthly: user.portfolio.percentChangeMonthly || 0,
            percentChangeYearly: user.portfolio.percentChangeYearly || 0,
            isPublic: user.portfolio.isPublic
        });
    } catch (err) {
        next(err);
    }
});

// Get portfolio history
app.get('/api/portfolio/history/:range', protect, async (req, res, next) => {
    try {
        const { range } = req.params;
        const user = await User.findById(req.user.id);
        const ownedAthletes = [];
        
        // Get all owned athletes
        for (const [athleteName, shares] of user.ownership || new Map()) {
            if (shares > 0) {
                const athlete = await Athlete.findOne({ name: athleteName });
                if (athlete) {
                    ownedAthletes.push({ athlete, shares });
                }
            }
        }

        if (ownedAthletes.length === 0 || !ownedAthletes[0].athlete[range]) {
            return res.json({ labels: [], values: [] });
        }

        const historyData = ownedAthletes[0].athlete[range];
        const portfolioValues = new Array(historyData.data.length).fill(0);

        ownedAthletes.forEach(({ athlete, shares }) => {
            const athleteHistory = athlete[range].data;
            for (let i = 0; i < athleteHistory.length; i++) {
                portfolioValues[i] += athleteHistory[i] * shares;
            }
        });

        res.json({ labels: historyData.labels, values: portfolioValues });
    } catch (err) {
        next(err);
    }
});

// POST ROUTES - Social Media Functionality

// Create a new post
app.post('/api/posts', protect, upload.array('media', 5), async (req, res, next) => {
    try {
        const { text, visibility = 'public' } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Post text is required' 
            });
        }

        const media = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
                media.push({
                    type: mediaType,
                    url: `uploads/${file.filename}`,
                    thumbnail: mediaType === 'video' ? `uploads/thumb_${file.filename}` : null
                });
            }
        }

        const post = new Post({
            author: req.user.id,
            content: { text: text.trim(), media },
            visibility
        });

        await post.save();
        await post.populate('author', 'username name avatar');

        // Create notifications for followers about new post
        const user = await User.findById(req.user.id);
        for (const followerId of user.followers) {
            await createNotification({
                recipient: followerId,
                actor: req.user.id,
                type: 'new_post',
                action: 'posted something new',
                target: {
                    targetType: 'Post',
                    targetId: post._id
                },
                data: {
                    postPreview: post.content.text.substring(0, 50) + (post.content.text.length > 50 ? '...' : '')
                }
            });
        }

        // Broadcast new post to followers via WebSocket
        user.followers.forEach(followerId => {
            io.to(followerId.toString()).emit('new-post', {
                post: {
                    _id: post._id,
                    content: post.content,
                    author: {
                        _id: post.author._id,
                        username: post.author.username,
                        name: post.author.name,
                        avatar: post.author.avatar
                    },
                    metrics: post.metrics,
                    isLikedBy: false,
                    createdAt: post.createdAt
                }
            });
        });

        res.status(201).json({ 
            success: true, 
            data: post 
        });
    } catch (err) {
        next(err);
    }
});

// Get social feed (following + recommended)
app.get('/api/posts/feed', protect, async (req, res, next) => {
    try {
        const { type = 'following', page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        const user = await User.findById(req.user.id);

        let posts;
        
        if (type === 'following') {
            // Get posts from users I'm following
            posts = await Post.find({
                author: { $in: user.following },
                visibility: { $in: ['public', 'followers'] }
            })
            .populate('author', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        } else if (type === 'recommended') {
            // Get most liked posts from all users
            posts = await Post.find({
                visibility: 'public'
            })
            .populate('author', 'username name avatar')
            .sort({ 'metrics.likes': -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        } else {
            // Get all public posts (explore)
            posts = await Post.find({
                visibility: 'public'
            })
            .populate('author', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        }

        // Add user-specific data (isLikedBy)
        const postsWithUserData = posts.map(post => ({
            _id: post._id,
            content: post.content,
            author: post.author,
            metrics: post.metrics,
            isLikedBy: post.isLikedBy(req.user.id),
            createdAt: post.createdAt,
            updatedAt: post.updatedAt
        }));

        res.json({ 
            success: true, 
            data: postsWithUserData,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                hasMore: posts.length === parseInt(limit)
            }
        });
    } catch (err) {
        next(err);
    }
});

// Get single post with comments
app.get('/api/posts/:id', protect, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id)
            .populate('author', 'username name avatar');
            
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        // Get comments for this post
        const comments = await Comment.find({ 
            post: req.params.id, 
            parentComment: null 
        })
        .populate('author', 'username name avatar')
        .sort({ createdAt: 1 });

        // Add user-specific data
        const postWithUserData = {
            _id: post._id,
            content: post.content,
            author: post.author,
            metrics: post.metrics,
            isLikedBy: post.isLikedBy(req.user.id),
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            comments: comments.map(comment => ({
                _id: comment._id,
                content: comment.content,
                author: comment.author,
                metrics: comment.metrics,
                isLikedBy: comment.isLikedBy(req.user.id),
                createdAt: comment.createdAt
            }))
        };

        res.json({ 
            success: true, 
            data: postWithUserData 
        });
    } catch (err) {
        next(err);
    }
});

// Update a post
app.put('/api/posts/:id', protect, async (req, res, next) => {
    try {
        const { text } = req.body;
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        // Check if user owns the post
        if (post.author.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Not authorized to edit this post' 
            });
        }

        post.content.text = text.trim();
        post.isEdited = true;
        post.editedAt = new Date();
        
        await post.save();
        await post.populate('author', 'username name avatar');

        res.json({ 
            success: true, 
            data: post 
        });
    } catch (err) {
        next(err);
    }
});

// Delete a post
app.delete('/api/posts/:id', protect, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        // Check if user owns the post
        if (post.author.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Not authorized to delete this post' 
            });
        }

        await post.remove();

        res.json({ 
            success: true, 
            message: 'Post deleted successfully' 
        });
    } catch (err) {
        next(err);
    }
});

// Like/unlike a post
app.post('/api/posts/:id/like', protect, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        const isLiked = post.toggleLike(req.user.id);
        await post.save();

        // Create notification for post like (only if it's a new like, not unlike)
        if (isLiked && post.author.toString() !== req.user.id) {
            await post.populate('author', 'username name avatar');
            await createNotification({
                recipient: post.author._id,
                actor: req.user.id,
                type: 'post_liked',
                action: 'liked your post',
                target: {
                    targetType: 'Post',
                    targetId: post._id
                },
                data: {
                    postPreview: post.content.text ? post.content.text.substring(0, 50) + (post.content.text.length > 50 ? '...' : '') : 'your post'
                }
            });
        }

        // Broadcast like update via WebSocket
        io.to(`post-${req.params.id}`).emit('post-liked', {
            postId: req.params.id,
            likesCount: post.metrics.likes,
            isLiked
        });

        res.json({ 
            success: true, 
            data: { 
                isLiked, 
                likesCount: post.metrics.likes 
            } 
        });
    } catch (err) {
        next(err);
    }
});

// Share a post
app.post('/api/posts/:id/share', protect, async (req, res, next) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        post.addShare(req.user.id);
        await post.save();

        res.json({ 
            success: true, 
            data: { 
                sharesCount: post.metrics.shares 
            } 
        });
    } catch (err) {
        next(err);
    }
});

// COMMENT ROUTES

// Create a comment on a post
app.post('/api/posts/:id/comments', protect, async (req, res, next) => {
    try {
        const { text, parentCommentId } = req.body;
        
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Comment text is required' 
            });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ 
                success: false, 
                error: 'Post not found' 
            });
        }

        const comment = new Comment({
            post: req.params.id,
            author: req.user.id,
            content: { text: text.trim() },
            parentComment: parentCommentId || null
        });

        await comment.save();
        await comment.populate('author', 'username name avatar');

        // Create notification for comment (notify post author or parent comment author)
        let notificationRecipient = null;
        let notificationType = 'post_comment';
        let notificationAction = 'commented on your post';

        if (parentCommentId) {
            // It's a reply to a comment
            const parentComment = await Comment.findById(parentCommentId).populate('author');
            if (parentComment && parentComment.author._id.toString() !== req.user.id) {
                notificationRecipient = parentComment.author._id;
                notificationType = 'comment_reply';
                notificationAction = 'replied to your comment';
            }
        } else {
            // It's a comment on a post
            await post.populate('author', 'username name avatar');
            if (post.author._id.toString() !== req.user.id) {
                notificationRecipient = post.author._id;
            }
        }

        if (notificationRecipient) {
            await createNotification({
                recipient: notificationRecipient,
                actor: req.user.id,
                type: notificationType,
                action: notificationAction,
                target: {
                    targetType: 'Comment',
                    targetId: comment._id
                },
                data: {
                    commentText: comment.content.text.substring(0, 50) + (comment.content.text.length > 50 ? '...' : ''),
                    postPreview: post.content.text ? post.content.text.substring(0, 30) + (post.content.text.length > 30 ? '...' : '') : 'a post'
                }
            });
        }

        // Broadcast new comment via WebSocket
        io.to(`post-${req.params.id}`).emit('new-comment', {
            comment: {
                _id: comment._id,
                content: comment.content,
                author: comment.author,
                metrics: comment.metrics,
                isLikedBy: false,
                createdAt: comment.createdAt,
                parentComment: comment.parentComment
            }
        });

        res.status(201).json({ 
            success: true, 
            data: comment 
        });
    } catch (err) {
        next(err);
    }
});

// Get comments for a post
app.get('/api/posts/:id/comments', protect, async (req, res, next) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;

        const comments = await Comment.find({ 
            post: req.params.id, 
            parentComment: null 
        })
        .populate('author', 'username name avatar')
        .populate({
            path: 'replies',
            populate: {
                path: 'author',
                select: 'username name avatar'
            }
        })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(parseInt(limit));

        const commentsWithUserData = comments.map(comment => ({
            _id: comment._id,
            content: comment.content,
            author: comment.author,
            metrics: comment.metrics,
            isLikedBy: comment.isLikedBy(req.user.id),
            replies: comment.replies.map(reply => ({
                _id: reply._id,
                content: reply.content,
                author: reply.author,
                metrics: reply.metrics,
                isLikedBy: reply.isLikedBy(req.user.id),
                createdAt: reply.createdAt
            })),
            createdAt: comment.createdAt
        }));

        res.json({ 
            success: true, 
            data: commentsWithUserData 
        });
    } catch (err) {
        next(err);
    }
});

// Like/unlike a comment
app.post('/api/comments/:id/like', protect, async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                error: 'Comment not found' 
            });
        }

        const isLiked = comment.toggleLike(req.user.id);
        await comment.save();

        // Create notification for comment like (only if it's a new like, not unlike)
        if (isLiked && comment.author.toString() !== req.user.id) {
            await comment.populate('author', 'username name avatar');
            await createNotification({
                recipient: comment.author._id,
                actor: req.user.id,
                type: 'comment_liked',
                action: 'liked your comment',
                target: {
                    targetType: 'Comment',
                    targetId: comment._id
                },
                data: {
                    commentText: comment.content.text.substring(0, 50) + (comment.content.text.length > 50 ? '...' : '')
                }
            });
        }

        // Broadcast like update via WebSocket
        io.to(`post-${comment.post}`).emit('comment-liked', {
            commentId: req.params.id,
            likesCount: comment.metrics.likes,
            isLiked
        });

        res.json({ 
            success: true, 
            data: { 
                isLiked, 
                likesCount: comment.metrics.likes 
            } 
        });
    } catch (err) {
        next(err);
    }
});

// Delete a comment
app.delete('/api/comments/:id', protect, async (req, res, next) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ 
                success: false, 
                error: 'Comment not found' 
            });
        }

        // Check if user owns the comment
        if (comment.author.toString() !== req.user.id) {
            return res.status(403).json({ 
                success: false, 
                error: 'Not authorized to delete this comment' 
            });
        }

        await comment.remove();

        res.json({ 
            success: true, 
            message: 'Comment deleted successfully' 
        });
    } catch (err) {
        next(err);
    }
});

// Search posts and users
app.get('/api/search', protect, async (req, res, next) => {
    try {
        const { q: query, type = 'all', page = 1, limit = 20 } = req.query;
        const skip = (page - 1) * limit;
        
        if (!query || query.trim().length === 0) {
            return res.status(400).json({ 
                success: false, 
                error: 'Search query is required' 
            });
        }

        const results = {};

        if (type === 'all' || type === 'users') {
            // Search users
            const users = await User.find({
                $or: [
                    { username: { $regex: query, $options: 'i' } },
                    { name: { $regex: query, $options: 'i' } }
                ]
            })
            .select('username name avatar')
            .limit(parseInt(limit));

            results.users = users;
        }

        if (type === 'all' || type === 'posts') {
            // Search posts
            const posts = await Post.find({
                'content.text': { $regex: query, $options: 'i' },
                visibility: 'public'
            })
            .populate('author', 'username name avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

            results.posts = posts.map(post => ({
                _id: post._id,
                content: post.content,
                author: post.author,
                metrics: post.metrics,
                isLikedBy: post.isLikedBy(req.user.id),
                createdAt: post.createdAt
            }));
        }

        res.json({ 
            success: true, 
            data: results 
        });
    } catch (err) {
        next(err);
    }
});

// ======================
// NOTIFICATION ENDPOINTS
// ======================

// Get user notifications
app.get('/api/notifications', protect, async (req, res, next) => {
    try {
        const { page = 1, limit = 20, type, unread } = req.query;
        const skip = (page - 1) * limit;
        
        // Build query
        const query = { recipient: req.user.id };
        
        // Filter by type if specified
        if (type) {
            query.type = type;
        }
        
        // Filter by read status if specified
        if (unread === 'true') {
            query.isRead = false;
        }
        
        // Get notifications with pagination
        const notifications = await Notification.find(query)
            .populate('actor', 'username name avatar')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip(skip);
        
        // Get total count for pagination
        const total = await Notification.countDocuments(query);
        
        // Format notifications for frontend
        const formattedNotifications = notifications.map(notification => 
            notification.toNotificationObject()
        );
        
        res.json({
            success: true,
            data: formattedNotifications,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total,
                hasNext: skip + notifications.length < total,
                hasPrev: page > 1
            },
            unreadCount: await Notification.countDocuments({ 
                recipient: req.user.id, 
                isRead: false 
            })
        });
        
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to fetch notifications' 
        });
        next(err);
    }
});

// Mark notification as read
app.put('/api/notifications/:id/read', protect, async (req, res, next) => {
    try {
        // Validate notification ID
        const notificationId = req.params.id;
        if (!notificationId || notificationId === 'undefined' || notificationId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID'
            });
        }
        
        const notification = await Notification.findOne({
            _id: notificationId,
            recipient: req.user.id
        });
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }
        
        await notification.markAsRead();
        
        res.json({
            success: true,
            data: notification.toNotificationObject()
        });
        
    } catch (err) {
        console.error('Mark notification as read error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark notification as read' 
        });
        next(err);
    }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', protect, async (req, res, next) => {
    try {
        const result = await Notification.updateMany(
            { 
                recipient: req.user.id, 
                isRead: false 
            },
            { 
                isRead: true, 
                readAt: new Date() 
            }
        );
        
        res.json({
            success: true,
            data: {
                markedCount: result.modifiedCount
            }
        });
        
    } catch (err) {
        console.error('Mark all notifications as read error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to mark all notifications as read' 
        });
        next(err);
    }
});

// Delete notification
app.delete('/api/notifications/:id', protect, async (req, res, next) => {
    try {
        // Validate notification ID
        const notificationId = req.params.id;
        if (!notificationId || notificationId === 'undefined' || notificationId === 'null') {
            return res.status(400).json({
                success: false,
                error: 'Invalid notification ID'
            });
        }
        
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: req.user.id
        });
        
        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }
        
        res.json({
            success: true,
            data: { deleted: true }
        });
        
    } catch (err) {
        console.error('Delete notification error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to delete notification' 
        });
        next(err);
    }
});

// Get unread notification count
app.get('/api/notifications/unread-count', protect, async (req, res, next) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false
        });
        
        res.json({
            success: true,
            data: { count }
        });
        
    } catch (err) {
        console.error('Get unread count error:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to get unread count' 
        });
        next(err);
    }
});

// Helper functions

function getRelativeTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
}

async function updatePortfolioStats(user) {
    if (!user) {
        throw new Error('User not found');
    }
    
    const athletes = await Athlete.find();
    let totalValue = 0;
    let totalShares = 0;

    // Calculate current portfolio value
    const ownership = user.ownership || new Map();
    if (ownership instanceof Map) {
        for (const [athleteName, shares] of ownership) {
            if (shares > 0) {
                const athlete = athletes.find(a => a.name === athleteName);
                if (athlete) {
                    totalShares += shares;
                    totalValue += shares * athlete.currentPrice;
                }
            }
        }
    } else if (ownership && typeof ownership === 'object') {
        // Handle case where ownership is a plain object
        for (const [athleteName, shares] of Object.entries(ownership)) {
            if (shares > 0) {
                const athlete = athletes.find(a => a.name === athleteName);
                if (athlete) {
                    totalShares += shares;
                    totalValue += shares * athlete.currentPrice;
                }
            }
        }
    }

    // Set initial value if this is the first calculation
    if (user.portfolio.initialValue === 0 && totalValue > 0) {
        user.portfolio.initialValue = totalValue;
    }

    // Calculate percent changes
    await calculatePortfolioPerformance(user, athletes);

    user.portfolio.totalValue = totalValue;
    user.portfolio.totalShares = totalShares;
    user.portfolio.lastCalculated = new Date();
}

async function calculatePortfolioPerformance(user, athletes) {
    if (!user.ownership || (user.ownership instanceof Map && user.ownership.size === 0) || Object.keys(user.ownership).length === 0) {
        user.portfolio.percentChange = 0;
        user.portfolio.percentChangeWeekly = 0;
        user.portfolio.percentChangeMonthly = 0;
        user.portfolio.percentChangeYearly = 0;
        return;
    }

    let currentValue = 0;
    let weeklyValue = 0;
    let monthlyValue = 0;
    let yearlyValue = 0;

    const ownership = user.ownership || new Map();
    
    if (ownership instanceof Map) {
        for (const [athleteName, shares] of ownership) {
            if (shares > 0) {
                const athlete = athletes.find(a => a.name === athleteName);
                if (athlete) {
                    currentValue += shares * athlete.currentPrice;
                    
                    // Calculate historical values
                    const weeklyPrice = athlete.d5?.data?.[0] || athlete.currentPrice;
                    const monthlyPrice = athlete.m1?.data?.[0] || athlete.currentPrice;
                    const yearlyPrice = athlete.y1?.data?.[0] || athlete.currentPrice;
                    
                    weeklyValue += shares * weeklyPrice;
                    monthlyValue += shares * monthlyPrice;
                    yearlyValue += shares * yearlyPrice;
                }
            }
        }
    } else if (ownership && typeof ownership === 'object') {
        for (const [athleteName, shares] of Object.entries(ownership)) {
            if (shares > 0) {
                const athlete = athletes.find(a => a.name === athleteName);
                if (athlete) {
                    currentValue += shares * athlete.currentPrice;
                    
                    // Calculate historical values
                    const weeklyPrice = athlete.d5?.data?.[0] || athlete.currentPrice;
                    const monthlyPrice = athlete.m1?.data?.[0] || athlete.currentPrice;
                    const yearlyPrice = athlete.y1?.data?.[0] || athlete.currentPrice;
                    
                    weeklyValue += shares * weeklyPrice;
                    monthlyValue += shares * monthlyPrice;
                    yearlyValue += shares * yearlyPrice;
                }
            }
        }
    }

    // Calculate percent changes
    if (user.portfolio.initialValue > 0) {
        user.portfolio.percentChange = ((currentValue - user.portfolio.initialValue) / user.portfolio.initialValue) * 100;
    }
    
    if (weeklyValue > 0) {
        user.portfolio.percentChangeWeekly = ((currentValue - weeklyValue) / weeklyValue) * 100;
    }
    
    if (monthlyValue > 0) {
        user.portfolio.percentChangeMonthly = ((currentValue - monthlyValue) / monthlyValue) * 100;
    }
    
    if (yearlyValue > 0) {
        user.portfolio.percentChangeYearly = ((currentValue - yearlyValue) / yearlyValue) * 100;
    }
}

// Serve index.html for all non-API routes (for client-side routing)
app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/assets/index.html'));
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
    console.log(`FanScout server running on http://localhost:${PORT} in ${process.env.NODE_ENV} mode`);
    console.log(`WebSocket server ready for real-time messaging`);
});