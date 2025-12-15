// Game State
let socket;
let currentLobby = null;
let gameState = null;
let selectedAppearance = '👤';
let selectedColor = '#ef4444';
let colorsLocked = false;
let selectedProperty = null;
let availableLobbies = [];
let lobbiesRefreshInterval = null;
let isJoiningLobby = false;  // Prevent duplicate joins

// Music State
let backgroundAudio = null;
let isPlayingMusic = false;
let currentTrackIndex = 0;
let musicTracks = [];

// Initialize background music
function initializeBackgroundMusic() {
    if (backgroundAudio) return; // Prevent multiple initializations
    backgroundAudio = new Audio();
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0.2; // Higher volume for main menu
    backgroundAudio.src = '/music/music.mp3';
    backgroundAudio.preload = 'auto';
    loadMusicTracks();

    // Try to play immediately (may be blocked)
    const tryPlay = () => {
        backgroundAudio.play().then(() => {
            isPlayingMusic = true;
            console.log('Music started automatically');
        }).catch(e => {
            console.log('Auto-play blocked, waiting for user interaction:', e);
            isPlayingMusic = false;
            // Set up click-to-play for the whole document
            const startMusic = () => {
                backgroundAudio.play().then(() => {
                    isPlayingMusic = true;
                    document.removeEventListener('click', startMusic);
                    document.removeEventListener('keydown', startMusic);
                });
            };
            document.addEventListener('click', startMusic, { once: true });
            document.addEventListener('keydown', startMusic, { once: true });
        });
    };

    // Delay to ensure DOM is ready
    setTimeout(tryPlay, 100);
}

// Update music button state
function updateMusicButton() {
    const lobbyBtn = document.getElementById('musicToggleBtn');
    const gameBtn = document.getElementById('gameMusicToggleBtn');
    const text = isPlayingMusic ? '⏸ Durdur' : '▶ Çal';
    if (lobbyBtn) lobbyBtn.textContent = text;
    if (gameBtn) gameBtn.textContent = text;
}

// Load available music tracks
async function loadMusicTracks() {
    try {
        const response = await fetch('/music');
        // If this fails, we'll handle it gracefully
    } catch (e) {
        console.log('Music folder access: local playback only');
    }
}

// Toggle background music
function toggleBackgroundMusic() {
    const btn = document.getElementById('musicToggleBtn');
    if (!btn) return;
    
    if (isPlayingMusic) {
        pauseBackgroundMusic();
    } else {
        playBackgroundMusic();
    }
}

// Play background music
function playBackgroundMusic() {
    if (!backgroundAudio) initializeBackgroundMusic();
    backgroundAudio.play().catch(e => console.log('Play failed:', e));
    isPlayingMusic = true;
    updateMusicButton();
}

// Pause background music
function pauseBackgroundMusic() {
    if (backgroundAudio) backgroundAudio.pause();
    isPlayingMusic = false;
    updateMusicButton();
}

// Set music volume
function setMusicVolume(value) {
    const vol = parseInt(value) / 100;
    if (backgroundAudio) backgroundAudio.volume = vol;
    const percent = document.getElementById('volumePercent');
    if (percent) percent.textContent = value;
}

// Dark Mode Toggle
function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('light-mode');
    
    // Save preference to localStorage
    const isDarkMode = !body.classList.contains('light-mode');
    localStorage.setItem('darkMode', isDarkMode);
    
    // Update button icon
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
        btn.textContent = isDarkMode ? '🌙' : '☀️';
        btn.title = isDarkMode ? 'Işık modu aç' : 'Koyu modu aç';
    }
}

// Load dark mode preference on startup
function loadDarkModePreference() {
    const savedDarkMode = localStorage.getItem('darkMode');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDarkMode = savedDarkMode === null ? prefersDark : savedDarkMode === 'true';
    
    if (!isDarkMode) {
        document.body.classList.add('light-mode');
        const btn = document.getElementById('darkModeToggle');
        if (btn) {
            btn.textContent = '☀️';
            btn.title = 'Koyu modu aç';
        }
    } else {
        const btn = document.getElementById('darkModeToggle');
        if (btn) {
            btn.textContent = '🌙';
            btn.title = 'Işık modu aç';
        }
    }
}

// Call on load
window.addEventListener('DOMContentLoaded', loadDarkModePreference);

// Sound effect function using Web Audio API
function playSound(soundType) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;
        
        if (soundType === 'soundDice') {
            // Dice roll sound: ascending beeps
            for (let i = 0; i < 3; i++) {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = 400 + (i * 150);
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.3, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.1);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.1);
            }
        } else if (soundType === 'soundBuy') {
            // Buy sound: happy chime
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1000, now + 0.15);
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        }
    } catch (e) {
        console.log('Sound failed:', e);
    }
}

// Initialize background music system
initializeBackgroundMusic();

// Initialize Socket.IO
socket = io();

// Ensure lobbies appear on first load
socket.on('connect', () => {
    setTimeout(() => {
        socket.emit('getLobbies');
    }, 500);
});

// Socket Events
socket.on('lobbyCreated', (lobby) => {
    isJoiningLobby = false;  // Reset joining flag
    currentLobby = lobby;
    showScreen('gameScreen');
    updateLobbyUI();
    console.log('✅ Lobi oluşturuldu:', lobby.id);
    // Get available lobbies list
    socket.emit('getLobbies');
    // Show full lobby id immediately
    const idEl = document.getElementById('lobbyIdDisplay');
    const copyBtn = document.getElementById('copyLobbyIdBtn');
    if (idEl) idEl.textContent = `Lobi ID: ${lobby.id}`;
    if (copyBtn) copyBtn.style.display = 'block';
});

socket.on('lobbiesList', (lobbies) => {
    availableLobbies = lobbies;
    updateAvailableLobbiesList();
});

socket.on('errorMessage', (msg) => {
    isJoiningLobby = false;  // Reset flag on error
    addEvent(`⚠️ ${msg}`);
});

// Update player info in header when lobby updates
socket.on('lobbyUpdated', (lobby) => {
    isJoiningLobby = false;  // Reset joining flag
    currentLobby = lobby;
    
    // Show lobby screen if we just joined
    showScreen('gameScreen');
    updateLobbyUI();
    
    const playerCount = document.getElementById('playerCount');
    playerCount.textContent = `Oyuncu: ${lobby.players.length}/12`;
    
    // Update color selector based on used colors
    updateColorSelector(lobby.players);
    
    console.log('👥 Lobi güncellendi');
});

socket.on('gameStarted', (lobby) => {
    currentLobby = lobby;
    gameState = lobby;
    gameState.currentTradeOffer = null;  // Initialize trade offer tracking
    colorsLocked = true;
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';
    // Set initial turn display immediately
    const turnDisplay = document.getElementById('currentTurnDisplay');
    updateTurnDisplay();
    showGameBoard();
    
        // Hide game header when game starts
        const gameHeader = document.querySelector('.game-header');
        if (gameHeader) {
            gameHeader.classList.add('hidden');
        }
    
        // Hide color selector and setup panel
        const colorPanel = document.getElementById('colorSelectorPanel');
        const setupPanel = document.getElementById('setupPanel');
        if (colorPanel) colorPanel.style.display = 'none';
        if (setupPanel) setupPanel.style.display = 'none';
    const boardNameEl = document.getElementById('boardName');
    if (boardNameEl && lobby.boardName) {
        boardNameEl.textContent = `Tahta: ${lobby.boardName}`;
    }
    
    // Show bankruptcy button when game starts
    const bankruptBtn = document.getElementById('bankruptBtn');
    if (bankruptBtn) bankruptBtn.style.display = 'block';
    
    console.log('🎮 Oyun başladı!');
});

