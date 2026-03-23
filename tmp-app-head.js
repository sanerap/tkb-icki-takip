/**
 * Main Application Logic for TKB İçki Takibi
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Global Firebase Exports for other scripts if needed
window.firebaseApp = initializeApp(window.firebaseConfig);
window.database = getDatabase(window.firebaseApp);
window.auth = getAuth(window.firebaseApp);

// Initialize Application
window.initApplication = function() {
    console.log('🚀 TKB Application Initializing...');
    
    const db = window.database;
    const auth = window.auth;

    // Authentication
    signInAnonymously(auth).catch(err => console.error('Auth error:', err));
    
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.userId = user.uid;
            localStorage.setItem('userId', user.uid);
            setupEventListeners();
            checkAutoJoin();
        }
    });

    function setupEventListeners() {
        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.getAttribute('data-tab');
                window.activeTab = tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(`${tab}Tab`).classList.remove('hidden');
                
                if (tab === 'notifications') window.renderNotifications();
                if (tab === 'approvals') window.renderApprovals();
                if (tab === 'stats') window.renderStats();
                if (tab === 'main') window.renderMainContent();
            });
        });

        // Setup Panel (Create/Join)
        document.getElementById('createSessionBtn').addEventListener('click', () => {
            document.getElementById('sessionManagement').classList.add('hidden');
            document.getElementById('createSessionModal').classList.remove('hidden');
        });

        document.getElementById('joinSessionBtn').addEventListener('click', () => {
            document.getElementById('sessionManagement').classList.add('hidden');
            document.getElementById('joinSessionModal').classList.remove('hidden');
        });

        document.getElementById('confirmCreateSession').addEventListener('click', createNewSession);
    }

    async function createNewSession() {
        const adminName = document.getElementById('adminNameInput').value.trim();
        if (!adminName) {
            window.showToast('Lütfen isminizi girin', 'warning');
            return;
        }

        const sessionCode = window.generateSessionCode();
        const adminCode = window.generateAdminCode();
        const adminId = window.generateParticipantId();

        const session = {
            createdAt: Date.now(),
            adminUserId: window.userId,
            adminCode: adminCode,
            participants: {
                [adminId]: {
                    name: adminName,
                    gender: window.detectGenderFromName(adminName) || 'male',
                    userId: window.userId,
                    isActive: true,
                    isAdmin: true
                }
            }
        };

        try {
            await set(ref(db, `sessions/${sessionCode}`), session);
            window.currentSession = sessionCode;
            window.isAdmin = true;
            window.adminCode = adminCode;
            window.currentParticipantId = adminId;
            
            localStorage.setItem('currentSession', sessionCode);
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('adminCode', adminCode);
            localStorage.setItem('currentParticipantId', adminId);

            loadSession(sessionCode);
        } catch (error) {
            alert('Session creation error: ' + error.message);
        }
    }

    function checkAutoJoin() {
        if (window.currentSession) {
            loadSession(window.currentSession);
        }
    }

    window.loadSession = function(sessionCode) {
        const sessionRef = ref(db, `sessions/${sessionCode}`);
        window.isLoadingSession = true;
        window.showSessionInfo();
        
        document.getElementById('sessionManagement').classList.add('hidden');
        document.getElementById('tabNavigation').classList.remove('hidden');
        
        if (window.sessionListener) window.sessionListener();
        
        window.sessionListener = onValue(sessionRef, (snapshot) => {
            if (!snapshot.exists()) {
                window.showToast('Oturum sonlandırıldı', 'error');
                setTimeout(() => window.leaveSession(), 2000);
                return;
            }
            
            window.sessionData = snapshot.val();
            window.isLoadingSession = false;
            window.renderMainContent();
            window.updateNotificationCount();
            if (window.isAdmin) window.updateApprovalCount();
        });
    };

    window.leaveSession = function() {
        if (window.isAdmin) {
            if (!confirm('Yönetici olarak oturumdan ayrılıyorsunuz. Oturumu sonlandırmadınız, bu yüzden katılımcılar devam edebilir. Ayrılmak istediğinize emin misiniz?')) {
                return;
            }
        }
        localStorage.removeItem('currentSession');
        localStorage.removeItem('currentParticipantId');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('adminCode');
        window.location.reload();
    };

    // Firebase specific actions
    window.adjustDrink = async (pid, type, change) => {
        const currentQty = (window.sessionData.drinks?.[pid]?.[type]) || 0;
        const newQty = currentQty + change;
        const updates = {};
        if (newQty <= 0) {
            updates[`sessions/${window.currentSession}/drinks/${pid}/${type}`] = null;
        } else {
            updates[`sessions/${window.currentSession}/drinks/${pid}/${type}`] = newQty;
        }
        await update(ref(db), updates);
        window.showToast('Güncellendi', 'success');
    };

    window.deleteDrink = async (pid, type) => {
        if (!confirm('Silmek istediğinize emin misiniz?')) return;
        await update(ref(db), { [`sessions/${window.currentSession}/drinks/${pid}/${type}`]: null });
        window.showToast('Silindi', 'warning');
    };

    window.removeParticipant = async (pid) => {
        if (!confirm('Çıkarılsın mı?')) return;
        await update(ref(db), { [`sessions/${window.currentSession}/participants/${pid}/isActive`]: false });
    };

    window.toggleLeaveSession = async (pid) => {
        const p = window.sessionData.participants[pid];
        await update(ref(db), { [`sessions/${window.currentSession}/participants/${pid}/leftAt`]: p.leftAt ? null : Date.now() });
    };
    
    // Approval functions
    window.approveDeletion = async (id) => {
        const del = window.sessionData.pendingDeletions[id];
        const updates = {
            [`sessions/${window.currentSession}/drinks/${del.participantId}/${del.drinkType}`]: null,
            [`sessions/${window.currentSession}/pendingDeletions/${id}`]: null
        };
        await update(ref(db), updates);
    };
    
    window.rejectDeletion = async (id) => {
        await update(ref(db), { [`sessions/${window.currentSession}/pendingDeletions/${id}`]: null });
    };

    window.showQRCode = function() {
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = '';
        const url = `${window.location.origin}${window.location.pathname}?join=${window.currentSession}`;
        new QRCode(qrContainer, { text: url, width: 200, height: 200 });
        document.getElementById('qrCodeModal').classList.remove('hidden');
    };
    
    window.showAdminCode = function() {
        document.getElementById('showAdminCodeValue').textContent = window.adminCode;
        document.getElementById('showAdminCodeModal').classList.remove('hidden');
    };

    window.openAddParticipantModal = function() {
        document.getElementById('addParticipantSessionModal').classList.remove('hidden');
    };

    window.openAddFoodModal = function() {
        const list = document.getElementById('foodParticipantsCheckboxes');
        list.innerHTML = Object.entries(window.sessionData.participants)
            .filter(([pid, p]) => p.isActive && !p.leftAt)
            .map(([pid, p]) => `
                <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                    <input type="checkbox" name="foodParticipant" value="${pid}" checked style="width: 18px; height: 18px;">
                    <span style="color: white;">${p.name}</span>
                </label>
            `).join('');
        document.getElementById('addFoodModal').classList.remove('hidden');
    };

    window.showSessionSummary = function() {
        const participants = window.sessionData.participants || {};
        const drinks = window.sessionData.drinks || {};
        
        // Calculate totals
        let totalDrinks = 0;
        const participantSummary = [];
        
        Object.entries(participants).forEach(([pid, p]) => {
            if (!p.isActive) return;
            const pDrinks = drinks[pid] || {};
            let pTotal = 0;
            Object.values(pDrinks).forEach(q => pTotal += q);
            totalDrinks += pTotal;
            
            participantSummary.push({
                name: p.name,
                total: pTotal,
                promil: window.getDrunknessLevel(window.calculateTotalAlcohol(pid), pid).promille
            });
        });
        
        // Populate Modal
        document.getElementById('summaryStats').innerHTML = `
            <div style="text-align: center;"><div style="font-size: 20px; font-weight: bold;">${totalDrinks}</div><div style="font-size: 10px; color: #888;">TOPLAM İÇKİ</div></div>
            <div style="text-align: center;"><div style="font-size: 20px; font-weight: bold;">${Object.keys(participants).length}</div><div style="font-size: 10px; color: #888;">KATILIMCI</div></div>
        `;
        
        document.getElementById('summaryParticipants').innerHTML = participantSummary.map(p => `
            <div style="display: flex; justify-content: space-between; font-size: 14px;">
                <span>${p.name}</span>
                <span>${p.total} İçki (${p.promil.toFixed(2)}‰)</span>
            </div>
        `).join('');
        
        document.getElementById('sessionSummaryModal').classList.remove('hidden');
    };
};

// Start application
window.initApplication();
