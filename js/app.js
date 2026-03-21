window.initApplication = function() {
            // Firebase configuration
            const firebaseConfig = {
                apiKey: "AIzaSyBMVTZBMXjBDT45foOQPGCnL5xNRqWNEkw",
                authDomain: "drink-tracker-b7bc1.firebaseapp.com",
                databaseURL: "https://drink-tracker-b7bc1-default-rtdb.europe-west1.firebasedatabase.app",
                projectId: "drink-tracker-b7bc1",
                storageBucket: "drink-tracker-b7bc1.firebasestorage.app",
                messagingSenderId: "88411843150",
                appId: "1:88411843150:web:eb86e61187f2cae7b1311f"
            };
    
            // Initialize Firebase
            const app = initFirebase(firebaseConfig);
            const database = getDatabase(app);
            const auth = getAuth(app);
            
            // Session state
            let currentSession = localStorage.getItem('currentSession');
            let isAdmin = localStorage.getItem('isAdmin') === 'true';
            let adminCode = localStorage.getItem('adminCode');
            let userId = localStorage.getItem('userId');
            let currentParticipantId = localStorage.getItem('currentParticipantId');
            let activeTab = 'main';  // Track which tab is currently active
            
            // Auth status display
            const authStatusEl = document.getElementById('authStatus');
            
            // Sign in anonymously for security (non-blocking)
            if (!userId) {
                authStatusEl.textContent = '🔐 Giriş yapılıyor...';
                authStatusEl.style.background = 'rgba(255, 193, 7, 0.2)';
                authStatusEl.style.color = '#ffc107';
                
                // Generate temporary ID immediately
                userId = 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                localStorage.setItem('userId', userId);
                
                // Then authenticate in background
                signInAnonymously(auth).then((userCredential) => {
                    // Update with real Firebase UID
                    userId = userCredential.user.uid;
                    localStorage.setItem('userId', userId);
                    console.log('✅ Signed in with UID:', userId);
                    
                    authStatusEl.textContent = '🔐 Giriş Yapıldı';
                    authStatusEl.style.background = 'rgba(40, 167, 69, 0.2)';
                    authStatusEl.style.color = '#28a745';
                }).catch((error) => {
                    console.error('❌ Auth error:', error);
                    authStatusEl.textContent = '🔐 Auth Hatası';
                    authStatusEl.style.background = 'rgba(220, 53, 69, 0.2)';
                    authStatusEl.style.color = '#dc3545';
                    // Keep the temporary ID
                });
            } else {
                // Try to restore session
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        // Session valid
                        userId = user.uid;
                        localStorage.setItem('userId', userId);
                        console.log('✅ Auth restored:', userId);
                        
                        authStatusEl.textContent = '🔐 Giriş Yapıldı';
                        authStatusEl.style.background = 'rgba(40, 167, 69, 0.2)';
                        authStatusEl.style.color = '#28a745';
                    } else {
                        authStatusEl.textContent = '🔐 Yeniden giriş...';
                        authStatusEl.style.background = 'rgba(255, 193, 7, 0.2)';
                        authStatusEl.style.color = '#ffc107';
                        
                        // Session expired, sign in again
                        signInAnonymously(auth).then((userCredential) => {
                            userId = userCredential.user.uid;
                            localStorage.setItem('userId', userId);
                            console.log('✅ Re-authenticated:', userId);
                            
                            authStatusEl.textContent = '🔐 Giriş Yapıldı';
                            authStatusEl.style.background = 'rgba(40, 167, 69, 0.2)';
                            authStatusEl.style.color = '#28a745';
                        }).catch(error => {
                            console.error('❌ Re-auth error:', error);
                            authStatusEl.textContent = '🔐 Auth Hatası';
                            authStatusEl.style.background = 'rgba(220, 53, 69, 0.2)';
                            authStatusEl.style.color = '#dc3545';
                        });
                    }
                });
            }
    
            // Monitor connection status
            const connectionStatus = document.getElementById('connectionStatus');
            const connectedRef = ref(database, '.info/connected');
            onValue(connectedRef, (snapshot) => {
                if (snapshot.val() === true) {
                    connectionStatus.textContent = '✓ Bağlandı';
                    connectionStatus.className = 'connection-status online';
                } else {
                    connectionStatus.textContent = '⚠ Çevrimdışı';
                    connectionStatus.className = 'connection-status offline';
                }
            });
            
            // Participant color palette (pastel, dark-theme friendly, colorblind-safe)
            const PARTICIPANT_COLORS = [
                { bg: 'rgba(74, 144, 226, 0.12)', border: '#4a90e2', name: 'Mavi' },      // Blue
                { bg: 'rgba(40, 167, 69, 0.12)', border: '#28a745', name: 'Yeşil' },      // Green
                { bg: 'rgba(255, 193, 7, 0.12)', border: '#ffc107', name: 'Sarı' },       // Yellow
                { bg: 'rgba(220, 53, 69, 0.12)', border: '#dc3545', name: 'Kırmızı' },    // Red
                { bg: 'rgba(138, 43, 226, 0.12)', border: '#8a2be2', name: 'Mor' },       // Purple
                { bg: 'rgba(255, 152, 0, 0.12)', border: '#ff9800', name: 'Turuncu' },    // Orange
                { bg: 'rgba(0, 188, 212, 0.12)', border: '#00bcd4', name: 'Camgöbeği' },  // Cyan
                { bg: 'rgba(233, 30, 99, 0.12)', border: '#e91e63', name: 'Pembe' }       // Pink
            ];
            
            // Get participant color based on index
            function getParticipantColor(participantId) {
                const participantIds = Object.keys(sessionData.participants || {})
                    .filter(id => sessionData.participants[id].isActive)
                    .sort(); // Consistent order
                const index = participantIds.indexOf(participantId);
                return PARTICIPANT_COLORS[index % PARTICIPANT_COLORS.length];
            }
            
            // userId is now handled by Firebase Auth above
    
            // Notification permission
            let notificationsEnabled = false;
    
            // Request notification permission
            async function requestNotificationPermission() {
                if (!('Notification' in window)) {
                    return false;
                }
    
                if (Notification.permission === 'granted') {
                    notificationsEnabled = true;
                    return true;
                }
    
                if (Notification.permission !== 'denied') {
                    const permission = await Notification.requestPermission();
                    notificationsEnabled = permission === 'granted';
                    return notificationsEnabled;
                }
    
                return false;
            }
    
            // Show browser notification
            function showBrowserNotification(title, body, options = {}) {
                if (!notificationsEnabled) {
                    return;
                }
    
                const notification = new Notification(title, {
                    body: body,
                    icon: '🍺',
                    badge: '🍺',
                    tag: 'drink-notification',
                    requireInteraction: false,
                    ...options
                });
    
                // Auto close after 5 seconds
                setTimeout(() => notification.close(), 5000);
    
                // Play sound
                playNotificationSound();
    
                // Vibrate
                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }
            }
    
            // Play notification sound
            function playNotificationSound() {
                // Simple beep sound using Web Audio API
                try {
                    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                    const oscillator = audioContext.createOscillator();
                    const gainNode = audioContext.createGain();
    
                    oscillator.connect(gainNode);
                    gainNode.connect(audioContext.destination);
    
                    oscillator.frequency.value = 800;
                    oscillator.type = 'sine';
    
                    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
                    oscillator.start(audioContext.currentTime);
                    oscillator.stop(audioContext.currentTime + 0.5);
                } catch (e) {
                    // Silently fail if audio not supported
                }
            }
    
            // Drink icon mapping
            const DRINK_ICONS = {
                '🍺': ['Bira', 'Beer', 'Efes', 'Tuborg', 'Bomonti'],
                '🍷': ['Şarap', 'Wine', 'Kırmızı Şarap', 'Beyaz Şarap'],
                '🍸': ['Kokteyl', 'Cocktail', 'Mojito', 'Margarita'],
                '🥃': ['Viski', 'Whisky', 'Whiskey', 'Bourbon', 'Scotch'],
                '🍹': ['Cin Tonik', 'Gin', 'Tonic', 'Vodka Portakal'],
                '🍾': ['Şampanya', 'Champagne', 'Prosecco'],
                '🥂': ['Şerefe', 'Toast', 'Celebration'],
                '🍶': ['Sake', 'Saki'],
                '🥛': ['Rakı', 'Rak', 'Raki', 'Yeni Rakı'],
                '🧉': ['Martini', 'Dry Martini', 'Espresso Martini'],
                '🥤': ['Shot', 'Tekila', 'Tequila', 'Jäger', 'Vodka']
            };
    
            // Get icon for drink type
            function getDrinkIcon(drinkType) {
                if (!drinkType) return '🍹';
                
                const lowerDrink = drinkType.toLowerCase();
                
                // Check custom icons first (stored in session)
                if (sessionData.drinkIcons && sessionData.drinkIcons[drinkType]) {
                    return sessionData.drinkIcons[drinkType];
                }
                
                // Find matching icon
                for (const [icon, keywords] of Object.entries(DRINK_ICONS)) {
                    if (keywords.some(keyword => lowerDrink.includes(keyword.toLowerCase()))) {
                        return icon;
                    }
                }
                
                return '🍹'; // Default icon
            }
    
            // Alcohol content estimation (in grams of pure alcohol per drink)
            // Assuming 500ml for all beer types
            const ALCOHOL_CONTENT = {
                // Beer / Bira (500ml @ 5% = 20g alcohol)
                'bira': 20,
                'beer': 20,
                'efes': 20,
                'tuborg': 20,
                'bomonti': 20,
                
                // Wine / Şarap (150ml glass @ 12% = 14g)
                'şarap': 14,
                'wine': 14,
                'kırmızı şarap': 14,
                'beyaz şarap': 14,
                
                // Spirits / Sert İçkiler (40ml shot @ 40% = 13g)
                'rakı': 13,
                'raki': 13,
                'rak': 13,
                'vodka': 13,
                'votka': 13,
                'viski': 13,
                'whisky': 13,
                'whiskey': 13,
                'bourbon': 13,
                'scotch': 13,
                'gin': 13,
                'cin': 13,
                'rom': 13,
                'rum': 13,
                'tekila': 13,
                'tequila': 13,
                
                // Cocktails / Kokteyller (typical mixed drink)
                'kokteyl': 18,
                'cocktail': 18,
                'mojito': 16,
                'margarita': 18,
                'martini': 20,
                'cin tonik': 16,
                'vodka portakal': 16,
                
                // Champagne (150ml @ 12% = 14g)
                'şampanya': 14,
                'champagne': 14,
                'prosecco': 14,
                
                // Shots (40ml @ 40% = 13g)
                'shot': 13,
                'jäger': 13,
                'jager': 13,
                
                // Default
                'default': 15
            };
    
            // Get alcohol content for drink type
            function getAlcoholContent(drinkType) {
                if (!drinkType) return ALCOHOL_CONTENT.default;
                
                const lowerDrink = drinkType.toLowerCase();
                
                // Exact match
                if (ALCOHOL_CONTENT[lowerDrink]) {
                    return ALCOHOL_CONTENT[lowerDrink];
                }
                
                // Partial match
                for (const [key, value] of Object.entries(ALCOHOL_CONTENT)) {
                    if (lowerDrink.includes(key) || key.includes(lowerDrink)) {
                        return value;
                    }
                }
                
                return ALCOHOL_CONTENT.default;
            }
    
            // Calculate total alcohol for a participant with time-based metabolism
            // Returns grams of alcohol currently in bloodstream
            function calculateTotalAlcohol(participantId) {
                // Use drinkHistory for time-based metabolism calculation
                const history = sessionData.drinkHistory?.[participantId] || [];
                
                // But first check if drinks exist - if not, return 0 immediately
                const currentDrinks = sessionData.drinks?.[participantId] || {};
                const hasDrinks = Object.keys(currentDrinks).length > 0;
                
                if (!hasDrinks || history.length === 0) return 0;
                
                const now = Date.now();
                let totalAlcohol = 0;
                
                // Alcohol metabolism rate: ~7-10g per hour, we use 8g/hour
                const metabolismRate = 8; // grams per hour
                
                // Absorption time: alcohol takes time to enter bloodstream
                // Peak BAC typically at 30-90 minutes, we use 60 min (1 hour)
                const absorptionTimeHours = 1.0; // 1 hour to fully absorb
                
                history.forEach(entry => {
                    const alcoholGrams = getAlcoholContent(entry.drink) * entry.quantity;
                    const hoursElapsed = (now - entry.timestamp) / 1000 / 60 / 60;
                    
                    // Calculate absorption factor (0 to 1)
                    // Linear absorption over absorptionTimeHours
                    const absorptionFactor = Math.min(1, hoursElapsed / absorptionTimeHours);
                    
                    // Absorbed alcohol = total × absorption factor
                    const absorbedAlcohol = alcoholGrams * absorptionFactor;
                    
                    // Metabolized alcohol starts AFTER absorption begins
                    // But we'll simplify: metabolism happens throughout
                    const metabolizedAlcohol = metabolismRate * hoursElapsed;
                    
                    // Remaining = absorbed - metabolized
                    const remainingAlcohol = Math.max(0, absorbedAlcohol - metabolizedAlcohol);
                    
                    totalAlcohol += remainingAlcohol;
                });
                
                return totalAlcohol;
            }
    
            // Convert grams to promille (BAC - Blood Alcohol Concentration)
            // Using Widmark formula: BAC (‰) = alcohol_grams / (body_weight_kg × r)
            // r = 0.68 for men, 0.55 for women (water distribution factor)
            // Note: Result is already in ‰ (grams per liter), no need to multiply by 10
            // personalized based on participant's gender and weight
            function gramsToPromille(alcoholGrams, participantId) {
                const participant = sessionData.participants[participantId];
                if (!participant) {
                    // Fallback to average male
                    const bodyWeight = 75; // kg
                    const r = 0.68; // men's distribution factor
                    return alcoholGrams / (bodyWeight * r);
                }
                
                // Use participant's weight or default based on gender
                let bodyWeight = participant.weight;
                if (!bodyWeight) {
                    bodyWeight = participant.gender === 'female' ? 65 : 75; // default weights
                }
                
                // Distribution factor based on gender
                const r = participant.gender === 'female' ? 0.55 : 0.68;
                
                const promille = alcoholGrams / (bodyWeight * r);
                return promille;
            }
    
            // Get drunkness level description based on promille
            function getDrunknessLevel(alcoholGrams, participantId) {
                const promille = gramsToPromille(alcoholGrams, participantId);
                
                if (promille === 0) return { level: 'Ayık', emoji: '😐', color: '#28a745', promille };
                if (promille < 0.5) return { level: 'Hafif Neşeli', emoji: '🙂', color: '#4a90e2', promille };
                if (promille < 1.0) return { level: 'Neşeli', emoji: '😊', color: '#ffc107', promille };
                if (promille < 1.5) return { level: 'Çakırkeyif', emoji: '😁', color: '#ff9800', promille };
                if (promille < 2.0) return { level: 'Sarhoş', emoji: '😵', color: '#ff5722', promille };
                return { level: 'Çok Sarhoş', emoji: '🤮', color: '#dc3545', promille };
            }
    
            // Turkish names gender database (common names)
            // All keys are normalized (Turkish chars converted to ASCII)
            const TURKISH_NAMES = {
                // Male names
                'ahmet': 'male', 'mehmet': 'male', 'ali': 'male', 'mustafa': 'male', 'hasan': 'male',
                'huseyin': 'male', 'ibrahim': 'male', 'ismail': 'male', 'murat': 'male', 'emre': 'male',
                'burak': 'male', 'fatih': 'male', 'kemal': 'male', 'osman': 'male', 'cem': 'male',
                'can': 'male', 'berk': 'male', 'efe': 'male', 'eren': 'male', 'kaan': 'male',
                'serkan': 'male', 'volkan': 'male', 'ozgur': 'male', 'onur': 'male', 'baris': 'male',
                'erhan': 'male', 'selim': 'male', 'sinan': 'male', 'taner': 'male', 'arda': 'male',
                'yusuf': 'male', 'omer': 'male', 'enes': 'male', 'furkan': 'male', 'yunus': 'male',
                'bugra': 'male', 'tolga': 'male', 'taylan': 'male', 'ege': 'male', 'alp': 'male',
                'kerem': 'male', 'ufuk': 'male', 'deniz': 'male', 'tuna': 'male', 'doruk': 'male',
                'halil': 'male', 'suleyman': 'male', 'recep': 'male', 'ramazan': 'male', 'yasin': 'male',
                'abdullah': 'male', 'mahmut': 'male', 'orhan': 'male', 'cenk': 'male', 'umut': 'male',
                'serhat': 'male', 'engin': 'male', 'koray': 'male', 'samet': 'male', 'oguz': 'male',
                'caglar': 'male', 'tunc': 'male', 'gorkem': 'male', 'kagan': 'male', 'cagan': 'male',
                'yigit': 'male', 'faruk': 'male', 'cuneyt': 'male', 'ali cem': 'male', 'saner': 'male', 'mert': 'male',
                
                // Female names
                'ayse': 'female', 'fatma': 'female', 'emine': 'female', 'zeynep': 'female', 'elif': 'female',
                'merve': 'female', 'esra': 'female', 'gozde': 'female', 'selin': 'female', 'ece': 'female',
                'busra': 'female', 'buse': 'female', 'seyma': 'female', 'derya': 'female', 'betul': 'female',
                'hilal': 'female', 'ebru': 'female', 'yasemin': 'female', 'pinar': 'female', 'burcu': 'female',
                'ceren': 'female', 'asli': 'female', 'sinem': 'female', 'ozge': 'female',
                'tugba': 'female', 'melike': 'female', 'nur': 'female', 'irem': 'female', 'seda': 'female',
                'duygu': 'female', 'damla': 'female', 'cansu': 'female', 'ipek': 'female', 'begum': 'female',
                'sebnem': 'female', 'gamze': 'female', 'sibel': 'female', 'hande': 'female', 'dilara': 'female',
                'nisa': 'female', 'rabia': 'female', 'hatice': 'female', 'kubra': 'female', 'zeliha': 'female',
                'sevgi': 'female', 'serpil': 'female', 'muge': 'female', 'serap': 'female', 'tulay': 'female',
                'nilufer': 'female', 'gul': 'female', 'gulsen': 'female', 'asya': 'female', 'ada': 'female',
                'defne': 'female', 'ela': 'female', 'nehir': 'female', 'miray': 'female', 'zehra': 'female',
                'azra': 'female', 'aysun': 'female', 'aylin': 'female', 'ayca': 'female', 'berna': 'female',
                'puren': 'female'
            };
            
            // Detect gender from Turkish name
            function detectGenderFromName(name) {
                if (!name) return null;
                const normalized = name.trim().toLowerCase()
                    .replace(/ı/g, 'i')
                    .replace(/ğ/g, 'g')
                    .replace(/ü/g, 'u')
                    .replace(/ş/g, 's')
                    .replace(/ö/g, 'o')
                    .replace(/ç/g, 'c');
                
                return TURKISH_NAMES[normalized] || null;
            }
    
            // Session data
            let sessionData = {
                participants: {},
                drinks: {},
                drinkTypes: [],
                drinkHistory: {},
                undoStack: [],
                notifications: {},  // Changed: { userId: [...notifications] }
                pendingDeletions: {},
                pendingAdjustments: {},
                drinkIcons: {}  // Custom drink type to icon mapping
            };
            
            // Session listener and loading state
            let sessionListener = null; // Track listener to avoid duplicates
            let isLoadingSession = true;
    
            // Temporary data for session creation
            let tempParticipants = [];
            let pendingAction = null;
            let pendingAdminAction = null;
    
            // DOM elements
            const sessionManagement = document.getElementById('sessionManagement');
            const sessionInfo = document.getElementById('sessionInfo');
            const sessionCodeDisplay = document.getElementById('sessionCodeDisplay');
            const sessionRole = document.getElementById('sessionRole');
            const mainContent = document.getElementById('mainContent');
            const notificationsContent = document.getElementById('notificationsContent');
            const approvalsContent = document.getElementById('approvalsContent');
            const statsTab = document.getElementById('statsTab');
            const statsContent = document.getElementById('statsContent');
            const tabNavigation = document.getElementById('tabNavigation');
            const mainTab = document.getElementById('mainTab');
            const notificationsTab = document.getElementById('notificationsTab');
            const approvalsTab = document.getElementById('approvalsTab');
            const notificationCount = document.getElementById('notificationCount');
            const approvalCount = document.getElementById('approvalCount');
    
            // Modal elements
            const createSessionModal = document.getElementById('createSessionModal');
            const sessionCreatedModal = document.getElementById('sessionCreatedModal');
            const joinSessionModal = document.getElementById('joinSessionModal');
            const selectParticipantModal = document.getElementById('selectParticipantModal');
            const addParticipantSessionModal = document.getElementById('addParticipantSessionModal');
            const addDrinkModal = document.getElementById('addDrinkModal');
            const adjustDrinkModal = document.getElementById('adjustDrinkModal');
            const deleteDrinkModal = document.getElementById('deleteDrinkModal');
            const adminCodeModal = document.getElementById('adminCodeModal');
    
            // Generate session code
            function generateSessionCode() {
                const words = ['ASLAN', 'KARTAL', 'KURT', 'PARS', 'AYAK', 'DALGA', 'DENIZ', 'GUNES', 'YILDIZ', 'BULUT', 'FIRTINA', 'DAGLAR', 'ORMAN', 'GOKYUZU', 'RUZGAR'];
                const word = words[Math.floor(Math.random() * words.length)];
                const num = Math.floor(10 + Math.random() * 90);
                return `${word}${num}`;
            }
    
            // Generate admin code
            function generateAdminCode() {
                return Math.floor(1000 + Math.random() * 9000).toString();
            }
    
            // Generate participant ID
            function generateParticipantId() {
                return 'p_' + Math.random().toString(36).substr(2, 9);
            }
    
            // Show toast notification
            function showToast(message, type = 'info') {
                const toastContainer = document.getElementById('toastContainer');
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                toast.innerHTML = `<div class="toast-message">${message}</div>`;
                toastContainer.appendChild(toast);
    
                setTimeout(() => {
                    toast.style.animation = 'slideIn 0.3s ease-out reverse';
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
    
            // Initialize app
            initializeApp();
    
            // Periodic refresh for main content (to update "needs attention" highlights in real-time)
            setInterval(() => {
                if (currentSession && activeTab === 'main') {
                    renderMainContent();
                }
            }, 30000); // Every 30 seconds
    
            // Tab Navigation
            mainTab.addEventListener('click', () => {
                activeTab = 'main';
                mainTab.classList.add('active');
                notificationsTab.classList.remove('active');
                approvalsTab.classList.remove('active');
                statsTab.classList.remove('active');
                mainContent.classList.remove('hidden');
                notificationsContent.classList.add('hidden');
                approvalsContent.classList.add('hidden');
                statsContent.classList.add('hidden');
            });
    
            notificationsTab.addEventListener('click', () => {
                activeTab = 'notifications';
                notificationsTab.classList.add('active');
                mainTab.classList.remove('active');
                approvalsTab.classList.remove('active');
                statsTab.classList.remove('active');
                notificationsContent.classList.remove('hidden');
                mainContent.classList.add('hidden');
                approvalsContent.classList.add('hidden');
                statsContent.classList.add('hidden');
                renderNotifications();
            });
    
            approvalsTab.addEventListener('click', () => {
                activeTab = 'approvals';
                approvalsTab.classList.add('active');
                mainTab.classList.remove('active');
                notificationsTab.classList.remove('active');
                statsTab.classList.remove('active');
                approvalsContent.classList.remove('hidden');
                mainContent.classList.add('hidden');
                notificationsContent.classList.add('hidden');
                statsContent.classList.add('hidden');
                renderApprovals();
            });
    
            statsTab.addEventListener('click', () => {
                activeTab = 'stats';
                statsTab.classList.add('active');
                mainTab.classList.remove('active');
                notificationsTab.classList.remove('active');
                approvalsTab.classList.remove('active');
                statsContent.classList.remove('hidden');
                mainContent.classList.add('hidden');
                notificationsContent.classList.add('hidden');
                approvalsContent.classList.add('hidden');
                renderStats();
            });
    
            // Add notification to session
            // Add notification to specific user(s)
            // targetUserIds: array of userIds, or 'all' for everyone, or 'admin' for admin only
            // excludeCurrentUser: if true, don't send notification to the person who triggered it
            async function addNotification(message, type = 'info', targetUserIds = 'all', excludeCurrentUser = true) {
                const baseId = Date.now();
                const timestamp = Date.now();
    
                try {
                    // Read current notifications from Firebase to avoid duplicates
                    const sessionRef = ref(database, `sessions/${currentSession}`);
                    const snapshot = await get(sessionRef);
                    const data = snapshot.val();
                    const notifications = { ...(data.notifications || {}) };
                    
                    // Determine which users should receive this notification
                    let userIdsToNotify = [];
                    
                    if (targetUserIds === 'all') {
                        // Send to admin and all participants
                        userIdsToNotify.push(data.adminUserId);
                        Object.values(data.participants || {}).forEach(p => {
                            if (p.userId) {
                                userIdsToNotify.push(p.userId);
                            }
                        });
                    } else if (targetUserIds === 'admin') {
                        userIdsToNotify.push(data.adminUserId);
                    } else if (Array.isArray(targetUserIds)) {
                        userIdsToNotify = targetUserIds;
                    } else {
                        userIdsToNotify.push(targetUserIds);
                    }
    
                    // Remove duplicates
                    userIdsToNotify = [...new Set(userIdsToNotify)];
    
                    // Exclude current user if requested (default behavior)
                    if (excludeCurrentUser) {
                        userIdsToNotify = userIdsToNotify.filter(uid => uid !== userId);
                    }
    
                    // Add notification to each user's list with unique ID
                    userIdsToNotify.forEach((uid, index) => {
                        if (!notifications[uid]) {
                            notifications[uid] = [];
                        }
                        // Create unique notification for each user
                        const notification = {
                            id: baseId + index,  // Unique ID per user
                            message: message,
                            type: type,
                            timestamp: timestamp
                        };
                        notifications[uid].push(notification);
                    });
    
                    await update(sessionRef, {
                        notifications: notifications
                    });
                } catch (error) {
                    console.error('Failed to add notification:', error);
                }
            }
    
            // Render notifications
            function renderNotifications() {
                // Get notifications for current user
                const allNotifications = sessionData.notifications || {};
                const userNotificationsData = allNotifications[userId];
                
                // Handle both array (old format) and object (new format)
                let userNotifications = [];
                if (Array.isArray(userNotificationsData)) {
                    userNotifications = userNotificationsData;
                } else if (userNotificationsData && typeof userNotificationsData === 'object') {
                    // Convert object to array
                    userNotifications = Object.values(userNotificationsData);
                }
                
                // Get deleted notifications for current participant (not userId)
                const deletedNotifications = (sessionData.deletedNotifications || {})[currentParticipantId] || [];
                
                // Filter out deleted notifications
                const activeNotifications = userNotifications.filter(notif => 
                    !deletedNotifications.includes(notif.id)
                );
                
                if (activeNotifications.length === 0) {
                    notificationsContent.innerHTML = '<div class="empty-notifications">Henüz bildirim yok</div>';
                    return;
                }
    
                // Sort by timestamp, oldest first
                const sortedNotifications = [...activeNotifications].sort((a, b) => a.timestamp - b.timestamp);
    
                let html = '';
                
                // Add Clear All button at top
                html += `
                    <div style="margin-bottom: 15px; text-align: right;">
                        <button class="btn-danger" onclick="window.clearAllNotifications()" style="font-size: 14px; padding: 8px 15px;">
                            🗑️ Tümünü Sil
                        </button>
                    </div>
                `;
                
                sortedNotifications.forEach(notification => {
                    const timeAgo = getTimeAgo(notification.timestamp);
                    const formattedTime = getFormattedTime(notification.timestamp);
                    html += `
                        <div class="notification-item ${notification.type}" id="notif-${notification.id}">
                            <div class="notification-content">
                                <div class="notification-message">${notification.message}</div>
                                <div class="notification-time">${formattedTime} • ${timeAgo}</div>
                            </div>
                            <button class="notification-delete" onclick="window.deleteNotification(${notification.id})">✕</button>
                        </div>
                    `;
                });
    
                notificationsContent.innerHTML = html;
            }
    
            // Delete notification with animation
            window.deleteNotification = async function(notificationId) {
                const notifElement = document.getElementById(`notif-${notificationId}`);
                if (!notifElement) return;
                
                // Mark as deleting to prevent multiple clicks
                if (notifElement.classList.contains('deleting')) return;
                notifElement.classList.add('deleting');
                
                // Step 1: Fade out and slide right (fast)
                notifElement.style.opacity = '0';
                notifElement.style.transform = 'translateX(100%)';
                
                // Wait for fade/slide animation
                await new Promise(resolve => setTimeout(resolve, 250));
                
                // Step 2: Collapse height, margin, and padding simultaneously
                notifElement.style.maxHeight = '0';
                notifElement.style.marginBottom = '0';
                notifElement.style.paddingTop = '0';
                notifElement.style.paddingBottom = '0';
                
                // Wait for collapse animation
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Step 3: Remove from DOM
                notifElement.remove();
    
                // Track deleted notifications by participantId (not userId)
                const notifications = { ...(sessionData.notifications || {}) };
                const deletedNotifications = { ...(sessionData.deletedNotifications || {}) };
                
                if (!deletedNotifications[currentParticipantId]) {
                    deletedNotifications[currentParticipantId] = [];
                }
                
                // Add to deleted list
                if (!deletedNotifications[currentParticipantId].includes(notificationId)) {
                    deletedNotifications[currentParticipantId].push(notificationId);
                }
                
                // Remove notification from active list
                if (notifications[userId]) {
                    const userNotificationsData = notifications[userId];
                    
                    // Handle both array and object formats
                    if (Array.isArray(userNotificationsData)) {
                        notifications[userId] = userNotificationsData.filter(n => n.id !== notificationId);
                    } else if (typeof userNotificationsData === 'object') {
                        // Convert to array, filter, convert back to object
                        const notifArray = Object.values(userNotificationsData).filter(n => n.id !== notificationId);
                        notifications[userId] = notifArray.length > 0 ? notifArray : [];
                    }
                }
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        notifications: notifications,
                        deletedNotifications: deletedNotifications
                    });
                } catch (error) {
                    alert('Bildirim silinirken hata: ' + error.message);
                }
            };
    
            // Clear all notifications
            window.clearAllNotifications = async function() {
                const userNotificationsData = (sessionData.notifications || {})[userId];
                
                // Handle both array and object formats
                let userNotifications = [];
                if (Array.isArray(userNotificationsData)) {
                    userNotifications = userNotificationsData;
                } else if (userNotificationsData && typeof userNotificationsData === 'object') {
                    userNotifications = Object.values(userNotificationsData);
                }
                
                if (userNotifications.length === 0) return;
                
                if (!confirm(`${userNotifications.length} bildirimin tümünü silmek istediğinize emin misiniz?`)) {
                    return;
                }
    
                // Animate all notifications out
                const notifElements = document.querySelectorAll('.notification-item');
                notifElements.forEach((element, index) => {
                    setTimeout(() => {
                        element.classList.add('deleting');
                        element.style.opacity = '0';
                        element.style.transform = 'translateX(100%)';
                        
                        setTimeout(() => {
                            element.style.maxHeight = '0';
                            element.style.marginBottom = '0';
                            element.style.paddingTop = '0';
                            element.style.paddingBottom = '0';
                        }, 250);
                    }, index * 50); // Stagger animation by 50ms
                });
    
                // Wait for all animations to complete
                await new Promise(resolve => setTimeout(resolve, 250 + (notifElements.length * 50) + 300));
    
                const notifications = { ...(sessionData.notifications || {}) };
                const deletedNotifications = { ...(sessionData.deletedNotifications || {}) };
                
                if (!deletedNotifications[currentParticipantId]) {
                    deletedNotifications[currentParticipantId] = [];
                }
                
                // Track all notification IDs as deleted (by participantId)
                userNotifications.forEach(notif => {
                    if (!deletedNotifications[currentParticipantId].includes(notif.id)) {
                        deletedNotifications[currentParticipantId].push(notif.id);
                    }
                });
                
                // Clear active notifications
                notifications[userId] = [];
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        notifications: notifications,
                        deletedNotifications: deletedNotifications
                    });
                    showToast('Tüm bildirimler silindi', 'success');
                } catch (error) {
                    showToast('Bildirimler silinirken hata oluştu', 'error');
                }
            };
    
            // Generate welcome notifications for new participants (DISABLED)
            async function generateWelcomeNotifications() {
                // Disabled - no welcome notifications needed
                return;
            }
    
            // Get time ago string
            function getTimeAgo(timestamp) {
                const now = Date.now();
                const diff = now - timestamp;
                const minutes = Math.floor(diff / 60000);
                const hours = Math.floor(minutes / 60);
                const days = Math.floor(hours / 24);
    
                if (minutes < 1) return 'Az önce';
                if (minutes < 60) return `${minutes} dakika önce`;
                if (hours < 24) return `${hours} saat önce`;
                return `${days} gün önce`;
            }
    
            // Get formatted time (HH:MM)
            function getFormattedTime(timestamp) {
                const date = new Date(timestamp);
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            }
    
            // Update notification count badge
            function updateNotificationCount() {
                const allNotifications = sessionData.notifications || {};
                const userNotificationsData = allNotifications[userId];
                
                // Handle both array (old format) and object (new format)
                let userNotifications = [];
                if (Array.isArray(userNotificationsData)) {
                    userNotifications = userNotificationsData;
                } else if (userNotificationsData && typeof userNotificationsData === 'object') {
                    // Convert object to array
                    userNotifications = Object.values(userNotificationsData);
                }
                
                // Get deleted notifications for current participant (not userId)
                const deletedNotifications = (sessionData.deletedNotifications || {})[currentParticipantId] || [];
                
                // Filter out deleted notifications
                const activeNotifications = userNotifications.filter(notif => 
                    !deletedNotifications.includes(notif.id)
                );
                
                const count = activeNotifications.length;
                
                if (count > 0) {
                    notificationCount.textContent = count;
                    notificationCount.classList.remove('hidden');
                } else {
                    notificationCount.classList.add('hidden');
                }
            }
    
            // Update approval count badge
            function updateApprovalCount() {
                const deletionCount = Object.keys(sessionData.pendingDeletions || {}).length;
                const adjustmentCount = Object.keys(sessionData.pendingAdjustments || {}).length;
                const totalCount = deletionCount + adjustmentCount;
                
                if (totalCount > 0) {
                    approvalCount.textContent = totalCount;
                    approvalCount.classList.remove('hidden');
                } else {
                    approvalCount.classList.add('hidden');
                }
            }
    
            // Render approvals
            function renderApprovals() {
                if (!isAdmin) {
                    approvalsContent.innerHTML = '<div class="empty-notifications">Sadece yönetici onayları görebilir</div>';
                    return;
                }
    
                const pendingDeletions = sessionData.pendingDeletions || {};
                const pendingAdjustments = sessionData.pendingAdjustments || {};
                const deletionEntries = Object.entries(pendingDeletions);
                const adjustmentEntries = Object.entries(pendingAdjustments);
                
                if (deletionEntries.length === 0 && adjustmentEntries.length === 0) {
                    approvalsContent.innerHTML = '<div class="empty-notifications">Onay bekleyen işlem yok</div>';
                    return;
                }
    
                let html = '';
                
                // Render deletions
                deletionEntries.forEach(([deleteId, deletion]) => {
                    const timeAgo = getTimeAgo(deletion.requestedAt);
                    html += `
                        <div class="pending-approval">
                            <div style="margin-bottom: 10px;">
                                <div class="pending-approval-text" style="font-size: 16px; margin-bottom: 5px;">
                                    🗑️ ${deletion.participantName} - ${deletion.drinkType} silmek istiyor
                                </div>
                                <div style="color: #6c757d; font-size: 12px;">${timeAgo}</div>
                            </div>
                            <div class="pending-approval-actions">
                                <button class="btn-success" onclick="window.approveDeletion('${deleteId}')">✓ Onayla</button>
                                <button class="btn-danger" onclick="window.rejectDeletion('${deleteId}')">✕ Reddet</button>
                            </div>
                        </div>
                    `;
                });
    
                // Render adjustments
                adjustmentEntries.forEach(([adjustId, adjustment]) => {
                    const timeAgo = getTimeAgo(adjustment.requestedAt);
                    html += `
                        <div class="pending-approval">
                            <div style="margin-bottom: 10px;">
                                <div class="pending-approval-text" style="font-size: 16px; margin-bottom: 5px;">
                                    ➖ ${adjustment.participantName} - ${adjustment.drinkType} azaltmak istiyor (${adjustment.currentQty} → ${adjustment.newQty})
                                </div>
                                <div style="color: #6c757d; font-size: 12px;">${timeAgo}</div>
                            </div>
                            <div class="pending-approval-actions">
                                <button class="btn-success" onclick="window.approveAdjustment('${adjustId}')">✓ Onayla</button>
                                <button class="btn-danger" onclick="window.rejectAdjustment('${adjustId}')">✕ Reddet</button>
                            </div>
                        </div>
                    `;
                });
    
                approvalsContent.innerHTML = html;
            }
    
            // Render Statistics
            function renderStats() {
                const participants = sessionData.participants || {};
                const drinks = sessionData.drinks || {};
                
                // Calculate stats for each participant
                const stats = [];
                let totalDrinks = 0;
                let totalAlcohol = 0;
                const drinkTypeCounts = {};
                
                Object.entries(participants).forEach(([pid, participant]) => {
                    if (!participant.isActive) return;
                    
                    const participantDrinks = drinks[pid] || {};
                    const drinkCount = Object.values(participantDrinks).reduce((sum, qty) => sum + qty, 0);
                    const alcoholGrams = calculateTotalAlcohol(pid);
                    
                    totalDrinks += drinkCount;
                    totalAlcohol += alcoholGrams;
                    
                    // Count drink types
                    Object.entries(participantDrinks).forEach(([type, qty]) => {
                        // Group by drink category (based on icon)
                        const icon = getDrinkIcon(type);
                        let category = type;
                        
                        // Group similar drinks together
                        if (icon === '🍺') category = 'Bira';
                        else if (icon === '🍷') category = 'Şarap';
                        else if (icon === '🍸') category = 'Kokteyl';
                        else if (icon === '🥃') category = 'Viski';
                        else if (icon === '🍹') category = 'Gin & Vodka';
                        else if (icon === '🍾') category = 'Şampanya';
                        else if (icon === '🥂') category = 'Kadeh';
                        else if (icon === '🍶') category = 'Sake';
                        else if (icon === '🥛') category = 'Rakı';
                        else if (icon === '🧉') category = 'Martini';
                        
                        drinkTypeCounts[category] = (drinkTypeCounts[category] || 0) + qty;
                    });
                    
                    stats.push({
                        pid: pid,
                        name: participant.name,
                        drinkCount,
                        alcoholGrams,
                        drunknessInfo: getDrunknessLevel(alcoholGrams, pid)
                    });
                });
                
                // Sort by alcohol content (most drunk first)
                stats.sort((a, b) => b.alcoholGrams - a.alcoholGrams);
                
                // Find most popular drink
                let mostPopularDrink = null;
                let maxCount = 0;
                Object.entries(drinkTypeCounts).forEach(([type, count]) => {
                    if (count > maxCount) {
                        maxCount = count;
                        mostPopularDrink = type;
                    }
                });
                
                if (stats.length === 0) {
                    statsContent.innerHTML = '<div class="empty-notifications">Henüz veri yok</div>';
                    return;
                }
                
                // Calculate session duration
                const sessionStartTime = sessionData.createdAt || Date.now();
                const duration = Math.floor((Date.now() - sessionStartTime) / 1000 / 60); // minutes
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;
                const durationText = hours > 0 ? `${hours}sa ${minutes}dk` : `${minutes}dk`;
                
                let html = `
                    <div class="stats-container">
                        <div class="stats-summary">
                            <div class="stat-box">
                                <div class="stat-value">${totalDrinks}</div>
                                <div class="stat-label">Toplam İçki</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-value">${getDrinkIcon(mostPopularDrink)} ${mostPopularDrink || '-'}</div>
                                <div class="stat-label">En Çok İçilen (${maxCount})</div>
                            </div>
                            <div class="stat-box">
                                <div class="stat-value">${durationText}</div>
                                <div class="stat-label">Oturum Süresi</div>
                            </div>
                        </div>
                        
                        <div class="stats-chart" style="margin: 20px 0; padding: 20px; background: #1a1f2e; border-radius: 12px;">
                            <h3 style="color: #e0e0e0; margin: 0 0 15px 0;">📊 İçki Türü Dağılımı</h3>
                            <div style="max-width: 400px; margin: 0 auto;">
                                <canvas id="drinkTypeChart"></canvas>
                            </div>
                        </div>
                        
                        <div class="stats-ranking">
                            <h3 style="color: #e0e0e0; margin: 20px 0 15px 0;">🏆 Sarhoşluk Sıralaması</h3>
                `;
                
                stats.forEach((stat, index) => {
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
                    const isSelf = sessionData.participants && Object.entries(sessionData.participants).find(([pid, p]) => p.name === stat.name && pid === currentParticipantId);
                    
                    // Find participant ID for color
                    const participantEntry = Object.entries(sessionData.participants || {}).find(([pid, p]) => p.name === stat.name);
                    const participantColor = participantEntry ? getParticipantColor(participantEntry[0]) : PARTICIPANT_COLORS[0];
                    
                    html += `
                        <div class="participant-stat ${isSelf ? 'self' : ''}" style="background: ${participantColor.bg}; border-left: 4px solid ${participantColor.border};">
                            <div class="stat-rank">${medal}</div>
                            <div class="stat-info">
                                <div class="stat-name">${stat.name}${isSelf ? ' (Ben)' : ''}</div>
                                <div class="stat-details">
                                    <span>${stat.drunknessInfo.emoji} ${stat.drunknessInfo.level}</span>
                                    <span style="margin-left: 10px;">•</span>
                                    <span style="margin-left: 10px;">${stat.drinkCount} içki</span>
                                    <span style="margin-left: 10px;">•</span>
                                    <span style="margin-left: 10px;">~${stat.drunknessInfo.promille.toFixed(2)}‰</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                        
                        <div class="stats-disclaimer" style="background: #2a1f1f; border: 2px solid #dc3545; color: #ff6b6b;">
                            <div style="font-size: 18px; margin-bottom: 10px;">🚫 YASAL LİMİT UYARISI</div>
                            <div style="font-size: 14px; line-height: 1.6;">
                                <strong>Türkiye'de yasal alkol limiti: 0.50‰</strong><br>
                                0.50‰ ve üzeri: ARAÇ KULLANMAK YASAK!<br>
                                Ceza: 9,268-18,678 TL + Ehliyet iptali (6 ay - 2 yıl)
                            </div>
                        </div>
                        
                        <div class="stats-disclaimer">
                            ⚠️ Bu değerler tahminidir ve kişiden kişiye değişir. Sorumlu içki tüketimi önemlidir!
                        </div>
                        
                        <!-- Collapsed Drink History -->
                        <div style="margin-top: 20px;">
                            <details style="background: #1a1f2e; border-radius: 12px; padding: 15px; border: 1px solid #2a2a3e;">
                                <summary style="cursor: pointer; color: #4a90e2; font-weight: 600; font-size: 16px; user-select: none;">
                                    📋 Detaylı İçki Geçmişi (Tüm Katılımcılar)
                                </summary>
                                <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;" id="statsHistoryContent">
                                    ${(() => {
                                        // Collect all drink history
                                        const allHistory = [];
                                        Object.entries(sessionData.participants || {}).forEach(([pid, participant]) => {
                                            if (!participant.isActive) return;
                                            const history = sessionData.drinkHistory?.[pid] || [];
                                            history.forEach(entry => {
                                                allHistory.push({
                                                    ...entry,
                                                    participantId: pid,
                                                    participantName: participant.name
                                                });
                                            });
                                        });
                                        
                                        if (allHistory.length === 0) {
                                            return '<div class="empty-notifications">Henüz içki eklenmedi</div>';
                                        }
                                        
                                        // Sort by timestamp (newest first)
                                        allHistory.sort((a, b) => b.timestamp - a.timestamp);
                                        
                                        return allHistory.map(entry => {
                                            const date = new Date(entry.timestamp);
                                            const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                                            const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
                                            const icon = getDrinkIcon(entry.drink);
                                            const participantColor = getParticipantColor(entry.participantId);
                                            
                                            return `
                                                <div style="background: ${participantColor.bg}; padding: 12px; border-radius: 8px; border-left: 3px solid ${participantColor.border};">
                                                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
                                                        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                                                            <span style="font-size: 24px;">${icon}</span>
                                                            <div>
                                                                <div style="color: #e0e0e0; font-weight: 600;">${entry.participantName}</div>
                                                                <div style="color: #b0b0b0; font-size: 13px;">${entry.drink} × ${entry.quantity}</div>
                                                            </div>
                                                        </div>
                                                        <div style="text-align: right;">
                                                            <div style="color: ${participantColor.border}; font-weight: 600; font-size: 14px;">${timeStr}</div>
                                                            <div style="color: #888; font-size: 12px;">${dateStr}</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            `;
                                        }).join('');
                                    })()}
                                </div>
                            </details>
                        </div>
                    </div>
                `;
                
                statsContent.innerHTML = html;
                
                // Render pie chart after DOM is updated
                setTimeout(() => {
                    const ctx = document.getElementById('drinkTypeChart');
                    if (!ctx) return;
                    
                    // Destroy existing chart if any
                    if (window.drinkTypeChartInstance) {
                        window.drinkTypeChartInstance.destroy();
                    }
                    
                    // Prepare data
                    const labels = Object.keys(drinkTypeCounts);
                    const data = Object.values(drinkTypeCounts);
                    const colors = labels.map(type => {
                        // Color based on drink icon
                        const icon = getDrinkIcon(type);
                        if (icon === '🍺') return '#FFB900'; // Bira - Sarı
                        if (icon === '🍷') return '#E74856'; // Şarap - Kırmızı
                        if (icon === '🍸') return '#00BCF2'; // Kokteyl - Mavi
                        if (icon === '🥃') return '#C19A6B'; // Viski - Kahve
                        if (icon === '🍹') return '#FF6B9D'; // Tropikal - Pembe
                        if (icon === '🍾') return '#FFD700'; // Şampanya - Altın
                        if (icon === '🥂') return '#FFE4B5'; // Kadeh - Bej
                        if (icon === '🍶') return '#F0F0F0'; // Sake - Beyaz
                        if (icon === '🥛') return '#E8E8E8'; // Rakı - Gri-beyaz
                        if (icon === '🧉') return '#90EE90'; // Martini - Açık yeşil
                        return '#4A90E2'; // Default - Mavi
                    });
                    
                    // Create chart
                    window.drinkTypeChartInstance = new Chart(ctx, {
                        type: 'pie',
                        data: {
                            labels: labels.map(type => `${getDrinkIcon(type)} ${type}`),
                            datasets: [{
                                data: data,
                                backgroundColor: colors,
                                borderColor: '#1a1f2e',
                                borderWidth: 2
                            }]
                        },
                        options: {
                            responsive: true,
                            maintainAspectRatio: true,
                            plugins: {
                                legend: {
                                    position: 'bottom',
                                    labels: {
                                        color: '#ffffff',
                                        padding: 15,
                                        font: {
                                            size: 13
                                        },
                                        generateLabels: function(chart) {
                                            const data = chart.data;
                                            const total = data.datasets[0].data.reduce((a, b) => a + b, 0);
                                            return data.labels.map((label, i) => {
                                                const value = data.datasets[0].data[i];
                                                const percentage = ((value / total) * 100).toFixed(1);
                                                return {
                                                    text: `${label}: ${value} (${percentage}%)`,
                                                    fillStyle: data.datasets[0].backgroundColor[i],
                                                    strokeStyle: '#ffffff',
                                                    lineWidth: 2,
                                                    hidden: false,
                                                    index: i,
                                                    fontColor: '#ffffff'
                                                };
                                            });
                                        }
                                    }
                                },
                                tooltip: {
                                    backgroundColor: '#0f1419',
                                    titleColor: '#e0e0e0',
                                    bodyColor: '#b0b0b0',
                                    borderColor: '#2a2a3e',
                                    borderWidth: 1,
                                    padding: 12,
                                    displayColors: true,
                                    callbacks: {
                                        label: function(context) {
                                            const label = context.label || '';
                                            const value = context.parsed || 0;
                                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                            const percentage = ((value / total) * 100).toFixed(1);
                                            return `${label}: ${value} adet (${percentage}%)`;
                                        }
                                    }
                                }
                            }
                        }
                    });
                }, 100);
            }
    
            function initializeApp() {
                // Force fresh connection on page load (clear any stale connections)
                goOffline(database);
                setTimeout(() => goOnline(database), 100);
                
                // Check for join parameter in URL (QR code)
                const urlParams = new URLSearchParams(window.location.search);
                const joinSession = urlParams.get('join');
                
                if (joinSession && !currentSession) {
                    // Auto-fill join session code
                    document.getElementById('joinSessionCodeInput').value = joinSession;
                    showToast('QR kod tarandı! Katılmak için devam edin', 'success');
                }
                
                // Request notification permission on app load
                requestNotificationPermission();
                
                if (currentSession) {
                    loadSession(currentSession);
                } else {
                    showSessionManagement();
                }
            }
    
            function showSessionManagement() {
                sessionManagement.classList.remove('hidden');
                sessionInfo.classList.add('hidden');
                tabNavigation.classList.add('hidden');
                mainContent.innerHTML = '';
                notificationsContent.innerHTML = '';
                approvalsContent.innerHTML = '';
            }
    
            function showSessionInfo() {
                sessionManagement.classList.add('hidden');
                // sessionInfo stays hidden - moved to bottom
                tabNavigation.classList.remove('hidden');
                
                // Store session code for bottom display
                window.currentSessionCode = currentSession;
    
                updateNotificationCount();
                if (isAdmin) {
                    updateApprovalCount();
                    approvalsTab.classList.remove('hidden');
                } else {
                    approvalsTab.classList.add('hidden');
                }
            }
    
            // Create Session - Open Modal
            document.getElementById('createSessionBtn').addEventListener('click', () => {
                tempParticipants = [];
                updateParticipantListUI();
                createSessionModal.classList.remove('hidden');
                document.getElementById('participantNameInput').focus();
            });
    
            // Auto-detect gender from name (only if user hasn't manually selected)
            let userHasSelectedGender = false;
            
            document.querySelectorAll('input[name="participantGender"]').forEach(radio => {
                radio.addEventListener('change', () => {
                    userHasSelectedGender = true;
                });
            });
            
            document.getElementById('participantNameInput').addEventListener('input', (e) => {
                const name = e.target.value.trim();
                if (!userHasSelectedGender && name) {
                    const detectedGender = detectGenderFromName(name);
                    if (detectedGender) {
                        const radioButton = document.querySelector(`input[name="participantGender"][value="${detectedGender}"]`);
                        if (radioButton) radioButton.checked = true;
                    }
                }
            });
    
            // Add Participant to temp list
            document.getElementById('addParticipantBtn').addEventListener('click', () => {
                addTempParticipant();
                userHasSelectedGender = false; // Reset for next participant
            });
            document.getElementById('participantNameInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addTempParticipant();
                    userHasSelectedGender = false; // Reset for next participant
                }
            });
            
            document.getElementById('participantWeightInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    addTempParticipant();
                    userHasSelectedGender = false; // Reset for next participant
                }
            });
    
            function addTempParticipant() {
                const nameInput = document.getElementById('participantNameInput');
                const weightInput = document.getElementById('participantWeightInput');
                
                const name = nameInput.value.trim();
                const gender = document.querySelector('input[name="participantGender"]:checked').value;
                const weight = weightInput.value ? parseInt(weightInput.value) : null;
                
                if (!name) {
                    showToast('Lütfen bir isim girin', 'warning');
                    return;
                }
    
                if (tempParticipants.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                    showToast('Bu isim zaten eklendi', 'warning');
                    return;
                }
    
                tempParticipants.push({
                    id: generateParticipantId(),
                    name: name,
                    gender: gender,
                    weight: weight
                });
    
                nameInput.value = '';
                weightInput.value = '';
                // Reset to male radio button
                document.querySelector('input[name="participantGender"][value="male"]').checked = true;
                nameInput.focus();
                updateParticipantListUI();
            }
    
            window.toggleLeaveSession = async function(participantId) {
                const participant = sessionData.participants[participantId];
                if (!participant) return;
                
                const isLeaving = !participant.leftAt;
                const confirmMsg = isLeaving ? 
                    `"${participant.name}" masadan kalkıyor.\n\nSonraki ortak hesaplamalara dahil edilmeyecek. Onaylıyor musunuz?` :
                    `"${participant.name}" tekrar masaya dönüyor. Onaylıyor musunuz?`;
                    
                if (!confirm(confirmMsg)) return;
                
                try {
                    await update(ref(database, `sessions/${currentSession}/participants/${participantId}`), {
                        ...participant,
                        leftAt: isLeaving ? Date.now() : null
                    });
                    showToast(isLeaving ? `${participant.name} masadan ayrıldı.` : `${participant.name} masaya döndü.`, 
                              isLeaving ? 'warning' : 'success');
                } catch (error) {
                    console.error("Error toggling leave state:", error);
                    showToast("Durum güncellenemedi.", "error");
                }
            };
    
            function updateParticipantListUI() {
                const list = document.getElementById('participantList');
                const confirmBtn = document.getElementById('confirmCreateSession');
                const adminSelectGroup = document.getElementById('adminSelfSelectGroup');
                const adminSelect = document.getElementById('adminSelfSelect');
                
                if (tempParticipants.length === 0) {
                    list.innerHTML = '<div class="empty-state" style="padding: 20px;">Henüz katılımcı eklenmedi</div>';
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Oturumu Başlat (0 kişi)';
                    adminSelectGroup.style.display = 'none';
                } else {
                    list.innerHTML = tempParticipants.map(p => {
                        const genderIcon = p.gender === 'male' ? '♂️' : '♀️';
                        const weightText = p.weight ? ` (${p.weight}kg)` : '';
                        return `
                            <div class="participant-list-item">
                                <span>${genderIcon} ${p.name}${weightText}</span>
                                <button onclick="window.removeTempParticipant('${p.id}')">✕ Sil</button>
                            </div>
                        `;
                    }).join('');
                    
                    // Update admin self-select dropdown
                    adminSelect.innerHTML = '<option value="">Seçiniz...</option>' + 
                        tempParticipants.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
                    adminSelectGroup.style.display = 'block';
                    
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = `Oturumu Başlat (${tempParticipants.length} kişi)`;
                }
            }
    
            window.removeTempParticipant = function(id) {
                tempParticipants = tempParticipants.filter(p => p.id !== id);
                updateParticipantListUI();
            };
    
            // Cancel Create Session
            document.getElementById('cancelCreateSession').addEventListener('click', () => {
                createSessionModal.classList.add('hidden');
                tempParticipants = [];
            });
    
            // Confirm Create Session
            document.getElementById('confirmCreateSession').addEventListener('click', async () => {
                if (tempParticipants.length === 0) return;
                
                // Check if admin selected themselves
                const adminSelfId = document.getElementById('adminSelfSelect').value;
                if (!adminSelfId) {
                    showToast('Lütfen kendinizi seçin', 'warning');
                    return;
                }
    
                let sessionCode;
                let attempts = 0;
                
                while (attempts < 10) {
                    sessionCode = generateSessionCode();
                    const sessionRef = ref(database, `sessions/${sessionCode}`);
                    const snapshot = await get(sessionRef);
                    
                    if (!snapshot.exists()) break;
                    attempts++;
                }
    
                if (attempts >= 10) {
                    alert('Benzersiz oturum kodu oluşturulamadı. Lütfen tekrar deneyin.');
                    return;
                }
    
                const adminCodeValue = generateAdminCode();
                const participants = {};
                
                tempParticipants.forEach(p => {
                    participants[p.id] = {
                        name: p.name,
                        gender: p.gender,
                        weight: p.weight,
                        userId: p.id === adminSelfId ? userId : null, // Assign admin's userId
                        addedAt: Date.now(),
                        addedBy: 'admin',
                        isActive: true
                    };
                });
    
                const newSessionData = {
                    adminCode: adminCodeValue,
                    adminUserId: userId,
                    adminParticipantId: adminSelfId, // Store which participant is admin
                    createdAt: Date.now(),
                    participants: participants,
                    drinks: {},
                    drinkTypes: [],
                    drinkHistory: {},
                    undoStack: [],
                    notifications: {},
                    pendingDeletions: {},
                    pendingAdjustments: {}
                };
    
                try {
                    await set(ref(database, `sessions/${sessionCode}`), newSessionData);
                    
                    currentSession = sessionCode;
                    isAdmin = true;
                    adminCode = adminCodeValue;
                    currentParticipantId = adminSelfId; // Set admin's participant ID
                    localStorage.setItem('currentSession', sessionCode);
                    localStorage.setItem('isAdmin', 'true');
                    localStorage.setItem('adminCode', adminCodeValue);
                    localStorage.setItem('currentParticipantId', adminSelfId);
    
                    createSessionModal.classList.add('hidden');
                    
                    document.getElementById('newSessionCode').textContent = sessionCode;
                    document.getElementById('newAdminCode').textContent = adminCodeValue;
                    sessionCreatedModal.classList.remove('hidden');
                } catch (error) {
                    alert('Oturum oluşturulurken hata: ' + error.message);
                }
            });
    
            // Close Session Created Modal
            document.getElementById('closeSessionCreatedModal').addEventListener('click', () => {
                sessionCreatedModal.classList.add('hidden');
                loadSession(currentSession);
            });
    
            // Copy new session info
            document.getElementById('copyNewSessionInfo').addEventListener('click', () => {
                const sessionCode = document.getElementById('newSessionCode').textContent;
                const adminCodeValue = document.getElementById('newAdminCode').textContent;
                const text = `Oturum Kodu: ${sessionCode}\nYönetici Kodu: ${adminCodeValue}`;
                
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Bilgiler kopyalandı!', 'success');
                }).catch(() => {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast('Bilgiler kopyalandı!', 'success');
                });
            });
    
            // Join Session - Step 1: Code Entry
            document.getElementById('joinSessionBtn').addEventListener('click', () => {
                joinSessionModal.classList.remove('hidden');
                document.getElementById('joinSessionCodeInput').value = '';
                document.getElementById('joinSessionCodeInput').focus();
            });
    
            document.getElementById('cancelJoinSession').addEventListener('click', () => {
                joinSessionModal.classList.add('hidden');
            });
    
            document.getElementById('joinSessionCodeInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('confirmJoinSessionCode').click();
            });
    
            document.getElementById('confirmJoinSessionCode').addEventListener('click', async () => {
                const code = document.getElementById('joinSessionCodeInput').value.trim().toUpperCase();
                
                if (!code) {
                    showToast('Lütfen bir oturum kodu girin', 'warning');
                    return;
                }
    
                try {
                    const sessionRef = ref(database, `sessions/${code}`);
                    const snapshot = await get(sessionRef);
                    
                    if (!snapshot.exists()) {
                        showToast('Oturum bulunamadı. Lütfen kodu kontrol edin.', 'error');
                        return;
                    }
    
                    const data = snapshot.val();
                    const participantSelect = document.getElementById('participantSelect');
                    participantSelect.innerHTML = '<option value="">Seçin...</option>';
                    
                    // Show all unclaimed participants (including those who left or were removed)
                    const sortedParticipants = Object.entries(data.participants)
                        .filter(([id, participant]) => !participant.userId) // Only check if unclaimed
                        .sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));
                    
                    if (sortedParticipants.length === 0) {
                        alert('Bu oturumda katılabileceğiniz kimse kalmadı. Tüm katılımcılar zaten oturuma katıldı.');
                        joinSessionModal.classList.remove('hidden');
                        return;
                    }
                    
                    sortedParticipants.forEach(([id, participant]) => {
                        const genderIcon = participant.gender === 'male' ? '♂️' : participant.gender === 'female' ? '♀️' : '';
                        const statusLabel = !participant.isActive ? ' (Ayrıldı)' : '';
                        participantSelect.innerHTML += `<option value="${id}">${genderIcon} ${participant.name}${statusLabel}</option>`;
                    });
    
                    document.getElementById('joiningSessionCode').textContent = code;
                    joinSessionModal.classList.add('hidden');
                    selectParticipantModal.classList.remove('hidden');
                    
                    currentSession = code;
                } catch (error) {
                    alert('Oturuma katılırken hata: ' + error.message);
                }
            });
    
            // Join Session - Step 2: Participant Selection
            document.getElementById('cancelSelectParticipant').addEventListener('click', () => {
                selectParticipantModal.classList.add('hidden');
                currentSession = null;
            });
    
            document.getElementById('confirmSelectParticipant').addEventListener('click', async () => {
                const participantId = document.getElementById('participantSelect').value;
                
                if (!participantId) {
                    showToast('Lütfen bir katılımcı seçin', 'warning');
                    return;
                }
    
                try {
                    // Update participant with userId and set active
                    await update(ref(database, `sessions/${currentSession}/participants/${participantId}`), {
                        userId: userId,
                        isActive: true  // Reactivate if they were inactive
                    });
    
                    currentParticipantId = participantId;
                    isAdmin = false;
                    localStorage.setItem('currentSession', currentSession);
                    localStorage.setItem('currentParticipantId', participantId);
                    localStorage.setItem('isAdmin', 'false');
                    localStorage.removeItem('adminCode');
    
                    selectParticipantModal.classList.add('hidden');
                    
                    // Generate welcome notifications for existing drinks
                    await generateWelcomeNotifications();
                    
                    loadSession(currentSession);
                    
                    showToast(`Oturuma katıldınız!`, 'success');
                } catch (error) {
                    alert('Katılım sırasında hata: ' + error.message);
                }
            });
    
            // Load Session
            function loadSession(sessionCode) {
                const sessionRef = ref(database, `sessions/${sessionCode}`);
                
                // Show loading
                isLoadingSession = true;
                document.getElementById('mainContent').innerHTML = `
                    <div style="text-align: center; padding: 60px 20px; color: #b0b0b0;">
                        <div style="font-size: 48px; margin-bottom: 20px;">⏳</div>
                        <div style="font-size: 18px;">Oturum yükleniyor...</div>
                    </div>
                `;
                
                // Remove old listener if exists
                if (sessionListener) {
                    sessionListener();
                }
                
                // Listen for updates
                sessionListener = onValue(sessionRef, (snapshot) => {
                    if (!snapshot.exists()) {
                        showToast('Oturum sonlandırıldı', 'error');
                        setTimeout(() => leaveSession(), 2000);
                        return;
                    }
                    
                    isLoadingSession = false;
                    processSessionData(snapshot.val());
                }, (error) => {
                    console.error('Session load error:', error);
                    isLoadingSession = false;
                    showToast('Bağlantı hatası', 'error');
                });
            }
            
            function processSessionData(data) {
                // Ensure all required fields exist with defaults
                sessionData = {
                    participants: data.participants || {},
                    drinks: data.drinks || {},
                    drinkTypes: data.drinkTypes || [],
                    drinkHistory: data.drinkHistory || {},
                    undoStack: data.undoStack || [],
                    notifications: data.notifications || {},
                    pendingDeletions: data.pendingDeletions || {},
                    pendingAdjustments: data.pendingAdjustments || {},
                    drinkIcons: data.drinkIcons || {},
                    adminCode: data.adminCode,
                    adminUserId: data.adminUserId,
                    createdAt: data.createdAt
                };
                
                showSessionInfo();
                renderMainContent();
                updateNotificationCount();
                if (isAdmin) {
                    updateApprovalCount();
                }
                
                // Auto-update active tab content
                if (activeTab === 'notifications') {
                    renderNotifications();
                } else if (activeTab === 'approvals') {
                    renderApprovals();
                } else if (activeTab === 'stats') {
                    renderStats();
                }
            }
    
            // Render Main Content
            function renderMainContent() {
                let html = '';
    
                // Render participants
                const now = Date.now();
                const participants = sessionData.participants || {};
                
                if (Object.keys(participants).length === 0) {
                    html += '<div class="empty-state">Henüz katılımcı yok. + Katılımcı Ekle butonuna tıklayın!</div>';
                    mainContent.innerHTML = html;
                    return;
                }
                
                // Sort participants
                let participantEntries = Object.entries(participants).filter(([pid, p]) => p.isActive);
                
                if (isAdmin) {
                    // Admin: Alphabetically by name
                    participantEntries.sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));
                } else {
                    // Participant: Self first, then alphabetically
                    participantEntries.sort((a, b) => {
                        const aIsSelf = a[0] === currentParticipantId;
                        const bIsSelf = b[0] === currentParticipantId;
                        
                        if (aIsSelf) return -1;  // Self always first
                        if (bIsSelf) return 1;
                        
                        // Rest alphabetically
                        return a[1].name.localeCompare(b[1].name, 'tr');
                    });
                }
                
                participantEntries.forEach(([pid, participant]) => {
    
                    const isSelf = pid === currentParticipantId;
                    const needsAttention = checkIfNeedsAttention(pid, now);
                    const stats = getParticipantStats(pid, now);
                    const drinks = (sessionData.drinks && sessionData.drinks[pid]) ? sessionData.drinks[pid] : {};
                    const canEdit = isAdmin || isSelf;
                    
                    // Safely get drink entries
                    const drinkEntries = drinks && typeof drinks === 'object' ? Object.entries(drinks) : [];
                    const participantColor = getParticipantColor(pid);
                    
                    // Calculate promil for header display
                    const alcoholGrams = calculateTotalAlcohol(pid);
                    const drunknessInfo = getDrunknessLevel(alcoholGrams, pid);
                    const promil = drunknessInfo.promille;
                    
                    // Create compact status badge for header using drunknessInfo
                    let statusBadge = '';
                    if (promil === 0) {
                        statusBadge = `<span style="background: rgba(40, 167, 69, 0.2); color: #28a745; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunknessInfo.emoji} 0.00‰</span>`;
                    } else if (promil < 0.50) {
                        statusBadge = `<span style="background: rgba(74, 144, 226, 0.2); color: #4a90e2; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunknessInfo.emoji} ${promil.toFixed(2)}‰</span>`;
                    } else if (promil < 1.00) {
                        statusBadge = `<span style="background: rgba(255, 193, 7, 0.2); color: #ffc107; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunknessInfo.emoji} ${promil.toFixed(2)}‰</span>`;
                    } else if (promil < 2.00) {
                        statusBadge = `<span style="background: rgba(255, 87, 34, 0.2); color: #ff5722; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunknessInfo.emoji} ${promil.toFixed(2)}‰</span>`;
                    } else {
                        statusBadge = `<span style="background: rgba(220, 53, 69, 0.2); color: #dc3545; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunknessInfo.emoji} ${promil.toFixed(2)}‰</span>`;
                    }
    
                    html += `
                        <div class="participant-card ${needsAttention ? 'needs-attention' : ''}" style="background: ${participantColor.bg}; border-left: 3px solid ${participantColor.border}; opacity: ${participant.leftAt ? '0.6' : '1'};">
                            <div class="participant-header">
                                <div>
                                    <div class="participant-name ${isSelf ? 'self' : ''}">${participant.name}${isSelf ? ' (Ben)' : ''}${participant.leftAt ? ' <span class="attention-badge" style="background:#6c757d; font-size:10px; margin-left:4px;">Ayrıldı</span>' : ''}${statusBadge}</div>
                                    <div class="participant-info">
                                        ${participant.gender === 'female' ? '♀️ Kadın' : '♂️ Erkek'} • ${participant.weight ? participant.weight + 'kg' : '~' + (participant.gender === 'female' ? '65kg' : '75kg')} • ${stats.lastDrinkTime} • ${stats.avgTimeInfo}
                                    </div>
                                </div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    ${needsAttention ? '<span class="attention-badge">⚠️ Kontrol Et</span>' : ''}
                                    ${isAdmin ? `<button class="btn-icon btn-delete" onclick="window.removeParticipant('${pid}')" title="Katılımcıyı Çıkar">✕</button>` : ''}
                                </div>
                            </div>
                            
                            ${drinkEntries.length > 0 ? drinkEntries.map(([drinkType, quantity]) => {
                                const drinkIcon = getDrinkIcon(drinkType);
                                const icons = drinkIcon.repeat(Math.min(quantity, 12)); // Max 12 icons (2 rows of 6)
                                return `
                                <div class="drink-item">
                                    <div class="drink-info">
                                        <span class="drink-name">${drinkType}: ${quantity}</span>
                                        <span class="drink-icons">${icons}</span>
                                    </div>
                                    ${canEdit ? `
                                        <div class="drink-actions">
                                            <button class="btn-icon btn-decrease" onclick="window.adjustDrink('${pid}', '${drinkType}', -1)">−</button>
                                            <button class="btn-icon btn-increase" onclick="window.adjustDrink('${pid}', '${drinkType}', 1)">+</button>
                                            <button class="btn-icon btn-delete" onclick="window.deleteDrink('${pid}', '${drinkType}')">🗑️</button>
                                        </div>
                                    ` : ''}
                                </div>
                            `}).join('') : '<div class="empty-state" style="padding: 10px 0; font-size: 14px;">Henüz içki eklenmedi</div>'}
                            
                            ${(() => {
                                // Show legal warning if needed
                                const alcoholGrams = calculateTotalAlcohol(pid);
                                const drunknessInfo = getDrunknessLevel(alcoholGrams, pid);
                                const promil = drunknessInfo.promille;
                                
                                let legalWarning = '';
                                
                                if (promil >= 0.50 && promil < 1.00) {
                                    legalWarning = '<div style="color: #ff9800; font-size: 12px; margin-top: 10px; padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 6px; text-align: center; font-weight: 600;">🚫 ARAÇ KULLANMA! Yasal limit: 0.50‰</div>';
                                } else if (promil >= 1.00) {
                                    legalWarning = '<div style="color: #dc3545; font-size: 12px; margin-top: 10px; padding: 8px; background: rgba(220, 53, 69, 0.1); border-radius: 6px; text-align: center; font-weight: 600;">🚫 ÇOK TEHLİKELİ! ARAÇ KULLANMA!</div>';
                                }
                                
                                return legalWarning;
                            })()}
                            
                            ${canEdit ? `
                            <div style="display: flex; gap: 8px; margin-top: 10px; align-items: stretch;">
                                ${!participant.leftAt ? `
                                <button class="btn-primary btn-success add-drink-btn" onclick="window.openAddDrinkModal('${pid}')" style="flex: 1; padding: 0 !important; font-size: 14px; line-height: 1.2; height: 42px !important; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0;">+ İçki Ekle</button>
                                ` : `<div style="flex: 1; display:flex; align-items:center; justify-content:center; font-size: 12px; color: #888; background: #2a2a3e; border-radius: 6px;">Hesap Kapandı</div>`}
                                <button class="btn-primary btn-secondary" onclick="window.showParticipantHistory('${pid}')" style="flex: 1; padding: 0 !important; font-size: 14px; line-height: 1.2; height: 42px !important; box-sizing: border-box; display: flex; align-items: center; justify-content: center; margin: 0;">Geçmiş</button>
                            </div>
                            <div style="margin-top: 8px;">
                                ${participant.leftAt ? 
                                    `<button class="btn-primary" onclick="window.toggleLeaveSession('${pid}')" style="width: 100%; background: #28a745; color: white; padding: 8px; font-size: 12px; border-radius: 6px;">↪ Masaya Dön</button>` :
                                    `<button class="btn-primary" onclick="window.toggleLeaveSession('${pid}')" style="width: 100%; background: #dc3545; color: white; padding: 8px; font-size: 12px; border-radius: 6px;">🚪 Masadan Ayrıl</button>`
                                }
                            </div>
                            ` : `
                            <button class="btn-primary btn-secondary" onclick="window.showParticipantHistory('${pid}')" style="width: 100%; margin-top: 10px; font-size: 14px; padding: 10px 8px; line-height: 1.2; height: 42px; box-sizing: border-box;">
                                İçki Geçmişi
                            </button>
                            `}
                        </div>
                    `;
                });
    
                // Admin controls at bottom
                if (isAdmin) {
                    html += `
                        <div style="margin-top: 20px; padding: 15px; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px; text-align: center;">
                            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">Oturum Kodu</div>
                            <div style="color: #dc3545; font-weight: 600; font-size: 18px; margin-bottom: 8px;">${currentSession}</div>
                            <div style="color: #dc3545; font-weight: 600; font-size: 16px;">👑 Yönetici</div>
                            <div style="color: #e0e0e0; font-size: 14px; margin-top: 5px;">
                                Toplam ${Object.values(sessionData.participants || {}).filter(p => p.isActive).length} kişi
                            </div>
                        </div>
                        <div class="admin-controls" style="margin-top: 10px;">
                            <button class="btn-primary btn-success" onclick="window.openAddParticipantModal()" style="margin-bottom: 8px;">+ Katılımcı Ekle</button>
                            <button class="btn-primary" onclick="window.openAddFoodModal()" style="margin-bottom: 8px; background: #e2a84a; color: #1a1a2e; font-weight: bold; width: 100%; border-radius: 6px; padding: 10px; border: none;">🍕 Ortak Yiyecek Ekle</button>
                            <button class="btn-primary btn-secondary" onclick="window.showAdminCode()" style="display: flex; align-items: center; gap: 5px; justify-content: center;">🔑 Yönetici Kodu</button>
                        </div>
                        <div style="margin-top: 10px;">
                            <button class="btn-primary" onclick="window.showQRCode()" style="width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                📱 QR Kod Paylaş
                            </button>
                        </div>
                        <div style="margin-top: 10px; display: flex; gap: 10px;">
                            <button class="btn-primary btn-danger" onclick="window.requestAdminAction('clearAll')" style="flex: 1; background: #6c757d; border: none;">Tümünü Sil</button>
                            <button class="btn-primary btn-danger" onclick="window.showSessionSummary()" style="flex: 2; font-weight: bold; background: #dc3545;">Oturumu Bitir & Özeti Gör</button>
                        </div>
                    `;
                } else {
                    // Participant info and controls
                    const participantName = sessionData.participants?.[currentParticipantId]?.name || 'Katılımcı';
                    const activeCount = Object.values(sessionData.participants || {}).filter(p => p.isActive).length;
                    
                    html += `
                        <div style="margin-top: 20px; padding: 15px; background: rgba(74, 144, 226, 0.1); border: 1px solid #4a90e2; border-radius: 8px; text-align: center;">
                            <div style="color: #888; font-size: 12px; margin-bottom: 8px;">Oturum Kodu</div>
                            <div style="color: #4a90e2; font-weight: 600; font-size: 18px; margin-bottom: 8px;">${currentSession}</div>
                            <div style="color: #4a90e2; font-weight: 600; font-size: 16px;">${participantName}</div>
                            <div style="color: #e0e0e0; font-size: 14px; margin-top: 5px;">
                                Toplam ${activeCount} kişi
                            </div>
                        </div>
                        </div>
                        <div style="margin-top: 10px;">
                            <button class="btn-primary" onclick="window.openAddFoodModal()" style="width: 100%; padding: 10px; margin-bottom: 10px; background: #e2a84a; color: #1a1a2e; font-weight: bold; border-radius: 6px; border: none;">
                                🍕 Ortak Yiyecek Ekle
                            </button>
                            <button class="btn-primary" onclick="window.showQRCode()" style="width: 100%; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                                📱 QR Kod Paylaş
                            </button>
                        </div>
                    `;
                }
    
                // Participant leave button
                if (!isAdmin) {
                    html += `
                        <div style="margin-top: 20px;">
                            <button class="btn-primary btn-secondary" onclick="window.leaveSession()">Oturumdan Ayrıl</button>
                        </div>
                    `;
                }
    
                mainContent.innerHTML = html;
            }
    
            // Check if participant needs attention
            function checkIfNeedsAttention(participantId, now) {
                if (!sessionData.drinkHistory || !sessionData.drinkHistory[participantId]) {
                    return false;
                }
                
                const history = sessionData.drinkHistory[participantId] || [];
                if (history.length < 2) return false;
    
                const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
                const lastDrink = sortedHistory[0];
                const timeSinceLast = (now - lastDrink.timestamp) / 1000 / 60;
    
                const intervals = [];
                for (let i = 0; i < sortedHistory.length - 1; i++) {
                    intervals.push((sortedHistory[i].timestamp - sortedHistory[i + 1].timestamp) / 1000 / 60);
                }
                const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    
                return timeSinceLast > (avgInterval * 1.5);
            }
    
            // Get participant stats
            function getParticipantStats(participantId, now) {
                if (!sessionData.drinkHistory || !sessionData.drinkHistory[participantId]) {
                    return {
                        lastDrinkTime: 'Son içki: -',
                        avgTimeInfo: 'Ort. aralık: -'
                    };
                }
                
                const history = sessionData.drinkHistory[participantId] || [];
                
                if (history.length === 0) {
                    return {
                        lastDrinkTime: 'Son içki: -',
                        avgTimeInfo: 'Ort. aralık: -'
                    };
                }
    
                const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
                const lastDrink = sortedHistory[0];
                const timeSinceLast = Math.floor((now - lastDrink.timestamp) / 1000 / 60);
    
                let lastDrinkText = `Son içki: ${timeSinceLast}d önce`;
    
                if (history.length < 2) {
                    return {
                        lastDrinkTime: lastDrinkText,
                        avgTimeInfo: 'Ort. aralık: -'
                    };
                }
    
                const intervals = [];
                for (let i = 0; i < sortedHistory.length - 1; i++) {
                    intervals.push((sortedHistory[i].timestamp - sortedHistory[i + 1].timestamp) / 1000 / 60);
                }
                const avgInterval = Math.floor(intervals.reduce((a, b) => a + b, 0) / intervals.length);
    
                return {
                    lastDrinkTime: lastDrinkText,
                    avgTimeInfo: `Ort. aralık: ${avgInterval}d`
                };
            }
    
            // Open Add Participant Modal (during session)
            window.openAddParticipantModal = function() {
                if (!isAdmin) return;
                addParticipantSessionModal.classList.remove('hidden');
                document.getElementById('newParticipantNameInput').value = '';
                document.getElementById('newParticipantNameInput').focus();
            };
    
            window.showSessionSummary = function() {
                let totalDrinks = 0;
                let totalFood = 0;
                let maxAlcohol = 0;
                let champion = "Yok";
                
                const pStats = [];
                
                Object.entries(sessionData.participants || {}).forEach(([pid, p]) => {
                    if (!p.isActive) return;
                    
                    const drinks = sessionData.drinks?.[pid] || {};
                    let pDrinkCount = 0;
                    let details = [];
                    
                    Object.entries(drinks).forEach(([dtype, qty]) => {
                        if (dtype.includes("🍕")) {
                            totalFood += qty;
                            details.push(`🍔 ${dtype.replace('🍕 ', '')}: <b>${Number.isInteger(qty) ? qty : qty.toFixed(2)}</b> porsiyon`);
                        } else {
                            totalDrinks += qty;
                            pDrinkCount += qty;
                            const icon = sessionData.drinkIcons?.[dtype] || '🍺';
                            details.push(`${icon} ${dtype}: <b>${qty}</b>`);
                        }
                    });
                    
                    const alcGrams = window.calculateTotalAlcohol ? window.calculateTotalAlcohol(pid) : 0;
                    if (alcGrams > maxAlcohol) {
                        maxAlcohol = alcGrams;
                        champion = p.name;
                    }
                    
                    if (details.length > 0) {
                        const statusTag = p.leftAt ? '<span style="font-size:10px; background:#dc3545; color:white; padding:2px 4px; border-radius:4px; margin-left:5px;">Ayrıldı</span>' : '';
                        pStats.push(`
                            <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 6px;">
                                <div style="font-weight: bold; color: #4a90e2; margin-bottom: 8px; font-size: 15px;">${p.name} ${statusTag}</div>
                                <div style="font-size: 13px; color: #ddd; line-height: 1.6;">
                                    ${details.join(' <span style="color:#666;">•</span> ')}
                                </div>
                            </div>
                        `);
                    }
                });
                
                document.getElementById('summaryStats').innerHTML = `
                    <div style="text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #fff;">${Math.round(totalDrinks)}</div>
                        <div style="font-size: 12px; color: #888; text-transform: uppercase;">Toplam İçki</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #e2a84a;">👑 ${champion}</div>
                        <div style="font-size: 12px; color: #888; text-transform: uppercase;">Gecenin Şampiyonu</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 28px; font-weight: bold; color: #fff;">${Math.round(totalFood)}</div>
                        <div style="font-size: 12px; color: #888; text-transform: uppercase;">Toplam Yemek</div>
                    </div>
                `;
                
                document.getElementById('summaryParticipants').innerHTML = pStats.length ? pStats.join('') : '<div style="color:#888; font-size:14px; text-align:center;">Kayıt bulunamadı.</div>';
                
                document.getElementById('sessionSummaryModal').classList.remove('hidden');
            };
    
            window.exportSummaryJPG = function() {
                const el = document.getElementById('summaryContentToExport');
                const btn = document.querySelector('button[onclick="window.exportSummaryJPG()"]');
                const btnOriginalText = btn.innerHTML;
                btn.innerHTML = '⏳ Hazırlanıyor...';
                
                if (typeof html2canvas !== 'function') {
                    showToast("html2canvas yüklenemedi", "error");
                    btn.innerHTML = btnOriginalText;
                    return;
                }
                
                html2canvas(el, {
                    backgroundColor: '#1a1a2e',
                    scale: 2
                }).then(canvas => {
                    const imgData = canvas.toDataURL('image/jpeg', 0.9);
                    
                    if (navigator.share) {
                        canvas.toBlob(blob => {
                            const file = new File([blob], "tkb_ozet.jpg", { type: "image/jpeg" });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                navigator.share({
                                    title: 'TKB Gecenin Özeti',
                                    files: [file]
                                }).catch(e => console.log('Share failed', e));
                            } else {
                                downloadImage(imgData);
                            }
                        }, 'image/jpeg', 0.9);
                    } else {
                        downloadImage(imgData);
                    }
                    btn.innerHTML = btnOriginalText;
                }).catch(err => {
                    console.error("Canvas error", err);
                    showToast("JPG oluşturulamadı.", "error");
                    btn.innerHTML = btnOriginalText;
                });
            };
            
            function downloadImage(dataUrl) {
                const link = document.createElement('a');
                link.download = `tkb_ozet_${new Date().toISOString().slice(0,10)}.jpg`;
                link.href = dataUrl;
                link.click();
            }
    
            // Open Add Food Modal
            window.openAddFoodModal = function() {
                const container = document.getElementById('foodParticipantsCheckboxes');
                container.innerHTML = '';
                
                const activeParticipants = Object.entries(sessionData.participants || {})
                    .filter(([pid, p]) => p.isActive && !p.leftAt);
                    
                if (activeParticipants.length === 0) {
                    showToast('Aktif katılımcı bulunamadı', 'warning');
                    return;
                }
                
                activeParticipants.forEach(([pid, p]) => {
                    container.innerHTML += `
                        <label style="display:flex; align-items:center; gap:8px; font-size:14px; cursor:pointer;">
                            <input type="checkbox" class="food-participant-cb" value="${pid}" checked style="width:18px;height:18px; cursor:pointer;" />
                            ${p.name}
                        </label>
                    `;
                });
                
                document.getElementById('foodNameInput').value = '';
                document.getElementById('foodQuantityInput').value = '1';
                document.getElementById('addFoodModal').classList.remove('hidden');
                setTimeout(() => document.getElementById('foodNameInput').focus(), 100);
            };
    
            document.getElementById('cancelAddFood').addEventListener('click', () => {
                document.getElementById('addFoodModal').classList.add('hidden');
            });
    
            document.getElementById('confirmAddFood').addEventListener('click', async () => {
                const foodName = document.getElementById('foodNameInput').value.trim();
                const quantity = parseFloat(document.getElementById('foodQuantityInput').value);
                const checkboxes = document.querySelectorAll('.food-participant-cb:checked');
                
                if (!foodName || isNaN(quantity) || quantity <= 0) {
                    showToast('Geçerli isim ve miktar girin', 'warning');
                    return;
                }
                if (checkboxes.length === 0) {
                    showToast('En az 1 kişi seçilmelidir', 'warning');
                    return;
                }
                
                const selectedPids = Array.from(checkboxes).map(cb => cb.value);
                const shareAmount = parseFloat((quantity / selectedPids.length).toFixed(2));
                const existingDrinkType = "🍕 " + foodName; // Prefix with emoji to stand out
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedDrinkTypes = [...(sessionData.drinkTypes || [])];
                const updatedDrinkIcons = { ...(sessionData.drinkIcons || {}) };
                const updatedHistory = { ...sessionData.drinkHistory };
                const timestamp = Date.now();
                
                if (!updatedDrinkTypes.some(d => d.toLowerCase() === existingDrinkType.toLowerCase())) {
                    updatedDrinkTypes.push(existingDrinkType);
                }
                if (!updatedDrinkIcons[existingDrinkType]) {
                    updatedDrinkIcons[existingDrinkType] = '🍕';
                }
                
                selectedPids.forEach(pid => {
                    if (!updatedDrinks[pid]) updatedDrinks[pid] = {};
                    updatedDrinks[pid][existingDrinkType] = (updatedDrinks[pid][existingDrinkType] || 0) + shareAmount;
                    
                    if (!updatedHistory[pid]) updatedHistory[pid] = [];
                    updatedHistory[pid].push({
                        drink: existingDrinkType,
                        quantity: shareAmount,
                        timestamp: timestamp,
                        addedBy: currentParticipantId || 'admin'
                    });
                });
                
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkTypes: updatedDrinkTypes,
                        drinkIcons: updatedDrinkIcons,
                        drinkHistory: updatedHistory
                    });
                    
                    await addNotification(`${foodName} (${quantity} adet) ${selectedPids.length} kişiye bölüştürüldü`, 'info');
                    document.getElementById('addFoodModal').classList.add('hidden');
                } catch (error) {
                    console.error('Error adding food', error);
                    showToast('Yiyecek eklenirken hata oluştu', 'error');
                }
            });
    
            document.getElementById('cancelAddParticipantSession').addEventListener('click', () => {
                addParticipantSessionModal.classList.add('hidden');
            });
    
            // Auto-detect gender for session participant addition
            document.getElementById('newParticipantNameInput').addEventListener('input', (e) => {
                const name = e.target.value.trim();
                const detectedGender = detectGenderFromName(name);
                if (detectedGender) {
                    // Set radio button
                    const radioButton = document.querySelector(`input[name="newParticipantGender"][value="${detectedGender}"]`);
                    if (radioButton) radioButton.checked = true;
                }
            });
    
            document.getElementById('newParticipantNameInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('confirmAddParticipantSession').click();
            });
    
            document.getElementById('confirmAddParticipantSession').addEventListener('click', async () => {
                const name = document.getElementById('newParticipantNameInput').value.trim();
                const gender = document.querySelector('input[name="newParticipantGender"]:checked').value;
                const weight = document.getElementById('newParticipantWeightInput').value ? 
                    parseInt(document.getElementById('newParticipantWeightInput').value) : null;
                
                if (!name) {
                    showToast('Lütfen bir isim girin', 'warning');
                    return;
                }
    
                const existingNames = Object.values(sessionData.participants)
                    .filter(p => p.isActive)
                    .map(p => p.name.toLowerCase());
                
                if (existingNames.includes(name.toLowerCase())) {
                    alert('Bu isim zaten mevcut');
                    return;
                }
    
                const newId = generateParticipantId();
                const newParticipant = {
                    name: name,
                    gender: gender,
                    weight: weight,
                    userId: null,
                    addedAt: Date.now(),
                    addedBy: 'admin',
                    isActive: true
                };
    
                try {
                    await update(ref(database, `sessions/${currentSession}/participants/${newId}`), newParticipant);
                    
                    // Send notification to all participants (except admin)
                    const notificationId = Date.now();
                    const notification = {
                        id: notificationId,
                        type: 'participant_added',
                        message: `${name} oturuma katıldı`,
                        timestamp: Date.now(),
                        participantName: name
                    };
                    
                    // Add notification for all users
                    const notificationUpdates = {};
                    Object.entries(sessionData.participants).forEach(([pid, participant]) => {
                        if (participant.isActive && participant.userId) {
                            notificationUpdates[`sessions/${currentSession}/notifications/${participant.userId}/${notificationId}`] = notification;
                        }
                    });
                    
                    // Also add for the newly added participant if they join later
                    notificationUpdates[`sessions/${currentSession}/notifications/new_${newId}/${notificationId}`] = notification;
                    
                    if (Object.keys(notificationUpdates).length > 0) {
                        await update(ref(database), notificationUpdates);
                    }
                    
                    addParticipantSessionModal.classList.add('hidden');
                    document.getElementById('newParticipantNameInput').value = '';
                    document.getElementById('newParticipantWeightInput').value = '';
                    // Reset to male radio button
                    document.querySelector('input[name="newParticipantGender"][value="male"]').checked = true;
                    showToast(`${name} eklendi`, 'success');
                } catch (error) {
                    alert('Katılımcı eklenirken hata: ' + error.message);
                }
            });
    
            // Open Add Drink Modal
            window.openAddDrinkModal = async function(participantId) {
                if (!isAdmin && participantId !== currentParticipantId) return;
                
                const participant = sessionData.participants[participantId];
                if (!participant) return;
                
                // Show "X için:" only for admin
                if (isAdmin) {
                    document.getElementById('addDrinkForName').textContent = `${participant.name} için:`;
                } else {
                    document.getElementById('addDrinkForName').textContent = '';
                }
                
                // Update drink type datalist
                const datalist = document.getElementById('drinkTypeList');
                const drinkTypes = sessionData.drinkTypes || [];
                datalist.innerHTML = drinkTypes.map(type => `<option value="${type}">`).join('');
                
                // Check for favorite drink
                let favoriteDrink = null;
                let favoriteIcon = '🍹';
                
                try {
                    const userFavRef = ref(database, `userFavorites/${participant.name.toLowerCase()}`);
                    const favSnapshot = await get(userFavRef);
                    const favData = favSnapshot.val();
                    
                    if (favData && favData.drinks) {
                        // Find most consumed drink
                        const drinks = favData.drinks;
                        const sortedDrinks = Object.entries(drinks).sort((a, b) => b[1] - a[1]);
                        
                        if (sortedDrinks.length > 0) {
                            favoriteDrink = sortedDrinks[0][0];
                            favoriteIcon = getDrinkIcon(favoriteDrink);
                        }
                    }
                } catch (error) {
                    console.log('Could not fetch favorite drink:', error);
                }
                
                // Auto-fill favorite drink if found
                if (favoriteDrink) {
                    document.getElementById('drinkTypeInput').value = favoriteDrink;
                    document.getElementById('selectedIcon').value = favoriteIcon;
                    
                    // Select icon
                    document.querySelectorAll('.icon-btn').forEach(btn => {
                        if (btn.getAttribute('data-icon') === favoriteIcon) {
                            btn.classList.add('selected');
                        } else {
                            btn.classList.remove('selected');
                        }
                    });
                } else {
                    document.getElementById('drinkTypeInput').value = '';
                    document.getElementById('drinkQuantityInput').value = '1';
                    document.getElementById('selectedIcon').value = '🍹';
                    
                    // Reset icon selection
                    document.querySelectorAll('.icon-btn').forEach(btn => btn.classList.remove('selected'));
                }
                
                document.getElementById('drinkQuantityInput').value = '1';
                
                // --- PAST PREFERENCES UI ---
                const prefsKey = `tkb_prefs_${userId}`;
                try {
                    let prefs = JSON.parse(localStorage.getItem(prefsKey) || '{}');
                    const topDrinks = Object.keys(prefs).sort((a,b)=>prefs[b]-prefs[a]).slice(0, 3);
                    let suggestionsContainer = document.getElementById('pastPreferencesContainer');
                    
                    if (!suggestionsContainer) {
                        const inputWrapper = document.getElementById('drinkTypeInput').parentElement;
                        suggestionsContainer = document.createElement('div');
                        suggestionsContainer.id = 'pastPreferencesContainer';
                        suggestionsContainer.style.marginTop = '8px';
                        suggestionsContainer.style.display = 'flex';
                        suggestionsContainer.style.gap = '5px';
                        suggestionsContainer.style.flexWrap = 'wrap';
                        inputWrapper.appendChild(suggestionsContainer);
                    }
                    
                    suggestionsContainer.innerHTML = topDrinks.length ? '<div style="width:100%; font-size:12px; color:#aaa; margin-bottom:4px;">Sık İçilenler:</div>' : '';
                    
                    topDrinks.forEach(drink => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.textContent = drink;
                        btn.style.padding = '4px 8px';
                        btn.style.fontSize = '12px';
                        btn.style.background = '#2a2a3e';
                        btn.style.color = '#fff';
                        btn.style.border = '1px solid #4a90e2';
                        btn.style.borderRadius = '4px';
                        btn.style.cursor = 'pointer';
                        btn.onclick = () => {
                            document.getElementById('drinkTypeInput').value = drink;
                            document.getElementById('drinkTypeInput').dispatchEvent(new Event('input'));
                        };
                        suggestionsContainer.appendChild(btn);
                    });
                } catch (e) { console.error('Error loading preferences', e); }
                // ---------------------------
    
                pendingAction = { type: 'addDrink', participantId: participantId };
                addDrinkModal.classList.remove('hidden');
                document.getElementById('drinkTypeInput').focus();
            };
    
            // Icon picker functionality
            document.querySelectorAll('.icon-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const icon = btn.getAttribute('data-icon');
                    document.getElementById('selectedIcon').value = icon;
                    
                    // Update visual selection
                    document.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('selected'));
                    btn.classList.add('selected');
                });
            });
    
            // Auto-select icon based on drink type
            document.getElementById('drinkTypeInput').addEventListener('input', (e) => {
                const drinkType = e.target.value;
                if (drinkType) {
                    const suggestedIcon = getDrinkIcon(drinkType);
                    document.getElementById('selectedIcon').value = suggestedIcon;
                    
                    // Update visual selection
                    document.querySelectorAll('.icon-btn').forEach(btn => {
                        if (btn.getAttribute('data-icon') === suggestedIcon) {
                            btn.classList.add('selected');
                        } else {
                            btn.classList.remove('selected');
                        }
                    });
                }
            });
    
            document.getElementById('cancelAddDrink').addEventListener('click', () => {
                addDrinkModal.classList.add('hidden');
                pendingAction = null;
            });
    
            document.getElementById('drinkTypeInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('drinkQuantityInput').focus();
                }
            });
    
            document.getElementById('drinkQuantityInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('confirmAddDrink').click();
            });
    
            document.getElementById('confirmAddDrink').addEventListener('click', async () => {
                console.log('🔵 confirmAddDrink clicked!');
                console.log('pendingAction:', pendingAction);
                
                if (!pendingAction || pendingAction.type !== 'addDrink') {
                    console.log('❌ No pending action or wrong type, returning');
                    return;
                }
    
                const drinkType = document.getElementById('drinkTypeInput').value.trim();
                const quantity = parseInt(document.getElementById('drinkQuantityInput').value);
                const selectedIcon = document.getElementById('selectedIcon').value;
                const participantId = pendingAction.participantId;
    
                console.log('📝 Input values:', { drinkType, quantity, participantId });
    
                if (!drinkType || quantity < 1) {
                    showToast('Lütfen geçerli bir içki türü ve miktar girin', 'warning');
                    return;
                }
    
                const participant = sessionData.participants[participantId];
                console.log('👤 Participant:', participant);
                
                const existingDrinkType = (sessionData.drinkTypes || []).find(d => d.toLowerCase() === drinkType.toLowerCase()) || drinkType;
                console.log('🍺 Drink type resolved to:', existingDrinkType);
                
                // DUPLICATE DETECTION: Check if same drink added too quickly
                const history = sessionData.drinkHistory?.[participantId] || [];
                
                console.log('=== DUPLICATE CHECK ===');
                console.log('Participant:', participant?.name);
                console.log('Adding drink:', existingDrinkType);
                console.log('History length:', history.length);
                console.log('Current user is admin?', isAdmin);
                
                if (history.length > 0) {
                    const now = Date.now();
                    const lastEntry = [...history].sort((a, b) => b.timestamp - a.timestamp)[0];
                    const timeSinceLastDrink = (now - lastEntry.timestamp) / 1000 / 60; // minutes
                    
                    console.log('Last drink:', lastEntry.drink);
                    console.log('Last drink added by:', lastEntry.addedBy);
                    console.log('Time since last:', timeSinceLastDrink.toFixed(2), 'minutes');
                    
                    // Calculate threshold intelligently
                    let threshold = 5; // Default: 5 minutes
                    let thresholdSource = 'varsayılan';
                    
                    // Step 1: Try to get average for THIS PERSON, THIS DRINK TYPE
                    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
                    const sameDrinkHistory = sortedHistory.filter(entry => entry.drink.toLowerCase() === existingDrinkType.toLowerCase());
                    
                    if (sameDrinkHistory.length >= 2) {
                        const intervals = [];
                        for (let i = 0; i < Math.min(sameDrinkHistory.length - 1, 5); i++) {
                            const intervalMinutes = (sameDrinkHistory[i].timestamp - sameDrinkHistory[i + 1].timestamp) / 1000 / 60;
                            // Only count intervals > 1 minute (ignore same-time additions)
                            if (intervalMinutes > 1) {
                                intervals.push(intervalMinutes);
                            }
                        }
                        
                        if (intervals.length > 0) {
                            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                            threshold = Math.max(avgInterval * 0.5, 3); // Half of average, minimum 3 minutes
                            thresholdSource = `kişinin ${existingDrinkType} ortalaması`;
                            console.log(`✅ Using participant's ${existingDrinkType} average:`, avgInterval.toFixed(2), 'minutes');
                            console.log('Intervals used:', intervals);
                        } else {
                            console.log(`⚠️ No valid intervals for ${existingDrinkType}, trying cross-participant data...`);
                            
                            // Step 2: No valid data for this person + drink combo, check OTHER PARTICIPANTS
                            const allIntervals = [];
                            const allHistory = sessionData.drinkHistory || {};
                            
                            Object.entries(allHistory).forEach(([pid, pHistory]) => {
                                if (pid === participantId) return; // Skip self
                                
                                const pSameDrink = pHistory.filter(e => e.drink.toLowerCase() === existingDrinkType.toLowerCase());
                                const pSorted = [...pSameDrink].sort((a, b) => b.timestamp - a.timestamp);
                                
                                for (let i = 0; i < Math.min(pSorted.length - 1, 3); i++) {
                                    const intervalMinutes = (pSorted[i].timestamp - pSorted[i + 1].timestamp) / 1000 / 60;
                                    if (intervalMinutes > 1) {
                                        allIntervals.push(intervalMinutes);
                                    }
                                }
                            });
                            
                            if (allIntervals.length > 0) {
                                const avgInterval = allIntervals.reduce((a, b) => a + b, 0) / allIntervals.length;
                                threshold = Math.max(avgInterval * 0.5, 3);
                                thresholdSource = `diğer katılımcıların ${existingDrinkType} ortalaması`;
                                console.log(`✅ Using cross-participant ${existingDrinkType} average:`, avgInterval.toFixed(2), 'minutes');
                                console.log('Cross-participant intervals:', allIntervals);
                            } else {
                                console.log('⚠️ No cross-participant data, using default threshold');
                            }
                        }
                    }
                    
                    console.log('Final threshold:', threshold.toFixed(2), 'minutes');
                    console.log('Threshold source:', thresholdSource);
                    console.log('Same drink?', lastEntry.drink.toLowerCase() === existingDrinkType.toLowerCase());
                    console.log('Too fast?', timeSinceLastDrink < threshold);
                    
                    // If adding same drink type too quickly, ask for confirmation
                    if (lastEntry.drink.toLowerCase() === existingDrinkType.toLowerCase() && 
                        timeSinceLastDrink < threshold) {
                        console.log('🚨 SHOWING DUPLICATE WARNING!');
                        
                        const minutes = Math.floor(timeSinceLastDrink);
                        const seconds = Math.floor((timeSinceLastDrink - minutes) * 60);
                        const timeAgo = minutes > 0 ? `${minutes} dakika ${seconds} saniye` : `${seconds} saniye`;
                        
                        // Determine who added the last drink
                        let addedByText = '';
                        if (lastEntry.addedBy === 'admin') {
                            addedByText = 'Admin tarafından';
                        } else if (lastEntry.addedBy === participantId) {
                            addedByText = `${participant.name} tarafından (kendisi)`;
                        } else {
                            const adderParticipant = sessionData.participants[lastEntry.addedBy];
                            if (adderParticipant) {
                                addedByText = `${adderParticipant.name} tarafından`;
                            } else {
                                addedByText = 'Bilinmeyen kişi tarafından';
                            }
                        }
                        
                        const confirmMessage = `⚠️ DİKKAT: Mükerrer Giriş Kontrolü\n\n` +
                            `${participant.name} için ${timeAgo} önce "${lastEntry.drink}" eklendi.\n` +
                            `${addedByText}\n\n` +
                            `Şimdi tekrar "${existingDrinkType}" eklemek istiyorsunuz.\n\n` +
                            `Ortalama içme aralığı: ${Math.round(threshold)} dakika (${thresholdSource})\n` +
                            `Son ekleme: ${timeAgo} önce (çok kısa!)\n\n` +
                            `Bu mükerrer bir giriş olabilir.\n\n` +
                            `İçki masaya geldi mi?\n` +
                            `Eğer gelmediyse lütfen masaya geldikten sonra ekleyin.\n\n` +
                            `Yine de eklemek istediğinize emin misiniz?`;
                        
                        if (!confirm(confirmMessage)) {
                            console.log('❌ User cancelled duplicate entry');
                            addDrinkModal.classList.add('hidden');
                            pendingAction = null;
                            return; // User cancelled
                        }
                        console.log('✅ User confirmed duplicate entry');
                    } else {
                        console.log('✅ No duplicate detected, proceeding normally');
                    }
                } else {
                    console.log('✅ First drink, no duplicate check needed');
                }
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedDrinkTypes = [...(sessionData.drinkTypes || [])];
                const updatedHistory = { ...sessionData.drinkHistory };
                const updatedUndo = [...(sessionData.undoStack || [])];
                const updatedDrinkIcons = { ...(sessionData.drinkIcons || {}) };
    
                if (!updatedDrinkTypes.some(d => d.toLowerCase() === existingDrinkType.toLowerCase())) {
                    updatedDrinkTypes.push(existingDrinkType);
                }
    
                // Save icon for this drink type
                if (!updatedDrinkIcons[existingDrinkType]) {
                    updatedDrinkIcons[existingDrinkType] = selectedIcon;
                }
    
                if (!updatedDrinks[participantId]) {
                    updatedDrinks[participantId] = {};
                }
                
                const oldQuantity = updatedDrinks[participantId][existingDrinkType] || 0;
                updatedDrinks[participantId][existingDrinkType] = oldQuantity + quantity;
    
                // --- PAST PREFERENCES: Save to local storage ---
                try {
                    const prefsKey = `tkb_prefs_${userId}`;
                    let prefs = JSON.parse(localStorage.getItem(prefsKey) || '{}');
                    prefs[existingDrinkType] = (prefs[existingDrinkType] || 0) + quantity;
                    localStorage.setItem(prefsKey, JSON.stringify(prefs));
                } catch (e) {
                    console.error('Error saving preference', e);
                }
                // ----------------------------------------------
    
                if (!updatedHistory[participantId]) {
                    updatedHistory[participantId] = [];
                }
                
                const timestamp = Date.now();
                updatedHistory[participantId].push({
                    drink: existingDrinkType,
                    quantity: quantity,
                    timestamp: timestamp,
                    addedBy: isAdmin ? 'admin' : participantId
                });
    
                // Add to undo stack
                updatedUndo.push({
                    action: 'addDrink',
                    participantId: participantId,
                    drink: existingDrinkType,
                    quantity: quantity,
                    timestamp: timestamp,
                    expiresAt: timestamp + 30000 // 30 seconds
                });
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkTypes: updatedDrinkTypes,
                        drinkHistory: updatedHistory,
                        undoStack: updatedUndo,
                        drinkIcons: updatedDrinkIcons
                    });
    
                    // Add notification
                    const addedBy = isAdmin ? 'Yönetici' : participant.name;
                    const notificationMessage = `${addedBy} ${participant.name === addedBy ? '' : `${participant.name} için `}${quantity} ${existingDrinkType} ekledi`;
                    await addNotification(notificationMessage, 'info');
    
                    addDrinkModal.classList.add('hidden');
                    pendingAction = null;
    
                    // Notify admin if participant added
                    if (!isAdmin) {
                        // Will be shown via Firebase listener
                    }
                } catch (error) {
                    alert('İçki eklenirken hata: ' + error.message);
                }
            });
    
            // Adjust Drink
            window.adjustDrink = async function(participantId, drinkType, change) {
                console.log('🔵 adjustDrink called:', { participantId, drinkType, change });
                
                if (!isAdmin && participantId !== currentParticipantId) return;
    
                const participant = sessionData.participants[participantId];
                const currentQty = sessionData.drinks[participantId]?.[drinkType] || 0;
                const newQty = currentQty + change;
    
                // If participant is decreasing their own drink, request admin approval
                if (!isAdmin && participantId === currentParticipantId && change < 0) {
                    // First, ask for confirmation from the participant
                    const confirmMessage = `${drinkType} miktarını azaltmak istiyor musunuz? (${currentQty} → ${newQty})\n\nBu istek admin onayına gönderilecek.`;
                    
                    if (!confirm(confirmMessage)) {
                        return; // User cancelled
                    }
                    
                    try {
                        // Add to pending adjustments (no notification - admin sees in Approvals tab)
                        const pendingAdjustments = sessionData.pendingAdjustments || {};
                        const adjustId = `adj_${Date.now()}`;
                        pendingAdjustments[adjustId] = {
                            participantId: participantId,
                            participantName: participant.name,
                            drinkType: drinkType,
                            change: change,
                            currentQty: currentQty,
                            newQty: newQty,
                            requestedAt: Date.now(),
                            requestedBy: participantId
                        };
                        
                        await update(ref(database, `sessions/${currentSession}`), {
                            pendingAdjustments: pendingAdjustments
                        });
                        
                        showToast('Azaltma isteği admin onayına gönderildi', 'info');
                    } catch (error) {
                        alert('İstek gönderilirken hata: ' + error.message);
                    }
                    return;
                }
    
                // DUPLICATE DETECTION for increase (+) button
                if (change > 0) {
                    const history = sessionData.drinkHistory?.[participantId] || [];
                    
                    console.log('=== DUPLICATE CHECK (+ button) ===');
                    console.log('Participant:', participant?.name);
                    console.log('Adding drink:', drinkType);
                    console.log('History length:', history.length);
                    
                    if (history.length > 0) {
                        const now = Date.now();
                        const lastEntry = [...history].sort((a, b) => b.timestamp - a.timestamp)[0];
                        const timeSinceLastDrink = (now - lastEntry.timestamp) / 1000 / 60; // minutes
                        
                        console.log('Last drink:', lastEntry.drink);
                        console.log('Time since last:', timeSinceLastDrink.toFixed(2), 'minutes');
                        
                        // Calculate threshold
                        let threshold = 5; // Default: 5 minutes
                        
                        if (history.length >= 2) {
                            const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
                            const intervals = [];
                            for (let i = 0; i < Math.min(sortedHistory.length - 1, 5); i++) {
                                intervals.push((sortedHistory[i].timestamp - sortedHistory[i + 1].timestamp) / 1000 / 60);
                            }
                            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                            threshold = Math.max(avgInterval * 0.5, 3);
                        }
                        
                        console.log('Threshold:', threshold.toFixed(2), 'minutes');
                        console.log('Same drink?', lastEntry.drink.toLowerCase() === drinkType.toLowerCase());
                        console.log('Too fast?', timeSinceLastDrink < threshold);
                        
                        // If adding same drink type too quickly, ask for confirmation
                        if (lastEntry.drink.toLowerCase() === drinkType.toLowerCase() && 
                            timeSinceLastDrink < threshold) {
                            console.log('🚨 SHOWING DUPLICATE WARNING (+ button)!');
                            
                            const minutes = Math.floor(timeSinceLastDrink);
                            const seconds = Math.floor((timeSinceLastDrink - minutes) * 60);
                            const timeAgo = minutes > 0 ? `${minutes} dakika ${seconds} saniye` : `${seconds} saniye`;
                            
                            // Determine who added the last drink
                            let addedByText = '';
                            if (lastEntry.addedBy === 'admin') {
                                addedByText = 'Admin tarafından';
                            } else if (lastEntry.addedBy === participantId) {
                                addedByText = `${participant.name} tarafından (kendisi)`;
                            } else {
                                const adderParticipant = sessionData.participants[lastEntry.addedBy];
                                if (adderParticipant) {
                                    addedByText = `${adderParticipant.name} tarafından`;
                                } else {
                                    addedByText = 'Bilinmeyen kişi tarafından';
                                }
                            }
                            
                            const dupMessage = `⚠️ DİKKAT: Mükerrer Giriş Kontrolü\n\n` +
                                `${participant.name} için ${timeAgo} önce "${lastEntry.drink}" eklendi.\n` +
                                `${addedByText}\n\n` +
                                `Şimdi tekrar "${drinkType}" eklemek istiyorsunuz.\n\n` +
                                `Ortalama içme aralığı: ${Math.round(threshold)} dakika\n` +
                                `Son ekleme: ${timeAgo} önce (çok kısa!)\n\n` +
                                `Bu mükerrer bir giriş olabilir.\n` +
                                `Yine de eklemek istediğinize emin misiniz?`;
                            
                            if (!confirm(dupMessage)) {
                                console.log('❌ User cancelled duplicate entry (+ button)');
                                return; // User cancelled
                            }
                            console.log('✅ User confirmed duplicate entry (+ button)');
                        }
                    }
                }
    
                // Admin can adjust directly
                let message;
                if (newQty <= 0) {
                    message = `${participant.name} için ${drinkType} silinecek. Devam edilsin mi?`;
                } else if (change > 0) {
                    message = `${participant.name} için ${Math.abs(change)} adet daha ${drinkType} eklensin mi? (${currentQty} → ${newQty})`;
                } else {
                    message = `${participant.name} için ${drinkType} miktarı ${currentQty}'den ${newQty}'e düşürülsün mü?`;
                }
    
                document.getElementById('adjustDrinkMessage').textContent = message;
                pendingAction = { type: 'adjustDrink', participantId, drinkType, change };
                adjustDrinkModal.classList.remove('hidden');
            };
    
            document.getElementById('cancelAdjustDrink').addEventListener('click', () => {
                adjustDrinkModal.classList.add('hidden');
                pendingAction = null;
            });
    
            document.getElementById('confirmAdjustDrink').addEventListener('click', async () => {
                if (!pendingAction || pendingAction.type !== 'adjustDrink') return;
    
                const { participantId, drinkType, change } = pendingAction;
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedHistory = { ...sessionData.drinkHistory };
                const updatedUndo = [...(sessionData.undoStack || [])];
                const timestamp = Date.now();
    
                const currentQty = updatedDrinks[participantId]?.[drinkType] || 0;
                const newQty = currentQty + change;
    
                if (change > 0) {
                    updatedDrinks[participantId][drinkType] = newQty;
                    
                    if (!updatedHistory[participantId]) {
                        updatedHistory[participantId] = [];
                    }
                    updatedHistory[participantId].push({
                        drink: drinkType,
                        quantity: change,
                        timestamp: timestamp,
                        addedBy: isAdmin ? 'admin' : participantId
                    });
    
                    updatedUndo.push({
                        action: 'adjustDrink',
                        participantId: participantId,
                        drink: drinkType,
                        oldValue: currentQty,
                        newValue: newQty,
                        timestamp: timestamp,
                        expiresAt: timestamp + 30000
                    });
                } else {
                    // Decrease
                    if (newQty <= 0) {
                        delete updatedDrinks[participantId][drinkType];
                        if (Object.keys(updatedDrinks[participantId]).length === 0) {
                            delete updatedDrinks[participantId];
                        }
                    } else {
                        updatedDrinks[participantId][drinkType] = newQty;
                    }
    
                    // Remove from history
                    if (updatedHistory[participantId]) {
                        for (let i = updatedHistory[participantId].length - 1; i >= 0; i--) {
                            if (updatedHistory[participantId][i].drink === drinkType) {
                                updatedHistory[participantId].splice(i, 1);
                                break;
                            }
                        }
                        if (updatedHistory[participantId].length === 0) {
                            delete updatedHistory[participantId];
                        }
                    }
    
                    updatedUndo.push({
                        action: 'adjustDrink',
                        participantId: participantId,
                        drink: drinkType,
                        oldValue: currentQty,
                        newValue: newQty,
                        timestamp: timestamp,
                        expiresAt: timestamp + 30000
                    });
                }
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkHistory: updatedHistory,
                        undoStack: updatedUndo
                    });
    
                    // Add notification
                    const participant = sessionData.participants[participantId];
                    const addedBy = isAdmin ? 'Yönetici' : participant.name;
                    let notificationMessage;
                    
                    if (change > 0) {
                        notificationMessage = `${addedBy} ${participant.name === addedBy ? '' : `${participant.name} için `}${drinkType} artırdı (${currentQty} → ${newQty})`;
                    } else if (newQty <= 0) {
                        notificationMessage = `${addedBy} ${participant.name === addedBy ? '' : `${participant.name} için `}${drinkType} sildi`;
                    } else {
                        notificationMessage = `${addedBy} ${participant.name === addedBy ? '' : `${participant.name} için `}${drinkType} azalttı (${currentQty} → ${newQty})`;
                    }
                    
                    await addNotification(notificationMessage, change > 0 ? 'info' : 'warning');
    
                    adjustDrinkModal.classList.add('hidden');
                    pendingAction = null;
                } catch (error) {
                    alert('Miktar ayarlanırken hata: ' + error.message);
                }
            });
    
            // Delete Drink
            window.deleteDrink = async function(participantId, drinkType) {
                if (!isAdmin && participantId !== currentParticipantId) return;
    
                const participant = sessionData.participants[participantId];
                
                // If participant is deleting their own drink, request admin approval
                if (!isAdmin && participantId === currentParticipantId) {
                    try {
                        // Add to pending deletions (no notification - admin sees in Approvals tab)
                        const pendingDeletions = sessionData.pendingDeletions || {};
                        const deleteId = `del_${Date.now()}`;
                        pendingDeletions[deleteId] = {
                            participantId: participantId,
                            participantName: participant.name,
                            drinkType: drinkType,
                            requestedAt: Date.now(),
                            requestedBy: participantId
                        };
                        
                        await update(ref(database, `sessions/${currentSession}`), {
                            pendingDeletions: pendingDeletions
                        });
                        
                        showToast('Silme isteği admin onayına gönderildi', 'info');
                    } catch (error) {
                        alert('İstek gönderilirken hata: ' + error.message);
                    }
                    return;
                }
                
                // Admin can delete directly
                document.getElementById('deleteDrinkMessage').textContent = 
                    `${participant.name} için ${drinkType} silinsin mi?`;
                
                pendingAction = { type: 'deleteDrink', participantId, drinkType };
                deleteDrinkModal.classList.remove('hidden');
            };
    
            document.getElementById('cancelDeleteDrink').addEventListener('click', () => {
                deleteDrinkModal.classList.add('hidden');
                pendingAction = null;
            });
    
            document.getElementById('confirmDeleteDrink').addEventListener('click', async () => {
                if (!pendingAction || pendingAction.type !== 'deleteDrink') return;
    
                const { participantId, drinkType } = pendingAction;
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedHistory = { ...sessionData.drinkHistory };
                const updatedUndo = [...(sessionData.undoStack || [])];
                const timestamp = Date.now();
    
                const oldQuantity = updatedDrinks[participantId]?.[drinkType] || 0;
    
                delete updatedDrinks[participantId][drinkType];
                if (Object.keys(updatedDrinks[participantId]).length === 0) {
                    delete updatedDrinks[participantId];
                }
    
                if (updatedHistory[participantId]) {
                    updatedHistory[participantId] = updatedHistory[participantId].filter(entry => entry.drink !== drinkType);
                    if (updatedHistory[participantId].length === 0) {
                        delete updatedHistory[participantId];
                    }
                }
    
                updatedUndo.push({
                    action: 'deleteDrink',
                    participantId: participantId,
                    drink: drinkType,
                    oldValue: oldQuantity,
                    timestamp: timestamp,
                    expiresAt: timestamp + 30000
                });
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkHistory: updatedHistory,
                        undoStack: updatedUndo
                    });
    
                    // Add notification
                    const participant = sessionData.participants[participantId];
                    await addNotification(`${participant.name} için ${drinkType} silindi`, 'error');
    
                    deleteDrinkModal.classList.add('hidden');
                    pendingAction = null;
                } catch (error) {
                    alert('İçki silinirken hata: ' + error.message);
                }
            });
    
            // Undo functionality
            // Admin actions
            window.requestAdminAction = function(action) {
                if (!isAdmin) return;
                
                pendingAdminAction = action;
                
                if (action === 'clearAll') {
                    document.getElementById('adminCodeMessage').textContent = 'Tüm içkileri silmek için admin kodunu girin:';
                } else if (action === 'endSession') {
                    document.getElementById('adminCodeMessage').textContent = 'Oturumu sonlandırmak için admin kodunu girin:';
                }
                
                document.getElementById('adminCodeInput').value = '';
                adminCodeModal.classList.remove('hidden');
                document.getElementById('adminCodeInput').focus();
            };
    
            document.getElementById('cancelAdminCode').addEventListener('click', () => {
                adminCodeModal.classList.add('hidden');
                pendingAdminAction = null;
            });
    
            document.getElementById('adminCodeInput').addEventListener('keypress', (e) => {
                if (e.key === 'Enter') document.getElementById('confirmAdminCode').click();
            });
    
            document.getElementById('confirmAdminCode').addEventListener('click', async () => {
                const enteredCode = document.getElementById('adminCodeInput').value.trim();
                
                if (enteredCode !== adminCode) {
                    alert('Yanlış admin kodu');
                    return;
                }
    
                adminCodeModal.classList.add('hidden');
    
                if (pendingAdminAction === 'clearAll') {
                    if (!confirm('Tüm içkiler silinecek. Emin misiniz?')) {
                        pendingAdminAction = null;
                        return;
                    }
    
                    try {
                        await update(ref(database, `sessions/${currentSession}`), {
                            drinks: {},
                            drinkHistory: {},
                            undoStack: []
                        });
                        showToast('Tüm veriler silindi', 'warning');
                    } catch (error) {
                        alert('Veri silinirken hata: ' + error.message);
                    }
                } else if (pendingAdminAction === 'endSession') {
                    const saveHistory = confirm('Oturumu sonlandırmadan önce:\n\nBu oturumu geçmişe kaydetmek ister misiniz?\n\n• EVET: Favori içki hesaplamasında kullanılacak\n• HAYIR: Tamamen silinecek (test için)');
                    
                    if (saveHistory) {
                        // Save session to history before deleting
                        try {
                            const sessionRef = ref(database, `sessions/${currentSession}`);
                            const snapshot = await get(sessionRef);
                            const sessionData = snapshot.val();
                            
                            if (sessionData) {
                                // Calculate session summary
                                const participants = sessionData.participants || {};
                                const drinks = sessionData.drinks || {};
                                const drinkHistory = sessionData.drinkHistory || {};
                                
                                const sessionSummary = {
                                    sessionCode: currentSession,
                                    endedAt: Date.now(),
                                    createdAt: sessionData.createdAt,
                                    participants: {},
                                    totalDrinks: {}
                                };
                                
                                // Save each participant's drink consumption
                                Object.entries(participants).forEach(([pid, participant]) => {
                                    if (!participant.isActive) return;
                                    
                                    const participantDrinks = drinks[pid] || {};
                                    const participantHistory = drinkHistory[pid] || [];
                                    
                                    sessionSummary.participants[participant.name] = {
                                        gender: participant.gender,
                                        weight: participant.weight,
                                        drinks: participantDrinks,
                                        drinkCount: Object.values(participantDrinks).reduce((sum, qty) => sum + qty, 0),
                                        drinkHistory: participantHistory
                                    };
                                    
                                    // Aggregate for favorite calculation
                                    Object.entries(participantDrinks).forEach(([drinkType, qty]) => {
                                        if (!sessionSummary.totalDrinks[drinkType]) {
                                            sessionSummary.totalDrinks[drinkType] = 0;
                                        }
                                        sessionSummary.totalDrinks[drinkType] += qty;
                                    });
                                });
                                
                                // Save to history
                                const historyId = `hist_${Date.now()}`;
                                await set(ref(database, `sessionHistory/${historyId}`), sessionSummary);
                                
                                // Update user favorites for each participant
                                for (const [name, data] of Object.entries(sessionSummary.participants)) {
                                    const userFavRef = ref(database, `userFavorites/${name.toLowerCase()}`);
                                    const favSnapshot = await get(userFavRef);
                                    const currentFav = favSnapshot.val() || { drinks: {} };
                                    
                                    // Add this session's drinks to their totals
                                    Object.entries(data.drinks).forEach(([drinkType, qty]) => {
                                        if (!currentFav.drinks[drinkType]) {
                                            currentFav.drinks[drinkType] = 0;
                                        }
                                        currentFav.drinks[drinkType] += qty;
                                    });
                                    
                                    currentFav.lastSession = Date.now();
                                    await set(userFavRef, currentFav);
                                }
                                
                                showToast('Oturum geçmişe kaydedildi', 'success');
                            }
                        } catch (error) {
                            console.error('Error saving session history:', error);
                            showToast('Geçmiş kaydedilirken hata oluştu', 'error');
                        }
                    }
                    
                    // Delete session
                    if (confirm('Oturumu şimdi sonlandırmak istediğinize emin misiniz?')) {
                        try {
                            await remove(ref(database, `sessions/${currentSession}`));
                            leaveSession();
                        } catch (error) {
                            alert('Oturum sonlandırılırken hata: ' + error.message);
                        }
                    }
                }
    
                pendingAdminAction = null;
            });
    
            // Approve deletion request
            window.approveDeletion = async function(deleteId) {
                if (!isAdmin) return;
    
                const pendingDeletions = { ...(sessionData.pendingDeletions || {}) };
                const deletion = pendingDeletions[deleteId];
                
                if (!deletion) return;
    
                const { participantId, drinkType, participantName } = deletion;
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedHistory = { ...sessionData.drinkHistory };
    
                // Delete the drink
                if (updatedDrinks[participantId] && updatedDrinks[participantId][drinkType]) {
                    delete updatedDrinks[participantId][drinkType];
                    if (Object.keys(updatedDrinks[participantId]).length === 0) {
                        delete updatedDrinks[participantId];
                    }
                }
    
                if (updatedHistory[participantId]) {
                    updatedHistory[participantId] = updatedHistory[participantId].filter(entry => entry.drink !== drinkType);
                    if (updatedHistory[participantId].length === 0) {
                        delete updatedHistory[participantId];
                    }
                }
    
                // Remove from pending
                delete pendingDeletions[deleteId];
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkHistory: updatedHistory,
                        pendingDeletions: pendingDeletions
                    });
    
                    // Send notification only to the affected participant
                    const participant = sessionData.participants[participantId];
                    if (participant && participant.userId) {
                        const notificationId = Date.now();
                        const notification = {
                            id: notificationId,
                            type: 'success',
                            message: `${drinkType} silme isteğiniz onaylandı`,
                            timestamp: Date.now()
                        };
                        await update(ref(database, `sessions/${currentSession}/notifications/${participant.userId}/${notificationId}`), notification);
                    }
    
                    showToast('Silme isteği onaylandı', 'success');
                    updateApprovalCount();
                    renderApprovals();
                } catch (error) {
                    alert('Onaylama sırasında hata: ' + error.message);
                }
            };
    
            // Reject deletion request
            window.rejectDeletion = async function(deleteId) {
                if (!isAdmin) return;
    
                const pendingDeletions = { ...(sessionData.pendingDeletions || {}) };
                const deletion = pendingDeletions[deleteId];
                
                if (!deletion) return;
    
                delete pendingDeletions[deleteId];
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        pendingDeletions: pendingDeletions
                    });
    
                    // Send notification only to the affected participant
                    const participant = sessionData.participants[deletion.participantId];
                    if (participant && participant.userId) {
                        const notificationId = Date.now();
                        const notification = {
                            id: notificationId,
                            type: 'warning',
                            message: `${deletion.drinkType} silme isteğiniz reddedildi`,
                            timestamp: Date.now()
                        };
                        await update(ref(database, `sessions/${currentSession}/notifications/${participant.userId}/${notificationId}`), notification);
                    }
    
                    showToast('Silme isteği reddedildi', 'warning');
                    updateApprovalCount();
                    renderApprovals();
                } catch (error) {
                    alert('Reddetme sırasında hata: ' + error.message);
                }
            };
    
            // Approve adjustment request
            window.approveAdjustment = async function(adjustId) {
                if (!isAdmin) return;
    
                const pendingAdjustments = { ...(sessionData.pendingAdjustments || {}) };
                const adjustment = pendingAdjustments[adjustId];
                
                if (!adjustment) return;
    
                const { participantId, drinkType, change, participantName } = adjustment;
                
                const updatedDrinks = { ...sessionData.drinks };
                const updatedHistory = { ...sessionData.drinkHistory };
                const updatedUndo = [...(sessionData.undoStack || [])];
                const timestamp = Date.now();
    
                const currentQty = updatedDrinks[participantId]?.[drinkType] || 0;
                const newQty = currentQty + change;
    
                if (newQty <= 0) {
                    // Delete drink
                    delete updatedDrinks[participantId][drinkType];
                    if (Object.keys(updatedDrinks[participantId]).length === 0) {
                        delete updatedDrinks[participantId];
                    }
    
                    if (updatedHistory[participantId]) {
                        updatedHistory[participantId] = updatedHistory[participantId].filter(entry => entry.drink !== drinkType);
                        if (updatedHistory[participantId].length === 0) {
                            delete updatedHistory[participantId];
                        }
                    }
                } else {
                    // Adjust drink
                    updatedDrinks[participantId][drinkType] = newQty;
    
                    if (updatedHistory[participantId]) {
                        updatedHistory[participantId].push({
                            drink: drinkType,
                            quantity: change,
                            timestamp: timestamp,
                            addedBy: participantId
                        });
                    }
                }
    
                updatedUndo.push({
                    action: 'adjustDrink',
                    participantId: participantId,
                    drink: drinkType,
                    change: change,
                    timestamp: timestamp,
                    expiresAt: timestamp + 30000
                });
    
                // Remove from pending
                delete pendingAdjustments[adjustId];
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        drinks: updatedDrinks,
                        drinkHistory: updatedHistory,
                        undoStack: updatedUndo,
                        pendingAdjustments: pendingAdjustments
                    });
    
                    await addNotification(`${participantName} için ${drinkType} azaltma isteği onaylandı (${adjustment.currentQty} → ${adjustment.newQty})`, 'success');
                    showToast('Azaltma isteği onaylandı', 'success');
                    updateApprovalCount();
                    renderApprovals();
                } catch (error) {
                    alert('Onaylama sırasında hata: ' + error.message);
                }
            };
    
            // Reject adjustment request
            window.rejectAdjustment = async function(adjustId) {
                if (!isAdmin) return;
    
                const pendingAdjustments = { ...(sessionData.pendingAdjustments || {}) };
                const adjustment = pendingAdjustments[adjustId];
                
                if (!adjustment) return;
    
                delete pendingAdjustments[adjustId];
    
                try {
                    await update(ref(database, `sessions/${currentSession}`), {
                        pendingAdjustments: pendingAdjustments
                    });
    
                    await addNotification(`${adjustment.participantName} için ${adjustment.drinkType} azaltma isteği reddedildi`, 'warning');
                    showToast('Azaltma isteği reddedildi', 'warning');
                    updateApprovalCount();
                    renderApprovals();
                } catch (error) {
                    alert('Reddetme sırasında hata: ' + error.message);
                }
            };
    
            // Remove participant (admin only)
            window.removeParticipant = async function(participantId) {
                if (!isAdmin) {
                    alert('Sadece yönetici katılımcı çıkarabilir');
                    return;
                }
    
                const participant = sessionData.participants[participantId];
                if (!participant) return;
    
                if (!confirm(`${participant.name} oturumdan çıkarılsın mı?`)) {
                    return;
                }
    
                try {
                    // Set participant as inactive instead of deleting
                    await update(ref(database, `sessions/${currentSession}/participants/${participantId}`), {
                        isActive: false
                    });
    
                    // Send notification to all remaining participants
                    const notificationId = Date.now();
                    const notification = {
                        id: notificationId,
                        type: 'participant_removed',
                        message: `${participant.name} oturumdan çıkarıldı`,
                        timestamp: Date.now(),
                        participantName: participant.name
                    };
                    
                    const notificationUpdates = {};
                    Object.entries(sessionData.participants).forEach(([pid, p]) => {
                        if (p.isActive && p.userId && pid !== participantId) {
                            notificationUpdates[`sessions/${currentSession}/notifications/${p.userId}/${notificationId}`] = notification;
                        }
                    });
                    
                    if (Object.keys(notificationUpdates).length > 0) {
                        await update(ref(database), notificationUpdates);
                    }
    
                    showToast(`${participant.name} çıkarıldı`, 'warning');
                } catch (error) {
                    alert('Katılımcı çıkarılırken hata: ' + error.message);
                }
            };
    
            // Show admin code
            // Show QR Code Modal (Public sharing)
            window.showQRCode = function() {
                // Everyone can share QR code now!
                
                document.getElementById('showSessionCodeQR').textContent = currentSession;
                
                // Generate QR Code
                const qrContainer = document.getElementById('qrCodeContainer');
                qrContainer.innerHTML = ''; // Clear previous QR code
                
                // Create URL for joining session
                const joinUrl = `${window.location.origin}${window.location.pathname}?join=${currentSession}`;
                
                new QRCode(qrContainer, {
                    text: joinUrl,
                    width: 200,
                    height: 200,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                
                document.getElementById('qrCodeModal').classList.remove('hidden');
            };
    
            // Show Admin Code Modal (Private - admin only)
            window.showAdminCode = function() {
                if (!isAdmin) return;
                
                document.getElementById('showAdminCodeValue').textContent = adminCode;
                document.getElementById('showAdminCodeModal').classList.remove('hidden');
            };
    
            // Show participant drink history
            window.showParticipantHistory = function(participantId) {
                const participant = sessionData.participants[participantId];
                if (!participant) return;
                
                const history = sessionData.drinkHistory?.[participantId] || [];
                const participantColor = getParticipantColor(participantId);
                
                document.getElementById('historyParticipantName').textContent = `${participant.name} için geçmiş`;
                
                if (history.length === 0) {
                    document.getElementById('historyContent').innerHTML = '<div class="empty-notifications">Henüz içki eklenmedi</div>';
                } else {
                    // Sort by timestamp (newest first)
                    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
                    
                    let html = '<div style="display: flex; flex-direction: column; gap: 8px;">';
                    sortedHistory.forEach(entry => {
                        const date = new Date(entry.timestamp);
                        const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
                        const dateStr = date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
                        const icon = getDrinkIcon(entry.drink);
                        
                        html += `
                            <div style="background: ${participantColor.bg}; padding: 12px; border-radius: 8px; border-left: 3px solid ${participantColor.border};">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 24px;">${icon}</span>
                                        <div>
                                            <div style="color: #e0e0e0; font-weight: 600;">${entry.drink}</div>
                                            <div style="color: #b0b0b0; font-size: 12px;">Miktar: ${entry.quantity}</div>
                                        </div>
                                    </div>
                                    <div style="text-align: right;">
                                        <div style="color: ${participantColor.border}; font-weight: 600;">${timeStr}</div>
                                        <div style="color: #888; font-size: 12px;">${dateStr}</div>
                                    </div>
                                </div>
                            </div>
                        `;
                    });
                    html += '</div>';
                    
                    document.getElementById('historyContent').innerHTML = html;
                }
                
                document.getElementById('participantHistoryModal').classList.remove('hidden');
            };
    
            // Close show admin code modal
            // Close QR code modal
            document.getElementById('closeQRCode').addEventListener('click', () => {
                document.getElementById('qrCodeModal').classList.add('hidden');
            });
    
            // Close show admin code modal
            document.getElementById('closeShowAdminCode').addEventListener('click', () => {
                document.getElementById('showAdminCodeModal').classList.add('hidden');
            });
    
            // Copy admin code to clipboard
            document.getElementById('copyAdminCode').addEventListener('click', () => {
                const text = adminCode;
                
                navigator.clipboard.writeText(text).then(() => {
                    showToast('Admin kodu kopyalandı!', 'success');
                }).catch(() => {
                    // Fallback for older browsers
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showToast('Admin kodu kopyalandı!', 'success');
                });
            });
    
            // Close participant history modal
            document.getElementById('closeParticipantHistory').addEventListener('click', () => {
                document.getElementById('participantHistoryModal').classList.add('hidden');
            });
    
            // Copy participant history to clipboard
            // Leave session
            window.leaveSession = function() {
                if (confirm('Bu oturumdan ayrılmak istediğinize emin misiniz?')) {
                    leaveSession();
                }
            };
    
            function leaveSession() {
                // Clear userId from Firebase so participant can rejoin later
                if (currentSession && currentParticipantId) {
                    update(ref(database, `sessions/${currentSession}/participants/${currentParticipantId}`), {
                        userId: null
                    }).catch(error => {
                        console.error('Error clearing userId:', error);
                    });
                }
                
                // Clear welcome notification flag for this session
                if (currentSession && userId) {
                    localStorage.removeItem(`joined_${currentSession}_${userId}`);
                }
                
                currentSession = null;
                isAdmin = false;
                adminCode = null;
                currentParticipantId = null;
                sessionData = {
                    participants: {},
                    drinks: {},
                    drinkTypes: [],
                    drinkHistory: {},
                    undoStack: [],
                    notifications: {},
                    pendingDeletions: {},
                    pendingAdjustments: {}
                };
                
                localStorage.removeItem('currentSession');
                localStorage.removeItem('isAdmin');
                localStorage.removeItem('adminCode');
                localStorage.removeItem('currentParticipantId');
                
                showSessionManagement();
            }
    
            // Auto-refresh every 30 seconds
            setInterval(() => {
                if (currentSession) {
                    renderMainContent();
                }
            }, 30000);
    
            // Check for attention-needed participants every 5 minutes (admin only)
            let lastAttentionCheck = Date.now();
            setInterval(() => {
                if (!isAdmin || !currentSession) return;
                
                const now = Date.now();
                const participants = sessionData.participants || {};
                
                Object.entries(participants).forEach(([pid, participant]) => {
                    if (!participant.isActive) return;
                    
                    const needsAttention = checkIfNeedsAttention(pid, now);
                    if (needsAttention) {
                        // Only notify once every 15 minutes per participant
                        const lastNotified = localStorage.getItem(`attention_${pid}`) || 0;
                        if (now - lastNotified > 15 * 60 * 1000) {
                            const message = `${participant.name} kontrole ihtiyaç duyuyor`;
                            showToast(message, 'warning');
                            showBrowserNotification('⚠️ Kontrol Gerekli', message);
                            localStorage.setItem(`attention_${pid}`, now.toString());
                        }
                    }
                });
            }, 5 * 60 * 1000); // Every 5 minutes
};