socket.on('diceRolled', (data) => {
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    const resultEl = document.getElementById('diceResult');
    const endTurnBtn = document.getElementById('endTurnBtn');

    // Animate single die
    dice1El.classList.add('rolling');
    dice2El.style.display = 'none'; // Hide second die

    setTimeout(() => {
        dice1El.textContent = data.dice1;
        // Remove the dice result text as requested
        resultEl.textContent = '';
        dice1El.classList.remove('rolling');
    }, 600);

    // Hide roll button after rolling
    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) {
        rollBtn.style.display = 'none';
    }

    const statusEl = document.getElementById('gameStatus');
    if (statusEl) statusEl.textContent = `${data.player.name} sırası`;

    // Zar mesajını göstermiyoruz artık, sadece önemli olaylar
    playSound('soundDice');

    // Update gameState with new position
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        gameState.players[playerIdx].position = data.newPosition;
        if (data.player.money !== undefined) {
            gameState.players[playerIdx].money = data.player.money;
        }
    }

    // Show GO passed message
    if (data.passedGo) {
        addEvent(`✨ ${data.player.name} BAŞLA'dan geçti ve ${data.currency}${data.goMoney} bonus para aldı!`, data.player.color);
        addBoardEvent(`${data.player.name} BAŞLA'dan geçti (+${data.currency}${data.goMoney})`);
    }

    // Show card message if chance/chest card
    if (data.cardMessage) {
        addEvent(`🎴 ${data.player.name}: ${data.cardMessage}`, data.player.color);
        addBoardEvent(`${data.player.name} ${data.cardMessage}`);
    }

    // Show tax message
    if (data.taxMessage) {
        addEvent(`💸 ${data.taxMessage}`, data.player.color);
        addBoardEvent(`${data.player.name} vergi ödedi`);
    }

    // Show rent message
    if (data.rentMessage) {
        addEvent(`🏠 ${data.rentMessage}`, data.player.color);
        addBoardEvent(data.rentMessage);
    }

    // Show special space messages
    if (data.specialMessage) {
        addEvent(data.specialMessage, data.player.color);
        addBoardEvent(`${data.player.name} özel alana geldi`);
    }

    // Animate player movement
    setTimeout(() => {
        updateGameBoard();
        updateGamePlayersPanel();
        updateTurnDisplay();
    }, 800);

    // Sıradaki oyuncu ben miyim?
    const isMyTurn = gameState.players[gameState.currentTurn]?.id === socket.id;
    console.log('🎲 Dice rolled - My turn?', isMyTurn);
    
    // Sadece sıradaki oyuncu sıra geçişini kontrol eder
    if (!isMyTurn) {
        console.log('⏭️ Not my turn, skipping auto-advance logic');
        return;
    }
    
    const landedOnBuyable = data.isBuyableProperty;
    const isSpecialSpace = data.isSpecialSpace;
    
    console.log('🎲 Landed on:', { landedOnBuyable, isSpecialSpace, spaceName: data.landedSpace?.name });

    if (landedOnBuyable) {
        // Satın alınabilir mülk - popup göster
        console.log('🏠 Showing property popup');
        setTimeout(() => {
            showPropertyPopup(data.landedSpace);
        }, 1400);
        
        // 15 saniye sonra otomatik kapat ve sırayı geçir
        setTimeout(() => {
            const popup = document.getElementById('propertyPopup');
            if (popup && popup.style.display !== 'none') {
                console.log('⏱️ Auto-closing property popup (15s timeout)');
                closePopup();
            }
        }, 15000);
    } else if (isSpecialSpace) {
        // Özel kare (vergi, şans, vs) - 3 saniye sonra otomatik sıra geçir
        console.log('⭐ Special space - auto advancing in 3s');
        setTimeout(() => {
            console.log('📤 Auto-advancing turn after special space');
            socket.emit('advanceTurn');
        }, 3000);
    } else {
        // Normal durum - 2 saniye sonra sırayı geçir
        console.log('🔄 Normal space - auto advancing in 2s');
        setTimeout(() => {
            console.log('📤 Auto-advancing turn');
            socket.emit('advanceTurn');
        }, 2000);
    }
});

socket.on('propertyBought', (data) => {
    console.log('🏠 Property bought:', data.property.name);
    
    // Sync local state with server payload
    const propIdx = gameState.properties.findIndex(p => p.id === data.property.id);
    if (propIdx >= 0) {
        gameState.properties[propIdx] = { ...gameState.properties[propIdx], owner: data.property.owner, ownerColor: data.property.ownerColor };
    }
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        gameState.players[playerIdx] = { ...gameState.players[playerIdx], ...data.player };
    }

    addEvent(`${data.player.name}, ${data.property.name} mülkünü satın aldı`, data.player.color);
    addBoardEvent(`${data.player.name} ${data.property.name} aldı`);
    playSound('soundBuy');
    updateGameBoard();
    updateOwnedProperties();
    updateGamePlayersPanel();
    closePopup();
    
    // Advance turn after property purchase
    if (gameState.players[gameState.currentTurn]?.id === socket.id) {
        setTimeout(() => {
            socket.emit('advanceTurn');
        }, 1500);
    }
});

socket.on('houseBuilt', (data) => {
    const propIdx = gameState.properties.findIndex(p => p.id === data.property.id);
    if (propIdx >= 0) {
        gameState.properties[propIdx].houses = data.property.houses;
    }
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        gameState.players[playerIdx].money = data.player.money;
    }

    addEvent(`🏠 ${data.message}`, data.player.color);
    playSound('soundBuy');
    updateGameBoard();
    updateOwnedProperties();
    updateGamePlayersPanel();
    
    // Refresh popup if open
    if (selectedProperty && selectedProperty.id === data.property.id) {
        showPropertyPopup(gameState.properties[propIdx]);
    }
});

socket.on('houseSold', (data) => {
    const propIdx = gameState.properties.findIndex(p => p.id === data.property.id);
    if (propIdx >= 0) {
        gameState.properties[propIdx].houses = data.property.houses;
    }
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        gameState.players[playerIdx].money = data.player.money;
    }

    addEvent(`💸 ${data.message}`, data.player.color);
    updateGameBoard();
    updateOwnedProperties();
    updateGamePlayersPanel();
    
    // Refresh popup if open
    if (selectedProperty && selectedProperty.id === data.property.id) {
        showPropertyPopup(gameState.properties[propIdx]);
    }
});

socket.on('turnEnded', (data) => {
    console.log('✅ Turn ended, new turn:', data.currentTurn);
    gameState.currentTurn = data.currentTurn;
    const currentPlayer = gameState.players[gameState.currentTurn];
    
    const gameStatus = document.getElementById('gameStatus');
    if (gameStatus) {
        gameStatus.textContent = `${currentPlayer.name} sırası`;
    }

    // Update board center turn display
    const turnDisplay = document.getElementById('currentTurnDisplay');
    if (turnDisplay) {
        updateTurnDisplay();
    }

    updateGameBoard();
    updateGamePlayersPanel();
    
    // Sıradaki oyuncu ben miyim?
    const isMyTurn = currentPlayer.id === socket.id;
    console.log('🎯 Is my turn?', isMyTurn, 'My ID:', socket.id, 'Current player:', currentPlayer.id);
    
    // Check if current player is in jail
    checkJailStatus();

    // Zar butonunu göster/gizle
    const rollBtn = document.getElementById('rollBtn');
    const isInJail = currentPlayer && currentPlayer.inJail;

    if (rollBtn) {
        if (isMyTurn && !isInJail) {
            rollBtn.style.display = 'block';
            rollBtn.disabled = false;
        } else {
            rollBtn.style.display = 'none';
            rollBtn.disabled = true;
        }
    }

    const diceResult = document.getElementById('diceResult');
    if (diceResult) diceResult.textContent = '';
    
    console.log(`✅ Sıra değişti: ${currentPlayer.name} (${data.currentTurn})`);
});

socket.on('messageReceived', (data) => {
    const chatDiv = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `
        <div class="chat-message-author">${data.appearance} ${data.playerName}</div>
        <div>${data.message}</div>
    `;
    chatDiv.appendChild(msgEl);
    chatDiv.scrollTop = chatDiv.scrollHeight;
});

socket.on('error', (message) => {
    alert('Hata: ' + message);
});

