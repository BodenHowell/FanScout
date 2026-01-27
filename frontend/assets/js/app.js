// script.js - Updated to use Node.js API
document.addEventListener('DOMContentLoaded', () => {
    
    // API Base URL - Update this to match your server
    const API_BASE_URL = 'http://localhost:3000/api';

    //========================================
    //          AUTHENTICATION LOGIC
    //========================================
    let authToken = localStorage.getItem('authToken');
    let currentUser = null;
    let accountBalance = parseFloat(localStorage.getItem('fanscout_balance')) || 10000; // Start with $10,000 for testing
    
    // Save initial balance if not already stored
    if (!localStorage.getItem('fanscout_balance')) {
        localStorage.setItem('fanscout_balance', accountBalance.toString());
    }

    // Check if user is authenticated
    async function checkAuth() {
        if (!authToken) {
            showAuthModal();
            return false;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                currentUser = userData.data;
                // Initialize WebSocket connection for authenticated user
                initializeWebSocket();
                // Update balance display on login
                updateBalanceDisplay();
                // Update dashboard stats
                updateDashboardStats();
                // Don't show auth modal if user is authenticated
                return true;
            } else {
                localStorage.removeItem('authToken');
                authToken = null;
                disconnectWebSocket();
                showAuthModal();
                return false;
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            disconnectWebSocket();
            showAuthModal();
            return false;
        }
    }

    // Logout function
    function logout() {
        localStorage.removeItem('authToken');
        authToken = null;
        currentUser = null;
        messagesData = [];
        disconnectWebSocket();
        showAuthModal();
    }

    // Show auth modal
    function showAuthModal() {
        // Check if other modals are active
        const otherModalsActive = document.getElementById('modalOverlay').classList.contains('active') ||
                                 document.querySelectorAll('.modal.active, .chat-modal.active').length > 0;
        
        if (otherModalsActive) {
            return; // Don't show auth modal if other modals are active
        }
        
        const modal = document.getElementById('authModalOverlay');
        modal.classList.add('active');
        document.getElementById('authModalTitle').textContent = 'Login';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    }

    // Hide auth modal
    function hideAuthModal() {
        document.getElementById('authModalOverlay').classList.remove('active');
    }

    // Show register form
    window.showRegisterForm = function() {
        document.getElementById('authModalTitle').textContent = 'Register';
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    };

    // Show login form
    window.showLoginForm = function() {
        document.getElementById('authModalTitle').textContent = 'Login';
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    };

    // Close auth modal
    window.closeAuthModal = function() {
        hideAuthModal();
    };

    // Handle login form submission
    document.getElementById('loginFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                authToken = data.token;
                currentUser = data.user;
                window.currentUsername = data.user.username; // Store for leaderboard identification
                // Update profile display with user data
                if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
                localStorage.setItem('authToken', authToken);
                // Initialize WebSocket connection
                initializeWebSocket();
                hideAuthModal();
                // Clear any existing data and reload
                allAthletesData = [];
                ownershipData = {};
                transactionHistory = [];
                messagesData = [];
                loadInitialData(); // Reload data with authentication
            } else {
                const errorData = await response.json();
                alert('Login failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Login failed. Please try again.');
        }
    });

    // Handle register form submission
    document.getElementById('registerFormElement').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const username = document.getElementById('registerUsername').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, username, email, password })
            });
            
            if (response.ok) {
                const data = await response.json();
                authToken = data.token;
                currentUser = data.user;
                window.currentUsername = data.user.username; // Store for leaderboard identification
                // Update profile display with user data
                if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
                localStorage.setItem('authToken', authToken);
                hideAuthModal();
                // Clear any existing data and reload
                allAthletesData = [];
                ownershipData = {};
                transactionHistory = [];
                loadInitialData(); // Reload data with authentication
            } else {
                const errorData = await response.json();
                alert('Registration failed: ' + (errorData.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Registration error:', error);
            alert('Registration failed. Please try again.');
        }
    });

    // Update fetchData to include auth token
    async function fetchData(endpoint) {
        try {
            const headers = {};
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expired or invalid
                    localStorage.removeItem('authToken');
                    authToken = null;
                    showAuthModal();
                    return null;
                }
                throw new Error('API request failed');
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }

    //========================================
    //          WEBSOCKET LOGIC
    //========================================
    let socket = null;

    function initializeWebSocket() {
        if (authToken && !socket && typeof io !== 'undefined') {
            socket = io('http://localhost:3000', {
                auth: {
                    token: authToken
                }
            });

            socket.on('connect', () => {
            });

            socket.on('disconnect', () => {
            });

            socket.on('connect_error', (error) => {
                console.error('WebSocket connection error:', error);
            });

            // Listen for new messages
            socket.on('new-message', (data) => {
                handleNewMessage(data);
            });

            // Listen for message confirmations
            socket.on('message-sent', (data) => {
                // Optional: Handle message delivery confirmation
            });

            // Listen for offer accepted events
            socket.on('offer-accepted', (data) => {
                
                // Show notification
                const { tradeDetails } = data;
                alert(`Trade completed! ${tradeDetails.quantity} shares of ${tradeDetails.athleteName} transferred for $${tradeDetails.totalAmount.toFixed(2)}`);
                
                // Refresh chat if we're in the conversation
                if (currentChatUser && currentChatUser.id === data.conversationId) {
                    openChat(data.conversationId);
                }
                
                // Refresh messages list
                loadMessages();
                
                // Refresh portfolio data
                loadInitialData();
            });

            // Listen for real-time notifications from backend
            socket.on('new-notification', (data) => {
                console.log('🔔 Received new notification:', data);
                console.log('🔍 Notification type:', data.type);
                console.log('🔍 Button text:', data.buttonText);
                console.log('🔍 Category:', data.category);
                addNotification(data);
            });
        } else if (typeof io === 'undefined') {
            console.warn('Socket.IO client library not loaded. Real-time messaging will not work.');
        }
    }

    function disconnectWebSocket() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }

    function handleNewMessage(data) {
        // Update messages data with new message
        const { conversationId, message, conversation } = data;
        
        // Update the conversation in messagesData
        const convIndex = messagesData.findIndex(conv => conv.id === conversationId);
        if (convIndex !== -1) {
            messagesData[convIndex].messages.push(message);
            messagesData[convIndex].lastMessage = conversation.lastMessage;
            messagesData[convIndex].unread = conversation.unreadCount > 0;
            
            // Refresh messages list if we're on messages page
            if (document.querySelector('.messages-page.active')) {
                populateMessages();
            }
            
            // If we're in the conversation, refresh the chat
            if (currentChatUser && currentChatUser.id === conversationId) {
                openChat(conversationId);
            }
        }
    }

    function joinConversation(conversationId) {
        if (socket) {
            socket.emit('join-conversation', conversationId);
        }
    }

    function leaveConversation(conversationId) {
        if (socket) {
            socket.emit('leave-conversation', conversationId);
        }
    }

    // Update postData to include auth token
    async function postData(endpoint, data) {
        try {
            const headers = {
                'Content-Type': 'application/json',
            };
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem('authToken');
                    authToken = null;
                    showAuthModal();
                    return null;
                }
                // Get detailed error response
                const errorData = await response.json().catch(() => null);
                console.error('API Error Response:', errorData);
                return { success: false, error: `API request failed: ${response.status} ${response.statusText}`, ...errorData };
            }
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            return null;
        }
    }

    //========================================
    //          THEME TOGGLE LOGIC
    //========================================
    const darkModeToggle = document.getElementById('darkModeToggle');
    const body = document.body;

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            if (darkModeToggle) darkModeToggle.checked = false;
        }
    };

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                localStorage.setItem('theme', 'dark');
                applyTheme('dark');
            } else {
                localStorage.setItem('theme', 'light');
                applyTheme('light');
            }
        });
    }

    //========================================
    //          STATE & VARIABLES
    //========================================
    let allAthletesData = [];
    let ownershipData = {};
    let transactionHistory = [];
    let trendingAthletes = [];
    let leaderboardData = [];
    let selectedSportFilter = null;
    
    // Real notifications data - starts empty, populated from API and real-time events
    let notificationsData = [];

    // Keep the original activitiesData for backward compatibility
    const activitiesData = notificationsData;

    const pageContents = document.querySelectorAll('.page-content');
    const tabItems = document.querySelectorAll('.tab-item');

    //========================================
    //        API FUNCTIONS
    //========================================
    
    async function refreshData() {
        // Refresh data without changing current page
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            return; // Don't load data if not authenticated
        }

        // Load all data from API
        const [athletes, ownership, messages, transactions] = await Promise.all([
            fetchData('/athletes'),
            fetchData('/ownership'),
            fetchData('/messages'),
            fetchData('/transactions')
        ]);

        if (athletes) {
            allAthletesData = athletes;
            window.allAthletesData = athletes; // Make globally accessible
        }
        if (ownership) {
            // Merge API ownership with local ownership data
            const localOwnership = JSON.parse(localStorage.getItem('fanscout_ownership') || '{}');
            ownershipData = { ...ownership, ...localOwnership };
        } else {
            // Load from localStorage if API doesn't provide ownership data
            const localOwnership = JSON.parse(localStorage.getItem('fanscout_ownership') || '{}');
            ownershipData = localOwnership;
        }
        // if (messages) messagesData = messages; // Commented out to always use sample data
        if (transactions) transactionHistory = transactions;

        // Process data
        normalizeData();
        updateDashboardStats();
        // Preserve the active filter when refreshing
        const activeFilter = document.querySelector('.dashboard-page .pill.active')?.dataset.filter || 'portfolio';
        populateProspects(activeFilter);
        populateAthletes(trendingAthletes);
        filterOffers('all');
        filterActivities('all');
        
        // Initialize notifications
        initializeNotifications();
        
        // Initialize leaderboard
        initializeLeaderboard();
        setTimeout(async () => {
            await populateLeaderboard();
        }, 500);
        populateTransactionHistory();
        // Update profile display with loaded data
        if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
        // Note: No showPage() call - stay on current page
    }

    async function loadInitialData() {
        // Force hide modal overlay
        document.getElementById('modalOverlay').classList.remove('active');
        closeAllModals();
        // Check authentication first
        const isAuthenticated = await checkAuth();
        if (!isAuthenticated) {
            return; // Don't load data if not authenticated
        }

        // Hide auth modal if it's showing
        hideAuthModal();

        // Load all data from API
        const [athletes, ownership, messages, transactions] = await Promise.all([
            fetchData('/athletes'),
            fetchData('/ownership'),
            fetchData('/messages'),
            fetchData('/transactions')
        ]);

        if (athletes) {
            allAthletesData = athletes;
            window.allAthletesData = athletes; // Make globally accessible
        }
        if (ownership) {
            // Merge API ownership with local ownership data
            const localOwnership = JSON.parse(localStorage.getItem('fanscout_ownership') || '{}');
            ownershipData = { ...ownership, ...localOwnership };
        } else {
            // Load from localStorage if API doesn't provide ownership data
            const localOwnership = JSON.parse(localStorage.getItem('fanscout_ownership') || '{}');
            ownershipData = localOwnership;
        }
        if (messages) messagesData = messages;
        if (transactions) transactionHistory = transactions;

        // Process data
        normalizeData();
        updateDashboardStats();
        populateProspects();
        populateAthletes(trendingAthletes);
        filterOffers('all');
        filterActivities('all');
        populateLeaderboard();
        
        // Initialize notifications on first load
        initializeNotifications();
        
        // Initialize leaderboard
        initializeLeaderboard();
        setTimeout(async () => {
            await populateLeaderboard();
        }, 500);
        populateTransactionHistory();
        // Update profile display with loaded data
        if (typeof updateProfileDisplay === 'function') updateProfileDisplay();
        showPage('dashboard');
    }

    //========================================
    //        CORE APP FUNCTIONS
    //========================================

    function normalizeData() {
        trendingAthletes = allAthletesData.filter(athlete => !athlete.myProspect);
        leaderboardData = [...allAthletesData]
            .sort(() => 0.5 - Math.random())
            .slice(0, 10)
            .map(a => ({...a, name: a.name, image: a.avatar, percent: Math.floor(Math.random() * 25 + 5) }))
            .sort((a,b) => b.percent - a.percent);
    }

    function showPage(pageId) {
        pageContents.forEach(page => {
            page.classList.toggle('active', page.classList.contains(`${pageId}-page`));
        });

        // Hide user profile page when navigating to other pages
        const userProfilePage = document.getElementById('userProfilePage');
        if (userProfilePage) {
            userProfilePage.style.display = 'none';
        }

        const headerTitle = document.getElementById('headerTitle');
        const messagesBtn = document.getElementById('headerMessagesBtn');
        const profileBtn = document.getElementById('headerProfileBtn');

        if (messagesBtn) messagesBtn.style.display = 'block';
        if (profileBtn) profileBtn.style.display = 'block';

        // Auto-close chat window when switching away from messages
        if (pageId !== 'messages' && currentChatUser) {
            hideChatPage();
        }

        let title = 'FanScout';

        switch (pageId) {
            case 'explore':
                title = 'Explore';
                break;
            case 'offers':
                title = 'Offers';
                break;
            case 'activities':
                title = 'Activity';
                break;
            case 'leaderboard':
                title = 'Leaderboard';
                break;
            case 'messages':
                title = 'Messages';
                if (messagesBtn) messagesBtn.style.display = 'none';
                break;
            case 'account':
                title = 'Profile';
                if (profileBtn) profileBtn.style.display = 'none';
                break;
        }

        if (headerTitle) headerTitle.textContent = title;

        if (pageId === 'dashboard') {
            setTimeout(() => updatePortfolioChart('m1'), 50);
        } else if (pageId === 'messages') {
            populateMessages();
        } else if (pageId === 'activities') {
            // Initialize activities page with all notifications
            filterActivities('all');
            // Set the "all" filter as active
            document.querySelectorAll('.activities-page .pill').forEach(pill => {
                pill.classList.toggle('active', pill.dataset.filter === 'all');
            });
        } else if (pageId === 'explore') {
            setTimeout(() => {
                console.log('Explore page shown, checking authentication...');
                console.log('Current user:', currentUser);
                console.log('Auth token:', authToken);
                if (typeof initializeSocialFeed === 'function') {
                    initializeSocialFeed();
                } else {
                    console.error('initializeSocialFeed function not found!');
                }
            }, 100);
        }
    }

    function populateTransactionHistory() {
        const list = document.getElementById('transactionHistoryList');
        if (!list || !transactionHistory) {
            console.error("Transaction history list or data not found!");
            return;
        }

        list.innerHTML = '';
        const reversedHistory = [...transactionHistory].reverse();

        reversedHistory.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'transaction-item';

            const transactionDate = new Date(transaction.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            const itemHtml = `
                <div class="transaction-details">
                    <span style="text-transform: capitalize;">${transaction.type}</span>: ${transaction.quantity} shares of ${transaction.athleteName}
                    <div style="font-size: 12px; color: var(--color-text-secondary);">${transactionDate}</div>
                </div>
                <div class="transaction-amount ${transaction.type}">
                    $${(transaction.quantity * transaction.pricePerShare).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </div>
            `;

            item.innerHTML = itemHtml;
            list.appendChild(item);
        });
    }

    window.openModal = function(modalId) {
        console.log('openModal called with:', modalId);
        const modalOverlay = document.getElementById('modalOverlay');
        if (!modalOverlay) {
            console.error('modalOverlay not found');
            return;
        }
        
        // Make chat page non-interactive if it's active instead of hiding it
        const chatPage = document.getElementById('chatPage');
        if (chatPage && chatPage.style.display === 'flex') {
            chatPage.style.pointerEvents = 'none';
            // Store the fact that we need to restore the chat page interactivity
            modalOverlay.dataset.restoreChat = 'true';
        }
        
        // Hide all modals first
        const allModals = modalOverlay.querySelectorAll('.modal, .chat-modal');
        allModals.forEach(modal => modal.classList.remove('active'));
        // Show overlay and the requested modal
        modalOverlay.classList.add('active');
        modalOverlay.style.display = 'flex';
        const modalToOpen = document.getElementById(modalId);
        if (modalToOpen) {
            modalToOpen.classList.add('active');
            console.log('Modal opened successfully:', modalId);
        } else {
            console.error('Modal not found:', modalId);
        }
    };

    window.closeAllModals = function() {
        const modalOverlay = document.getElementById('modalOverlay');
        modalOverlay.classList.remove('active');
        modalOverlay.style.display = 'none';
        document.querySelectorAll('.modal.active, .chat-modal.active').forEach(m => m.classList.remove('active'));
        hideAuthModal();
        
        // Restore chat page interactivity if it was disabled to show the modal
        if (modalOverlay.dataset.restoreChat === 'true') {
            const chatPage = document.getElementById('chatPage');
            if (chatPage) {
                chatPage.style.pointerEvents = 'auto';
            }
            delete modalOverlay.dataset.restoreChat;
        }
    };

    //========================================
    //        UI POPULATION FUNCTIONS
    //========================================

    document.getElementById('prospectsSort')?.addEventListener('change', (e) => {
        const activeFilter = document.querySelector('.dashboard-page .pill.active').dataset.filter;
        populateProspects(activeFilter);
    });

    function populateProspects(filter = 'portfolio') {
        console.log('populateProspects called with filter:', filter);
        const list = document.getElementById('prospectsList');
        if (!list) {
            console.error('prospectsList not found');
            return;
        }
        list.innerHTML = '';

        let data = (filter === 'my-prospects')
            ? allAthletesData.filter(p => ownershipData[p.name] > 0)
            : allAthletesData;

        console.log('Data to populate:', data.length, 'items');
        console.log('Sample data:', data[0]);

        const sortValue = document.getElementById('prospectsSort')?.value || 'default';
        if (sortValue === 'name-asc') {
            data.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortValue === 'value-desc') {
            data.sort((a, b) => b.currentPrice - a.currentPrice);
        } else if (sortValue === 'change-desc') {
            data.sort((a, b) => b.dailyChangePercent - a.dailyChangePercent);
        } else if (sortValue === 'total-value-desc') {
            data.sort((a, b) => {
                const aShares = ownershipData[a.name] || 0;
                const bShares = ownershipData[b.name] || 0;
                const aTotalValue = aShares * a.currentPrice;
                const bTotalValue = bShares * b.currentPrice;
                return bTotalValue - aTotalValue;
            });
        }

        data.forEach((p, index) => {
            console.log(`Creating prospect item ${index}:`, p.name);
            const item = document.createElement('div');
            item.className = 'prospect-item';
            item.style.cursor = 'pointer';

            const changeClass = p.dailyChangePercent >= 0 ? 'positive' : 'negative';
            const sign = p.dailyChangePercent >= 0 ? '+' : '';

            let itemHtml;

            if (filter === 'my-prospects') {
                const sharesOwned = ownershipData[p.name] || 0;
                const totalValue = sharesOwned * p.currentPrice;
                
                const statsHtml = p.stats ? Object.entries(p.stats).slice(0, 3).map(([key, value]) => `
                    <div class="prospect-stat-item">
                        <span class="prospect-stat-key">${key.toUpperCase()}</span>
                        <span class="prospect-stat-value">${value}</span>
                    </div>
                `).join('') : '';

                itemHtml = `
                    <img src="${p.avatar}" alt="${p.name}" class="prospect-avatar">
                    <div class="prospect-info">
                        <div class="prospect-name">${p.name}</div>
                        <div class="prospect-shares">${sharesOwned.toLocaleString()} shares</div>
                        <div class="prospect-stats-preview">${statsHtml}</div>
                    </div>
                    <div class="prospect-price-info">
                        <div class="prospect-total-value">$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                        <div class="prospect-price">$${p.currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} per share</div>
                        <div class="prospect-change ${changeClass}">${sign}${p.dailyChangePercent.toFixed(2)}%</div>
                    </div>
                `;
            } else {
                itemHtml = `
                    <img src="${p.avatar}" alt="${p.name}" class="prospect-avatar">
                    <div class="prospect-info">
                        <div class="prospect-name">${p.name}</div>
                        <div class="prospect-details">${p.details}</div>
                    </div>
                    <div class="prospect-price">$${p.currentPrice.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
                `;
            }

            item.innerHTML = itemHtml;
            
            // Add click handler
            item.addEventListener('click', (e) => {
                console.log('Prospect clicked:', p.name);
                e.preventDefault();
                e.stopPropagation();
                showAthleteDetail(p);
            });
            
            list.appendChild(item);
        });
        
        console.log('Finished populating prospects, total items:', list.children.length);
    }

    function populateAthletes(data = allAthletesData) {
        const grid = document.getElementById('athletesGrid');
        if (!grid) return;
        grid.innerHTML = '';
        data.forEach(athlete => {
            const card = document.createElement('div');
            card.className = 'athlete-card';
            card.innerHTML = `
                <img src="${athlete.avatar}" alt="${athlete.name}" class="athlete-image">
                <div class="athlete-info">
                    <div class="athlete-position">${athlete.details}</div>
                    <div class="athlete-name">${athlete.name}</div>
                    <div class="athlete-price">$${athlete.currentPrice.toFixed(2)} / Share</div>
                </div>`;
            card.addEventListener('click', () => showAthleteDetail(athlete));
            grid.appendChild(card);
        });
    }

    function filterOffers() {
        const list = document.getElementById('offersList');
        if (!list) return;
        list.innerHTML = '';

        // Check if we're in the current-offers section
        const currentOffersSection = document.getElementById('current-offers-section');
        const isCurrentOffersActive = currentOffersSection && currentOffersSection.classList.contains('active');
        
        if (isCurrentOffersActive) {
            // We're in the current offers section, use the proper offers filtering
            const activePill = document.querySelector('#current-offers-section .pills-container .pill.active');
            const filterType = activePill ? activePill.dataset.filter : 'all';
            loadCurrentOffers(filterType);
            return;
        }

        // Original athlete filtering logic for other sections
        const activePill = document.querySelector('.offers-page .pill.active').dataset.filter;
        const searchQuery = document.getElementById('offersSearchInput').value.toLowerCase();
        const sportFilter = document.getElementById('offerSportFilter').value;
        const minPrice = parseFloat(document.getElementById('offerMinPrice').value) || 0;
        const maxPrice = parseFloat(document.getElementById('offerMaxPrice').value) || Infinity;
        const sortValue = document.getElementById('offerSort').value;

        let data = allAthletesData;

        if (activePill === 'buying') data = allAthletesData.filter(athlete => !athlete.myProspect);
        else if (activePill === 'selling') data = allAthletesData.filter(athlete => athlete.myProspect);

        data = data.filter(athlete => {
            const nameMatch = athlete.name.toLowerCase().includes(searchQuery);
            const detailsMatch = athlete.details.toLowerCase().includes(searchQuery);
            const sportMatch = sportFilter === 'all' || athlete.sport === sportFilter;
            const priceMatch = athlete.currentPrice >= minPrice && athlete.currentPrice <= maxPrice;
            return (nameMatch || detailsMatch) && sportMatch && priceMatch;
        });

        if (sortValue === 'name-asc') {
            data.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortValue === 'price-desc') {
            data.sort((a, b) => b.currentPrice - a.currentPrice);
        } else if (sortValue === 'market-cap-desc') {
            data.sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity));
        }

        data.forEach(athlete => {
            const item = document.createElement('div');
            item.className = 'offer-item';
            item.innerHTML = `
                <div class="offer-header">
                    <img src="${athlete.avatar}" alt="${athlete.name}" class="offer-image">
                    <div class="offer-info">
                        <div class="offer-position">${athlete.details}</div>
                        <div class="offer-name">${athlete.name}</div>
                        <div class="offer-quantity">Available: ${athlete.quantity} Shares</div>
                    </div>
                    <div>
                        <div class="offer-price">$${athlete.currentPrice.toFixed(2)}</div>
                    </div>
                </div>
                <div class="action-buttons" style="margin-top: 16px;">
                        <button class="action-button primary make-offer-btn">Make Offer</button>
                        <button class="action-button secondary view-prospect-btn">View Prospect</button>
                </div>
            `;
            item.querySelector('.make-offer-btn').addEventListener('click', () => openMakeOfferModal(athlete));
            item.querySelector('.view-prospect-btn').addEventListener('click', () => showAthleteDetail(athlete));
            list.appendChild(item);
        });
    }

    const offerInputs = ['offerSportFilter', 'offerMinPrice', 'offerMaxPrice', 'offerSort'];
    offerInputs.forEach(id => {
        const element = document.getElementById(id);
        element?.addEventListener('input', filterOffers);
        element?.addEventListener('change', filterOffers);
    });

    document.getElementById('offersSearchInput')?.addEventListener('input', () => filterOffers());

    function filterActivities(filter) {
        const list = document.getElementById('activitiesList');
        if(!list) return;
        list.innerHTML = '';
        const data = (filter === 'all') ? notificationsData : notificationsData.filter(a => a.category === filter);
        
        if (data.length === 0) {
            // Show empty state message
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'empty-notifications';
            emptyMessage.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.5;">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="m13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                    <h3 style="margin: 0 0 8px 0; font-weight: 600;">No notifications yet</h3>
                    <p style="margin: 0; font-size: 14px;">
                        ${filter === 'all' ? 'You\'ll see notifications here when people interact with your posts, send messages, or follow you.' : 
                          filter === 'messages' ? 'No new messages yet.' :
                          filter === 'offers' ? 'No new offers yet.' :
                          'No social activity yet.'}
                    </p>
                </div>
            `;
            list.appendChild(emptyMessage);
            return;
        }
        
        data.forEach(notification => {
            const item = document.createElement('div');
            item.className = `activity-item ${notification.hasDot ? 'has-dot' : ''}`;
            item.setAttribute('data-notification-id', notification.id);
            item.setAttribute('data-notification-type', notification.type);
            
            // Generate content based on notification type
            let contentHTML = generateNotificationContent(notification);
            
            item.innerHTML = `
                ${notification.hasDot ? '<div class="activity-dot"></div>' : ''}
                <img src="${notification.avatar}" alt="${notification.username}" class="activity-avatar">
                <div class="activity-content">
                    <div class="activity-header">
                        <span class="activity-username">${notification.username}</span>
                        <span class="activity-time">${notification.time}</span>
                    </div>
                    <div class="activity-text">${notification.action}</div>
                    ${contentHTML}
                </div>
                ${notification.buttonText ? `<button class="activity-button" data-notification='${JSON.stringify(notification)}'>${notification.buttonText}</button>` : ''}
                ${notification.postImage ? `<img src="${notification.postImage}" alt="Post" class="activity-image">` : ''}`;
            
            // Add event listeners for different notification types
            setupNotificationHandlers(item, notification);
            
            list.appendChild(item);
        });
    }

    // Generate content based on notification type
    function generateNotificationContent(notification) {
        let contentHTML = '';
        
        switch(notification.type) {
            case 'message':
                if (notification.content) {
                    contentHTML = `<div class="activity-comment">${notification.content}</div>`;
                }
                break;
                
            case 'post_liked':
            case 'new_post':
                if (notification.postPreview) {
                    contentHTML = `<div class="activity-comment">${notification.postPreview}</div>`;
                }
                break;
                
            case 'comment_liked':
                if (notification.quote) {
                    contentHTML = `<div class="activity-quote"><div class="quote-line"></div><div class="quote-text">${notification.quote}</div></div>`;
                }
                break;
                
            case 'post_reply':
            case 'comment_reply':
            case 'post_comment':
            case 'mention':
                if (notification.comment) {
                    contentHTML = `<div class="activity-comment">${notification.comment}</div>`;
                }
                break;
                
            default:
                // Handle legacy format
                if (notification.comment) {
                    contentHTML = `<div class="activity-comment">${notification.comment}</div>`;
                } else if (notification.quote) {
                    contentHTML = `<div class="activity-quote"><div class="quote-line"></div><div class="quote-text">${notification.quote}</div></div>`;
                }
                break;
        }
        
        return contentHTML;
    }

    // Set up event handlers for different notification types
    function setupNotificationHandlers(item, notification) {
        const button = item.querySelector('.activity-button');
        
        if (button) {
            console.log('🔘 Setting up button handler for notification:', notification.type, 'Button text:', button.textContent);
            button.addEventListener('click', () => {
                console.log('🔘 Button clicked! Notification:', notification.type, 'Button text:', button.textContent);
                handleNotificationAction(notification);
            });
        }
        
        // Add click handler for the entire notification item
        item.addEventListener('click', (e) => {
            // Don't trigger if clicking on a button
            if (e.target.classList.contains('activity-button')) return;
            
            handleNotificationClick(notification);
        });
    }

    // Handle notification action button clicks
    function handleNotificationAction(notification) {
        console.log('🎯 Handling notification action:', notification.type, 'ConversationId:', notification.conversationId, 'MessageId:', notification.messageId);
        
        switch(notification.type) {
            case 'offer_made':
            case 'offer_received':
                console.log('🎯 Handling offer notification - opening conversation');
                // Open the message conversation to view the offer in context
                if (notification.conversationId) {
                    console.log('🎯 Opening conversation with conversationId:', notification.conversationId);
                    openMessageConversation(notification.conversationId);
                } else if (notification.messageId) {
                    console.log('🎯 Opening conversation with messageId:', notification.messageId);
                    openMessageConversation(notification.messageId);
                } else {
                    console.warn('🎯 No conversationId or messageId found for offer notification');
                }
                break;
                
            case 'new_follow':
                followUser(notification.userId);
                break;
                
            case 'message':
                openMessageConversation(notification.messageId);
                break;
                
            default:
                console.log('Action for notification type:', notification.type);
                break;
        }
    }

    // Handle notification item clicks
    function handleNotificationClick(notification) {
        // Mark as read
        markNotificationAsRead(notification.id);
        
        switch(notification.type) {
            case 'message':
                openMessageConversation(notification.messageId);
                break;
                
            case 'post_liked':
            case 'new_post':
            case 'post_reply':
            case 'post_comment':
            case 'mention':
                if (notification.postId) {
                    openPost(notification.postId);
                }
                break;
                
            case 'comment_liked':
            case 'comment_reply':
                if (notification.commentId) {
                    openComment(notification.commentId, notification.postId);
                }
                break;
                
            case 'new_follow':
                openUserProfile(notification.username);
                break;
                
            default:
                console.log('Navigate to notification:', notification.type);
                break;
        }
    }

    // Mark notification as read
    async function markNotificationAsRead(notificationId) {
        // Validate notification ID
        if (!notificationId || notificationId === 'undefined') {
            console.warn('Invalid notification ID provided:', notificationId);
            return;
        }
        
        const notification = notificationsData.find(n => n.id === notificationId);
        if (notification) {
            notification.hasDot = false;
            notification.isRead = true;
            
            // Update the UI
            const item = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (item) {
                item.classList.remove('has-dot');
                const dot = item.querySelector('.activity-dot');
                if (dot) {
                    dot.remove();
                }
            }
            
            // Update notification badge
            updateNotificationBadge();
            
            // Send to backend API when available
            try {
                const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!response.ok && response.status !== 404) {
                    console.log('Error marking notification as read:', response.status);
                }
            } catch (error) {
                // API not available yet - this is expected
                console.log('Notification read API not available yet');
            }
        }
    }

    // Navigation helper functions
    function openMessageConversation(conversationId) {
        console.log('🗨️ Opening message conversation:', conversationId);
        
        // Navigate to messages tab and open specific conversation
        showPage('messages');
        
        // Open the specific conversation
        if (conversationId) {
            console.log('🗨️ Calling openChat with conversationId:', conversationId);
            openChat(conversationId);
        } else {
            console.warn('🗨️ No conversationId provided to openMessageConversation');
        }
    }

    function openPost(postId) {
        // Navigate to explore tab and open specific post
        showPage('explore');
        // TODO: Implement specific post opening
        console.log('Opening post:', postId);
    }

    function openComment(commentId, postId) {
        // Navigate to explore tab and open post with comment highlighted
        showPage('explore');
        // TODO: Implement comment highlighting
        console.log('Opening comment:', commentId, 'in post:', postId);
    }

    function openUserProfile(username) {
        // Open user profile modal or page
        // TODO: Implement user profile opening
        console.log('Opening user profile:', username);
    }

    function followUser(userId) {
        // Follow the user
        // TODO: Implement follow functionality
        console.log('Following user:', userId);
    }

    // Format notification for frontend display
    function formatNotificationForDisplay(notification) {
        // Set basic UI properties - ensure we have a valid ID
        if (!notification.id && notification._id) {
            notification.id = notification._id;
        }
        if (!notification.id) {
            console.warn('Notification missing ID:', notification);
            notification.id = `temp-${Date.now()}-${Math.random()}`;
        }
        notification.hasDot = !notification.isRead;
        
        // Format actor information
        if (notification.actor) {
            notification.username = notification.actor.name || notification.actor.username || 'Unknown User';
            notification.avatar = notification.actor.avatar || 'images/placeholder_athlete.png';
        }
        
        // Format time display
        notification.time = formatTimeAgo(notification.createdAt || notification.timestamp);
        
        // Set category and button text based on notification type
        switch (notification.type) {
            case 'offer_received':
            case 'offer_made':
                notification.category = 'offers';
                notification.buttonText = 'View Offer';
                // Include offer details in content if available
                if (notification.data?.offerDetails) {
                    notification.offerDetails = notification.data.offerDetails;
                }
                break;
                
            case 'offer_accepted':
                notification.category = 'offers';
                notification.buttonText = 'View Details';
                break;
                
            case 'message':
                notification.category = 'messages';
                notification.buttonText = 'Reply';
                // Include message preview
                if (notification.data?.messagePreview) {
                    notification.content = notification.data.messagePreview;
                }
                break;
                
            case 'new_follow':
                notification.category = 'social';
                notification.buttonText = 'Follow Back';
                break;
                
            case 'post_liked':
            case 'post_comment':
            case 'post_reply':
            case 'comment_liked':
            case 'comment_reply':
            case 'mention':
                notification.category = 'social';
                // Include post preview if available
                if (notification.data?.postPreview) {
                    notification.postPreview = notification.data.postPreview;
                }
                break;
                
            case 'new_post':
                notification.category = 'social';
                if (notification.data?.postPreview) {
                    notification.postPreview = notification.data.postPreview;
                }
                break;
                
            default:
                notification.category = 'social';
                break;
        }
        
        // Store additional data for handlers
        if (notification.data?.conversationId) {
            notification.conversationId = notification.data.conversationId;
            notification.messageId = notification.data.conversationId; // For compatibility
        }
        if (notification.target?.targetId) {
            notification.messageId = notification.target.targetId;
        }
    }

    // Load notifications from backend API
    async function loadNotifications() {
        try {
            // Check if the notifications endpoint exists by making a silent request
            const response = await fetch(`${API_BASE_URL}/notifications`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data && data.success) {
                    notificationsData = data.data || [];
                    
                    // Process and format notifications for frontend display
                    notificationsData.forEach(notification => {
                        // Add timestamps if not present
                        if (!notification.timestamp && notification.createdAt) {
                            notification.timestamp = notification.createdAt;
                        }
                        
                        // Format notification for frontend display
                        formatNotificationForDisplay(notification);
                    });
                    
                    // Sort notifications by timestamp (newest first)
                    notificationsData.sort((a, b) => new Date(b.timestamp || b.createdAt) - new Date(a.timestamp || a.createdAt));
                    
                    console.log(`Loaded ${notificationsData.length} notifications from API`);
                } else {
                    notificationsData = [];
                }
            } else if (response.status === 404) {
                // API endpoint doesn't exist yet - this is expected
                console.log('Notifications API endpoint not implemented yet - starting with empty notifications');
                notificationsData = [];
            } else {
                console.log('Notifications API returned error:', response.status);
                notificationsData = [];
            }
            
        } catch (error) {
            // Network error or API not available - this is expected until the endpoint is implemented
            console.log('Notifications API not available yet - will populate from real-time events');
            notificationsData = [];
        }
    }

    // Add new notification (for real-time updates)
    function addNotification(notificationData) {
        console.log('📝 Adding notification:', notificationData);
        console.log('📝 Before processing - Type:', notificationData.type, 'ButtonText:', notificationData.buttonText, 'Category:', notificationData.category);
        
        // Add timestamp if not present
        if (!notificationData.timestamp) {
            notificationData.timestamp = new Date().toISOString();
        }
        
        // DEBUG: Always format to see what's happening
        console.log('📝 Raw notification from WebSocket:', JSON.stringify(notificationData, null, 2));
        
        // Temporarily always format to debug
        formatNotificationForDisplay(notificationData);
        
        console.log('📝 After processing - Type:', notificationData.type, 'ButtonText:', notificationData.buttonText, 'Category:', notificationData.category);
        
        // Add to the beginning of the array
        notificationsData.unshift(notificationData);
        
        // Always update notification badge count
        updateNotificationBadge();
        
        // Force refresh the current view if on activities page
        const activePage = document.querySelector('.page-content.active');
        if (activePage && activePage.id === 'activities') {
            const activeFilter = document.querySelector('.activities-page .pill.active')?.dataset.filter || 'all';
            console.log('🔄 Refreshing activities page with filter:', activeFilter);
            filterActivities(activeFilter);
        }
        
        console.log('📊 Total notifications:', notificationsData.length);
    }

    // Update notification badge count
    function updateNotificationBadge() {
        const unreadCount = notificationsData.filter(n => n.hasDot).length;
        const badge = document.querySelector('.tab-item[data-page="activities"] .notification-badge');
        
        if (unreadCount > 0) {
            if (!badge) {
                // Create badge if it doesn't exist
                const tabItem = document.querySelector('.tab-item[data-page="activities"]');
                if (tabItem) {
                    const badgeElement = document.createElement('span');
                    badgeElement.className = 'notification-badge';
                    badgeElement.textContent = unreadCount;
                    tabItem.appendChild(badgeElement);
                }
            } else {
                badge.textContent = unreadCount;
            }
        } else if (badge) {
            badge.remove();
        }
    }

    // Setup WebSocket listeners for real-time notifications
    function setupNotificationWebSocketListeners() {
        if (!socket) {
            console.log('Socket not available for notifications');
            return;
        }
        
        console.log('Setting up notification WebSocket listeners...');
        
        // Listen for various events that should create notifications
        socket.on('new-message', (data) => {
            // Only create notification if message is not from current user
            if (data.from && data.from._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'message',
                    username: data.from.username || data.from.name,
                    action: 'Sent you a message',
                    time: 'now',
                    avatar: data.from.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'messages',
                    content: data.content.text ? data.content.text.substring(0, 50) + (data.content.text.length > 50 ? '...' : '') : 'New message',
                    messageId: data._id,
                    conversationId: data.conversation
                });
            }
        });
        
        // When someone likes your post
        socket.on('post-liked', (data) => {
            if (data.postAuthor === currentUser?._id && data.user._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'post_liked',
                    username: data.user.username || data.user.name,
                    action: 'Liked your post',
                    time: 'now',
                    avatar: data.user.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'social',
                    postId: data.postId,
                    postPreview: data.postPreview || 'Your post'
                });
            }
        });
        
        // When someone likes your comment
        socket.on('comment-liked', (data) => {
            if (data.commentAuthor === currentUser?._id && data.user._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'comment_liked',
                    username: data.user.username || data.user.name,
                    action: 'Liked your comment',
                    time: 'now',
                    avatar: data.user.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'social',
                    commentId: data.commentId,
                    postId: data.postId,
                    quote: data.commentText || 'Your comment'
                });
            }
        });
        
        // When someone comments on your post
        socket.on('new-comment', (data) => {
            if (data.postAuthor === currentUser?._id && data.author._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'post_comment',
                    username: data.author.username || data.author.name,
                    action: 'Commented on your post',
                    time: 'now',
                    avatar: data.author.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'social',
                    postId: data.postId,
                    commentId: data.commentId,
                    comment: data.content?.text ? data.content.text.substring(0, 50) + (data.content.text.length > 50 ? '...' : '') : 'New comment'
                });
            }
        });
        
        // When someone follows you
        socket.on('new-follow', (data) => {
            if (data.followed === currentUser?._id && data.follower._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'new_follow',
                    username: data.follower.username || data.follower.name,
                    action: 'Started following you',
                    time: 'now',
                    avatar: data.follower.avatar || 'images/placeholder_athlete.png',
                    hasButton: true,
                    buttonText: 'Follow Back',
                    hasDot: true,
                    category: 'social',
                    userId: data.follower._id
                });
            }
        });
        
        // When someone you follow posts
        socket.on('new-post', (data) => {
            // Only show if we follow this user and it's not our own post
            if (data.author._id !== currentUser?._id && isFollowing(data.author._id)) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'new_post',
                    username: data.author.username || data.author.name,
                    action: 'Posted a new update',
                    time: 'now',
                    avatar: data.author.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'social',
                    postId: data._id,
                    postPreview: data.content?.text ? data.content.text.substring(0, 50) + (data.content.text.length > 50 ? '...' : '') : 'New post',
                    postImage: data.content?.media?.[0]?.url
                });
            }
        });

        // When someone replies to your comment
        socket.on('comment-reply', (data) => {
            if (data.parentCommentAuthor === currentUser?._id && data.author._id !== currentUser?._id) {
                addNotification({
                    id: 'notif_' + Date.now(),
                    type: 'comment_reply',
                    username: data.author.username || data.author.name,
                    action: 'Replied to your comment',
                    time: 'now',
                    avatar: data.author.avatar || 'images/placeholder_athlete.png',
                    hasDot: true,
                    category: 'social',
                    commentId: data.commentId,
                    parentCommentId: data.parentCommentId,
                    postId: data.postId,
                    comment: data.content?.text ? data.content.text.substring(0, 50) + (data.content.text.length > 50 ? '...' : '') : 'New reply'
                });
            }
        });
    }

    // Helper function to check if current user is following someone
    function isFollowing(userId) {
        // TODO: Implement actual following check
        // For now, return false to prevent spam until proper following system is checked
        return false;
    }

    // Initialize notifications system
    function initializeNotifications() {
        loadNotifications();
        updateNotificationBadge();
        setupNotificationWebSocketListeners();
    }
    
    // Leaderboard state management
    let currentLeaderboardCategory = 'players';
    let currentTimeframe = 'monthly';

    // Calculate percentage changes for different time periods
    function calculatePercentageChange(data, timeframe) {
        if (!data || !data.data || data.data.length < 2) return 0;
        
        try {
            const startPrice = data.data[0];
            const endPrice = data.data[data.data.length - 1];
            return startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
        } catch (error) {
            return 0;
        }
    }

    // Get athletes leaderboard data
    function getPlayersLeaderboard(timeframe) {
        if (!allAthletesData || allAthletesData.length === 0) return [];

        return allAthletesData.map(athlete => {
            let percentChange = 0;
            
            switch (timeframe) {
                case 'daily':
                    percentChange = athlete.dailyChangePercent || 0;
                    break;
                case 'weekly':
                    percentChange = calculatePercentageChange(athlete.d5, timeframe);
                    break;
                case 'monthly':
                    percentChange = calculatePercentageChange(athlete.m1, timeframe);
                    break;
                case 'yearly':
                    percentChange = calculatePercentageChange(athlete.y1, timeframe);
                    break;
            }

            return {
                name: athlete.name,
                avatar: athlete.avatar,
                percent: percentChange,
                type: 'athlete'
            };
        }).sort((a, b) => b.percent - a.percent);
    }

    // Helper function to get performance for specific timeframe
    function getPerformanceForTimeframe(user, timeframe) {
        const username = user.username || user.name || 'unknown';
        console.log(`Getting performance for ${username}, timeframe: ${timeframe}`, {
            daily: user.percentChangeWeekly,
            weekly: user.percentChangeWeekly, 
            monthly: user.percentChangeMonthly,
            yearly: user.percentChangeYearly,
            default: user.performancePercent
        });
        
        switch (timeframe) {
            case 'daily':
                return user.percentChangeWeekly || 0; // Use weekly as daily proxy
            case 'weekly':
                return user.percentChangeWeekly || 0;
            case 'monthly':
                return user.percentChangeMonthly || 0;
            case 'yearly':
                return user.percentChangeYearly || 0;
            default:
                return user.performancePercent || 0;
        }
    }

    // Get following users leaderboard data
    async function getFollowingLeaderboard(timeframe) {
        console.log('Loading following leaderboard from API');
        
        try {
            let sortBy = 'performance';
            if (timeframe === 'daily' || timeframe === 'weekly') {
                sortBy = 'performance'; // Use weekly performance for daily/weekly
            } else if (timeframe === 'yearly') {
                sortBy = 'performance'; // Use yearly performance
            }
            
            const response = await fetch(`${API_BASE_URL}/users/following/leaderboard?sortBy=${sortBy}`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Following leaderboard API response:', result);
                
                if (result.success && result.data) {
                    console.log('Sample user data from following API:', result.data[0]);
                    return result.data.map(user => {
                        const performancePercent = getPerformanceForTimeframe(user, timeframe);
                        console.log(`User ${user.username}: portfolioValue=${user.portfolioValue}, percent=${performancePercent}`);
                        return {
                            username: user.username || user.name || 'user',
                            name: user.name || user.username || 'Unknown User',
                            avatar: user.avatar || 'images/image_48fb0979.png',
                            percent: performancePercent,
                            portfolioValue: user.portfolioValue,
                            type: 'user',
                            rank: user.rank
                        };
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching following leaderboard:', error);
        }
        
        // Fallback to sample data if API fails
        console.log('Using fallback data for following leaderboard');
        const multiplier = timeframe === 'daily' ? 0.1 : timeframe === 'weekly' ? 0.3 : timeframe === 'yearly' ? 2.5 : 1;
        
        // Get current user's real portfolio value for fallback
        let realPortfolioValue = 150000; // Default fallback
        try {
            const portfolioStats = await fetchData('/portfolio/stats');
            if (portfolioStats && portfolioStats.totalValue) {
                realPortfolioValue = portfolioStats.totalValue;
            }
        } catch (error) {
            console.warn('Could not fetch portfolio stats for fallback:', error);
        }
        return [
            {
                username: 'portfolio_lisa',
                name: 'Lisa Chen',
                avatar: 'images/image_48fb0979.png',
                percent: 15.1 * multiplier,
                portfolioValue: 87000,
                type: 'user'
            },
            {
                username: 'maria_investor',
                name: 'Maria Garcia',
                avatar: 'images/image_48fb0979.png',
                percent: 12.3 * multiplier,
                portfolioValue: 98000,
                type: 'user'
            },
            {
                username: 'trader_alex',
                name: 'Alex Thompson',
                avatar: 'images/image_48fb0979.png',
                percent: 8.5 * multiplier,
                portfolioValue: 125000,
                type: 'user'
            },
            {
                username: 'sports_fan_james',
                name: 'James Wilson',
                avatar: 'images/image_48fb0979.png',
                percent: 6.7 * multiplier,
                portfolioValue: 156000,
                type: 'user'
            },
            {
                username: 'current_user',
                name: 'You',
                avatar: 'images/image_48fb0979.png',
                percent: 5.2 * multiplier,
                portfolioValue: realPortfolioValue,
                type: 'user',
                isCurrentUser: true
            },
            {
                username: 'david_stocks',
                name: 'David Miller',
                avatar: 'images/image_48fb0979.png',
                percent: 3.8 * multiplier,
                portfolioValue: 142000,
                type: 'user'
            }
        ].sort((a, b) => b.percent - a.percent);
    }

    // Get global leaderboard data (using fallback until server restart)
    async function getGlobalLeaderboard(timeframe) {
        console.log('Loading global leaderboard from API');
        
        try {
            let sortBy = 'performance';
            if (timeframe === 'daily' || timeframe === 'weekly') {
                sortBy = 'performance'; // Use weekly performance for daily/weekly
            } else if (timeframe === 'yearly') {
                sortBy = 'performance'; // Use yearly performance
            }
            
            console.log('Auth token available:', !!authToken);
            const response = await fetch(`${API_BASE_URL}/users/leaderboard?sortBy=${sortBy}&limit=50`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            console.log('Leaderboard API response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Global leaderboard API response:', result);
                
                if (result.success && result.data) {
                    console.log('Sample user data from global API:', result.data[0]);
                    return result.data.map(user => {
                        const isCurrentUser = currentUser && user.username === currentUser.username;
                        const performancePercent = getPerformanceForTimeframe(user, timeframe);
                        console.log(`Global user ${user.username}: portfolioValue=${user.portfolioValue}, percent=${performancePercent}`);
                        return {
                            username: user.username || user.name || 'user',
                            name: user.name || user.username || 'Unknown User',
                            avatar: user.avatar || 'images/image_48fb0979.png',
                            percent: performancePercent,
                            portfolioValue: user.portfolioValue,
                            type: 'user',
                            rank: user.rank,
                            isCurrentUser: isCurrentUser
                        };
                    });
                }
            }
        } catch (error) {
            console.error('Error fetching global leaderboard:', error);
        }
        
        // Fallback to sample data if API fails
        console.log('Using fallback data for global leaderboard');
        const multiplier = timeframe === 'daily' ? 0.1 : timeframe === 'weekly' ? 0.3 : timeframe === 'yearly' ? 2.5 : 1;
        
        // Get current user's real portfolio value for fallback
        let realPortfolioValue = 150000; // Default fallback
        try {
            const portfolioStats = await fetchData('/portfolio/stats');
            if (portfolioStats && portfolioStats.totalValue) {
                realPortfolioValue = portfolioStats.totalValue;
            }
        } catch (error) {
            console.warn('Could not fetch portfolio stats for fallback:', error);
        }
        return [
            {
                username: 'alex_trader',
                name: 'Alex Thompson',
                avatar: 'images/image_48fb0979.png',
                percent: 18.5 * multiplier,
                portfolioValue: 225000,
                type: 'user'
            },
            {
                username: 'emma_pro',
                name: 'Emma Wilson',
                avatar: 'images/image_48fb0979.png',
                percent: 16.2 * multiplier,
                portfolioValue: 234000,
                type: 'user'
            },
            {
                username: 'amanda_stocks',
                name: 'Amanda White',
                avatar: 'images/image_48fb0979.png',
                percent: 14.8 * multiplier,
                portfolioValue: 215000,
                type: 'user'
            },
            {
                username: 'sarah_trader',
                name: 'Sarah Johnson',
                avatar: 'images/image_48fb0979.png',
                percent: 13.1 * multiplier,
                portfolioValue: 203000,
                type: 'user'
            },
            {
                username: 'maria_investor',
                name: 'Maria Garcia',
                avatar: 'images/image_48fb0979.png',
                percent: 12.3 * multiplier,
                portfolioValue: 198000,
                type: 'user'
            },
            {
                username: 'tom_anderson',
                name: 'Tom Anderson',
                avatar: 'images/image_48fb0979.png',
                percent: 11.7 * multiplier,
                portfolioValue: 198000,
                type: 'user'
            },
            {
                username: 'robert_trader',
                name: 'Robert Taylor',
                avatar: 'images/image_48fb0979.png',
                percent: 10.9 * multiplier,
                portfolioValue: 192000,
                type: 'user'
            },
            {
                username: 'john_pro',
                name: 'John Smith',
                avatar: 'images/image_48fb0979.png',
                percent: 9.8 * multiplier,
                portfolioValue: 189000,
                type: 'user'
            },
            {
                username: 'portfolio_lisa',
                name: 'Lisa Chen',
                avatar: 'images/image_48fb0979.png',
                percent: 9.1 * multiplier,
                portfolioValue: 187000,
                type: 'user'
            },
            {
                username: 'mike_investor',
                name: 'Mike Davis',
                avatar: 'images/image_48fb0979.png',
                percent: 8.5 * multiplier,
                portfolioValue: 178000,
                type: 'user'
            },
            {
                username: 'ryan_garcia',
                name: 'Ryan Garcia',
                avatar: 'images/image_48fb0979.png',
                percent: 7.9 * multiplier,
                portfolioValue: 178000,
                type: 'user'
            },
            {
                username: 'emily_pro',
                name: 'Emily Johnson',
                avatar: 'images/image_48fb0979.png',
                percent: 7.2 * multiplier,
                portfolioValue: 176000,
                type: 'user'
            },
            {
                username: 'jessica_investor',
                name: 'Jessica Davis',
                avatar: 'images/image_48fb0979.png',
                percent: 6.8 * multiplier,
                portfolioValue: 168000,
                type: 'user'
            },
            {
                username: 'kevin_stocks',
                name: 'Kevin Lee',
                avatar: 'images/image_48fb0979.png',
                percent: 6.1 * multiplier,
                portfolioValue: 167000,
                type: 'user'
            },
            {
                username: 'sophie_brown',
                name: 'Sophie Brown',
                avatar: 'images/image_48fb0979.png',
                percent: 5.4 * multiplier,
                portfolioValue: 156000,
                type: 'user'
            },
            {
                username: 'current_user',
                name: 'You',
                avatar: 'images/image_48fb0979.png',
                percent: 5.2 * multiplier,
                portfolioValue: realPortfolioValue,
                type: 'user',
                isCurrentUser: true
            }
        ].sort((a, b) => b.percent - a.percent);
    }

    // Get current user's position in global leaderboard
    function getCurrentUserPosition(globalData) {
        // Mock implementation - would use real user data
        const userPercent = Math.random() * 20 - 2; // -2% to +18%
        const position = globalData.filter(user => user.percent > userPercent).length + 1;
        return { position, percent: userPercent };
    }

    async function populateLeaderboard() {
        const list = document.getElementById('leaderboardList');
        const emptyState = document.getElementById('leaderboardEmpty');
        if (!list) return;

        // Show loading state
        list.innerHTML = '<div class="loading-state">Loading...</div>';
        list.style.display = 'block';
        emptyState.style.display = 'none';

        let data = [];
        let showUserPosition = false;
        let userPosition = null;

        try {
            // Get data based on current category
            switch (currentLeaderboardCategory) {
                case 'players':
                    data = getPlayersLeaderboard(currentTimeframe);
                    break;
                case 'following':
                    data = await getFollowingLeaderboard(currentTimeframe);
                    showUserPosition = true;
                    break;
                case 'global':
                    data = await getGlobalLeaderboard(currentTimeframe);
                    showUserPosition = true;
                    // Find current user position in the data
                    const currentUserIndex = data.findIndex(user => user.isCurrentUser);
                    if (currentUserIndex !== -1) {
                        userPosition = { position: currentUserIndex + 1, percent: data[currentUserIndex].percent };
                    }
                    break;
            }

            // Show empty state if no data
            if (data.length === 0) {
                list.style.display = 'none';
                emptyState.style.display = 'flex';
                return;
            }

            // Generate leaderboard HTML
            let html = '';

            // Add leaderboard items
            data.slice(0, currentLeaderboardCategory === 'global' ? 50 : 20).forEach((item, i) => {
                const rank = i + 1;
                const percentClass = item.percent >= 0 ? 'positive' : 'negative';
                const percentSymbol = item.percent >= 0 ? '+' : '';
                const isCurrentUser = item.isCurrentUser;
                // For athletes, find the original athlete data from allAthletesData
                let clickHandler;
                if (item.type === 'athlete') {
                    const originalAthlete = allAthletesData?.find(a => a.name === item.name);
                    if (originalAthlete) {
                        clickHandler = `showAthleteDetail(${JSON.stringify(originalAthlete).replace(/"/g, '&quot;')})`;
                    } else {
                        clickHandler = `console.log('Athlete data not found for ${item.name}')`;
                    }
                } else {
                    clickHandler = `showUserProfile('${item.username}')`;
                }
                
                html += `
                    <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''}" 
                         onclick="${clickHandler}" 
                         style="cursor: pointer; ${isCurrentUser ? 'background: var(--color-primary-light); border: 2px solid var(--color-primary);' : ''}">
                        <span class="leaderboard-rank">${rank}</span>
                        <img src="${item.avatar || '/api/placeholder/40/40'}" class="leaderboard-avatar" alt="${item.name}">
                        <div style="flex: 1;">
                            <div class="leaderboard-name">${item.name}${isCurrentUser ? ' (You)' : ''}</div>
                            ${item.portfolioValue ? `<div class="leaderboard-subtitle">$${item.portfolioValue.toLocaleString()}</div>` : ''}
                            ${isCurrentUser && currentLeaderboardCategory === 'global' ? `<div class="leaderboard-subtitle">Your current position</div>` : ''}
                        </div>
                        <span class="leaderboard-percent ${percentClass}">
                            ${percentSymbol}${item.percent.toFixed(1)}%
                        </span>
                    </div>
                `;
            });

            list.innerHTML = html;
        } catch (error) {
            console.error('Error populating leaderboard:', error);
            list.innerHTML = '<div class="error-state">Failed to load leaderboard data.</div>';
        }
    }

    // Function to show user profile (placeholder - would need real implementation)
    function showUserProfile(username) {
        // This would need to be implemented to show user profile details
        // For now, just log the username
        console.log('Show profile for user:', username);
        
        // Could show a modal with user details, portfolio, following status, etc.
        // Or navigate to a user profile page
        alert(`View profile for ${username} - Feature coming soon!`);
    }

    // Handle leaderboard tab switching
    async function switchLeaderboardCategory(category) {
        currentLeaderboardCategory = category;
        
        // Update tab active state
        document.querySelectorAll('.leaderboard-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.category === category) {
                tab.classList.add('active');
            }
        });

        await populateLeaderboard();
    }

    // Handle timeframe change
    async function changeLeaderboardTimeframe(timeframe) {
        currentTimeframe = timeframe;
        await populateLeaderboard();
    }

    // Initialize leaderboard event listeners
    function initializeLeaderboard() {
        // Tab switching
        document.querySelectorAll('.leaderboard-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                await switchLeaderboardCategory(tab.dataset.category);
            });
        });

        // Timeframe selection
        const timeframeSelect = document.getElementById('timeframeSelect');
        if (timeframeSelect) {
            timeframeSelect.addEventListener('change', async (e) => {
                await changeLeaderboardTimeframe(e.target.value);
            });
        }
    }

    // Make showUserProfile globally accessible
    window.showUserProfile = showUserProfile;

    async function updateDashboardStats() {
        const stats = await fetchData('/portfolio/stats');
        if (!stats) return;

        const totalValueEl = document.getElementById('total-share-value');
        const totalSharesEl = document.getElementById('total-shares-owned');
        const valueChangeEl = document.getElementById('share-value-change');
        const sharesChangeEl = document.getElementById('shares-owned-change');

        if (totalValueEl) totalValueEl.textContent = stats.totalValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        if (totalSharesEl) totalSharesEl.textContent = stats.totalShares.toLocaleString('en-US');
        
        if (valueChangeEl) {
            const sign = stats.valueChangePercent >= 0 ? '+' : '';
            valueChangeEl.textContent = `${sign}${stats.valueChangePercent.toFixed(2)}% month over month`;
            valueChangeEl.className = `stat-change ${stats.valueChangePercent >= 0 ? 'positive' : 'negative'}`;
        }

        if(sharesChangeEl) {
            sharesChangeEl.textContent = `+${stats.sharesChangePercent}% month over month`; 
        }
    }

    //========================================
    //        MODAL FUNCTIONS
    //========================================

    function showAthleteDetail(athlete) {
        console.log('showAthleteDetail called with:', athlete);
        closeAllModals();
        const content = document.getElementById('athleteDetailContent');
        if (!content) {
            console.error('athleteDetailContent not found');
            return;
        }

        const sharesOwned = ownershipData[athlete.name] || 0;
        const isOwned = sharesOwned > 0;

        console.log('Athlete details:', {
            name: athlete.name,
            sharesOwned,
            isOwned,
            hasStats: !!athlete.stats,
            hasPriceHistory: !!(athlete && athlete.currentPrice)
        });

        const statsHtml = athlete.stats ? Object.entries(athlete.stats).map(([key, value]) => 
            `<div class="stat-box"><span class="stat-box-value">${value}</span><span class="stat-box-label">${key.toUpperCase()}</span></div>`
        ).join('') : '';

        const hasPriceHistory = athlete && athlete.currentPrice;
        let priceHistoryHtml = '';
        if (hasPriceHistory) {
            const changeClass = athlete.dailyChange >= 0 ? 'positive' : 'negative';
            const arrowIcon = athlete.dailyChange >= 0 ? '↑' : '↓';
            const sign = athlete.dailyChange >= 0 ? '+' : '';

            priceHistoryHtml = `
                <div class="remodel-container">
                    <div class="remodel-header">
                        <div class="remodel-price">$${athlete.currentPrice.toFixed(2)} USD</div>
                        <div class="remodel-change ${changeClass}">
                            <span class="icon">${arrowIcon}</span>
                            <span>${sign}${athlete.dailyChange.toFixed(2)} (${sign}${athlete.dailyChangePercent.toFixed(2)}%) today</span>
                        </div>
                    </div>
                    <div class="remodel-range-selector">
                        <button class="remodel-range-btn active" data-range="d1">1D</button>
                        <button class="remodel-range-btn" data-range="d5">5D</button>
                        <button class="remodel-range-btn" data-range="m1">1M</button>
                        <button class="remodel-range-btn" data-range="m6">6M</button>
                        <button class="remodel-range-btn" data-range="ytd">YTD</button>
                        <button class="remodel-range-btn" data-range="y1">1Y</button>
                    </div>
                    <div class="chart-layout-container">
                        <div id="remodel-y-axis" class="y-axis"></div>
                        <div class="chart-wrap">
                            <canvas id="remodelPriceChart"></canvas>
                        </div>
                    </div>
                </div>`;
        }

        let actionButtonsHtml = isOwned
            ? `<button id="detailSellBtn" class="action-button secondary">Sell</button><button id="detailBuyMoreBtn" class="action-button primary">Buy More</button>`
            : `<button id="detailMakeOfferBtn" class="action-button primary">Make Offer</button>`;

        content.innerHTML = `
            <div class="athlete-detail-header">
                <img src="${athlete.avatar}" alt="${athlete.name}" class="athlete-detail-image">
                <h3 class="athlete-detail-name">${athlete.name}</h3>
                <p class="athlete-detail-position">${athlete.details}</p>
            </div>
            ${priceHistoryHtml}
            ${statsHtml ? `<div class="athlete-stats">${statsHtml}</div>` : ''}
            <div class="athlete-bio">
                <h4>About</h4>
                <p>${athlete.bio || 'No biography available.'}</p>
            </div>
            <div class="action-buttons">
                ${actionButtonsHtml}
            </div>
        `;

        if (isOwned) {
            document.getElementById('detailSellBtn')?.addEventListener('click', () => { closeAllModals(); openSellModal(athlete); });
            document.getElementById('detailBuyMoreBtn')?.addEventListener('click', () => { closeAllModals(); openMakeOfferModal(athlete); });
        } else {
            document.getElementById('detailMakeOfferBtn')?.addEventListener('click', () => { closeAllModals(); openMakeOfferModal(athlete); });
        }

        if (hasPriceHistory) {
            const updateDetailChart = (range) => {
                const chartData = { ...athlete[range], previousClose: athlete.previousClose, currentPrice: athlete.currentPrice };
                createPriceHistoryChart(chartData, 'remodel-y-axis', 'remodelPriceChart');
            };

            content.querySelectorAll('.remodel-range-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    content.querySelectorAll('.remodel-range-btn').forEach(b => b.classList.remove('active'));
                    e.currentTarget.classList.add('active');
                    updateDetailChart(btn.dataset.range);
                });
            });

            setTimeout(() => updateDetailChart('d1'), 50); 
        }
        
        console.log('Opening athlete detail modal');
        openModal('athleteDetailModal');
    }

    // Enhanced offer modal with prospect selection and buy/sell options
    async function openEnhancedOfferModal(onOfferSubmit = null, preSelectedAthlete = null) {
        const modalTitle = document.getElementById('offerModalTitle');
        const content = document.getElementById('offerModalContent');
        if (!content || !modalTitle) return;

        modalTitle.textContent = "Create Offer";

        content.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <!-- Prospect Selection -->
                <div>
                    <label style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; display: block;">
                        Select Prospect
                    </label>
                    <select id="prospectSelect" style="width: 100%; padding: 12px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px; background: white;">
                        <option value="">Choose a prospect...</option>
                    </select>
                </div>

                <!-- Buy/Sell Toggle -->
                <div>
                    <label style="font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: 8px; display: block;">
                        Offer Type
                    </label>
                    <div style="display: flex; background: var(--color-background); border-radius: 8px; padding: 4px;">
                        <button id="buyOption" class="offer-type-btn active" data-type="buy" style="flex: 1; padding: 8px 16px; border: none; background: var(--color-primary); color: white; border-radius: 6px; font-weight: 600; cursor: pointer;">
                            Buy
                        </button>
                        <button id="sellOption" class="offer-type-btn" data-type="sell" style="flex: 1; padding: 8px 16px; border: none; background: transparent; color: var(--color-text-primary); border-radius: 6px; font-weight: 600; cursor: pointer;">
                            Sell
                        </button>
                    </div>
                </div>

                <!-- Selected Prospect Info -->
                <div id="selectedProspectInfo" style="display: none; background: var(--color-background); border-radius: 8px; padding: 16px;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                        <img id="selectedProspectAvatar" src="" alt="" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover;">
                        <div>
                            <h4 id="selectedProspectName" style="margin: 0; font-size: 18px; font-weight: 600;"></h4>
                            <p id="selectedProspectPosition" style="margin: 0; color: var(--color-text-secondary); font-size: 14px;"></p>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 14px;">
                        <span>Current Price: <strong id="selectedProspectPrice">$0.00</strong></span>
                        <span id="availabilityInfo">Available: <strong id="selectedProspectQuantity">0</strong></span>
                    </div>
                </div>

                <!-- Offer Details -->
                <div id="offerDetailsSection" style="display: none;">
                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        <div>
                            <label for="offerQuantity" style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; display: block;">
                                Quantity <span id="quantityLimit"></span>
                            </label>
                            <input type="number" id="offerQuantity" value="1" min="1" step="1"
                                style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px;">
                        </div>
                        <div>
                            <label for="offerPrice" style="font-size: 13px; color: var(--color-text-secondary); margin-bottom: 4px; display: block;">
                                Price per Share
                            </label>
                            <input type="number" id="offerPrice" value="0.00" step="0.01" min="0.01"
                                style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px;">
                        </div>
                    </div>
                    
                    <div id="totalCalculation" style="text-align: right; margin: 16px 0; padding: 16px; background: var(--color-background); border-radius: 8px;">
                        <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 8px;">
                            <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span> <span id="subtotalValue">$0.00</span></div>
                            <div id="feeRow" style="display: flex; justify-content: space-between; margin-top: 4px;"><span>Fee (1%):</span> <span id="feeValue">$0.00</span></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: var(--color-text-primary); border-top: 1px solid var(--color-border); padding-top: 8px;">
                            <span id="totalLabel">Total:</span> <span id="totalOfferValue">$0.00</span>
                        </div>
                    </div>
                </div>

                <div class="action-buttons">
                    <button class="action-button secondary" onclick="closeAllModals()">Cancel</button>
                    <button class="action-button primary" id="submitOfferBtn" disabled>Submit Offer</button>
                </div>
            </div>
        `;

        // Populate prospect dropdown
        const prospectSelect = content.querySelector('#prospectSelect');
        if (allAthletesData && allAthletesData.length > 0) {
            allAthletesData.forEach(athlete => {
                const option = document.createElement('option');
                option.value = athlete.name;
                option.textContent = `${athlete.name} - $${athlete.currentPrice.toFixed(2)}`;
                prospectSelect.appendChild(option);
            });
        }

        // Set pre-selected athlete if provided
        if (preSelectedAthlete) {
            prospectSelect.value = preSelectedAthlete.name;
            updateProspectInfo(preSelectedAthlete);
        }

        // Event handlers
        setupEnhancedOfferModalHandlers(content, onOfferSubmit);
        openModal('offerModal');
    }

    function setupEnhancedOfferModalHandlers(content, onOfferSubmit) {
        const prospectSelect = content.querySelector('#prospectSelect');
        const buyOption = content.querySelector('#buyOption');
        const sellOption = content.querySelector('#sellOption');
        const quantityInput = content.querySelector('#offerQuantity');
        const priceInput = content.querySelector('#offerPrice');
        const submitBtn = content.querySelector('#submitOfferBtn');

        let selectedOfferType = 'buy';
        let selectedAthlete = null;

        // Prospect selection handler
        prospectSelect.addEventListener('change', function() {
            const athleteName = this.value;
            if (athleteName) {
                selectedAthlete = allAthletesData.find(a => a.name === athleteName);
                if (selectedAthlete) {
                    updateProspectInfo(selectedAthlete);
                    updateOfferForm();
                }
            } else {
                selectedAthlete = null;
                content.querySelector('#selectedProspectInfo').style.display = 'none';
                content.querySelector('#offerDetailsSection').style.display = 'none';
                submitBtn.disabled = true;
            }
        });

        // Buy/Sell toggle handlers
        buyOption.addEventListener('click', function() {
            selectedOfferType = 'buy';
            updateOfferTypeUI();
            updateOfferForm();
        });

        sellOption.addEventListener('click', function() {
            selectedOfferType = 'sell';
            updateOfferTypeUI();
            updateOfferForm();
        });

        // Input handlers
        quantityInput.addEventListener('input', updateTotal);
        priceInput.addEventListener('input', updateTotal);

        // Submit handler
        submitBtn.addEventListener('click', async function() {
            if (!selectedAthlete) return;

            const quantity = parseInt(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            const total = quantity * priceVal;

            const offerDetails = {
                type: selectedOfferType,
                athlete: selectedAthlete.name,
                quantity: quantity,
                price: priceVal,
                total: total
            };

            if (onOfferSubmit) {
                // For chat offers, use callback
                onOfferSubmit(offerDetails);
            } else {
                // For direct transactions, make API call
                const result = await postData('/transactions', {
                    athleteName: selectedAthlete.name,
                    type: selectedOfferType,
                    quantity: quantity,
                    pricePerShare: priceVal
                });

                if (result && result.success) {
                    await refreshData();
                    const action = selectedOfferType === 'buy' ? 'purchase' : 'sale';
                    const fee = selectedOfferType === 'sell' ? ' (after 1% fee)' : '';
                    alert(`${selectedOfferType === 'buy' ? 'Buy' : 'Sell'} order for ${quantity.toLocaleString()} shares of ${selectedAthlete.name} placed!${fee}`);
                    closeAllModals();
                } else {
                    let errorMsg = `Failed to complete ${selectedOfferType}. Please try again.`;
                    if (result && result.error) errorMsg += `\n${result.error}`;
                    if (result && result.errors) errorMsg += '\n' + result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
                    alert(errorMsg);
                }
            }
        });

        function updateOfferTypeUI() {
            content.querySelectorAll('.offer-type-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.style.background = 'transparent';
                btn.style.color = 'var(--color-text-primary)';
            });
            
            const activeBtn = selectedOfferType === 'buy' ? buyOption : sellOption;
            activeBtn.classList.add('active');
            activeBtn.style.background = 'var(--color-primary)';
            activeBtn.style.color = 'white';
        }

        function updateProspectInfo(athlete) {
            content.querySelector('#selectedProspectInfo').style.display = 'block';
            content.querySelector('#selectedProspectAvatar').src = athlete.avatar;
            content.querySelector('#selectedProspectName').textContent = athlete.name;
            content.querySelector('#selectedProspectPosition').textContent = athlete.details;
            content.querySelector('#selectedProspectPrice').textContent = `$${athlete.currentPrice.toFixed(2)}`;
            content.querySelector('#selectedProspectQuantity').textContent = athlete.quantity.toLocaleString();
        }

        function updateOfferForm() {
            if (!selectedAthlete) return;

            content.querySelector('#offerDetailsSection').style.display = 'block';
            
            // Update labels and limits based on offer type
            const quantityLimit = content.querySelector('#quantityLimit');
            const availabilityInfo = content.querySelector('#availabilityInfo');
            const feeRow = content.querySelector('#feeRow');
            const totalLabel = content.querySelector('#totalLabel');

            if (selectedOfferType === 'buy') {
                quantityLimit.textContent = `(Available: ${selectedAthlete.quantity.toLocaleString()})`;
                availabilityInfo.innerHTML = `Available: <strong>${selectedAthlete.quantity.toLocaleString()}</strong>`;
                quantityInput.max = selectedAthlete.quantity;
                feeRow.style.display = 'none';
                totalLabel.textContent = 'Total Cost:';
            } else {
                const owned = ownershipData[selectedAthlete.name] || 0;
                quantityLimit.textContent = `(Owned: ${owned.toLocaleString()})`;
                availabilityInfo.innerHTML = `You Own: <strong>${owned.toLocaleString()}</strong>`;
                quantityInput.max = owned;
                feeRow.style.display = 'flex';
                totalLabel.textContent = 'You Receive:';
            }

            // Set default price and quantity
            priceInput.value = selectedAthlete.currentPrice.toFixed(2);
            quantityInput.value = '1';
            
            updateTotal();
            submitBtn.disabled = false;
        }

        function updateTotal() {
            const quantity = parseInt(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            const subtotal = quantity * priceVal;

            content.querySelector('#subtotalValue').textContent = `$${subtotal.toFixed(2)}`;

            if (selectedOfferType === 'buy') {
                content.querySelector('#totalOfferValue').textContent = `$${subtotal.toFixed(2)}`;
            } else {
                const fee = subtotal * 0.01;
                const total = subtotal - fee;
                content.querySelector('#feeValue').textContent = `-$${fee.toFixed(2)}`;
                content.querySelector('#totalOfferValue').textContent = `$${total.toFixed(2)}`;
            }
        }
    }

    async function openMakeOfferModal(athlete, onOfferSubmit = null) {
        const modalTitle = document.getElementById('offerModalTitle');
        const content = document.getElementById('offerModalContent');
        if (!content || !modalTitle) return;

        modalTitle.textContent = "Make Offer";
        const price = athlete.currentPrice;

        content.innerHTML = `
            <div class="athlete-detail-header" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);">
                <img src="${athlete.avatar}" alt="${athlete.name}" class="athlete-detail-image">
                <h3 class="athlete-detail-name">${athlete.name}</h3>
                <p class="athlete-detail-position">${athlete.details}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                <div>
                    <label for="offerQuantity" style="font-size: 13px; color: var(--color-text-secondary);">
                        Quantity (Available: ${athlete.quantity})
                    </label>
                    <input type="number" id="offerQuantity" value="1" min="1" max="${athlete.quantity}" step="1"
                        style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px; margin-top: 4px;">
                </div>
                <div>
                    <label for="offerPrice" style="font-size: 13px; color: var(--color-text-secondary);">
                        Price per Share (Current: $${price.toFixed(2)})
                    </label>
                    <input type="number" id="offerPrice" value="${price.toFixed(2)}" step="0.01" min="0.01"
                        style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px; margin-top: 4px;">
                </div>
            </div>
            <div style="text-align: right; margin-bottom: 24px;">
                <span style="font-size: 14px; color: var(--color-text-secondary);">Total Value:</span>
                <span id="totalOfferValue" style="font-size: 20px; font-weight: 700; color: var(--color-text-primary);">
                    $${price.toFixed(2)}
                </span>
            </div>
            <div class="action-buttons">
                <button class="action-button secondary" onclick="closeAllModals()">Cancel</button>
                <button class="action-button primary" id="submitBuyOfferBtn">Submit Offer</button>
            </div>
        `;

        const quantityInput = content.querySelector('#offerQuantity');
        const priceInput = content.querySelector('#offerPrice');
        const totalValueDisplay = content.querySelector('#totalOfferValue');
        const submitBtn = content.querySelector('#submitBuyOfferBtn');

        function updateTotal() {
            const quantity = parseInt(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            totalValueDisplay.textContent = `$${(quantity * priceVal).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        quantityInput.addEventListener('input', updateTotal);
        priceInput.addEventListener('input', updateTotal);

        submitBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            const totalCost = quantity * priceVal;

            if (typeof onOfferSubmit === 'function') {
                onOfferSubmit({
                    quantity: quantity,
                    price: priceVal,
                    total: totalCost
                });
            } else {
                // Make API call to record transaction
                const result = await postData('/transactions', {
                    athleteName: athlete.name,
                    type: 'buy',
                    quantity: quantity,
                    pricePerShare: priceVal
                });

                if (result && result.success) {
                    // Re-fetch all data from backend to ensure state is up to date
                    await refreshData();
                    alert(`Successfully purchased ${quantity.toLocaleString()} shares of ${athlete.name}!`);
                    closeAllModals();
                } else {
                    let errorMsg = 'Failed to complete purchase. Please try again.';
                    if (result && result.error) errorMsg += `\n${result.error}`;
                    if (result && result.errors) errorMsg += '\n' + result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
                    alert(errorMsg);
                }
            }
        });

        openModal('offerModal');
    }

    async function openSellModal(athlete) {
        const modalTitle = document.getElementById('offerModalTitle');
        const content = document.getElementById('offerModalContent');
        if (!content || !modalTitle) return;

        modalTitle.textContent = "Sell Shares";
        const price = athlete.currentPrice;
        const sharesOwned = ownershipData[athlete.name] || 0;

        content.innerHTML = `
            <div class="athlete-detail-header" style="margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--color-border);">
                <img src="${athlete.avatar}" alt="${athlete.name}" class="athlete-detail-image">
                <h3 class="athlete-detail-name">${athlete.name}</h3>
                <p class="athlete-detail-position">${athlete.details}</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px;">
                <div>
                    <label for="sellQuantity" style="font-size: 13px; color: var(--color-text-secondary);">Quantity to Sell (You Own: ${sharesOwned})</label>
                    <input type="number" id="sellQuantity" value="1" min="1" max="${sharesOwned}" step="1" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px; margin-top: 4px;">
                </div>
                <div>
                    <label for="sellPrice" style="font-size: 13px; color: var(--color-text-secondary);">Price per Share (Current: ${price.toFixed(2)})</label>
                    <input type="number" id="sellPrice" value="${price.toFixed(2)}" step="0.01" min="0.01" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid var(--color-border); font-size: 16px; margin-top: 4px;">
                </div>
            </div>
            <div style="font-size: 14px; color: var(--color-text-secondary); margin-bottom: 24px; text-align: right;">
                <div style="display: flex; justify-content: space-between;"><span>Order Total:</span> <span id="totalSellValue">${price.toFixed(2)}</span></div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--color-border); padding-bottom: 8px; margin-bottom: 8px;"><span>Fee (1%):</span> <span id="sellFeeValue" style="color: var(--color-danger);">${(price * 0.01).toFixed(2)}</span></div>
                <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: 700; color: var(--color-text-primary);"><span>You Receive:</span> <span id="sellProceedsValue">${(price * 0.99).toFixed(2)}</span></div>
            </div>
            <div class="action-buttons">
                <button class="action-button secondary" onclick="closeAllModals()">Cancel</button>
                <button class="action-button primary" id="submitSellOfferBtn">Place Sell Order</button>
            </div>
        `;

        const quantityInput = content.querySelector('#sellQuantity');
        const priceInput = content.querySelector('#sellPrice');
        const totalValueDisplay = content.querySelector('#totalSellValue');
        const feeDisplay = content.querySelector('#sellFeeValue');
        const proceedsDisplay = content.querySelector('#sellProceedsValue');
        const submitBtn = content.querySelector('#submitSellOfferBtn');

        function updateTotal() {
            const quantity = parseFloat(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            const orderTotal = quantity * priceVal;
            const fee = orderTotal * 0.01;
            const proceeds = orderTotal - fee;

            totalValueDisplay.textContent = `${orderTotal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            feeDisplay.textContent = `-${fee.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
            proceedsDisplay.textContent = `${proceeds.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        }

        quantityInput.addEventListener('input', updateTotal);
        priceInput.addEventListener('input', updateTotal);

        submitBtn.addEventListener('click', async () => {
            const quantity = parseInt(quantityInput.value) || 0;
            const priceVal = parseFloat(priceInput.value) || 0;
            const proceeds = (quantity * priceVal) * 0.99;

            // Make API call to record transaction
            const result = await postData('/transactions', {
                athleteName: athlete.name,
                type: 'sell',
                quantity: quantity,
                pricePerShare: priceVal
            });

            if (result && result.success) {
                // Re-fetch all data from backend to ensure state is up to date
                await refreshData();
                alert(`Sell order for ${quantity.toLocaleString()} shares of ${athlete.name} placed! You will receive $${proceeds.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} after a 1% fee.`);
                closeAllModals();
            } else {
                let errorMsg = 'Failed to complete sale. Please try again.';
                if (result && result.error) errorMsg += `\n${result.error}`;
                if (result && result.errors) errorMsg += '\n' + result.errors.map(e => `${e.field}: ${e.message}`).join('\n');
                alert(errorMsg);
            }
        });

        openModal('offerModal');
    }

    function openActivityOfferModal(details) {
        const modalTitle = document.getElementById('offerModalTitle');
        const content = document.getElementById('offerModalContent');
        if (!content || !modalTitle) return;

        modalTitle.textContent = "View Offer Details";
        
        // Check if this is your own offer (sent) or someone else's (received)
        const isOwnOffer = details.isOwnOffer || false;
        
        let actionButtonsHtml = '';
        if (isOwnOffer) {
            // For your own offers, only show Cancel button
            actionButtonsHtml = `
                <button class="action-button secondary" onclick="closeAllModals()">Cancel</button>
            `;
        } else {
            // For received offers, show Reject and Accept buttons
            actionButtonsHtml = `
                <button class="action-button secondary" onclick="closeAllModals()">Reject</button>
                <button class="action-button primary" id="acceptOfferBtn">Accept</button>
            `;
        }
        
        content.innerHTML = `
            <div class="card" style="margin:0; box-shadow: none;">
                <h2 class="card-title" style="font-size:16px;">Offer from a Fan</h2>
                    <p style="color: var(--color-text-secondary);">${details.position}</p>
                    <h3 style="font-size:20px; margin-bottom: 12px;">${details.athlete}</h3>
                    <p style="color: var(--color-text-secondary);">Price: <span style="color: var(--color-text-primary); font-weight: 600;">${details.price}</span></p>
                    <p style="color: var(--color-text-secondary);">Quantity: <span style="color: var(--color-text-primary); font-weight: 600;">${details.quantity} Shares</span></p>
                    <p style="color: var(--color-text-secondary);">Total: <span style="color: var(--color-text-primary); font-weight: 600;">${details.totalValue}</span></p>
            </div>
            <div class="action-buttons">
                ${actionButtonsHtml}
            </div>
        `;
        
        // Add accept offer functionality
        if (!isOwnOffer) {
            const acceptBtn = content.querySelector('#acceptOfferBtn');
            if (acceptBtn) {
                acceptBtn.addEventListener('click', async () => {
                    try {
                        acceptBtn.disabled = true;
                        acceptBtn.textContent = 'Accepting...';
                        
                        const response = await postData(`/messages/${details.conversationId}/accept-offer/${details.messageId}`, {});
                        
                        if (response && response.success) {
                            alert(`Offer accepted! ${response.tradeDetails.quantity} shares of ${response.tradeDetails.athleteName} transferred for $${response.tradeDetails.totalAmount.toFixed(2)}`);
                            closeAllModals();
                            
                            // Refresh the chat if we're in one
                            if (currentChatUser) {
                                await openChat(currentChatUser.id);
                            }
                            
                            // Refresh data to update balances and ownership
                            await loadInitialData();
                        } else {
                            alert('Failed to accept offer: ' + (response.error || 'Unknown error'));
                            acceptBtn.disabled = false;
                            acceptBtn.textContent = 'Accept';
                        }
                    } catch (error) {
                        console.error('Error accepting offer:', error);
                        alert('Failed to accept offer. Please try again.');
                        acceptBtn.disabled = false;
                        acceptBtn.textContent = 'Accept';
                    }
                });
            }
        }
        
        openModal('offerModal');
    }

    // Chart and graph functions (restored)
    function createPriceHistoryChart(chartData, yAxisContainerId, canvasId) {
        const yAxisContainer = document.getElementById(yAxisContainerId);
        const canvas = document.getElementById(canvasId);
        if (!canvas || !yAxisContainer) return;

        const { data, previousClose, currentPrice } = chartData;
        const allValues = [...data, previousClose];
        const max = Math.max(...allValues);
        const min = Math.min(...allValues);
        yAxisContainer.innerHTML = '';
        const labelCount = 4;
        const range = max - min;

        for (let i = labelCount; i >= 0; i--) {
            const labelValue = min + (range / labelCount) * i;
            let formattedLabel;
            if (range < 50) {
                formattedLabel = `${Math.round(labelValue)}`;
            } else if (labelValue >= 1000) {
                formattedLabel = `${(labelValue / 1000).toFixed(1)}K`;
            } else {
                formattedLabel = `${Math.round(labelValue)}`;
            }
            yAxisContainer.innerHTML += `<span>${formattedLabel}</span>`;
        }
        const ctx = canvas.getContext('2d');
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = canvas.parentElement.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const chartRange = range === 0 ? 1 : range;
        const xStep = canvas.width / (data.length > 1 ? data.length - 1 : 1);
        const getY = val => canvas.height - ((val - min) / chartRange) * (canvas.height * 0.9) - (canvas.height * 0.05);
        const prevCloseY = getY(previousClose);
        ctx.beginPath();
        ctx.setLineDash([2, 3]);
        ctx.moveTo(0, prevCloseY);
        ctx.lineTo(canvas.width, prevCloseY);
        ctx.strokeStyle = '#8E8E93';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        const chartColor = currentPrice >= previousClose ? '#34C759' : '#FF3B30';
        ctx.beginPath();
        data.forEach((val, i) => {
            const x = i * xStep;
            const yPos = getY(val);
            if (i === 0) ctx.moveTo(x, yPos);
            else ctx.lineTo(x, yPos);
        });
        ctx.strokeStyle = chartColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    // --- PATCH START: Move these to the top, before showPage ---

    let calculatePortfolioHistory = async function(range = 'm1') {
        const historyData = await fetchData(`/portfolio/history/${range}`);
        if (!historyData) {
            return { labels: [], values: [] };
        }
        return historyData;
    };

    let updatePortfolioChart = async function(range) {
        const portfolioHistory = await calculatePortfolioHistory(range);
        const xAxisContainer = document.getElementById('portfolio-x-axis');
        if (portfolioHistory.values.length === 0) {
            document.getElementById('portfolio-y-axis').innerHTML = '';
            xAxisContainer.innerHTML = 'No portfolio data available.';
            const canvas = document.getElementById('portfolioChart');
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        const chartData = {
            data: portfolioHistory.values,
            labels: portfolioHistory.labels,
            previousClose: portfolioHistory.values[0],
            currentPrice: portfolioHistory.values[portfolioHistory.values.length - 1]
        };
        xAxisContainer.innerHTML = '';
        portfolioHistory.labels.forEach(label => {
            xAxisContainer.innerHTML += `<span class="chart-label">${label}</span>`;
        });
        createPriceHistoryChart(chartData, 'portfolio-y-axis', 'portfolioChart');
    };

    let realCalculatePortfolioHistory = calculatePortfolioHistory;
    calculatePortfolioHistory = async function(range = 'm1') {
        return realCalculatePortfolioHistory(range);
    };
    // --- PATCH END ---

    // Initialization
    loadInitialData();

    // Add tab bar event listeners
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            const pageId = tab.dataset.page;
            if (pageId) {
                // Update active tab
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active sidebar item (in case desktop view is used)
                document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
                const correspondingSidebarItem = document.querySelector(`.sidebar-nav-item[data-page="${pageId}"]`);
                if (correspondingSidebarItem) {
                    correspondingSidebarItem.classList.add('active');
                }
                
                // Show the page
                showPage(pageId);
            }
        });
    });

    // Add sidebar navigation event listeners (for desktop)
    document.querySelectorAll('.sidebar-nav-item').forEach(sidebarItem => {
        sidebarItem.addEventListener('click', () => {
            const pageId = sidebarItem.dataset.page;
            if (pageId) {
                // Update active sidebar item
                document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
                sidebarItem.classList.add('active');
                
                // Update active mobile tab (in case mobile view is used)
                document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
                const correspondingTab = document.querySelector(`.tab-item[data-page="${pageId}"]`);
                if (correspondingTab) {
                    correspondingTab.classList.add('active');
                }
                
                // Show the page
                showPage(pageId);
            }
        });
    });

    // Add header button event listeners
    document.getElementById('headerProfileBtn')?.addEventListener('click', () => {
        showPage('account');
        // Update active tab and sidebar
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
        const profileSidebarItem = document.querySelector('.sidebar-nav-item[data-page="account"]');
        if (profileSidebarItem) profileSidebarItem.classList.add('active');
    });

    document.getElementById('headerMessagesBtn')?.addEventListener('click', () => {
        showPage('messages');
        // Update active tab and sidebar
        document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.sidebar-nav-item').forEach(item => item.classList.remove('active'));
        const messagesSidebarItem = document.querySelector('.sidebar-nav-item[data-page="messages"]');
        if (messagesSidebarItem) messagesSidebarItem.classList.add('active');
    });

    // Add pill filter event listeners
    document.querySelectorAll('.pill[data-filter]').forEach(pill => {
        pill.addEventListener('click', () => {
            const filter = pill.dataset.filter;
            const page = pill.closest('.page-content')?.classList[1]?.replace('-page', '');
            
            // Update active pill
            pill.closest('.pills-container')?.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            // Apply filter based on page
            if (page === 'dashboard') {
                // Show/hide stats and portfolio based on filter
                const statsGrid = document.getElementById('dashboardStatsGrid');
                const portfolioCard = document.getElementById('portfolioCard');
                
                if (filter === 'my-prospects') {
                    // Hide stats and portfolio when viewing my prospects
                    if (statsGrid) statsGrid.style.display = 'none';
                    if (portfolioCard) portfolioCard.style.display = 'none';
                } else {
                    // Show stats and portfolio when viewing portfolio
                    if (statsGrid) statsGrid.style.display = 'grid';
                    if (portfolioCard) portfolioCard.style.display = 'block';
                }
                
                populateProspects(filter);
            } else if (page === 'activities') {
                filterActivities(filter);
            } else if (page === 'offers') {
                filterOffers(filter);
            }
        });
    });

    // Add portfolio range button event listeners
    document.querySelectorAll('.range-btn[data-range]').forEach(btn => {
        btn.addEventListener('click', () => {
            const range = btn.dataset.range;
            // Update active button
            btn.closest('.range-btn-container')?.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Update chart
            updatePortfolioChart(range);
        });
    });

    // Add filter button event listeners
    document.getElementById('exploreFilterBtn')?.addEventListener('click', () => {
        const filterMenu = document.getElementById('exploreFilterMenu');
        if (filterMenu) {
            const isHidden = filterMenu.style.display === 'none' || filterMenu.style.display === '';
            filterMenu.style.display = isHidden ? 'block' : 'none';
        }
    });

    // Note: offersFilterBtn is handled by the global click listener and setupOffersFilters function

    // Add sports filter event listeners
    document.querySelectorAll('.sport-item').forEach(sport => {
        sport.addEventListener('click', () => {
            const sportType = sport.dataset.sport;
            const isActive = sport.classList.contains('active');
            
            // Toggle active state
            document.querySelectorAll('.sport-item').forEach(s => s.classList.remove('active'));
            if (!isActive) {
                sport.classList.add('active');
            }
            
            // Update the sport filter dropdown to match the clicked sport
            const sportFilter = document.getElementById('offerSportFilter');
            if (sportFilter) {
                sportFilter.value = isActive ? 'all' : sportType;
            }
            
            // Filter offers by sport since sport items are now on offers page
            filterOffers();
        });
    });

    // Add banner carousel functionality
    let currentCarouselIndex = 0;
    const carouselItems = document.querySelectorAll('.carousel-item');
    const carouselTrack = document.getElementById('carouselTrack');
    const bannerDots = document.getElementById('bannerDots');
    
    // Create carousel dots
    if (bannerDots && carouselItems.length > 0) {
        carouselItems.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `carousel-dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => {
                currentCarouselIndex = index;
                updateCarousel();
            });
            bannerDots.appendChild(dot);
        });
    }
    
    function updateCarousel() {
        if (carouselTrack && carouselItems.length > 0) {
            carouselTrack.style.transform = `translateX(-${currentCarouselIndex * 100}%)`;
            // Update dots
            document.querySelectorAll('.carousel-dot').forEach((dot, index) => {
                dot.classList.toggle('active', index === currentCarouselIndex);
            });
        }
    }

    // Auto-advance carousel
    setInterval(() => {
        if (carouselItems.length > 0) {
            currentCarouselIndex = (currentCarouselIndex + 1) % carouselItems.length;
            updateCarousel();
        }
    }, 5000);

    // Add click outside to close functionality
    function setupModalClickOutside() {
        console.log('Setting up modal click outside handlers');
        
        // Use event delegation on the document to catch all clicks
        document.addEventListener('click', function(e) {
            console.log('Document clicked, target:', e.target);
            
            // Check if click is on modal overlay
            if (e.target.id === 'modalOverlay') {
                console.log('Modal overlay clicked, closing all modals');
                closeAllModals();
            }
            
            // Check if click is on auth modal overlay
            if (e.target.id === 'authModalOverlay') {
                console.log('Auth modal overlay clicked, closing auth modal');
                closeAuthModal();
            }
        });
        
        // Also add specific handlers as backup
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            console.log('Found modalOverlay, adding click handler');
            modalOverlay.addEventListener('click', function(e) {
                console.log('Modal overlay clicked, target:', e.target);
                // Only close if clicking on the overlay itself, not on modal content
                if (e.target === modalOverlay) {
                    console.log('Closing all modals');
                    closeAllModals();
                }
            });
        } else {
            console.log('modalOverlay not found');
        }
        
        // Also add for auth modal overlay
        const authModalOverlay = document.getElementById('authModalOverlay');
        if (authModalOverlay) {
            console.log('Found authModalOverlay, adding click handler');
            authModalOverlay.addEventListener('click', function(e) {
                console.log('Auth modal overlay clicked, target:', e.target);
                // Only close if clicking on the overlay itself, not on modal content
                if (e.target === authModalOverlay) {
                    console.log('Closing auth modal');
                    closeAuthModal();
                }
            });
        } else {
            console.log('authModalOverlay not found');
        }
    }

    // Call setup immediately
    setupModalClickOutside();
    
    // Also call on DOMContentLoaded as backup
    document.addEventListener('DOMContentLoaded', setupModalClickOutside);

    // --- Real Messaging Logic ---
    let messagesData = [];

    // Global variable to track current chat user
    let currentChatUser = null;

    // Load messages from API
    async function loadMessages() {
        try {
            const data = await fetchData('/messages');
            if (data) {
                messagesData = data;
                populateMessages();
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        }
    }

    // New message modal functions
    function showNewMessageModal() {
        openModal('newMessageModal');
        setTimeout(() => {
            document.getElementById('newMessageUsername').focus();
        }, 100);
    }

    function closeNewMessageModal() {
        closeAllModals();
        document.getElementById('newMessageForm').reset();
        document.getElementById('userSearchResults').innerHTML = '';
    }

    window.closeNewMessageModal = closeNewMessageModal;

    // Search users as you type
    async function searchUsers(query) {
        if (query.length < 2) {
            document.getElementById('userSearchResults').innerHTML = '';
            return;
        }

        try {
            const data = await fetchData(`/users/search/${encodeURIComponent(query)}`);
            if (data && data.success) {
                displayUserSearchResults(data.data);
            }
        } catch (error) {
            console.error('Error searching users:', error);
        }
    }

    function displayUserSearchResults(users) {
        const resultsContainer = document.getElementById('userSearchResults');
        resultsContainer.innerHTML = '';

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
            return;
        }

        users.forEach(user => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'user-search-result';
            resultDiv.innerHTML = `
                <img src="${user.avatar || 'images/image_48fb0979.png'}" alt="${user.name}">
                <div>
                    <div class="user-name">${user.name}</div>
                    <div class="user-username clickable-username" data-username="${user.username}">@${user.username}</div>
                </div>
            `;
            
            resultDiv.addEventListener('click', (e) => {
                // If they clicked on the username, show profile; otherwise select for messaging
                if (e.target.classList.contains('clickable-username')) {
                    showUserProfile(user.username);
                } else {
                    selectUser(user.username);
                }
            });
            
            resultsContainer.appendChild(resultDiv);
        });
    }

    function selectUser(username) {
        document.getElementById('newMessageUsername').value = username;
        document.getElementById('userSearchResults').innerHTML = '';
    }

    // Create new conversation
    async function createNewConversation(username) {
        try {
            const response = await postData('/messages/new', { username });
            if (response && response.success) {
                closeNewMessageModal();
                // Reload messages and open the new conversation
                await loadMessages();
                openChat(response.data.id);
            } else {
                alert('Error creating conversation: ' + (response?.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error creating conversation:', error);
            alert('Error creating conversation. Please try again.');
        }
    }

    // Helper function to calculate relative time
    function getRelativeTime(timestamp) {
        const now = new Date();
        const messageTime = new Date(timestamp);
        const diffMs = now - messageTime;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffMinutes < 1) return 'now';
        if (diffMinutes < 60) return `${diffMinutes}m`;
        if (diffHours < 24) return `${diffHours}h`;
        if (diffDays < 7) return `${diffDays}d`;
        return messageTime.toLocaleDateString();
    }

    // Helper function to get the most recent message from a conversation
    function getMostRecentMessage(messages) {
        if (!messages || messages.length === 0) return null;
        return messages[messages.length - 1];
    }

    // Helper function to format message preview text
    function getMessagePreview(message) {
        if (!message) return 'No messages';
        if (message.text) return message.text;
        if (message.offer) return 'Sent an offer';
        return 'No messages';
    }

    // Helper function to determine if a conversation has unread messages
    function hasUnreadMessages(userData) {
        const messages = userData.messages;
        if (!messages || messages.length === 0) return false;
        const mostRecentMessage = messages[messages.length - 1];
        
        // Show as unread if the most recent message was received (not sent by user)
        // and the conversation hasn't been marked as read
        if (mostRecentMessage.sent === false) {
            // If there's a lastReadTime, check if the last message is newer
            if (userData.lastReadTime) {
                const lastMessageTime = new Date(mostRecentMessage.time);
                const lastReadTime = new Date(userData.lastReadTime);
                return lastMessageTime > lastReadTime;
            }
            // If no read time tracking, default to unread
            return true;
        }
        return false;
    }

    async function populateMessages(searchQuery = '') {
        console.log('populateMessages called with searchQuery:', searchQuery);
        const list = document.getElementById('messagesList');
        if (!list) {
            console.error('Messages list not found!');
            return;
        }

        // Load messages from API if not already loaded or if we need fresh data
        if (messagesData.length === 0) {
            await loadMessages();
        }

        console.log('Messages data:', messagesData);
        console.log('Messages data length:', messagesData.length);

        list.innerHTML = '';
        const filteredMessages = searchQuery
            ? messagesData.filter(msg => msg.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                         (msg.username && msg.username.toLowerCase().includes(searchQuery.toLowerCase())))
            : messagesData;

        console.log('Filtered messages:', filteredMessages);
        console.log('Filtered messages length:', filteredMessages.length);

        if (filteredMessages.length === 0) {
            list.innerHTML = '<div class="no-messages">No conversations yet. Start a new message!</div>';
            return;
        }

        filteredMessages.forEach(msg => {
            console.log('Creating message item for:', msg.name);
            
            const item = document.createElement('div');
            item.className = 'message-item';
            
            // Display username if it's a user conversation, otherwise name
            const displayName = msg.conversationType === 'user-to-user' && msg.username 
                ? `@${msg.username}` 
                : msg.name;
            
            item.innerHTML = `
                <img src="${msg.avatar || 'images/image_48fb0979.png'}" alt="${msg.name}" class="message-avatar">
                <div class="message-info">
                    <div class="message-name">${displayName}</div>
                    <div class="message-preview">${msg.lastMessage || 'No messages'}</div>
                </div>
                <div class="message-meta">
                    <div class="message-time">${msg.time}</div>
                    ${msg.unread ? '<div class="message-unread"></div>' : ''}
                </div>
            `;
            
            item.addEventListener('click', () => {
                console.log('Message clicked for:', msg.name);
                openChat(msg.id);
            });
            
            list.appendChild(item);
        });

        console.log('Messages populated successfully. Total items:', list.children.length);
    }

    // Function to update timestamps in real-time
    function updateMessageTimestamps() {
        const messageTimeElements = document.querySelectorAll('.message-time');
        const messageItems = document.querySelectorAll('.message-item');
        
        messageItems.forEach((item, index) => {
            const timeElement = item.querySelector('.message-time');
            if (timeElement && messagesData[index]) {
                const mostRecentMessage = getMostRecentMessage(messagesData[index].messages);
                if (mostRecentMessage) {
                    const newRelativeTime = getRelativeTime(mostRecentMessage.time);
                    timeElement.textContent = newRelativeTime;
                }
            }
        });
    }

    // Set up periodic timestamp updates (every minute)
    setInterval(updateMessageTimestamps, 60000);

    async function openChat(userId) {
        console.log('Opening chat for user:', userId);
        
        // Load fresh conversation data from API
        const conversationData = await fetchData(`/messages/${userId}`);
        if (!conversationData) {
            console.error('Failed to load conversation data');
            return;
        }
        
        // Update the conversation in messagesData with fresh data
        const userIndex = messagesData.findIndex(u => u.id === userId);
        if (userIndex !== -1) {
            messagesData[userIndex] = conversationData;
        }
        
        const user = conversationData;
        currentChatUser = user;
        
        // Join conversation room for real-time updates
        joinConversation(userId);
        
        // Update chat header
        document.getElementById('fullScreenChatAvatar').src = user.avatar;
        document.getElementById('fullScreenChatName').textContent = user.name;
        document.getElementById('fullScreenChatStatus').textContent = 'Active now';
        
        // Render messages
        const messagesContainer = document.getElementById('fullScreenChatMessages');
        if (!messagesContainer) {
            console.error('Chat messages container not found');
            return;
        }
        
        messagesContainer.innerHTML = user.messages.map(msg => {
            let offerHtml = '';
            if (msg.offer) {
                const offerDataString = JSON.stringify(msg.offer);
                const messageDataString = JSON.stringify({ 
                    sent: msg.sent, 
                    messageId: msg._id,
                    conversationId: user.id 
                });
                let buttonsHtml = '';
                if (msg.sent) {
                    buttonsHtml = `<button class="chat-offer-btn secondary view-offer-btn" data-offer='${offerDataString}' data-message='${messageDataString}'>View Details</button>`;
                } else {
                    buttonsHtml = `
                        <button class="chat-offer-btn secondary counter-offer-btn" data-offer='${offerDataString}' data-message='${messageDataString}'>Counter Offer</button>
                        <button class="chat-offer-btn secondary view-offer-btn" data-offer='${offerDataString}' data-message='${messageDataString}'>View Details</button>
                    `;
                }
                const offerType = msg.offer.type ? msg.offer.type.toUpperCase() : 'BUY';
                const titleText = msg.sent ? `${offerType} Offer Sent` : `${offerType} Offer Received`;
                
                offerHtml = `
                    <div class="chat-offer-card">
                        <div class="chat-offer-title">${titleText}</div>
                        <div class="chat-offer-details">${msg.offer.athlete}</div>
                        <div class="chat-offer-details">${msg.offer.price} × ${msg.offer.quantity} shares</div>
                        <div class="chat-offer-details">Total: ${msg.offer.total}</div>
                        <div class="chat-offer-actions">${buttonsHtml}</div>
                    </div>
                `;
            }

            const messageContent = msg.text ? `<div class="message-bubble-modern">${msg.text}</div>` : '';
            const timeDisplay = msg.time ? `<div class="message-time-modern">${msg.time}</div>` : '';
            
            // Determine if message was sent by current user based on sender ID comparison
            const senderId = msg.sender?._id || msg.sender;
            const currentUserId = currentUser?.id || currentUser?._id;
            const isSent = currentUser && senderId && (senderId.toString() === currentUserId.toString());
            
            return `
                <div class="chat-message-modern ${isSent ? 'sent' : 'received'}">
                    ${messageContent}
                    ${offerHtml}
                    ${timeDisplay}
                </div>
            `;
        }).join('');
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Ensure scroll to bottom after a small delay to account for rendering
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
        
        // Show chat page
        document.getElementById('chatPage').style.display = 'flex';
        
        // Hide header and tab bar on mobile, but keep sidebar visible on desktop
        if (window.innerWidth < 768) {
            document.querySelector('.header').style.display = 'none';
            document.querySelector('.tab-bar').style.display = 'none';
        } else {
            // On desktop, only hide header but keep sidebar visible
            document.querySelector('.header').style.display = 'none';
            document.querySelector('.tab-bar').style.display = 'none';
            // Ensure sidebar stays visible on desktop
            const sidebar = document.querySelector('.desktop-sidebar');
            if (sidebar) {
                sidebar.style.display = 'flex';
            }
        }
        
        console.log('Chat opened successfully for:', user.name);
    }

    function hideChatPage() {
        console.log('Hiding chat page');
        document.getElementById('chatPage').style.display = 'none';
        if (window.innerWidth < 768) {
            document.querySelector('.header').style.display = 'flex';
            document.querySelector('.tab-bar').style.display = 'flex';
            document.getElementById('headerProfileBtn').style.display = 'block';
        } else {
            document.querySelector('.header').style.display = 'none';
            document.querySelector('.tab-bar').style.display = 'none';
            document.getElementById('headerProfileBtn').style.display = 'none';
            // Ensure sidebar stays visible on desktop
            const sidebar = document.querySelector('.desktop-sidebar');
            if (sidebar) {
                sidebar.style.display = 'flex';
            }
        }
        currentChatUser = null;
        
        // Refresh the messages list to update previews and activity dots
        populateMessages();
        
        // Clear any modal restore flags since we're leaving the chat
        const modalOverlay = document.getElementById('modalOverlay');
        if (modalOverlay) {
            delete modalOverlay.dataset.restoreChat;
        }
    }

    async function sendMessage() {
        const input = document.getElementById('fullScreenChatInput');
        if (!input || !currentChatUser) {
            console.log('No input or current chat user');
            return;
        }
        
        const text = input.value.trim();
        if (!text) {
            console.log('Empty message');
            return;
        }
        
        // Clear input immediately for better UX
        input.value = '';
        
        try {
            // Send message to backend API
            const response = await postData(`/messages/${currentChatUser.id}`, { text });
            
            if (response && response.success) {
                console.log('Message sent successfully:', response.message);
                
                // Refresh the chat with latest data
                await openChat(currentChatUser.id);
                
                // Refresh the messages list to update previews
                await loadMessages();
                
            } else {
                console.error('Failed to send message:', response);
                // Re-add text to input if sending failed
                input.value = text;
            }
        } catch (error) {
            console.error('Error sending message:', error);
            // Re-add text to input if sending failed
            input.value = text;
        }
    }

    document.getElementById('fullScreenSendChatBtn').onclick = sendMessage;
    // --- End Ported Messaging Logic ---

    // Add event listeners for chat functionality
    const sendChatBtn = document.getElementById('sendChatBtn');
    if (sendChatBtn) {
        sendChatBtn.addEventListener('click', sendMessage);
    }

    const chatBackBtn = document.getElementById('chatBackBtn');
    if (chatBackBtn) {
        chatBackBtn.addEventListener('click', hideChatPage);
    }

    const msgSearchInput2 = document.querySelector('.messages-page .search-input');
    if (msgSearchInput2) {
        msgSearchInput2.addEventListener('input', (e) => populateMessages(e.target.value));
    }

    // Chat offer button in input
    const fullScreenMakeChatOfferBtn = document.getElementById('fullScreenMakeChatOfferBtn');
    if (fullScreenMakeChatOfferBtn) {
        fullScreenMakeChatOfferBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (!currentChatUser) return;
            
            const handleOfferSubmitInChat = async (offerDetails) => {
                try {
                    // Format the offer text based on type
                    const offerText = offerDetails.type === 'buy' ? 'Buy offer sent' : 'Sell offer sent';
                    
                    // Prepare offer data
                    const messageData = {
                        text: offerText,
                        offer: {
                            type: offerDetails.type,
                            price: `$${offerDetails.price.toFixed(2)}`,
                            quantity: offerDetails.quantity,
                            total: `$${offerDetails.total.toFixed(2)}`,
                            athlete: `${offerDetails.athlete} Shares`
                        }
                    };
                    
                    console.log('Sending message data:', messageData);
                    console.log('Conversation ID:', currentChatUser.id);
                    
                    // Send offer message to backend API
                    const response = await postData(`/messages/${currentChatUser.id}`, messageData);
                    
                    if (response && response.success) {
                        console.log('Offer sent successfully:', response.message);
                        closeAllModals();
                        
                        // Refresh the chat with latest data
                        await openChat(currentChatUser.id);
                        
                        // Refresh the messages list to update previews
                        await loadMessages();
                    } else {
                        console.error('Failed to send offer:', response);
                        alert('Failed to send offer. Please try again.');
                    }
                } catch (error) {
                    console.error('Error sending offer:', error);
                    alert('Failed to send offer. Please try again.');
                }
            };
            
            // Use the enhanced modal that allows prospect selection and buy/sell choice
            openEnhancedOfferModal(handleOfferSubmitInChat);
        });
    }

    // Chat offer/counter-offer/view-offer buttons in chat
    const fullScreenChatMessages = document.getElementById('fullScreenChatMessages');
    if (fullScreenChatMessages) {
        fullScreenChatMessages.addEventListener('click', (e) => {
            const button = e.target.closest('.chat-offer-btn');
            if (!button) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const offerDetails = JSON.parse(button.dataset.offer);
            const messageData = JSON.parse(button.dataset.message);
            const athleteName = offerDetails.athlete.replace(' Shares', '');
            const athlete = allAthletesData.find(a => a.name === athleteName);
            
            // Find the message element to determine sender
            const messageElement = button.closest('.chat-message-modern');
            const isOwnOffer = messageElement && messageElement.classList.contains('sent');
            
            if (button.classList.contains('view-offer-btn')) {
                const displayDetails = {
                    athlete: athleteName,
                    position: athlete ? athlete.details : 'N/A',
                    quantity: offerDetails.quantity,
                    price: offerDetails.price,
                    totalValue: offerDetails.total,
                    isOwnOffer: isOwnOffer, // Pass whether this is your own offer
                    conversationId: messageData.conversationId,
                    messageId: messageData.messageId
                };
                openActivityOfferModal(displayDetails);
            } else if (button.classList.contains('counter-offer-btn')) {
                const handleOfferSubmitInChat = async (newOfferDetails) => {
                    try {
                        const offerText = newOfferDetails.type === 'buy' ? 'Counter buy offer sent' : 'Counter sell offer sent';
                        
                        // Send counter-offer message to backend API
                        const response = await postData(`/messages/${currentChatUser.id}`, {
                            text: offerText,
                            offer: {
                                type: newOfferDetails.type,
                                price: `$${newOfferDetails.price.toFixed(2)}`,
                                quantity: newOfferDetails.quantity,
                                total: `$${newOfferDetails.total.toFixed(2)}`,
                                athlete: `${newOfferDetails.athlete} Shares`
                            }
                        });
                        
                        if (response && response.success) {
                            console.log('Counter-offer sent successfully:', response.message);
                            closeAllModals();
                            
                            // Refresh the chat with latest data
                            await openChat(currentChatUser.id);
                            
                            // Refresh the messages list to update previews
                            await loadMessages();
                        } else {
                            console.error('Failed to send counter-offer:', response);
                            alert('Failed to send counter-offer. Please try again.');
                        }
                    } catch (error) {
                        console.error('Error sending counter-offer:', error);
                        alert('Failed to send counter-offer. Please try again.');
                    }
                };
                
                // Use enhanced modal, pre-selected with the original offer's athlete if available
                if (athlete) {
                    openEnhancedOfferModal(handleOfferSubmitInChat, athlete);
                } else {
                    openEnhancedOfferModal(handleOfferSubmitInChat);
                }
            }
        });
    }

    // Add event listener for message search
    const msgSearchInput = document.querySelector('.messages-page .search-input');
    if (msgSearchInput) {
        msgSearchInput.addEventListener('input', (e) => populateMessages(e.target.value));
    }
    // Add event listener for chat input (Enter to send)
    const fullScreenChatInput = document.getElementById('fullScreenChatInput');
    if (fullScreenChatInput) {
        fullScreenChatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // Add improved chat styling
    const chatStyles = `
    <style>
    /* Ensure modal overlay appears above chat page */
    #modalOverlay {
        z-index: 10000 !important;
        background: rgba(0, 0, 0, 0.5) !important;
        backdrop-filter: blur(2px);
    }
    
    /* Chat page should have lower z-index */
    #chatPage {
        z-index: 1000;
    }
    
    /* When modal is open, ensure chat page stays visible but non-interactive */
    #modalOverlay.active ~ #chatPage,
    #modalOverlay.active + #chatPage {
        pointer-events: none;
    }
    
    /* Improved Chat Modal Styling */
    #chatModal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        backdrop-filter: blur(5px);
    }

    #chatModal.show {
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .chat-container {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        height: 80%;
        max-height: 600px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        overflow: hidden;
    }

    .chat-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 16px 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .chat-header img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.3);
    }

    .chat-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }

    .chat-close {
        margin-left: auto;
        background: none;
        border: none;
        color: white;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    }

    .chat-close:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #f8f9fa;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .chat-message {
        display: flex;
        flex-direction: column;
        max-width: 80%;
    }

    .chat-message.sent {
        align-self: flex-end;
        align-items: flex-end;
    }

    .chat-message.received {
        align-self: flex-start;
        align-items: flex-start;
    }

    .message-bubble {
        background: white;
        padding: 12px 16px;
        border-radius: 18px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        margin-bottom: 4px;
        word-wrap: break-word;
        max-width: 100%;
    }

    .chat-message.sent .message-bubble {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    .chat-message.received .message-bubble {
        background: white;
        color: #333;
        border: 1px solid #e9ecef;
    }

    .message-time {
        font-size: 11px;
        color: #6c757d;
        margin-top: 2px;
    }

    .chat-input-container {
        padding: 16px 20px;
        background: white;
        border-top: 1px solid #e9ecef;
        display: flex;
        gap: 12px;
        align-items: flex-end;
    }

    .chat-input-wrapper {
        flex: 1;
        position: relative;
    }

    .chat-input {
        width: 100%;
        min-height: 40px;
        max-height: 120px;
        padding: 10px 12px;
        border: 2px solid #e9ecef;
        border-radius: 20px;
        resize: none;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.4;
        outline: none;
        transition: border-color 0.2s;
    }

    .chat-input:focus {
        border-color: #667eea;
    }

    .chat-send-btn {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: transform 0.2s;
        flex-shrink: 0;
    }

    .chat-send-btn:hover {
        transform: scale(1.05);
    }

    .chat-send-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none;
    }

    /* Offer Card Styling */
    .chat-offer-card {
        background: white;
        border: 2px solid #e9ecef;
        border-radius: 12px;
        padding: 16px;
        margin: 8px 0;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .chat-offer-title {
        font-weight: 600;
        color: #495057;
        margin-bottom: 8px;
        font-size: 14px;
    }

    .chat-offer-details {
        color: #6c757d;
        font-size: 13px;
        margin-bottom: 4px;
    }

    .chat-offer-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
    }

    .chat-offer-btn {
        padding: 8px 16px;
        border: 1px solid #000;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
        background: #fff;
        color: #000;
    }

    .chat-offer-btn.primary {
        background: #fff;
        color: #000;
        border: 1px solid #000;
    }

    .chat-offer-btn.secondary {
        background: #fff;
        color: #000;
        border: 1px solid #000;
    }

    .chat-offer-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        background: #f8f9fa;
    }

    /* Messages List Styling */
    #messagesList {
        max-height: 400px;
        overflow-y: auto;
    }

    .message-item {
        display: flex;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background 0.2s;
    }

    .message-item:hover {
        background: #f8f9fa;
    }

    .message-avatar {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        margin-right: 12px;
        object-fit: cover;
    }

    .message-info {
        flex: 1;
        min-width: 0;
    }

    .message-name {
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 4px;
        font-size: 14px;
    }

    .message-preview {
        color: #5f6368;
        font-size: 13px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .message-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 4px;
    }

    .message-time {
        font-size: 11px;
        color: #9aa0a6;
    }

    .message-unread {
        width: 8px;
        height: 8px;
        background: #ea4335;
        border-radius: 50%;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
        .chat-container {
            width: 95%;
            height: 90%;
            max-height: none;
        }
        
        .chat-message {
            max-width: 90%;
        }
    }
    </style>
    `;

    // Inject the styles
    document.head.insertAdjacentHTML('beforeend', chatStyles);



    // --- New Chat Modal CSS ---
    const chatModalStyles = `
    <style>
    #chatModal {
      display: none;
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 1000;
      background: transparent !important;
      align-items: center;
      justify-content: center;
    }
    #chatModal.show {
      display: flex;
    }
    .chat-container-new {
      background: #fff;
      border-radius: 24px;
      width: 100%;
      max-width: 400px;
      height: 95vh;
      margin: auto;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      overflow: hidden;
    }
    .chat-header-new {
      display: flex;
      align-items: center;
      padding: 18px 16px 12px 12px;
      background: #fff;
      border-bottom: 1px solid #f1f1f1;
    }
    .chat-back-btn {
      background: none;
      border: none;
      font-size: 22px;
      margin-right: 8px;
      cursor: pointer;
      color: #222;
    }
    .chat-header-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      margin-right: 12px;
      object-fit: cover;
      border: 2px solid #eee;
    }
    .chat-header-info {
      flex: 1;
    }
    .chat-header-name {
      font-size: 17px;
      font-weight: 700;
      color: #222;
    }
    .chat-header-status {
      font-size: 13px;
      color: #888;
    }
    .chat-header-actions {
      display: flex;
      gap: 8px;
    }
    .chat-header-icon {
      background: none;
      border: none;
      font-size: 20px;
      color: #222;
      cursor: pointer;
      margin-left: 4px;
    }
    .chat-messages-new {
      flex: 1;
      overflow-y: auto;
      background: #f7f7f9;
      padding: 18px 10px 12px 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .chat-bubble-new {
      max-width: 80%;
      padding: 12px 18px;
      border-radius: 22px;
      font-size: 15px;
      margin-bottom: 2px;
      word-break: break-word;
      display: inline-block;
      position: relative;
    }
    .chat-bubble-new.sent {
      align-self: flex-end;
      background: #111;
      color: #fff;
      border-bottom-right-radius: 8px;
    }
    .chat-bubble-new.received {
      align-self: flex-start;
      background: #f1f1f1;
      color: #222;
      border-bottom-left-radius: 8px;
    }
    .bubble-time {
      text-align: center;
      color: #888;
      font-size: 12px;
      margin: 10px 0 2px 0;
    }
    .offer-bubble {
      font-weight: 500;
      text-align: left;
    }
    .chat-offer-btns {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .bubble-btn {
      border: 1.5px solid #222;
      background: #fff;
      color: #222;
      border-radius: 8px;
      padding: 6px 16px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .bubble-btn:hover {
      background: #222;
      color: #fff;
    }
    .bubble-btn:not(:last-child) {
      margin-right: 4px;
    }
    .chat-bubble-new.sent .bubble-btn {
      border: 1.5px solid #fff;
      background: #111;
      color: #fff;
    }
    .chat-bubble-new.sent .bubble-btn:hover {
      background: #fff;
      color: #111;
    }
    .chat-input-bar {
      display: flex;
      align-items: center;
      padding: 12px 14px;
      background: #fff;
      border-top: 1px solid #f1f1f1;
      gap: 8px;
    }
    .chat-input-new {
      flex: 1;
      border: none;
      border-radius: 20px;
      background: #f1f1f1;
      padding: 10px 16px;
      font-size: 15px;
      outline: none;
      margin-right: 4px;
    }
    .chat-input-icon {
      background: none;
      border: none;
      font-size: 20px;
      color: #888;
      cursor: pointer;
      margin-left: 2px;
    }
    @media (max-width: 500px) {
      .chat-container-new {
        max-width: 100vw;
        height: 100vh;
        border-radius: 0;
      }
    }
    </style>
    `;
    document.head.insertAdjacentHTML('beforeend', chatModalStyles);
    // --- End New Chat Modal CSS ---

    // Ensure all modals have the 'modal' class on page load
    window.addEventListener('DOMContentLoaded', function() {
        document.querySelectorAll('[id$="Modal"]').forEach(modal => {
            if (!modal.classList.contains('modal')) modal.classList.add('modal');
        });
    });

    // --- Modern Full-Screen Chat Page Logic ---
    window.showChatPage = function(userId) {
        // Use the existing openChat function instead of duplicating logic
        openChat(userId);
    };

    window.hideChatPage = function() {
        hideChatPage();
    };

    // Remove duplicate event listeners - these are already handled above
    // document.getElementById('chatBackBtn').onclick = window.hideChatPage;
    // --- End Modern Full-Screen Chat Page Logic ---

    // Remove duplicate event listeners - these are already handled above
    // const sendChatBtn = document.getElementById('sendChatBtn');
    // if (sendChatBtn) {
    //     sendChatBtn.addEventListener('click', sendMessage);
    // }

    // const chatBackBtn = document.getElementById('chatBackBtn');
    // if (chatBackBtn) {
    //     chatBackBtn.addEventListener('click', hideChatPage);
    // }

    // const msgSearchInput2 = document.querySelector('.messages-page .search-input');
    // if (msgSearchInput2) {
    //     msgSearchInput2.addEventListener('input', (e) => populateMessages(e.target.value));
    // }

    // If global data is available (from data.js), use it as the initial data source
    if (window.FAN_SCOUT_DATA) allAthletesData = window.FAN_SCOUT_DATA;
    if (window.ownershipData) ownershipData = window.ownershipData;
    if (window.messagesData) messagesData = window.messagesData;
    if (window.transactionHistory) transactionHistory = window.transactionHistory;

    // =================================================
    // PROFILE SETTINGS FUNCTIONALITY
    // =================================================
    
    // Open profile settings modal
    function openProfileSettings() {
        if (!currentUser) {
            console.error('No user data available');
            return;
        }
        
        // Populate form with current user data
        console.log('Populating profile form with user:', currentUser);
        document.getElementById('profileName').value = currentUser.name || '';
        document.getElementById('profileUsername').value = currentUser.username || '';
        document.getElementById('profileEmail').value = currentUser.email || '';
        document.getElementById('currentProfilePic').src = currentUser.avatar || 'images/image_48fb0979.png';
        
        // Set portfolio privacy toggle based on user data
        const portfolioToggle = document.getElementById('portfolioPrivacyToggle');
        if (portfolioToggle) {
            portfolioToggle.checked = currentUser.portfolio?.isPublic !== false; // Default to true if not set
        }
        console.log('Form populated with username:', currentUser.username);
        console.log('Username field value:', document.getElementById('profileUsername').value);
        
        openModal('profileSettingsModal');
    }
    
    // Update profile display with real user data
    function updateProfileDisplay() {
        if (!currentUser) return;
        
        console.log('Updating profile display with user:', currentUser);
        
        // Update profile page elements
        const accountAvatar = document.querySelector('.account-avatar');
        const accountUsername = document.querySelector('.account-username');
        const accountName = document.querySelector('.account-name');
        const accountEmail = document.querySelector('.account-email');
        const headerAvatar = document.getElementById('headerProfileBtn');
        const followersCount = document.getElementById('account-followers-count');
        const followingCount = document.getElementById('account-following-count');
        
        if (accountAvatar) accountAvatar.src = currentUser.avatar || 'images/image_48fb0979.png';
        if (accountUsername) {
            const displayUsername = currentUser.username || 'user';
            accountUsername.textContent = `@${displayUsername}`;
            console.log('Updated username to:', accountUsername.textContent);
            console.log('Current user username value:', currentUser.username);
        }
        if (accountName) accountName.textContent = currentUser.name || 'User';
        if (accountEmail) accountEmail.textContent = currentUser.email || '';
        if (headerAvatar) headerAvatar.src = currentUser.avatar || 'images/image_48fb0979.png';
        if (followersCount) followersCount.textContent = currentUser.followersCount || '0';
        if (followingCount) followingCount.textContent = currentUser.followingCount || '0';
        
        // Update portfolio stats with real data
        updatePortfolioStats();
    }
    
    // Update portfolio stats on profile page
    async function updatePortfolioStats() {
        try {
            const data = await fetchData('/portfolio/stats');
            if (data) {
                const totalSharesElement = document.querySelector('.account-stat-value');
                const portfolioValueElement = document.querySelectorAll('.account-stat-value')[2];
                const accountBalanceElement = document.getElementById('profile-account-balance');
                
                // Count unique athletes from ownership data
                let uniqueAthletes = 0;
                if (ownershipData) {
                    for (const [athleteName, shares] of Object.entries(ownershipData)) {
                        if (shares > 0) {
                            uniqueAthletes++;
                        }
                    }
                }
                
                if (totalSharesElement) totalSharesElement.textContent = data.totalShares.toLocaleString();
                if (document.querySelectorAll('.account-stat-value')[1]) {
                    document.querySelectorAll('.account-stat-value')[1].textContent = uniqueAthletes;
                }
                if (portfolioValueElement) portfolioValueElement.textContent = `$${(data.totalValue/1000).toFixed(1)}K`;
                if (accountBalanceElement) accountBalanceElement.textContent = `$${accountBalance.toFixed(2)}`;
            }
        } catch (error) {
            console.error('Error fetching portfolio stats:', error);
            // Fallback to local data
            const totalSharesElement = document.querySelector('.account-stat-value');
            const portfolioValueElement = document.querySelectorAll('.account-stat-value')[2];
            
            let totalShares = 0;
            let totalValue = 0;
            let uniqueAthletes = 0;
            
            if (ownershipData && allAthletesData) {
                for (const [athleteName, shares] of Object.entries(ownershipData)) {
                    if (shares > 0) {
                        uniqueAthletes++;
                        totalShares += shares;
                        
                        const athlete = allAthletesData.find(a => a.name === athleteName);
                        if (athlete) {
                            totalValue += shares * athlete.currentPrice;
                        }
                    }
                }
            }
            
            if (totalSharesElement) totalSharesElement.textContent = totalShares.toLocaleString();
            if (document.querySelectorAll('.account-stat-value')[1]) {
                document.querySelectorAll('.account-stat-value')[1].textContent = uniqueAthletes;
            }
            if (portfolioValueElement) portfolioValueElement.textContent = `$${(totalValue/1000).toFixed(1)}K`;
            
            // Update account balance in profile
            const accountBalanceElement = document.getElementById('profile-account-balance');
            if (accountBalanceElement) accountBalanceElement.textContent = `$${accountBalance.toFixed(2)}`;
        }
    }
    
    // Logout function
    function logout() {
        localStorage.removeItem('authToken');
        authToken = null;
        currentUser = null;
        showAuthModal();
        showPage('dashboard');
    }

    // Handle profile settings menu click
    document.addEventListener('click', (e) => {
        if (e.target.closest('.account-menu-item') && 
            e.target.closest('.account-menu-item').querySelector('.account-menu-label')?.textContent === 'Profile Settings') {
            openProfileSettings();
        }
        
        // Handle logout menu click
        if (e.target.closest('.account-menu-item') && 
            e.target.closest('.account-menu-item').querySelector('.account-menu-label')?.textContent === 'Log Out') {
            logout();
        }
    });
    
    // Handle profile picture upload
    document.getElementById('changePictureBtn')?.addEventListener('click', () => {
        document.getElementById('profilePictureInput').click();
    });
    
    document.getElementById('profilePictureInput')?.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const formData = new FormData();
        formData.append('avatar', file);
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/upload-avatar`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Update preview and current user data
                    document.getElementById('currentProfilePic').src = `assets/${result.data.avatar}`;
                    currentUser.avatar = result.data.avatar;
                    updateProfileDisplay();
                    alert('Profile picture updated successfully!');
                } else {
                    alert('Failed to upload picture: ' + (result.error || 'Unknown error'));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Failed to upload picture: ' + (errorData.error || 'Server error'));
            }
        } catch (error) {
            console.error('Upload error:', error);
            alert('Failed to upload picture. Please try again.');
        }
    });
    
    // Handle profile form submission
    document.getElementById('profileSettingsForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('profileName').value,
            username: document.getElementById('profileUsername').value,
            email: document.getElementById('profileEmail').value
        };
        
        const portfolioToggle = document.getElementById('portfolioPrivacyToggle');
        const portfolioIsPublic = portfolioToggle ? portfolioToggle.checked : true;
        
        console.log('Form data being submitted:', formData);
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/updatedetails`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Profile update result:', result);
                if (result.success) {
                    // Update current user data
                    currentUser = { ...currentUser, ...result.data };
                    console.log('Updated currentUser:', currentUser);
                    
                    // Update portfolio privacy setting separately
                    try {
                        const privacyResponse = await fetch(`${API_BASE_URL}/portfolio/privacy`, {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${authToken}`
                            },
                            body: JSON.stringify({ isPublic: portfolioIsPublic })
                        });
                        
                        if (privacyResponse.ok) {
                            const privacyResult = await privacyResponse.json();
                            console.log('Portfolio privacy update result:', privacyResult);
                            // Update current user portfolio data
                            if (currentUser.portfolio) {
                                currentUser.portfolio.isPublic = portfolioIsPublic;
                            } else {
                                currentUser.portfolio = { isPublic: portfolioIsPublic };
                            }
                        } else {
                            console.log('Portfolio privacy update failed');
                        }
                    } catch (privacyError) {
                        console.error('Portfolio privacy update error:', privacyError);
                    }
                    
                    updateProfileDisplay();
                    closeAllModals();
                    alert('Profile updated successfully!');
                } else {
                    console.log('Profile update failed:', result);
                    alert('Failed to update profile: ' + (result.error || 'Unknown error'));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Failed to update profile: ' + (errorData.error || 'Server error'));
            }
        } catch (error) {
            console.error('Update error:', error);
            alert('Failed to update profile. Please try again.');
        }
    });
    
    // Handle password change form submission
    document.getElementById('passwordChangeForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (newPassword !== confirmPassword) {
            alert('New passwords do not match!');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/updatepassword`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    currentPassword,
                    newPassword
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    // Clear form
                    document.getElementById('passwordChangeForm').reset();
                    alert('Password changed successfully!');
                } else {
                    alert('Failed to change password: ' + (result.error || 'Unknown error'));
                }
            } else {
                const errorData = await response.json().catch(() => ({}));
                alert('Failed to change password: ' + (errorData.error || 'Server error'));
            }
        } catch (error) {
            console.error('Password change error:', error);
            alert('Failed to change password. Please try again.');
        }
    });

    // New Message functionality event listeners
    const newMessageBtn = document.getElementById('newMessageBtn');
    if (newMessageBtn) {
        newMessageBtn.addEventListener('click', showNewMessageModal);
    }

    const newMessageForm = document.getElementById('newMessageForm');
    if (newMessageForm) {
        newMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('newMessageUsername').value.trim();
            if (username) {
                await createNewConversation(username);
            }
        });
    }

    const newMessageUsername = document.getElementById('newMessageUsername');
    if (newMessageUsername) {
        let searchTimeout;
        newMessageUsername.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                searchUsers(e.target.value.trim());
            }, 300);
        });
    }

    // Messages search input
    const messagesSearchInput = document.getElementById('messagesSearchInput');
    if (messagesSearchInput) {
        messagesSearchInput.addEventListener('input', (e) => {
            populateMessages(e.target.value);
        });
    }

    // User Profile functionality
    let currentProfileUser = null;

    async function showUserProfile(username) {
        try {
            const data = await fetchData(`/users/${username}`);
            if (data && data.success) {
                currentProfileUser = data.data;
                populateUserProfile(currentProfileUser);
                
                // Hide current page and show user profile
                document.querySelectorAll('.page-content').forEach(page => page.classList.remove('active'));
                document.getElementById('userProfilePage').style.display = 'block';
            } else {
                alert('User not found');
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            alert('Error loading user profile');
        }
    }

    function populateUserProfile(user) {
        document.getElementById('userProfileAvatar').src = user.avatar || 'images/image_48fb0979.png';
        document.getElementById('userProfileUsername').textContent = `@${user.username}`;
        document.getElementById('userProfileName').textContent = user.name;
        document.getElementById('userProfileFollowersCount').textContent = user.followersCount;
        document.getElementById('userProfileFollowingCount').textContent = user.followingCount;
        
        const joinedDate = new Date(user.createdAt);
        document.getElementById('userProfileJoinedDate').textContent = joinedDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        // Update follow button
        const followBtn = document.getElementById('followBtn');
        if (user.isFollowing) {
            followBtn.textContent = 'Following';
            followBtn.classList.add('following');
        } else {
            followBtn.textContent = 'Follow';
            followBtn.classList.remove('following');
        }
        
        // Populate followers and following lists
        populateUserList('followersList', user.followers);
        populateUserList('followingList', user.following);
    }

    function populateUserList(containerId, users) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';
        
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 20px;">No users to show</p>';
            return;
        }
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            userItem.innerHTML = `
                <img src="${user.avatar || 'images/image_48fb0979.png'}" alt="${user.name}">
                <div class="user-list-item-info">
                    <div class="user-list-item-username">@${user.username}</div>
                    <div class="user-list-item-name">${user.name}</div>
                </div>
            `;
            
            userItem.addEventListener('click', () => {
                showUserProfile(user.username);
            });
            
            container.appendChild(userItem);
        });
    }

    async function toggleFollow() {
        if (!currentProfileUser) return;
        
        try {
            const endpoint = currentProfileUser.isFollowing ? 'unfollow' : 'follow';
            const data = await postData(`/users/${endpoint}/${currentProfileUser.username}`, {});
            
            if (data && data.success) {
                // Update the profile to reflect the change
                await showUserProfile(currentProfileUser.username);
            } else {
                alert('Error updating follow status');
            }
        } catch (error) {
            console.error('Error toggling follow:', error);
            alert('Error updating follow status');
        }
    }

    async function messageUser() {
        if (!currentProfileUser) return;
        
        try {
            const response = await postData('/messages/new', { username: currentProfileUser.username });
            if (response && response.success) {
                // Hide user profile and show messages
                hideUserProfile();
                showPage('messages');
                // Load messages and open the conversation
                await loadMessages();
                openChat(response.data.id);
            } else {
                alert('Error starting conversation');
            }
        } catch (error) {
            console.error('Error starting conversation:', error);
            alert('Error starting conversation');
        }
    }

    function hideUserProfile() {
        document.getElementById('userProfilePage').style.display = 'none';
        currentProfileUser = null;
    }

    // Event listeners for user profile page
    const userProfileBackBtn = document.getElementById('userProfileBackBtn');
    if (userProfileBackBtn) {
        userProfileBackBtn.addEventListener('click', () => {
            hideUserProfile();
            showPage('messages'); // Go back to messages or wherever they came from
        });
    }

    const followBtn = document.getElementById('followBtn');
    if (followBtn) {
        followBtn.addEventListener('click', toggleFollow);
    }

    const messageBtn = document.getElementById('messageBtn');
    if (messageBtn) {
        messageBtn.addEventListener('click', messageUser);
    }

    // Profile tabs functionality
    const userProfileTabs = document.querySelectorAll('.user-profile-tab');
    userProfileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // Update tab active state
            userProfileTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update content active state
            document.querySelectorAll('.user-profile-tab-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(tabName + 'Tab').classList.add('active');
        });
    });

    // Make usernames clickable in search results
    function makeUsernameClickable(username) {
        return `<span class="clickable-username" data-username="${username}">@${username}</span>`;
    }

    // Add click handlers for clickable usernames
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('clickable-username')) {
            const username = e.target.dataset.username;
            showUserProfile(username);
        }
    });

    // =================================================
    // FOLLOWERS/FOLLOWING MODAL FUNCTIONALITY
    // =================================================
    
    // Function to show followers/following modal
    async function showFollowersModal(type) {
        if (!currentUser) {
            console.error('No current user data available');
            return;
        }
        
        try {
            // Fetch current user's complete profile data including followers/following
            const data = await fetchData(`/users/${currentUser.username}`);
            if (data && data.success) {
                const userData = data.data;
                const title = type === 'followers' ? 'Followers' : 'Following';
                const users = type === 'followers' ? userData.followers : userData.following;
                
                // Update modal title
                document.getElementById('followersModalTitle').textContent = title;
                
                // Populate the list
                populateFollowersModal(users);
                
                // Show the modal
                openModal('followersModal');
            } else {
                alert('Error loading ' + type);
            }
        } catch (error) {
            console.error('Error loading ' + type + ':', error);
            alert('Error loading ' + type);
        }
    }
    
    // Function to populate the followers/following modal content
    function populateFollowersModal(users) {
        const container = document.getElementById('followersListContent');
        container.innerHTML = '';
        
        if (users.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--color-text-secondary); padding: 40px 20px;">No users to show</p>';
            return;
        }
        
        users.forEach(user => {
            const userItem = document.createElement('div');
            userItem.className = 'user-list-item';
            userItem.innerHTML = `
                <img src="${user.avatar || 'images/image_48fb0979.png'}" alt="${user.name}">
                <div class="user-list-item-info">
                    <div class="user-list-item-username clickable-username" data-username="${user.username}">@${user.username}</div>
                    <div class="user-list-item-name">${user.name}</div>
                </div>
            `;
            
            userItem.addEventListener('click', () => {
                closeAllModals();
                showUserProfile(user.username);
            });
            
            container.appendChild(userItem);
        });
    }
    
    // Add click handlers for followers/following stats
    const followersStatElement = document.getElementById('followers-stat');
    if (followersStatElement) {
        followersStatElement.addEventListener('click', () => {
            showFollowersModal('followers');
        });
    }
    
    const followingStatElement = document.getElementById('following-stat');
    if (followingStatElement) {
        followingStatElement.addEventListener('click', () => {
            showFollowersModal('following');
        });
    }
    
    // Profile display will be updated after data loads in loadInitialData/refreshData

    //========================================
    //          SOCIAL FEED FUNCTIONALITY
    //========================================
    // SOCIAL MEDIA FUNCTIONALITY - START
    //========================================
    // Social feed data and state management
    let socialFeedData = {
        following: [],
        recommended: [],
        currentTab: 'following',
        currentPage: 1,
        hasMorePages: true,
        isLoading: false
    };

    // Initialize social feed when the explore tab is shown
    function initializeSocialFeed() {
        console.log('Initializing social feed...');
        
        // Set up tab switching
        setupFeedTabSwitching();
        
        // Set up create post button
        setupCreatePostButton();
        
        // Set up create post form handler
        setupCreatePostForm();
        
        // Set up search functionality
        setupSocialSearch();
        
        // Set up image click handlers
        setupImageClickHandlers();
        
        // Load initial posts
        loadSocialFeedPosts();
        
        // Set up WebSocket listeners for real-time updates
        setupSocialWebSocketListeners();
    }

    // Set up feed tab switching functionality
    function setupFeedTabSwitching() {
        console.log('Setting up feed tab switching...');
        const feedTabs = document.querySelectorAll('.feed-tab');
        console.log('Found feed tabs:', feedTabs.length);
        
        feedTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                console.log('Feed tab clicked:', this.dataset.feed);
                const feedType = this.dataset.feed;
                
                // Remove active class from all tabs
                feedTabs.forEach(t => {
                    t.classList.remove('active');
                    t.style.background = 'transparent';
                    t.style.color = 'var(--color-text-secondary)';
                });
                
                // Add active class to clicked tab
                this.classList.add('active');
                this.style.background = 'var(--color-primary)';
                this.style.color = 'white';
                
                // Update current tab and reload posts
                socialFeedData.currentTab = feedType;
                socialFeedData.currentPage = 1;
                socialFeedData.hasMorePages = true;
                
                loadSocialFeedPosts();
            });
        });
    }

    // Set up create post button
    function setupCreatePostButton() {
        console.log('Setting up create post button...');
        const createPostBtn = document.getElementById('createPostBtn');
        console.log('Create post button element:', createPostBtn);
        if (createPostBtn) {
            createPostBtn.addEventListener('click', function() {
                console.log('Create post button clicked!');
                showCreatePostModal();
            });
            console.log('Create post button event listener added');
        } else {
            console.error('Create post button not found!');
        }
    }

    // Set up create post form handler
    function setupCreatePostForm() {
        console.log('Setting up create post form...');
        const createPostForm = document.getElementById('createPostForm');
        const postTextArea = document.getElementById('postText');
        const submitBtn = document.getElementById('createPostSubmit');
        
        console.log('Create post form element:', createPostForm);
        console.log('Post text area:', postTextArea);
        console.log('Submit button:', submitBtn);
        
        if (createPostForm) {
            createPostForm.addEventListener('submit', handleCreatePost);
            console.log('Create post form event listener added');
        } else {
            console.error('Create post form not found!');
        }
        
        // Enable/disable submit button based on text content
        if (postTextArea && submitBtn) {
            const updateSubmitButton = () => {
                const hasText = postTextArea.value.trim().length > 0;
                submitBtn.disabled = !hasText;
            };
            
            postTextArea.addEventListener('input', updateSubmitButton);
            postTextArea.addEventListener('keyup', updateSubmitButton);
            
            // Initial check
            updateSubmitButton();
        }
    }

    // Set up image click handlers using event delegation
    function setupImageClickHandlers() {
        console.log('Setting up image click handlers...');
        
        // Use document-level event delegation to catch all image clicks
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('clickable-image')) {
                e.preventDefault();
                e.stopPropagation();
                const imageUrl = e.target.getAttribute('data-image-url');
                console.log('Image clicked via delegation:', imageUrl);
                if (imageUrl) {
                    openImageModal(imageUrl);
                }
            }
            // Also handle old-style onclick images
            if (e.target.classList.contains('post-image')) {
                e.preventDefault();
                e.stopPropagation();
                const imageUrl = e.target.src || e.target.getAttribute('data-image-url');
                console.log('Post image clicked:', imageUrl);
                if (imageUrl) {
                    openImageModal(imageUrl);
                }
            }
        });
        console.log('Document-level image click event listener added');
    }

    // Set up social search functionality
    function setupSocialSearch() {
        const searchInput = document.getElementById('exploreSearchInput');
        if (searchInput) {
            let searchTimeout;
            
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                const query = this.value.trim();
                
                // Debounce search by 300ms
                searchTimeout = setTimeout(() => {
                    if (query.length > 0) {
                        performSocialSearch(query);
                    } else {
                        loadSocialFeedPosts(); // Show normal feed when search is cleared
                    }
                }, 300);
            });
        }
    }

    // Load social feed posts
    async function loadSocialFeedPosts(append = false) {
        if (socialFeedData.isLoading) return;
        
        try {
            socialFeedData.isLoading = true;
            showLoadingState(!append);
            
            const endpoint = socialFeedData.currentTab === 'following' 
                ? `/posts/feed?type=following&page=${socialFeedData.currentPage}&limit=10`
                : `/posts/feed?type=recommended&page=${socialFeedData.currentPage}&limit=10`;
            
            const response = await fetchData(endpoint);
            
            if (response && response.success) {
                const posts = response.data || [];
                const hasMore = response.pagination?.hasMore || false;
                
                if (append) {
                    socialFeedData[socialFeedData.currentTab] = [...socialFeedData[socialFeedData.currentTab], ...posts];
                } else {
                    socialFeedData[socialFeedData.currentTab] = posts;
                }
                
                socialFeedData.hasMorePages = hasMore;
                displaySocialFeedPosts(socialFeedData[socialFeedData.currentTab]);
            } else {
                // Fallback to sample data if API fails
                displaySamplePosts();
            }
        } catch (error) {
            console.error('Error loading social feed posts:', error);
            displaySamplePosts();
        } finally {
            socialFeedData.isLoading = false;
            hideLoadingState();
        }
    }

    // Display social feed posts
    function displaySocialFeedPosts(posts) {
        const postsContainer = document.getElementById('postsFeed');
        if (!postsContainer) return;
        
        if (posts.length === 0) {
            postsContainer.innerHTML = `
                <div style="text-align: center; padding: 60px 20px; color: var(--color-text-secondary);">
                    <div style="font-size: 18px; margin-bottom: 8px;">No posts yet</div>
                    <div style="font-size: 14px;">
                        ${socialFeedData.currentTab === 'following' 
                            ? 'Follow some athletes to see their posts here' 
                            : 'Check back later for recommended posts'}
                    </div>
                </div>
            `;
            return;
        }
        
        postsContainer.innerHTML = '';
        
        posts.forEach(post => {
            const postElement = createPostElement(post);
            postsContainer.appendChild(postElement);
        });
        
        // Add infinite scroll functionality
        setupInfiniteScroll();
    }

    // Create individual post element
    function createPostElement(post) {
        const postDiv = document.createElement('div');
        postDiv.className = 'post-item';
        postDiv.dataset.postId = post._id;
        
        const timeAgo = formatTimeAgo(post.createdAt);
        const isLiked = post.isLikedBy || false;
        const likeCount = post.metrics?.likes || 0;
        const commentCount = post.metrics?.comments || 0;
        
        postDiv.innerHTML = `
            <div class="post-header">
                <img src="${post.author.avatar || 'images/placeholder_athlete.png'}" alt="${post.author.name}" class="post-avatar">
                <div class="post-author-info">
                    <div class="post-author-name clickable-username" data-username="${post.author.username}">${post.author.name}</div>
                    <div class="post-author-handle">@${post.author.username}</div>
                </div>
                <div class="post-time">${timeAgo}</div>
            </div>
            
            <div class="post-content">
                <p class="post-text">${formatPostTextWithAthleteLinks(post.content.text)}</p>
                ${post.content.media && post.content.media.length > 0 ? renderPostMedia(post.content.media) : ''}
            </div>
            
            <div class="post-actions">
                <button class="post-action-btn like-btn ${isLiked ? 'liked' : ''}" onclick="togglePostLike('${post._id}', this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                    <span class="like-count">${likeCount}</span>
                </button>
                
                <button class="post-action-btn comment-btn" onclick="togglePostComments('${post._id}', this)">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <span class="comment-count">${commentCount}</span>
                </button>
                
                <button class="post-action-btn share-btn" onclick="sharePost('${post._id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                        <path d="M16 6l-4-4-4 4"></path>
                        <path d="M12 2v13"></path>
                    </svg>
                </button>
            </div>
            
            <div class="post-comments" id="comments-${post._id}" style="display: none;">
                <div class="comments-loading" style="text-align: center; padding: 20px; color: var(--color-text-secondary);">
                    Loading comments...
                </div>
            </div>
        `;
        
        // Add click handler for username
        const usernameElement = postDiv.querySelector('.clickable-username');
        if (usernameElement) {
            usernameElement.addEventListener('click', function() {
                showUserProfile(this.dataset.username);
            });
        }
        
        return postDiv;
    }

    // Display sample posts when API is not available
    function displaySamplePosts() {
        const samplePosts = [
            {
                _id: 'sample-1',
                author: {
                    name: 'Sarah Johnson',
                    username: 'sarahj',
                    avatar: 'images/image_48fb0979.png'
                },
                content: { text: 'Just bought more shares! Patrick Mahomes performance this season has been incredible. Looking forward to seeing how his value grows! 📈' },
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
                metrics: { likes: 24, comments: 8 },
                isLikedBy: false
            },
            {
                _id: 'sample-2',
                author: {
                    name: 'Mike Chen',
                    username: 'mikechen',
                    avatar: 'images/image_35233afa.png'
                },
                content: { text: 'The market is heating up! Who else is watching the rally? Caitlin Clark stock has been on fire this month 🔥' },
                createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
                metrics: { likes: 156, comments: 32 },
                isLikedBy: true
            },
            {
                _id: 'sample-3',
                author: {
                    name: 'Alex Rivera',
                    username: 'alexr',
                    avatar: 'images/image_559e5c83.png'
                },
                content: { text: 'New to Fanscout and loving the community! Any tips for a beginner on which athletes to watch?' },
                createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
                metrics: { likes: 89, comments: 45 },
                isLikedBy: false
            }
        ];
        
        displaySocialFeedPosts(samplePosts);
    }

    // Toggle post like
    async function togglePostLike(postId, buttonElement) {
        if (!currentUser) {
            showAuthModal();
            return;
        }
        
        const likeCountElement = buttonElement.querySelector('.like-count');
        const currentCount = parseInt(likeCountElement.textContent) || 0;
        const isLiked = buttonElement.classList.contains('liked');
        
        // Optimistic UI update
        if (isLiked) {
            buttonElement.classList.remove('liked');
            likeCountElement.textContent = Math.max(0, currentCount - 1);
        } else {
            buttonElement.classList.add('liked');
            likeCountElement.textContent = currentCount + 1;
        }
        
        try {
            const endpoint = `/posts/${postId}/like`;
            const response = await postData(endpoint, {});
            
            if (response && response.success) {
                // Update with accurate server data
                likeCountElement.textContent = response.data.likesCount;
                if (response.data.isLiked) {
                    buttonElement.classList.add('liked');
                } else {
                    buttonElement.classList.remove('liked');
                }
            } else {
                // Revert optimistic update on failure
                if (isLiked) {
                    buttonElement.classList.add('liked');
                    likeCountElement.textContent = currentCount;
                } else {
                    buttonElement.classList.remove('liked');
                    likeCountElement.textContent = Math.max(0, currentCount);
                }
            }
        } catch (error) {
            console.error('Error toggling like:', error);
            // Revert optimistic update on error
            if (isLiked) {
                buttonElement.classList.add('liked');
                likeCountElement.textContent = currentCount;
            } else {
                buttonElement.classList.remove('liked');
                likeCountElement.textContent = currentCount;
            }
        }
    }

    // Toggle post comments visibility and load them
    async function togglePostComments(postId, buttonElement) {
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (!commentsContainer) return;
        
        if (commentsContainer.style.display === 'none') {
            commentsContainer.style.display = 'block';
            await loadPostComments(postId);
        } else {
            commentsContainer.style.display = 'none';
        }
    }

    // Load post comments
    async function loadPostComments(postId) {
        console.log('Loading comments for post:', postId);
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (!commentsContainer) {
            console.log('Comments container not found for post:', postId);
            return;
        }
        
        try {
            const response = await fetchData(`/posts/${postId}/comments`);
            console.log('Comments API response:', response);
            
            if (response && response.success) {
                const comments = response.data || [];
                console.log('Comments to display:', comments);
                displayPostComments(postId, comments);
            } else {
                console.log('API failed, showing sample comments');
                // Show sample comments
                displaySampleComments(postId);
            }
        } catch (error) {
            console.error('Error loading comments:', error);
            displaySampleComments(postId);
        }
    }

    // Display post comments
    function displayPostComments(postId, comments) {
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (!commentsContainer) return;
        
        let commentsHTML = '';
        
        // Add comment input if user is logged in
        if (currentUser) {
            commentsHTML += `
                <div class="comment-input-container">
                    <img src="${currentUser.avatar || 'images/placeholder_athlete.png'}" alt="${currentUser.name}" class="comment-avatar">
                    <div class="comment-input-wrapper">
                        <input type="text" class="comment-input" placeholder="Write a comment..." 
                               onkeypress="handleCommentKeyPress(event, '${postId}', this)">
                        <button class="comment-submit-btn" onclick="submitComment('${postId}')">Post</button>
                    </div>
                </div>
            `;
        }
        
        // Add existing comments
        if (comments.length > 0) {
            commentsHTML += '<div class="comments-list">';
            comments.forEach(comment => {
                const timeAgo = formatTimeAgo(comment.createdAt);
                commentsHTML += `
                    <div class="comment-item" data-comment-id="${comment._id}">
                        <img src="${comment.author.avatar || 'images/placeholder_athlete.png'}" alt="${comment.author.name}" class="comment-avatar">
                        <div class="comment-content">
                            <div class="comment-header">
                                <span class="comment-author clickable-username" data-username="${comment.author.username}">${comment.author.name}</span>
                                <span class="comment-time">${timeAgo}</span>
                            </div>
                            <div class="comment-text">${escapeHtml(comment.content.text)}</div>
                            <div class="comment-actions">
                                <button class="comment-like-btn ${comment.isLikedBy ? 'liked' : ''}" onclick="toggleCommentLike('${comment._id}', this)">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                    </svg>
                                    <span class="comment-like-count">${comment.metrics?.likes || 0}</span>
                                </button>
                                <button class="comment-reply-btn" onclick="toggleReplyInput('${comment._id}', '${postId}')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 21l1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"></path>
                                    </svg>
                                    Reply
                                </button>
                                ${comment.replies && comment.replies.length > 0 ? `
                                    <button class="toggle-replies-btn" onclick="toggleReplies('${comment._id}')">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="9,18 15,12 9,6"></polyline>
                                        </svg>
                                        <span class="replies-count">Show ${comment.replies.length} ${comment.replies.length === 1 ? 'reply' : 'replies'}</span>
                                    </button>
                                ` : ''}
                            </div>
                            <div class="reply-input-container" id="reply-input-${comment._id}" style="display: none;">
                                <img src="${currentUser?.avatar || 'images/placeholder_athlete.png'}" alt="${currentUser?.name}" class="comment-avatar">
                                <div class="comment-input-wrapper">
                                    <input type="text" class="reply-input" placeholder="Write a reply..." 
                                           onkeypress="handleReplyKeyPress(event, '${comment._id}', '${postId}', this)">
                                    <button class="comment-submit-btn" onclick="submitReply('${comment._id}', '${postId}')">Reply</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Add replies if they exist
                if (comment.replies && comment.replies.length > 0) {
                    commentsHTML += `<div class="replies-container" id="replies-${comment._id}" style="margin-left: 40px; margin-top: 12px; display: none;">`;
                    comment.replies.forEach(reply => {
                        const replyTimeAgo = formatTimeAgo(reply.createdAt);
                        commentsHTML += `
                            <div class="reply-item" data-comment-id="${reply._id}">
                                <img src="${reply.author.avatar || 'images/placeholder_athlete.png'}" alt="${reply.author.name}" class="comment-avatar" style="width: 32px; height: 32px;">
                                <div class="comment-content">
                                    <div class="comment-header">
                                        <span class="comment-author clickable-username" data-username="${reply.author.username}">${reply.author.name}</span>
                                        <span class="comment-time">${replyTimeAgo}</span>
                                    </div>
                                    <div class="comment-text">${escapeHtml(reply.content.text)}</div>
                                    <div class="comment-actions">
                                        <button class="comment-like-btn ${reply.isLikedBy ? 'liked' : ''}" onclick="toggleCommentLike('${reply._id}', this)">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                                            </svg>
                                            <span class="comment-like-count">${reply.metrics?.likes || 0}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    commentsHTML += '</div>';
                }
            });
            commentsHTML += '</div>';
        } else {
            commentsHTML += '<div class="no-comments">Be the first to comment!</div>';
        }
        
        commentsContainer.innerHTML = commentsHTML;
        
        // Add click handlers for usernames in comments
        commentsContainer.querySelectorAll('.clickable-username').forEach(element => {
            element.addEventListener('click', function() {
                showUserProfile(this.dataset.username);
            });
        });
    }

    // Display sample comments
    function displaySampleComments(postId) {
        const sampleComments = [
            {
                id: 'comment-1',
                author: {
                    name: 'Emma Thompson',
                    username: 'emmat',
                    avatar: 'images/image_60ef247c.png'
                },
                content: 'Great call! I\'ve been watching him too.',
                createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
                likeCount: 5,
                isLiked: false
            },
            {
                id: 'comment-2',
                author: {
                    name: 'James Wilson',
                    username: 'jameswilson',
                    avatar: 'images/image_0a9429cd.png'
                },
                content: 'Do you think his value will keep going up after the playoffs?',
                createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 minutes ago
                likeCount: 2,
                isLiked: true
            }
        ];
        
        displayPostComments(postId, sampleComments);
    }

    // Handle comment input key press
    function handleCommentKeyPress(event, postId, inputElement) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submitComment(postId, inputElement.value);
        }
    }

    // Toggle reply input visibility
    function toggleReplyInput(commentId, postId) {
        const replyContainer = document.getElementById(`reply-input-${commentId}`);
        if (replyContainer) {
            const isVisible = replyContainer.style.display !== 'none';
            replyContainer.style.display = isVisible ? 'none' : 'block';
            
            if (!isVisible) {
                // Focus on the reply input
                const replyInput = replyContainer.querySelector('.reply-input');
                if (replyInput) {
                    replyInput.focus();
                }
            }
        }
    }

    // Handle reply key press (Enter to submit)
    function handleReplyKeyPress(event, commentId, postId, inputElement) {
        if (event.key === 'Enter') {
            event.preventDefault();
            submitReply(commentId, postId, inputElement.value);
        }
    }

    // Toggle replies visibility
    function toggleReplies(commentId) {
        const repliesContainer = document.getElementById(`replies-${commentId}`);
        const toggleBtn = document.querySelector(`[onclick="toggleReplies('${commentId}')"]`);
        
        if (repliesContainer && toggleBtn) {
            const isVisible = repliesContainer.style.display !== 'none';
            repliesContainer.style.display = isVisible ? 'none' : 'block';
            
            // Update button icon and text
            const svg = toggleBtn.querySelector('svg polyline');
            const repliesCount = toggleBtn.querySelector('.replies-count');
            
            if (svg) {
                if (isVisible) {
                    // Show "expand" arrow (pointing right)
                    svg.setAttribute('points', '9,18 15,12 9,6');
                } else {
                    // Show "collapse" arrow (pointing down)
                    svg.setAttribute('points', '6,9 12,15 18,9');
                }
            }
            
            if (repliesCount) {
                const count = repliesContainer.querySelectorAll('.reply-item').length;
                repliesCount.textContent = isVisible ? 
                    `Show ${count} ${count === 1 ? 'reply' : 'replies'}` : 
                    `${count} ${count === 1 ? 'reply' : 'replies'}`;
            }
        }
    }

    // Submit reply to comment
    async function submitReply(commentId, postId, content = null) {
        if (!currentUser) {
            showAuthModal();
            return;
        }
        
        const replyContainer = document.getElementById(`reply-input-${commentId}`);
        const replyInput = replyContainer?.querySelector('.reply-input');
        
        const replyText = content || replyInput?.value.trim();
        if (!replyText) return;
        
        try {
            const response = await postData(`/posts/${postId}/comments`, {
                text: replyText,
                parentCommentId: commentId
            });
            
            if (response && response.success) {
                // Clear input
                if (replyInput) replyInput.value = '';
                
                // Hide reply input
                toggleReplyInput(commentId, postId);
                
                // Reload comments to show the new reply
                await loadPostComments(postId);
                
                // Update comment count in post
                updatePostCommentCount(postId, 1);
            } else {
                alert('Failed to post reply. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting reply:', error);
            alert('Failed to post reply. Please try again.');
        }
    }

    // Submit a new comment
    async function submitComment(postId, content = null) {
        if (!currentUser) {
            showAuthModal();
            return;
        }
        
        const commentsContainer = document.getElementById(`comments-${postId}`);
        const commentInput = commentsContainer.querySelector('.comment-input');
        
        const commentText = content || commentInput.value.trim();
        if (!commentText) return;
        
        try {
            const response = await postData(`/posts/${postId}/comments`, {
                text: commentText
            });
            
            if (response && response.success) {
                // Clear input
                if (commentInput) commentInput.value = '';
                
                // Reload comments
                await loadPostComments(postId);
                
                // Update comment count in post
                updatePostCommentCount(postId, 1);
            } else {
                alert('Failed to post comment. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting comment:', error);
            alert('Failed to post comment. Please try again.');
        }
    }

    // Toggle comment like
    async function toggleCommentLike(commentId, buttonElement) {
        if (!currentUser) {
            showAuthModal();
            return;
        }
        
        const likeCountElement = buttonElement.querySelector('.comment-like-count');
        const currentCount = parseInt(likeCountElement.textContent) || 0;
        const isLiked = buttonElement.classList.contains('liked');
        
        // Optimistic UI update
        if (isLiked) {
            buttonElement.classList.remove('liked');
            likeCountElement.textContent = Math.max(0, currentCount - 1);
        } else {
            buttonElement.classList.add('liked');
            likeCountElement.textContent = currentCount + 1;
        }
        
        try {
            const endpoint = isLiked ? `/comments/${commentId}/unlike` : `/comments/${commentId}/like`;
            const response = await postData(endpoint, {});
            
            if (!response || !response.success) {
                // Revert optimistic update on failure
                if (isLiked) {
                    buttonElement.classList.add('liked');
                    likeCountElement.textContent = currentCount;
                } else {
                    buttonElement.classList.remove('liked');
                    likeCountElement.textContent = Math.max(0, currentCount);
                }
            }
        } catch (error) {
            console.error('Error toggling comment like:', error);
            // Revert optimistic update on error
            if (isLiked) {
                buttonElement.classList.add('liked');
                likeCountElement.textContent = currentCount;
            } else {
                buttonElement.classList.remove('liked');
                likeCountElement.textContent = Math.max(0, currentCount);
            }
        }
    }

    // Share post functionality
    function sharePost(postId) {
        if (navigator.share) {
            navigator.share({
                title: 'Check out this post on Fanscout',
                url: `${window.location.origin}/post/${postId}`
            });
        } else {
            // Fallback: copy to clipboard
            const url = `${window.location.origin}/post/${postId}`;
            navigator.clipboard.writeText(url).then(() => {
                alert('Post link copied to clipboard!');
            }).catch(() => {
                alert('Unable to share. Link: ' + url);
            });
        }
    }

    // Update post comment count
    function updatePostCommentCount(postId, increment) {
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const commentCountElement = postElement.querySelector('.comment-count');
            if (commentCountElement) {
                const currentCount = parseInt(commentCountElement.textContent) || 0;
                commentCountElement.textContent = Math.max(0, currentCount + increment);
            }
        }
    }

    // Perform social search
    async function performSocialSearch(query) {
        try {
            showLoadingState();
            
            const response = await fetchData(`/search?q=${encodeURIComponent(query)}&type=all`);
            
            if (response && response.success) {
                displaySearchResults(response.data);
            } else {
                displayNoSearchResults(query);
            }
        } catch (error) {
            console.error('Error performing search:', error);
            displayNoSearchResults(query);
        } finally {
            hideLoadingState();
        }
    }

    // Display search results
    function displaySearchResults(results) {
        const postsContainer = document.getElementById('postsFeed');
        if (!postsContainer) return;
        
        postsContainer.innerHTML = '';
        
        // Display users section if there are user results
        if (results.users && results.users.length > 0) {
            const usersSection = document.createElement('div');
            usersSection.className = 'search-results-section';
            usersSection.innerHTML = `
                <h3 class="search-section-title">Users</h3>
                <div class="search-users-list">
                    ${results.users.map(user => `
                        <div class="search-user-item clickable-username" data-username="${user.username}">
                            <img src="${user.avatar || 'images/placeholder_athlete.png'}" alt="${user.name}" class="search-user-avatar">
                            <div class="search-user-info">
                                <div class="search-user-name">${user.name}</div>
                                <div class="search-user-handle">@${user.username}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            postsContainer.appendChild(usersSection);
            
            // Add click handlers for user results
            usersSection.querySelectorAll('.clickable-username').forEach(element => {
                element.addEventListener('click', function() {
                    showUserProfile(this.dataset.username);
                });
            });
        }
        
        // Display posts section if there are post results
        if (results.posts && results.posts.length > 0) {
            const postsSection = document.createElement('div');
            postsSection.className = 'search-results-section';
            postsSection.innerHTML = '<h3 class="search-section-title">Posts</h3>';
            postsContainer.appendChild(postsSection);
            
            results.posts.forEach(post => {
                const postElement = createPostElement(post);
                postsContainer.appendChild(postElement);
            });
        }
        
        // Show no results message if both are empty
        if ((!results.users || results.users.length === 0) && (!results.posts || results.posts.length === 0)) {
            displayNoSearchResults();
        }
    }

    // Display no search results
    function displayNoSearchResults(query = '') {
        const postsContainer = document.getElementById('postsFeed');
        if (!postsContainer) return;
        
        postsContainer.innerHTML = `
            <div style="text-align: center; padding: 60px 20px; color: var(--color-text-secondary);">
                <div style="font-size: 18px; margin-bottom: 8px;">No results found</div>
                <div style="font-size: 14px;">
                    ${query ? `Try searching for something else or check your spelling.` : 'Try a different search term.'}
                </div>
            </div>
        `;
    }

    // Show create post modal
    function showCreatePostModal() {
        console.log('showCreatePostModal called');
        console.log('Current user check:', currentUser);
        if (!currentUser) {
            console.log('No current user, showing auth modal');
            showAuthModal();
            return;
        }
        
        console.log('Looking for modal element...');
        const modal = document.getElementById('createPostModalOverlay');
        const modalContent = document.getElementById('createPostModal');
        console.log('Modal element found:', modal);
        console.log('Modal content found:', modalContent);
        if (modal && modalContent) {
            console.log('Showing modal...');
            modal.style.display = 'flex';
            modalContent.classList.add('active');
            
            // Clear form
            const form = document.getElementById('createPostForm');
            if (form) {
                form.reset();
            }
            
            // Clear the text area and setup functionality
            const textArea = document.getElementById('postText');
            if (textArea) {
                textArea.value = '';
                textArea.focus();
                
                // Setup character count listener
                textArea.removeEventListener('input', updatePostCharacterCount);
                textArea.addEventListener('input', updatePostCharacterCount);
                
                // Initialize character count
                updatePostCharacterCount();
            }
            
            // Setup insert athlete button
            setupInsertAthleteButton();
        }
    }

    // Close create post modal
    function closeCreatePostModal() {
        const modal = document.getElementById('createPostModalOverlay');
        const modalContent = document.getElementById('createPostModal');
        if (modal) {
            modal.style.display = 'none';
        }
        if (modalContent) {
            modalContent.classList.remove('active');
        }
        // Clear form data when closing modal
    }

    // Athlete tagging functionality
    // Insert Athlete System
    function setupInsertAthleteButton() {
        const insertBtn = document.getElementById('insertAthleteBtn');
        
        if (!insertBtn) return;

        insertBtn.addEventListener('click', () => {
            openAthleteSearchModal();
        });
    }

    function openAthleteSearchModal() {
        const modal = document.getElementById('athleteSearchModal');
        const searchInput = document.getElementById('athleteSearchInput');
        const resultsContainer = document.getElementById('athleteSearchResults');
        
        if (!modal || !searchInput || !resultsContainer) return;

        // Show modal
        modal.classList.remove('modal'); // Remove any incorrect modal class
        modal.classList.add('active');
        
        // Clear previous search
        searchInput.value = '';
        resultsContainer.innerHTML = '';
        
        // Focus on search input
        setTimeout(() => searchInput.focus(), 100);
        
        // Load all athletes initially
        loadAthleteSearchResults('');
        
        // Setup search listener
        searchInput.removeEventListener('input', handleAthleteSearch);
        searchInput.addEventListener('input', handleAthleteSearch);
    }

    function handleAthleteSearch(e) {
        const query = e.target.value.trim();
        loadAthleteSearchResults(query);
    }

    function loadAthleteSearchResults(query) {
        const resultsContainer = document.getElementById('athleteSearchResults');
        if (!resultsContainer || !window.allAthletesData) return;

        // Filter athletes
        let filteredAthletes = window.allAthletesData;
        if (query.length > 0) {
            filteredAthletes = window.allAthletesData.filter(athlete => 
                athlete.name.toLowerCase().includes(query.toLowerCase())
            );
        }
        
        // Limit results
        filteredAthletes = filteredAthletes.slice(0, 20);
        
        // Clear container
        resultsContainer.innerHTML = '';
        
        if (filteredAthletes.length === 0) {
            resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--color-text-secondary);">No athletes found</div>';
            return;
        }
        
        // Add results
        filteredAthletes.forEach(athlete => {
            const item = document.createElement('div');
            item.className = 'athlete-search-item';
            item.innerHTML = `
                <img src="${athlete.avatar}" alt="${athlete.name}">
                <div class="info">
                    <div class="name">${athlete.name}</div>
                    <div class="details">${athlete.details || athlete.sport || ''}</div>
                </div>
            `;
            
            item.addEventListener('click', () => {
                insertAthleteIntoText(athlete);
                closeAthleteSearchModal();
            });
            
            resultsContainer.appendChild(item);
        });
    }

    function insertAthleteIntoText(athlete) {
        const textArea = document.getElementById('postText');
        if (!textArea) return;
        
        const cursorPos = textArea.selectionStart;
        const textBefore = textArea.value.substring(0, cursorPos);
        const textAfter = textArea.value.substring(cursorPos);
        
        // Insert athlete name without @ symbol (just the name)
        const athleteName = athlete.name;
        textArea.value = textBefore + athleteName + textAfter;
        
        // Update cursor position
        const newCursorPos = cursorPos + athleteName.length;
        textArea.setSelectionRange(newCursorPos, newCursorPos);
        textArea.focus();
        
        // Update character count
        updatePostCharacterCount();
    }

    function closeAthleteSearchModal() {
        const modal = document.getElementById('athleteSearchModal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    function updatePostCharacterCount() {
        const textArea = document.getElementById('postText');
        const countElement = document.getElementById('postCharCount');
        
        if (textArea && countElement) {
            const count = textArea.value.length;
            countElement.textContent = count;
            
            // Update submit button state
            const submitBtn = document.getElementById('createPostSubmit');
            if (submitBtn) {
                submitBtn.disabled = count === 0;
            }
        }
    }

    // Convert athlete names in text to clickable links
    function formatPostTextWithAthleteLinks(text) {
        if (!text || !window.allAthletesData) return text;
        
        let formattedText = text;
        
        // Look for exact athlete names in the text (without @ symbol)
        window.allAthletesData.forEach(athlete => {
            // Create a regex to find the exact athlete name as a whole word
            const nameRegex = new RegExp(`\\b${athlete.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
            
            formattedText = formattedText.replace(nameRegex, (match) => {
                // Only replace if it's not already wrapped in a span
                const beforeMatch = formattedText.substring(0, formattedText.indexOf(match));
                if (beforeMatch.includes('<span class="athlete-link"') && !beforeMatch.includes('</span>')) {
                    return match; // Already wrapped, don't double-wrap
                }
                
                return `<span class="athlete-link" onclick="showAthleteDetail(findAthleteByName('${athlete.name}'))">${match}</span>`;
            });
        });
        
        return formattedText;
    }

    // Helper function to find athlete by name
    function findAthleteByName(name) {
        if (window.allAthletesData) {
            return window.allAthletesData.find(athlete => athlete.name === name);
        }
        return null;
    }

    // Make functions globally accessible
    window.closeAthleteSearchModal = closeAthleteSearchModal;
    window.findAthleteByName = findAthleteByName;

    // Handle create post form submission
    async function handleCreatePost(event) {
        event.preventDefault();
        
        if (!currentUser) {
            showAuthModal();
            return;
        }
        
        const form = event.target;
        const postTextArea = document.getElementById('postText');
        const postMediaInput = document.getElementById('postMedia');
        const postText = postTextArea ? postTextArea.value.trim() : '';
        const postImage = postMediaInput && postMediaInput.files.length > 0 ? postMediaInput.files[0] : null;
        
        if (!postText && !postImage) {
            alert('Please enter some text or select an image.');
            return;
        }
        
        try {
            // Show loading state
            const submitBtn = form.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Posting...';
            submitBtn.disabled = true;
            
            let response;
            
            if (postImage && postImage.size > 0) {
                // Handle image upload
                const formData = new FormData();
                formData.append('text', postText);
                formData.append('media', postImage);
                // Note: Athlete mentions are now handled in the text itself
                
                response = await fetch(`${API_BASE_URL}/posts`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: formData
                });
            } else {
                // Handle text-only post
                response = await postData('/posts', {
                    text: postText
                });
            }
            
            if (response && (response.success || response.ok)) {
                // Close modal
                closeCreatePostModal();
                
                // Refresh feed
                socialFeedData.currentPage = 1;
                await loadSocialFeedPosts();
                
                // Show success message
                showNotification('Post created successfully!');
            } else {
                throw new Error('Failed to create post');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            alert('Failed to create post. Please try again.');
        } finally {
            // Reset button state
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Post';
            submitBtn.disabled = false;
        }
    }

    // Set up infinite scroll
    function setupInfiniteScroll() {
        const postsContainer = document.getElementById('postsFeed');
        if (!postsContainer) return;
        
        // Remove existing scroll listener
        if (postsContainer.infiniteScrollListener) {
            window.removeEventListener('scroll', postsContainer.infiniteScrollListener);
        }
        
        // Add new scroll listener
        postsContainer.infiniteScrollListener = function() {
            if (socialFeedData.isLoading || !socialFeedData.hasMorePages) return;
            
            const scrollPosition = window.innerHeight + window.scrollY;
            const threshold = document.body.offsetHeight - 1000; // Load more when 1000px from bottom
            
            if (scrollPosition >= threshold) {
                socialFeedData.currentPage++;
                loadSocialFeedPosts(true); // Append to existing posts
            }
        };
        
        window.addEventListener('scroll', postsContainer.infiniteScrollListener);
    }

    // Show loading state
    function showLoadingState(clear = true) {
        const postsContainer = document.getElementById('postsFeed');
        if (!postsContainer) return;
        
        if (clear) {
            postsContainer.innerHTML = `
                <div class="loading-state" style="text-align: center; padding: 40px 20px; color: var(--color-text-secondary);">
                    <div style="font-size: 16px;">Loading posts...</div>
                </div>
            `;
        } else {
            // Add loading indicator at bottom for infinite scroll
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-more';
            loadingDiv.style.cssText = 'text-align: center; padding: 20px; color: var(--color-text-secondary);';
            loadingDiv.innerHTML = '<div style="font-size: 14px;">Loading more posts...</div>';
            postsContainer.appendChild(loadingDiv);
        }
    }

    // Hide loading state
    function hideLoadingState() {
        const loadingStates = document.querySelectorAll('.loading-state, .loading-more');
        loadingStates.forEach(el => el.remove());
    }

    // Setup WebSocket listeners for social feed real-time updates
    function setupSocialWebSocketListeners() {
        if (!socket) return;
        
        // Listen for new posts
        socket.on('new-post', (data) => {
            handleNewPost(data);
        });
        
        // Listen for post updates (likes, comments)
        socket.on('post-updated', (data) => {
            handlePostUpdate(data);
        });
        
        // Listen for new comments
        socket.on('new-comment', (data) => {
            handleNewComment(data);
        });
    }

    // Handle new post from WebSocket
    function handleNewPost(data) {
        const { post } = data;
        
        // Only add to current feed if it matches the tab
        if (socialFeedData.currentTab === 'following') {
            socialFeedData.following.unshift(post);
            
            // If we're on the explore page and following tab, refresh the display
            if (document.querySelector('.explore-page.active') && 
                document.querySelector('.feed-tab.active[data-feed="following"]')) {
                displaySocialFeedPosts(socialFeedData.following);
            }
        }
    }

    // Handle post update from WebSocket
    function handlePostUpdate(data) {
        const { postId, likeCount, commentCount } = data;
        
        const postElement = document.querySelector(`[data-post-id="${postId}"]`);
        if (postElement) {
            const likeCountElement = postElement.querySelector('.like-count');
            const commentCountElement = postElement.querySelector('.comment-count');
            
            if (likeCountElement && likeCount !== undefined) {
                likeCountElement.textContent = likeCount;
            }
            if (commentCountElement && commentCount !== undefined) {
                commentCountElement.textContent = commentCount;
            }
        }
    }

    // Handle new comment from WebSocket
    function handleNewComment(data) {
        const { postId, comment } = data;
        
        // Update comment count
        updatePostCommentCount(postId, 1);
        
        // If comments are currently visible for this post, add the new comment
        const commentsContainer = document.getElementById(`comments-${postId}`);
        if (commentsContainer && commentsContainer.style.display !== 'none') {
            loadPostComments(postId); // Reload to show new comment
        }
    }

    // Utility function to format time ago
    function formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
        if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
        
        return date.toLocaleDateString();
    }

    // Utility function to escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Render post media (images/videos)
    function renderPostMedia(media) {
        if (!media || media.length === 0) return '';
        
        return media.map(item => {
            if (item.type === 'image') {
                return `<img src="${item.url}" alt="Post image" class="post-image clickable-image" style="max-width: 100%; border-radius: 8px; margin-top: 12px; cursor: pointer;" data-image-url="${item.url}">`;
            } else if (item.type === 'video') {
                return `<video controls class="post-video" style="max-width: 100%; border-radius: 8px; margin-top: 12px;">
                    <source src="${item.url}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>`;
            }
            return '';
        }).join('');
    }
    
    // Search and show athlete profile
    function searchAndShowAthlete(athleteName) {
        console.log('Searching for athlete:', athleteName);
        // Find athlete in the data
        if (allAthletesData && allAthletesData.length > 0) {
            const athlete = allAthletesData.find(a => 
                a.name.toLowerCase().includes(athleteName.toLowerCase())
            );
            if (athlete) {
                showAthleteDetail(athlete);
            } else {
                alert(`Athlete "${athleteName}" not found in the database.`);
            }
        } else {
            alert('Athlete data not loaded yet. Please try again in a moment.');
        }
    }

    // Utility function to show notification
    function showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? 'var(--color-success)' : 'var(--color-error)'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 600;
            animation: slideInRight 0.3s ease-out;
        `;
        notification.textContent = message;
        
        // Add animation styles if not already present
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Open image modal
    function openImageModal(imageUrl) {
        console.log('openImageModal called with:', imageUrl);
        
        // Remove any existing modal first
        const existingModal = document.getElementById('imageModalOverlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create new modal
        const imageModal = document.createElement('div');
        imageModal.id = 'imageModalOverlay';
        imageModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        imageModal.innerHTML = `
            <div style="position: relative; max-width: 95vw; max-height: 95vh;">
                <button onclick="closeImageModal()" style="
                    position: absolute;
                    top: -40px;
                    right: 0;
                    background: rgba(255,255,255,0.9);
                    color: black;
                    border: none;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    cursor: pointer;
                    font-size: 20px;
                    font-weight: bold;
                    z-index: 10001;
                ">×</button>
                <img src="${imageUrl}" style="
                    max-width: 100%;
                    max-height: 100%;
                    object-fit: contain;
                    display: block;
                    border-radius: 8px;
                ">
            </div>
        `;
        
        // Add click-outside-to-close functionality
        imageModal.addEventListener('click', function(e) {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
        
        document.body.appendChild(imageModal);
        console.log('Image modal created and shown');
    }

    // Close image modal
    function closeImageModal() {
        console.log('Closing image modal');
        const imageModal = document.getElementById('imageModalOverlay');
        if (imageModal) {
            imageModal.remove();
            console.log('Image modal removed');
        }
    }

    // Make functions globally accessible
    window.togglePostLike = togglePostLike;
    window.togglePostComments = togglePostComments;
    window.sharePost = sharePost;
    window.toggleCommentLike = toggleCommentLike;
    window.handleCommentKeyPress = handleCommentKeyPress;
    window.submitComment = submitComment;
    window.toggleReplyInput = toggleReplyInput;
    window.handleReplyKeyPress = handleReplyKeyPress;
    window.submitReply = submitReply;
    window.toggleReplies = toggleReplies;
    window.showCreatePostModal = showCreatePostModal;
    window.closeCreatePostModal = closeCreatePostModal;
    window.openImageModal = openImageModal;
    window.closeImageModal = closeImageModal;
    window.searchAndShowAthlete = searchAndShowAthlete;
    window.showAthleteDetail = showAthleteDetail;
    window.openMakeOfferModal = openMakeOfferModal;
    
    // Add test function for debugging
    window.testSocialFunctions = function() {
        console.log('Testing social functions...');
        console.log('Current user:', currentUser);
        console.log('Auth token:', authToken);
        
        // Test create post button
        const createBtn = document.getElementById('createPostBtn');
        console.log('Create post button:', createBtn);
        
        // Test feed tabs
        const feedTabs = document.querySelectorAll('.feed-tab');
        console.log('Feed tabs:', feedTabs);
        
        // Test modal
        const modal = document.getElementById('createPostModalOverlay');
        console.log('Modal:', modal);
        
        return {
            createBtn,
            feedTabs,
            modal,
            currentUser,
            authToken
        };
    };
    
    // Add quick login function for testing
    window.quickLogin = async function() {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: 'admin@fanscout.com',
                    password: 'admin!'
                })
            });
            
            const data = await response.json();
            if (data.success) {
                localStorage.setItem('authToken', data.token);
                authToken = data.token;
                currentUser = data.user;
                console.log('Logged in successfully:', currentUser);
                
                // Re-initialize social feed after login
                if (document.querySelector('.explore-page.active')) {
                    initializeSocialFeed();
                }
                
                return data;
            } else {
                console.error('Login failed:', data.error);
                return data;
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    };


    // Initialize social feed when explore page is shown
    const originalShowPage = window.showPage || showPage;
    window.showPage = function(pageId) {
        if (originalShowPage) {
            originalShowPage(pageId);
        } else if (typeof showPage === 'function') {
            showPage(pageId);
        }
        
        // Initialize social feed when explore page is shown
        if (pageId === 'explore') {
            setTimeout(initializeSocialFeed, 100);
        }
    };

    // If we're already on the explore page, initialize the social feed
    if (document.querySelector('.explore-page.active')) {
        setTimeout(initializeSocialFeed, 100);
    }

    //========================================
    //          OFFERS PAGE FUNCTIONS
    //========================================

    // Show different sections of the offers page
    window.showOffersSection = function(sectionName) {
        // Hide all sections
        document.querySelectorAll('.offers-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Update navigation pills
        document.querySelectorAll('.offers-nav-pills .pill').forEach(pill => {
            pill.classList.remove('active');
        });
        
        // Show selected section
        const targetSection = document.getElementById(sectionName + '-section');
        if (targetSection) {
            targetSection.classList.add('active');
        }
        
        // Update active nav pill
        const activeNavPill = document.querySelector(`.offers-nav-pills .pill[data-section="${sectionName}"]`);
        if (activeNavPill) {
            activeNavPill.classList.add('active');
        }
        
        // Load content based on section
        if (sectionName === 'athletes') {
            loadOffersAthletes();
            // Ensure filters are set up for athletes section
            setTimeout(setupAthleteFilters, 100);
        } else if (sectionName === 'current-offers') {
            loadCurrentOffers();
            // Ensure filters are set up for current offers section
            setTimeout(setupOffersFilters, 100);
        } else if (sectionName === 'post-offer') {
            loadPostOfferForm();
        }
    };

    // Filter athletes by sport
    window.filterAthletesBySport = function(sport) {
        const athleteSportFilter = document.getElementById('athleteSportFilter');
        if (athleteSportFilter) {
            athleteSportFilter.value = sport;
        }
        filterAthletes();
    };

    // Filter offers by type
    window.filterOffers = function(type) {
        const pills = document.querySelectorAll('#current-offers-section .pills-container .pill');
        pills.forEach(pill => {
            pill.classList.remove('active');
        });
        
        const activePill = document.querySelector(`#current-offers-section .pills-container .pill[data-filter="${type}"]`);
        if (activePill) {
            activePill.classList.add('active');
        }
        
        loadCurrentOffers(type);
    };

    // Load athletes for the athletes section
    function loadOffersAthletes() {
        const athletesGrid = document.getElementById('athletesGrid');
        if (!athletesGrid) return;
        
        if (allAthletesData && allAthletesData.length > 0) {
            populateOffersAthletes(allAthletesData);
        } else {
            // Load from API if not already loaded
            fetch(`${API_BASE_URL}/athletes`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    allAthletesData = data.data;
                    populateOffersAthletes(data.data);
                }
            })
            .catch(error => {
                console.error('Error loading athletes:', error);
                athletesGrid.innerHTML = '<div class="error-message">Failed to load athletes. Please try again.</div>';
            });
        }
    }

    // Populate athletes grid
    function populateOffersAthletes(athletes) {
        const athletesGrid = document.getElementById('athletesGrid');
        if (!athletesGrid) return;
        
        if (!athletes || athletes.length === 0) {
            athletesGrid.innerHTML = '<div class="empty-state">No athletes found.</div>';
            return;
        }
        
        const athleteCards = athletes.map(athlete => {
            const changeClass = athlete.dailyChangePercent >= 0 ? 'positive' : 'negative';
            const changeSymbol = athlete.dailyChangePercent >= 0 ? '+' : '';
            
            return `
                <div class="athlete-card" onclick="showAthleteDetail(${JSON.stringify(athlete).replace(/"/g, '&quot;')})">
                    <img src="${athlete.avatar}" alt="${athlete.name}" class="athlete-image">
                    <div class="athlete-info">
                        <div class="athlete-position">${athlete.details}</div>
                        <div class="athlete-name">${athlete.name}</div>
                        <div class="athlete-price">$${athlete.currentPrice.toFixed(2)}</div>
                        <div class="athlete-change ${changeClass}">${changeSymbol}${athlete.dailyChangePercent.toFixed(2)}%</div>
                    </div>
                </div>
            `;
        }).join('');
        
        athletesGrid.innerHTML = athleteCards;
    }

    // Filter athletes based on search and filters
    function filterAthletes() {
        const searchQuery = document.getElementById('athletesSearchInput')?.value.toLowerCase() || '';
        const sportFilter = document.getElementById('athleteSportFilter')?.value || 'all';
        const minPrice = parseFloat(document.getElementById('athleteMinPrice')?.value) || 0;
        const maxPrice = parseFloat(document.getElementById('athleteMaxPrice')?.value) || Infinity;
        const sortBy = document.getElementById('athleteSort')?.value || 'default';
        
        let filteredAthletes = allAthletesData.filter(athlete => {
            const matchesSearch = athlete.name.toLowerCase().includes(searchQuery) || 
                                athlete.details.toLowerCase().includes(searchQuery);
            const matchesSport = sportFilter === 'all' || athlete.sport === sportFilter;
            const matchesPrice = athlete.currentPrice >= minPrice && athlete.currentPrice <= maxPrice;
            
            return matchesSearch && matchesSport && matchesPrice;
        });
        
        // Sort athletes
        if (sortBy === 'name-asc') {
            filteredAthletes.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'price-desc') {
            filteredAthletes.sort((a, b) => b.currentPrice - a.currentPrice);
        } else if (sortBy === 'market-cap-desc') {
            filteredAthletes.sort((a, b) => (b.currentPrice * b.quantity) - (a.currentPrice * a.quantity));
        }
        
        populateOffersAthletes(filteredAthletes);
    }

    // Global offers storage with persistence
    function loadOffersFromStorage(forceReset = false) {
        try {
            const stored = localStorage.getItem('fanscout_offers');
            if (stored && !forceReset) {
                const parsedData = JSON.parse(stored);
                console.log('Loaded offers from localStorage:', parsedData.length, 'offers');
                return parsedData;
            }
        } catch (error) {
            console.error('Error loading offers from storage:', error);
        }
        
        // Default offers if none stored - seeded with realistic data
        console.log('Loading fresh seeded offers data...');
        const now = new Date();
        const seedData = [
            // Buy offers from bbb@gmail.com
            {
                id: 1,
                type: 'buying',
                athlete: { 
                    _id: 'mahomes_id', 
                    name: 'Patrick Mahomes', 
                    avatar: 'images/athlete_mahomes.png', 
                    details: 'QB, Kansas City Chiefs' 
                },
                quantity: 15,
                price: 28.50,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() // 2 hours ago
            },
            {
                id: 2,
                type: 'buying',
                athlete: { 
                    _id: 'tatum_id', 
                    name: 'Jayson Tatum', 
                    avatar: 'images/athlete_tatum.png', 
                    details: 'SF, Boston Celtics' 
                },
                quantity: 8,
                price: 22.75,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString() // 4 hours ago
            },
            {
                id: 3,
                type: 'buying',
                athlete: { 
                    _id: 'caitlin_id', 
                    name: 'Caitlin Clark', 
                    avatar: 'images/athlete_caitlin_clark.png', 
                    details: 'PG, Indiana Fever' 
                },
                quantity: 25,
                price: 19.00,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString() // 6 hours ago
            },

            // Sell offers from bbb@gmail.com (they must own these)
            {
                id: 4,
                type: 'selling',
                athlete: { 
                    _id: 'tom_id', 
                    name: 'Tom Brady', 
                    avatar: 'images/athlete_tom.png', 
                    details: 'QB, Retired' 
                },
                quantity: 12,
                price: 15.25,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000).toISOString() // 8 hours ago
            },
            {
                id: 5,
                type: 'selling',
                athlete: { 
                    _id: 'messi_id', 
                    name: 'Lionel Messi', 
                    avatar: 'images/athlete_messi.png', 
                    details: 'FW, Inter Miami CF' 
                },
                quantity: 20,
                price: 31.50,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString() // 12 hours ago
            },
            {
                id: 6,
                type: 'selling',
                athlete: { 
                    _id: 'serena_id', 
                    name: 'Serena Williams', 
                    avatar: 'images/athlete_serena.png', 
                    details: 'Tennis Player, Retired' 
                },
                quantity: 8,
                price: 24.00,
                user: 'bbb@gmail.com',
                timestamp: new Date(now.getTime() - 18 * 60 * 60 * 1000).toISOString() // 18 hours ago
            },

            // Mixed offers from other users
            {
                id: 7,
                type: 'buying',
                athlete: { 
                    _id: 'caleb_id', 
                    name: 'Caleb Williams', 
                    avatar: 'images/athlete_caleb.png', 
                    details: 'QB, Chicago Bears' 
                },
                quantity: 30,
                price: 12.75,
                user: 'ChicagoFan2024',
                timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString() // 1 hour ago
            },
            {
                id: 8,
                type: 'selling',
                athlete: { 
                    _id: 'elena_id', 
                    name: 'Elena Rodriguez', 
                    avatar: 'images/athlete_elena.png', 
                    details: 'Soccer Player, NWSL' 
                },
                quantity: 5,
                price: 8.50,
                user: 'SoccerInvestor',
                timestamp: new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
            },
            {
                id: 9,
                type: 'buying',
                athlete: { 
                    _id: 'marcus_id', 
                    name: 'Marcus Johnson', 
                    avatar: 'images/athlete_marcus.png', 
                    details: 'RB, College Football' 
                },
                quantity: 50,
                price: 6.25,
                user: 'CollegeSports99',
                timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000).toISOString() // 5 hours ago
            },
            {
                id: 10,
                type: 'selling',
                athlete: { 
                    _id: 'aisha_id', 
                    name: 'Aisha Thompson', 
                    avatar: 'images/athlete_aisha.png', 
                    details: 'Basketball Player, WNBA' 
                },
                quantity: 18,
                price: 14.80,
                user: 'WNBATrader',
                timestamp: new Date(now.getTime() - 10 * 60 * 60 * 1000).toISOString() // 10 hours ago
            }
        ];
        console.log('Created fresh seeded offers data:', seedData.length, 'offers');
        return seedData;
    }

    function saveOffersToStorage() {
        try {
            localStorage.setItem('fanscout_offers', JSON.stringify(allOffersData));
        } catch (error) {
            console.error('Error saving offers to storage:', error);
        }
    }

    let allOffersData = loadOffersFromStorage();
    console.log('Initial offers data loaded:', allOffersData.length, 'offers');
    
    // Auto-refresh data if we have fewer than 5 offers (likely old/corrupted data)
    if (allOffersData.length < 5) {
        console.log('Low offer count detected, refreshing with fresh seed data...');
        allOffersData = loadOffersFromStorage(true);
        saveOffersToStorage();
        console.log('Refreshed offers data loaded:', allOffersData.length, 'offers');
    }

    // Function to reset offers data to fresh seed data
    window.resetOffersData = function() {
        console.log('Resetting offers data...');
        localStorage.removeItem('fanscout_offers');
        allOffersData = loadOffersFromStorage(true); // Force reset
        saveOffersToStorage(); // Save the fresh data
        console.log('Offers data reset to fresh seed data. Total offers:', allOffersData.length);
        
        // Refresh the current offers display if we're on that section
        if (document.getElementById('current-offers-section')?.classList.contains('active')) {
            loadCurrentOffers();
        }
        
        return allOffersData;
    };

    // Debug function to check current offers data
    window.debugOffers = function() {
        console.log('Current offers data:', allOffersData);
        console.log('LocalStorage offers:', localStorage.getItem('fanscout_offers'));
        console.log('Total offers:', allOffersData.length);
        return allOffersData;
    };
    
    // Reset balance for testing
    window.resetBalance = function(amount = 10000) {
        accountBalance = amount;
        saveAccountBalance();
        updateBalanceDisplay();
        console.log('Balance reset to:', accountBalance);
        return accountBalance;
    };
    
    // Debug function to check ownership data
    window.debugOwnership = function() {
        console.log('Current ownership data:', ownershipData);
        console.log('LocalStorage ownership:', localStorage.getItem('fanscout_ownership'));
        console.log('All athletes data:', allAthletesData?.length, 'athletes');
        return ownershipData;
    };
    
    // Add test shares for debugging
    window.addTestShares = function(athleteName, shares = 10) {
        ownershipData[athleteName] = (ownershipData[athleteName] || 0) + shares;
        saveOwnershipData();
        updatePortfolioDisplay();
        console.log(`Added ${shares} shares of ${athleteName}. Total: ${ownershipData[athleteName]}`);
        return ownershipData[athleteName];
    };

    // Simulate ownership data for bbb@gmail.com to enable sell offers
    function addTestOwnership() {
        // Only add test ownership if we're using the test account
        if (currentUser && currentUser.email === 'bbb@gmail.com') {
            // Add ownership for athletes that bbb@gmail.com is selling
            ownershipData['Tom Brady'] = 25; // owns 25, selling 12
            ownershipData['Lionel Messi'] = 35; // owns 35, selling 20  
            ownershipData['Serena Williams'] = 15; // owns 15, selling 8
            console.log('Added test ownership for bbb@gmail.com:', ownershipData);
        }
    }

    // Load current offers with search and filter support
    function loadCurrentOffers(filterType = 'all') {
        console.log('loadCurrentOffers called with filterType:', filterType);
        console.log('Total offers available:', allOffersData.length);
        
        const offersList = document.getElementById('offersList');
        if (!offersList) {
            console.error('offersList element not found');
            return;
        }
        
        // Get search and filter values
        const searchQuery = document.getElementById('offersSearchInput')?.value.toLowerCase() || '';
        const sportFilter = document.getElementById('offerSportFilter')?.value || 'all';
        const minPrice = parseFloat(document.getElementById('offerMinPrice')?.value) || 0;
        const maxPrice = parseFloat(document.getElementById('offerMaxPrice')?.value) || Infinity;
        const sortValue = document.getElementById('offerSort')?.value || 'default';
        
        let filteredOffers = allOffersData;
        
        // Apply type filter (all/buying/selling)
        if (filterType !== 'all') {
            filteredOffers = filteredOffers.filter(offer => offer.type === filterType);
        }
        
        // Apply search filter
        if (searchQuery) {
            filteredOffers = filteredOffers.filter(offer => {
                const nameMatch = offer.athlete.name.toLowerCase().includes(searchQuery);
                const detailsMatch = offer.athlete.details.toLowerCase().includes(searchQuery);
                const userMatch = offer.user.toLowerCase().includes(searchQuery);
                return nameMatch || detailsMatch || userMatch;
            });
        }
        
        // Apply sport filter
        if (sportFilter !== 'all') {
            filteredOffers = filteredOffers.filter(offer => {
                // Extract sport from athlete details or use a mapping
                const details = offer.athlete.details.toLowerCase();
                if (sportFilter === 'nfl') return details.includes('nfl') || details.includes('chiefs') || details.includes('patriots') || details.includes('packers');
                if (sportFilter === 'nba') return details.includes('nba') || details.includes('celtics') || details.includes('lakers') || details.includes('warriors');
                if (sportFilter === 'ncaaf') return details.includes('college') && details.includes('football');
                if (sportFilter === 'ncaab') return details.includes('college') && details.includes('basketball');
                if (sportFilter === 'soccer') return details.includes('soccer') || details.includes('mls') || details.includes('fc');
                return true;
            });
        }
        
        // Apply price filter
        filteredOffers = filteredOffers.filter(offer => {
            return offer.price >= minPrice && offer.price <= maxPrice;
        });
        
        // Apply sorting
        if (sortValue === 'name-asc') {
            filteredOffers.sort((a, b) => a.athlete.name.localeCompare(b.athlete.name));
        } else if (sortValue === 'price-desc') {
            filteredOffers.sort((a, b) => b.price - a.price);
        } else if (sortValue === 'market-cap-desc') {
            filteredOffers.sort((a, b) => (b.price * b.quantity) - (a.price * a.quantity));
        } else {
            // Default: Sort by timestamp (newest first)
            filteredOffers.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        }
        
        if (filteredOffers.length === 0) {
            offersList.innerHTML = '<div class="empty-state">No offers found matching your criteria.</div>';
            return;
        }
        
        const offersHtml = filteredOffers.map(offer => `
            <div class="offer-item">
                <div class="offer-header">
                    <img src="${offer.athlete.avatar}" alt="${offer.athlete.name}" class="offer-image">
                    <div class="offer-info">
                        <div class="offer-position">${offer.athlete.details}</div>
                        <div class="offer-name">${offer.athlete.name}</div>
                        <div class="offer-quantity">${offer.quantity} shares</div>
                        <div class="offer-user">by ${offer.user}</div>
                        <div class="offer-timestamp">${formatTimestamp(offer.timestamp)}</div>
                    </div>
                    <div class="offer-price-info">
                        <div class="offer-price-label">${offer.type === 'buying' ? 'Buying at' : 'Selling at'}</div>
                        <div class="offer-price">$${offer.price.toFixed(2)}</div>
                    </div>
                </div>
                <button class="offer-button" onclick="viewOfferDetails(${offer.id})">
                    View Offer
                </button>
            </div>
        `).join('');
        
        offersList.innerHTML = offersHtml;
    }

    // Format timestamp for display
    function formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
        return date.toLocaleDateString();
    }

    // View offer details
    window.viewOfferDetails = function(offerId) {
        console.log('viewOfferDetails called with ID:', offerId);
        console.log('allOffersData:', allOffersData);
        
        const offer = allOffersData.find(o => o.id === offerId);
        if (!offer) {
            console.error('Offer not found with ID:', offerId);
            alert('Offer not found.');
            return;
        }
        
        console.log('Found offer:', offer);
        
        const modalContent = document.getElementById('offerDetailsContent');
        if (!modalContent) return;
        
        const isMyOffer = offer.user === (currentUser ? currentUser.username : 'You');
        const actionButtonText = isMyOffer ? 'Edit Offer' : 
                                (offer.type === 'buying' ? 'Sell to this buyer' : 'Buy from this seller');
        const actionButtonClass = isMyOffer ? 'btn-secondary' : 'btn-primary';
        
        modalContent.innerHTML = `
            <div class="offer-details">
                <div class="offer-athlete-section">
                    <img src="${offer.athlete.avatar}" alt="${offer.athlete.name}" class="offer-detail-image">
                    <div class="offer-athlete-info">
                        <h3 class="offer-athlete-name">${offer.athlete.name}</h3>
                        <p class="offer-athlete-position">${offer.athlete.details}</p>
                        <button class="btn-secondary" onclick="viewAthleteFromOffer('${offer.athlete._id}')">
                            View Athlete Details
                        </button>
                    </div>
                </div>
                
                <div class="offer-info-section">
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Offer Type:</span>
                        <span class="offer-detail-value ${offer.type}">${offer.type.charAt(0).toUpperCase() + offer.type.slice(1)}</span>
                    </div>
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Quantity:</span>
                        <span class="offer-detail-value">${offer.quantity} shares</span>
                    </div>
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Price per Share:</span>
                        <span class="offer-detail-value">$${offer.price.toFixed(2)}</span>
                    </div>
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Total Value:</span>
                        <span class="offer-detail-value total-value">$${(offer.quantity * offer.price).toFixed(2)}</span>
                    </div>
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Posted by:</span>
                        <span class="offer-detail-value">${offer.user}</span>
                    </div>
                    <div class="offer-detail-row">
                        <span class="offer-detail-label">Posted:</span>
                        <span class="offer-detail-value">${formatTimestamp(offer.timestamp)}</span>
                    </div>
                </div>
                
                <div class="offer-actions">
                    <button class="${actionButtonClass}" onclick="${isMyOffer ? `editOffer(${offer.id})` : `acceptOffer(${offer.id})`}">
                        ${actionButtonText}
                    </button>
                    ${!isMyOffer ? `
                    <button class="btn-secondary" onclick="messageOfferUser('${offer.user}')">
                        Message ${offer.user}
                    </button>
                    ` : `
                    <button class="btn-danger" onclick="deleteOffer(${offer.id})">
                        Delete Offer
                    </button>
                    `}
                </div>
            </div>
        `;
        
        // Show modal using centralized modal system
        openModal('offerDetailsModal');
    };

    // Accept offer
    window.acceptOffer = function(offerId) {
        const offer = allOffersData.find(o => o.id === offerId);
        if (!offer) return;
        
        const confirmMessage = `Are you sure you want to ${offer.type === 'buying' ? 'sell' : 'buy'} ${offer.quantity} shares of ${offer.athlete.name} ${offer.type === 'buying' ? 'to' : 'from'} ${offer.user} for $${offer.price.toFixed(2)} per share?\n\nTotal: $${(offer.quantity * offer.price).toFixed(2)}`;
        
        if (confirm(confirmMessage)) {
            // Update portfolio ownership and balance
            const totalAmount = offer.quantity * offer.price;
            
            if (offer.type === 'buying') {
                // Someone is buying, so current user is selling
                const currentOwned = ownershipData[offer.athlete.name] || 0;
                if (currentOwned >= offer.quantity) {
                    ownershipData[offer.athlete.name] = currentOwned - offer.quantity;
                    // Add money to balance from selling
                    accountBalance += totalAmount;
                } else {
                    alert('You don\'t own enough shares to fulfill this offer.');
                    return;
                }
            } else {
                // Someone is selling, so current user is buying
                if (accountBalance >= totalAmount) {
                    const currentOwned = ownershipData[offer.athlete.name] || 0;
                    ownershipData[offer.athlete.name] = currentOwned + offer.quantity;
                    // Subtract money from balance for buying
                    accountBalance -= totalAmount;
                } else {
                    alert('You don\'t have enough balance to buy these shares.');
                    return;
                }
            }
            
            // Save updated ownership and balance
            saveOwnershipData();
            saveAccountBalance();
            
            // Update portfolio display
            updatePortfolioDisplay();
            
            // Add notification about accepted offer
            addNotification(`Offer accepted! ${offer.type === 'buying' ? 'Sold' : 'Bought'} ${offer.quantity} shares of ${offer.athlete.name} for $${(offer.quantity * offer.price).toFixed(2)}`);
            
            // Remove the offer from the list
            allOffersData = allOffersData.filter(o => o.id !== offerId);
            saveOffersToStorage();
            
            // Close modal and refresh offers
            closeAllModals();
            loadCurrentOffers();
        }
    };

    // Message offer user - open messaging system
    window.messageOfferUser = function(username) {
        console.log('messageOfferUser called with:', username);
        
        // First close the offer details modal
        closeAllModals();
        
        // Navigate to messages tab
        showTab('messages');
        
        // Try to find an existing conversation with this user
        const existingConversation = messagesData.find(convo => 
            convo.name === username || 
            convo.username === username ||
            (convo.participants && convo.participants.some(p => p.username === username))
        );
        
        if (existingConversation) {
            console.log('Found existing conversation:', existingConversation);
            // Open existing conversation
            openChat(existingConversation.id);
        } else {
            console.log('Creating new conversation with:', username);
            // Create new conversation with proper structure
            const newConversation = {
                id: Date.now().toString(),
                name: username,
                username: username,
                avatar: 'images/image_48fb0979.png',
                conversationType: 'user-to-user',
                participants: [
                    { username: username, avatar: 'images/image_48fb0979.png' },
                    { username: currentUser?.username || 'You', avatar: currentUser?.avatar || 'images/image_48fb0979.png' }
                ],
                messages: [],
                lastMessage: 'Start a conversation...',
                lastMessageTime: 'Just now',
                time: 'now',
                unreadCount: 0,
                unread: false
            };
            
            messagesData.push(newConversation);
            populateMessages();
            
            // Open the new conversation
            setTimeout(() => {
                openChat(newConversation.id);
            }, 100);
        }
    };

    // Edit offer
    window.editOffer = function(offerId) {
        console.log('editOffer called with ID:', offerId);
        
        const offer = allOffersData.find(o => o.id === offerId);
        if (!offer) {
            alert('Offer not found.');
            return;
        }
        
        // Populate the edit form
        document.getElementById('editOfferType').value = offer.type;
        document.getElementById('editOfferAthlete').value = `${offer.athlete.name} (${offer.athlete.details})`;
        document.getElementById('editOfferQuantity').value = offer.quantity;
        document.getElementById('editOfferPrice').value = offer.price;
        
        // Set up form validation for sell offers
        const editOfferType = document.getElementById('editOfferType');
        const editOfferQuantity = document.getElementById('editOfferQuantity');
        
        function updateEditQuantityLimits() {
            if (editOfferType.value === 'selling') {
                const ownedShares = ownershipData[offer.athlete.name] || 0;
                if (ownedShares === 0) {
                    editOfferQuantity.disabled = true;
                    editOfferQuantity.placeholder = 'You don\'t own this athlete';
                    editOfferQuantity.max = 0;
                } else {
                    editOfferQuantity.disabled = false;
                    editOfferQuantity.placeholder = `Max: ${ownedShares} shares`;
                    editOfferQuantity.max = ownedShares;
                }
            } else {
                editOfferQuantity.disabled = false;
                editOfferQuantity.placeholder = 'Enter quantity';
                editOfferQuantity.removeAttribute('max');
            }
        }
        
        editOfferType.addEventListener('change', updateEditQuantityLimits);
        updateEditQuantityLimits();
        
        // Handle form submission
        const editOfferForm = document.getElementById('editOfferForm');
        editOfferForm.onsubmit = function(e) {
            e.preventDefault();
            
            const updatedData = {
                type: editOfferType.value,
                quantity: parseInt(editOfferQuantity.value),
                price: parseFloat(document.getElementById('editOfferPrice').value),
            };
            
            // Validate sell offers
            if (updatedData.type === 'selling') {
                const ownedShares = ownershipData[offer.athlete.name] || 0;
                if (ownedShares === 0) {
                    alert(`You don't own any shares of ${offer.athlete.name}.`);
                    return;
                }
                if (updatedData.quantity > ownedShares) {
                    alert(`You only own ${ownedShares} shares of ${offer.athlete.name}.`);
                    return;
                }
            }
            
            // Update the offer
            const offerIndex = allOffersData.findIndex(o => o.id === offerId);
            if (offerIndex !== -1) {
                allOffersData[offerIndex] = {
                    ...offer,
                    ...updatedData,
                    timestamp: new Date().toISOString() // Update timestamp
                };
                saveOffersToStorage();
                closeAllModals();
                loadCurrentOffers();
                alert('Offer updated successfully!');
            }
        };
        
        // Close offer details and show edit modal
        closeAllModals();
        setTimeout(() => {
            openModal('editOfferModal');
        }, 100);
    };

    // Delete offer
    window.deleteOffer = function(offerId) {
        if (confirm('Are you sure you want to delete this offer?')) {
            allOffersData = allOffersData.filter(o => o.id !== offerId);
            saveOffersToStorage();
            closeAllModals();
            loadCurrentOffers();
            alert('Offer deleted successfully.');
        }
    };

    // Save ownership data to localStorage
    function saveOwnershipData() {
        try {
            localStorage.setItem('fanscout_ownership', JSON.stringify(ownershipData));
        } catch (error) {
            console.error('Error saving ownership data:', error);
        }
    }
    
    // Save account balance to localStorage
    function saveAccountBalance() {
        try {
            localStorage.setItem('fanscout_balance', accountBalance.toString());
        } catch (error) {
            console.error('Error saving account balance:', error);
        }
    }
    
    // Update portfolio display
    function updatePortfolioDisplay() {
        // Update the portfolio tab if it exists
        const portfolioTab = document.getElementById('portfolio-section');
        if (portfolioTab && portfolioTab.classList.contains('active')) {
            // Refresh the portfolio display
            if (typeof populateProspects === 'function') {
                populateProspects('my-prospects');
            }
        }
        
        // Update balance display on dashboard
        updateBalanceDisplay();
        
        // Update dashboard stats
        updateDashboardStats();
    }
    
    // Update balance display
    function updateBalanceDisplay() {
        // Update profile balance
        const profileBalanceElement = document.getElementById('profile-account-balance');
        if (profileBalanceElement) {
            profileBalanceElement.textContent = `$${accountBalance.toFixed(2)}`;
        }
    }
    
    // Update dashboard statistics
    function updateDashboardStats() {
        let totalShares = 0;
        let totalValue = 0;
        
        // Calculate total shares and value from ownership data
        if (ownershipData && allAthletesData) {
            for (const [athleteName, shares] of Object.entries(ownershipData)) {
                if (shares > 0) {
                    totalShares += shares;
                    // Find the athlete data to get current price
                    const athlete = allAthletesData.find(a => a.name === athleteName);
                    if (athlete) {
                        totalValue += shares * athlete.currentPrice;
                    }
                }
            }
        }
        
        // Update the dashboard elements
        const shareValueElement = document.getElementById('total-share-value');
        const sharesOwnedElement = document.getElementById('total-shares-owned');
        
        if (shareValueElement) {
            shareValueElement.textContent = `$${totalValue.toFixed(2)}`;
        }
        
        if (sharesOwnedElement) {
            sharesOwnedElement.textContent = totalShares.toLocaleString();
        }
        
        console.log('Dashboard stats updated:', { totalShares, totalValue });
    }

    // View athlete details from offer modal
    window.viewAthleteFromOffer = function(athleteId) {
        console.log('viewAthleteFromOffer called with ID:', athleteId);
        
        // Find the full athlete data
        let athlete = allAthletesData.find(a => a._id === athleteId);
        
        if (!athlete) {
            // If not found by _id, try by name match from the offer athlete data
            const offer = allOffersData.find(o => o.athlete._id === athleteId);
            if (offer) {
                athlete = allAthletesData.find(a => a.name === offer.athlete.name);
            }
        }
        
        if (!athlete) {
            console.error('Athlete not found with ID:', athleteId);
            console.log('Available athletes:', allAthletesData.map(a => ({id: a._id, name: a.name})));
            alert('Athlete details not found. Please try again or refresh the page.');
            return;
        }
        
        console.log('Found athlete:', athlete);
        
        // Close offer details modal and show athlete details
        closeAllModals();
        setTimeout(() => {
            showAthleteDetail(athlete);
        }, 100);
    };

    // Load post offer form
    function loadPostOfferForm() {
        const offerAthleteSelect = document.getElementById('offerAthlete');
        const offerTypeSelect = document.getElementById('offerType');
        const offerQuantityInput = document.getElementById('offerQuantity');
        
        if (!offerAthleteSelect) return;
        
        // Populate athlete dropdown
        if (allAthletesData && allAthletesData.length > 0) {
            const athleteOptions = allAthletesData.map(athlete => {
                const ownedShares = ownershipData[athlete.name] || 0;
                const ownershipText = ownedShares > 0 ? ` (You own: ${ownedShares})` : '';
                return `<option value="${athlete._id}">${athlete.name} (${athlete.details})${ownershipText}</option>`;
            }).join('');
            offerAthleteSelect.innerHTML = '<option value="">Select athlete</option>' + athleteOptions;
        }
        
        // Add event listeners for dynamic form updates
        function updateQuantityLimits() {
            const selectedAthleteId = offerAthleteSelect.value;
            const offerType = offerTypeSelect.value;
            
            if (selectedAthleteId && offerType === 'selling') {
                const selectedAthlete = allAthletesData.find(a => a._id === selectedAthleteId);
                if (selectedAthlete) {
                    const ownedShares = ownershipData[selectedAthlete.name] || 0;
                    if (ownedShares === 0) {
                        offerQuantityInput.disabled = true;
                        offerQuantityInput.placeholder = 'You don\'t own this athlete';
                        offerQuantityInput.max = 0;
                    } else {
                        offerQuantityInput.disabled = false;
                        offerQuantityInput.placeholder = `Max: ${ownedShares} shares`;
                        offerQuantityInput.max = ownedShares;
                    }
                }
            } else {
                offerQuantityInput.disabled = false;
                offerQuantityInput.placeholder = 'Enter quantity';
                offerQuantityInput.removeAttribute('max');
            }
        }
        
        offerAthleteSelect?.addEventListener('change', updateQuantityLimits);
        offerTypeSelect?.addEventListener('change', updateQuantityLimits);
        
        // Handle form submission
        const postOfferForm = document.getElementById('postOfferForm');
        if (postOfferForm) {
            postOfferForm.onsubmit = function(e) {
                e.preventDefault();
                
                const formData = {
                    type: document.getElementById('offerType').value,
                    athlete: document.getElementById('offerAthlete').value,
                    quantity: parseInt(document.getElementById('offerQuantity').value),
                    price: parseFloat(document.getElementById('offerPrice').value),
                };
                
                // Validate form
                if (!formData.type || !formData.athlete || !formData.quantity || !formData.price) {
                    alert('Please fill in all required fields.');
                    return;
                }
                
                // Find the selected athlete
                const selectedAthlete = allAthletesData.find(athlete => athlete._id === formData.athlete);
                if (!selectedAthlete) {
                    alert('Selected athlete not found.');
                    return;
                }
                
                // Validate sell offers - check ownership
                if (formData.type === 'selling') {
                    const ownedShares = ownershipData[selectedAthlete.name] || 0;
                    if (ownedShares === 0) {
                        alert(`You don't own any shares of ${selectedAthlete.name}. You can only sell athletes you own.`);
                        return;
                    }
                    if (formData.quantity > ownedShares) {
                        alert(`You only own ${ownedShares} shares of ${selectedAthlete.name}. You cannot sell ${formData.quantity} shares.`);
                        return;
                    }
                }
                
                // Create new offer
                const newOffer = {
                    id: Date.now(), // Simple ID generation
                    type: formData.type,
                    athlete: {
                        _id: selectedAthlete._id,
                        name: selectedAthlete.name,
                        avatar: selectedAthlete.avatar,
                        details: selectedAthlete.details
                    },
                    quantity: formData.quantity,
                    price: formData.price,
                    user: currentUser ? currentUser.username : 'You',
                    timestamp: new Date().toISOString()
                };
                
                // Add to offers list
                allOffersData.unshift(newOffer);
                saveOffersToStorage();
                
                // Reset form
                postOfferForm.reset();
                
                // Switch to current offers view and refresh
                showOffersSection('current-offers');
                
                // Show success message
                setTimeout(() => {
                    alert('Offer posted successfully!');
                }, 100);
            };
        }
    }

    // Add event listeners for offers page
    document.addEventListener('click', function(e) {
        // Filter button for athletes
        if (e.target.id === 'athletesFilterBtn') {
            const filterMenu = document.getElementById('athletesFilterMenu');
            if (filterMenu) {
                const isHidden = filterMenu.style.display === 'none' || filterMenu.style.display === '';
                filterMenu.style.display = isHidden ? 'block' : 'none';
            }
        }
        
        // Filter button for offers
        if (e.target.id === 'offersFilterBtn') {
            const filterMenu = document.getElementById('offersFilterMenu');
            if (filterMenu) {
                const isHidden = filterMenu.style.display === 'none' || filterMenu.style.display === '';
                filterMenu.style.display = isHidden ? 'block' : 'none';
            }
        }
    });

    // Add event listeners for search and filter inputs
    function setupAthleteFilters() {
        // Remove existing listeners to prevent duplicates
        const athletesSearchInput = document.getElementById('athletesSearchInput');
        const athleteSportFilter = document.getElementById('athleteSportFilter');
        const athleteMinPrice = document.getElementById('athleteMinPrice');
        const athleteMaxPrice = document.getElementById('athleteMaxPrice');
        const athleteSort = document.getElementById('athleteSort');
        
        if (athletesSearchInput) {
            athletesSearchInput.removeEventListener('input', filterAthletes);
            athletesSearchInput.addEventListener('input', filterAthletes);
        }
        
        if (athleteSportFilter) {
            athleteSportFilter.removeEventListener('change', filterAthletes);
            athleteSportFilter.addEventListener('change', filterAthletes);
        }
        
        if (athleteMinPrice) {
            athleteMinPrice.removeEventListener('input', filterAthletes);
            athleteMinPrice.addEventListener('input', filterAthletes);
        }
        
        if (athleteMaxPrice) {
            athleteMaxPrice.removeEventListener('input', filterAthletes);
            athleteMaxPrice.addEventListener('input', filterAthletes);
        }
        
        if (athleteSort) {
            athleteSort.removeEventListener('change', filterAthletes);
            athleteSort.addEventListener('change', filterAthletes);
        }
        
        // Note: athletesFilterBtn click handler is already handled by the global click listener above
        // No need to add duplicate listener here
    }
    
    // Setup filters for current offers section
    function setupOffersFilters() {
        // Remove existing listeners to prevent duplicates
        const offersSearchInput = document.getElementById('offersSearchInput');
        const offerSportFilter = document.getElementById('offerSportFilter');
        const offerMinPrice = document.getElementById('offerMinPrice');
        const offerMaxPrice = document.getElementById('offerMaxPrice');
        const offerSort = document.getElementById('offerSort');
        const offersFilterBtn = document.getElementById('offersFilterBtn');
        
        if (offersSearchInput) {
            offersSearchInput.removeEventListener('input', loadCurrentOffers);
            offersSearchInput.addEventListener('input', () => loadCurrentOffers());
        }
        
        if (offerSportFilter) {
            offerSportFilter.removeEventListener('change', loadCurrentOffers);
            offerSportFilter.addEventListener('change', () => loadCurrentOffers());
        }
        
        if (offerMinPrice) {
            offerMinPrice.removeEventListener('input', loadCurrentOffers);
            offerMinPrice.addEventListener('input', () => loadCurrentOffers());
        }
        
        if (offerMaxPrice) {
            offerMaxPrice.removeEventListener('input', loadCurrentOffers);
            offerMaxPrice.addEventListener('input', () => loadCurrentOffers());
        }
        
        if (offerSort) {
            offerSort.removeEventListener('change', loadCurrentOffers);
            offerSort.addEventListener('change', () => loadCurrentOffers());
        }
        
        // Note: offersFilterBtn click handler is already handled by the global click listener above
        // No need to add duplicate listener here
    }
    
    // toggleOffersFilter function removed - filter toggle is now handled by global click listener

    // Setup filters initially and when offers page becomes active
    setupAthleteFilters();

    // Initialize offers page when it becomes active
    const existingShowPage = window.showPage;
    window.showPage = function(pageId) {
        existingShowPage(pageId);
        
        if (pageId === 'offers') {
            // Add test ownership for bbb@gmail.com if needed
            addTestOwnership();
            // Initialize with athletes section by default
            setTimeout(() => {
                showOffersSection('athletes');
            }, 100);
        }
    };
    
    // Setup event listeners to replace onclick handlers
    function setupEventListeners() {
        // Offers section buttons
        document.querySelectorAll('[data-section]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.target.getAttribute('data-section');
                showOffersSection(section);
            });
        });

        // Sport filter buttons
        document.querySelectorAll('[data-sport]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const sport = e.target.getAttribute('data-sport');
                filterAthletesBySport(sport);
            });
        });

        // Filter offers buttons
        document.querySelectorAll('[data-filter]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                const filter = e.target.getAttribute('data-filter');
                filterOffers(filter);
            });
        });

        // Close modal buttons
        document.querySelectorAll('.modal-close, .chat-back').forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault();
                closeAllModals();
            });
        });
    }
    
    // Initialize event listeners
    setupEventListeners();
    
}); // End of DOMContentLoaded