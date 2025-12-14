const socket = io();

let currentLobbyId = null;
let currentPlayerId = null;
let gameState = null;
let currentTrade = null;
let selectedCountry = 'usa';
let selectedAppearance = '👤';
let isHost = false;

// Simple global functions for onclick
function selectAppearance(element) {
    console.log('Appearance clicked via onclick');
    document.querySelectorAll('.appearance-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    selectedAppearance = element.getAttribute('data-appearance');
    console.log('Selected appearance:', selectedAppearance);
}

function selectCountry(element) {
    console.log('Country clicked via onclick');
    document.querySelectorAll('.country-card').forEach(c => c.classList.remove('selected'));
    element.classList.add('selected');
    selectedCountry = element.getAttribute('data-country');
    console.log('Selected country:', selectedCountry);
}

// Initialize sound manager after user interaction
let soundEnabled = false;
document.addEventListener('click', () => {
    if (!soundEnabled && window.soundManager) {
        soundEnabled = true;
        window.soundManager.audioContext.resume();
    }
}, { once: true });

// Initialize selectors when page loads
window.addEventListener('load', () => {
    console.log('Initializing selectors...');
    initializeAppearanceSelector();
    initializeCountrySelector();
});

function initializeAppearanceSelector() {
    const appearanceCards = document.querySelectorAll('.appearance-card');
    console.log('Found appearance cards:', appearanceCards.length);
    
    appearanceCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('Appearance clicked:', this.getAttribute('data-appearance'));
            
            appearanceCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedAppearance = this.getAttribute('data-appearance');
            
            if (window.soundManager) {
                try {
                    window.soundManager.buttonClick();
                } catch(e) {}
            }
        });
        
        // Add hover effect
        card.style.cursor = 'pointer';
    });
    
    // Select first appearance by default
    if (appearanceCards.length > 0) {
        appearanceCards[0].classList.add('selected');
        console.log('Default appearance selected:', selectedAppearance);
    }
}

function initializeCountrySelector() {
    const countryCards = document.querySelectorAll('.country-card');
    console.log('Found country cards:', countryCards.length);
    
    countryCards.forEach((card, index) => {
        card.addEventListener('click', function(e) {
            e.stopPropagation();
            console.log('Country clicked:', this.getAttribute('data-country'));
            
            countryCards.forEach(c => c.classList.remove('selected'));
            this.classList.add('selected');
            selectedCountry = this.getAttribute('data-country');
            
            if (window.soundManager) {
                try {
                    window.soundManager.buttonClick();
                } catch(e) {}
            }
        });
        
        // Add hover effect
        card.style.cursor = 'pointer';
    });
    
    // Select USA by default
    const usaCard = document.querySelector('.country-card[data-country="usa"]');
    if (usaCard) {
        usaCard.classList.add('selected');
        console.log('Default country selected:', selectedCountry);
    }
}

