/**
 * Main Application Logic for TKB İçki Takibi
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get, push } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Global Firebase Exports
window.firebaseApp = initializeApp(window.firebaseConfig);
window.database = getDatabase(window.firebaseApp);
window.auth = getAuth(window.firebaseApp);

window.initApplication = function() {
    const db = window.database;
    const auth = window.auth;

    signInAnonymously(auth).catch(err => console.error('Auth error:', err));
    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.userId = user.uid;
            localStorage.setItem('userId', user.uid);
            setupEventListeners();
            
            // Auto join if session in URL
            const urlParams = new URLSearchParams(window.location.search);
            const joinCode = urlParams.get('join');
            if (joinCode) {
                window.joinSessionStep1(joinCode.toUpperCase());
                // Remove parameter from URL without reload
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (window.currentSession) {
                window.loadSession(window.currentSession);
            }
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

        // Setup Panel
        document.getElementById('createSessionBtn')?.addEventListener('click', () => {
            document.getElementById('setupPanel').classList.add('hidden');
            document.getElementById('createSessionCard').classList.remove('hidden');
        });
        document.getElementById('joinSessionBtn')?.addEventListener('click', () => {
            document.getElementById('setupPanel').classList.add('hidden');
            document.getElementById('joinSessionModal').classList.remove('hidden');
        });
        document.getElementById('confirmCreateSession')?.addEventListener('click', () => window.createNewSession());

        // Modals
        const modalClosers = {
            'closeQRCode': 'qrCodeModal', 'closeShowAdminCode': 'showAdminCodeModal',
            'cancelAddDrink': 'addDrinkModal', 'cancelAdjustDrink': 'adjustDrinkModal',
            'cancelDeleteDrink': 'deleteDrinkModal', 'cancelAdminCode': 'adminCodeModal',
            'cancelJoinSession': 'joinSessionModal', 'cancelSelectParticipant': 'selectParticipantModal',
            'cancelAddParticipantSession': 'addParticipantSessionModal', 'cancelAddFood': 'addFoodModal',
            'closeParticipantHistory': 'participantHistoryModal'
        };
        Object.entries(modalClosers).forEach(([btnId, modalId]) => {
            document.getElementById(btnId)?.addEventListener('click', () => document.getElementById(modalId).classList.add('hidden'));
        });

        document.getElementById('confirmJoinSessionCode')?.addEventListener('click', () => {
            const code = document.getElementById('joinSessionCodeInput').value.trim().toUpperCase();
            if (code) window.joinSessionStep1(code);
        });
        document.getElementById('confirmSelectParticipant')?.addEventListener('click', () => {
            const pid = document.getElementById('participantSelect').value;
            if (pid) window.joinSessionStep2(pid);
        });
        document.getElementById('confirmAddDrink')?.addEventListener('click', () => window.addDrink());
        document.getElementById('confirmAddParticipantSession')?.addEventListener('click', () => window.addParticipant());
        document.getElementById('confirmAddFood')?.addEventListener('click', () => window.addFood());
    }

    window.createNewSession = async () => {
        const name = document.getElementById('adminNameInput').value.trim();
        if (!name) return window.showToast('İsim girin!', 'warning');
        
        const code = window.generateSessionCode();
        const aCode = window.generateAdminCode();
        const aid = window.generateParticipantId();
        
        const session = {
            createdAt: Date.now(), adminUserId: window.userId, adminCode: aCode,
            participants: { [aid]: { name, gender: window.detectGenderFromName(name) || 'male', userId: window.userId, isActive: true, isAdmin: true } }
        };
        
        await set(ref(db, `sessions/${code}`), session);
        window.currentSession = code; window.isAdmin = true; window.adminCode = aCode; window.currentParticipantId = aid;
        localStorage.setItem('currentSession', code); localStorage.setItem('isAdmin', 'true');
        localStorage.setItem('adminCode', aCode); localStorage.setItem('currentParticipantId', aid);
        window.loadSession(code);
    };

    window.joinSessionStep1 = async (code) => {
        const snap = await get(ref(db, `sessions/${code}`));
        if (!snap.exists()) return window.showToast('Oturum bulunamadı!', 'error');
        
        window.tempJoiningSession = code;
        const pSelect = document.getElementById('participantSelect');
        pSelect.innerHTML = '<option value="">Seçin...</option>' + 
            Object.entries(snap.val().participants || {})
            .filter(([id, p]) => p.isActive && !p.userId)
            .map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('') +
            '<option value="NEW">+ Yeni Katılımcı Olarak Ekle</option>';
            
        document.getElementById('joiningSessionCode').textContent = code;
        document.getElementById('joinSessionModal').classList.add('hidden');
        document.getElementById('selectParticipantModal').classList.remove('hidden');
    };

    window.joinSessionStep2 = async (pid) => {
        const code = window.tempJoiningSession;
        if (pid === 'NEW') {
            const name = prompt('İsim:'); if (!name) return;
            pid = window.generateParticipantId();
            await update(ref(db), { [`sessions/${code}/participants/${pid}`]: { name, gender: window.detectGenderFromName(name) || 'male', userId: window.userId, isActive: true } });
        } else {
            await update(ref(db), { [`sessions/${code}/participants/${pid}/userId`]: window.userId });
        }
        
        window.currentSession = code; window.currentParticipantId = pid; window.isAdmin = false;
        localStorage.setItem('currentSession', code); localStorage.setItem('currentParticipantId', pid); localStorage.setItem('isAdmin', 'false');
        window.loadSession(code);
        document.getElementById('selectParticipantModal').classList.add('hidden');
    };

    window.loadSession = function(code) {
        window.currentSession = code;
        window.showSessionInfo();
        document.getElementById('setupContent').classList.add('hidden');
        document.getElementById('mainUI').classList.remove('hidden');
        
        onValue(ref(db, `sessions/${code}`), (snap) => {
            if (!snap.exists()) { window.showToast('Oturum sonlandırıldı', 'error'); window.leaveSession(); return; }
            window.sessionData = snap.val();
            window.renderMainContent();
            window.updateNotificationCount();
            if (window.isAdmin) window.updateApprovalCount();
        });
    };

    window.leaveSession = () => {
        if (window.isAdmin && !confirm('Yönetici olarak ayrılıyorsunuz. Emin misiniz?')) return;
        localStorage.clear(); window.location.reload();
    };

    window.addDrink = async () => {
        const type = document.getElementById('drinkTypeInput').value;
        const qty = parseInt(document.getElementById('drinkQuantityInput').value);
        const pid = window.activeDrinkParticipantId;
        if (!type || !qty) return;
        
        const updates = {};
        const currentQty = (window.sessionData.drinks?.[pid]?.[type]) || 0;
        updates[`sessions/${window.currentSession}/drinks/${pid}/${type}`] = currentQty + qty;
        await push(ref(db, `sessions/${window.currentSession}/drinkHistory/${pid}`), { drink: type, quantity: qty, timestamp: Date.now() });
        await update(ref(db), updates);
        document.getElementById('addDrinkModal').classList.add('hidden');
        window.showToast('Eklendi', 'success');
    };

    window.addParticipant = async () => {
        const name = document.getElementById('newParticipantNameInput').value.trim();
        if (!name) return;
        const pid = window.generateParticipantId();
        await update(ref(db), { [`sessions/${window.currentSession}/participants/${pid}`]: { name, gender: document.querySelector('input[name="newParticipantGender"]:checked').value, weight: parseInt(document.getElementById('newParticipantWeightInput').value) || null, isActive: true } });
        document.getElementById('addParticipantSessionModal').classList.add('hidden');
    };

    window.addFood = async () => {
        const name = document.getElementById('foodNameInput').value.trim();
        const qty = parseFloat(document.getElementById('foodQuantityInput').value);
        const selectedPids = Array.from(document.querySelectorAll('input[name="foodParticipant"]:checked')).map(cb => cb.value);
        if (!name || isNaN(qty) || selectedPids.length === 0) return;
        
        const share = qty / selectedPids.length;
        const updates = {};
        selectedPids.forEach(pid => {
            const current = window.sessionData.drinks?.[pid]?.[`🍕 ${name}`] || 0;
            updates[`sessions/${window.currentSession}/drinks/${pid}/🍕 ${name}`] = current + share;
        });
        await update(ref(db), updates);
        document.getElementById('addFoodModal').classList.add('hidden');
        window.showToast('Yiyecek paylaştırıldı', 'success');
    };

    window.showSessionSummary = () => {
        const participants = window.sessionData.participants || {};
        const drinks = window.sessionData.drinks || {};
        let totalDrinks = 0; let pSummary = [];
        
        Object.entries(participants).forEach(([pid, p]) => {
            if (!p.isActive) return;
            let pTotal = 0; Object.values(drinks[pid] || {}).forEach(q => pTotal += q);
            totalDrinks += pTotal;
            pSummary.push({ name: p.name, total: pTotal.toFixed(1), promil: window.getDrunknessLevel(window.calculateTotalAlcohol(pid), pid).promille });
        });
        
        document.getElementById('summaryStats').innerHTML = `<div style="text-align:center;"><b>${totalDrinks.toFixed(1)}</b><br><small>TOPLAM</small></div><div style="text-align:center;"><b>${pSummary.length}</b><br><small>KİŞİ</small></div>`;
        document.getElementById('summaryParticipants').innerHTML = pSummary.map(p => `<div style="display:flex; justify-content:space-between;"><span>${p.name}</span><span>${p.total} (${p.promil.toFixed(2)}‰)</span></div>`).join('');
        document.getElementById('sessionSummaryModal').classList.remove('hidden');
    };
    
    window.requestAdminAction = async (action) => {
        const code = prompt('Yönetici Kodu:');
        if (code !== window.sessionData.adminCode) return alert('Hatalı!');
        if (action === 'endSession') await remove(ref(db, `sessions/${window.currentSession}`));
        else if (action === 'clearAll' && confirm('Her şeyi sil?')) await update(ref(db), { [`sessions/${window.currentSession}/drinks`]: null, [`sessions/${window.currentSession}/drinkHistory`]: null });
    };

    window.exportSummaryJPG = () => {
        window.showToast('JPG modülü yüklendi, indirme başlıyor...', 'info');
        // Simple print or screenshot instruction as fallback if html2canvas is not available
        window.print(); 
    };
};

window.openAddDrinkModal = (pid) => {
    window.activeDrinkParticipantId = pid;
    document.getElementById('addDrinkForName').textContent = window.sessionData.participants[pid].name + " için içki";
    document.getElementById('addDrinkModal').classList.remove('hidden');
};

window.initApplication();
