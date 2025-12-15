const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static('public'));

// Game data structure
const lobbies = new Map();
const playerSockets = new Map();

// Board properties data
const boardData = {
  properties: [
    // GO
    { id: 0, name: 'GO', type: 'go', price: 0 },
    // Brown
    { id: 1, name: 'Mediterranean Avenue', color: 'brown', type: 'property', price: 60, rent: [2, 10, 30, 90, 160, 250] },
    { id: 2, name: 'Community Chest', type: 'chest', price: 0 },
    { id: 3, name: 'Baltic Avenue', color: 'brown', type: 'property', price: 60, rent: [4, 20, 60, 180, 320, 450] },
    { id: 4, name: 'Income Tax', type: 'tax', price: 0 },
    // Railroads
    { id: 5, name: 'Reading Railroad', type: 'railroad', price: 200 },
    // Light Blue
    { id: 6, name: 'Oriental Avenue', color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
    { id: 7, name: 'Chance', type: 'chance', price: 0 },
    { id: 8, name: 'Vermont Avenue', color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
    { id: 9, name: 'Connecticut Avenue', color: 'lightblue', type: 'property', price: 120, rent: [8, 40, 120, 360, 640, 900] },
    { id: 10, name: 'Just Visiting', type: 'jail', price: 0 },
    // Pink
    { id: 11, name: 'St. Charles Place', color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
    { id: 12, name: 'Electric Company', type: 'utility', price: 150 },
    { id: 13, name: 'States Avenue', color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
    { id: 14, name: 'Virginia Avenue', color: 'pink', type: 'property', price: 160, rent: [12, 60, 180, 500, 1100, 1300] },
    { id: 15, name: 'Pennsylvania Railroad', type: 'railroad', price: 200 },
    // Orange
    { id: 16, name: 'St. James Place', color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
    { id: 17, name: 'Community Chest', type: 'chest', price: 0 },
    { id: 18, name: 'Tennessee Avenue', color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
    { id: 19, name: 'New York Avenue', color: 'orange', type: 'property', price: 200, rent: [16, 80, 220, 600, 800, 1000] },
    { id: 20, name: 'Free Parking', type: 'parking', price: 0 },
    // Red
    { id: 21, name: 'Kentucky Avenue', color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
    { id: 22, name: 'Chance', type: 'chance', price: 0 },
    { id: 23, name: 'Indiana Avenue', color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
    { id: 24, name: 'Illinois Avenue', color: 'red', type: 'property', price: 240, rent: [20, 100, 300, 750, 925, 1100] },
    { id: 25, name: 'B&O Railroad', type: 'railroad', price: 200 },
    // Yellow
    { id: 26, name: 'Atlantic Avenue', color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
    { id: 27, name: 'Ventnor Avenue', color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
    { id: 28, name: 'Water Works', type: 'utility', price: 150 },
    { id: 29, name: 'Marvin Gardens', color: 'yellow', type: 'property', price: 280, rent: [24, 120, 360, 850, 1025, 1200] },
    { id: 30, name: 'Go To Jail', type: 'gotojail', price: 0 },
    // Green
    { id: 31, name: 'Pacific Avenue', color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
    { id: 32, name: 'North Carolina Avenue', color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
    { id: 33, name: 'Community Chest', type: 'chest', price: 0 },
    { id: 34, name: 'Pennsylvania Avenue', color: 'green', type: 'property', price: 320, rent: [28, 150, 450, 1000, 1200, 1400] },
    { id: 35, name: 'Short Line', type: 'railroad', price: 200 },
    // Blue
    { id: 36, name: 'Chance', type: 'chance', price: 0 },
    { id: 37, name: 'Park Place', color: 'darkblue', type: 'property', price: 350, rent: [35, 175, 500, 1100, 1300, 1500] },
    { id: 38, name: 'Luxury Tax', type: 'tax', price: 0 },
    { id: 39, name: 'Boardwalk', color: 'darkblue', type: 'property', price: 400, rent: [50, 200, 600, 1400, 1700, 2000] }
  ]
};

io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);

  socket.on('createLobby', (data) => {
    const lobbyId = uuidv4();
    const lobby = {
      id: lobbyId,
      createdAt: Date.now(),
      host: socket.id,
      players: [{
        id: socket.id,
        name: data.playerName,
        appearance: data.appearance || '👤',
        color: data.color || '#ef4444',
        money: 1500,
        position: 0,
        properties: [],
        inJail: false,
        jailTurns: 0
      }],
      started: false,
      currentTurn: 0,
      diceHistory: [],
      properties: boardData.properties,
      gameRules: {
        initialMoney: 1500,
        goMoney: 200,
        taxFree: false
      },
      events: []
    };

    lobbies.set(lobbyId, lobby);
    playerSockets.set(socket.id, lobbyId);
    socket.join(lobbyId);

    socket.emit('lobbyCreated', lobby);
    console.log('✅ Lobby created:', lobbyId);
  });

  socket.on('joinLobby', (data) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }

    if (lobby.players.length >= 6) {
      socket.emit('error', 'Lobby is full');
      return;
    }

    lobby.players.push({
      id: socket.id,
      name: data.playerName,
      appearance: data.appearance || '👤',
      color: data.color || '#3b82f6',
      money: 1500,
      position: 0,
      properties: [],
      inJail: false,
      jailTurns: 0
    });

    playerSockets.set(socket.id, data.lobbyId);
    socket.join(data.lobbyId);

    io.to(data.lobbyId).emit('lobbyUpdated', lobby);
    console.log(`👥 Player ${data.playerName} joined lobby ${data.lobbyId}`);
  });

  socket.on('updatePlayer', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (player) {
      if (data.appearance) player.appearance = data.appearance;
      if (data.color) player.color = data.color;
      io.to(lobbyId).emit('lobbyUpdated', lobby);
    }
  });

  socket.on('startGame', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || lobby.host !== socket.id || lobby.players.length < 2) return;

    lobby.started = true;
    lobby.gameRules = data.rules || lobby.gameRules;
    io.to(lobbyId).emit('gameStarted', lobby);
    console.log('🎮 Game started in lobby:', lobbyId);
  });

  socket.on('rollDice', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const currentPlayer = lobby.players[lobby.currentTurn];
    if (currentPlayer.id !== socket.id) return;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2;
    let newPosition = (currentPlayer.position + total) % 40;

    if (newPosition < currentPlayer.position) {
      currentPlayer.money += lobby.gameRules.goMoney;
      lobby.events.push({ type: 'pass-go', player: currentPlayer.name });
    }

    currentPlayer.position = newPosition;
    const landedSpace = lobby.properties[newPosition];

    io.to(lobbyId).emit('diceRolled', {
      player: currentPlayer,
      dice1,
      dice2,
      total,
      newPosition,
      landedSpace,
      message: `${currentPlayer.name} rolled ${dice1} + ${dice2}`
    });
  });

  socket.on('buyProperty', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    const property = lobby.properties[data.propertyId];

    if (player && property && !property.owner && player.money >= property.price) {
      player.money -= property.price;
      player.properties.push(data.propertyId);
      property.owner = socket.id;

      io.to(lobbyId).emit('propertyBought', {
        player,
        property,
        message: `${player.name} bought ${property.name}`
      });

      lobby.events.push({ type: 'property-bought', player: player.name, property: property.name });
    }
  });

  socket.on('endTurn', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    lobby.currentTurn = (lobby.currentTurn + 1) % lobby.players.length;
    io.to(lobbyId).emit('turnEnded', { currentTurn: lobby.currentTurn });
  });

  socket.on('sendMessage', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    io.to(lobbyId).emit('messageReceived', {
      playerName: player.name,
      appearance: player.appearance,
      message: data.message,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    const lobbyId = playerSockets.get(socket.id);
    if (lobbyId) {
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        lobby.players = lobby.players.filter(p => p.id !== socket.id);
        if (lobby.players.length === 0) {
          lobbies.delete(lobbyId);
        } else {
          io.to(lobbyId).emit('lobbyUpdated', lobby);
        }
      }
    }
    playerSockets.delete(socket.id);
    console.log('❌ Player disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
