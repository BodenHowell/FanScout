#!/bin/bash

# FanScout Startup Script

echo "Starting FanScout Application..."

# 1. Verify MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "Error: MongoDB is not running."
    echo "Please run: brew services start mongodb-community"
    exit 1
fi

# 2. Setup Backend
cd backend

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Setup environment variables from example if missing
if [ ! -f ".env" ]; then
    if [ -f "../.env.example" ]; then
        echo "Creating .env from example file..."
        cp ../.env.example .env
    else
        # Fallback if example file is missing
        echo "Warning: .env.example not found. Creating default .env..."
        echo "PORT=3000" > .env
        echo "NODE_ENV=development" >> .env
        echo "MONGODB_URI=mongodb://localhost:27017/fanscout" >> .env
        echo "JWT_SECRET=dev-secret" >> .env
        echo "CORS_ORIGIN=http://localhost:3000" >> .env
    fi
fi

# 3. Database Check & Seed
# Checks if DB is empty and runs seed if necessary
node -e "
const mongoose = require('mongoose');
require('dotenv').config();
mongoose.connect(process.env.MONGODB_URI)
  .then(() => require('./models/athlete').countDocuments())
  .then(count => {
    console.log('Current athlete count:', count);
    process.exit(count > 0 ? 0 : 1);
  })
  .catch(() => process.exit(1));
" 2>/dev/null

if [ $? -eq 1 ]; then
    echo "Database appears empty. Seeding initial data..."
    node scripts/seed.js
fi

# 4. Start Server
echo "Server starting on port 3000..."
echo "Press Ctrl+C to stop."

npm start