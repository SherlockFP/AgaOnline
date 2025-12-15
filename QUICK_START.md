# 🎮 Quick Start Guide - Monopoly Online

## 🚀 Start Playing in 3 Steps

### Step 1: Start the Server
```bash
cd c:\Users\Admin\Desktop\Chulsuz
npm start
```
The server will start on `http://localhost:3000`

### Step 2: Open Game in Browser
Open two or more browser windows/tabs:
```
http://localhost:3000
```

### Step 3: Create & Play
1. **Player 1**:
   - Enter name
   - Choose avatar & color
   - Click "Create Game"

2. **Player 2**:
   - Enter name
   - Choose avatar & color
   - Click "Join Game"
   - Paste the lobby ID from Player 1's screen

3. **Start Game** (Player 1):
   - Click "Start Game" button (appears when ≥2 players)
   - Game begins!

## 🎮 During Gameplay

**Roll Dice**: Click the 🎲 button
- Dice animate and show result
- You move automatically
- If you land on unowned property, popup shows buy option

**Buy Property**: Click the buy button in property popup
- Costs money from your balance
- Adds property to your collection
- Shows in property list

**End Turn**: Click "End Turn" button
- Passes turn to next player
- Other players can now roll dice

**Chat**: Type in chat box
- Send messages to all players
- See game events in log

## 🎯 Game Features

✅ **Full 40-Property Board** - All standard Monopoly properties
✅ **Real-time Multiplayer** - Play with friends online
✅ **Property Ownership** - Buy, own, collect rent
✅ **Player Avatars** - Choose from 6 different emojis
✅ **Custom Colors** - 6 color options per player
✅ **Chat System** - Communicate in real-time
✅ **Event Log** - Track all game actions
✅ **Responsive Design** - Works on desktop/tablet
✅ **Dark Theme UI** - Beautiful neon-accented interface
✅ **Turn Management** - Organized, fair gameplay

## 💡 Tips

- 👑 **Host**: You can set game rules before starting
- 💰 **Strategy**: Buy properties in groups for better income
- 📊 **Monitor**: Check event log for important information
- 💬 **Communicate**: Use chat to coordinate trades (coming soon)

## 🔧 System Requirements

- Node.js v14+
- Modern web browser (Chrome, Firefox, Safari, Edge)
- 2-6 players on same network

## ⚙️ Customization

### Change Starting Money
Edit `server.js`:
```javascript
initialMoney: 1500  // Change this value
```

### Add More Avatars
Edit `index.html` avatar buttons:
```html
<button onclick="selectAppearance('🎲')">🎲</button>
```

### Modify Colors
Edit `index.html` color buttons:
```html
<button style="background: #yourcolor;"></button>
```

## 🎓 Game Rules

- All players start with $1,500
- Pass GO = $200
- Rent varies by property group and improvements
- Last player with money wins!

## 📞 Troubleshooting

**Port already in use?**
```bash
# Change port in server.js line 60
const PORT = 3001;  // Use different port
```

**Can't connect?**
- Check firewall settings
- Ensure all players use same IP/localhost
- Restart server with `node server.js`

**Game freezes?**
- Refresh browser (F5)
- Server still running? Check terminal output

## 🎉 Enjoy Your Game!

Everything is ready to play. Have fun with Monopoly Online!

For more details, see **README.md**
