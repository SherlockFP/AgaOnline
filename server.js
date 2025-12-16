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
  { color: '#22c55e', type: 'go', price: 0, rent: [] },
  { color: 'brown', type: 'property', price: 60, rent: [2, 10, 30, 90, 160, 250] },
  { color: '#16a34a', type: 'chest', price: 0, rent: [] },
  { color: 'brown', type: 'property', price: 60, rent: [4, 20, 60, 180, 320, 450] },
  { color: '#eab308', type: 'tax', price: 0, rent: [] },
  { color: '#0284c7', type: 'railroad', price: 200, rent: [] },
  { color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { color: '#fb923c', type: 'chance', price: 0, rent: [] },
  { color: 'lightblue', type: 'property', price: 100, rent: [6, 30, 90, 270, 400, 550] },
  { color: 'lightblue', type: 'property', price: 120, rent: [8, 40, 120, 360, 640, 900] },
  { color: '#f97316', type: 'jail', price: 0, rent: [] },
  { color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { color: '#06b6d4', type: 'utility', price: 150, rent: [] },
  { color: 'pink', type: 'property', price: 140, rent: [10, 50, 150, 450, 625, 750] },
  { color: 'pink', type: 'property', price: 160, rent: [12, 60, 180, 500, 1100, 1300] },
  { color: '#0284c7', type: 'railroad', price: 200, rent: [] },
  { color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { color: '#16a34a', type: 'chest', price: 0, rent: [] },
  { color: 'orange', type: 'property', price: 180, rent: [14, 70, 200, 550, 750, 950] },
  { color: 'orange', type: 'property', price: 200, rent: [16, 80, 220, 600, 800, 1000] },
  { color: '#a855f7', type: 'parking', price: 0, rent: [] },
  { color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { color: '#fb923c', type: 'chance', price: 0, rent: [] },
  { color: 'red', type: 'property', price: 220, rent: [18, 90, 250, 700, 875, 1050] },
  { color: 'red', type: 'property', price: 240, rent: [20, 100, 300, 750, 925, 1100] },
  { color: '#0284c7', type: 'railroad', price: 200, rent: [] },
  { color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { color: 'yellow', type: 'property', price: 260, rent: [22, 110, 330, 800, 975, 1150] },
  { color: '#06b6d4', type: 'utility', price: 150, rent: [] },
  { color: 'yellow', type: 'property', price: 280, rent: [24, 120, 360, 850, 1025, 1200] },
  { color: '#ef4444', type: 'gotojail', price: 0, rent: [] },
  { color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { color: 'green', type: 'property', price: 300, rent: [26, 130, 390, 900, 1100, 1275] },
  { color: '#16a34a', type: 'chest', price: 0, rent: [] },
  { color: 'green', type: 'property', price: 320, rent: [28, 150, 450, 1000, 1200, 1400] },
  { color: '#0284c7', type: 'railroad', price: 200, rent: [] },
  { color: '#fb923c', type: 'chance', price: 0, rent: [] },
  { color: 'darkblue', type: 'property', price: 350, rent: [35, 175, 500, 1100, 1300, 1500] },
  { color: '#eab308', type: 'tax', price: 0, rent: [] },
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
  const baseMoney = 2500;
  const initial = lobby.gameRules?.initialMoney || baseMoney;
  // Increase prices a bit more to make rents and costs feel heavier
  const extraBoost = 1.5;
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
      '🇹🇷 BAŞLA / MAAŞ', 'Edirne', 'Kamu Sandığı', 'Kırklareli', 'Gelir Vergisi', 'Marmaray Hattı',
      'Trabzon', 'Şans', 'Çanakkale', 'Bursa', 'Hapishane (Ziyaret)', 'Ankara Çankaya',
      'Elektrik Şirketi', 'Ankara Kızılay', 'Konya', 'Yüksek Hızlı Tren', 'İzmir Alsancak', 'Kamu Sandığı',
      'İzmir Karşıyaka', 'İzmir Bornova', 'Ücretsiz Park', 'Antalya Kaleiçi', 'Şans', 'Antalya Lara',
      'Muğla Bodrum', 'Denizli Hattı', 'Muğla Marmaris', 'Aydın Kuşadası', 'Su İşleri', 'Muğla Fethiye',
      'Hapishaneye Git', 'İstanbul Beşiktaş', 'İstanbul Şişli', 'Kamu Sandığı', 'İstanbul Beyoğlu', 'İstanbul Metro',
      'Şans', 'İstanbul Nişantaşı', 'Lüks Vergisi', 'İstanbul Bebek'
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
      'İstanbul', 'Şans', 'Ankara', 'İzmir', 'Hapishane (Ziyaret)', 'Moskova',
      'Elektrik Şirketi', 'Milano', 'Venedik', 'Avrupa Hattı', 'Londra', 'Topluluk',
      'Manchester', 'Birmingham', 'Ücretsiz Park', 'Berlin', 'Şans', 'Münih',
      'Hamburg', 'Pasifik Hattı', 'Paris', 'Marsilya', 'Su İşleri', 'Lyon',
      'Hapishaneye Git', 'Şanghay', 'Pekin', 'Topluluk', 'Shenzhen', 'Kuzey Asya Hattı',
      'Şans', 'Pekin', 'Lüks Vergisi', 'Tokyo'
    ])
  },
  istanbul: {
    name: 'İstanbul',
    currency: '₺',
    properties: buildBoard([
      '🕌 BAŞLA / MAAŞ', 'Esenyurt', 'Kamu Sandığı', 'Sultanbeyli', 'Gelir Vergisi', 'Marmaray',
      'Esenler', 'Şans', 'Güngören', 'Bağcılar', 'Silivri (Ziyaret)', 'Gaziosmanpaşa',
      'Vapur', 'Pendik', 'Küçükçekmece', 'Şehir Hatları', 'Kartal', 'Kamu Sandığı',
      'Ümraniye', 'Maltepe', '🅿️ İSPARK', 'Kadıköy', 'Şans', 'Üsküdar',
      'Fatih', 'Metro', 'Beyoğlu', 'Şişli', 'Vapur', 'Bakırköy',
      'Silivri\'ye Git', 'Beykoz', 'Çekmeköy', 'Kamu Sandığı', 'Sarıyer', 'Metro',
      'Şans', 'Beşiktaş', 'Lüks Vergisi', 'Etiler'
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
  // swap UK and Italy groups: place Italy where UK was, and UK where Italy was
  setGroup([11,13,14], 'İtalya');
  setGroup([16,18,19], 'Birleşik Krallık');
  setGroup([21,23,24], 'Almanya');
  // replace Spain group with France
  setGroup([26,27,29], 'Fransa');
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
        money: 2500,
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
      // Lobby settings
      maxPlayers: data.maxPlayers || 12,
      requiredPlayers: data.requiredPlayers || 2,
      password: data.password || null,
      gameRules: {
        initialMoney: 2500,
        goMoney: 250,
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
      boardName: lobby.boardName,
      hasPassword: !!lobby.password,
      maxPlayers: lobby.maxPlayers || 12,
      requiredPlayers: lobby.requiredPlayers || 2
    })).filter(l => !l.started && l.playerCount < (l.maxPlayers || 12));
    socket.emit('lobbiesList', availableLobbies);
  });

  socket.on('joinLobby', (data) => {
    const lobby = lobbies.get(data.lobbyId);
    if (!lobby) {
      socket.emit('error', 'Lobby not found');
      return;
    }
    // Check password if set
    if (lobby.password) {
      if (!data.password || data.password !== lobby.password) {
        socket.emit('error', 'Lobi şifresi yanlış veya eksik');
        return;
      }
    }

    const maxPlayers = lobby.maxPlayers || 12;
    if (lobby.players.length >= maxPlayers) {
      socket.emit('error', 'Lobi dolu');
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
      consecutiveDoubles: 0,
      isBankrupt: false,
      freeJailCards: 0
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
      
      // Check if color is already taken by another player
      if (data.color) {
        const colorTaken = lobby.players.some(p => p.id !== socket.id && p.color === data.color);
        if (colorTaken) {
          socket.emit('error', 'Bu renk başka bir oyuncu tarafından seçildi.');
          return;
        }
        player.color = data.color;
      }
      
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
    const initialMoney = lobby.gameRules.initialMoney || 2500;
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
    try {

    const currentPlayer = lobby.players[lobby.currentTurn];
    if (!currentPlayer || currentPlayer.id !== socket.id) return;

    // Set hasRolled flag
    currentPlayer.hasRolled = true;

    // Two dice like normal Monopoly
    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const isDoubles = dice1 === dice2;

    // Track consecutive doubles per player
    currentPlayer.consecutiveDoubles = currentPlayer.consecutiveDoubles || 0;
    if (isDoubles) {
      currentPlayer.consecutiveDoubles++;
    } else {
      currentPlayer.consecutiveDoubles = 0;
    }

    // If player rolled three doubles in a row, send to jail immediately (standard Monopoly rule)
    if (currentPlayer.consecutiveDoubles >= 3) {
      currentPlayer.position = 10; // Jail position
      currentPlayer.inJail = true;
      currentPlayer.jailTurns = 0;
      currentPlayer.consecutiveDoubles = 0;
      // Emit diceRolled so clients animate the dice and show jail move
      io.to(lobbyId).emit('diceRolled', {
        player: currentPlayer,
        dice1,
        dice2,
        total: dice1 + dice2,
        newPosition: currentPlayer.position,
        landedSpace: lobby.properties[currentPlayer.position],
        cardMessage: null,
        taxMessage: null,
        specialMessage: `${currentPlayer.name} üç kez art arda çift attı ve hapise gönderildi!`,
        rentMessage: null,
        passedGo: false,
        goMoney: lobby.gameRules.goMoney,
        currency: lobby.currency,
        message: `${currentPlayer.name} üç çift attı ve hapise gönderildi!`,
        isSpecialSpace: true,
        isBuyableProperty: false
      });
      lobby.events.push({ type: 'gotojail', player: currentPlayer.name, reason: '3 consecutive doubles' });
      return;
    }
    const total = dice1 + dice2;
    const oldPosition = currentPlayer.position;
    let newPosition = (currentPlayer.position + total) % 40;

    // Check if passed GO
    let passedGo = false;
    if (oldPosition + total >= 40) {
      currentPlayer.money += lobby.gameRules.goMoney || 250;
      passedGo = true;
      lobby.events.push({ type: 'pass-go', player: currentPlayer.name, amount: lobby.gameRules.goMoney });
    }

    currentPlayer.position = newPosition;
    let landedSpace = lobby.properties[newPosition];
    if (!landedSpace) {
      console.warn('⚠️ landedSpace undefined at position', newPosition);
    }

    // Handle special spaces
    let specialMessage = null;

    // Parking - get free parking money
    if (landedSpace && landedSpace.type === 'parking') {
      const parkingBonus = 100;
      currentPlayer.money += parkingBonus;
      specialMessage = `${currentPlayer.name} Ücretsiz Park'a geldi ve ${lobby.currency}${parkingBonus} kazandı!`;
      lobby.events.push({ type: 'parking', player: currentPlayer.name });
    }

    // Go to Jail
    if (landedSpace && landedSpace.type === 'gotojail') {
      currentPlayer.position = 10; // Jail position
      currentPlayer.inJail = true;
      currentPlayer.jailTurns = 0;
      specialMessage = `${currentPlayer.name} hapishaneye gönderildi!`;
      lobby.events.push({ type: 'gotojail', player: currentPlayer.name });
    }

    // Tax spaces
    let taxMessage = null;
    if (landedSpace && landedSpace.type === 'tax') {
      const taxAmount = newPosition === 4 ? 200 : 100;
      currentPlayer.money -= taxAmount;
      taxMessage = `${currentPlayer.name} vergi olarak ${lobby.currency}${taxAmount} ödedi`;
      lobby.events.push({ type: 'tax-paid', player: currentPlayer.name, amount: taxAmount });
    }

    // Handle chance and community chest cards - show actual card messages
    let cardMessage = null;
    if (landedSpace && (landedSpace.type === 'chance' || landedSpace.type === 'chest')) {
      const cardType = landedSpace.type === 'chance' ? 'Şans' : 'Topluluk';
      const cards = [
        { msg: 'Banka hatası! Sana ₺200 ödendi.', money: 200 },
        { msg: 'Doktor faturası ödeyeceksin. ₺50 öde.', money: -50 },
        { msg: 'Doğum günün! Her oyuncudan ₺10 al.', money: 0, collectFromPlayers: 10 },
        { msg: 'Okul ücretini öde. ₺150 öde.', money: -150 },
        { msg: 'Güzellik yarışmasında ikinci oldun! ₺10 kazan.', money: 10 },
        { msg: 'Vergi iadesi! ₺100 al.', money: 100 },
        { msg: 'Hastane faturası! ₺100 öde.', money: -100 },
        { msg: 'Yatırımlarından kazandın! ₺50 al.', money: 50 },
        { msg: 'Trafik cezası! ₺15 öde.', money: -15 },
        { msg: 'Hisse senetlerin değer kazandı! ₺120 al.', money: 120 },
        { msg: 'BAŞLA\'ya git ve ₺200 al!', money: 0, goToStart: true },
        { msg: 'Hapishaneye git! Doğrudan geç! ₺200 alma!', money: 0, goToJail: true },
        { msg: '3 kare ileri git!', money: 0, moveForward: 3 },
        { msg: '5 kare geri git!', money: 0, moveBackward: 5 },
        { msg: 'En yakın trene git!', money: 0, goToNearest: 'railroad' },
        { msg: '🎫 PARDON KARTI kazandın! Hapishaneden bedava çıkabilirsin.', money: 0, freeJailCard: true },
        { msg: 'Tatil kazandın! ₺300 al.', money: 300 },
        { msg: 'Gelir vergisi öde! ₺200 öde.', money: -200 },
        { msg: 'Her ev için ₺25, her otel için ₺100 öde.', money: 0, repairCost: true },
        { msg: 'Yıldırım turu! ₺500 kazan!', money: 500 }
      ];
      const card = cards[Math.floor(Math.random() * cards.length)];
      
      // Handle special card effects
      if (card.goToStart) {
        currentPlayer.position = 0;
        currentPlayer.money += lobby.gameRules.goMoney || 250;
        cardMessage = `${cardType}: ${card.msg}`;
      } else if (card.goToJail) {
        currentPlayer.position = 10;
        currentPlayer.inJail = true;
        currentPlayer.jailTurns = 0;
        cardMessage = `${cardType}: ${card.msg}`;
      } else if (card.moveForward) {
        currentPlayer.position = (currentPlayer.position + card.moveForward) % 40;
        cardMessage = `${cardType}: ${card.msg}`;
      } else if (card.moveBackward) {
        currentPlayer.position = (currentPlayer.position - card.moveBackward + 40) % 40;
        cardMessage = `${cardType}: ${card.msg}`;
      } else if (card.freeJailCard) {
        currentPlayer.freeJailCards = (currentPlayer.freeJailCards || 0) + 1;
        cardMessage = `${cardType}: ${card.msg}`;
      } else if (card.repairCost) {
        let cost = 0;
        lobby.properties.forEach(prop => {
          if (prop.owner === currentPlayer.id && prop.houses) {
            cost += prop.houses === 5 ? 100 : prop.houses * 25;
          }
        });
        currentPlayer.money -= cost;
        cardMessage = `${cardType}: ${card.msg} (Toplam: ₺${cost})`;
      } else if (card.collectFromPlayers) {
        // Collect money from all other players
        let totalCollected = 0;
        lobby.players.forEach(p => {
          if (p.id !== currentPlayer.id && !p.isBankrupt) {
            p.money -= card.collectFromPlayers;
            totalCollected += card.collectFromPlayers;
          }
        });
        currentPlayer.money += totalCollected;
        cardMessage = `${cardType}: ${card.msg} (Toplam: ₺${totalCollected})`;
      } else {
        currentPlayer.money += card.money;
        cardMessage = `${cardType}: ${card.msg}`;
      }
      
      lobby.events.push({ type: cardType.toLowerCase(), player: currentPlayer.name, message: card.msg });
    }

    // Update newPosition after chance/chest card movements
    newPosition = currentPlayer.position;
    
    // Check if landed on owned property (pay rent)
    // Update landedSpace after chance/chest cards that might move player
    const finalPosition = currentPlayer.position;
    const finalLandedSpace = lobby.properties[finalPosition];
    if (!finalLandedSpace) {
      console.warn('⚠️ finalLandedSpace undefined at position', finalPosition);
    }
    let rentMessage = null;
    
    if (finalLandedSpace && ['property', 'railroad', 'utility'].includes(finalLandedSpace.type) && finalLandedSpace.owner && finalLandedSpace.owner !== socket.id) {
      const owner = lobby.players.find(p => p.id === finalLandedSpace.owner);
      if (owner && !owner.isBankrupt) {
        let rentAmount = 0;

        // Special handling for railroads
        if (finalLandedSpace.type === 'railroad') {
          const ownerRailroads = lobby.properties.filter(p => p.owner === owner.id && p.type === 'railroad').length;
          const rrTable = [25, 50, 100, 200];
          rentAmount = rrTable[Math.max(0, Math.min(3, ownerRailroads - 1))] || 25;
        }

        // Special handling for utilities
        else if (finalLandedSpace.type === 'utility') {
          const ownerUtilities = lobby.properties.filter(p => p.owner === owner.id && p.type === 'utility').length;
          const multiplier = ownerUtilities === 1 ? 4 : 10;
          rentAmount = total * multiplier;
        }

        // Regular property with houses
        else {
          rentAmount = finalLandedSpace.rent || 0;
          if (finalLandedSpace.houses > 0) {
            const houseRents = [finalLandedSpace.rent1house, finalLandedSpace.rent2house, finalLandedSpace.rent3house, finalLandedSpace.rent4house, finalLandedSpace.renthotel];
            rentAmount = houseRents[finalLandedSpace.houses - 1] || rentAmount;
          }
        }

        // Pay rent only if both players have enough money
        if (currentPlayer.money >= rentAmount && rentAmount > 0) {
          currentPlayer.money -= rentAmount;
          owner.money += rentAmount;

          rentMessage = `${currentPlayer.name}, ${owner.name}'in mülküne geldi ve ${lobby.currency}${rentAmount} kira ödedi`;
          if (finalLandedSpace.houses > 0) {
            const houseText = finalLandedSpace.houses === 5 ? 'otel' : `${finalLandedSpace.houses} ev`;
            rentMessage += ` (${houseText})`;
          }

          lobby.events.push({ 
            type: 'rent-paid', 
            player: currentPlayer.name, 
            owner: owner.name, 
            amount: rentAmount,
            property: finalLandedSpace.name,
            playerColor: currentPlayer.color,
            ownerColor: owner.color
          });
        }
      }
    }

    // Update landedSpace to reflect any card-induced moves (so client sees final landing)
    landedSpace = finalLandedSpace || landedSpace;

    // Determine space type for client-side handling (use updated landedSpace)
    const isSpecialSpace = landedSpace ? ['tax', 'chance', 'chest', 'parking', 'gotojail', 'go', 'jail'].includes(landedSpace.type) : false;
    const isBuyableProperty = landedSpace ? (['property', 'railroad', 'utility'].includes(landedSpace.type) && !landedSpace.owner) : false;

    io.to(lobbyId).emit('diceRolled', {
      player: currentPlayer,
      dice1: dice1,
      dice2: dice2,
      total,
      newPosition,
      landedSpace,
      cardMessage,
      taxMessage,
      specialMessage,
      rentMessage,
      passedGo,
      goMoney: lobby.gameRules.goMoney,
      currency: lobby.currency,
      message: `${currentPlayer.name} ${total} attı (${dice1} + ${dice2})`,
      isSpecialSpace,
      isBuyableProperty
    });
    } catch (err) {
      console.error('❌ Error in rollDice handler:', err);
      try {
        io.to(lobbyId).emit('serverError', { message: 'Zar atarken sunucu hatası oluştu. Lütfen tekrar deneyin.' });
      } catch {}
    }
  });

  socket.on('advanceTurn', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) {
      console.log('❌ advanceTurn: No lobby or not started');
      return;
    }

    const currentPlayer = lobby.players[lobby.currentTurn];
    console.log('📥 advanceTurn received from:', socket.id, 'current player:', currentPlayer.id, 'match:', currentPlayer.id === socket.id);
    
    // Only current player can advance turn
    if (currentPlayer.id !== socket.id) {
      console.log('❌ advanceTurn: Not current player');
      return;
    }
    
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

  // Host-only: update lobby settings (maxPlayers, requiredPlayers, password)
  socket.on('updateLobbySettings', (settings) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;
    if (lobby.host !== socket.id) {
      socket.emit('error', 'Sadece ev sahibi ayarları değiştirebilir');
      return;
    }

    if (typeof settings.maxPlayers === 'number') lobby.maxPlayers = Math.max(2, Math.min(50, Math.floor(settings.maxPlayers)));
    if (typeof settings.requiredPlayers === 'number') lobby.requiredPlayers = Math.max(2, Math.min(lobby.maxPlayers || 12, Math.floor(settings.requiredPlayers)));
    if (settings.password === '' || settings.password === null) lobby.password = null;
    else if (typeof settings.password === 'string') lobby.password = settings.password;

    io.to(lobbyId).emit('lobbyUpdated', lobby);
    console.log(`🔧 Lobby ${lobbyId} settings updated by host`);
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

    const houseCost = Math.ceil(property.price * 0.6);
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

    const houseCost = Math.ceil(property.price * 0.6);
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

  socket.on('sendPrivateMessage', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    const target = lobby.players.find(p => p.id === data.targetId);
    if (!target) return;

    // Send only to target
    io.to(data.targetId).emit('privateMessageReceived', {
      playerName: player.name,
      playerColor: player.color,
      message: data.message,
      timestamp: new Date()
    });
  });

  socket.on('sendEmoji', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    
    // Broadcast emoji effect to all players in lobby
    io.to(lobbyId).emit('emojiEffect', {
      emoji: data.emoji,
      playerName: player.name,
      playerColor: player.color,
      playerId: socket.id
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
    
    // Store trade in memory first
    lobby._pendingTrades = lobby._pendingTrades || new Map();
    lobby._pendingTrades.set(tradeId, {
      id: tradeId,
      from: socket.id,
      to: to.id,
      fromName: from.name,
      toName: to.name,
      fromColor: from.color,
      toColor: to.color,
      myPropIds: data.myPropIds || [],
      theirPropIds: data.theirPropIds || [],
      offerMoney: Math.max(0, data.offerMoney || 0),
      requestMoney: Math.max(0, data.requestMoney || 0),
      timestamp: Date.now()
    });
    
    // Send to receiver
    io.to(to.id).emit('tradeOffer', {
      tradeId,
      from: socket.id,
      fromName: from.name,
      fromColor: from.color,
      myPropIds: data.myPropIds || [],
      theirPropIds: data.theirPropIds || [],
      offerMoney: Math.max(0, data.offerMoney || 0),
      requestMoney: Math.max(0, data.requestMoney || 0)
    });
    
    // Also send pending trades list to receiver
    const pendingList = Array.from(lobby._pendingTrades.values())
      .filter(t => t.to === to.id)
      .map(t => ({
        id: t.id,
        fromName: t.fromName,
        fromColor: t.fromColor,
        myPropIds: t.myPropIds,
        theirPropIds: t.theirPropIds,
        offerMoney: t.offerMoney,
        requestMoney: t.requestMoney,
        timestamp: t.timestamp
      }));
    io.to(to.id).emit('pendingTradesUpdate', { trades: pendingList });
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

    // Add to event log
    const tradeDetails = [];
    if (tr.myPropIds.length > 0) tradeDetails.push(`${tr.myPropIds.length} mülk`);
    if (tr.offerMoney > 0) tradeDetails.push(`${lobby.currency}${tr.offerMoney}`);
    const tradeFrom = tradeDetails.join(' + ');
    
    const tradeDetails2 = [];
    if (tr.theirPropIds.length > 0) tradeDetails2.push(`${tr.theirPropIds.length} mülk`);
    if (tr.requestMoney > 0) tradeDetails2.push(`${lobby.currency}${tr.requestMoney}`);
    const tradeTo = tradeDetails2.join(' + ');
    
    const tradeMsg = `💱 ${from.name} ⇄ ${to.name}: ${tradeFrom} ↔ ${tradeTo}`;
    lobby.events.push({ 
      type: 'trade', 
      from: from.name, 
      to: to.name,
      fromColor: from.color,
      toColor: to.color,
      message: tradeMsg
    });

    io.to(lobbyId).emit('tradeCompleted', {
      updatedPlayers: [
        { id: from.id, money: from.money, properties: from.properties },
        { id: to.id, money: to.money, properties: to.properties }
      ],
      updatedProperties,
      message: `${from.name} ⇄ ${to.name}`,
      tradeMessage: tradeMsg,
      fromColor: from.color,
      toColor: to.color
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
    player.hasRolled = false; // Allow player to roll after paying

    lobby.events.push({ type: 'jail-released', player: player.name, reason: 'ceza ödendi' });
    io.to(lobbyId).emit('jailReleased', { player, reason: 'Ceza ödendi' });
    io.to(lobbyId).emit('lobbyUpdated', lobby);
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

  socket.on('useJailCard', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby || !lobby.started) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player || !player.inJail) return;

    // Check if player has jail cards
    if (!player.freeJailCards || player.freeJailCards <= 0) {
      socket.emit('error', 'Pardon kartın yok!');
      return;
    }

    // Use the card
    player.freeJailCards -= 1;
    player.inJail = false;
    player.jailTurns = 0;

    lobby.events.push({ type: 'jail-released', player: player.name, reason: '🎫 Pardon Kartı kullandı' });
    
    io.to(lobbyId).emit('jailReleased', {
      player,
      reason: '🎫 Pardon Kartı kullandın ve hapishaneden çıktın!'
    });
    
    io.to(lobbyId).emit('lobbyUpdated', lobby);
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

    // Check if only one player remains (winner)
    const activePlayers = lobby.players.filter(p => !p.isBankrupt);
    if (activePlayers.length === 1 && lobby.players.length > 1) {
      const winner = activePlayers[0];
      
      // Calculate stats for all players
      const playerStats = lobby.players.map(p => ({
        name: p.name,
        color: p.color,
        money: p.money,
        properties: p.properties.length,
        isWinner: p.id === winner.id,
        isBankrupt: p.isBankrupt
      })).sort((a, b) => {
        if (a.isWinner) return -1;
        if (b.isWinner) return 1;
        return b.money - a.money;
      });

      // Notify all players about the winner
      io.to(lobbyId).emit('gameWon', {
        winner: {
          name: winner.name,
          color: winner.color,
          money: winner.money,
          properties: winner.properties.length
        },
        playerStats
      });

      console.log(`🏆 ${winner.name} won the game in lobby ${lobbyId}`);
    }

    console.log(`💸 ${player.name} declared bankruptcy in lobby ${lobbyId}`);
  });

  // YouTube Music Events
  socket.on('playYoutubeMusic', (data) => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player) return;

    // Only host may start music
    if (lobby.host !== socket.id) {
      socket.emit('errorMessage', 'Sadece ev sahibi müzik başlatabilir.');
      return;
    }

    // Broadcast to all players in lobby
    io.to(lobbyId).emit('youtubeMusicPlay', {
      videoId: data.videoId,
      playerName: player.name,
      playerId: socket.id
    });

    console.log(`🎵 ${player.name} (host) started YouTube music in lobby ${lobbyId}`);
  });

  socket.on('stopYoutubeMusic', () => {
    const lobbyId = playerSockets.get(socket.id);
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const player = lobby.players.find(p => p.id === socket.id);
    if (!player) return;

    // Only host may stop music
    if (lobby.host !== socket.id) {
      socket.emit('errorMessage', 'Sadece ev sahibi müziği durdurabilir.');
      return;
    }

    // Broadcast to all players in lobby
    io.to(lobbyId).emit('youtubeMusicStop', {
      playerName: player.name,
      playerId: socket.id
    });

    console.log(`🎵 ${player.name} (host) stopped YouTube music in lobby ${lobbyId}`);
  });

  socket.on('disconnect', () => {
    const lobbyId = playerSockets.get(socket.id);
    if (lobbyId) {
      const lobby = lobbies.get(lobbyId);
      if (lobby) {
        const idx = lobby.players.findIndex(p => p.id === socket.id);
        const wasCurrent = idx === lobby.currentTurn;

        if (idx !== -1) {
          // Remove the player from the list
          lobby.players.splice(idx, 1);

          // If no players left, remove the lobby
          if (lobby.players.length === 0) {
            lobbies.delete(lobbyId);
          } else {
            // Adjust currentTurn index to remain valid
            if (wasCurrent) {
              // If the disconnected player was current, keep the same index number
              // which now points to the next player in the array (or wrap to 0)
              lobby.currentTurn = lobby.currentTurn % lobby.players.length;
            } else if (idx < lobby.currentTurn) {
              // Shift current index left because earlier player was removed
              lobby.currentTurn = Math.max(0, lobby.currentTurn - 1);
            }

            // Skip bankrupt players and ensure currentTurn points to an active player
            let attempts = 0;
            while (lobby.players[lobby.currentTurn] && lobby.players[lobby.currentTurn].isBankrupt && attempts < lobby.players.length) {
              lobby.currentTurn = (lobby.currentTurn + 1) % lobby.players.length;
              attempts++;
            }

            io.to(lobbyId).emit('lobbyUpdated', lobby);

            // If the disconnected player was the current turn, notify clients that turn moved
            if (wasCurrent && lobby.started) {
              io.to(lobbyId).emit('turnEnded', { currentTurn: lobby.currentTurn });
              lobby.events.push({ type: 'player-disconnected', playerId: socket.id, message: 'Oyuncu ayrıldı, sıra diğer oyuncuya geçti.' });
              console.log(`➡️ Disconnected current player removed; new turn: ${lobby.players[lobby.currentTurn].name}`);
            }
          }
        }
      }
    }
    playerSockets.delete(socket.id);
    console.log('❌ Player disconnected:', socket.id);
  });

  // Allow an explicit leave action from client (e.g., user clicked "leave")
  socket.on('leaveLobby', () => {
    const lobbyId = playerSockets.get(socket.id);
    if (!lobbyId) return;
    const lobby = lobbies.get(lobbyId);
    if (!lobby) return;

    const idx = lobby.players.findIndex(p => p.id === socket.id);
    const wasCurrent = idx === lobby.currentTurn;
    if (idx !== -1) {
      lobby.players.splice(idx, 1);
    }

    if (lobby.players.length === 0) {
      lobbies.delete(lobbyId);
    } else {
      if (wasCurrent) {
        lobby.currentTurn = lobby.currentTurn % lobby.players.length;
      } else if (idx < lobby.currentTurn) {
        lobby.currentTurn = Math.max(0, lobby.currentTurn - 1);
      }

      // Skip bankrupt players
      let attempts = 0;
      while (lobby.players[lobby.currentTurn] && lobby.players[lobby.currentTurn].isBankrupt && attempts < lobby.players.length) {
        lobby.currentTurn = (lobby.currentTurn + 1) % lobby.players.length;
        attempts++;
      }

      io.to(lobbyId).emit('lobbyUpdated', lobby);
      if (wasCurrent && lobby.started) {
        io.to(lobbyId).emit('turnEnded', { currentTurn: lobby.currentTurn });
        lobby.events.push({ type: 'player-left', playerId: socket.id, message: 'Oyuncu oyundan ayrıldı, sıra diğer oyuncuya geçti.' });
      }
    }

    playerSockets.delete(socket.id);
    socket.leave(lobbyId);
    console.log('🏃 Player left lobby:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
