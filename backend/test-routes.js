// Test script to verify routes are working after restart
const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3000/api';

async function testRoutes() {
    console.log('🧪 Testing Route Fixes...\n');
    
    try {
        // Test 1: Login
        console.log('1️⃣ Testing Login...');
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'alex@example.com',
                password: 'password123'
            })
        });
        
        const loginData = await loginResponse.json();
        if (!loginData.success) {
            console.log('❌ Login failed:', loginData.error);
            return;
        }
        
        console.log('✅ Login successful');
        const token = loginData.token;
        
        // Test 2: Global Leaderboard (should work now)
        console.log('\n2️⃣ Testing Global Leaderboard Route...');
        const globalResponse = await fetch(`${API_BASE_URL}/users/leaderboard?limit=3`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Global leaderboard status:', globalResponse.status);
        const globalData = await globalResponse.json();
        
        if (globalData.success && globalData.data) {
            console.log('✅ Global leaderboard working!');
            globalData.data.forEach((user, i) => {
                console.log(`  ${i+1}. ${user.name}: $${user.portfolioValue?.toLocaleString() || 'N/A'} (${user.performancePercent?.toFixed(1) || 'N/A'}%)`);
            });
        } else {
            console.log('❌ Global leaderboard error:', globalData.error);
        }
        
        // Test 3: Following Leaderboard
        console.log('\n3️⃣ Testing Following Leaderboard Route...');
        const followingResponse = await fetch(`${API_BASE_URL}/users/following/leaderboard`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Following leaderboard status:', followingResponse.status);
        const followingData = await followingResponse.json();
        
        if (followingData.success) {
            console.log('✅ Following leaderboard working!');
            if (followingData.data.length > 0) {
                followingData.data.forEach((user, i) => {
                    console.log(`  ${i+1}. ${user.name}: $${user.portfolioValue?.toLocaleString() || 'N/A'} (${user.performancePercent?.toFixed(1) || 'N/A'}%)`);
                });
            } else {
                console.log('  No following users (expected for this test)');
            }
        } else {
            console.log('❌ Following leaderboard error:', followingData.error);
        }
        
        // Test 4: User Profile Route (make sure it doesn't conflict)
        console.log('\n4️⃣ Testing User Profile Route (should not conflict)...');
        const profileResponse = await fetch(`${API_BASE_URL}/users/alex_trader`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        console.log('Profile route status:', profileResponse.status);
        const profileData = await profileResponse.json();
        
        if (profileData.success) {
            console.log('✅ User profile route working!');
            console.log(`  User: ${profileData.data.name} (@${profileData.data.username})`);
        } else {
            console.log('❌ User profile error:', profileData.error);
        }
        
        console.log('\n🎉 Route testing completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run tests
testRoutes();