// Board spaces data
const boardSpaces = [
  { id: 0, name: 'GO', type: 'go', color: null },
  { id: 1, name: 'Mediterranean Avenue', type: 'property', color: 'brown', price: 60 },
  { id: 2, name: 'Community Chest', type: 'chest', color: null },
  { id: 3, name: 'Baltic Avenue', type: 'property', color: 'brown', price: 60 },
  { id: 4, name: 'Income Tax', type: 'tax', color: null },
  { id: 5, name: 'Reading Railroad', type: 'railroad', color: null, price: 200 },
  { id: 6, name: 'Oriental Avenue', type: 'property', color: 'lightblue', price: 100 },
  { id: 7, name: 'Chance', type: 'chance', color: null },
  { id: 8, name: 'Vermont Avenue', type: 'property', color: 'lightblue', price: 100 },
  { id: 9, name: 'Connecticut Avenue', type: 'property', color: 'lightblue', price: 120 },
  { id: 10, name: 'Jail', type: 'jail', color: null },
  { id: 11, name: 'St. Charles Place', type: 'property', color: 'pink', price: 140 },
  { id: 12, name: 'Electric Company', type: 'utility', color: null, price: 150 },
  { id: 13, name: 'States Avenue', type: 'property', color: 'pink', price: 140 },
  { id: 14, name: 'Virginia Avenue', type: 'property', color: 'pink', price: 160 },
  { id: 15, name: 'Pennsylvania Railroad', type: 'railroad', color: null, price: 200 },
  { id: 16, name: 'St. James Place', type: 'property', color: 'orange', price: 180 },
  { id: 17, name: 'Community Chest', type: 'chest', color: null },
  { id: 18, name: 'Tennessee Avenue', type: 'property', color: 'orange', price: 180 },
  { id: 19, name: 'New York Avenue', type: 'property', color: 'orange', price: 200 },
  { id: 20, name: 'Free Parking', type: 'parking', color: null },
  { id: 21, name: 'Kentucky Avenue', type: 'property', color: 'red', price: 220 },
  { id: 22, name: 'Chance', type: 'chance', color: null },
  { id: 23, name: 'Indiana Avenue', type: 'property', color: 'red', price: 220 },
  { id: 24, name: 'Illinois Avenue', type: 'property', color: 'red', price: 240 },
  { id: 25, name: 'B&O Railroad', type: 'railroad', color: null, price: 200 },
  { id: 26, name: 'Atlantic Avenue', type: 'property', color: 'yellow', price: 260 },
  { id: 27, name: 'Ventnor Avenue', type: 'property', color: 'yellow', price: 260 },
  { id: 28, name: 'Water Works', type: 'utility', color: null, price: 150 },
  { id: 29, name: 'Marvin Gardens', type: 'property', color: 'yellow', price: 280 },
  { id: 30, name: 'Go To Jail', type: 'gotojail', color: null },
  { id: 31, name: 'Pacific Avenue', type: 'property', color: 'green', price: 300 },
  { id: 32, name: 'North Carolina Avenue', type: 'property', color: 'green', price: 300 },
  { id: 33, name: 'Community Chest', type: 'chest', color: null },
  { id: 34, name: 'Pennsylvania Avenue', type: 'property', color: 'green', price: 320 },
  { id: 35, name: 'Short Line', type: 'railroad', color: null, price: 200 },
  { id: 36, name: 'Chance', type: 'chance', color: null },
  { id: 37, name: 'Park Place', type: 'property', color: 'darkblue', price: 350 },
  { id: 38, name: 'Luxury Tax', type: 'tax', color: null },
  { id: 39, name: 'Boardwalk', type: 'property', color: 'darkblue', price: 400 }
];

// Screen navigation
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId).classList.add('active');
}

// Create lobby
function createLobby() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('Lütfen isminizi girin!');
        return;
    }
    
    console.log('Creating lobby with:', {
        playerName,
        country: selectedCountry,
        appearance: selectedAppearance
    });
    
    if (soundEnabled && window.soundManager) {
        try {
            window.soundManager.buttonClick();
        } catch(e) {}
    }
    
    isHost = true;
    socket.emit('createLobby', { playerName, country: selectedCountry, appearance: selectedAppearance });
}

// Show lobbies
function showLobbies() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('Lütfen isminizi girin!');
        return;
    }
    socket.emit('getLobbies');
    showScreen('lobbiesScreen');
}

// Join lobby
function joinLobby(lobbyId) {
    const playerName = document.getElementById('playerNameInput').value.trim();
    isHost = false;
    socket.emit('joinLobby', { lobbyId, playerName, appearance: selectedAppearance });
}

// Back to menu
function backToMenu() {
    showScreen('mainMenu');
}

// Leave lobby
function leaveLobby() {
    location.reload();
}

// Copy invite link
function copyInviteLink() {
    const inviteLink = document.getElementById('inviteLinkText').textContent;
    navigator.clipboard.writeText(inviteLink);
    alert('Davet linki kopyalandı!');
}

// Send lobby message
function sendLobbyMessage() {
    const input = document.getElementById('lobbyChatInput');
    const message = input.value.trim();
    if (message) {
        socket.emit('sendMessage', { message });
        input.value = '';
        if (soundEnabled && window.soundManager) {
            window.soundManager.buttonClick();
        }
    }
}

