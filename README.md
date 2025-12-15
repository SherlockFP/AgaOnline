# 🏠 Monopoly Online Game

A full-featured, real-time multiplayer Monopoly game built with Node.js, Express, Socket.IO, and modern web technologies. Play with friends online!

## ✨ Features

- **🎮 Full Monopoly Gameplay**
  - Complete 40-property board with accurate rent calculations
  - Buy, own, and trade properties
  - Real-time player movements
  - Turn-based dice rolling with animations

- **👥 Multiplayer**
  - Create and join lobbies
  - Support for 2-6 players
  - Real-time synchronization
  - Player-specific avatars and colors

- **💬 Communication**
  - In-game chat system
  - Event log showing all game actions
  - Player turn notifications

- **🎨 Professional UI**
  - Dark theme with neon accents
  - Responsive board layout
  - Beautiful animations and transitions
  - Property detail popups
  - Trade panel (expandable feature)

- **⚙️ Game Settings**
  - Customizable game rules
  - Adjustable initial money
  - Tax-free mode option
  - Host can manage game setup

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm

### Installation

1. Clone or download the repository
```bash
cd Chulsuz
```

2. Install dependencies
```bash
npm install
```

3. Start the server
```bash
npm start
```

4. Open your browser and navigate to
```
http://localhost:3000
```

## 🎮 How to Play

1. **Enter Your Name** - Type your name in the input field
2. **Choose Avatar** - Select an emoji avatar (👤, 🎩, 🚗, 🐕, 🎸, 👑)
3. **Choose Color** - Select your player color
4. **Create or Join**
   - **Create Game**: Start a new lobby (you become the host)
   - **Join Game**: Enter a lobby ID to join existing game
5. **Wait for Players** - Host must start the game with minimum 2 players
6. **Customize Rules** (Host only) - Adjust game settings before starting
7. **Play!**
   - Roll dice using the **Roll Dice** button
   - Buy properties when you land on them
   - End your turn with the **End Turn** button
   - Chat with other players
   - Monitor the event log for game actions

## 📊 Game Rules

### Starting Position
- All players start at GO with $1,500
- Players move clockwise around the board
- Passing GO awards $200 (or customized amount)

### Purchasing Properties
- When you land on an unowned property, you can buy it
- Cost equals the property price
- Properties show ownership with colored borders

### Rent
- When you land on an opponent's property, you pay rent
- Rent increases based on owned properties and houses/hotels
- Base rent for unimproved property is shown in property popup

### Trading (Coming Soon)
- Trade properties and money with other players
- Use the Trade panel to manage trades

## 🛠️ Technical Stack

- **Backend**: Node.js + Express
- **Real-time Communication**: Socket.IO
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Database**: In-memory (can be extended to use MongoDB/PostgreSQL)
- **Port**: 3000 (default)

## 📁 Project Structure

```
├── server.js              # Main server file
├── package.json           # Dependencies
├── public/
│   ├── index.html        # Main HTML
│   ├── style.css         # Complete styling
│   └── game.js           # Client-side game logic
└── README.md             # This file
```

## 🎯 Key Features Explained

### Board Layout
- 11x11 grid with 40 properties
- Corner spaces: GO, Jail, Free Parking, Go to Jail
- Color-coded property groups (Brown, Light Blue, Pink, Orange, Red, Yellow, Green, Dark Blue)

### Player Management
- Each player has a position, money, properties, and status
- Current turn indicator highlights active player
- Player tokens display on board spaces

### Event System
- Dice rolls logged in event log
- Property purchases tracked
- Turn changes announced
- Real-time synchronization across all clients

### Socket Events
- `createLobby` - Create a new game
- `joinLobby` - Join existing game
- `startGame` - Begin the game (host only)
- `rollDice` - Roll dice and move
- `buyProperty` - Purchase a property
- `endTurn` - End current turn
- `sendMessage` - Chat message

## 🎨 Customization

### Change Colors
Edit property color values in `server.js` boardData section

### Modify Rules
Adjust game rules in the game setup panel or modify defaults in `server.js`

### Add New Features
- Trade system fully integrated, ready to implement
- Auction system can be added
- House/Hotel building coming soon
- Chance and Community Chest cards can be implemented

## 🐛 Known Issues & TODOs

- [ ] House and hotel building system
- [ ] Chance and Community Chest implementation
- [ ] Advanced trade system with UI
- [ ] Persistent database integration
- [ ] Mobile-optimized UI
- [ ] Sound effects and music
- [ ] Game statistics and leaderboards

## 📝 License

MIT License - Feel free to use and modify

## 🤝 Contributing

Feel free to fork, modify, and improve this game!

## 📧 Support

For issues or questions, check the code comments or create an issue.

---

**Enjoy playing Monopoly Online!** 🎉