// UI Functions
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName).classList.add('active');

    // Auto-refresh lobbies on main menu
    if (screenName === 'mainMenu') {
        refreshLobbies();
        if (!lobbiesRefreshInterval) {
            lobbiesRefreshInterval = setInterval(refreshLobbies, 10000);
        }
    } else if (lobbiesRefreshInterval) {
        clearInterval(lobbiesRefreshInterval);
        lobbiesRefreshInterval = null;
    }
}

function selectAppearance(appearance) {
    selectedAppearance = appearance;
    document.querySelectorAll('.avatar-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.appearance === appearance);
    });
}

function selectColor(color) {
    selectedColor = color;
    document.querySelectorAll('.color-btn').forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.color === color);
    });
}

function showMenu() {
    showScreen('mainMenu');
    socket.emit('getLobbies');
}

function showJoinScreen() {
    showScreen('joinScreen');
}

function refreshLobbies() {
    socket.emit('getLobbies');
}

function updateAvailableLobbiesList() {
    const listEl = document.getElementById('lobbiesList');
    if (!listEl) return;
    
    if (!availableLobbies || availableLobbies.length === 0) {
        listEl.innerHTML = '<div style="color: rgba(255,255,255,0.6); font-size: 0.9em;">Aktif oyun yok</div>';
        return;
    }
    
    listEl.innerHTML = availableLobbies.map(lobby => `
        <div class="lobby-card">
            <div class="lobby-card__header">
                <div class="lobby-name">${lobby.hostName} odası</div>
                <span class="lobby-badge">${lobby.boardName || 'Tahta'}</span>
            </div>
            <div class="lobby-meta">
                <span>Oyuncu: ${lobby.playerCount}/12</span>
                <span>ID: ${lobby.id.slice(0, 6)}...</span>
            </div>
            <div class="lobby-actions">
                <button class="btn-mini" onclick="quickJoinLobby('${lobby.id}')">Hızlı Katıl</button>
                <button class="btn-ghost" onclick="copyLobbyId('${lobby.id}')">ID Kopyala</button>
            </div>
        </div>
    `).join('');
}

function copyLobbyId(id) {
    navigator.clipboard?.writeText(id).then(() => {
        alert('Lobi ID kopyalandı');
    }).catch(() => {
        alert('Kopyalama başarısız oldu');
    });
}

function copyCurrentLobbyId() {
    if (!currentLobby) return;
    copyLobbyId(currentLobby.id);
}

function quickJoinLobby(lobbyId) {
    // Prevent duplicate joins
    if (isJoiningLobby) {
        console.log('⏳ Zaten lobiye katılıyor, lütfen bekle...');
        return;
    }
    
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('İsmini yazmalısın');
        return;
    }
    
    isJoiningLobby = true;
    socket.emit('joinLobby', {
        lobbyId,
        playerName,
        appearance: selectedAppearance,
        color: selectedColor
    });
}

function joinRandomLobby() {
    // Prevent duplicate joins
    if (isJoiningLobby) {
        console.log('⏳ Zaten lobiye katılıyor, lütfen bekle...');
        return;
    }
    
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('İsmini yazmalısın');
        return;
    }
    // Ensure fresh list then pick
    refreshLobbies();
    const list = (availableLobbies || []).filter(l => !l.started && l.playerCount < 12);
    if (list.length === 0) {
        alert('Aktif katılınabilir oyun yok. Yeni oyun oluşturabilirsin.');
        return;
    }
    const random = list[Math.floor(Math.random() * list.length)];
    quickJoinLobby(random.id);
}

function createLobby() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    const boardKey = document.getElementById('boardSelect')?.value || 'turkiye';
    if (!playerName) {
        alert('İsmini yazmalısın');
        return;
    }
    socket.emit('createLobby', {
        playerName,
        appearance: selectedAppearance,
        color: selectedColor,
        boardKey
    });
}

function joinLobby() {
    if (isJoiningLobby) {
        console.log('⏳ Zaten lobiye katılıyor, lütfen bekle...');
        return;
    }
    
    const lobbyId = document.getElementById('lobbyIdInput').value.trim();
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName || !lobbyId) {
        alert('İsim ve lobi ID yazmalısın');
        return;
    }
    
    isJoiningLobby = true;
    socket.emit('joinLobby', {
        lobbyId,
        playerName,
        appearance: selectedAppearance,
        color: selectedColor
    });
    showScreen('gameScreen');
}

function leaveGame() {
    location.reload();
}

function updateLobbyUI() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';

    currentLobby.players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        const isHost = player.id === currentLobby.host;
        const isMe = player.id === socket.id;
        div.innerHTML = `
            <div class="player-appearance">${player.appearance}</div>
            <div class="player-info">
                <div class="player-name">${player.name}${isHost ? ' 👑' : ''}${isMe ? ' (Sen)' : ''}</div>
                <div class="player-money">💰 ₺${player.money}</div>
            </div>
            <div style="width: 14px; height: 14px; background: ${player.color}; border-radius: 50%; border: 2px solid white;"></div>
        `;
        playersList.appendChild(div);
    });

    const playerCount = document.getElementById('playerCount');
    playerCount.textContent = `Oyuncu: ${currentLobby.players.length}/12`;

    const boardNameEl = document.getElementById('boardName');
    if (boardNameEl && currentLobby.boardName) {
        boardNameEl.textContent = `Tahta: ${currentLobby.boardName}`;
    }

    // Show lobby ID + copy button
    const idEl = document.getElementById('lobbyIdDisplay');
    const copyBtn = document.getElementById('copyLobbyIdBtn');
    if (idEl) idEl.textContent = `Lobi ID: ${currentLobby.id}`;
    if (copyBtn) copyBtn.style.display = 'block';

    if (currentLobby.started) {
        colorsLocked = true;
    }

    const colorPanel = document.getElementById('colorSelectorPanel');
    if (colorPanel) {
        colorPanel.style.display = currentLobby.started ? 'none' : 'block';
    }

    const startBtn = document.getElementById('startBtn');
    if (currentLobby.host === socket.id && !currentLobby.started) {
        startBtn.style.display = 'block';
        startBtn.disabled = currentLobby.players.length < 1;
    } else if (startBtn) {
        startBtn.style.display = 'none';
    }

    // Show setup panel only to host
    const setupPanel = document.getElementById('setupPanel');
    if (setupPanel) {
        setupPanel.style.display = (currentLobby.host === socket.id && !currentLobby.started) ? 'block' : 'none';
    }

    // Hide game UI elements if game hasn't started
    if (!currentLobby.started) {
        const ownedSection = document.querySelector('.owned-section');
        if (ownedSection) ownedSection.style.display = 'none';

        const chatSection = document.querySelector('.chat-section');
        if (chatSection) chatSection.style.display = 'none';

        const eventsSection = document.querySelector('.events-section');
        if (eventsSection) eventsSection.style.display = 'none';

        const tradeSection = document.querySelector('.trade-section');
        if (tradeSection) tradeSection.style.display = 'none';

        const diceDisplay = document.querySelector('.dice-display');
        if (diceDisplay) diceDisplay.style.display = 'none';

        const rollBtn = document.getElementById('rollBtn');
        if (rollBtn) rollBtn.style.display = 'none';

        // Roll button will be hidden since player is in jail

        const gameMusicControl = document.querySelector('.game-music-control');
        if (gameMusicControl) gameMusicControl.style.display = 'none';
    }
}

function updateGamePlayersPanel() {
    const playersList = document.getElementById('playersList');
    if (!playersList || !gameState) return;
    playersList.innerHTML = '';

    gameState.players.forEach((player, idx) => {
        const div = document.createElement('div');
        div.className = 'player-item' + (idx === gameState.currentTurn ? ' current-turn' : '');
        const isHost = currentLobby && player.id === currentLobby.host;
        const isMe = player.id === socket.id;
        div.innerHTML = `
            <div class="player-appearance">${player.appearance}</div>
            <div class="player-info">
                <div class="player-name">${player.name}${isHost ? ' 👑' : ''}${isMe ? ' (Sen)' : ''}</div>
                <div class="player-money">💰 ₺${player.money}</div>
            </div>
            <div style="width: 14px; height: 14px; background: ${player.color}; border-radius: 50%; border: 2px solid white;"></div>
        `;
        playersList.appendChild(div);
    });

    const playerCount = document.getElementById('playerCount');
    if (playerCount) playerCount.textContent = `Oyuncu: ${gameState.players.length}/12`;
}

