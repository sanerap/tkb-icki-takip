/**
 * Utility functions for TKB İçki Takibi
 */

// Get participant color based on index
window.getParticipantColor = function(participantId) {
    const participantIds = Object.keys(window.sessionData.participants || {})
        .filter(id => window.sessionData.participants[id].isActive)
        .sort(); // Consistent order
    const index = participantIds.indexOf(participantId);
    return window.PARTICIPANT_COLORS[index % window.PARTICIPANT_COLORS.length];
};

// Get icon for drink type
window.getDrinkIcon = function(drinkType) {
    if (!drinkType) return '🍹';
    
    const lowerDrink = drinkType.toLowerCase();
    
    // Check custom icons first (stored in session)
    if (window.sessionData.drinkIcons && window.sessionData.drinkIcons[drinkType]) {
        return window.sessionData.drinkIcons[drinkType];
    }
    
    // Find matching icon
    for (const [icon, keywords] of Object.entries(window.DRINK_ICONS)) {
        if (keywords.some(keyword => lowerDrink.includes(keyword.toLowerCase()))) {
            return icon;
        }
    }
    
    return '🍹'; // Default icon
};

// Get alcohol content for drink type
window.getAlcoholContent = function(drinkType) {
    if (!drinkType) return window.ALCOHOL_CONTENT.default;
    
    const lowerDrink = drinkType.toLowerCase();
    
    if (window.ALCOHOL_CONTENT[lowerDrink]) {
        return window.ALCOHOL_CONTENT[lowerDrink];
    }
    
    for (const [key, value] of Object.entries(window.ALCOHOL_CONTENT)) {
        if (lowerDrink.includes(key) || key.includes(lowerDrink)) {
            return value;
        }
    }
    
    return window.ALCOHOL_CONTENT.default;
};

// Calculate total alcohol for a participant with time-based metabolism
window.calculateTotalAlcohol = function(participantId) {
    const history = window.sessionData.drinkHistory?.[participantId] || [];
    const currentDrinks = window.sessionData.drinks?.[participantId] || {};
    const hasDrinks = Object.keys(currentDrinks).length > 0;
    
    if (!hasDrinks || history.length === 0) return 0;
    
    const now = Date.now();
    let totalAlcohol = 0;
    const metabolismRate = 8; // grams per hour
    const absorptionTimeHours = 1.0;
    
    history.forEach(entry => {
        const alcoholGrams = window.getAlcoholContent(entry.drink) * entry.quantity;
        const hoursElapsed = (now - entry.timestamp) / 1000 / 60 / 60;
        const absorptionFactor = Math.min(1, hoursElapsed / absorptionTimeHours);
        const absorbedAlcohol = alcoholGrams * absorptionFactor;
        const metabolizedAlcohol = metabolismRate * hoursElapsed;
        const remainingAlcohol = Math.max(0, absorbedAlcohol - metabolizedAlcohol);
        totalAlcohol += remainingAlcohol;
    });
    
    return totalAlcohol;
};

// Convert grams to promille
window.gramsToPromille = function(alcoholGrams, participantId) {
    const participant = window.sessionData.participants[participantId];
    let bodyWeight = 75;
    let r = 0.68;
    
    if (participant) {
        bodyWeight = participant.weight || (participant.gender === 'female' ? 65 : 75);
        r = participant.gender === 'female' ? 0.55 : 0.68;
    }
    
    return alcoholGrams / (bodyWeight * r);
};

// Get drunkness level
window.getDrunknessLevel = function(alcoholGrams, participantId) {
    const promille = window.gramsToPromille(alcoholGrams, participantId);
    
    if (promille === 0) return { level: 'Ayık', emoji: '😐', color: '#28a745', promille };
    if (promille < 0.5) return { level: 'Hafif Neşeli', emoji: '🙂', color: '#4a90e2', promille };
    if (promille < 1.0) return { level: 'Neşeli', emoji: '😊', color: '#ffc107', promille };
    if (promille < 1.5) return { level: 'Çakırkeyif', emoji: '😁', color: '#ff9800', promille };
    if (promille < 2.0) return { level: 'Sarhoş', emoji: '😵', color: '#ff5722', promille };
    return { level: 'Çok Sarhoş', emoji: '🤮', color: '#dc3545', promille };
};

// Detect gender from Turkish name
window.detectGenderFromName = function(name) {
    if (!name) return null;
    const normalized = name.trim().toLowerCase()
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
        .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c');
    
    return window.TURKISH_NAMES[normalized] || null;
};

// Helper IDs and Codes
window.generateSessionCode = function() {
    const words = ['ASLAN', 'KARTAL', 'KURT', 'PARS', 'AYAK', 'DALGA', 'DENIZ', 'GUNES', 'YILDIZ', 'BULUT', 'FIRTINA', 'DAGLAR', 'ORMAN', 'GOKYUZU', 'RUZGAR'];
    const word = words[Math.floor(Math.random() * words.length)];
    const num = Math.floor(10 + Math.random() * 90);
    return `${word}${num}`;
};

window.generateAdminCode = function() {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

window.generateParticipantId = function() {
    return 'p_' + Math.random().toString(36).substr(2, 9);
};

// Time formatters
window.getTimeAgo = function(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Az önce';
    if (minutes < 60) return `${minutes} dakika önce`;
    if (hours < 24) return `${hours} saat önce`;
    return `${days} gün önce`;
};

window.getFormattedTime = function(timestamp) {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

// Attention checks
window.checkIfNeedsAttention = function(participantId, now) {
    const history = window.sessionData.drinkHistory?.[participantId] || [];
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
};

window.getParticipantStats = function(participantId, now) {
    const history = window.sessionData.drinkHistory?.[participantId] || [];
    if (history.length === 0) {
        return { lastDrinkTime: 'Son içki: -', avgTimeInfo: 'Ort. aralık: -' };
    }

    const sortedHistory = [...history].sort((a, b) => b.timestamp - a.timestamp);
    const lastDrink = sortedHistory[0];
    const timeSinceLast = Math.floor((now - lastDrink.timestamp) / 1000 / 60);
    let lastDrinkText = `Son içki: ${timeSinceLast}d önce`;

    if (history.length < 2) {
        return { lastDrinkTime: lastDrinkText, avgTimeInfo: 'Ort. aralık: -' };
    }

    const intervals = [];
    for (let i = 0; i < sortedHistory.length - 1; i++) {
        intervals.push((sortedHistory[i].timestamp - sortedHistory[i + 1].timestamp) / 1000 / 60);
    }
    const avgInterval = Math.floor(intervals.reduce((a, b) => a + b, 0) / intervals.length);

    return { lastDrinkTime: lastDrinkText, avgTimeInfo: `Ort. aralık: ${avgInterval}d` };
};