// Save settings (host only)
function saveSettings() {
    if (!isHost) return;
    
    const settings = {
        startingMoney: parseInt(document.getElementById('startingMoney').value),
        passGoMoney: parseInt(document.getElementById('passGoMoney').value),
        jailTurns: parseInt(document.getElementById('jailTurns').value),
        jailFine: parseInt(document.getElementById('jailFine').value)
    };
    
    socket.emit('updateSettings', settings);
    if (soundEnabled && window.soundManager) {
        window.soundManager.buttonClick();
    }
    alert('Settings saved!');
}

// Enter key for chat - will be attached when lobby screen shows
function attachChatListeners() {
    const chatInput = document.getElementById('lobbyChatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendLobbyMessage();
            }
        });
    }
}

// Start game
function startGame() {
    socket.emit('startGame');
}

// Roll dice
function rollDice() {
    socket.emit('rollDice');
    document.getElementById('rollDiceBtn').disabled = true;
    
    // Play dice roll sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.diceRoll();
    }
    
    // Add rolling animation
    const dice1 = document.getElementById('dice1');
    const dice2 = document.getElementById('dice2');
    if (dice1 && dice2) {
        dice1.classList.add('rolling');
        dice2.classList.add('rolling');
    
    // Play purchase sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.propertyBuy();
    }
        
        setTimeout(() => {
            dice1.classList.remove('rolling');
            dice2.classList.remove('rolling');
        }, 800);
    }
}

// End turn
function endTurn() {
    socket.emit('endTurn');
    document.getElementById('endTurnBtn').disabled = true;
    document.getElementById('rollDiceBtn').disabled = false;
}

// Buy property
function buyProperty() {
    socket.emit('buyProperty');
}

// Toggle trade panel
function toggleTradePanel() {
    const panel = document.getElementById('tradePanel');
    panel.classList.toggle('active');
    if (panel.classList.contains('active')) {
        updateTradePanel();
    }
}

// Update trade panel
function updateTradePanel() {
    if (!gameState) return;

    const playerSelect = document.getElementById('tradePlayerSelect');
    playerSelect.innerHTML = '';
    
    gameState.players.forEach(player => {
        if (player.id !== socket.id) {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.name;
            playerSelect.appendChild(option);
        }
    });

    updateTradeProperties();
}

// Update trade properties
function updateTradeProperties() {
    if (!gameState) return;

    const myPlayer = gameState.players.find(p => p.id === socket.id);
    const selectedPlayerId = document.getElementById('tradePlayerSelect').value;
    const selectedPlayer = gameState.players.find(p => p.id === selectedPlayerId);

    // My properties
    const offerList = document.getElementById('offerPropertiesList');
    offerList.innerHTML = '';
    myPlayer.properties.forEach(propId => {
        const prop = gameState.properties[propId];
        const div = document.createElement('div');
        div.className = 'trade-property-item';
        div.innerHTML = `
            <input type="checkbox" id="offer-${propId}" value="${propId}">
            <label for="offer-${propId}">${prop.name} ($${prop.price})</label>
        `;
        offerList.appendChild(div);
    });

    // Their properties
    const requestList = document.getElementById('requestPropertiesList');
    requestList.innerHTML = '';
    if (selectedPlayer) {
        selectedPlayer.properties.forEach(propId => {
            const prop = gameState.properties[propId];
            const div = document.createElement('div');
            div.className = 'trade-property-item';
            div.innerHTML = `
                <input type="checkbox" id="request-${propId}" value="${propId}">
                <label for="request-${propId}">${prop.name} ($${prop.price})</label>
            `;
            requestList.appendChild(div);
        });
    }
}

// Propose trade
function proposeTrade() {
    const targetPlayerId = document.getElementById('tradePlayerSelect').value;
    
    const offeredProperties = Array.from(document.querySelectorAll('#offerPropertiesList input:checked'))
        .map(input => parseInt(input.value));
    
    const requestedProperties = Array.from(document.querySelectorAll('#requestPropertiesList input:checked'))
        .map(input => parseInt(input.value));
    
    const offeredMoney = parseInt(document.getElementById('offerMoney').value) || 0;
    const requestedMoney = parseInt(document.getElementById('requestMoney').value) || 0;

    if (offeredProperties.length === 0 && requestedProperties.length === 0 && 
        offeredMoney === 0 && requestedMoney === 0) {
        alert('Lütfen en az bir şey teklif edin veya isteyin!');
        return;
    }

    socket.emit('proposeTrade', {
        targetPlayerId,
        offeredProperties,
        offeredMoney,
        requestedProperties,
        requestedMoney
    });

    toggleTradePanel();
    addMessage('Trade teklifi gönderildi!');
}