function startGame() {
    const rules = {
        initialMoney: parseInt(document.getElementById('initialMoneySlider')?.value) || 2000,
        taxFree: document.getElementById('ruleTaxFree')?.checked || false,
        goMoney: parseInt(document.getElementById('goMoneySlider')?.value) || 200
    };
    socket.emit('startGame', { rules });
}

function updateRules() {
    // Update rules locally
}

function updateInitialMoney() {
    const value = document.getElementById('initialMoneySlider')?.value || 2000;
    document.getElementById('initialMoney').textContent = value;
}

function updateGoMoney() {
    const value = document.getElementById('goMoneySlider')?.value || 200;
    document.getElementById('goMoney').textContent = value;
}

    function updateHouseMultiplier() {
        const value = document.getElementById('houseMultiplierSlider')?.value || 0.5;
        document.getElementById('houseMultiplier').textContent = value;
    }

    function updateTurnTimeLimit() {
        const value = document.getElementById('turnTimeLimitSlider')?.value || 60;
        document.getElementById('turnTimeLimit').textContent = value;
    }

    function selectColorLobby(color) {
            if (colorsLocked) return;
        selectedColor = color;
        document.querySelectorAll('.color-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.dataset.color === color);
        });
        // Update player color on server
        if (currentLobby) {
            socket.emit('updatePlayer', { color });
        }
    }

    function updateColorSelector(players) {
            const shouldLock = colorsLocked || (currentLobby && currentLobby.started);
        const usedColors = players.map(p => p.color);
        document.querySelectorAll('.color-btn-large').forEach(btn => {
            const color = btn.dataset.color;
            const isTaken = usedColors.includes(color) && color !== selectedColor;
            const takenBy = isTaken ? players.find(p => p.color === color)?.name : '';

            btn.classList.toggle('taken', isTaken);
            if (isTaken) {
                btn.setAttribute('data-taken-by', takenBy);
            } else {
                btn.removeAttribute('data-taken-by');
            }

            btn.disabled = isTaken || shouldLock;
            btn.style.opacity = (isTaken || shouldLock) ? '0.35' : '1';
            btn.style.cursor = (isTaken || shouldLock) ? 'not-allowed' : 'pointer';
        });
    }

function showGameBoard() {
    // Hide setup panel
    const setupPanel = document.getElementById('setupPanel');
    if (setupPanel) setupPanel.style.display = 'none';

    // Hide start button once the board is active
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';

    // Hide color selector when the match is live
    const colorPanel = document.getElementById('colorSelectorPanel');
    if (colorPanel) colorPanel.style.display = 'none';

    // Show trade panel
    const tradeSection = document.querySelector('.trade-section');
    if (tradeSection) tradeSection.style.display = 'block';

    // Show game UI elements
    const ownedSection = document.querySelector('.owned-section');
    if (ownedSection) ownedSection.style.display = 'block';

    const chatSection = document.querySelector('.chat-section');
    if (chatSection) chatSection.style.display = 'block';

    // Remove events section completely when game starts
    const eventsSection = document.querySelector('.events-section');
    if (eventsSection) eventsSection.style.display = 'none';

    const diceDisplay = document.querySelector('.dice-display');
    if (diceDisplay) diceDisplay.style.display = 'block';

    // Show roll button (auto-turn advancement handled by server)
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.style.display = 'block';
    rollBtn.disabled = gameState.players[gameState.currentTurn].id !== socket.id;

    // Show game music control
    const gameMusicControl = document.querySelector('.game-music-control');
    if (gameMusicControl) gameMusicControl.style.display = 'block';

    // Initialize board
    initializeBoard();
    updateGameBoard();
    updateGamePlayersPanel();
    updateOwnedProperties();

    // Update game status
    const gameStatus = document.getElementById('gameStatus');
    const currentPlayer = gameState.players[gameState.currentTurn];
    gameStatus.textContent = `${currentPlayer.name} oynuyor`;
    updateTurnDisplay();

    // Add game started event
    addEvent('🎮 Oyun başladı!');
}

function updateTurnDisplay() {
    const turnDisplay = document.getElementById('currentTurnDisplay');
    if (!turnDisplay || !gameState || !gameState.players?.length) return;
    const cp = gameState.players[gameState.currentTurn];
    const dot = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${cp.color};border:1px solid #fff"></span>`;
    turnDisplay.innerHTML = `${dot} Sıra: ${cp.appearance} ${cp.name}`;
}

function initializeBoard() {
    const board = document.getElementById('monopolyBoard');
    board.innerHTML = '';

    gameState.properties.forEach((prop, index) => {
        const space = document.createElement('div');
        space.className = 'board-space';

        // Add color class for properties
        if (prop.color) {
            space.classList.add(prop.color);
        }

        if (prop.type === 'go' || prop.type === 'jail' || prop.type === 'parking' || prop.type === 'gotojail') {
            space.classList.add('corner');
        } else if (prop.type === 'property') {
            space.classList.add('property');
        }

        space.dataset.id = index;
        
        // Add group icon for color properties and special spaces
        let groupIcon = '';
        if (prop.color === 'brown') groupIcon = '🟫';
        else if (prop.color === 'lightblue') groupIcon = '🟦';
        else if (prop.color === 'pink') groupIcon = '🟪';
        else if (prop.color === 'orange') groupIcon = '🟧';
        else if (prop.color === 'red') groupIcon = '🟥';
        else if (prop.color === 'yellow') groupIcon = '🟨';
        else if (prop.color === 'green') groupIcon = '🟩';
        else if (prop.color === 'darkblue') groupIcon = '🟦';
        else if (prop.type === 'railroad') groupIcon = '🚂';
        else if (prop.type === 'utility') groupIcon = '💡';
        else if (prop.type === 'go') groupIcon = '🎯';
        else if (prop.type === 'jail') groupIcon = '👮';
        else if (prop.type === 'parking') groupIcon = '🅿️';
        else if (prop.type === 'gotojail') groupIcon = '🚔';
        else if (prop.type === 'chance') groupIcon = '❓';
        else if (prop.type === 'chest') groupIcon = '📦';
        else if (prop.type === 'tax') groupIcon = '💸';
        
        let houseIndicator = '';
        if (prop.houses > 0) {
            if (prop.houses === 5) {
                houseIndicator = '<div class="house-indicator">🏨</div>';
            } else {
                houseIndicator = `<div class="house-indicator">${'🏠'.repeat(prop.houses)}</div>`;
            }
        }
        
        const groupLabel = prop.group ? `<div class="space-group">${prop.group}</div>` : '';
        space.innerHTML = `<div class="space-name">${groupIcon} ${prop.name}</div>${groupLabel}${prop.price > 0 ? `<div class="space-price">₺${prop.price}</div>` : ''}${houseIndicator}`;

        board.appendChild(space);
    });

    // Arrange spaces in board grid
    arrangeBoardSpaces();
}

function arrangeBoardSpaces() {
    const spaces = document.querySelectorAll('.board-space');
    const positions = [
        // Bottom row (0-9)
        { col: 11, row: 11 }, // 0 - GO
        { col: 10, row: 11 }, { col: 9, row: 11 }, { col: 8, row: 11 },
        { col: 7, row: 11 }, { col: 6, row: 11 }, { col: 5, row: 11 },
        { col: 4, row: 11 }, { col: 3, row: 11 }, { col: 2, row: 11 },
        // Left column (10-19)
        { col: 1, row: 11 }, // 10 - Jail
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 },
        { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 },
        { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 },
        // Top row (20-29)
        { col: 1, row: 1 }, // 20 - Free Parking
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 },
        { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        { col: 8, row: 1 }, { col: 9, row: 1 }, { col: 10, row: 1 },
        // Right column (30-39)
        { col: 11, row: 1 }, // 30 - Go to Jail
        { col: 11, row: 2 }, { col: 11, row: 3 }, { col: 11, row: 4 },
        { col: 11, row: 5 }, { col: 11, row: 6 }, { col: 11, row: 7 },
        { col: 11, row: 8 }, { col: 11, row: 9 }, { col: 11, row: 10 }
    ];

    spaces.forEach((space, i) => {
        if (positions[i]) {
            space.style.gridColumn = positions[i].col;
            space.style.gridRow = positions[i].row;
        }
    });
}

