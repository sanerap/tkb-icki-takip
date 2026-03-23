/**
 * Main Application Logic for İçki Takip
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getDatabase, ref, onValue, set, update, remove, get, push } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

// Global Error Handlers to prevent silent crashes
window.addEventListener('error', (event) => {
    console.error('Kritik Hata (Global):', event.error);
    if(window.showToast) window.showToast(`Sistem Hatası: ${event.message}`, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
    console.error('Yakalanmayan Asenkron Hata:', event.reason);
    if(window.showToast) window.showToast(`Bağlantı/İşlem Hatası: ${event.reason?.message || 'Bilinmiyor'}`, 'error');
});

// Global Firebase Exports
window.firebaseApp = initializeApp(window.firebaseConfig);
window.database = getDatabase(window.firebaseApp);
window.auth = getAuth(window.firebaseApp);

window.initApplication = function() {
    const db = window.database;
    const auth = window.auth;

    signInAnonymously(auth).catch(err => console.error('Auth error:', err));
    
    // Connection Monitoring
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        const isConnected = snap.val();
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.style.display = isConnected === false ? 'block' : 'none';
        }
    });

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
                document.getElementById(`${tab}Tab`)?.classList.remove('hidden');
                
                if (tab === 'notifications') window.renderNotifications();
                if (tab === 'approvals') window.renderApprovals();
                if (tab === 'stats') window.renderStats();
                if (tab === 'main') window.renderMainContent();
            });
        });

        // Setup Panel (Create/Join)
        document.getElementById('createSessionBtn')?.addEventListener('click', () => {
            document.getElementById('sessionManagement').classList.add('hidden');
            document.getElementById('createSessionModal').classList.remove('hidden');
            window.tempParticipants = [];
            if (window.renderTempParticipants) window.renderTempParticipants();
        });

        document.getElementById('cancelCreateSession')?.addEventListener('click', () => {
            document.getElementById('createSessionModal').classList.add('hidden');
            document.getElementById('sessionManagement').classList.remove('hidden');
            window.tempParticipants = [];
            if (window.renderTempParticipants) window.renderTempParticipants();
        });

        document.getElementById('addParticipantBtn')?.addEventListener('click', () => {
            const nameInput = document.getElementById('participantNameInput');
            const name = nameInput.value.trim();
            const gender = document.querySelector('input[name="participantGender"]:checked')?.value || 'male';
            const weight = parseInt(document.getElementById('participantWeightInput').value) || null;
            
            if (!name) return window.showToast('Lütfen isim girin!', 'warning');
            if (name.length > 30) return window.showToast('İsim çok uzun!', 'warning');
            if (weight && (weight < 30 || weight > 250)) return window.showToast('Geçerli bir kilo girin!', 'warning');
            
            window.tempParticipants = window.tempParticipants || [];
            window.tempParticipants.push({
                id: window.generateParticipantId(),
                name, gender, weight
            });
            
            nameInput.value = '';
            document.getElementById('participantWeightInput').value = '';
            if (window.renderTempParticipants) window.renderTempParticipants();
        });

        document.getElementById('joinSessionBtn')?.addEventListener('click', () => {
            document.getElementById('sessionManagement').classList.add('hidden');
            document.getElementById('joinSessionModal').classList.remove('hidden');
        });
        document.getElementById('confirmCreateSession')?.addEventListener('click', function() { window.handleAsyncButton(this, window.createNewSession); });

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

        document.getElementById('confirmJoinSessionCode')?.addEventListener('click', function() {
            window.handleAsyncButton(this, async () => {
                const code = document.getElementById('joinSessionCodeInput').value.trim().toUpperCase();
                if (code) await window.joinSessionStep1(code);
            });
        });
        document.getElementById('confirmSelectParticipant')?.addEventListener('click', function() {
            window.handleAsyncButton(this, async () => {
                const pid = document.getElementById('participantSelect').value;
                if (pid) await window.joinSessionStep2(pid);
            });
        });
        document.getElementById('confirmAddDrink')?.addEventListener('click', function() { window.handleAsyncButton(this, window.addDrink); });
        document.getElementById('confirmAddParticipantSession')?.addEventListener('click', function() { window.handleAsyncButton(this, window.addParticipant); });
        document.getElementById('confirmAddFood')?.addEventListener('click', function() { window.handleAsyncButton(this, window.addFood); });

        // Global Enter key support for modals
        document.querySelectorAll('.modal input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const modal = input.closest('.modal');
                    if (modal) {
                        const btn = modal.querySelector('.modal-buttons .btn-primary:not(.btn-cancel)');
                        if (btn && !btn.disabled) btn.click();
                    }
                }
            });
        });
    }

    // Session Creation State
    window.tempParticipants = [];

    window.renderTempParticipants = function() {
        const list = document.getElementById('participantList');
        const btn = document.getElementById('confirmCreateSession');
        const adminGroup = document.getElementById('adminSelfSelectGroup');
        const adminSelect = document.getElementById('adminSelfSelect');
        
        if (!window.tempParticipants || window.tempParticipants.length === 0) {
            list.innerHTML = '<div class="empty-state" style="padding: 20px;">Henüz katılımcı eklenmedi</div>';
            btn.textContent = 'Oturumu Başlat (0 kişi)';
            adminGroup.style.display = 'none';
        } else {
            list.innerHTML = window.tempParticipants.map((p, index) => `
                <div style="display:flex; justify-content:space-between; align-items:center; padding: 10px; background: #1a2332; border-radius: 8px; margin-bottom: 5px;">
                    <div><span style="font-size: 16px;">${p.gender === 'female' ? '♀️' : '♂️'}</span> <strong style="color: #e0e0e0; margin-left: 5px;">${p.name}</strong> ${p.weight ? `<span style="color:#888; font-size: 12px; margin-left:5px;">(${p.weight}kg)</span>` : ''}</div>
                    <button class="btn-icon" onclick="window.removeTempParticipant(${index})" style="color:#dc3545; background:rgba(220,53,69,0.1); padding: 5px 10px; border-radius: 4px;">✕</button>
                </div>
            `).join('');
            
            btn.textContent = `Oturumu Başlat (${window.tempParticipants.length} kişi)`;
            adminGroup.style.display = 'block';
            
            // Preserve selection if possible
            const currentSelection = adminSelect.value;
            adminSelect.innerHTML = '<option value="">Seçiniz...</option>' + 
                window.tempParticipants.map(p => `<option value="${p.id}" ${currentSelection === p.id ? 'selected' : ''}>${p.name}</option>`).join('');
        }
    };

    window.removeTempParticipant = function(index) {
        window.tempParticipants.splice(index, 1);
        window.renderTempParticipants();
    };

    window.createNewSession = async () => {
        if (!window.tempParticipants || window.tempParticipants.length === 0) {
            return window.showToast('En az 1 kişi eklemelisiniz!', 'error');
        }
        
        const adminSelectId = document.getElementById('adminSelfSelect').value;
        if (!adminSelectId) {
            return window.showToast('Lütfen listeden kendinizi (Kurucu) seçiniz!', 'warning');
        }
        
        const code = window.generateSessionCode();
        const aCode = window.generateAdminCode();
        
        const participants = {};
        window.tempParticipants.forEach(p => {
            participants[p.id] = {
                name: p.name,
                gender: p.gender,
                weight: p.weight,
                isActive: true,
                isAdmin: p.id === adminSelectId,
                userId: p.id === adminSelectId ? window.userId : null
            };
        });
        
        const session = {
            createdAt: Date.now(),
            adminUserId: window.userId,
            adminCode: aCode,
            participants: participants
        };
        
        try {
            await set(ref(db, `sessions/${code}`), session);
            window.currentSession = code;
            window.isAdmin = true;
            window.adminCode = aCode;
            window.currentParticipantId = adminSelectId;
            
            localStorage.setItem('currentSession', code);
            localStorage.setItem('isAdmin', 'true');
            localStorage.setItem('adminCode', aCode);
            localStorage.setItem('currentParticipantId', adminSelectId);
            
            // Hide create session modal
            document.getElementById('createSessionModal')?.classList.add('hidden');
            window.tempParticipants = [];
            
            window.loadSession(code);
        } catch (error) {
            console.error('Session creation error:', error);
            window.showToast('Veritabanına yazılamadı. Bağlantı / API Kısıtlaması sorunu!', 'error');
        }
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
            const name = prompt('İsim (Maksimum 30 karakter):'); 
            if (!name) return;
            const cleanName = name.trim();
            if (cleanName.length === 0 || cleanName.length > 30) return window.showToast('Geçersiz veya çok uzun isim!', 'error');
            pid = window.generateParticipantId();
            await update(ref(db), { [`sessions/${code}/participants/${pid}`]: { name: cleanName, gender: window.detectGenderFromName(cleanName) || 'male', userId: window.userId, isActive: true } });
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
        document.getElementById('sessionManagement')?.classList.add('hidden');
        document.getElementById('tabNavigation')?.classList.remove('hidden');
        
        window.isLoadingSession = true;
        window.renderMainContent(); // Show the loading UI immediately
        
        onValue(ref(db, `sessions/${code}`), (snap) => {
            window.isLoadingSession = false;
            if (!snap.exists()) { window.showToast('Oturum sonlandırıldı veya silindi', 'warning'); window.leaveSession(true); return; }
            window.sessionData = snap.val();
            window.renderMainContent();
            window.updateNotificationCount();
            if (window.isAdmin) window.updateApprovalCount();
        }, (error) => {
            console.error('Firebase DB Error:', error);
            window.showToast('Veritabanına bağlanılamadı. API anahtarı veya yetki hatası!', 'error');
            // Revert UI partially to allow retry
            window.isLoadingSession = false;
            const mainContent = document.getElementById('mainContent');
            if (mainContent) mainContent.innerHTML = `<div class="empty-state">Bağlantı hatası: ${error.message}</div>`;
        });
    };

    window.leaveSession = (force = false) => {
        if (!force && window.isAdmin && !confirm('Yönetici olarak ayrılıyorsunuz. Emin misiniz?')) return;
        localStorage.clear(); window.location.reload();
    };

    window.addDrink = async () => {
        const type = document.getElementById('drinkTypeInput').value;
        const qty = parseInt(document.getElementById('drinkQuantityInput').value);
        const pid = window.activeDrinkParticipantId;
        if (!type || !qty) return window.showToast('Geçersiz içki veya miktar!', 'warning');
        if (type.length > 30) return window.showToast('İçki adı çok uzun!', 'warning');
        if (qty <= 0 || qty > 20) return window.showToast('Miktar 1 ile 20 arasında olmalı!', 'warning');
        
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
        const weight = parseInt(document.getElementById('newParticipantWeightInput').value) || null;
        if (!name) return window.showToast('Lütfen isim girin!', 'warning');
        if (name.length > 30) return window.showToast('İsim çok uzun!', 'warning');
        if (weight && (weight < 30 || weight > 250)) return window.showToast('Geçerli bir kilo girin!', 'warning');
        const pid = window.generateParticipantId();
        await update(ref(db), { [`sessions/${window.currentSession}/participants/${pid}`]: { name, gender: document.querySelector('input[name="newParticipantGender"]:checked').value, weight: weight, isActive: true } });
        document.getElementById('addParticipantSessionModal').classList.add('hidden');
    };

    window.addFood = async () => {
        const name = document.getElementById('foodNameInput').value.trim();
        const qty = parseFloat(document.getElementById('foodQuantityInput').value);
        const selectedPids = Array.from(document.querySelectorAll('input[name="foodParticipant"]:checked')).map(cb => cb.value);
        if (!name || isNaN(qty) || selectedPids.length === 0) return window.showToast('Geçersiz yiyecek, miktar veya kişi seçimi!', 'warning');
        if (name.length > 30) return window.showToast('Yiyecek adı çok uzun!', 'warning');
        if (qty <= 0 || qty > 50) return window.showToast('Miktar 0.5 ile 50 arasında olmalı!', 'warning');
        
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
        window.print(); 
    };

    window.showQRCode = function() {
        const qrContainer = document.getElementById('qrCodeContainer');
        qrContainer.innerHTML = '';
        const url = `${window.location.origin}${window.location.pathname}?join=${window.currentSession}`;
        new QRCode(qrContainer, { text: url, width: 200, height: 200 });
        document.getElementById('qrCodeModal')?.classList.remove('hidden');
    };
    
    window.showAdminCode = function() {
        document.getElementById('showAdminCodeValue').textContent = window.adminCode;
        document.getElementById('showAdminCodeModal')?.classList.remove('hidden');
    };

    window.openAddParticipantModal = function() {
        document.getElementById('addParticipantSessionModal')?.classList.remove('hidden');
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
        document.getElementById('addFoodModal')?.classList.remove('hidden');
    };
};

window.openAddDrinkModal = (pid) => {
    window.activeDrinkParticipantId = pid;
    document.getElementById('addDrinkForName').textContent = window.sessionData.participants[pid].name + " için içki";
    document.getElementById('addDrinkModal').classList.remove('hidden');
};

window.initApplication();