// Accept trade
function acceptTrade() {
    if (currentTrade) {
        socket.emit('respondTrade', { tradeId: currentTrade.id, accept: true });
        document.getElementById('tradeNotification').style.display = 'none';
        currentTrade = null;
    }
}

// Reject trade
function rejectTrade() {
    if (currentTrade) {
        socket.emit('respondTrade', { tradeId: currentTrade.id, accept: false });
        document.getElementById('tradeNotification').style.display = 'none';
        currentTrade = null;
    }
}

// Add message to board
function addMessage(text) {
    const messagesDiv = document.getElementById('boardMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = 'board-message';
    msgDiv.textContent = text;
    messagesDiv.appendChild(msgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    // Keep only last 5 messages
    while (messagesDiv.children.length > 5) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }
}

// Initialize board
function initializeBoard(properties) {
    const board = document.getElementById('monopolyBoard');
    board.innerHTML = '';
    
    properties.forEach(space => {
        const spaceDiv = document.createElement('div');
        spaceDiv.className = `space ${space.color || ''} ${space.type === 'go' || space.type === 'jail' || space.type === 'parking' || space.type === 'gotojail' ? 'corner' : ''}`;
        spaceDiv.setAttribute('data-id', space.id);
        spaceDiv.id = `space-${space.id}`;
        
        const nameSpan = document.createElement('div');
        nameSpan.className = 'space-name';
        nameSpan.textContent = space.name;
        spaceDiv.appendChild(nameSpan);
        
        if (space.price > 0) {
            const priceSpan = document.createElement('div');
            priceSpan.className = 'space-price';
            priceSpan.textContent = `$${space.price}`;
            spaceDiv.appendChild(priceSpan);
        }
        
        board.appendChild(spaceDiv);
    });
}

// Update player positions
function updatePlayerPositions(players) {
    // Remove all existing tokens
    document.querySelectorAll('.player-token').forEach(token => token.remove());
    
    // Add tokens for each player
    players.forEach((player, index) => {
        const space = document.getElementById(`space-${player.position}`);
        if (space) {
            const token = document.createElement('div');
            token.className = 'player-token moving';
            token.style.backgroundColor = player.color;
            token.style.left = `${(index % 3) * 15 + 5}px`;
            token.title = player.name;
            space.appendChild(token);
            
            // Remove moving class after animation
            setTimeout(() => {
                token.classList.remove('moving');
            }, 600);
        }
    });
}

// Update players info
function updatePlayersInfo(players, currentPlayerId) {
    const playersDiv = document.getElementById('playersInfo');
    playersDiv.innerHTML = '';
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = `player-card ${player.id === currentPlayerId ? 'active' : ''}`;
        card.style.borderLeftColor = player.color;
        
        card.innerHTML = `
            <div class="player-card-header">
                <div class="player-color" style="background-color: ${player.color}"></div>
                <div class="player-card-name">${player.name}</div>
            </div>
            <div class="player-card-money">$${player.money}</div>
            <div class="player-card-properties">${player.properties.length} mülk</div>
            ${player.inJail ? '<div style="color: red; font-weight: bold;">HAP─░STE</div>' : ''}
        `;
        
        playersDiv.appendChild(card);
    });
}

// Update my properties
function updateMyProperties(properties, myPlayer) {
    const propertiesDiv = document.getElementById('myProperties');
    propertiesDiv.innerHTML = '';
    
    if (myPlayer.properties.length === 0) {
        propertiesDiv.innerHTML = '<p style="color: #718096; text-align: center;">Henüz mülkünüz yok</p>';
        return;
    }
    
    myPlayer.properties.forEach(propId => {
        const prop = properties[propId];
        const card = document.createElement('div');
        card.className = 'property-card';
        card.style.borderLeftColor = getColorCode(prop.color);
        
        card.innerHTML = `
            <div class="property-card-name">${prop.name}</div>
            <div class="property-card-value">$${prop.price}</div>
        `;
        
        propertiesDiv.appendChild(card);
    });
}