function animatePlayerMove(playerId, newPosition) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Update gameState position
    gameState.players.find(p => p.id === playerId).position = newPosition;
    
    // Animate the move
    const startSpace = document.querySelector(`.board-space[data-id="${player.position}"]`);
    const endSpace = document.querySelector(`.board-space[data-id="${newPosition}"]`);
    
    if (startSpace && endSpace) {
        const token = startSpace.querySelector(`.player-token[style*="${player.color}"]`);
        if (token) {
            token.classList.add('moving');
            setTimeout(() => {
                token.classList.remove('moving');
                updateGameBoard();
            }, 600);
        }
    }
}

function updateGameBoard() {
    // Update player positions on board
    const spaces = document.querySelectorAll('.board-space');
    const currentPlayer = gameState.players[gameState.currentTurn];
    const isMyTurn = currentPlayer && currentPlayer.id === socket.id;
    
    // Add click handlers to spaces for property info - view-only popup for others
    spaces.forEach((space, index) => {
        const prop = gameState.properties[index];
        space.onclick = () => {
            if (!prop) return;
            // Don't allow clicking on corner/special spaces
            if (prop.type === 'go' || prop.type === 'jail' || prop.type === 'parking' || prop.type === 'gotojail' ||
                prop.type === 'chance' || prop.type === 'chest' || prop.type === 'tax') {
                return;
            }
            const iAmOwner = prop.owner === socket.id;
            const iAmOnThisSpace = isMyTurn && currentPlayer.position === index;
            if (iAmOwner || iAmOnThisSpace) {
                showPropertyPopup(prop);
            } else {
                showReadOnlyProperty(prop);
            }
        };
        const iAmOwner2 = prop && prop.owner === socket.id;
        const iAmOnThisSpace2 = isMyTurn && currentPlayer && currentPlayer.position === index;
        const isSpecialSpace = prop && (prop.type === 'go' || prop.type === 'jail' || prop.type === 'parking' ||
                              prop.type === 'gotojail' || prop.type === 'chance' || prop.type === 'chest' || prop.type === 'tax');
        space.style.cursor = isSpecialSpace ? 'default' : ((iAmOwner2 || iAmOnThisSpace2) ? 'pointer' : 'help');
    });
    
    spaces.forEach(space => {
        const playerTokens = space.querySelectorAll('.player-token');
        playerTokens.forEach(token => token.remove());
    });

    gameState.players.forEach((player, index) => {
        const space = document.querySelector(`.board-space[data-id="${player.position}"]`);
        if (space) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.background = player.color;
            token.style.borderColor = player.color;
            token.title = player.name;
            token.textContent = (player.name || '?').charAt(0).toUpperCase();
            space.appendChild(token);
        }
    });

    // Update property ownership indicators with owner color and initials
    spaces.forEach(space => {
        const propIndex = parseInt(space.dataset.id);
        const prop = gameState.properties[propIndex];
        
        // Remove existing owner badge
        const existingBadge = space.querySelector('.owner-badge');
        if (existingBadge) existingBadge.remove();
        
        if (prop.owner) {
            const owner = gameState.players.find(p => p.id === prop.owner);
            space.classList.add('owned');
            space.style.opacity = '1';
            // Use owner's color for the border instead of property color
            space.style.borderBottom = `4px solid ${owner.color}`;
            space.style.background = `linear-gradient(150deg, rgba(15, 23, 42, 0.9), ${owner.color}30)`;
            space.style.boxShadow = `0 4px 14px ${owner.color}55, 0 0 0 2px ${owner.color}55 inset`;
        } else {
            space.classList.remove('owned');
            space.style.opacity = '1';
            space.style.borderBottom = 'none';
            space.style.background = '';
            space.style.boxShadow = '';
        }
    });

    // Update current player highlight
    const activePlayer = gameState.players[gameState.currentTurn];
    const playersList = document.getElementById('playersList');
    const playerItems = playersList.querySelectorAll('.player-item');
    playerItems.forEach((item, i) => {
        item.classList.toggle('current-turn', i === gameState.currentTurn);
    });

    // Update trade dropdown
    const tradeSelect = document.getElementById('tradeWithPlayer');
    tradeSelect.innerHTML = '<option>Oyuncu seç...</option>';
    gameState.players.forEach(player => {
        if (player.id !== socket.id) {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.appearance} ${player.name}`;
            tradeSelect.appendChild(option);
        }
    });

    updateOwnedProperties();
}

function updateOwnedProperties() {
    const listEl = document.getElementById('ownedPropertiesList');
    if (!listEl || !gameState) return;

    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) {
        listEl.innerHTML = '';
        return;
    }

    if (!me.properties || me.properties.length === 0) {
        listEl.innerHTML = '<div class="empty-state">Henüz mülkün yok</div>';
        return;
    }

    listEl.innerHTML = '';
    me.properties.forEach(id => {
        const prop = gameState.properties.find(p => p.id === id);
        if (!prop) return;
        
        const item = document.createElement('div');
        item.className = 'owned-item';
        
        const colorDot = prop.color ? `<span class="prop-dot" style="background:${prop.color}"></span>` : '<span class="prop-dot" style="background: #94a3b8"></span>';
        const rentText = prop.rent && prop.rent.length ? `Kira: ₺${prop.rent[0]}` : 'Kira: -';
        const priceText = prop.price ? `₺${prop.price}` : '-';
        
        item.innerHTML = `
            ${colorDot}
            <div class="owned-info">
                <div class="owned-name">${prop.name}</div>
                <div class="owned-meta">${priceText} • ${rentText}</div>
            </div>
        `;
        
        // Add click handler to open property popup
        item.onclick = () => showPropertyPopup(prop);
        
        listEl.appendChild(item);
    });
}

function refreshTradeLists() {
    const targetId = document.getElementById('tradeWithPlayer')?.value;
    const myList = document.getElementById('myPropsForTrade');
    const theirList = document.getElementById('theirPropsForTrade');
    const proposeBtn = document.getElementById('btnProposeTrade');
    if (!myList || !theirList) return;

    const me = gameState.players.find(p => p.id === socket.id);
    myList.innerHTML = '';
    if (me && me.properties && me.properties.length > 0) {
        me.properties.forEach(id => {
            const prop = gameState.properties[id];
            if (!prop) return;
            const el = document.createElement('label');
            el.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                padding: 8px 10px;
                background: linear-gradient(90deg, ${prop.color}33, transparent);
                border-left: 4px solid ${prop.color};
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            el.innerHTML = `
                <input type="checkbox" class="my-prop" value="${prop.id}" style="cursor: pointer;">
                <span style="color: ${prop.color}; font-weight: 600;">${prop.name}</span>
            `;
            el.addEventListener('mouseenter', () => {
                el.style.background = `linear-gradient(90deg, ${prop.color}55, transparent)`;
                el.style.transform = 'translateX(3px)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.background = `linear-gradient(90deg, ${prop.color}33, transparent)`;
                el.style.transform = 'translateX(0)';
            });
            myList.appendChild(el);
        });
    } else {
        myList.innerHTML = '<p style="color: #94a3b8; font-style: italic; padding: 10px;">Henüz mülkün yok</p>';
    }

    theirList.innerHTML = '';
    const other = gameState.players.find(p => p.id === targetId);
    if (!targetId || targetId === 'Oyuncu seç...') {
        theirList.innerHTML = '<p style="color: #94a3b8; font-style: italic; padding: 10px;">Önce oyuncu seç...</p>';
    } else if (other && other.properties && other.properties.length > 0) {
        other.properties.forEach(id => {
            const prop = gameState.properties[id];
            if (!prop) return;
            const el = document.createElement('label');
            el.style.cssText = `
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                padding: 8px 10px;
                background: linear-gradient(90deg, ${prop.color}33, transparent);
                border-left: 4px solid ${prop.color};
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            `;
            el.innerHTML = `
                <input type="checkbox" class="their-prop" value="${prop.id}" style="cursor: pointer;">
                <span style="color: ${prop.color}; font-weight: 600;">${prop.name}</span>
            `;
            el.addEventListener('mouseenter', () => {
                el.style.background = `linear-gradient(90deg, ${prop.color}55, transparent)`;
                el.style.transform = 'translateX(3px)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.background = `linear-gradient(90deg, ${prop.color}33, transparent)`;
                el.style.transform = 'translateX(0)';
            });
            theirList.appendChild(el);
        });
    } else if (other) {
        theirList.innerHTML = '<p style="color: #94a3b8; font-style: italic; padding: 10px;">Bu oyuncunun mülkü yok</p>';
    }

    // Enable button when a player is selected
    if (proposeBtn) proposeBtn.disabled = !targetId || targetId === 'Oyuncu seç...';
}

function rollDice() {
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = true;
    socket.emit('rollDice');
    setTimeout(() => {
        rollBtn.disabled = false;
    }, 2000);
}

// endTurn function removed - auto-advancement handled by server

function showPropertyPopup(property) {
    selectedProperty = property;
    const popup = document.getElementById('propertyPopup');
    const nameEl = document.getElementById('propName');
    const detailsEl = document.getElementById('propDetails');
    const buyBtn = document.getElementById('buyBtn');
    const currentPlayer = gameState.players[gameState.currentTurn];
    const isCurrentPlayer = currentPlayer.id === socket.id;
    const propertyIndex = gameState.properties.findIndex(p => p.id === property.id);
    const justLanded = currentPlayer.position === propertyIndex;

    // Hard guard: If I don't own it and I'm not currently on it during my turn, block popup
    const iOwnThis = property.owner === socket.id;
    if (!(iOwnThis || (isCurrentPlayer && justLanded))) {
        return;
    }

    nameEl.textContent = property.name;

    let detailsHTML = '';
    if (property.color) {
        detailsHTML += `<div class="property-detail"><span>Renk Grubu:</span><span style="color: ${property.color}; font-weight: 700;">●●●</span></div>`;
    }
    if (property.group) {
        detailsHTML += `<div class="property-detail"><span>Ülke:</span><span>${property.group}</span></div>`;
    }
    if (property.price) {
        detailsHTML += `<div class="property-detail"><span>Fiyat:</span><span style="color: #fbbf24; font-weight: 700;">₺${property.price}</span></div>`;
    }
    if (property.rent && property.rent.length > 0) {
        detailsHTML += `<div class="property-detail"><span>Temel Kira:</span><span>₺${property.rent[0]}</span></div>`;
        if (property.rent[1]) detailsHTML += `<div class="property-detail"><span>1 Ev ile:</span><span>₺${property.rent[1]}</span></div>`;
        if (property.rent[2]) detailsHTML += `<div class="property-detail"><span>2 Ev ile:</span><span>₺${property.rent[2]}</span></div>`;
        if (property.rent[3]) detailsHTML += `<div class="property-detail"><span>3 Ev ile:</span><span>₺${property.rent[3]}</span></div>`;
        if (property.rent[4]) detailsHTML += `<div class="property-detail"><span>4 Ev ile:</span><span>₺${property.rent[4]}</span></div>`;
        if (property.rent[5]) detailsHTML += `<div class="property-detail"><span>Otel ile:</span><span style="color: #10b981; font-weight: 700;">₺${property.rent[5]}</span></div>`;
    }
    if (property.owner) {
        const owner = gameState.players.find(p => p.id === property.owner);
        detailsHTML += `<div class="property-detail" style="border-top: 2px solid rgba(96, 165, 250, 0.2); padding-top: 10px; margin-top: 10px;"><span>Sahibi:</span><span>${owner.appearance} ${owner.name}</span></div>`;
        
        // Show houses/hotel if property has them
        if (property.houses > 0) {
            const houseText = property.houses === 5 ? '🏨 Otel' : `🏠 ${property.houses} Ev`;
            detailsHTML += `<div class="property-detail"><span>Yapı:</span><span>${houseText}</span></div>`;
        }
        
        buyBtn.style.display = 'none';
    } else if (property.type === 'property' || property.type === 'railroad' || property.type === 'utility') {
        // Only show buy button for buyable properties if current player just landed here
        if (isCurrentPlayer && justLanded) {
            buyBtn.style.display = 'block';
            buyBtn.disabled = currentPlayer.money < property.price;
        } else {
            buyBtn.style.display = 'none';
        }
    } else {
        buyBtn.style.display = 'none';
    }

    detailsEl.innerHTML = detailsHTML;
    
    // Show build section if I own this property and it's a color property
    const buildSection = document.getElementById('buildSection');
    const buildHouseBtn = document.getElementById('buildHouseBtn');
    const sellHouseBtn = document.getElementById('sellHouseBtn');
    
    if (property.owner === socket.id && property.type === 'property') {
        buildSection.style.display = 'flex';
        // Check if player owns monopoly (country group takes precedence if available)
        const groupKey = property.group || property.color;
        const myProps = gameState.properties.filter(p => p.owner === socket.id && (p.group || p.color) === groupKey && p.type === 'property');
        const groupSize = gameState.properties.filter(p => (p.group || p.color) === groupKey && p.type === 'property').length;
        const hasMonopoly = myProps.length === groupSize;

        const houseCost = Math.floor(property.price / 2);
        const canBuild = hasMonopoly && (property.houses || 0) < 5 && currentPlayer.money >= houseCost;
        const canSell = (property.houses || 0) > 0;
        
        buildHouseBtn.style.display = 'block';
        buildHouseBtn.disabled = !canBuild;
        buildHouseBtn.textContent = (property.houses || 0) === 4 ? `🏨 Otel Dik (₺${houseCost})` : `🏠 Ev Dik (₺${houseCost})`;
        
        sellHouseBtn.style.display = canSell ? 'block' : 'none';
        sellHouseBtn.textContent = `💸 Sat (₺${Math.floor(houseCost / 2)})`;
    } else {
        buildSection.style.display = 'none';
    }
    
    popup.style.display = 'flex';
}

function closePopup() {
    const popup = document.getElementById('propertyPopup');
    const wasOpen = popup.style.display !== 'none';
    popup.style.display = 'none';
    
    // If popup was open and it's my turn, advance turn after closing
    if (wasOpen && gameState && gameState.players[gameState.currentTurn]?.id === socket.id) {
        setTimeout(() => {
            socket.emit('advanceTurn');
        }, 500);
    }
}

function showReadOnlyProperty(property) {
    const popup = document.getElementById('roPropertyPopup');
    const nameEl = document.getElementById('roPropName');
    const detailsEl = document.getElementById('roPropDetails');
    if (!popup || !nameEl || !detailsEl) return;
    nameEl.textContent = property.name;
    let html = '';
    if (property.group) html += `<div class="property-detail"><span>Ülke:</span><span>${property.group}</span></div>`;
    if (property.color) html += `<div class="property-detail"><span>Renk:</span><span style="color:${property.color}">●●●</span></div>`;
    if (property.price) html += `<div class="property-detail"><span>Fiyat:</span><span>₺${property.price}</span></div>`;
    if (property.owner) {
        const owner = gameState.players.find(p => p.id === property.owner);
        html += `<div class="property-detail"><span>Sahibi:</span><span>${owner?.appearance || ''} ${owner?.name || ''}</span></div>`;
    }
    if (property.houses) {
        const houseText = property.houses === 5 ? '🏨 Otel' : `🏠 ${property.houses} Ev`;
        html += `<div class="property-detail"><span>Yapı:</span><span>${houseText}</span></div>`;
    }
    detailsEl.innerHTML = html;
    popup.style.display = 'flex';
}

function closeRoPopup() {
    document.getElementById('roPropertyPopup').style.display = 'none';
}

function buyProperty() {
    if (selectedProperty) {
        socket.emit('buyProperty', { propertyId: selectedProperty.id });
    }
}

function sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    if (message) {
        socket.emit('sendMessage', { message });
        chatInput.value = '';
    }
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function buildHouse() {
    if (selectedProperty) {
        socket.emit('buildHouse', { propertyId: selectedProperty.id });
    }
}

function sellHouse() {
    if (selectedProperty) {
        socket.emit('sellHouse', { propertyId: selectedProperty.id });
    }
}

function addEvent(message, playerColor = null) {
    // Add to left panel event log
    const eventLog = document.getElementById('eventLog');
    if (eventLog) {
        // If playerColor not provided, try to extract player name from message and get their color
        if (!playerColor) {
            playerColor = '#60a5fa'; // Default accent color
            const players = gameState ? gameState.players : [];

            // Common message patterns that include player names
            const playerPatterns = [
                /^([^,]+),\s/,  // "Player name, mülkünü satın aldı"
                /^✨\s*([^\s]+)/,  // "✨ Player name BAŞLA'dan geçti"
                /^👮\s*([^\s]+)/,  // "👮 Player name hapishaneden çıktı"
                /^💸\s*([^\s]+)/,  // "💸 Player name vergi ödedi"
                /^🎴\s*([^:]+):/,  // "🎴 Player name: card message"
                /^💱\s*([^:]+):/,  // "💱 Player name: trade message"
                /^🏠\s*([^\s]+)/,  // "🏠 Player name ev dikti"
                /^([^\s]+)\s+bought/,  // "Player name bought property"
            ];

            for (const pattern of playerPatterns) {
                const match = message.match(pattern);
                if (match) {
                    const playerName = match[1].trim();
                    const player = players.find(p => p.name === playerName);
                    if (player) {
                        playerColor = player.color;
                        break;
                    }
                }
            }
        }

        const item = document.createElement('div');
        item.className = 'event-item';
        item.textContent = message;
        
        // Enhanced styling with player color as accent
        const lighterColor = lightenColor(playerColor, 0.3);
        item.style.cssText = `
            background: linear-gradient(90deg, ${playerColor}22, transparent);
            border-left: 4px solid ${playerColor};
            padding: 10px 12px;
            margin-bottom: 6px;
            border-radius: 0 8px 8px 0;
            font-weight: 600;
            font-size: 0.9em;
            color: ${lighterColor};
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
            transition: all 0.2s ease;
        `;

        // Add hover effect
        item.addEventListener('mouseenter', () => {
            item.style.background = `linear-gradient(90deg, ${playerColor}44, transparent)`;
            item.style.transform = 'translateX(3px)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = `linear-gradient(90deg, ${playerColor}22, transparent)`;
            item.style.transform = 'translateX(0)';
        });

        // Add new message to the top (newest first)
        eventLog.insertBefore(item, eventLog.firstChild);

        // Keep only max 12 messages, remove oldest (bottom)
        while (eventLog.children.length > 12) {
            eventLog.removeChild(eventLog.lastChild);
        }

        // Scroll to top to show new message
        eventLog.scrollTop = 0;
    }
}

// Helper function to convert hex to RGB
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

// Helper function to lighten a color
function lightenColor(hex, percent) {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
    const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
    const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));

    return `rgb(${r}, ${g}, ${b})`;
}

function addBoardEvent(message) {
    const boardDisplay = document.getElementById('boardEventDisplay');
    if (!boardDisplay) return;

    // Clear previous message and show new one
    boardDisplay.textContent = message;
    boardDisplay.style.display = 'block';

    // Auto-remove after 8 seconds
    setTimeout(() => {
        if (boardDisplay && boardDisplay.textContent === message) {
            boardDisplay.style.display = 'none';
            boardDisplay.textContent = '';
        }
    }, 8000);
}

function openTradeModal() {
    const modal = document.getElementById('tradeModal');
    if (modal) modal.style.display = 'flex';

    // Update dropdown with current players
    const tradeSelect = document.getElementById('tradeWithPlayer');
    tradeSelect.innerHTML = '<option>Oyuncu seç...</option>';
    gameState.players.forEach(player => {
        if (player.id !== socket.id) {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.appearance} ${player.name}`;
            tradeSelect.appendChild(option);
        }
    });

    // Initialize trade lists
    refreshTradeLists();

    // Set slider max values based on current player's money
    updateTradeSliders();
}

