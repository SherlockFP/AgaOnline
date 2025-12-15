// Game State
let socket;
let currentLobby = null;
let gameState = null;
let selectedAppearance = '👤';
let selectedColor = '#ef4444';
let selectedProperty = null;

// Initialize Socket.IO
socket = io();

// Socket Events
socket.on('lobbyCreated', (lobby) => {
    currentLobby = lobby;
    showScreen('gameScreen');
    updateLobbyUI();
    console.log('✅ Lobby created:', lobby.id);
});

// Update player info in header when lobby updates
socket.on('lobbyUpdated', (lobby) => {
    currentLobby = lobby;
    updateLobbyUI();
    
    const playerCount = document.getElementById('playerCount');
    playerCount.textContent = `Players: ${lobby.players.length}/6`;
    
    console.log('👥 Lobby updated');
});

socket.on('gameStarted', (lobby) => {
    currentLobby = lobby;
    gameState = lobby;
    showGameBoard();
    console.log('🎮 Game started!');
});

socket.on('diceRolled', (data) => {
    const dice1El = document.getElementById('dice1');
    const dice2El = document.getElementById('dice2');
    const resultEl = document.getElementById('diceResult');

    // Animate dice
    dice1El.classList.add('rolling');
    dice2El.classList.add('rolling');

    setTimeout(() => {
        dice1El.textContent = data.dice1;
        dice2El.textContent = data.dice2;
        resultEl.textContent = `Total: ${data.total}`;
        dice1El.classList.remove('rolling');
        dice2El.classList.remove('rolling');
    }, 600);

    addEvent(`${data.player.name} rolled ${data.dice1} + ${data.dice2} = ${data.total}`);

    // Show property popup if landed on buyable property
    if (data.landedSpace && ['property', 'railroad', 'utility'].includes(data.landedSpace.type) && !data.landedSpace.owner) {
        setTimeout(() => {
            showPropertyPopup(data.landedSpace);
        }, 800);
    }
});

socket.on('propertyBought', (data) => {
    addEvent(`${data.player.name} bought ${data.property.name}`);
    updateGameBoard();
    closePopup();
});

socket.on('turnEnded', (data) => {
    gameState.currentTurn = data.currentTurn;
    const currentPlayer = gameState.players[gameState.currentTurn];
    const gameStatus = document.getElementById('gameStatus');
    gameStatus.textContent = `${currentPlayer.name}'s Turn`;
    updateGameBoard();
    
    // Enable roll button for current player
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = gameState.players[gameState.currentTurn].id !== socket.id;
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
    alert('Error: ' + message);
});

// UI Functions
function showScreen(screenName) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenName).classList.add('active');
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
}

function showJoinScreen() {
    showScreen('joinScreen');
}

function createLobby() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    socket.emit('createLobby', {
        playerName,
        appearance: selectedAppearance,
        color: selectedColor
    });
}