// Get color code
function getColorCode(color) {
    const colors = {
        brown: '#8B4513',
        lightblue: '#87CEEB',
        pink: '#FF69B4',
        orange: '#FFA500',
        red: '#FF0000',
        yellow: '#FFFF00',
        green: '#00FF00',
        darkblue: '#0000FF'
    };
    return colors[color] || '#333';
}

// Socket event listeners
socket.on('lobbyCreated', ({ lobbyId, lobby }) => {
    currentLobbyId = lobbyId;
    currentPlayerId = socket.id;
    isHost = lobby.hostId === socket.id;
    
    document.getElementById('inviteLinkText').textContent = 
        `${window.location.origin}?lobby=${lobbyId}`;
    
    updateLobbyPlayers(lobby.players, lobby.hostId);
    updateLobbyChat(lobby.chatMessages);
    updateLobbySettings(lobby.settings);
    showScreen('lobbyScreen');
    attachChatListeners();
    
    if (isHost) {
        document.getElementById('startGameBtn').style.display = 'block';
        document.getElementById('lobbySettings').style.display = 'block';
    }
});

socket.on('lobbiesUpdate', (lobbies) => {
    const list = document.getElementById('lobbiesList');
    list.innerHTML = '';
    
    lobbies.filter(l => !l.started).forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-item">
                <h3>Lobi #${lobby.id.substring(0, 8)}</h3>
                <p>Oyuncular: ${lobby.playerCount}/6</p>
            </div>
            <button class="btn btn-primary" onclick="joinLobby('${lobby.id}')">Katıl</button>
        `;
        list.appendChild(item);
    });
    
    if (lobbies.filter(l => !l.started).length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #718096;">Henüz lobi yok</p>';
    }
});

socket.on('lobbyUpdate', (lobby) => {
    updateLobbyPlayers(lobby.players, lobby.hostId);
    updateLobbyChat(lobby.chatMessages);
    
    if (lobby.hostId === socket.id) {
        document.getElementById('startGameBtn').style.display = 'block';
        document.getElementById('lobbySettings').style.display = 'block';
    }
});

socket.on('chatMessage', (message) => {
    addChatMessage(message);
});

socket.on('settingsUpdated', (settings) => {
    updateLobbySettings(settings);
});

function updateLobbyPlayers(players, hostId) {
    const list = document.getElementById('lobbyPlayersList');
    list.innerHTML = '';
    
    players.forEach(player => {
        const card = document.createElement('div');
        card.className = 'lobby-player-card' + (player.id === hostId ? ' host' : '');
        card.innerHTML = `
            <div class="player-appearance">${player.appearance || '👤'}</div>
            <div class="player-name">${player.name}</div>
            ${player.id === hostId ? '<span class="host-badge">HOST</span>' : ''}
        `;
        list.appendChild(card);
    });
}

function updateLobbyChat(messages) {
    const chatContainer = document.getElementById('lobbyChatMessages');
    if (!chatContainer) return;
    
    chatContainer.innerHTML = '';
    messages.forEach(msg => {
        addChatMessage(msg);
    });
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addChatMessage(message) {
    const chatContainer = document.getElementById('lobbyChatMessages');
    if (!chatContainer) return;
    
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message' + (message.system ? ' system' : '');
    msgDiv.innerHTML = `
        ${message.system ? '' : `<div class="message-author">${message.playerName}</div>`}
        <div class="message-text">${message.text}</div>
    `;
    chatContainer.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function updateLobbySettings(settings) {
    if (!settings) return;
    
    const startingMoney = document.getElementById('startingMoney');
    const passGoMoney = document.getElementById('passGoMoney');
    const jailTurns = document.getElementById('jailTurns');
    const jailFine = document.getElementById('jailFine');
    
    if (startingMoney) startingMoney.value = settings.startingMoney;
    if (passGoMoney) passGoMoney.value = settings.passGoMoney;
    if (jailTurns) jailTurns.value = settings.jailTurns;
    if (jailFine) jailFine.value = settings.jailFine;
}

socket.on('gameStarted', ({ lobby, properties, currentPlayer }) => {
    gameState = {
        players: lobby.players,
        properties: properties,
        currentTurn: lobby.currentTurn
    };
    
    // Play game start sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.gameStart();
    }
    
    showScreen('gameScreen');
    initializeBoard(properties);
    updatePlayerPositions(lobby.players);
    updatePlayersInfo(lobby.players, currentPlayer.id);
    
    const myPlayer = lobby.players.find(p => p.id === socket.id);
    updateMyProperties(properties, myPlayer);
    
    document.getElementById('currentPlayerName').textContent = currentPlayer.name;
    
    if (currentPlayer.id === socket.id) {
        document.getElementById('rollDiceBtn').disabled = false;
    } else {
        document.getElementById('rollDiceBtn').disabled = true;
    }
});

socket.on('diceRolled', ({ dice1, dice2, player, landedSpace, message }) => {
    document.getElementById('dice1').textContent = dice1;
    document.getElementById('dice2').textContent = dice2;
    
    addMessage(`${player.name} ${dice1} ve ${dice2} attı (Toplam: ${dice1 + dice2})`);
    
    if (message) {
        addMessage(message);
    }
    
    if (landedSpace) {
        addMessage(`${player.name} ${landedSpace.name} karesine geldi`);
        
        // Show buy button if property is available
        if ((landedSpace.type === 'property' || landedSpace.type === 'railroad' || landedSpace.type === 'utility') 
            && !landedSpace.owner && player.id === socket.id) {
            const buyBtn = document.createElement('button');
            buyBtn.className = 'btn btn-primary btn-small';
            buyBtn.textContent = `Satın Al ($${landedSpace.price})`;
            buyBtn.onclick = buyProperty;
            buyBtn.style.marginTop = '10px';
            document.getElementById('boardMessages').appendChild(buyBtn);
        }
    }
    
    
    // Play purchase sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.propertyBuy();
    }
    document.getElementById('endTurnBtn').disabled = false;
});

socket.on('propertyBought', ({ player, property }) => {
    addMessage(`${player.name} ${property.name} satın aldı!`);
});

socket.on('rentDue', ({ player, owner, amount, property }) => {
    addMessage(`${player.name} ${owner.name}'e ${amount}$ kira ödemeli (${property.name})`);
    
    if (player.id === socket.id) {
        socket.emit('payRent', { amount, toPlayerId: owner.id });
    
    // Play money sound
    if (soundEnabled && window.soundManager) {
        if (fromPlayer.id === socket.id) {
            window.soundManager.moneyPaid();
        } else if (toPlayer.id === socket.id) {
            window.soundManager.moneyReceived();
        }
    
    // Play jail sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.jailSound();
    }
    }
    }
});