function closeTradeModal() {
    const modal = document.getElementById('tradeModal');
    if (modal) modal.style.display = 'none';
}

function updateTradeMoneyOffer() {
    const slider = document.getElementById('tradeMoneyOffer');
    const valueSpan = document.getElementById('tradeMoneyOfferValue');
    if (slider && valueSpan) {
        valueSpan.textContent = slider.value;
    }
}

function updateTradeMoneyRequest() {
    const slider = document.getElementById('tradeMoneyRequest');
    const valueSpan = document.getElementById('tradeMoneyRequestValue');
    if (slider && valueSpan) {
        valueSpan.textContent = slider.value;
    }
}

function updateTradeSliders() {
    const me = gameState.players.find(p => p.id === socket.id);
    if (!me) return;

    const offerSlider = document.getElementById('tradeMoneyOffer');
    const requestSlider = document.getElementById('tradeMoneyRequest');

    if (offerSlider) {
        offerSlider.max = me.money;
        offerSlider.value = Math.min(parseInt(offerSlider.value) || 0, me.money);
        updateTradeMoneyOffer();
    }

    if (requestSlider) {
        // For now, keep max at a reasonable amount, could be improved to show target player's max
        requestSlider.max = 10000; // Could be set to target player's money if available
        requestSlider.value = Math.min(parseInt(requestSlider.value) || 0, parseInt(requestSlider.max));
        updateTradeMoneyRequest();
    }
}