function joinLobby() {
    const lobbyId = document.getElementById('lobbyIdInput').value.trim();
    const playerName = document.getElementById('playerNameInput').value.trim();
    if (!playerName || !lobbyId) {
        alert('Please enter name and lobby ID');
        return;
    }
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
                <div class="player-name">${player.name}${isHost ? ' 👑' : ''}${isMe ? ' (You)' : ''}</div>
                <div class="player-money">💰 $${player.money}</div>
            </div>
            <div style="width: 14px; height: 14px; background: ${player.color}; border-radius: 50%; border: 2px solid white;"></div>
        `;
        playersList.appendChild(div);
    });

    const playerCount = document.getElementById('playerCount');
    playerCount.textContent = `Players: ${currentLobby.players.length}/6`;

    const startBtn = document.getElementById('startBtn');
    if (currentLobby.host === socket.id && !currentLobby.started) {
        startBtn.style.display = 'block';
        startBtn.disabled = currentLobby.players.length < 2;
    }
}

function startGame() {
    const rules = {
        initialMoney: 1500,
        taxFree: document.getElementById('ruleTaxFree')?.checked || false,
        goMoney: 200
    };
    socket.emit('startGame', { rules });
}

function updateRules() {
    // Update rules locally
}

function showGameBoard() {
    // Hide setup panel
    const setupPanel = document.getElementById('setupPanel');
    if (setupPanel) setupPanel.style.display = 'none';

    // Show trade panel
    const tradePanel = document.getElementById('tradePanel');
    if (tradePanel) tradePanel.style.display = 'block';

    // Show roll button and end turn button
    const rollBtn = document.getElementById('rollBtn');
    const endTurnBtn = document.getElementById('endTurnBtn');
    rollBtn.style.display = 'block';
    endTurnBtn.style.display = 'block';

    // Initialize board
    initializeBoard();
    updateGameBoard();

    // Update game status
    const gameStatus = document.getElementById('gameStatus');
    const currentPlayer = gameState.players[gameState.currentTurn];
    gameStatus.textContent = `${currentPlayer.name}'s Turn`;

    // Add game started event
    addEvent('🎮 Game Started!');
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
        space.innerHTML = `<div class="space-name">${prop.name}</div>${prop.price > 0 ? `<div class="space-price">$${prop.price}</div>` : ''}`;

        space.onclick = () => showPropertyPopup(prop);
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

function updateGameBoard() {
    // Update player positions on board
    const spaces = document.querySelectorAll('.board-space');
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
            space.appendChild(token);
        }
    });

    // Update property ownership indicators
    spaces.forEach(space => {
        const propIndex = parseInt(space.dataset.id);
        const prop = gameState.properties[propIndex];
        if (prop.owner) {
            const owner = gameState.players.find(p => p.id === prop.owner);
            space.style.opacity = '0.8';
            space.style.borderBottom = `3px solid ${owner.color}`;
        } else {
            space.style.opacity = '1';
            space.style.borderBottom = 'none';
        }
    });

    // Update current player highlight
    const currentPlayer = gameState.players[gameState.currentTurn];
    const playersList = document.getElementById('playersList');
    const playerItems = playersList.querySelectorAll('.player-item');
    playerItems.forEach((item, i) => {
        item.classList.toggle('current-turn', i === gameState.currentTurn);
    });

    // Update trade dropdown
    const tradeSelect = document.getElementById('tradeWithPlayer');
    tradeSelect.innerHTML = '<option>Select player...</option>';
    gameState.players.forEach(player => {
        if (player.id !== socket.id) {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.appearance} ${player.name}`;
            tradeSelect.appendChild(option);
        }
    });
}

function rollDice() {
    const rollBtn = document.getElementById('rollBtn');
    rollBtn.disabled = true;
    socket.emit('rollDice');
    setTimeout(() => {
        rollBtn.disabled = false;
    }, 2000);
}

function endTurn() {
    socket.emit('endTurn');
    const endTurnBtn = document.getElementById('endTurnBtn');
    endTurnBtn.style.display = 'none';
}

function showPropertyPopup(property) {
    selectedProperty = property;
    const popup = document.getElementById('propertyPopup');
    const nameEl = document.getElementById('propName');
    const detailsEl = document.getElementById('propDetails');
    const buyBtn = document.getElementById('buyBtn');

    nameEl.textContent = property.name;

    let detailsHTML = '';
    if (property.color) {
        detailsHTML += `<div class="property-detail"><span>Property Group:</span><span style="color: ${property.color}; font-weight: 700;">●●●</span></div>`;
    }
    if (property.price) {
        detailsHTML += `<div class="property-detail"><span>Price:</span><span style="color: #fbbf24; font-weight: 700;">$${property.price}</span></div>`;
    }
    if (property.rent && property.rent.length > 0) {
        detailsHTML += `<div class="property-detail"><span>Base Rent:</span><span>$${property.rent[0]}</span></div>`;
        if (property.rent[1]) detailsHTML += `<div class="property-detail"><span>With 1 House:</span><span>$${property.rent[1]}</span></div>`;
        if (property.rent[2]) detailsHTML += `<div class="property-detail"><span>With 2 Houses:</span><span>$${property.rent[2]}</span></div>`;
        if (property.rent[3]) detailsHTML += `<div class="property-detail"><span>With 3 Houses:</span><span>$${property.rent[3]}</span></div>`;
        if (property.rent[4]) detailsHTML += `<div class="property-detail"><span>With 4 Houses:</span><span>$${property.rent[4]}</span></div>`;
        if (property.rent[5]) detailsHTML += `<div class="property-detail"><span>With Hotel:</span><span style="color: #10b981; font-weight: 700;">$${property.rent[5]}</span></div>`;
    }
    if (property.owner) {
        const owner = gameState.players.find(p => p.id === property.owner);
        detailsHTML += `<div class="property-detail" style="border-top: 2px solid rgba(96, 165, 250, 0.2); padding-top: 10px; margin-top: 10px;"><span>Owner:</span><span>${owner.appearance} ${owner.name}</span></div>`;
        buyBtn.style.display = 'none';
    } else {
        buyBtn.style.display = 'block';
        const myMoney = gameState.players.find(p => p.id === socket.id)?.money || 0;
        buyBtn.disabled = myMoney < property.price;
    }

    detailsEl.innerHTML = detailsHTML;
    popup.style.display = 'flex';
}

function closePopup() {
    document.getElementById('propertyPopup').style.display = 'none';
}

function buyProperty() {
    if (selectedProperty) {
        socket.emit('buyProperty', { propertyId: gameState.properties.indexOf(selectedProperty) });
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

function addEvent(message) {
    const eventLog = document.getElementById('eventLog');
    const item = document.createElement('div');
    item.className = 'event-item';
    item.textContent = message;
    eventLog.appendChild(item);
    eventLog.scrollTop = eventLog.scrollHeight;
}

console.log('🎮 Game loaded and ready!');
