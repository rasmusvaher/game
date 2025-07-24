# Tank Deathmatch - Multiplayer Browser Game

A real-time multiplayer tank battle game built with Node.js, Socket.IO, and HTML5 Canvas.

## Features

### Gameplay
- **Real-time multiplayer combat** with up to 20+ players
- **Smooth 60 FPS gameplay** with client-side prediction and interpolation
- **Four corner spawn points** with 1.5-second invincibility
- **Solid obstacles and border** that block movement and bullets
- **Happy face tanks** with rotating cannons
- **Realistic bullet physics** with trails and impact effects
- **Score tracking** with kills/deaths leaderboard

### Web3 Integration
- **Privy.io authentication** with email, Google, and Twitter login
- **Embedded Solana wallets** - no extension required
- **Real-time SOL balance display** in game UI
- **Transaction signing** for game rewards
- **Wallet-based user profiles** and persistence

### Visual Design
- **Clean, modern UI** with light gray theme (#EAEAEA background)
- **Grid pattern** for better spatial awareness
- **Black crosshair** for precise aiming
- **Particle effects** for bullet impacts and explosions
- **Screen shake and flash effects** for feedback

### Controls
- **WASD or Arrow Keys** for movement
- **Mouse** for aiming
- **Left Click** to shoot
- **Hold P** to quit to menu

## Technical Implementation

### Anti-Cheat Measures (Server-Side)
- **Movement validation**: Prevents teleporting and speed hacks
- **Input rate limiting**: Ignores packets sent too frequently
- **Shooting cooldown**: Enforces fire rate limits
- **Position clamping**: Keeps players within arena bounds
- **Dead player protection**: Ignores input from dead/respawning players
- **Client timestamp validation**: Detects time manipulation

### Lag Reduction (Client-Side)
- **Client-side prediction**: Local player moves instantly on input
- **Entity interpolation**: Smooth animation of other players and bullets
- **Adaptive interpolation delay**: Adjusts based on ping (50-200ms)
- **Position reconciliation**: Snaps to server if prediction differs too much
- **Update buffering**: Stores recent server updates for smooth interpolation

### Network Optimization
- **60 FPS server updates** for responsive gameplay
- **Efficient state synchronization** with delta updates
- **Ping measurement** for adaptive interpolation
- **Connection error handling** with automatic retry

## Deployment

### Local Development
```bash
# Server
cd server
npm install
npm start

# Client
cd client
npm install
npm start
```

### Web3 Setup
See [PRIVY_SETUP.md](PRIVY_SETUP.md) for detailed instructions on setting up Privy.io authentication and wallet features.

### Production (Render.com)
- **Server**: Deploy `server/` directory as a Node.js service
- **Client**: Deploy `client/` directory as a static site
- **Environment**: Set `NODE_ENV=production`

## Performance

### Lag Reduction Results
- **300ms ping → feels like 50ms** with client-side prediction
- **Smooth 60 FPS** even with high latency
- **No jitter** on other players' movement
- **Instant response** for local player actions

### Anti-Cheat Effectiveness
- **Prevents speed hacks** and teleporting
- **Blocks rapid-fire exploits**
- **Maintains game integrity** even with malicious clients
- **Server remains authoritative** for all game decisions

## Architecture

### Server (`server/`)
- `gameLogic.js`: Core game mechanics and anti-cheat
- `index.js`: Socket.IO server and connection handling

### Client (`client/`)
- `game.js`: Main game client with prediction/interpolation
- `menu.js`: Lobby and player setup with Privy integration
- `privyWallet.js`: Privy.io wallet management and authentication
- `config.js`: Configuration for Privy and Solana settings
- `utils/`: Helper utilities

## Future Enhancements
- [ ] Power-ups and special abilities
- [ ] Different tank types and weapons
- [ ] Team-based modes
- [ ] Custom maps and obstacles
- [ ] Sound effects and music
- [ ] Mobile touch controls

## License
MIT License - Feel free to use and modify! 