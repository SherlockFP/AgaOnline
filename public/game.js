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

// Utility: convert hex color to rgba string
function hexToRgba(hex, alpha) {
    if (!hex) return `rgba(255,255,255,${alpha})`;
    let c = hex.replace('#','');
    if (c.length === 3) c = c.split('').map(ch => ch+ch).join('');
    const r = parseInt(c.substring(0,2),16);
    const g = parseInt(c.substring(2,4),16);
    const b = parseInt(c.substring(4,6),16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Utility: get initials (2 letters) from player name, fallback to short appearance
function getInitials(name, appearance) {
    if (appearance && typeof appearance === 'string' && appearance.length <= 2) return appearance;
    if (!name) return (appearance && appearance.length <= 2) ? appearance : '';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    const first = parts[0][0] || '';
    const last = parts[parts.length-1][0] || '';
    return (first + last).toUpperCase();
}

// Initialize background music
function initializeBackgroundMusic() {
    if (backgroundAudio) return; // Prevent multiple initializations
    backgroundAudio = new Audio();
    backgroundAudio.loop = true;
    backgroundAudio.volume = 0; // Başlangıçta sessiz
    backgroundAudio.src = '/music/music.mp3';
    backgroundAudio.preload = 'auto';
    loadMusicTracks();
    isPlayingMusic = false;
    
    // Müzik otomatik başlamasın - kullanıcı slider'ı sağa çekince başlayacak
    console.log('Müzik hazır - slider ile açabilirsiniz');
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

// Dice rolling sound using WebAudio (continuous during roll)
let _diceAudio = {
    ctx: null,
    osc: null,
    gain: null,
    modInterval: null
};

function startDiceRollSound() {
    try {
        if (_diceAudio.osc) return; // already running
        const ctx = _diceAudio.ctx || new (window.AudioContext || window.webkitAudioContext)();
        _diceAudio.ctx = ctx;
        // Softer continuous roll: use triangle wave + lowpass + lower gain
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400; // remove harsh highs

        osc.type = 'triangle';
        const baseFreq = 180;
        osc.frequency.value = baseFreq;
        gain.gain.value = 0.00005;

        // Routing: osc -> gain -> lowpass -> destination
        osc.connect(gain);
        gain.connect(lp);
        lp.connect(ctx.destination);

        // gentle fade-in to a much lower level than before
        gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.08);
        osc.start();
        _diceAudio.osc = osc;
        _diceAudio.gain = gain;
        _diceAudio.filter = lp;

        // modulate frequency gently to mimic dice rattle (narrower range)
        _diceAudio.modInterval = setInterval(() => {
            if (!_diceAudio.osc) return;
            const f = baseFreq + (Math.random() * 120 - 60); // +-60Hz
            try { _diceAudio.osc.frequency.setValueAtTime(f, ctx.currentTime); } catch (e) {}
        }, 120);
    } catch (e) {
        console.log('Dice roll sound failed', e);
    }
}

function stopDiceRollSound() {
    try {
        if (!_diceAudio.osc) return;
        const ctx = _diceAudio.ctx;
        // gentle fade out
        try {
            _diceAudio.gain.gain.cancelScheduledValues(ctx.currentTime);
            _diceAudio.gain.gain.linearRampToValueAtTime(0.00005, ctx.currentTime + 0.12);
        } catch (e) {}
        setTimeout(() => {
            try { _diceAudio.osc.stop(); } catch (e) {}
            try { _diceAudio.osc.disconnect(); } catch (e) {}
            try { _diceAudio.gain.disconnect(); } catch (e) {}
            try { _diceAudio.filter.disconnect(); } catch (e) {}
        }, 180);
        clearInterval(_diceAudio.modInterval);
        _diceAudio.osc = null;
        _diceAudio.gain = null;
        _diceAudio.filter = null;
        _diceAudio.modInterval = null;
    } catch (e) {
        console.log('stopDiceRollSound error', e);
    }
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
    if (backgroundAudio) {
        backgroundAudio.volume = vol;
        // Slider sağa çekilince müziği başlat
        if (vol > 0 && !isPlayingMusic) {
            backgroundAudio.play().then(() => {
                isPlayingMusic = true;
                console.log('Müzik başlatıldı');
            }).catch(e => console.log('Play failed:', e));
        } else if (vol === 0) {
            backgroundAudio.pause();
            isPlayingMusic = false;
        }
    }
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
// (dark mode loader above)

// Name prompt modal helpers (replace native prompt)
let _pendingNameCallback = null;
function showNameModal(prefill) {
    const modal = document.getElementById('namePromptModal');
    const input = document.getElementById('namePromptInput');
    if (!modal || !input) return;
    input.value = prefill || document.getElementById('playerNameInput')?.value || '';
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 100);
}
function hideNameModal(cancel = false) {
    const modal = document.getElementById('namePromptModal');
    if (modal) modal.style.display = 'none';
    if (cancel && _pendingNameCallback && typeof _pendingNameCallback === 'function') {
        const cb = _pendingNameCallback;
        _pendingNameCallback = null;
        cb(null);
    }
}
function confirmNameModal() {
    const input = document.getElementById('namePromptInput');
    if (!input) return hideNameModal();
    const val = input.value.trim();
    hideNameModal();
    if (_pendingNameCallback && typeof _pendingNameCallback === 'function') {
        const cb = _pendingNameCallback;
        _pendingNameCallback = null;
        cb(val);
    }
}

function requestPlayerName(callback) {
    _pendingNameCallback = callback;
    showNameModal();
}

// Sound effect function using Web Audio API
function playSound(soundType) {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const now = audioContext.currentTime;
        
        if (soundType === 'dice' || soundType === 'soundDice') {
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
        } else if (soundType === 'buy' || soundType === 'soundBuy') {
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
        } else if (soundType === 'move') {
            // Move sound: quick blip
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 600;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.15, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
            osc.start(now);
            osc.stop(now + 0.08);
        } else if (soundType === 'money') {
            // Money sound: coin clink
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            osc.type = 'triangle';
            gain.gain.setValueAtTime(0.25, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (soundType === 'card') {
            // Card draw sound
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 500;
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (soundType === 'jail') {
            // Jail sound: low ominous tone
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 200;
            osc.type = 'sawtooth';
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (soundType === 'achievement') {
            // Achievement unlock sound: ascending triumphant
            const frequencies = [523, 659, 784, 1047]; // C, E, G, C (major chord)
            frequencies.forEach((freq, i) => {
                const osc = audioContext.createOscillator();
                const gain = audioContext.createGain();
                osc.connect(gain);
                gain.connect(audioContext.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.2, now + i * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.2);
                osc.start(now + i * 0.1);
                osc.stop(now + i * 0.1 + 0.2);
            });
        } else if (soundType === 'auction') {
            // Auction gavel sound
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            osc.frequency.value = 150;
            osc.type = 'square';
            gain.gain.setValueAtTime(0.4, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
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
    
    // Show/hide color picker in board center based on game state
    const colorPickerPanel = document.getElementById('colorPickerPanel');
    if (colorPickerPanel) {
        if (lobby.started) {
            colorPickerPanel.style.display = 'none';
        } else {
            colorPickerPanel.style.display = 'block';
        }
    }
    
    console.log('👥 Lobi güncellendi');
});

socket.on('gameStarted', (lobby) => {
    // Try to unlock audio early; also bound to first user interaction
    if (typeof unlockAudio === 'function') {
        unlockAudio();
    }
    currentLobby = lobby;
    gameState = lobby;
    gameState.currentTradeOffer = null;  // Initialize trade offer tracking
    colorsLocked = true;
    const startBtn = document.getElementById('startBtn');
    if (startBtn) startBtn.style.display = 'none';
    // Set initial turn display immediately and show it
    const turnDisplay = document.getElementById('currentTurnDisplay');
    if (turnDisplay) turnDisplay.style.display = 'block';
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
        const colorPickerPanel = document.getElementById('colorPickerPanel');
        if (colorPanel) colorPanel.style.display = 'none';
        if (setupPanel) setupPanel.style.display = 'none';
        if (colorPickerPanel) colorPickerPanel.style.display = 'none';
        
        // Show bankruptcy button when game starts
        const bankruptBtn = document.getElementById('bankruptBtn');
        if (bankruptBtn) bankruptBtn.style.display = 'block';
        
        // Show statistics button when game starts
        const statsBtn = document.getElementById('statsBtn');
        if (statsBtn) statsBtn.style.display = 'block';
        
    const boardNameEl = document.getElementById('boardName');
    if (boardNameEl && lobby.boardName) {
        boardNameEl.textContent = `Tahta: ${lobby.boardName}`;
    }
    
    // Show welcome toast
    showToast('🎮 Oyun başladı! İyi şanslar!', 'success', 5000);
    
    console.log('🎮 Oyun başladı!');
});

socket.on('diceRolled', (data) => {
    let prevPlayerPosition = null;
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    const resultEl = document.getElementById('diceResult');
    const endTurnBtn = document.getElementById('endTurnBtn');

    // Ensure rolling visuals & audio are active while server calculates
    dice1El.classList.add('rolling');
    dice2El.style.display = 'flex';
    dice2El.classList.add('rolling');
    startDiceRollSound();

    // Reveal dice after a longer, satisfying roll duration
    const revealDelay = 1400; // ms
    setTimeout(() => {
        dice1El.setAttribute('data-value', data.dice1);
        dice2El.setAttribute('data-value', data.dice2);
        resultEl.textContent = `Toplam: ${data.total}`;
        dice1El.classList.remove('rolling');
        dice2El.classList.remove('rolling');
        // stop rolling sound when values revealed
        stopDiceRollSound();
    }, revealDelay);

    // Hide roll button after rolling
    const rollBtn = document.getElementById('rollBtn');
    if (rollBtn) {
        rollBtn.style.display = 'none';
    }

    const statusEl = document.getElementById('gameStatus');
    if (statusEl) statusEl.textContent = `${data.player.name} sırası`;

    // (rolling sound handled by startDiceRollSound/stopDiceRollSound)
    
    // Check for lucky double 6
    if (data.dice1 === 6 && data.dice2 === 6) {
        showAchievement('luckyRoll');
        showToast('🎲 Çift 6! Şanslı zar!', 'success');
    }

    // Update gameState with new position; keep previous pos for correct animation start
    const playerIdx = gameState.players.findIndex(p => p.id === data.player.id);
    if (playerIdx >= 0) {
        prevPlayerPosition = gameState.players[playerIdx].position;
        const newPosition = data.newPosition;
        gameState.players[playerIdx].position = newPosition;
        if (data.player.money !== undefined) {
            gameState.players[playerIdx].money = data.player.money;
        }
    }

    // Show GO passed message
    if (data.passedGo) {
        addEvent(`✨ ${data.player.name} BAŞLA'dan geçti ve ${data.currency}${data.goMoney} bonus para aldı!`, data.player.color);
        addBoardEvent(`${data.player.name} BAŞLA'dan geçti (+${data.currency}${data.goMoney})`, data.player.color);
        showToast(`✨ ${data.player.name} BAŞLA'dan geçti! +${data.currency}${data.goMoney}`, 'money', 4000);
        playSound('money');
        
        // Show money animation
        const playerEl = document.querySelector(`.player-token[data-player-id="${data.player.id}"]`);
        if (playerEl) {
            const rect = playerEl.getBoundingClientRect();
            showMoneyAnimation(data.goMoney, rect.left + rect.width/2, rect.top);
        }
    }

    // Show card message if chance/chest card
    if (data.cardMessage) {
        addEvent(`🎴 ${data.player.name}: ${data.cardMessage}`, data.player.color);
        addBoardEvent(`${data.player.name} ${data.cardMessage}`, data.player.color);
        showToast(`🎴 ${data.cardMessage}`, 'info', 5000);
        playSound('card');
    }

    // Show tax message
    if (data.taxMessage) {
        addEvent(`💸 ${data.taxMessage}`, data.player.color);
        addBoardEvent(`${data.player.name} vergi ödedi`, data.player.color);
        showToast(`💸 ${data.taxMessage}`, 'warning');
        
        // Show negative money animation
        const playerEl = document.querySelector(`.player-token[data-player-id="${data.player.id}"]`);
        if (playerEl) {
            const rect = playerEl.getBoundingClientRect();
            const taxAmount = data.taxMessage.match(/\d+/);
            if (taxAmount) showMoneyAnimation(-parseInt(taxAmount[0]), rect.left + rect.width/2, rect.top);
        }
    }

    // Show rent message
    if (data.rentMessage) {
        addEvent(`🏠 ${data.rentMessage}`, data.player.color);
        addBoardEvent(data.rentMessage, data.player.color);
        showToast(`🏠 Kira ödendi`, 'property');
        playSound('money');
        
        // Show negative money animation
        const playerEl = document.querySelector(`.player-token[data-player-id="${data.player.id}"]`);
        if (playerEl) {
            const rect = playerEl.getBoundingClientRect();
            const rentAmount = data.rentMessage.match(/\d+/);
            if (rentAmount) showMoneyAnimation(-parseInt(rentAmount[0]), rect.left + rect.width/2, rect.top);
        }
    }

    // Show special space messages
    if (data.specialMessage) {
        addEvent(data.specialMessage, data.player.color);
        addBoardEvent(`${data.player.name} özel alana geldi`, data.player.color);
    }

    // Animate player movement - start shortly AFTER dice animation finishes
    const startPos = (typeof prevPlayerPosition === 'number') ? prevPlayerPosition : (playerIdx >= 0 ? (data.newPosition - data.total + 40) % 40 : 0);
    // Delay movement to give dice animation time to settle. Start movement after revealDelay + small pause.
    const movementDelay = (typeof revealDelay === 'number' ? revealDelay : 800) + 600;
    setTimeout(() => {
        // Animate then handle post-move logic (popup, auto-advance) only after token arrives
        // Use instant move (no step-by-step) to prevent slow / buggy board animation
        animatePlayerMove(data.player.id, startPos, data.newPosition, data.player.color, () => {
            updateGameBoard();
            updateGamePlayersPanel();
            updateTurnDisplay();

            // Now decide next actions (only current player controls advancing)
            const isMyTurn = gameState.players[gameState.currentTurn]?.id === socket.id;
            if (!isMyTurn) {
                console.log('⏭️ Not my turn after move, skipping post-move controls');
                return;
            }

            const landedOnBuyable = data.isBuyableProperty;
            const isSpecialSpace = data.isSpecialSpace;

            console.log('🎲 Post-move landed on:', { landedOnBuyable, isSpecialSpace, spaceName: data.landedSpace?.name });

            if (landedOnBuyable) {
                // Show purchase popup now that token has arrived
                console.log('🏠 Showing property popup on arrival');
                showPropertyPopup(data.landedSpace);
                // Do NOT auto-advance; waiting for player action
                return;
            }

            if (isSpecialSpace) {
                // If player was sent to jail, advance turn immediately (they won't get to act now)
                if (data.player && data.player.inJail) {
                    addEvent(`🔒 ${data.player.name} hapishaneye gönderildi!`, data.player.color);
                    showToast('🔒 Hapishaneye gönderildin!', 'warning', 2500);
                    console.log('🔒 Player was jailed; advancing turn');
                    setTimeout(() => socket.emit('advanceTurn'), 1400);
                } else {
                    // Regular special space - short delay then advance
                    console.log('⭐ Special space - advancing in 3s');
                    setTimeout(() => socket.emit('advanceTurn'), 3000);
                }
                return;
            }

            // Normal space - advance after short delay
            console.log('🔄 Normal space - advancing in 2s');
            setTimeout(() => socket.emit('advanceTurn'), 2000);
        }, true);
    }, movementDelay);
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
    addBoardEvent(`${data.player.name} ${data.property.name} aldı`, data.player.color);
    
    // Show toast and play sound
    showToast(`🏠 ${data.property.name} satın alındı!`, 'property', 4000);
    playSound('buy');
    
    // Show money animation
    const playerEl = document.querySelector(`.player-token[data-player-id="${data.player.id}"]`);
    if (playerEl) {
        const rect = playerEl.getBoundingClientRect();
        showMoneyAnimation(-data.property.price, rect.left + rect.width/2, rect.top);
    }
    
    // Check achievements
    checkAchievements(data.player);
    
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
    
    // Show toast
    const isHotel = data.property.houses === 5;
    showToast(`${isHotel ? '🏨 Otel' : '🏗️ Ev'} inşa edildi!`, 'success', 4000);
    playSound('buy');
    
    // Check achievements
    if (data.property.houses === 1) {
        showAchievement('firstHouse');
    } else if (data.property.houses === 5) {
        showAchievement('firstHotel');
    }
    
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
    
    let messageContent = data.message;
    
    // Check if message contains a GIF link (Giphy, Tenor, or direct .gif)
    const gifRegex = /(https?:\/\/.+\.(gif|gifv))|(https?:\/\/(media\.giphy\.com|tenor\.com|i\.giphy\.com|c\.tenor\.com)\/.+)/gi;
    const gifMatch = messageContent.match(gifRegex);
    
    if (gifMatch) {
        // Extract GIF URL
        let gifUrl = gifMatch[0];
        
        // Replace message with text + GIF preview
        const textWithoutGif = messageContent.replace(gifRegex, '').trim();
        messageContent = textWithoutGif ? `<div>${textWithoutGif}</div>` : '';
        messageContent += `<img src="${gifUrl}" class="gif-preview" alt="GIF" onerror="this.style.display='none'">`;
    }
    
    msgEl.innerHTML = `
        <div class="chat-message-author">${data.appearance} ${data.playerName}</div>
        <div>${messageContent}</div>
    `;
    chatDiv.appendChild(msgEl);
    // Scroll to bottom with smooth behavior
    setTimeout(() => {
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }, 10);
});

socket.on('error', (message) => {
    // Reset joining flag in case join attempt failed
    isJoiningLobby = false;
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
    document.querySelectorAll('.avatar-btn, .avatar-btn-modern').forEach(btn => {
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
    let nameToUse = playerName;
    const proceedJoin = (resolvedName) => {
        if (!resolvedName) return; // cancelled
        nameToUse = resolvedName.trim();
        if (!nameToUse) return;
        document.getElementById('playerNameInput').value = nameToUse;
        isJoiningLobby = true;
        socket.emit('joinLobby', {
            lobbyId,
            playerName: nameToUse,
            appearance: selectedAppearance,
            color: selectedColor
        });
    };

    if (!nameToUse) {
        requestPlayerName(proceedJoin);
        return;
    }

    proceedJoin(nameToUse);
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
    let lobbyToUse = lobbyId;
    let playerName = document.getElementById('playerNameInput').value.trim();
    const proceedJoin = (resolvedName) => {
        if (typeof resolvedName === 'string') {
            playerName = resolvedName.trim();
            if (!playerName) return;
            document.getElementById('playerNameInput').value = playerName;
        }

        if (!lobbyToUse) {
            alert('Lobi ID yazmalısın');
            return;
        }

        isJoiningLobby = true;
        socket.emit('joinLobby', {
            lobbyId: lobbyToUse,
            playerName,
            appearance: selectedAppearance,
            color: selectedColor
        });
    };

    if (!playerName) {
        requestPlayerName(proceedJoin);
        return;
    }
    if (!lobbyToUse) {
        alert('Lobi ID yazmalısın');
        return;
    }

    isJoiningLobby = true;
    socket.emit('joinLobby', {
        lobbyId: lobbyToUse,
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
                <div class="player-money">💰 €${player.money}</div>
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
        
        // Add bankruptcy styling
        const bankruptStyle = player.isBankrupt ? 'text-decoration: line-through; opacity: 0.6;' : '';
        const bankruptBadge = player.isBankrupt ? ' <span style="color: #ef4444; font-weight: 700;">💸 İFLAS</span>' : '';
        
        div.innerHTML = `
            <div class="player-appearance" style="${bankruptStyle}">${player.appearance}</div>
            <div class="player-info" style="${bankruptStyle}">
                <div class="player-name">${player.name}${isHost ? ' 👑' : ''}${isMe ? ' (Sen)' : ''}${bankruptBadge}</div>
                <div class="player-money">💰 ₺${player.money}</div>
            </div>
            <div style="width: 14px; height: 14px; background: ${player.color}; border-radius: 50%; border: 2px solid white; ${bankruptStyle}"></div>
        `;
        playersList.appendChild(div);
    });

    const playerCount = document.getElementById('playerCount');
    if (playerCount) playerCount.textContent = `Oyuncu: ${gameState.players.length}/12`;
}

function startGame() {
    const rules = {
        initialMoney: parseInt(document.getElementById('initialMoneySlider')?.value) || 2500,
        taxFree: document.getElementById('ruleTaxFree')?.checked || false,
        goMoney: parseInt(document.getElementById('goMoneySlider')?.value) || 200
    };
    socket.emit('startGame', { rules });
}

function updateRules() {
    // Update rules locally
}

function updateInitialMoney() {
    const value = document.getElementById('initialMoneySlider')?.value || 2500;
    document.getElementById('initialMoney').textContent = value;
}

function updateGoMoney() {
    const value = document.getElementById('goMoneySlider')?.value || 250;
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
        
        // Get current player's color
        const myPlayer = players.find(p => p.id === socket.id);
        const myColor = myPlayer ? myPlayer.color : selectedColor;
        
        // Update both board center and left panel color buttons
        document.querySelectorAll('.color-btn-large, #colorPickerPanel button').forEach(btn => {
            // Get color from data attribute or onclick
            let color = btn.dataset?.color;
            if (!color) {
                const onclick = btn.getAttribute('onclick');
                const match = onclick?.match(/'(#[a-f0-9]{6})'/i);
                color = match ? match[1] : null;
            }
            if (!color) return;
            
            const isTaken = usedColors.includes(color) && color !== myColor;
            const takenByPlayer = players.find(p => p.color === color);
            const takenBy = takenByPlayer?.name || '';

            btn.classList.toggle('taken', isTaken);
            
            // Visual feedback for taken colors
            if (isTaken) {
                btn.style.opacity = '0.4';
                btn.style.cursor = 'not-allowed';
                btn.style.filter = 'grayscale(50%)';
                btn.title = `${takenBy} seçti`;
                
                // Add player name label INSIDE the color box
                if (!btn.querySelector('.taken-marker')) {
                    const marker = document.createElement('div');
                    marker.className = 'taken-marker';
                    marker.innerHTML = takenBy;
                    marker.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 11px; color: white; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.9); pointer-events: none; z-index: 10; text-align: center; width: 90%;';
                    btn.style.position = 'relative';
                    btn.appendChild(marker);
                }
            } else if (takenByPlayer && takenByPlayer.id === socket.id) {
                // Show own name for selected color INSIDE the box
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
                btn.style.filter = 'none';
                btn.title = `Senin rengin`;
                
                if (!btn.querySelector('.taken-marker')) {
                    const marker = document.createElement('div');
                    marker.className = 'taken-marker';
                    marker.innerHTML = takenBy;
                    marker.style.cssText = 'position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 11px; color: white; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.9); pointer-events: none; z-index: 10; text-align: center; width: 90%;';
                    btn.style.position = 'relative';
                    btn.appendChild(marker);
                }
            } else {
                btn.style.opacity = shouldLock ? '0.6' : '1';
                btn.style.cursor = shouldLock ? 'not-allowed' : 'pointer';
                btn.style.filter = 'none';
                btn.title = '';
                const marker = btn.querySelector('.taken-marker');
                if (marker) marker.remove();
            }

            btn.disabled = isTaken || shouldLock;
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

    // Hide color picker panel in board center
    const colorPickerPanel = document.getElementById('colorPickerPanel');
    if (colorPickerPanel) colorPickerPanel.style.display = 'none';

    // Show bankruptcy button
    const bankruptBtn = document.getElementById('bankruptBtn');
    if (bankruptBtn) bankruptBtn.style.display = 'block';

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

        // Add color class for properties (base template)
        if (prop.color) {
            space.classList.add(prop.color);
        }

        // Override color class based on group mapping for Dünya board
        // so country groups appear with the requested palette
        const groupColorMap = {
            'Mısır': 'brown',
            'MISIR': 'brown',
            'Misir': 'brown',
            'Türkiye': 'red',
            'Almanya': 'darkblue',
            'İtalya': 'green',
            'Fransa': 'pink',
            'Çin': 'purple'
        };
        if (prop.group && groupColorMap[prop.group]) {
            // remove any known color classes
            ['brown','lightblue','pink','orange','red','yellow','green','darkblue'].forEach(c => space.classList.remove(c));
            space.classList.add(groupColorMap[prop.group]);
        }

        // Add a slug class for the group so we can target specific country labels in CSS
        if (prop.group) {
            const slug = prop.group.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '-').replace(/[^a-zA-Z0-9\-]/g, '').toLowerCase();
            if (slug) space.classList.add(`group-${slug}`);
        }

        if (prop.type === 'go' || prop.type === 'jail' || prop.type === 'parking' || prop.type === 'gotojail') {
            space.classList.add('corner');
        } else if (prop.type === 'property') {
            space.classList.add('property');
        }

        space.dataset.id = index;
        
        // Add group icon only for special spaces (not color properties)
        let groupIcon = '';
        if (prop.type === 'railroad') groupIcon = '🚂 ';
        else if (prop.type === 'utility') groupIcon = '💡 ';
        else if (prop.type === 'go') groupIcon = '🎯 ';
        else if (prop.type === 'jail') groupIcon = '👮 ';
        else if (prop.type === 'parking') groupIcon = '🅿️ ';
        else if (prop.type === 'gotojail') groupIcon = '🚔 ';
        else if (prop.type === 'chance') groupIcon = '❓ ';
        else if (prop.type === 'chest') groupIcon = '📦 ';
        else if (prop.type === 'tax') groupIcon = '💸 ';
        
        let houseIndicator = '';
        if (prop.houses > 0) {
            if (prop.houses === 5) {
                houseIndicator = '<div class="house-indicator">🏨</div>';
            } else {
                houseIndicator = `<div class="house-indicator">${'🏠'.repeat(prop.houses)}</div>`;
            }
        }
        
        const groupLabel = prop.group ? `<div class="space-group">${prop.group}</div>` : '';
        space.innerHTML = `<div class="space-name">${groupIcon}${prop.name}</div>${groupLabel}${prop.price > 0 ? `<div class="space-price">₺${prop.price}</div>` : ''}${houseIndicator}`;

        board.appendChild(space);
    });

    // Arrange spaces in board grid
    arrangeBoardSpaces();
}

function arrangeBoardSpaces() {
    const spaces = document.querySelectorAll('.board-space');
    const positions = [
        // Top row (0-9) - START moves to top-left
        { col: 1, row: 1 }, // 0 - GO (now top-left)
        { col: 2, row: 1 }, { col: 3, row: 1 }, { col: 4, row: 1 },
        { col: 5, row: 1 }, { col: 6, row: 1 }, { col: 7, row: 1 },
        { col: 8, row: 1 }, { col: 9, row: 1 }, { col: 10, row: 1 },
        // Right column (10-19)
        { col: 11, row: 1 }, // 10 - Jail (now top-right)
        { col: 11, row: 2 }, { col: 11, row: 3 }, { col: 11, row: 4 },
        { col: 11, row: 5 }, { col: 11, row: 6 }, { col: 11, row: 7 },
        { col: 11, row: 8 }, { col: 11, row: 9 }, { col: 11, row: 10 },
        // Bottom row (20-29)
        { col: 11, row: 11 }, // 20 - Free Parking (now bottom-right)
        { col: 10, row: 11 }, { col: 9, row: 11 }, { col: 8, row: 11 },
        { col: 7, row: 11 }, { col: 6, row: 11 }, { col: 5, row: 11 },
        { col: 4, row: 11 }, { col: 3, row: 11 }, { col: 2, row: 11 },
        // Left column (30-39)
        { col: 1, row: 11 }, // 30 - Go to Jail (now bottom-left)
        { col: 1, row: 10 }, { col: 1, row: 9 }, { col: 1, row: 8 },
        { col: 1, row: 7 }, { col: 1, row: 6 }, { col: 1, row: 5 },
        { col: 1, row: 4 }, { col: 1, row: 3 }, { col: 1, row: 2 }
    ];

    spaces.forEach((space, i) => {
        if (positions[i]) {
            space.style.gridColumn = positions[i].col;
            space.style.gridRow = positions[i].row;
        }
    });
}

function animatePlayerMove(playerId, startPos, endPos, playerColor, callback, instant = false) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
        if (callback) callback();
        return;
    }
    // If instant move requested, teleport token to destination without step animation
    if (instant) {
        // Remove any existing tokens for this player
        const spaces = document.querySelectorAll('.board-space');
        spaces.forEach(space => {
            const tokens = space.querySelectorAll('.player-token');
            tokens.forEach(token => {
                if (token.dataset.playerId === playerId) token.remove();
            });
        });
        // Place token directly on target space
        const targetSpace = document.querySelector(`.board-space[data-id="${endPos}"]`);
        if (targetSpace) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.background = playerColor;
            token.style.borderColor = playerColor;
            token.title = player.name;
            token.dataset.playerId = playerId;
            token.dataset.playerColor = playerColor;
            token.textContent = getInitials(player.name, player.appearance) || '👤';
            token.style.fontSize = '0.78rem';
            targetSpace.appendChild(token);
        }
        player.position = endPos;
        if (callback) callback();
        return;
    }
    
    // Calculate path (handle wrapping around board)
    let currentPos = startPos;
    const steps = [];
    
    if (endPos >= startPos) {
        // Forward movement
        for (let i = startPos + 1; i <= endPos; i++) {
            steps.push(i);
        }
    } else {
        // Wrapping around (passing GO)
        for (let i = startPos + 1; i < 40; i++) {
            steps.push(i);
        }
        for (let i = 0; i <= endPos; i++) {
            steps.push(i);
        }
    }
    
    // Animate step by step
    let stepIndex = 0;
    const stepDelay = 150; // ms per step
    
    function moveNextStep() {
        if (stepIndex >= steps.length) {
            // Animation complete
            player.position = endPos;
            if (callback) callback();
            return;
        }
        
        const nextPos = steps[stepIndex];
        currentPos = nextPos;
        
        // Update token position visually
        const spaces = document.querySelectorAll('.board-space');
        spaces.forEach(space => {
            const tokens = space.querySelectorAll('.player-token');
            tokens.forEach(token => {
                if (token.dataset.playerId === playerId) {
                    token.remove();
                }
            });
        });
        
        // Add token to new position with moving class
        const targetSpace = document.querySelector(`.board-space[data-id="${currentPos}"]`);
        if (targetSpace) {
            const token = document.createElement('div');
            token.className = 'player-token moving';
            token.style.background = playerColor;
            token.style.borderColor = playerColor;
            token.title = player.name;
            token.dataset.playerId = playerId;
            token.dataset.playerColor = playerColor;
            token.textContent = getInitials(player.name, player.appearance) || '👤';
            token.style.fontSize = '0.78rem';
            targetSpace.appendChild(token);
            
            // Play move sound
            if (stepIndex === 0 || stepIndex % 3 === 0) {
                playSound('move');
            }
        }
        
        stepIndex++;
        setTimeout(moveNextStep, stepDelay);
    }
    
    moveNextStep();
}

// Helper: move local player to a specific board index (animates and updates state)
function moveTo(index) {
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;
    const start = player.position;
    const end = ((index % 40) + 40) % 40;
    animatePlayerMove(player.id, start, end, player.color, () => {
        // after animation, refresh board
        updateGameBoard();
    });
}

// Helper: move local player back N steps
function moveBack(steps) {
    if (!gameState) return;
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return;
    const start = player.position;
    const end = ((start - steps) % 40 + 40) % 40;
    animatePlayerMove(player.id, start, end, player.color, () => updateGameBoard());
}

// Helper: find next space matching predicate from current player's position
function findNextFromCurrent(predicate) {
    if (!gameState) return -1;
    const player = gameState.players.find(p => p.id === socket.id);
    if (!player) return -1;
    const start = player.position;
    for (let i = 1; i < 40; i++) {
        const idx = (start + i) % 40;
        const prop = gameState.properties[idx];
        if (prop && predicate(prop)) return idx;
    }
    return -1;
}

// Move to nearest railroad (demiryolu)
function goToNearestRailroad() {
    const idx = findNextFromCurrent(p => p.type === 'railroad');
    if (idx >= 0) moveTo(idx);
}

// Move to nearest chance/chest card space (type 'chance' or 'chest')
function goToNearestCard() {
    const idx = findNextFromCurrent(p => p.type === 'chance' || p.type === 'chest');
    if (idx >= 0) moveTo(idx);
}

// Generic: go to nearest space by type string (e.g., 'railroad','chance')
function goToNearest(type) {
    const idx = findNextFromCurrent(p => p.type === type);
    if (idx >= 0) moveTo(idx);
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
        // Remove active player highlight from all spaces
        space.classList.remove('active-player-space');
    });

    gameState.players.forEach((player, index) => {
        const space = document.querySelector(`.board-space[data-id="${player.position}"]`);
        if (space) {
            const token = document.createElement('div');
            token.className = 'player-token';
            token.style.background = player.color;
            token.style.borderColor = player.color;
            token.title = player.name;
            token.dataset.playerId = player.id;
            token.dataset.playerColor = player.color;
            // Show player initials (fits inside small circular token)
            token.textContent = getInitials(player.name, player.appearance) || '👤';
            token.style.fontSize = '0.78rem';
            space.appendChild(token);
            
            // Add active-player-space class to highlight the space where a player is
            space.classList.add('active-player-space');
        }
    });

    // Update property ownership indicators with owner color and initials
    spaces.forEach(space => {
        const propIndex = parseInt(space.dataset.id);
        const prop = gameState.properties[propIndex];
        
        // Remove existing owner badge
        const existingBadge = space.querySelector('.owner-badge');
        if (existingBadge) existingBadge.remove();
        
        if (prop && prop.owner) {
            const owner = gameState.players.find(p => p.id === prop.owner);
            space.classList.add('owned');
            space.style.opacity = '1';

            // Special types (chance/chest/railroad/utility): fill whole tile with owner color
            const specialTypes = ['chance', 'chest', 'railroad', 'utility'];
            if (owner && owner.color && specialTypes.includes(prop.type)) {
                space.style.background = `linear-gradient(135deg, ${hexToRgba(owner.color, 0.36)} 0%, ${hexToRgba(owner.color, 0.18)} 55%, rgba(15,23,42,0.06) 100%)`;
                space.style.boxShadow = `0 8px 26px ${hexToRgba(owner.color, 0.18)}, inset 0 0 0 2px rgba(0,0,0,0.12)`;
                space.style.borderBottom = `4px solid ${hexToRgba(owner.color, 0.9)}`;
            } else {
                // Regular properties: only show the thin owner band at the top of the tile
                if (owner && owner.color) {
                    space.style.setProperty('--owner-band-color', owner.color);
                }
                // Ensure we don't change the whole tile's base color — only the band
                space.style.removeProperty('background');
                space.style.removeProperty('boxShadow');
                space.style.removeProperty('borderBottom');
            }

            // Make tile text readable
            const nameEl = space.querySelector('.space-name');
            const priceEl = space.querySelector('.space-price');
            if (nameEl) nameEl.style.color = '#ffffff';
            if (priceEl) priceEl.style.color = '#ffffff';
            if (priceEl) priceEl.style.display = 'none';
            
            // Render houses / hotel on the board space
            const existingStruct = space.querySelector('.space-structures');
            if (existingStruct) existingStruct.remove();
            const structures = document.createElement('div');
            structures.className = 'space-structures';
            structures.style.position = 'absolute';
            structures.style.bottom = '6px';
            structures.style.left = '50%';
            structures.style.transform = 'translateX(-50%)';
            structures.style.display = 'flex';
            structures.style.gap = '4px';
            structures.style.zIndex = '6';
            if (prop.houses && prop.houses > 0) {
                if (prop.houses === 5) {
                    const hotel = document.createElement('div');
                    hotel.className = 'hotel-icon';
                    hotel.textContent = '🏨';
                    hotel.style.fontSize = '14px';
                    hotel.style.lineHeight = '1';
                    structures.appendChild(hotel);
                } else {
                    for (let i = 0; i < 4; i++) {
                        const dot = document.createElement('div');
                        dot.className = 'house-dot';
                        dot.style.width = '8px';
                        dot.style.height = '8px';
                        dot.style.borderRadius = '2px';
                        dot.style.background = i < prop.houses ? (prop.ownerColor || '#16a34a') : 'rgba(255,255,255,0.06)';
                        dot.style.border = '1px solid rgba(0,0,0,0.12)';
                        structures.appendChild(dot);
                    }
                }
                space.appendChild(structures);
            }
        } else if (prop) {
            space.classList.remove('owned');
            space.style.opacity = '1';
            space.style.borderBottom = 'none';
            // remove owner band color when unowned
            space.style.removeProperty('--owner-band-color');
            // Default colors per type when unowned
            let defaultBg = '';
            let defaultShadow = '';
            if (prop.type === 'chance') {
                defaultBg = '#fb923c1a';
                defaultShadow = '0 0 0 2px #fb923c33 inset';
            } else if (prop.type === 'chest') {
                defaultBg = '#16a34a1a';
                defaultShadow = '0 0 0 2px #16a34a33 inset';
            } else if (prop.type === 'railroad') {
                defaultBg = '#0284c71a';
                defaultShadow = '0 0 0 2px #0284c733 inset';
            } else if (prop.type === 'utility') {
                defaultBg = '#06b6d41a';
                defaultShadow = '0 0 0 2px #06b6d433 inset';
            } else if (prop.type === 'tax') {
                defaultBg = '#eab3081a';
                defaultShadow = '0 0 0 2px #eab30833 inset';
            } else if (prop.type === 'parking') {
                defaultBg = '#a855f71a';
                defaultShadow = '0 0 0 2px #a855f733 inset';
            } else if (prop.type === 'gotojail') {
                defaultBg = '#ef44441a';
                defaultShadow = '0 0 0 2px #ef444433 inset';
            } else if (prop.type === 'go') {
                defaultBg = '#22c55e1a';
                defaultShadow = '0 0 0 2px #22c55e33 inset';
            }
            space.style.background = defaultBg;
            space.style.boxShadow = defaultShadow;
            
            // Text renklerini sıfırla veya kontrast sağla
            const nameEl = space.querySelector('.space-name');
            const priceEl = space.querySelector('.space-price');
            if (nameEl) nameEl.style.color = defaultBg ? '#ffffff' : '';
            if (priceEl) priceEl.style.color = defaultBg ? '#ffffff' : '';
            
            // Show price only on buyable properties
            if (priceEl) priceEl.style.display = (prop.type === 'property' || prop.type === 'railroad' || prop.type === 'utility') ? 'block' : 'none';
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
        
        // Oyuncunun token rengini kullan
        const playerColor = me.color || '#60a5fa';
        
        // Mülkün kendi rengini colorDot için kullan
        const colorDot = prop.color ? `<span class="prop-dot" style="background:${prop.color}"></span>` : '<span class="prop-dot" style="background: #94a3b8"></span>';
        const rentText = prop.rent && prop.rent.length ? `Kira: ₺${prop.rent[0]}` : 'Kira: -';
        const priceText = prop.price ? `₺${prop.price}` : '-';
        
        // Kartın arka planını ve border'ını oyuncu rengine göre ayarla
        item.style.background = `linear-gradient(135deg, ${playerColor}22, ${playerColor}08)`;
        item.style.borderLeft = `4px solid ${playerColor}`;
        item.style.boxShadow = `0 2px 8px ${playerColor}33`;
        
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
    
    // Slider'ları güncelle - özellikle requestSlider için max değeri
    updateTradeSliders();
}

function rollDice() {
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = true;
    // Start visual + audio rolling feedback immediately
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    if (dice1El) dice1El.classList.add('rolling');
    if (dice2El) { dice2El.style.display = 'flex'; dice2El.classList.add('rolling'); }
    startDiceRollSound();
    socket.emit('rollDice');
    // keep button disabled until server responds / movement finishes; safety fallback
    setTimeout(() => { if (rollBtn) rollBtn.disabled = false; }, 5000);
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

    // Render visual house / hotel indicators in popup
    const structuresEl = document.getElementById('propStructures');
    if (structuresEl) {
        let structuresHTML = '';
        const houses = property.houses || 0;
        if (houses === 5) {
            structuresHTML = `<span class="hotel-icon">🏨</span>`;
        } else {
            // render 4 slots, some filled
            for (let i = 1; i <= 4; i++) {
                if (i <= houses) structuresHTML += `<span class="house-dot"></span>`;
                else structuresHTML += `<span class="house-dot empty"></span>`;
            }
        }
        structuresEl.innerHTML = structuresHTML;
    }

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

        const houseCost = Math.ceil((property.price || 0) * 0.6);
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
    // Advance turn only if player didn't buy property and explicitly closed
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
    const roStructuresEl = document.getElementById('roPropStructures');
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
    // Render visual structures for readonly popup
    if (roStructuresEl) {
        let structuresHTML = '';
        const houses = property.houses || 0;
        if (houses === 5) {
            structuresHTML = `<span class="hotel-icon">🏨</span>`;
        } else {
            for (let i = 1; i <= 4; i++) {
                structuresHTML += (i <= houses) ? `<span class="house-dot"></span>` : `<span class="house-dot empty"></span>`;
            }
        }
        roStructuresEl.innerHTML = structuresHTML;
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
        // Check for YouTube music commands
        if (message.startsWith('!play ') || message.startsWith('!p ') || message.startsWith('/p ')) {
            const link = message.replace(/^(!play|!p)\s+/, '').trim();
            if (link) {
                const videoId = extractYouTubeVideoId(link);
                if (videoId) {
                    socket.emit('playYoutubeMusic', { videoId, link });
                    chatInput.value = '';
                    return;
                } else {
                    // Show error in chat
                    const chatDiv = document.getElementById('chatMessages');
                    const msgEl = document.createElement('div');
                    msgEl.className = 'chat-message';
                    msgEl.innerHTML = `
                        <div class="chat-message-author" style="color: #ef4444;">❌ Sistem</div>
                        <div>Geçersiz YouTube linki!</div>
                    `;
                    chatDiv.appendChild(msgEl);
                    setTimeout(() => {
                        chatDiv.scrollTop = chatDiv.scrollHeight;
                    }, 10);
                    chatInput.value = '';
                    return;
                }
            }
        } else if (message === '!stop' || message === '/stop') {
            stopYoutubeMusic();
            chatInput.value = '';
            return;
        }
        
        // Send public message
        socket.emit('sendMessage', { message });
        chatInput.value = '';
    }
}

function handleChatKeypress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

function openGiphyPicker() {
    // Open Giphy in a new window
    const giphyWindow = window.open('https://giphy.com/', 'GiphyPicker', 'width=800,height=600,menubar=no,toolbar=no,location=no');
    
    // Show instructions in chat
    const chatDiv = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `
        <div class="chat-message-author" style="color: #9333ea;">🎬 GIF Sistemi</div>
        <div style="color: #60a5fa;">Giphy'den GIF seç, sağ tıklayıp "Copy Image Address" (Resim Adresini Kopyala) yap ve buraya yapıştır!</div>
    `;
    chatDiv.appendChild(msgEl);
    setTimeout(() => {
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }, 10);
}

function togglePanel(panelClass) {
    const panel = document.querySelector('.' + panelClass);
    if (panel) {
        panel.classList.toggle('minimized');
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

function addBoardEvent(message, playerColor = null) {
    const boardDisplay = document.getElementById('boardEventDisplay');
    if (!boardDisplay) return;

    // Clear previous message and show new one
    boardDisplay.textContent = message;
    boardDisplay.style.display = 'block';
    
    // Apply player color if provided
    if (playerColor) {
        boardDisplay.style.color = playerColor;
        boardDisplay.style.textShadow = `0 0 10px ${playerColor}80, 0 2px 4px rgba(0,0,0,0.8)`;
    } else {
        boardDisplay.style.color = '#60a5fa';
        boardDisplay.style.textShadow = '0 0 10px rgba(96, 165, 250, 0.5), 0 2px 4px rgba(0,0,0,0.8)';
    }

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

    const targetId = document.getElementById('tradeWithPlayer')?.value;
    const other = gameState.players.find(p => p.id === targetId);

    const offerSlider = document.getElementById('tradeMoneyOffer');
    const requestSlider = document.getElementById('tradeMoneyRequest');

    if (offerSlider) {
        offerSlider.max = me.money;
        offerSlider.value = Math.min(parseInt(offerSlider.value) || 0, me.money);
        updateTradeMoneyOffer();
    }

    if (requestSlider) {
        // Set max to target player's money if they're selected
        const maxRequest = other ? other.money : 10000;
        requestSlider.max = maxRequest;
        requestSlider.value = Math.min(parseInt(requestSlider.value) || 0, maxRequest);
        updateTradeMoneyRequest();
    }
}

function proposeTrade() {
    const targetId = document.getElementById('tradeWithPlayer')?.value;
    if (!targetId || targetId === 'Oyuncu seç...') {
        alert('Önce bir oyuncu seç!');
        return;
    }
    
    const me = gameState.players.find(p => p.id === socket.id);
    const other = gameState.players.find(p => p.id === targetId);
    
    if (!me || !other) {
        alert('Oyuncu bulunamadı!');
        return;
    }
    
    const offerMoney = Math.max(0, parseInt(document.getElementById('tradeMoneyOffer')?.value || 0));
    const requestMoney = Math.max(0, parseInt(document.getElementById('tradeMoneyRequest')?.value || 0));
    
    // Validasyonlar
    if (offerMoney > me.money) {
        alert(`Yeterli paran yok! Sahip olduğun: ₺${me.money}`);
        return;
    }
    
    if (requestMoney > other.money) {
        alert(`${other.name} oyuncusunun yeterli parası yok! Sahip olduğu: ₺${other.money}`);
        return;
    }
    
    const myPropIds = Array.from(document.querySelectorAll('.my-prop:checked')).map(i => parseInt(i.value));
    const theirPropIds = Array.from(document.querySelectorAll('.their-prop:checked')).map(i => parseInt(i.value));
    
    // En az bir şey teklif edilmeli
    if (offerMoney === 0 && requestMoney === 0 && myPropIds.length === 0 && theirPropIds.length === 0) {
        alert('En az bir şey teklif etmelisin!');
        return;
    }

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
    try { playSound('dice'); } catch (e) { console.log('Dice sound failed', e); }
    socket.emit('rollForJail');
    closeJailModal();
}

function useJailCard() {
    socket.emit('useJailCard');
    closeJailModal();
}

function closeJailModal() {
    const modal = document.getElementById('jailModal');
    if (modal) modal.style.display = 'none';
}

socket.on('jailReleased', (data) => {
    addEvent(`👮 ${data.player.name} hapishaneden çıktı: ${data.reason}`);
    
    // Show toast and achievement
    showToast(`🔓 Hapishaneden çıktın!`, 'success', 4000);
    showAchievement('escapedJail');

    // Ensure jail modal is closed when player is released
    closeJailModal();

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
    
    // Show dice result for failed jail roll
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    const resultEl = document.getElementById('diceResult');
    
    if (dice1El && dice2El && resultEl) {
        // Animate both dice
        dice1El.classList.add('rolling');
        dice2El.classList.add('rolling');
        dice2El.style.display = 'flex';
        
        setTimeout(() => {
            dice1El.setAttribute('data-value', data.dice1);
            dice2El.setAttribute('data-value', data.dice2);
            resultEl.textContent = `Toplam: ${data.dice1 + data.dice2}`;
            dice1El.classList.remove('rolling');
            dice2El.classList.remove('rolling');
        }, 800);
    }
});

// Check if current player is in jail and show jail modal
function checkJailStatus() {
    const currentPlayer = gameState.players[gameState.currentTurn];
    // Only show the jail modal if it's your turn AND you're actually serving a jail turn
    // (i.e. jailTurns > 0). This prevents the modal from appearing immediately when
    // a player is sent to jail; their turn is advanced and the modal appears when
    // the jailed player's turn comes up again.
    if (currentPlayer && currentPlayer.id === socket.id && currentPlayer.inJail) {
        const turns = currentPlayer.jailTurns || 0;
        if (turns > 0) {
            showJailModal(currentPlayer);
        } else {
            // If jailTurns === 0, the player was just sent to jail this round; don't show modal now.
            console.log('🔒 Player in jail but jailTurns=0; skipping modal until their next turn');
        }
    }
}

function showJailModal(player) {
    const modal = document.getElementById('jailModal');
    const turnsLeftEl = document.getElementById('jailTurnsLeft');
    const useJailCardBtn = document.getElementById('useJailCardBtn');
    const jailCardCount = document.getElementById('jailCardCount');
    
    if (modal && turnsLeftEl) {
        const turnsLeft = Math.max(0, 3 - (player.jailTurns || 0));
        turnsLeftEl.textContent = `Kalan tur: ${turnsLeft}`;
        
        // Show/hide jail card button based on card count
        if (useJailCardBtn && jailCardCount) {
            const cardCount = player.freeJailCards || 0;
            jailCardCount.textContent = cardCount;
            useJailCardBtn.style.display = cardCount > 0 ? 'block' : 'none';
        }
        
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
    // Add to event log with player color
    const tradeColor = payload.fromColor || '#60a5fa';
    if (payload.tradeMessage) {
        addEvent(payload.tradeMessage, tradeColor);
        // Get initiator color for trade message
        const initiatorPlayer = gameState.players.find(p => p.id === payload.initiatorId);
        addBoardEvent(payload.tradeMessage, initiatorPlayer ? initiatorPlayer.color : null);
    } else {
        addEvent(`💱 Takas tamamlandı: ${payload.message}`, tradeColor);
    }
    
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
    
    playSound('soundBuy');
});

socket.on('pendingTradesUpdate', (data) => {
    updatePendingTradesList(data.trades || []);
});

function updatePendingTradesList(trades) {
    const listEl = document.getElementById('pendingTradesList');
    const countEl = document.getElementById('pendingTradeCount');
    
    if (!listEl || !countEl) return;
    
    countEl.textContent = trades.length;
    
    if (trades.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; color: rgba(255,255,255,0.5); padding: 10px; font-size: 0.9em;">
                Bekleyen teklif yok
            </div>
        `;
        return;
    }
    
    listEl.innerHTML = trades.map(trade => {
        const offering = [];
        if (trade.myPropIds.length > 0) offering.push(`${trade.myPropIds.length} mülk`);
        if (trade.offerMoney > 0) offering.push(`₺${trade.offerMoney}`);
        const offerText = offering.join(' + ') || 'Hiçbir şey';
        
        const requesting = [];
        if (trade.theirPropIds.length > 0) requesting.push(`${trade.theirPropIds.length} mülk`);
        if (trade.requestMoney > 0) requesting.push(`₺${trade.requestMoney}`);
        const requestText = requesting.join(' + ') || 'Hiçbir şey';
        
        const timeAgo = Math.floor((Date.now() - trade.timestamp) / 1000);
        const timeText = timeAgo < 60 ? `${timeAgo}s önce` : `${Math.floor(timeAgo / 60)}dk önce`;
        
        return `
            <div style="background: linear-gradient(90deg, ${trade.fromColor}22, transparent); border-left: 4px solid ${trade.fromColor}; padding: 10px; border-radius: 6px; font-size: 0.85em;">
                <div style="font-weight: 700; margin-bottom: 5px; color: ${trade.fromColor};">
                    👤 ${trade.fromName}
                    <span style="float: right; color: rgba(255,255,255,0.5); font-size: 0.9em; font-weight: 400;">${timeText}</span>
                </div>
                <div style="margin: 4px 0;">
                    <span style="color: rgba(255,255,255,0.7);">📤 Veriyor:</span> ${offerText}
                </div>
                <div style="margin: 4px 0;">
                    <span style="color: rgba(255,255,255,0.7);">📥 İstiyor:</span> ${requestText}
                </div>
                <div style="margin-top: 8px; display: flex; gap: 6px;">
                    <button onclick="viewTradeOffer('${trade.id}')" style="flex: 1; padding: 4px 8px; background: ${trade.fromColor}; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.85em; font-weight: 600;">
                        👁️ Görüntüle
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function viewTradeOffer(tradeId) {
    // This will show the trade offer in a dedicated view
    console.log('Viewing trade:', tradeId);
    // For now, just trigger the existing trade offer handler
}

// Bankruptcy modal functions
function declareBankruptcy() {
    const modal = document.getElementById('bankruptcyModal');
    if (modal) modal.style.display = 'flex';
}

function closeBankruptcyModal() {
    const modal = document.getElementById('bankruptcyModal');
    if (modal) modal.style.display = 'none';
}

function confirmBankruptcy() {
    socket.emit('declareBankruptcy');
    
    // Close modal
    closeBankruptcyModal();
    
    // Hide bankruptcy button after declaring
    const bankruptBtn = document.getElementById('bankruptBtn');
    if (bankruptBtn) bankruptBtn.style.display = 'none';
}

// Handle bankruptcy events
socket.on('playerBankrupt', (data) => {
    addEvent(`💸 ${data.message}`, data.player.color);
    addBoardEvent(`${data.player.name} iflas etti!`, data.player.color);
    
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

socket.on('gameWon', (data) => {
    console.log('🏆 Game won:', data);
    setTimeout(() => {
        showVictoryModal(data.winner, data.playerStats);
    }, 2000); // Wait 2 seconds to let players see the bankruptcy message
});

function showVictoryModal(winner, playerStats) {
    const modal = document.getElementById('victoryModal');
    const winnerInfo = document.getElementById('winnerInfo');
    const statsContainer = document.getElementById('playerStatsContainer');

    // Build winner info HTML
    winnerInfo.innerHTML = `
        <div class="winner-name" style="color: ${winner.color};">
            ${winner.name}
        </div>
        <div class="winner-stats">
            <div class="winner-stat-item">
                <div class="winner-stat-label">💰 Para</div>
                <div class="winner-stat-value">€${winner.money}</div>
            </div>
            <div class="winner-stat-item">
                <div class="winner-stat-label">🏘️ Mülk</div>
                <div class="winner-stat-value">${winner.properties}</div>
            </div>
        </div>
    `;

    // Build player stats HTML
    statsContainer.innerHTML = playerStats.map((player, index) => {
        const rankClass = player.isWinner ? 'winner-rank' : (player.isBankrupt ? 'bankrupt-rank' : '');
        const statusText = player.isWinner ? '👑 Kazanan' : (player.isBankrupt ? '💸 İflas' : '🎮 Oyuncu');
        
        return `
            <div class="player-stat-card ${rankClass}">
                <div class="player-rank ${index === 0 ? 'rank-1' : ''}">
                    ${index + 1}
                </div>
                <div class="player-stat-info">
                    <div class="player-stat-name" style="color: ${player.color};">
                        ${player.name}
                    </div>
                    <div class="player-stat-status">${statusText}</div>
                </div>
                <div class="player-stat-money">
                    <div class="player-stat-label-small">Para</div>
                    <div style="color: ${player.isBankrupt ? '#ef4444' : '#10b981'};">
                        €${player.money}
                    </div>
                </div>
                <div class="player-stat-properties">
                    <div class="player-stat-label-small">Mülk</div>
                    <div style="color: #60a5fa;">
                        ${player.properties}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    modal.style.display = 'flex';
    playSound('soundWin');
}

function closeVictoryModal() {
    document.getElementById('victoryModal').style.display = 'none';
}

function returnToMainMenu() {
    closeVictoryModal();
    leaveLobby();
}

// Select player color from board center
function selectPlayerColor(color) {
    // Check if color is already taken
    if (currentLobby) {
        const myPlayer = currentLobby.players.find(p => p.id === socket.id);
        const isTaken = currentLobby.players.some(p => p.color === color && p.id !== socket.id);
        
        if (isTaken) {
            const takenBy = currentLobby.players.find(p => p.color === color);
            alert(`Bu renk ${takenBy?.name} tarafından seçildi. Lütfen başka renk seçin.`);
            return;
        }
    }
    
    const preview = document.getElementById('selectedColorPreview');
    if (preview) {
        preview.style.background = `linear-gradient(135deg, ${color}44, ${color}22)`;
        preview.style.color = color;
        preview.style.borderLeft = `4px solid ${color}`;
        preview.textContent = `✓ Renk seçildi`;
    }
    
    // Update player color
    selectedColor = color;
    socket.emit('updatePlayer', { color });
    console.log('🎨 Renk seçildi:', color);
}

// Emoji Panel & Effects
let emojiPanelOpen = false;

function toggleEmojiPanel() {
    emojiPanelOpen = !emojiPanelOpen;
    const panel = document.getElementById('emojiPanel');
    if (panel) {
        panel.style.display = emojiPanelOpen ? 'block' : 'none';
    }
    
    // Close private chat if open
    if (emojiPanelOpen) {
        const privatePanel = document.getElementById('privateChatSelector');
        if (privatePanel) privatePanel.style.display = 'none';
    }
}

function sendEmoji(emoji) {
    if (!gameState || !currentLobby) return;
    
    // Play sound effect
    playSound('soundDice'); // Reuse dice sound for now
    
    // Send to server to broadcast to all players
    socket.emit('sendEmoji', { emoji });
    
    // Close emoji panel
    toggleEmojiPanel();
}

// Listen for emoji effects from server
socket.on('emojiEffect', (data) => {
    showEmojiEffect(data.emoji, data.playerName, data.playerColor);
});

function showEmojiEffect(emoji, playerName, playerColor) {
    const container = document.getElementById('emojiEffectContainer');
    if (!container) return;
    
    // Random position on screen
    const x = Math.random() * (window.innerWidth - 100) + 50;
    const y = Math.random() * (window.innerHeight - 200) + 100;
    
    // Create emoji element
    const emojiEl = document.createElement('div');
    emojiEl.className = 'emoji-effect';
    emojiEl.textContent = emoji;
    emojiEl.style.left = x + 'px';
    emojiEl.style.top = y + 'px';
    
    // Add sender label
    const label = document.createElement('div');
    label.className = 'emoji-sender-label';
    label.textContent = playerName;
    label.style.color = playerColor;
    emojiEl.appendChild(label);
    
    container.appendChild(emojiEl);
    
    // Remove after animation (7 seconds)
    setTimeout(() => {
        emojiEl.remove();
    }, 7000);
}

// YouTube Music Functions
let currentYoutubePlayer = null;
let youtubePlayerReady = false;

// Load YouTube IFrame API
function loadYouTubeAPI() {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    youtubePlayerReady = true;
    console.log('🎵 YouTube API Ready');
};

function extractYouTubeVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// YouTube music now controlled via chat commands (!play <link> or !p <link>)

socket.on('youtubeMusicPlay', (data) => {
    const { videoId, playerName } = data;
    
    // Add chat message
    const chatDiv = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `
        <div class="chat-message-author" style="color: #ff0000;">🎵 YouTube Müzik</div>
        <div style="color: #60a5fa;">${playerName} bir müzik açtı! Başlık yükleniyor...</div>
    `;
    chatDiv.appendChild(msgEl);
    setTimeout(() => {
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }, 10);
    
    // Initialize YouTube player if not exists
    if (!currentYoutubePlayer) {
        loadYouTubeAPI();
        
        // Wait for API to load
        const checkAPI = setInterval(() => {
            if (window.YT && window.YT.Player) {
                clearInterval(checkAPI);
                
                // Create hidden player container
                if (!document.getElementById('youtubePlayerContainer')) {
                    const container = document.createElement('div');
                    container.id = 'youtubePlayerContainer';
                    container.style.display = 'none';
                    document.body.appendChild(container);
                }
                
                currentYoutubePlayer = new YT.Player('youtubePlayerContainer', {
                    height: '0',
                    width: '0',
                    videoId: videoId,
                    playerVars: {
                        'autoplay': 0,
                        'controls': 0,
                        'disablekb': 1,
                        'fs': 0,
                        'modestbranding': 1,
                        'rel': 0
                    },
                    events: {
                        'onReady': (event) => {
                            event.target.setVolume(50);
                            event.target.playVideo();
                            showCurrentMusic(videoId, playerName);
                        },
                        'onStateChange': (event) => {
                            if (event.data === YT.PlayerState.ENDED) {
                                hideCurrentMusic();
                            }
                        }
                    }
                });
            }
        }, 100);
    } else {
        // Player exists, just load new video
        currentYoutubePlayer.loadVideoById(videoId);
        currentYoutubePlayer.setVolume(50);
        showCurrentMusic(videoId, playerName);
    }
});

function showCurrentMusic(videoId, playerName) {
    const currentMusicDiv = document.getElementById('currentYoutubeMusic');
    if (currentMusicDiv) {
        currentMusicDiv.style.display = 'block';
    }
    // Update chat with video title if available
    try {
        const data = currentYoutubePlayer && currentYoutubePlayer.getVideoData ? currentYoutubePlayer.getVideoData() : null;
        const title = data && data.title ? data.title : null;
        if (title) {
            const chatDiv = document.getElementById('chatMessages');
            const msgEl = document.createElement('div');
            msgEl.className = 'chat-message';
            msgEl.innerHTML = `
                <div class="chat-message-author" style="color: #ff0000;">🎵 YouTube Müzik</div>
                <div style="color: #60a5fa;"><strong>${playerName}</strong> şu videoyu açtı: <em>${title}</em></div>
            `;
            chatDiv.appendChild(msgEl);
            setTimeout(() => { chatDiv.scrollTop = chatDiv.scrollHeight; }, 10);
        }
    } catch (e) {
        // ignore
    }
}

function hideCurrentMusic() {
    const currentMusicDiv = document.getElementById('currentYoutubeMusic');
    if (currentMusicDiv) {
        currentMusicDiv.style.display = 'none';
    }
}

function stopYoutubeMusic() {
    if (currentYoutubePlayer) {
        currentYoutubePlayer.stopVideo();
        hideCurrentMusic();
        socket.emit('stopYoutubeMusic');
    }
}

socket.on('youtubeMusicStop', (data) => {
    if (currentYoutubePlayer) {
        currentYoutubePlayer.stopVideo();
        hideCurrentMusic();
    }
    
    // Add chat message
    const chatDiv = document.getElementById('chatMessages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-message';
    msgEl.innerHTML = `
        <div class="chat-message-author" style="color: #ff0000;">🎵 YouTube Müzik</div>
        <div style="color: #ef4444;">${data.playerName} müziği durdurdu.</div>
    `;
    chatDiv.appendChild(msgEl);
    setTimeout(() => {
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }, 10);
});

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        money: '💰',
        property: '🏠',
        jail: '👮',
        dice: '🎲'
    };
    
    toast.innerHTML = `
        <div class="toast-content">
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-text">${message}</div>
            <button class="toast-close" onclick="this.parentElement.parentElement.remove()">✕</button>
        </div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'toastSlideOut 0.3s ease-in-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
    
    // Click to remove
    toast.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            toast.style.animation = 'toastSlideOut 0.3s ease-in-out';
            setTimeout(() => toast.remove(), 300);
        }
    });
}

// ===== MONEY ANIMATION SYSTEM =====
function showMoneyAnimation(amount, x, y) {
    const container = document.getElementById('moneyAnimationContainer');
    if (!container) return;
    
    const moneyEl = document.createElement('div');
    moneyEl.className = `money-float ${amount > 0 ? 'positive' : 'negative'}`;
    moneyEl.textContent = amount > 0 ? `+${amount}` : amount;
    moneyEl.style.left = `${x}px`;
    moneyEl.style.top = `${y}px`;
    
    container.appendChild(moneyEl);
    
    setTimeout(() => moneyEl.remove(), 2000);
}

// ===== ACHIEVEMENT SYSTEM =====
const achievements = {
    firstProperty: { icon: '🏠', title: 'İlk Mülk!', desc: 'İlk mülkünü satın aldın', unlocked: false },
    fiveProperties: { icon: '🏘️', title: 'Emlakçı', desc: '5 mülk sahibi oldun', unlocked: false },
    firstHouse: { icon: '🏗️', title: 'İnşaat Başladı', desc: 'İlk evini inşa ettin', unlocked: false },
    firstHotel: { icon: '🏨', title: 'Otel Kralı', desc: 'İlk otelini inşa ettin', unlocked: false },
    escapedJail: { icon: '🔓', title: 'Özgürlük', desc: 'Hapishaneden çıktın', unlocked: false },
    millionaire: { icon: '💎', title: 'Milyoner', desc: '5000₺ biriktirdin', unlocked: false },
    bankrupter: { icon: '💸', title: 'İflas Ettirici', desc: 'Bir oyuncuyu iflas ettirdin', unlocked: false },
    luckyRoll: { icon: '🎲', title: 'Şanslı Zar', desc: 'Çift 6 attın', unlocked: false }
};

function showAchievement(key) {
    if (achievements[key].unlocked) return;
    achievements[key].unlocked = true;
    
    const container = document.getElementById('achievementContainer');
    if (!container) return;
    
    const achievement = achievements[key];
    const achievementEl = document.createElement('div');
    achievementEl.className = 'achievement';
    
    achievementEl.innerHTML = `
        <div class="achievement-content">
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-text">
                <div class="achievement-title">🏆 ${achievement.title}</div>
                <div class="achievement-description">${achievement.desc}</div>
            </div>
        </div>
    `;
    
    container.appendChild(achievementEl);
    
    // Play sound
    playSound('achievement');
    
    // Auto remove
    setTimeout(() => {
        achievementEl.style.animation = 'achievementSlideOut 0.4s ease-in-out';
        setTimeout(() => achievementEl.remove(), 400);
    }, 5000);
}

// Check achievements based on game state
function checkAchievements(player) {
    if (!player) return;
    
    // First property
    if (player.properties && player.properties.length === 1) {
        showAchievement('firstProperty');
    }
    
    // Five properties
    if (player.properties && player.properties.length === 5) {
        showAchievement('fiveProperties');
    }
    
    // Millionaire
    if (player.money >= 5000) {
        showAchievement('millionaire');
    }
}

// ===== SOUND EFFECTS SYSTEM =====
let audioContext = null;
let audioUnlocked = false;
const sounds = {
    dice: new Audio('/sounds/dice.mp3'),
    money: new Audio('/sounds/money.mp3'),
    buy: new Audio('/sounds/buy.mp3'),
    card: new Audio('/sounds/card.mp3'),
    jail: new Audio('/sounds/jail.mp3'),
    achievement: new Audio('/sounds/achievement.mp3'),
    auction: new Audio('/sounds/auction.mp3'),
    move: new Audio('/sounds/move.mp3')
};

// Set volume for all sounds
Object.values(sounds).forEach(sound => {
    sound.volume = 0.3;
});

function unlockAudio() {
    if (audioUnlocked) return;
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContext.resume().then(() => {
            audioUnlocked = true;
        }).catch(() => {
            audioUnlocked = true;
        });
    } catch (e) {
        audioUnlocked = true;
    }
}

// Unlock audio on first user interaction
['click','touchstart','keydown'].forEach(evt => {
    window.addEventListener(evt, unlockAudio, { once: true });
});

function webAudioBeep(kind) {
    try {
        if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.type = 'sine';
        const freqMap = { dice: 420, move: 520, buy: 660, money: 360, card: 480, jail: 300, achievement: 800, auction: 700 };
        osc.frequency.value = freqMap[kind] || 500;
        gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(audioContext.destination);
        osc.start();
        osc.stop(audioContext.currentTime + 0.18);
    } catch (e) {
        // ignore
    }
}

function playSound(soundName) {
    const s = sounds[soundName];
    if (s) {
        s.currentTime = 0;
        s.play().catch(() => {
            // Fallback to WebAudio beep if file missing or play blocked
            webAudioBeep(soundName);
        });
    } else {
        webAudioBeep(soundName);
    }
}

// ===== STATISTICS SYSTEM =====
function showStatistics() {
    const modal = document.getElementById('statisticsModal');
    const content = document.getElementById('statisticsContent');
    
    if (!modal || !content || !gameState) return;
    
    const players = gameState.players;
    
    // Calculate statistics
    const stats = players.map(player => {
        const propertyCount = player.properties ? player.properties.length : 0;
        const totalHouses = gameState.properties
            .filter(p => p.owner === player.id)
            .reduce((sum, p) => sum + (p.houses || 0), 0);
        
        return {
            name: player.name,
            appearance: player.appearance,
            color: player.color,
            money: player.money,
            propertyCount,
            totalHouses,
            inJail: player.inJail,
            isBankrupt: player.isBankrupt
        };
    });
    
    // Sort by money
    stats.sort((a, b) => b.money - a.money);
    
    // Generate HTML
    let html = '<h3 style="margin-bottom: 20px;">💰 Para Durumu</h3>';
    stats.forEach((stat, index) => {
        html += `
            <div class="stat-item" style="border-left: 4px solid ${stat.color}; ${stat.isBankrupt ? 'opacity: 0.5;' : ''}">
                <div class="stat-label">
                    <span style="font-size: 1.2em;">${index + 1}. ${stat.appearance} ${stat.name}</span>
                    ${stat.isBankrupt ? '<span style="color: #ef4444; margin-left: 10px;">💀 İflas</span>' : ''}
                </div>
                <div class="stat-value">${stat.money} ${gameState.currency || '₺'}</div>
            </div>
        `;
    });
    
    html += '<h3 style="margin: 30px 0 20px;">🏠 Mülk Durumu</h3>';
    stats.forEach(stat => {
        if (stat.propertyCount > 0) {
            html += `
                <div class="stat-item" style="border-left: 4px solid ${stat.color}">
                    <div class="stat-label">${stat.appearance} ${stat.name}</div>
                    <div class="stat-value">${stat.propertyCount} mülk, ${stat.totalHouses} yapı</div>
                </div>
            `;
        }
    });
    
    content.innerHTML = html;
    modal.style.display = 'flex';
}

function closeStatisticsModal() {
    const modal = document.getElementById('statisticsModal');
    if (modal) modal.style.display = 'none';
}

// ===== AUCTION SYSTEM =====
let currentAuction = null;
let auctionTimer = null;

function startAuction(property) {
    const modal = document.getElementById('auctionModal');
    if (!modal || !property) return;
    
    currentAuction = {
        property: property,
        currentBid: 0,
        highestBidder: null,
        timeLeft: 30
    };
    
    updateAuctionDisplay();
    modal.style.display = 'flex';
    
    playSound('auction');
    showToast(`🔨 ${property.name} için açık arttırma başladı!`, 'info', 5000);
    
    // Start timer
    auctionTimer = setInterval(() => {
        currentAuction.timeLeft--;
        updateAuctionDisplay();
        
        if (currentAuction.timeLeft <= 0) {
            endAuction();
        }
    }, 1000);
}

function updateAuctionDisplay() {
    if (!currentAuction) return;
    
    const nameEl = document.getElementById('auctionPropertyName');
    const bidEl = document.getElementById('auctionCurrentBid');
    const timerEl = document.getElementById('auctionTimer');
    
    if (nameEl) nameEl.textContent = currentAuction.property.name;
    if (bidEl) bidEl.textContent = `₺${currentAuction.currentBid || 'Teklif Yok'}`;
    if (timerEl) timerEl.textContent = `⏰ ${currentAuction.timeLeft} saniye`;
}

function placeBid() {
    const input = document.getElementById('auctionBidInput');
    const bidAmount = parseInt(input.value);
    
    if (!bidAmount || bidAmount <= currentAuction.currentBid) {
        showToast('❌ Teklif mevcut tekliften yüksek olmalı!', 'error');
        return;
    }
    
    const currentPlayer = gameState.players[gameState.currentTurn];
    if (currentPlayer.money < bidAmount) {
        showToast('❌ Yeterli paran yok!', 'error');
        return;
    }
    
    currentAuction.currentBid = bidAmount;
    currentAuction.highestBidder = currentPlayer;
    currentAuction.timeLeft = Math.max(10, currentAuction.timeLeft); // Reset to 10 seconds minimum
    
    updateAuctionDisplay();
    showToast(`✅ ${currentPlayer.name} - ₺${bidAmount} teklif verdi!`, 'success');
    playSound('money');
    
    input.value = '';
}

function passAuction() {
    showToast('👋 Arttırmayı pas geçtin', 'info');
    closeAuctionModal();
}

function endAuction() {
    if (auctionTimer) clearInterval(auctionTimer);
    
    if (currentAuction.highestBidder) {
        const winner = currentAuction.highestBidder;
        winner.money -= currentAuction.currentBid;
        currentAuction.property.owner = winner.id;
        
        showToast(`🎉 ${winner.name} - ${currentAuction.property.name}'i ₺${currentAuction.currentBid}'e aldı!`, 'success', 6000);
        playSound('buy');
    } else {
        showToast('😔 Kimse teklif vermedi, mülk satılmadı.', 'warning');
    }
    
    closeAuctionModal();
}

function closeAuctionModal() {
    const modal = document.getElementById('auctionModal');
    if (modal) modal.style.display = 'none';
    if (auctionTimer) clearInterval(auctionTimer);
    currentAuction = null;
}

console.log('🎮 Oyun yüklendi ve hazır!');
