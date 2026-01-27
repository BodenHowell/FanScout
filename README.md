# FanScout 


## Key Features

### **Portfolio & Trading**
- **Athlete Investment**: Buy and sell shares in professional athletes across multiple sports
- **Portfolio Management**: Track your investments with real-time valuations and performance metrics
- **Price History**: Detailed price charts with multiple timeframes (1D, 5D, 1M, 6M, YTD, 1Y)
- **Performance Analytics**: Weekly, monthly, and yearly performance tracking
- **Transaction History**: Complete record of all buying and selling activities
- **Market Data**: Real-time pricing with daily changes and after-hours trading

### **Real-Time Messaging**
- **User-to-User Chat**: Direct messaging between platform users
- **User-to-Athlete Messaging**: Communication with athlete profiles
- **Offer System**: Send and receive trading offers through messages
- **WebSocket Integration**: Instant message delivery and real-time updates
- **Message Persistence**: All conversations stored and synchronized across devices

### **Social Features**
- **Social Feed**: Share posts, images, and videos with the community
- **Follow System**: Follow other users and see their activity
- **Comments & Likes**: Engage with posts through comments and reactions
- **User Profiles**: Customizable profiles with avatar uploads
- **Search**: Find users, posts, and athletes across the platform

### **Leaderboards & Competition**
- **Global Leaderboard**: Rankings based on portfolio performance
- **Following Leaderboard**: Track performance of users you follow
- **Multiple Sorting**: Sort by portfolio value, gains, or performance percentage
- **Real-Time Updates**: Live ranking updates as portfolios change

### **Notifications & Activity**
- **Real-Time Notifications**: Instant alerts for messages, offers, and social activity
- **Activity Feed**: Comprehensive activity tracking and filtering
- **Push Notifications**: WebSocket-powered real-time updates
- **Notification Management**: Mark as read, filter by type, and manage preferences

## Technical Architecture

### **Frontend**
- **Framework**: Vanilla JavaScript (ES6+) Single Page Application
- **Styling**: Pure CSS with modern layouts (Grid, Flexbox)
- **Design System**: iOS-inspired design with CSS custom properties
- **Responsive**: Mobile-first design with desktop optimization
- **Real-Time**: WebSocket integration for live updates

### **Backend**
- **Runtime**: Node.js with Express.js framework
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT token-based authentication with bcrypt password hashing
- **Real-Time**: Socket.IO for WebSocket connections
- **File Handling**: Multer for image/video uploads
- **API**: RESTful API design with comprehensive error handling

### **Database Schema**
- **Users**: Complete user profiles with portfolio tracking and social features
- **Athletes**: Athlete data with market information and price history
- **Messages**: Conversation and message management with offer support
- **Posts**: Social media posts with engagement metrics
- **Comments**: Threaded comment system with reply support
- **Notifications**: Comprehensive notification system
- **Transactions**: Complete trading history and analytics

## Quick Start

### Prerequisites
- **Node.js** (>= 14.0.0)
- **npm** (>= 6.0.0)
- **MongoDB** (running locally or cloud instance)

## Project Structure

```
Fanscout/
├── backend/                    # Node.js backend
│   ├── config/
│   │   └── database.js        # MongoDB connection
│   ├── controllers/
│   │   └── auth-controller.js # Authentication logic
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   ├── error.js          # Error handling
│   │   └── validation.js     # Input validation
│   ├── models/               # Mongoose schemas
│   │   ├── user.js          # User model
│   │   ├── athlete.js       # Athlete model
│   │   ├── message.js       # Messaging system
│   │   ├── post.js          # Social posts
│   │   ├── comment.js       # Comment system
│   │   ├── notification.js  # Notifications
│   │   └── transaction.js   # Trading transactions
│   ├── scripts/             # Database utilities
│   │   ├── seed.js          # Data seeding
│   │   └── *.js             # Various utility scripts
│   ├── package.json         # Backend dependencies
│   └── server.js            # Main server file
├── frontend/
│   └── assets/
│       ├── index.html       # Single page application
│       ├── js/
│       │   └── app.js       # Main frontend logic
│       ├── images/          # Static assets
│       └── uploads/         # User uploads
├── package.json             # Root package file
├── start.sh                 # Startup script
└── README.md               # This file
```

##  API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/updatedetails` - Update user details
- `PUT /api/auth/updatepassword` - Update password
- `POST /api/auth/logout` - User logout
- `POST /api/auth/upload-avatar` - Upload profile picture