socket.on('rentPaid', ({ fromPlayer, toPlayer, amount }) => {
    addMessage(`${fromPlayer.name} ${toPlayer.name}'e ${amount}$ kira ödedi`);
});

socket.on('taxPaid', ({ player, amount }) => {
    addMessage(`${player.name} ${amount}$ vergi ödedi`);
});

socket.on('playerJailed', (player) => {
    addMessage(`${player.name} hapse gönderildi!`);
});
// Play turn change sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.turnChange();
    }
    
    
socket.on('gameUpdate', ({ players, properties }) => {
    if (gameState) {
        gameState.players = players;
        if (properties) gameState.properties = properties;
        
        updatePlayerPositions(players);
        const currentPlayer = players[gameState.currentTurn];
        updatePlayersInfo(players, currentPlayer.id);
    // Play trade proposed sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.tradeProposed();
    }
    
        
        const myPlayer = players.find(p => p.id === socket.id);
        updateMyProperties(gameState.properties, myPlayer);
    }
});

socket.on('turnChanged', (currentPlayer) => {
    document.getElementById('currentPlayerName').textContent = currentPlayer.name;
    addMessage(`Sıra: ${currentPlayer.name}`);
    
    if (currentPlayer.id === socket.id) {
        document.getElementById('rollDiceBtn').disabled = false;
        document.getElementById('endTurnBtn').disabled = true;
    } else {
        document.getElementById('rollDiceBtn').disabled = true;
        document.getElementById('endTurnBtn').disabled = true;
    }
    
    if (gameState) {
        updatePlayersInfo(gameState.players, currentPlayer.id);
    }
});

