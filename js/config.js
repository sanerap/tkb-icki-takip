/**
 * Configuration and Global State
 */

// Firebase configuration
window.firebaseConfig = {
    apiKey: "AIzaSyCsBF5EkfzM-TomAcjN-vKbAAeUu8on4_U",
    authDomain: "drink-tracker-b7bc1.firebaseapp.com",
    databaseURL: "https://drink-tracker-b7bc1-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "drink-tracker-b7bc1",
    storageBucket: "drink-tracker-b7bc1.firebasestorage.app",
    messagingSenderId: "88411843150",
    appId: "1:88411843150:web:eb86e61187f2cae7b1311f"
};

// Global State
window.currentSession = localStorage.getItem('currentSession');
window.isAdmin = localStorage.getItem('isAdmin') === 'true';
window.adminCode = localStorage.getItem('adminCode');
window.userId = localStorage.getItem('userId');
window.currentParticipantId = localStorage.getItem('currentParticipantId');
window.activeTab = 'main';
window.isLoadingSession = true;
window.sessionListener = null;

window.sessionData = {
    participants: {},
    drinks: {},
    drinkTypes: [],
    drinkHistory: {},
    undoStack: [],
    notifications: {},
    pendingDeletions: {},
    pendingAdjustments: {},
    drinkIcons: {}
};

// Constants
window.PARTICIPANT_COLORS = [
    { bg: 'rgba(74, 144, 226, 0.12)', border: '#4a90e2', name: 'Mavi' },
    { bg: 'rgba(40, 167, 69, 0.12)', border: '#28a745', name: 'Yeşil' },
    { bg: 'rgba(255, 193, 7, 0.12)', border: '#ffc107', name: 'Sarı' },
    { bg: 'rgba(220, 53, 69, 0.12)', border: '#dc3545', name: 'Kırmızı' },
    { bg: 'rgba(138, 43, 226, 0.12)', border: '#8a2be2', name: 'Mor' },
    { bg: 'rgba(255, 152, 0, 0.12)', border: '#ff9800', name: 'Turuncu' },
    { bg: 'rgba(0, 188, 212, 0.12)', border: '#00bcd4', name: 'Camgöbeği' },
    { bg: 'rgba(233, 30, 99, 0.12)', border: '#e91e63', name: 'Pembe' }
];

window.DRINK_ICONS = {
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

window.ALCOHOL_CONTENT = {
    'bira': 20, 'beer': 20, 'efes': 20, 'tuborg': 20, 'bomonti': 20,
    'şarap': 14, 'wine': 14, 'kırmızı şarap': 14, 'beyaz şarap': 14,
    'rakı': 13, 'raki': 13, 'rak': 13, 'vodka': 13, 'votka': 13,
    'viski': 13, 'whisky': 13, 'whiskey': 13, 'bourbon': 13, 'scotch': 13,
    'gin': 13, 'cin': 13, 'rom': 13, 'rum': 13, 'tekila': 13, 'tequila': 13,
    'kokteyl': 18, 'cocktail': 18, 'mojito': 16, 'margarita': 18, 'martini': 20,
    'cin tonik': 16, 'vodka portakal': 16, 'şampanya': 14, 'champagne': 14,
    'prosecco': 14, 'shot': 13, 'jäger': 13, 'jager': 13, 'default': 15
};

window.TURKISH_NAMES = {
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