### Users & Social
- `POST /api/users/follow/:username` - Follow user
- `POST /api/users/unfollow/:username` - Unfollow user
- `GET /api/users/search/:query` - Search users
- `GET /api/users/leaderboard` - Global leaderboard
- `GET /api/users/following/leaderboard` - Following leaderboard
- `GET /api/users/:username` - Get user profile

### Athletes & Trading
- `GET /api/athletes` - Get all athletes (with filtering)
- `GET /api/athletes/:name` - Get single athlete
- `GET /api/ownership` - Get user ownership
- `POST /api/ownership` - Buy/sell shares

### Portfolio & Transactions
- `GET /api/portfolio/stats` - Portfolio statistics
- `GET /api/portfolio/history/:range` - Portfolio history
- `PATCH /api/portfolio/privacy` - Update privacy settings
- `GET /api/transactions` - Transaction history
- `POST /api/transactions` - Create transaction

### Messaging
- `POST /api/messages/new` - Create conversation
- `GET /api/messages` - Get conversations
- `GET /api/messages/:id` - Get conversation details
- `POST /api/messages/:id` - Send message
- `POST /api/messages/:conversationId/accept-offer/:messageId` - Accept offer

### Social Posts
- `POST /api/posts` - Create post
- `GET /api/posts/feed` - Get social feed
- `GET /api/posts/:id` - Get single post
- `PUT /api/posts/:id` - Update post
- `DELETE /api/posts/:id` - Delete post
- `POST /api/posts/:id/like` - Like/unlike post
- `POST /api/posts/:id/share` - Share post

### Comments
- `POST /api/posts/:id/comments` - Create comment
- `GET /api/posts/:id/comments` - Get comments
- `POST /api/comments/:id/like` - Like/unlike comment
- `DELETE /api/comments/:id` - Delete comment

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/unread-count` - Get unread count

### Search
- `GET /api/search` - Search posts and users

##  Core Features Deep Dive

### Trading System
- **Multi-Sport Support**: NFL, NBA, NCAA Football/Basketball, Soccer, F1, Tennis, UFC, Golf, Track, MLB, NHL
- **Real-Time Pricing**: Dynamic price updates with daily change tracking
- **Portfolio Analytics**: Comprehensive performance metrics and historical data
- **Offer System**: Peer-to-peer trading through the messaging system

### Social Platform
- **Activity Feeds**: Following-based and recommended content feeds
- **Engagement**: Like, comment, and share functionality
- **User Discovery**: Search and follow users across the platform
- **Content Creation**: Text posts with image/video support

### Real-Time Features
- **WebSocket Integration**: Instant messaging and live updates
- **Push Notifications**: Real-time alerts for all platform activities
- **Live Data**: Portfolio values and prices update in real-time
- **Collaborative Trading**: Real-time offer negotiation


##  Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for secure password storage
- **Input Validation**: Comprehensive validation using express-validator
- **CORS Protection**: Configurable CORS for API security
- **File Upload Security**: Secure file handling with type restrictions
- **WebSocket Authentication**: Authenticated real-time connections

##  Database Models

### User Schema
- Personal information and authentication
- Portfolio tracking and performance metrics
- Social connections (followers/following)
- Account balance and ownership tracking

### Athlete Schema
- Athlete profiles and biographical information
- Market data with price history
- Sport categorization and statistics
- Real-time pricing and change tracking

### Messaging System
- Conversation management for user-to-user and user-to-athlete chats
- Message threading with offer support
- Unread count tracking and real-time delivery

### Social Features
- Post creation with media support
- Comment threading and reply systems
- Like/share tracking and engagement metrics
- Notification system for all social interactions

##  Advanced Features

### Real-Time Portfolio Updates
- Live portfolio value calculations
- Real-time price change notifications
- Dynamic leaderboard updates
- Instant transaction confirmations

### Sophisticated Messaging
- Rich message content with offer attachments
- Real-time delivery confirmations
- Conversation management and organization
- Offer acceptance/rejection workflow

### Social Engagement
- Advanced notification system with multiple types
- Content discovery and recommendation algorithms
- User-generated content with moderation capabilities
- Community features and interaction tracking

##  Performance Optimizations

- **Database Indexing**: Optimized queries with strategic indexes
- **Efficient WebSocket Management**: Connection pooling and room-based messaging
- **Client-Side Caching**: LocalStorage for offline capabilities
- **Lazy Loading**: On-demand data loading for better performance
- **Responsive Design**: Mobile-first approach with desktop scaling

