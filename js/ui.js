/**
 * UI Rendering and Modal functions for İçki Takip
 */

// Toast notification
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';
    
    toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};

// Browser notification
window.showBrowserNotification = function(title, options) {
    if (Notification.permission === 'granted') {
        new Notification(title, options);
    }
};

// Play audio notification
window.playNotificationSound = function() {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.play().catch(e => console.log('Audio play blocked'));
};

const notificationManager = {
    playNotificationSound: window.playNotificationSound,
    showBrowserNotification: window.showBrowserNotification,
    showToast: window.showToast
};

// Notification count
window.updateNotificationCount = function() {
    const notifications = window.sessionData.notifications?.[window.userId] || {};
    const unreadCount = Object.values(notifications).filter(n => !n.read).length;
    const badge = document.getElementById('notificationBadge');
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

// Approval count
window.updateApprovalCount = function() {
    if (!window.isAdmin) return;
    
    const delCount = Object.keys(window.sessionData.pendingDeletions || {}).length;
    const adjCount = Object.keys(window.sessionData.pendingAdjustments || {}).length;
    const totalCount = delCount + adjCount;
    
    const badge = document.getElementById('approvalBadge');
    if (totalCount > 0) {
        badge.textContent = totalCount;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }
};

// Render Notifications
window.renderNotifications = function() {
    const notificationsContainer = document.getElementById('notificationsList');
    const notifications = window.sessionData.notifications?.[window.userId] || {};
    const sortedNotifications = Object.values(notifications).sort((a, b) => b.timestamp - a.timestamp);
    
    if (sortedNotifications.length === 0) {
        notificationsContainer.innerHTML = '<div class="empty-notifications">Henüz bildirim yok</div>';
        return;
    }
    
    notificationsContainer.innerHTML = sortedNotifications.map(n => `
        <div class="notification-item ${n.read ? 'read' : 'unread'}">
            <div style="font-size: 14px; color: #e0e0e0; margin-bottom: 4px;">${n.message}</div>
            <div style="font-size: 11px; color: #888;">${window.getTimeAgo(n.timestamp)}</div>
        </div>
    `).join('');
    
    // Mark as read
    setTimeout(async () => {
        const unreadIds = Object.keys(notifications).filter(id => !notifications[id].read);
        if (unreadIds.length > 0 && window.currentSession && window.userId) {
            const updates = {};
            unreadIds.forEach(id => {
                updates[`sessions/${window.currentSession}/notifications/${window.userId}/${id}/read`] = true;
            });
            if (window.firebaseUpdate) await window.firebaseUpdate(updates);
        }
    }, 2000);
};

// Render Approvals (Admin only)
window.renderApprovals = function() {
    const approvalsContainer = document.getElementById('approvalsList');
    const deletions = Object.entries(window.sessionData.pendingDeletions || {});
    const adjustments = Object.entries(window.sessionData.pendingAdjustments || {});
    
    if (deletions.length === 0 && adjustments.length === 0) {
        approvalsContainer.innerHTML = '<div class="empty-notifications">Bekleyen onay bulunmuyor</div>';
        return;
    }
    
    let html = '';
    
    deletions.forEach(([id, del]) => {
        html += `
            <div class="notification-item unread" style="border-left: 3px solid #dc3545;">
                <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Silme İsteği</div>
                <div style="font-size: 14px; color: #e0e0e0; margin-bottom: 8px;">
                    <strong>${del.participantName}</strong>, ${del.drinkType} içkisini silmek istiyor.
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-primary btn-success" onclick="window.approveDeletion('${id}')" style="flex: 1; padding: 6px; font-size: 12px;">Onayla</button>
                    <button class="btn-primary btn-danger" onclick="window.rejectDeletion('${id}')" style="flex: 1; padding: 6px; font-size: 12px;">Reddet</button>
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 8px;">${window.getTimeAgo(del.requestedAt)}</div>
            </div>`;
    });
    
    adjustments.forEach(([id, adj]) => {
        html += `
            <div class="notification-item unread" style="border-left: 3px solid #ffc107;">
                <div style="font-weight: 600; color: #fff; margin-bottom: 4px;">Azaltma İsteği</div>
                <div style="font-size: 14px; color: #e0e0e0; margin-bottom: 8px;">
                    <strong>${adj.participantName}</strong>, ${adj.drinkType} miktarını azaltmak istiyor.<br>
                    <span style="color: #ffc107;">${adj.currentQty} → ${adj.newQty}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-primary btn-success" onclick="window.approveAdjustment('${id}')" style="flex: 1; padding: 6px; font-size: 12px;">Onayla</button>
                    <button class="btn-primary btn-danger" onclick="window.rejectAdjustment('${id}')" style="flex: 1; padding: 6px; font-size: 12px;">Reddet</button>
                </div>
                <div style="font-size: 11px; color: #888; margin-top: 8px;">${window.getTimeAgo(adj.requestedAt)}</div>
            </div>`;
    });
    
    approvalsContainer.innerHTML = html;
};

// Render Stats
window.renderStats = function() {
    const container = document.getElementById('statsContainer');
    const participants = window.sessionData.participants || {};
    const drinks = window.sessionData.drinks || {};
    
    if (Object.keys(participants).length === 0) {
        container.innerHTML = '<div class="empty-state">İstatistik için katılımcı bekleniyor...</div>';
        return;
    }
    
    const participantStats = [];
    const drinkTotals = {};
    
    Object.entries(participants).forEach(([pid, p]) => {
        if (!p.isActive) return;
        const pDrinks = drinks[pid] || {};
        let pTotal = 0;
        Object.entries(pDrinks).forEach(([type, qty]) => {
            if (!type.includes("🍕")) {
                pTotal += qty;
                drinkTotals[type] = (drinkTotals[type] || 0) + qty;
            }
        });
        
        participantStats.push({ 
            name: p.name, 
            total: pTotal, 
            promil: window.getDrunknessLevel(window.calculateTotalAlcohol(pid), pid).promille
        });
    });
    
    participantStats.sort((a, b) => b.total - a.total);
    
    container.innerHTML = `
        <div class="stat-card">
            <h3 style="margin-top:0; border-bottom:1px solid #333; padding-bottom:10px;">🏆 Skor Tablosu</h3>
            ${participantStats.map((p, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="font-weight: 700; width: 20px; color: ${idx === 0 ? '#ffc107' : '#888'}">${idx + 1}.</span>
                        <span>${p.name}</span>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: 700;">${p.total} İçki</div>
                        <div style="font-size: 12px; color: #888;">${p.promil.toFixed(2)}‰ BAC</div>
                    </div>
                </div>`).join('')}
        </div>
        <div class="stat-card">
            <h3 style="margin-top: 0; border-bottom: 1px solid #333; padding-bottom: 10px;">📊 İçki Dağılımı</h3>
            <canvas id="drinksChart" style="max-height: 250px;"></canvas>
        </div>`;
    
    if (Object.keys(drinkTotals).length > 0 && typeof Chart !== 'undefined') {
        const ctx = document.getElementById('drinksChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(drinkTotals),
                    datasets: [{
                        data: Object.values(drinkTotals),
                        backgroundColor: ['#4a90e2', '#28a745', '#ffc107', '#dc3545', '#8a2be2', '#ff9800', '#00bcd4', '#e91e63'],
                        borderWidth: 0
                    }]
                },
                options: { plugins: { legend: { position: 'right', labels: { color: '#e0e0e0', font: { size: 10 } } } }, cutout: '70%' }
            });
        }
    }
};

window.renderMainContent = function() {
    const mainContent = document.getElementById('mainContent');
    const participants = window.sessionData.participants || {};
    
    if (window.isLoadingSession) {
        mainContent.innerHTML = `<div style="text-align: center; padding: 60px 20px; color: #b0b0b0;"><div style="font-size: 48px; margin-bottom: 20px;">⏳</div><div>Oturum yükleniyor...</div></div>`;
        return;
    }
    
    if (Object.keys(participants).length === 0) {
        mainContent.innerHTML = '<div class="empty-state">Henüz katılımcı yok. + Katılımcı Ekle butonuna tıklayın!</div>';
        return;
    }

    let html = '';
    const now = Date.now();
    let pEntries = Object.entries(participants).filter(([pid, p]) => p.isActive);
    
    if (window.isAdmin) {
        pEntries.sort((a, b) => a[1].name.localeCompare(b[1].name, 'tr'));
    } else {
        pEntries.sort((a, b) => {
            if (a[0] === window.currentParticipantId) return -1;
            if (b[0] === window.currentParticipantId) return 1;
            return a[1].name.localeCompare(b[1].name, 'tr');
        });
    }
    
    pEntries.forEach(([pid, participant]) => {
        const isSelf = pid === window.currentParticipantId;
        const needsAttention = window.checkIfNeedsAttention(pid, now);
        const stats = window.getParticipantStats(pid, now);
        const drinks = window.sessionData.drinks?.[pid] || {};
        const canEdit = window.isAdmin || isSelf;
        const pColor = window.getParticipantColor(pid);
        const drunkness = window.getDrunknessLevel(window.calculateTotalAlcohol(pid), pid);
        const promil = drunkness.promille;
        
        const statusBadge = `<span style="background: rgba(${drunkness.color === '#28a745' ? '40, 167, 69' : drunkness.color === '#4a90e2' ? '74, 144, 226' : '220, 53, 69'}, 0.2); color: ${drunkness.color}; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-left: 8px;">${drunkness.emoji} ${promil.toFixed(2)}‰</span>`;

        html += `
            <div class="participant-card ${needsAttention ? 'needs-attention' : ''}" style="background: ${pColor.bg}; border-left: 3px solid ${pColor.border}; opacity: ${participant.leftAt ? '0.6' : '1'};">
                <div class="participant-header">
                    <div>
                        <div class="participant-name ${isSelf ? 'self' : ''}">${participant.name}${isSelf ? ' (Ben)' : ''}${participant.leftAt ? ' <span class="attention-badge" style="background:#6c757d;">Ayrıldı</span>' : ''}${statusBadge}</div>
                        <div class="participant-info">${participant.gender === 'female' ? '♀️' : '♂️'} • ${participant.weight ? participant.weight + 'kg' : '~' + (participant.gender === 'female' ? '65kg' : '75kg')} • ${stats.lastDrinkTime} • ${stats.avgTimeInfo}</div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        ${needsAttention ? '<span class="attention-badge">⚠️ Kontrol Et</span>' : ''}
                        ${window.isAdmin ? `<button class="btn-icon btn-delete" onclick="window.removeParticipant('${pid}')">✕</button>` : ''}
                    </div>
                </div>
                <div class="drinks-container">
                    ${Object.entries(drinks).length > 0 ? Object.entries(drinks).map(([type, qty]) => {
                        const icon = window.getDrinkIcon(type);
                        return `<div class="drink-item"><div class="drink-info"><span class="drink-name">${type}: ${qty}</span><span class="drink-icons">${icon.repeat(Math.min(qty, 12))}</span></div>${canEdit ? `<div class="drink-actions"><button class="btn-icon" onclick="window.adjustDrink('${pid}', '${type}', -1)">−</button><button class="btn-icon" onclick="window.adjustDrink('${pid}', '${type}', 1)">+</button><button class="btn-icon" onclick="window.deleteDrink('${pid}', '${type}')">🗑️</button></div>` : ''}</div>`}).join('') : '<div class="empty-state">Henüz içki eklenmedi</div>'}
                </div>
                ${promil >= 0.5 ? `<div style="color: #ff9800; font-size: 12px; margin-top: 10px; padding: 8px; background: rgba(255, 152, 0, 0.1); border-radius: 6px; text-align: center;">🚫 ARAÇ KULLANMA!</div>` : ''}
                ${canEdit ? `<div style="display: flex; gap: 8px; margin-top: 10px;"><button class="btn-primary btn-success" onclick="window.openAddDrinkModal('${pid}')" style="flex: 1;">+ İçki Ekle</button><button class="btn-primary btn-secondary" onclick="window.showParticipantHistory('${pid}')" style="flex: 1;">Geçmiş</button></div><button class="btn-primary" onclick="window.toggleLeaveSession('${pid}')" style="width: 100%; height: 32px; background: ${participant.leftAt ? '#28a745' : '#dc3545'}; margin-top: 8px;">${participant.leftAt ? '↪ Masaya Dön' : '🚪 Masadan Ayrıl'}</button>` : `<button class="btn-primary btn-secondary" onclick="window.showParticipantHistory('${pid}')" style="width: 100%; margin-top: 10px;">İçki Geçmişi</button>`}
            </div>`;
    });

    if (window.isAdmin) {
        html += `<div style="margin-top: 20px; padding: 15px; background: rgba(220, 53, 69, 0.1); border: 1px solid #dc3545; border-radius: 8px; text-align: center;"><div style="color: #dc3545; font-weight: 600; font-size: 18px;">${window.currentSession}</div><div style="color: #dc3545;">👑 Yönetici</div></div><div class="admin-controls" style="margin-top: 10px;"><button class="btn-primary btn-success" onclick="window.openAddParticipantModal()" style="margin-bottom: 8px;">+ Katılımcı Ekle</button><button class="btn-primary" onclick="window.openAddFoodModal()" style="background:#e2a84a; color:#1a1a2e; margin-bottom:8px;">🍕 Ortak Yiyecek Ekle</button><button class="btn-primary btn-secondary" onclick="window.showAdminCode()">🔑 Yönetici Kodu</button></div><div style="margin-top:10px;"><button class="btn-primary" onclick="window.showQRCode()" style="width:100%;">📱 QR Kod Paylaş</button></div><div style="margin-top:10px; display:flex; gap:10px;"><button class="btn-primary" onclick="window.requestAdminAction('clearAll')" style="flex:1; background:#6c757d;">Tümünü Sil</button><button class="btn-primary btn-danger" onclick="window.showSessionSummary()" style="flex:2;">Oturumu Bitir</button></div>`;
    } else {
        html += `<div style="margin-top: 20px; padding: 15px; background: rgba(74, 144, 226, 0.1); border: 1px solid #4a90e2; border-radius: 8px; text-align: center;"><div style="color: #4a90e2; font-weight: 600; font-size: 18px;">${window.currentSession}</div><div style="color: #4a90e2;">${window.sessionData.participants[window.currentParticipantId]?.name || 'Katılımcı'}</div></div>
        <div style="margin-top:10px;">
            <button class="btn-primary" onclick="window.openAddFoodModal()" style="width:100%; background:#e2a84a; color:#1a1a2e; margin-bottom:10px;">🍕 Ortak Yiyecek Ekle</button>
            <button class="btn-primary" onclick="window.showQRCode()" style="width:100%; margin-bottom:10px;">📱 QR Kod Paylaş</button>
            <button class="btn-primary" onclick="window.showSessionSummary()" style="width:100%; background: #607d8b;">📊 Oturum Özeti (Dip Toplam)</button>
        </div>
        <button class="btn-primary btn-secondary" onclick="window.leaveSession()" style="margin-top:20px; width:100%;">Oturumdan Ayrıl</button>`;
    }
    
    mainContent.innerHTML = html;
};

window.showSessionInfo = function() {
    const sessionInfo = document.getElementById('sessionInfo');
    const sessionCodeHeader = document.getElementById('sessionCodeHeader');
    if (window.currentSession) {
        sessionCodeHeader.textContent = window.currentSession;
        sessionInfo.classList.remove('hidden');
    } else {
        sessionInfo.classList.add('hidden');
    }
};
