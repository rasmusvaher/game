const express = require('express');
const http = require('http');
const socketio = require('socket.io');
const cors = require('cors');
const path = require('path');
const TankGame = require('./gameLogic');
const privy = require('./privyClient');
const solanaWeb3 = require('@solana/web3.js');
const { Keypair } = require('@solana/web3.js');
const fetch = require('node-fetch');

const app = express();
const server = http.createServer(app);
const io = socketio(server, { 
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  } 
});

// Enable CORS
app.use(cors());
// Add body parsing middleware
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client/src')));

// Serve menu.html at root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/src/menu.html'));
});

// Create game instance
const game = new TankGame(io);

// In-memory lock for wallet updates (userId -> boolean)
const walletLocks = {};

// In-memory session pot tracking: { userId: { potSol: number, userWallet: string } }
const sessionPots = {};
const HOT_WALLET = '8kEa7BBFsTZKtGZaapuQVVbzLY5es1jJKQxrKhonn9V4';
const SOLANA_RPC_URL = "https://solana-mainnet.rpc.extrnode.com/4282db3b-a0fd-4b18-9deb-3ecd8da312ae";

// Helper to acquire/release lock
async function withWalletLock(userId, fn) {
  while (walletLocks[userId]) {
    // Wait for lock to be released
    await new Promise(res => setTimeout(res, 25));
  }
  walletLocks[userId] = true;
  try {
    return await fn();
  } finally {
    walletLocks[userId] = false;
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 New connection: ${socket.id}`);

  // Send initial game state
  socket.emit('gameState', {
    players: game.players,
    bullets: game.bullets.map(bullet => ({
      x: bullet.x,
      y: bullet.y,
      owner: bullet.owner
    }))
  });
  
  // Send scoreboard
  game.broadcastScoreboard();
  
  // Handle player join with data
  socket.on('playerJoin', async (playerData) => {
    console.log(`🎮 Player joining with data:`, playerData);
    const userId = playerData.privyUserId;
    if (!userId) {
      socket.emit('joinFailed', { message: 'Missing user ID.' });
      return;
    }
    // Enforce single-session: disconnect any existing player with same privyUserId
    for (const [sid, p] of Object.entries(game.players)) {
      if (p.privyUserId === userId) {
        console.log(`[SECURITY] Duplicate login for user ${userId}. Disconnecting old socket ${sid}`);
        if (io.sockets.sockets.get(sid)) {
          io.sockets.sockets.get(sid).emit('forceDisconnect', { message: 'You have been logged out due to login from another device or tab.' });
          io.sockets.sockets.get(sid).disconnect(true);
        }
        game.removePlayer(sid);
      }
    }
    // Only add player if not already present
    if (!game.players[socket.id]) {
      // Always fetch wallet from Privy, never trust client
      let walletBalance = 100;
      try {
        const user = await privy.getUserById(userId);
        walletBalance = user?.customMetadata?.walletBalance ?? 100;
      } catch (err) {
        console.error(`[PRIVY] Failed to fetch wallet for user ${userId}:`, err);
      }
      game.addPlayer(socket.id, { ...playerData, walletBalance, privyUserId: userId });
      game.players[socket.id].privyUserId = userId;
    }
    if (game.players[socket.id]) {
      game.players[socket.id].username = playerData.username || game.players[socket.id].username;
      game.players[socket.id].tankColor = playerData.tankColor || game.players[socket.id].tankColor;
      game.players[socket.id].bulletColor = playerData.bulletColor || game.players[socket.id].bulletColor;
      // Use wallet lock for all wallet updates
      const fetchWalletCb = async () => {
        return await withWalletLock(userId, async () => {
          try {
            const user = await privy.getUserById(userId);
            return user?.customMetadata?.walletBalance ?? 100;
          } catch (err) {
            console.error(`[PRIVY] Failed to fetch wallet for user ${userId}:`, err);
            return 100;
          }
        });
      };
      const updateWalletCb = async (newBalance) => {
        await withWalletLock(userId, async () => {
          console.log(`[PRIVY] Updating wallet for user ${userId} to $${newBalance}`);
          try {
            await privy.setCustomMetadata(userId, { walletBalance: newBalance });
            console.log(`[PRIVY] Wallet updated for user ${userId} to $${newBalance}`);
          } catch (err) {
            console.error(`[PRIVY] Failed to update wallet for user ${userId}:`, err);
          }
        });
      };
      const joinResult = await game.attemptJoinGame(socket.id, fetchWalletCb, updateWalletCb);
      if (game.players[socket.id]) {
        console.log(`[GAME] After join: Player ${socket.id} walletBalance = $${game.players[socket.id].walletBalance}, pot = $${game.players[socket.id].pot}`);
      } else {
        console.log(`[GAME] After join: Player ${socket.id} has disconnected before logging.`);
      }
      if (!joinResult.success) {
        socket.emit('joinFailed', { message: joinResult.message });
        return;
      }
      socket.emit('joinSuccess', {
        walletBalance: game.players[socket.id].walletBalance,
        pot: game.players[socket.id].pot
      });
    }
  });
  
  // Handle player input
  socket.on('playerInput', (input) => {
    game.handleInput(socket.id, input);
  });
  
  // Handle ping for latency measurement
  socket.on('ping', () => {
    socket.emit('pong');
  });

  // Handle player cash out request
  socket.on('playerCashOut', async () => {
    const userId = game.players[socket.id]?.privyUserId;
    if (!userId) {
      socket.emit('cashOutResult', { success: false, message: 'User not logged in.' });
      return;
    }
    const fetchWalletCb = async () => {
      return await withWalletLock(userId, async () => {
        try {
          const user = await privy.getUserById(userId);
          return user?.customMetadata?.walletBalance ?? 100;
        } catch (err) {
          console.error(`[PRIVY] Failed to fetch wallet for user ${userId}:`, err);
          return 100;
        }
      });
    };
    const updateWalletCb = async (newBalance) => {
      await withWalletLock(userId, async () => {
        console.log(`[PRIVY] Updating wallet for user ${userId} to $${newBalance}`);
        try {
          await privy.setCustomMetadata(userId, { walletBalance: newBalance });
          console.log(`[PRIVY] Wallet updated for user ${userId} to $${newBalance}`);
        } catch (err) {
          console.error(`[PRIVY] Failed to update wallet for user ${userId}:`, err);
        }
      });
    };
    const result = await game.cashOutPot(socket.id, fetchWalletCb, updateWalletCb);
    console.log(`[GAME] After cashout: Player ${socket.id} walletBalance = $${game.players[socket.id]?.walletBalance}, pot = $${game.players[socket.id]?.pot}`);
    socket.emit('cashOutResult', {
      success: result.success,
      message: result.message,
      walletBalance: game.players[socket.id]?.walletBalance ?? 0,
      pot: game.players[socket.id]?.pot ?? 0
    });
  });

  // Handle player quit to menu
  socket.on('playerQuit', () => {
    game.removePlayer(socket.id);
    game.broadcastScoreboard();
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log(`🔌 Disconnected: ${socket.id}`);
    game.removePlayer(socket.id);
    game.broadcastScoreboard();
  });
});

// Game loop - update at 60 FPS
const gameLoop = setInterval(() => {
  game.update();
}, 1000 / game.tickRate);

// Health check endpoint
app.get('/health', (req, res) => {
  const stats = game.getGameStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    gameStats: stats
  });
});

// Signup endpoint: creates Privy user with Solana wallet
app.post('/api/signup', async (req, res) => {
  const { email, username } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  try {
    const user = await privy.importUser({
      linkedAccounts: [
        { type: 'email', address: email }
      ],
      customMetadata: username ? { username } : undefined,
      wallets: [
        { chainType: 'solana' }
      ]
    });
    res.json({
      id: user.id,
      email: email,
      solanaWallet: user.wallets?.find(w => w.chainType === 'solana')?.address || null
    });
  } catch (err) {
    console.error('Privy signup error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Create Solana wallet for existing user
app.post('/api/create-solana-wallet', async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  try {
    const user = await privy.createWallets({
      userId,
      wallets: [
        { chainType: 'solana' }
      ]
    });
    res.json({
      id: user.id,
      solanaWallet: user.wallets?.find(w => w.chainType === 'solana')?.address || null
    });
  } catch (err) {
    console.error('Privy createWallets error:', err);
    res.status(500).json({ error: 'Failed to create Solana wallet' });
  }
});

// Fake wallet balance endpoint for menu
app.get('/api/fake-wallet-balance', (req, res) => {
  // For now, always return $100 (can be personalized later)
  res.json({ balance: 100 });
});

// API endpoint to get wallet balance from Privy and Solana
app.post('/api/get-wallet-balance', async (req, res) => {
  const { userId, email } = req.body;
  console.log('[API] /api/get-wallet-balance called with:', req.body);
  if (!userId && !email) {
    console.log('[API] Missing userId or email');
    return res.status(400).json({ error: 'userId or email required' });
  }
  try {
    let user;
    if (userId) {
      user = await privy.getUser(userId);
    } else {
      const users = await privy.getUsers({ linkedAccounts: [{ type: 'email', address: email }] });
      user = users[0];
    }
    console.log('[API] Full user object:', JSON.stringify(user, null, 2));
    // Get the wallet address from Privy user object (search both wallets and linkedAccounts)
    let walletAddress =
      (user?.wallets && user.wallets.find(w => w.chainType === 'solana')?.address) ||
      (user?.linkedAccounts && user.linkedAccounts.find(w => (w.chainType === 'solana' || (w.type === 'wallet' && w.address && w.address.length === 44)))?.address);
    if (!walletAddress) {
      console.log('[API] No Solana wallet found for user, creating one...');
      // Create a Solana wallet for the user
      const newUser = await privy.createWallets({
        userId: user.id,
        wallets: [ { chainType: 'solana' } ]
      });
      walletAddress = (newUser?.wallets && newUser.wallets.find(w => w.chainType === 'solana')?.address) ||
        (newUser?.linkedAccounts && newUser.linkedAccounts.find(w => (w.chainType === 'solana' || (w.type === 'wallet' && w.address && w.address.length === 44)))?.address);
      if (!walletAddress) {
        console.log('[API] Failed to create Solana wallet for user');
        return res.status(500).json({ error: 'Failed to create Solana wallet for user' });
      }
      console.log('[API] Created new Solana wallet:', walletAddress);
    }
    // Fetch the real on-chain balance using Solana web3.js
    const connection = new solanaWeb3.Connection(SOLANA_RPC_URL, 'confirmed');
    const pubkey = new solanaWeb3.PublicKey(walletAddress);
    const lamports = await connection.getBalance(pubkey);
    const walletBalance = lamports / 1e9;
    console.log('[API] On-chain balance for', walletAddress, ':', walletBalance, 'SOL');
    res.json({ walletBalance });
  } catch (err) {
    console.error('[API] Failed to fetch wallet balance:', err);
    res.status(500).json({ error: 'Failed to fetch wallet balance', details: err.message });
  }
});

// API endpoint to set wallet balance in Privy
app.post('/api/set-wallet-balance', async (req, res) => {
  const { userId, walletBalance } = req.body;
  if (!userId || typeof walletBalance !== 'number') return res.status(400).json({ error: 'userId and walletBalance required' });
  try {
    await privy.updateUser({ id: userId, customMetadata: { walletBalance } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update wallet balance' });
  }
});

// Endpoint to start a game session and calculate entry fee in SOL
app.post('/api/join-game', async (req, res) => {
  const { userId, solUsdPrice } = req.body;
  if (!userId || !solUsdPrice) return res.status(400).json({ error: 'userId and solUsdPrice required' });
  try {
    // Find user's Solana wallet address
    const user = await privy.getUser(userId);
    let userWallet =
      (user?.wallets && user.wallets.find(w => w.chainType === 'solana')?.address) ||
      (user?.linkedAccounts && user.linkedAccounts.find(w => (w.chainType === 'solana' || (w.type === 'wallet' && w.address && w.address.length === 44)))?.address);
    if (!userWallet) return res.status(404).json({ error: 'No Solana wallet found for user' });
    // Calculate $1 in SOL
    const potSol = 1 / solUsdPrice;
    // Store session pot
    sessionPots[userId] = { potSol, userWallet };
    res.json({ potSol, hotWallet: HOT_WALLET });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start game session', details: err.message });
  }
});

// Endpoint to cash out the user's pot (send from hot wallet to user)
app.post('/api/cashout', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId required' });
  const session = sessionPots[userId];
  if (!session) return res.status(400).json({ error: 'No session pot found for user' });
  try {
    // Real payout: send session.potSol SOL from HOT_WALLET to session.userWallet
    const secretKeyJson = process.env.HOT_WALLET_PRIVATE_KEY;
    if (!secretKeyJson) {
      return res.status(500).json({ error: 'Hot wallet private key not set in environment' });
    }
    const secretKey = Uint8Array.from(JSON.parse(secretKeyJson));
    const hotWalletKeypair = Keypair.fromSecretKey(secretKey);
    const connection = new solanaWeb3.Connection(SOLANA_RPC_URL, 'confirmed');
    const toPubkey = new solanaWeb3.PublicKey(session.userWallet);
    const lamports = Math.floor(session.potSol * 1e9);
    const tx = new solanaWeb3.Transaction().add(
      solanaWeb3.SystemProgram.transfer({
        fromPubkey: hotWalletKeypair.publicKey,
        toPubkey,
        lamports,
      })
    );
    tx.feePayer = hotWalletKeypair.publicKey;
    const { blockhash } = await connection.getRecentBlockhash();
    tx.recentBlockhash = blockhash;
    const signed = await hotWalletKeypair.signTransaction(tx);
    const txid = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(txid, 'confirmed');
    console.log(`[PAYOUT] Sent ${session.potSol} SOL from ${HOT_WALLET} to ${session.userWallet}, txid: ${txid}`);
    delete sessionPots[userId];
    res.json({ success: true, sentSol: session.potSol, to: session.userWallet, txid });
  } catch (err) {
    console.error('[PAYOUT] Failed to send payout:', err);
    res.status(500).json({ error: 'Failed to cash out', details: err.message });
  }
});

// Endpoint to fetch SOL/USD price from CoinGecko with in-memory cache
let cachedSolPrice = null;
let cachedSolPriceTime = 0;
const SOL_PRICE_CACHE_MS = 5 * 60 * 1000; // 5 minutes
app.get('/api/sol-price', async (req, res) => {
  const now = Date.now();
  if (cachedSolPrice && (now - cachedSolPriceTime < SOL_PRICE_CACHE_MS)) {
    return res.json({ price: cachedSolPrice });
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
    const data = await response.json();
    if (!data || !data.solana || typeof data.solana.usd !== 'number') {
      throw new Error('Malformed CoinGecko response');
    }
    cachedSolPrice = data.solana.usd;
    cachedSolPriceTime = now;
    res.json({ price: cachedSolPrice });
  } catch (err) {
    if (cachedSolPrice) {
      // Serve stale price if available
      return res.json({ price: cachedSolPrice, stale: true, error: 'Using cached price due to fetch error.' });
    }
    res.status(500).json({ error: 'Failed to fetch SOL price', details: err.message });
  }
});

// Endpoint to verify join transaction
app.post('/api/verify-join', async (req, res) => {
  const { userWallet, txid, potSol } = req.body;
  if (!userWallet || !txid || !potSol) {
    return res.status(400).json({ error: 'userWallet, txid, and potSol are required' });
  }
  try {
    const connection = new solanaWeb3.Connection(SOLANA_RPC_URL, 'confirmed');
    const tx = await connection.getTransaction(txid, { commitment: 'confirmed' });
    if (!tx) {
      return res.status(404).json({ error: 'Transaction not found or not confirmed yet' });
    }
    // Check transaction details
    let found = false;
    let correctAmount = false;
    let correctSource = false;
    let correctDest = false;
    const expectedLamports = Math.floor(Number(potSol) * 1e9);
    for (const instr of tx.transaction.message.instructions) {
      // Only check SystemProgram transfer instructions
      if (instr.programId.toBase58() === solanaWeb3.SystemProgram.programId.toBase58()) {
        const parsed = solanaWeb3.SystemProgram.decodeTransfer(instr);
        if (parsed) {
          if (parsed.toPubkey.toBase58() === HOT_WALLET && parsed.fromPubkey.toBase58() === userWallet) {
            found = true;
            correctSource = true;
            correctDest = true;
            if (parsed.lamports === expectedLamports) {
              correctAmount = true;
            }
          }
        }
      }
    }
    if (found && correctAmount && correctSource && correctDest) {
      return res.json({ success: true, message: 'Transaction verified' });
    } else {
      return res.status(400).json({
        success: false,
        found,
        correctAmount,
        correctSource,
        correctDest,
        error: 'Transaction does not match expected parameters'
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to verify transaction', details: err.message });
  }
});

// Endpoint to fetch recent blockhash from Solana
app.get('/api/recent-blockhash', async (req, res) => {
  try {
    const connection = new solanaWeb3.Connection(SOLANA_RPC_URL, 'confirmed');
    const { blockhash } = await connection.getRecentBlockhash();
    res.json({ blockhash });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recent blockhash', details: err.message });
  }
});

// Endpoint to relay a signed transaction to Solana using the authenticated RPC
app.post('/api/relay-transaction', async (req, res) => {
  const { serializedTx } = req.body;
  if (!serializedTx) {
    return res.status(400).json({ error: 'serializedTx is required' });
  }
  try {
    const connection = new solanaWeb3.Connection(SOLANA_RPC_URL, 'confirmed');
    const txBuffer = Buffer.from(serializedTx, 'base64');
    const txid = await connection.sendRawTransaction(txBuffer);
    res.json({ txid });
  } catch (err) {
    console.error('[RELAY TRANSACTION ERROR]', err);
    res.status(500).json({ error: 'Failed to relay transaction', details: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  console.log(`🚀 Tank Deathmatch Server running on port ${PORT}`);
  console.log(`🎮 Game settings:`);
  console.log(`   - Arena: ${game.arenaWidth}x${game.arenaHeight}`);
  console.log(`   - Tick rate: ${game.tickRate} FPS`);
  console.log(`   - Bullet speed: ${game.bulletSpeed} px/s`);
  console.log(`   - Respawn time: ${game.respawnTime}s`);
  console.log(`   - Health: ${game.maxHealth} HP`);
  console.log(`   - Bullet damage: ${game.bulletDamage} HP`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  clearInterval(gameLoop);
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