function proposeTrade() {
    const targetId = document.getElementById('tradeWithPlayer')?.value;
    if (!targetId || targetId === 'Oyuncu seç...') {
        alert('Önce bir oyuncu seç!');
        return;
    }
    const offerMoney = Math.max(0, parseInt(document.getElementById('tradeMoneyOffer')?.value || 0));
    const requestMoney = Math.max(0, parseInt(document.getElementById('tradeMoneyRequest')?.value || 0));
    const myPropIds = Array.from(document.querySelectorAll('.my-prop:checked')).map(i => parseInt(i.value));
    const theirPropIds = Array.from(document.querySelectorAll('.their-prop:checked')).map(i => parseInt(i.value));

    socket.emit('proposeTrade', {
        to: targetId,
        offerMoney,
        requestMoney,
        myPropIds,
        theirPropIds
    });
    addEvent(`💱 Takas teklifi gönderildi`);
    closeTradeModal();
}

function updateTradeHistory() {
    const historyEl = document.getElementById('tradeHistoryList');
    if (!historyEl || !gameState) return;

    // Get recent trades from gameState (we'll add this to server)
    // For now, show empty state
    historyEl.innerHTML = '<div style="text-align: center; color: rgba(255,255,255,0.6); font-size: 0.9em; padding: 10px;">Henüz takas geçmişi yok</div>';
}

function payJailFine() {
    socket.emit('payJailFine');
    closeJailModal();
}

function rollForJail() {
    socket.emit('rollForJail');
    closeJailModal();
}

function closeJailModal() {
    const modal = document.getElementById('jailModal');
    if (modal) modal.style.display = 'none';
}

socket.on('jailReleased', (data) => {
    addEvent(`👮 ${data.player.name} hapishaneden çıktı: ${data.reason}`);

    if (data.dice1 && data.dice2) {
        // Player rolled doubles and moved
        setTimeout(() => {
            updateGameBoard();
            updateGamePlayersPanel();
        }, 500);
    }

    updateGameBoard();
    updateGamePlayersPanel();
});

socket.on('jailRollFailed', (data) => {
    addEvent(`🎲 ${data.message}`);
});

// Check if current player is in jail and show jail modal
function checkJailStatus() {
    const currentPlayer = gameState.players[gameState.currentTurn];
    if (currentPlayer && currentPlayer.id === socket.id && currentPlayer.inJail) {
        showJailModal(currentPlayer);
    }
}