socket.on('tradeProposed', (trade) => {
    if (trade.toPlayer === socket.id) {
        currentTrade = trade;
        
        const fromPlayer = gameState.players.find(p => p.id === trade.fromPlayer);
        
        let details = `<p><strong>${fromPlayer.name}</strong> size bir trade teklif etti:</p>`;
        details += '<div style="margin: 10px 0;"><strong>Size veriyor:</strong><ul>';
        
    // Play trade completed sound
    if (soundEnabled && window.soundManager) {
        window.soundManager.tradeCompleted();
    }
    
        trade.offeredProperties.forEach(propId => {
            const prop = gameState.properties[propId];
            details += `<li>${prop.name} ($${prop.price})</li>`;
        });
        if (trade.offeredMoney > 0) {
            details += `<li>$${trade.offeredMoney}</li>`;
        }
        details += '</ul></div>';
        
        details += '<div style="margin: 10px 0;"><strong>Sizden istiyor:</strong><ul>';
        trade.requestedProperties.forEach(propId => {
            const prop = gameState.properties[propId];
            details += `<li>${prop.name} ($${prop.price})</li>`;
        });
        if (trade.requestedMoney > 0) {
            details += `<li>$${trade.requestedMoney}</li>`;
        }
        details += '</ul></div>';
        
        document.getElementById('tradeDetails').innerHTML = details;
        document.getElementById('tradeNotification').style.display = 'block';
    } else {
        addMessage('Trade teklifi gönderildi...');
    }
});

socket.on('tradeCompleted', ({ trade, players, properties }) => {
    addMessage('Trade tamamlandı!');
    
    if (gameState) {
        gameState.players = players;
        gameState.properties = properties;
        
        updatePlayerPositions(players);
        const currentPlayer = players[gameState.currentTurn];
        updatePlayersInfo(players, currentPlayer.id);
        
        const myPlayer = players.find(p => p.id === socket.id);
        updateMyProperties(properties, myPlayer);
    }
});

socket.on('tradeRejected', (trade) => {
    addMessage('Trade teklifi reddedildi');
});

socket.on('error', (message) => {
    alert(message);
});

// Country selection
document.addEventListener('DOMContentLoaded', () => {
    // Country card selection
    const countryCards = document.querySelectorAll('.country-card');
    countryCards.forEach(card => {
        card.addEventListener('click', () => {
            if (soundEnabled && window.soundManager) {
                window.soundManager.hoverSound();
            }
            
            countryCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedCountry = card.dataset.country;
        });
    });
    
    // Select USA by default
    const usaCard = document.querySelector('.country-card[data-country="usa"]');
    if (usaCard) {
        usaCard.classList.add('selected');
    }
    
    // Hover sound effects
    document.querySelectorAll('.btn, .country-card, .lobby-item').forEach(el => {
        el.addEventListener('mouseenter', () => {
            if (soundEnabled && window.soundManager) {
                window.soundManager.hoverSound();
            }
        });
    });
    
    // Button click sounds
    document.querySelectorAll('.btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (soundEnabled && window.soundManager) {
                window.soundManager.buttonClick();
            }
        });
    });
    
    const playerSelect = document.getElementById('tradePlayerSelect');
    if (playerSelect) {
        playerSelect.addEventListener('change', updateTradeProperties);
    }
});

// Check for lobby in URL
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const lobbyId = urlParams.get('lobby');
    
    if (lobbyId) {
        document.getElementById('playerNameInput').focus();
        // Auto-show join dialog
        setTimeout(() => {
            const playerName = prompt('İsminizi girin:');
            if (playerName) {
                document.getElementById('playerNameInput').value = playerName;
                joinLobby(lobbyId);
            }
        }, 500);
    }
});
