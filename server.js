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

// Base template for board properties
const baseTemplate = [
  { color: null, type: 'go', price: 0, rent: [] },
  { color: 'brown', type: 'property', price: 60, rent: [2, 10, 30, 90, 160, 250] },
  { color: null, type: 'chest', price: 0, rent: [] },
  { color: 'brown', type: 'property', price: 60, rent: [4, 20, 60, 180, 320, 450] },
  { color: null, type: 'tax', price: 0, rent: [] },
  { color: null, type: 'railroad', price: 200, rent: [] },
  { color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { color: null, type: 'chance', price: 0, rent: [] },
  { color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { color: 'lightblue', type: 'property', price: 120, rent: [8, 40, 120, 360, 640, 900] },
  { color: null, type: 'jail', price: 0, rent: [] },
  { color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { color: null, type: 'utility', price: 150, rent: [] },
  { color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { color: 'pink', type: 'property', price: 160, rent: [12, 60, 180, 500, 1100, 1300] },
  { color: null, type: 'railroad', price: 200, rent: [] },
  { color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { color: null, type: 'chest', price: 0, rent: [] },
  { color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { color: 'orange', type: 'property', price: 200, rent: [16, 80, 220, 600, 800, 1000] },
  { color: null, type: 'parking', price: 0, rent: [] },
  { color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { color: null, type: 'chance', price: 0, rent: [] },
  { color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { color: 'red', type: 'property', price: 240, rent: [20, 100, 300, 750, 925, 1100] },
  { color: null, type: 'railroad', price: 200, rent: [] },
  { color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { color: null, type: 'utility', price: 150, rent: [] },
  { color: 'yellow', type: 'property', price: 280, rent: [24, 120, 360, 850, 1025, 1200] },
  { color: null, type: 'gotojail', price: 0, rent: [] },
  { color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { color: null, type: 'chest', price: 0, rent: [] },
  { color: 'green', type: 'property', price: 320, rent: [28, 150, 450, 1000, 1200, 1400] },
  { color: null, type: 'railroad', price: 200, rent: [] },
  { color: null, type: 'chance', price: 0, rent: [] },
  { color: 'darkblue', type: 'property', price: 350, rent: [35, 175, 500, 1100, 1300, 1500] },
  { color: null, type: 'tax', price: 0, rent: [] },
  { color: 'darkblue', type: 'property', price: 400, rent: [50, 200, 600, 1400, 1700, 2000] }
];

function buildBoard(names) {
  return baseTemplate.map((tpl, idx) => ({
    id: idx,
    name: names[idx] || `Kare ${idx}`,
    color: tpl.color,
    type: tpl.type,
    price: tpl.price,
    rent: tpl.rent
  }));
}

// Scale property prices and rents according to game economy
function applyEconomyScale(lobby) {
  if (lobby._pricesScaled) return;
  const baseMoney = 2000;
  const initial = lobby.gameRules?.initialMoney || baseMoney;
  // Increase a bit even for 2000 base to make prices less cheap
  const extraBoost = 1.4;
  const scale = Math.max(1, (initial / baseMoney) * extraBoost);
  lobby.properties = lobby.properties.map(p => {
    const np = { ...p };
    if (np.price && np.price > 0) {
      np.price = Math.round((np.price * scale) / 10) * 10;
    }
    if (Array.isArray(np.rent) && np.rent.length) {
      np.rent = np.rent.map(v => Math.round((v * scale) / 10) * 10);
    }
    return np;
  });
  lobby._pricesScaled = true;
}

const boards = {
  turkiye: {
    name: 'Türkiye',
    currency: '₺',
    properties: buildBoard([
      '🇹🇷 BAŞLA / MAAŞ', 'Kars', 'Kamu Sandığı', 'Erzurum', 'Gelir Vergisi', 'Doğu Demiryolu',
      'Trabzon', 'Şans', 'Samsun', 'Ordu', 'Hapishane (Ziyaret)', 'Ankara',
      'Elektrik Şirketi', 'Konya', 'Eskişehir', 'İç Anadolu Demiryolu', 'Antalya', 'Kamu Sandığı',
      'Mersin', 'Adana', 'Ücretsiz Park', 'Bursa', 'Şans', 'İzmir',
      'Muğla', 'Ege Demiryolu', 'Tekirdağ', 'Çanakkale', 'Su İşleri', 'Balıkesir',
      'Hapishaneye Git', 'Gaziantep', 'Şanlıurfa', 'Kamu Sandığı', 'Diyarbakır', 'Güney Demiryolu',
      'Şans', 'İstanbul Kadıköy', 'Lüks Vergisi', 'İstanbul Beşiktaş'
    ])
  },
  amerika: {
    name: 'Amerika',
    currency: '$',
    properties: buildBoard([
      '🇺🇸 GO / Salary', 'Mediterranean Ave', 'Community Chest', 'Baltic Ave', 'Income Tax', 'Reading Railroad',
      'Oriental Ave', 'Chance', 'Vermont Ave', 'Connecticut Ave', 'Jail / Just Visiting', 'St. Charles Place',
      'Electric Company', 'States Ave', 'Virginia Ave', 'Pennsylvania RR', 'St. James Place', 'Community Chest',
      'Tennessee Ave', 'New York Ave', 'Free Parking', 'Kentucky Ave', 'Chance', 'Indiana Ave',
      'Illinois Ave', 'B&O Railroad', 'Atlantic Ave', 'Ventnor Ave', 'Water Works', 'Marvin Gardens',
      'Go To Jail', 'Pacific Ave', 'North Carolina Ave', 'Community Chest', 'Pennsylvania Ave', 'Short Line',
      'Chance', 'Park Place', 'Luxury Tax', 'Boardwalk'
    ])
  },
  avrupa: {
    name: 'Avrupa',
    currency: '€',
    properties: buildBoard([
      '🇪🇺 BAŞLA / MAAŞ', 'Lizbon', 'Topluluk Sandığı', 'Porto', 'Gelir Vergisi', 'TGV Hattı',
      'Madrid', 'Şans', 'Barselona', 'Marsilya', 'Hapishane (Ziyaret)', 'Paris',
      'Elektrik Şirketi', 'Brüksel', 'Amsterdam', 'Eurostar', 'Berlin', 'Topluluk Sandığı',
      'Hamburg', 'Münih', 'Ücretsiz Park', 'Prag', 'Şans', 'Viyana',
      'Budapeşte', 'Orient Ekspresi', 'Roma', 'Milano', 'Su İşleri', 'Venedik',
      'Hapishaneye Git', 'Zürih', 'Cenevre', 'Topluluk Sandığı', 'Stockholm', 'Baltık Hattı',
      'Şans', 'Oslo', 'Lüks Vergisi', 'Kopenhag'
    ])
  },
  dunya: {
    name: 'Dünya',
    currency: '$',
    properties: buildBoard([
      '🌍 BAŞLA / MAAŞ', 'Kahire', 'Topluluk', 'İskenderiye', 'Gelir Vergisi', 'Afrika Hattı',
      'İstanbul', 'Şans', 'Ankara', 'İzmir', 'Hapishane (Ziyaret)', 'Londra',
      'Elektrik Şirketi', 'Manchester', 'Birmingham', 'Avrupa Hattı', 'Roma', 'Topluluk',
      'Milano', 'Venedik', 'Ücretsiz Park', 'Berlin', 'Şans', 'Münih',
      'Hamburg', 'Pasifik Hattı', 'Madrid', 'Barselona', 'Su İşleri', 'Valensiya',
      'Hapishaneye Git', 'Şanghay', 'Pekin', 'Topluluk', 'Shenzhen', 'Kuzey Asya Hattı',
      'Şans', 'New York', 'Lüks Vergisi', 'Los Angeles'
    ])
  },
  japonya: {
    name: 'Japonya',
    currency: '¥',
    properties: buildBoard([
      '🇯🇵 BAŞLA / MAAŞ', 'Sapporo', 'Topluluk', 'Sendai', 'Gelir Vergisi', 'Shinkansen Hattı',
      'Niigata', 'Şans', 'Nagano', 'Kanazawa', 'Hapishane (Ziyaret)', 'Nagoya',
      'Elektrik Şirketi', 'Shizuoka', 'Yokohama', 'Tokaido Hattı', 'Kawasaki', 'Topluluk',
      'Kyoto', 'Osaka', 'Ücretsiz Park', 'Kobe', 'Şans', 'Hiroshima',
      'Fukuoka', 'Sanyo Hattı', 'Kagoshima', 'Kumamoto', 'Su İşleri', 'Naha',
      'Hapishaneye Git', 'Hakodate', 'Aomori', 'Topluluk', 'Akita', 'Sanyo Shinkansen',
      'Şans', 'Tokyo', 'Lüks Vergisi', 'Shibuya'
    ])
  },
  cin: {
    name: 'Çin',
    currency: '¥',
    properties: buildBoard([
      '🇨🇳 BAŞLA / MAAŞ', 'Harbin', 'Topluluk', 'Shenyang', 'Gelir Vergisi', 'Doğu Demiryolu',
      'Tianjin', 'Şans', 'Qingdao', 'Jinan', 'Hapishane (Ziyaret)', 'Nanjing',
      'Elektrik Şirketi', 'Hangzhou', 'Suzhou', 'Pekin-Şangay Hattı', 'Wuhan', 'Topluluk',
      'Changsha', 'Guangzhou', 'Ücretsiz Park', 'Shenzhen', 'Şans', 'Zhuhai',
      'Macau', 'Güney Demiryolu', 'Chengdu', 'Chongqing', 'Su İşleri', 'Kunming',
      'Hapishaneye Git', 'Xi’an', 'Lanzhou', 'Topluluk', 'Urumqi', 'Trans-Çin Hattı',
      'Şans', 'Şangay', 'Lüks Vergisi', 'Hong Kong'
    ])
  },
  kore: {
    name: 'Kore',
    currency: '₩',
    properties: buildBoard([
      '🇰🇷 BAŞLA / MAAŞ', 'Incheon', 'Topluluk', 'Suwon', 'Gelir Vergisi', 'KTX Hattı',
      'Daejeon', 'Şans', 'Cheongju', 'Sejong', 'Hapishane (Ziyaret)', 'Daegu',
      'Elektrik Şirketi', 'Gyeongju', 'Ulsan', 'Donghae Hattı', 'Busan', 'Topluluk',
      'Jeonju', 'Gwangju', 'Ücretsiz Park', 'Mokpo', 'Şans', 'Yeosu',
      'Suncheon', 'Honam Hattı', 'Wonju', 'Gangneung', 'Su İşleri', 'Sokcho',
      'Hapishaneye Git', 'Jeju', 'Seogwipo', 'Topluluk', 'Pohang', 'SRT Hattı',
      'Şans', 'Seul', 'Lüks Vergisi', 'Gangnam'
    ])
  },
  rusya: {
    name: 'Rusya',
    currency: '₽',
    properties: buildBoard([
      '🇷🇺 BAŞLA / MAAŞ', 'Kaliningrad', 'Topluluk', 'St. Petersburg', 'Gelir Vergisi', 'Baltık Demiryolu',
      'Novgorod', 'Şans', 'Pskov', 'Smolensk', 'Hapishane (Ziyaret)', 'Moskova',
      'Elektrik Şirketi', 'Kazan', 'Nijniy Novgorod', 'Trans-Sibirya (Batı)', 'Perm', 'Topluluk',
      'Yekaterinburg', 'Tyumen', 'Ücretsiz Park', 'Omsk', 'Şans', 'Novosibirsk',
      'Krasnoyarsk', 'Trans-Sibirya (Orta)', 'Irkutsk', 'Ulan Ude', 'Su İşleri', 'Chita',
      'Hapishaneye Git', 'Khabarovsk', 'Vladivostok', 'Topluluk', 'Magadan', 'Trans-Sibirya (Doğu)',
      'Şans', 'Yakutsk', 'Lüks Vergisi', 'Murmansk'
    ])
  }
};

function cloneBoardProperties(board) {
  return board.properties.map(p => ({ ...p }));
}

// Assign country groups for Dünya board so building checks can use groups
// Base template color groups positions:
// brown: [1,3], lightblue: [6,8,9], pink: [11,13,14], orange: [16,18,19],
// red: [21,23,24], yellow: [26,27,29], green: [31,32,34], darkblue: [37,39]
(function assignWorldGroups() {
  const b = boards.dunya.properties;
  if (!b) return;
  const setGroup = (indexes, name) => indexes.forEach(i => { if (b[i] && b[i].type === 'property') b[i].group = name; });
  setGroup([1,3], 'Mısır');
  setGroup([6,8,9], 'Türkiye');
  setGroup([11,13,14], 'Birleşik Krallık');
  setGroup([16,18,19], 'İtalya');
  setGroup([21,23,24], 'Almanya');
  setGroup([26,27,29], 'İspanya');
  setGroup([31,32,34], 'Çin');
  setGroup([37,39], 'Amerika');
})();

io.on('connection', (socket) => {
  console.log('🎮 Player connected:', socket.id);

  socket.on('createLobby', (data) => {
    const boardKey = data.boardKey && boards[data.boardKey] ? data.boardKey : 'dunya';
    const board = boards[boardKey];
    const lobbyId = uuidv4();
    const lobby = {
      id: lobbyId,
      createdAt: Date.now(),
      host: socket.id,
      boardKey,
      boardName: board.name,
      currency: board.currency || '₺',
      players: [{
        id: socket.id,
        name: data.playerName,
        appearance: data.appearance || '👤',
        color: data.color || '#ef4444',
        money: 2000,
        position: 0,
        properties: [],
        inJail: false,
        jailTurns: 0,
        hasRolled: false,
        isBankrupt: false
      }],
      started: false,
      currentTurn: 0,
      diceHistory: [],
      properties: cloneBoardProperties(board),
      gameRules: {
        initialMoney: 2000,
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

  socket.on('getLobbies', () => {
    const availableLobbies = Array.from(lobbies.values()).map(lobby => ({
      id: lobby.id,
      hostName: lobby.players[0]?.name || 'Unknown',
      playerCount: lobby.players.length,
      started: lobby.started,
      boardName: lobby.boardName
    })).filter(l => !l.started && l.playerCount < 12);
    socket.emit('lobbiesList', availableLobbies);
  });

  socket.on('joinLobby', (data) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }

    if (lobby.players.length >= 12) {
      socket.emit('error', 'Lobby is full');
      return;
    }
    
    // Check if color is already taken
    const colorTaken = lobby.players.some(p => p.color === data.color);
    if (colorTaken) {
      // Assign random available color
      const availableColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#10b981', '#f59e0b', '#6366f1', '#14b8a6'];
      const usedColors = lobby.players.map(p => p.color);
      const freeColors = availableColors.filter(c => !usedColors.includes(c));
      data.color = freeColors[0] || '#ffffff';
    }

    lobby.players.push({
      id: socket.id,
      name: data.playerName,
      appearance: data.appearance || '👤',
      color: data.color || '#3b82f6',
      money: 2000,
      position: 0,
      properties: [],
      inJail: false,
      jailTurns: 0,
      hasRolled: false,
      isBankrupt: false
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
    if (!lobby || lobby.host !== socket.id || lobby.players.length < 1) return;

    lobby.started = true;
    lobby.gameRules = data.rules || lobby.gameRules;
    // Apply price/rent scaling before game starts
    applyEconomyScale(lobby);
    
    // Set initial money for all players based on game rules
    const initialMoney = lobby.gameRules.initialMoney || 2000;
    lobby.players.forEach(player => {
      player.money = initialMoney;
    });
    
    io.to(lobbyId).emit('gameStarted', lobby);
    console.log('🎮 Game started in lobby:', lobbyId);
  });

  socket.on('rollDice', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const currentPlayer = lobby.players[lobby.currentTurn];
    if (currentPlayer.id !== socket.id) return;

    // Set hasRolled flag
    currentPlayer.hasRolled = true;

    // Single die instead of two dice
    const diceValue = Math.floor(Math.random() * 9) + 1; // 1-9 instead of 1-6 + 1-6
    const total = diceValue;
    const oldPosition = currentPlayer.position;
    let newPosition = (currentPlayer.position + total) % 40;

    // Check if passed GO
    let passedGo = false;
    if (oldPosition + total >= 40) {
      currentPlayer.money += lobby.gameRules.goMoney || 200;
      passedGo = true;
      lobby.events.push({ type: 'pass-go', player: currentPlayer.name, amount: lobby.gameRules.goMoney });
    }

    currentPlayer.position = newPosition;
    const landedSpace = lobby.properties[newPosition];

    // Handle special spaces
    let specialMessage = null;

    // Parking - get free parking money
    if (landedSpace.type === 'parking') {
      const parkingBonus = 100;
      currentPlayer.money += parkingBonus;
      specialMessage = `${currentPlayer.name} Ücretsiz Park'a geldi ve ${lobby.currency}${parkingBonus} kazandı!`;
      lobby.events.push({ type: 'parking', player: currentPlayer.name });
    }

    // Go to Jail
    if (landedSpace.type === 'gotojail') {
      currentPlayer.position = 10; // Jail position
      currentPlayer.inJail = true;
      currentPlayer.jailTurns = 0;
      specialMessage = `${currentPlayer.name} hapishaneye gönderildi!`;
      lobby.events.push({ type: 'gotojail', player: currentPlayer.name });
    }

    // Tax spaces
    let taxMessage = null;
    if (landedSpace.type === 'tax') {
      const taxAmount = newPosition === 4 ? 200 : 100;
      currentPlayer.money -= taxAmount;
      taxMessage = `${currentPlayer.name} vergi olarak ${lobby.currency}${taxAmount} ödedi`;
      lobby.events.push({ type: 'tax-paid', player: currentPlayer.name, amount: taxAmount });
    }

    // Handle chance and community chest cards - show actual card messages
    let cardMessage = null;
    if (landedSpace.type === 'chance' || landedSpace.type === 'chest') {
      const cardType = landedSpace.type === 'chance' ? 'Şans' : 'Topluluk';
      const cards = [
        { msg: 'Banka hatası! Sana ₺200 ödendi.', money: 200 },
        { msg: 'Doktor faturası ödeyeceksin. ₺50 öde.', money: -50 },
        { msg: 'Doğum günün! Her oyuncudan ₺10 al.', money: 50 },
        { msg: 'Okul ücretini öde. ₺150 öde.', money: -150 },
        { msg: 'Güzellik yarışmasında ikinci oldun! ₺10 kazan.', money: 10 },
        { msg: 'Vergi iadesi! ₺100 al.', money: 100 },
        { msg: 'Hastane faturası! ₺100 öde.', money: -100 },
        { msg: 'Yatırımlarından kazandın! ₺50 al.', money: 50 },
        { msg: 'Trafik cezası! ₺15 öde.', money: -15 },
        { msg: 'Hisse senetlerin değer kazandı! ₺120 al.', money: 120 }
      ];
      const card = cards[Math.floor(Math.random() * cards.length)];
      currentPlayer.money += card.money;
      cardMessage = `${cardType}: ${card.msg}`;
      lobby.events.push({ type: cardType.toLowerCase(), player: currentPlayer.name, message: card.msg });
    }

    // Determine space type for client-side handling
    const isSpecialSpace = ['tax', 'chance', 'chest', 'parking', 'gotojail', 'go', 'jail'].includes(landedSpace.type);
    const isBuyableProperty = ['property', 'railroad', 'utility'].includes(landedSpace.type) && !landedSpace.owner;

    io.to(lobbyId).emit('diceRolled', {
      player: currentPlayer,
      dice1: diceValue,
      dice2: 0,
      total,
      newPosition,
      landedSpace,
      cardMessage,
      taxMessage,
      specialMessage,
      passedGo,
      goMoney: lobby.gameRules.goMoney,
      currency: lobby.currency,
      message: `${currentPlayer.name} ${total} attı`,
      isSpecialSpace,
      isBuyableProperty
    });
  });

  socket.on('advanceTurn', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const currentPlayer = lobby.players[lobby.currentTurn];
    
    // Only current player can advance turn
    if (currentPlayer.id !== socket.id) return;
    
    // Reset hasRolled flag
    currentPlayer.hasRolled = false;
    
    // Handle jail logic
    if (currentPlayer.inJail) {
      currentPlayer.jailTurns++;
      if (currentPlayer.jailTurns >= 3) {
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        lobby.events.push({ type: 'jail-released', player: currentPlayer.name, reason: '3 tur doldu' });
        io.to(lobbyId).emit('jailReleased', { player: currentPlayer, reason: '3 tur bekledin' });
      }
    }
    
    // Move to next player (skip bankrupt players)
    let nextTurn = (lobby.currentTurn + 1) % lobby.players.length;
    let attempts = 0;
    while (lobby.players[nextTurn].isBankrupt && attempts < lobby.players.length) {
      nextTurn = (nextTurn + 1) % lobby.players.length;
      attempts++;
    }
    
    lobby.currentTurn = nextTurn;
    io.to(lobbyId).emit('turnEnded', { currentTurn: lobby.currentTurn });
    
    console.log(`➡️ Sıra geçti: ${lobby.players[nextTurn].name}`);
  });

  socket.on('buyProperty', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    const currentPlayer = lobby.players[lobby.currentTurn];
    const property = lobby.properties[data.propertyId];

    // Only current player can buy property
    if (player.id !== currentPlayer.id) return;
    // Can only buy property they just landed on
    if (player.position !== data.propertyId) return;

    if (!player || !property || property.owner) return;

    if (player.money < property.price) {
      socket.emit('errorMessage', `Yetersiz bakiye! (${player.money} < ${property.price})`);
      return;
    }

    player.money -= property.price;
    player.properties.push(data.propertyId);
    property.owner = socket.id;
    property.ownerColor = player.color;

    io.to(lobbyId).emit('propertyBought', {
      player,
      property,
      message: `${player.name} bought ${property.name}`
    });

    lobby.events.push({ 
      type: 'property-bought', 
      player: player.name, 
      playerColor: player.color,
      property: property.name 
    });
  });

  socket.on('buildHouse', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    const property = lobby.properties[data.propertyId];
    
    if (!property || property.owner !== socket.id) return;
    if (!property.color || property.type !== 'property') return;

    // Check if player owns monopoly (use country group if available)
    const groupKey = property.group || property.color;
    const myProps = lobby.properties.filter(p => p.owner === socket.id && (p.group || p.color) === groupKey && p.type === 'property');
    const groupSize = lobby.properties.filter(p => (p.group || p.color) === groupKey && p.type === 'property').length;
    if (myProps.length !== groupSize) return;

    // Initialize houses if not exists
    if (property.houses === undefined) property.houses = 0;
    if (property.houses >= 5) return;

    const houseCost = Math.floor(property.price / 2);
    if (player.money < houseCost) return;

    player.money -= houseCost;
    property.houses++;

    const buildType = property.houses === 5 ? 'otel' : 'ev';
    io.to(lobbyId).emit('houseBuilt', {
      player,
      property,
      buildType,
      message: `${player.name} ${property.name} üzerine ${buildType} dikti`
    });

    lobby.events.push({ 
      type: 'house-built', 
      player: player.name, 
      playerColor: player.color,
      property: property.name, 
      buildType 
    });
  });

  socket.on('sellHouse', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    const property = lobby.properties[data.propertyId];
    
    if (!property || property.owner !== socket.id) return;
    if (!property.houses || property.houses <= 0) return;

    const houseCost = Math.floor(property.price / 2);
    const sellPrice = Math.floor(houseCost / 2);
    
    player.money += sellPrice;
    property.houses--;

    const soldType = property.houses === 4 ? 'otel' : 'ev';
    io.to(lobbyId).emit('houseSold', {
      player,
      property,
      soldType,
      message: `${player.name} ${property.name} üzerinden ${soldType} sattı`
    });

    lobby.events.push({ 
      type: 'house-sold', 
      player: player.name, 
      playerColor: player.color,
      property: property.name, 
      soldType 
    });
  });

  socket.on('endTurn', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const currentPlayer = lobby.players[lobby.currentTurn];
    
    // Only current player can end their turn
    if (currentPlayer.id !== socket.id) {
      socket.emit('errorMessage', 'Sıra sende değil!');
      return;
    }
    
    // Check if current player has rolled dice
    if (!currentPlayer.hasRolled && !currentPlayer.inJail) {
      socket.emit('errorMessage', 'Önce zar atmalısınız!');
      return;
    }

    // Reset hasRolled flag for current player
    currentPlayer.hasRolled = false;

    // Handle jail logic
    if (currentPlayer.inJail) {
      currentPlayer.jailTurns++;
      // Auto-release after 3 turns
      if (currentPlayer.jailTurns >= 3) {
        currentPlayer.inJail = false;
        currentPlayer.jailTurns = 0;
        lobby.events.push({ type: 'jail-released', player: currentPlayer.name, reason: '3 tur doldu' });
        io.to(lobbyId).emit('jailReleased', { player: currentPlayer, reason: '3 tur bekledin' });
      }
    }

    // Move to next player (skip bankrupt players)
    let nextTurn = (lobby.currentTurn + 1) % lobby.players.length;
    let attempts = 0;
    while (lobby.players[nextTurn].isBankrupt && attempts < lobby.players.length) {
      nextTurn = (nextTurn + 1) % lobby.players.length;
      attempts++;
    }
    
    lobby.currentTurn = nextTurn;
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

  // Simple trade relay + apply on accept
  socket.on('proposeTrade', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;
    const from = lobby.players.find(p => p.id === socket.id);
    const to = lobby.players.find(p => p.id === data.to);
    if (!from || !to) return;
    // Validate offered props belong to sender, requested belong to receiver
    const validMyProps = (data.myPropIds || []).every(id => lobby.properties[id]?.owner === socket.id);
    const validTheirProps = (data.theirPropIds || []).every(id => lobby.properties[id]?.owner === to.id);
    if (!validMyProps || !validTheirProps) return;

    const tradeId = uuidv4();
    io.to(to.id).emit('tradeOffer', {
      tradeId,
      from: socket.id,
      myPropIds: data.myPropIds || [],
      theirPropIds: data.theirPropIds || [],
      offerMoney: Math.max(0, data.offerMoney || 0),
      requestMoney: Math.max(0, data.requestMoney || 0)
    });

    // Store trade in memory
    lobby._pendingTrades = lobby._pendingTrades || new Map();
    lobby._pendingTrades.set(tradeId, {
      id: tradeId,
      from: socket.id,
      to: to.id,
      myPropIds: data.myPropIds || [],
      theirPropIds: data.theirPropIds || [],
      offerMoney: Math.max(0, data.offerMoney || 0),
      requestMoney: Math.max(0, data.requestMoney || 0)
    });
  });

  socket.on('respondTrade', (payload) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby._pendingTrades) return;
    const tr = lobby._pendingTrades.get(payload.tradeId);
    if (!tr) return;
    // Only receiver can respond
    if (tr.to !== socket.id) return;

    if (!payload.accept) {
      lobby._pendingTrades.delete(payload.tradeId);
      return;
    }

    const from = lobby.players.find(p => p.id === tr.from);
    const to = lobby.players.find(p => p.id === tr.to);
    if (!from || !to) return;

    // Money checks
    if (from.money < tr.offerMoney) return;
    if (to.money < tr.requestMoney) return;

    from.money -= tr.offerMoney;
    to.money += tr.offerMoney;
    to.money -= tr.requestMoney;
    from.money += tr.requestMoney;

    // Transfer properties
    const updatedProperties = [];
    (tr.myPropIds || []).forEach(id => {
      const prop = lobby.properties[id];
      if (prop && prop.owner === from.id) {
        prop.owner = to.id;
        updatedProperties.push({ id: prop.id, owner: prop.owner });
        // Update players' property arrays
        from.properties = from.properties.filter(pid => pid !== id);
        to.properties.push(id);
      }
    });
    (tr.theirPropIds || []).forEach(id => {
      const prop = lobby.properties[id];
      if (prop && prop.owner === to.id) {
        prop.owner = from.id;
        updatedProperties.push({ id: prop.id, owner: prop.owner });
        to.properties = to.properties.filter(pid => pid !== id);
        from.properties.push(id);
      }
    });

    lobby._pendingTrades.delete(payload.tradeId);

    io.to(lobbyId).emit('tradeCompleted', {
      updatedPlayers: [
        { id: from.id, money: from.money, properties: from.properties },
        { id: to.id, money: to.money, properties: to.properties }
      ],
      updatedProperties,
      message: `${from.name} ⇄ ${to.name}`
    });
  });

  socket.on('payJailFine', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.inJail) return;

    const fineAmount = 100;
    if (player.money < fineAmount) {
      socket.emit('errorMessage', 'Yetersiz para! Hapishane cezasını ödeyemiyorsun.');
      return;
    }

    player.money -= fineAmount;
    player.inJail = false;
    player.jailTurns = 0;
    player.hasRolled = true; // Mark as if rolled to allow turn end

    lobby.events.push({ type: 'jail-released', player: player.name, reason: 'ceza ödendi' });
    io.to(lobbyId).emit('jailReleased', { player, reason: 'Ceza ödendi' });
  });

  socket.on('rollForJail', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.inJail) return;

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const isDoubles = dice1 === dice2;

    if (isDoubles) {
      player.inJail = false;
      player.jailTurns = 0;
      player.hasRolled = true; // Mark as rolled
      player.position = (player.position + dice1 + dice2) % 40;

      lobby.events.push({ type: 'jail-released', player: player.name, reason: 'çift zar' });
      io.to(lobbyId).emit('jailReleased', {
        player,
        reason: `Çift zar attın (${dice1}-${dice2})`,
        dice1,
        dice2,
        newPosition: player.position
      });
    } else {
      socket.emit('jailRollFailed', { dice1, dice2, message: 'Çift zar atamadın, hapiste kalıyorsun.' });
    }
  });

  socket.on('declareBankruptcy', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || player.isBankrupt) return;

    // Mark player as bankrupt
    player.isBankrupt = true;
    player.money = 0;

    // Release all properties - make them unowned
    lobby.properties.forEach(prop => {
      if (prop.owner === socket.id) {
        prop.owner = null;
        prop.ownerColor = null;
        prop.houses = 0;
      }
    });

    // Clear player's property list
    player.properties = [];

    // Add event
    lobby.events.push({ 
      type: 'bankrupt', 
      player: player.name, 
      message: `${player.name} iflas etti ve oyundan çekildi!` 
    });

    // Notify all players
    io.to(lobbyId).emit('playerBankrupt', { 
      player,
      message: `${player.name} iflas etti!`
    });

    // Update game state
    io.to(lobbyId).emit('lobbyUpdated', lobby);

    console.log(`💸 ${player.name} declared bankruptcy in lobby ${lobbyId}`);
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