function showJailModal(player) {
    const modal = document.getElementById('jailModal');
    const turnsLeftEl = document.getElementById('jailTurnsLeft');
    if (modal && turnsLeftEl) {
        const turnsLeft = Math.max(0, 3 - (player.jailTurns || 0));
        turnsLeftEl.textContent = `Kalan tur: ${turnsLeft}`;
        modal.style.display = 'flex';
    }
}

socket.on('tradeOffer', (data) => {
    const fromPlayer = gameState.players.find(p => p.id === data.from);
    const myGetProps = (data.theirPropIds || []).map(id => gameState.properties.find(p => p.id === id)?.name).filter(Boolean);
    const myGiveProps = (data.myPropIds || []).map(id => gameState.properties.find(p => p.id === id)?.name).filter(Boolean);
    
    // Store trade data for modal response
    gameState.currentTradeOffer = data;
    
    // Populate modal content
    document.getElementById('tradeOfferSender').textContent = `${fromPlayer?.appearance || ''} ${fromPlayer?.name || ''}`;
    document.getElementById('tradeOfferTheirWant').innerHTML = myGiveProps.length > 0 
        ? myGiveProps.map(p => `<div style="padding:4px 0;">• ${p}</div>`).join('') 
        : '<div style="padding:4px 0; color: rgba(255,255,255,0.6);">Hiçbir mülk</div>';
    
    if (data.requestMoney > 0) {
        document.getElementById('tradeOfferTheirWant').innerHTML += `<div style="padding:4px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 4px; padding-top: 6px;">+ ₺${data.requestMoney}</div>`;
    }
    
    document.getElementById('tradeOfferTheirGive').innerHTML = myGetProps.length > 0 
        ? myGetProps.map(p => `<div style="padding:4px 0;">• ${p}</div>`).join('') 
        : '<div style="padding:4px 0; color: rgba(255,255,255,0.6);">Hiçbir mülk</div>';
    
    if (data.offerMoney > 0) {
        document.getElementById('tradeOfferTheirGive').innerHTML += `<div style="padding:4px 0; border-top: 1px solid rgba(255,255,255,0.2); margin-top: 4px; padding-top: 6px;">+ ₺${data.offerMoney}</div>`;
    }
    
    // Show modal
    document.getElementById('tradeOfferModal').style.display = 'flex';
});

function acceptTradeOffer() {
    if (!gameState.currentTradeOffer) return;
    socket.emit('respondTrade', { tradeId: gameState.currentTradeOffer.tradeId, accept: true });
    closeTradeOfferModal();
}

function rejectTradeOffer() {
    if (!gameState.currentTradeOffer) return;
    socket.emit('respondTrade', { tradeId: gameState.currentTradeOffer.tradeId, accept: false });
    closeTradeOfferModal();
    addEvent(`💱 Takas teklifi reddedildi`);
}

function closeTradeOfferModal() {
    document.getElementById('tradeOfferModal').style.display = 'none';
    gameState.currentTradeOffer = null;
}

function showCounterOfferPanel() {
    if (!gameState.currentTradeOffer) return;
    const targetPlayer = gameState.players.find(p => p.id === gameState.currentTradeOffer.from);
    document.getElementById('counterOfferTarget').textContent = `${targetPlayer?.appearance || ''} ${targetPlayer?.name || ''} Için`;
    
    // Populate available properties from the other player
    const theirProps = gameState.properties.filter(p => p.owner === gameState.currentTradeOffer.from);
    document.getElementById('counterAvailableProps').innerHTML = theirProps.length > 0
        ? theirProps.map(p => `<label style="background: rgba(255,255,255,0.1); padding: 6px 10px; border-radius: 4px; cursor: pointer; display: inline-block;"><input type="checkbox" value="${p.id}" class="counterPropCheckbox"> ${p.name}</label>`).join('')
        : '<div style="color: rgba(255,255,255,0.6);">Mülkü yok</div>';
    
    // Populate our properties for counter-offer
    const myProps = gameState.properties.filter(p => p.owner === socket.id);
    document.getElementById('counterMyWant').innerHTML = myProps.length > 0
        ? myProps.map(p => `<label style="display: block; padding: 4px 0;"><input type="checkbox" value="${p.id}" class="counterWantCheckbox"> ${p.name}</label>`).join('')
        : '<div style="color: rgba(255,255,255,0.6);">Mülkü yok</div>';
    
    document.getElementById('counterMyGive').innerHTML = myProps.length > 0
        ? myProps.map(p => `<label style="display: block; padding: 4px 0;"><input type="checkbox" value="${p.id}" class="counterGiveCheckbox"> ${p.name}</label>`).join('')
        : '<div style="color: rgba(255,255,255,0.6);">Mülkü yok</div>';
    
    document.getElementById('counterOfferPanel').style.display = 'flex';
}

function closeCounterOfferPanel() {
    document.getElementById('counterOfferPanel').style.display = 'none';
}

function sendCounterOffer() {
    if (!gameState.currentTradeOffer) return;
    const targetPlayerId = gameState.currentTradeOffer.from;
    
    const myWantChecks = Array.from(document.querySelectorAll('.counterWantCheckbox:checked')).map(c => c.value);
    const myGiveChecks = Array.from(document.querySelectorAll('.counterGiveCheckbox:checked')).map(c => c.value);
    const counterAvailChecks = Array.from(document.querySelectorAll('.counterPropCheckbox:checked')).map(c => c.value);
    
    const myMoneyWant = parseInt(document.getElementById('counterMyMoneyWant').value) || 0;
    const myMoneyGive = parseInt(document.getElementById('counterMyMoneyGive').value) || 0;
    
    // Send counter-offer as a new trade proposal (reverse direction)
    socket.emit('proposeTrade', {
        to: targetPlayerId,
        offerMoney: myMoneyGive,
        requestMoney: myMoneyWant,
        myPropIds: myGiveChecks,
        theirPropIds: counterAvailChecks
    });
    
    addEvent(`💱 Karşı teklif gönderildi`);
    closeCounterOfferPanel();
    closeTradeOfferModal();
}

// Close trade offer modal when clicking outside content
document.addEventListener('click', (e) => {
    const modal = document.getElementById('tradeOfferModal');
    if (modal && modal.style.display === 'flex' && e.target === modal) {
        closeTradeOfferModal();
    }
});

socket.on('tradeCompleted', (payload) => {
    addEvent(`💱 Takas tamamlandı: ${payload.message}`);
    if (payload.updatedPlayers) {
        payload.updatedPlayers.forEach(up => {
            const idx = gameState.players.findIndex(p => p.id === up.id);
            if (idx >= 0) gameState.players[idx] = { ...gameState.players[idx], ...up };
        });
    }
    if (payload.updatedProperties) {
        payload.updatedProperties.forEach(pp => {
            const idx = gameState.properties.findIndex(p => p.id === pp.id);
            if (idx >= 0) gameState.properties[idx] = { ...gameState.properties[idx], ...pp };
        });
    }
    updateOwnedProperties();
    updateGameBoard();
    refreshTradeLists();
});

// Bankruptcy function
function declareBankruptcy() {
    if (!confirm('⚠️ İflas etmek istediğinizden emin misiniz?\n\nTüm mülkleriniz sahipsiz kalacak ve paranız sıfırlanacak. Oyunu izleyici olarak sürdürebilirsiniz.')) {
        return;
    }
    
    socket.emit('declareBankruptcy');
    
    // Hide bankruptcy button after declaring
    const bankruptBtn = document.getElementById('bankruptBtn');
    if (bankruptBtn) bankruptBtn.style.display = 'none';
}

// Handle bankruptcy events
socket.on('playerBankrupt', (data) => {
    addEvent(`💸 ${data.message}`, data.player.color);
    addBoardEvent(`${data.player.name} iflas etti!`);
    
    // Update player state
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        gameState.players[playerIdx] = { ...gameState.players[playerIdx], ...data.player };
    }
    
    // Update board and UI
    updateGameBoard();
    updateGamePlayersPanel();
    updateOwnedProperties();
    
    playSound('soundSell');
});

console.log('🎮 Oyun yüklendi ve hazır!');
