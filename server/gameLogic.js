// server/gameLogic.js - Tank Deathmatch Game Logic

class TankGame {
  constructor(io) {
    this.io = io;
    this.players = {}; // { socketId: { x, y, angle, health, kills, deaths, isAlive } }
    this.bullets = []; // [ { x, y, vx, vy, owner, lifetime } ]
    this.tickRate = 60; // 60 FPS for smooth gameplay
    this.bulletSpeed = 500; // pixels per second
    this.bulletLifetime = 2; // seconds
    this.shootCooldown = 0.3; // seconds
    // Responsive arena size
    this.arenaWidth = 7500; // New size
    this.arenaHeight = 7500; // New size
    this.tankSize = 30;
    this.bulletSize = 6;
    this.borderThickness = 150; // Proportional border
    
    // Game settings
    this.respawnTime = 3; // seconds

    // Reposition 8 spawn points in a ring, well away from center, borders, and obstacles
    this.spawnPoints = [];
    const spawnRadius = Math.min(this.arenaWidth, this.arenaHeight) / 2 - 1200;
    const centerX = this.arenaWidth / 2;
    const centerY = this.arenaHeight / 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * 2 * Math.PI + Math.PI/8;
      const x = centerX + spawnRadius * Math.cos(angle);
      const y = centerY + spawnRadius * Math.sin(angle);
      this.spawnPoints.push({ x, y });
    }

    // Improved map: even more cover in open areas, especially outer map
    this.obstacles = [
      // Arena border as obstacles
      { x: 0, y: 0, w: this.arenaWidth, h: this.borderThickness }, // Top
      { x: 0, y: this.arenaHeight - this.borderThickness, w: this.arenaWidth, h: this.borderThickness }, // Bottom
      { x: 0, y: 0, w: this.borderThickness, h: this.arenaHeight }, // Left
      { x: this.arenaWidth - this.borderThickness, y: 0, w: this.borderThickness, h: this.arenaHeight }, // Right
      // Central open area with partial walls (no closed rooms)
      { x: centerX - 200, y: centerY - 200, w: 400, h: 40 },
      { x: centerX - 200, y: centerY + 160, w: 400, h: 40 },
      { x: centerX - 200, y: centerY - 200, w: 40, h: 180 },
      { x: centerX + 160, y: centerY - 200, w: 40, h: 180 },
      { x: centerX - 200, y: centerY + 20, w: 40, h: 180 },
      { x: centerX + 160, y: centerY + 20, w: 40, h: 180 },
      // T-shapes and zig-zags (all open)
      { x: centerX - 600, y: centerY - 400, w: 300, h: 40 },
      { x: centerX - 600, y: centerY - 400, w: 40, h: 200 },
      { x: centerX + 300, y: centerY + 300, w: 300, h: 40 },
      { x: centerX + 560, y: centerY + 140, w: 40, h: 200 },
      // Long corridors (not closed)
      { x: centerX - 1000, y: centerY - 60, w: 800, h: 40 },
      { x: centerX + 200, y: centerY - 60, w: 800, h: 40 },
      { x: centerX - 60, y: centerY - 1000, w: 40, h: 800 },
      { x: centerX - 60, y: centerY + 200, w: 40, h: 800 },
      // Islands (cover in open areas)
      { x: centerX - 900, y: centerY - 900, w: 80, h: 80 },
      { x: centerX + 820, y: centerY - 900, w: 80, h: 80 },
      { x: centerX - 900, y: centerY + 820, w: 80, h: 80 },
      { x: centerX + 820, y: centerY + 820, w: 80, h: 80 },
      { x: centerX, y: centerY - 1200, w: 80, h: 80 },
      { x: centerX, y: centerY + 1120, w: 80, h: 80 },
      // More partial walls and cover (no dead-ends)
      { x: 600, y: 600, w: 200, h: 40 },
      { x: 600, y: 900, w: 40, h: 200 },
      { x: this.arenaWidth - 900, y: 600, w: 200, h: 40 },
      { x: this.arenaWidth - 900 + 160, y: 900, w: 40, h: 200 },
      { x: 600, y: this.arenaHeight - 900, w: 200, h: 40 },
      { x: 600, y: this.arenaHeight - 900 + 160, w: 40, h: 200 },
      { x: this.arenaWidth - 900, y: this.arenaHeight - 900, w: 200, h: 40 },
      { x: this.arenaWidth - 900 + 160, y: this.arenaHeight - 900 + 160, w: 40, h: 200 },
      // Extra islands and partial walls in outer/mid areas
      { x: 1200, y: 2000, w: 120, h: 40 },
      { x: 2000, y: 1200, w: 40, h: 120 },
      { x: this.arenaWidth - 1400, y: 2000, w: 120, h: 40 },
      { x: this.arenaWidth - 2200, y: 1200, w: 40, h: 120 },
      { x: 1200, y: this.arenaHeight - 2000, w: 120, h: 40 },
      { x: 2000, y: this.arenaHeight - 1200, w: 40, h: 120 },
      { x: this.arenaWidth - 1400, y: this.arenaHeight - 2000, w: 120, h: 40 },
      { x: this.arenaWidth - 2200, y: this.arenaHeight - 1200, w: 40, h: 120 },
      { x: centerX - 1800, y: centerY, w: 120, h: 40 },
      { x: centerX + 1680, y: centerY, w: 120, h: 40 },
      { x: centerX, y: centerY - 1800, w: 40, h: 120 },
      { x: centerX, y: centerY + 1680, w: 40, h: 120 },
      // More islands and partial walls in outermost areas
      { x: 400, y: 3000, w: 100, h: 40 },
      { x: 3000, y: 400, w: 40, h: 100 },
      { x: this.arenaWidth - 600, y: 3000, w: 100, h: 40 },
      { x: this.arenaWidth - 3200, y: 400, w: 40, h: 100 },
      { x: 400, y: this.arenaHeight - 3000, w: 100, h: 40 },
      { x: 3000, y: this.arenaHeight - 600, w: 40, h: 100 },
      { x: this.arenaWidth - 600, y: this.arenaHeight - 3000, w: 100, h: 40 },
      { x: this.arenaWidth - 3200, y: this.arenaHeight - 600, w: 40, h: 100 },
      // Cover near each spawn (not blocking, just offset)
      ...this.spawnPoints.map(sp => ({
        x: sp.x - 60 + 120 * Math.random(),
        y: sp.y - 60 + 120 * Math.random(),
        w: 120,
        h: 60
      }))
    ];
    // Add a simple lock map for wallet/pot updates
    this.locks = {};
  }

  // Add a new player to the game
  addPlayer(socketId, playerData = {}) {
    const spawnPoint = this.getRandomSpawnPoint();
    let walletBalance = 100;
    if (typeof playerData.walletBalance === 'number' && playerData.walletBalance >= 0) {
      walletBalance = playerData.walletBalance;
    }
    this.players[socketId] = {
      x: spawnPoint.x,
      y: spawnPoint.y,
      angle: 0, // facing right initially
      kills: 0,
      deaths: 0,
      isAlive: true,
      lastShot: 0,
      respawnTime: 0,
      username: playerData.username || `Player_${socketId.slice(0, 6)}`,
      invincible: true,
      invincibleTimer: 1.5,
      lastInputTime: Date.now(), // Initialize lastInputTime
      lastServerUpdate: Date.now(), // Track when we last sent an update
      // Pot system fields (FAKE WALLET for testing, not real on-chain balance)
      walletBalance: walletBalance, // Use provided or default
      pot: 0, // Pot starts at 0, will be set on join
      inGame: false, // Not in game until entry fee paid
      privyUserId: playerData.privyUserId || null
    };
    
  }

  // Remove a player from the game
  removePlayer(socketId) {
    delete this.players[socketId];
  }

  // Improved spawn logic: no enemy within 700 units, at least one within 2000 units
  getRandomSpawnPoint() {
    const minSafeDist = 700;
    const maxActionDist = 2000;
    const alivePlayers = Object.values(this.players).filter(p => p.isAlive);
    // For each spawn point, find the distance to the closest alive player
    const spawnScores = this.spawnPoints.map(sp => {
      let minDist = Infinity;
      let maxDist = 0;
      for (const p of alivePlayers) {
        const dist = Math.hypot(sp.x - p.x, sp.y - p.y);
        if (dist < minDist) minDist = dist;
        if (dist > maxDist) maxDist = dist;
      }
      return { sp, minDist, maxDist };
    });
    // Filter: no enemy within minSafeDist, at least one within maxActionDist
    const actionSpawns = spawnScores.filter(s => s.minDist > minSafeDist && s.maxDist < maxActionDist);
    if (actionSpawns.length > 0) {
      // Pick the one with the smallest minDist (closest to action, but not too close)
      const best = actionSpawns.reduce((a, b) => (a.minDist < b.minDist ? a : b));
      const collisionSize = this.tankSize * 0.9;
      if (!this.collidesWithObstacle(best.sp.x, best.sp.y, collisionSize)) {
        return { x: best.sp.x, y: best.sp.y };
      }
    }
    // If all spawn points are unsafe, try up to 100 random safe locations
    for (let attempt = 0; attempt < 100; attempt++) {
      // Avoid the center battle zone (e.g., 800x800 around center)
      const margin = this.tankSize * 2 + this.borderThickness;
      let x = margin + Math.random() * (this.arenaWidth - 2 * margin);
      let y = margin + Math.random() * (this.arenaHeight - 2 * margin);
      // Avoid center
      const centerX = this.arenaWidth / 2;
      const centerY = this.arenaHeight / 2;
      if (Math.abs(x - centerX) < 400 && Math.abs(y - centerY) < 400) continue;
      // Not in obstacle
      const collisionSize = this.tankSize * 0.9;
      if (this.collidesWithObstacle(x, y, collisionSize)) continue;
      // Not within minSafeDist of any player
      let safe = true;
      for (const p of alivePlayers) {
        if (Math.hypot(x - p.x, y - p.y) < minSafeDist) {
          safe = false;
          break;
        }
      }
      if (safe) return { x, y };
    }
    // Fallback: pick the spawn with the largest minDist (as safe as possible)
    const best = spawnScores.reduce((a, b) => (a.minDist > b.minDist ? a : b));
    const collisionSize = this.tankSize * 0.9;
    if (!this.collidesWithObstacle(best.sp.x, best.sp.y, collisionSize)) {
      return { x: best.sp.x, y: best.sp.y };
    }
    // Fallback: center of the map
    return { x: this.arenaWidth / 2, y: this.arenaHeight / 2 };
  }

  // Handle player input (movement and shooting)
  handleInput(socketId, input) {
    const player = this.players[socketId];
    if (!player || !player.isAlive) return;

    // Anti-cheat: Ignore input if player is dead or respawning
    if (!player.isAlive || player.respawnTime > 0) return;

    const { keys, mouseX, mouseY, shoot, clientTime } = input;

    // Anti-cheat: Rate-limit input (ignore if too frequent)
    const nowServer = Date.now();
    if (player.lastInputTime && clientTime && clientTime - player.lastInputTime < 1000 / this.tickRate * 0.5) {
      // Log suspicious input frequency
      console.log(`[ANTICHEAT] Player ${socketId} sent input too frequently. Ignored.`);
      return;
    }
    player.lastInputTime = clientTime || nowServer;

    // Update player angle based on mouse position
    if (mouseX !== undefined && mouseY !== undefined) {
      player.angle = Math.atan2(mouseY - player.y, mouseX - player.x);
    }

    // Handle movement
    const moveSpeed = 200; // pixels per second
    let vx = 0, vy = 0;

    if (keys.w || keys.ArrowUp) vy -= moveSpeed;
    if (keys.s || keys.ArrowDown) vy += moveSpeed;
    if (keys.a || keys.ArrowLeft) vx -= moveSpeed;
    if (keys.d || keys.ArrowRight) vx += moveSpeed;

    // Normalize diagonal movement
    if (vx !== 0 && vy !== 0) {
      vx *= 0.707; // 1/√2
      vy *= 0.707;
    }

    // Anti-cheat: Prevent teleporting (limit max movement per tick)
    const maxMovePerTick = moveSpeed / this.tickRate * 1.05; // 5% leeway
    let dx = vx / this.tickRate;
    let dy = vy / this.tickRate;
    if (Math.abs(dx) > maxMovePerTick) {
      console.log(`[ANTICHEAT] Player ${socketId} tried to move too fast in X (${dx}). Clamped.`);
      dx = Math.sign(dx) * maxMovePerTick;
    }
    if (Math.abs(dy) > maxMovePerTick) {
      console.log(`[ANTICHEAT] Player ${socketId} tried to move too fast in Y (${dy}). Clamped.`);
      dy = Math.sign(dy) * maxMovePerTick;
    }

    let newX = player.x + dx;
    let newY = player.y + dy;
    // Use a slightly larger collision box for stricter blocking
    const collisionSize = this.tankSize * 0.9;
    if (!this.collidesWithObstacle(newX, player.y, collisionSize)) player.x = newX;
    if (!this.collidesWithObstacle(player.x, newY, collisionSize)) player.y = newY;
    // No special border clamping needed; borders are just obstacles now

    // Clamp player within arena bounds (respect border thickness)
    const clampedX = Math.max(this.borderThickness + this.tankSize/2, Math.min(this.arenaWidth - this.borderThickness - this.tankSize/2, player.x));
    const clampedY = Math.max(this.borderThickness + this.tankSize/2, Math.min(this.arenaHeight - this.borderThickness - this.tankSize/2, player.y));
    if (player.x !== clampedX || player.y !== clampedY) {
      console.log(`[ANTICHEAT] Player ${socketId} tried to leave arena bounds. Clamped.`);
    }
    player.x = clampedX;
    player.y = clampedY;

    // Handle shooting
    if (shoot) {
      const now = Date.now() / 1000;
      // Anti-cheat: Enforce shooting cooldown strictly
      if (now - player.lastShot >= this.shootCooldown) {
        this.spawnBullet(socketId);
        player.lastShot = now;
      } else {
        // Log rapid-fire attempt
        console.log(`[ANTICHEAT] Player ${socketId} tried to shoot too fast. Ignored.`);
      }
    }
  }

  // Spawn a bullet from a player
  spawnBullet(ownerId) {
    const player = this.players[ownerId];
    if (!player || !player.isAlive) return;

    // Calculate bullet spawn position (in front of tank)
    const spawnDistance = this.tankSize / 2 + 5;
    const startX = player.x + Math.cos(player.angle) * spawnDistance;
    const startY = player.y + Math.sin(player.angle) * spawnDistance;
    
    // Calculate bullet velocity
    const vx = Math.cos(player.angle) * this.bulletSpeed;
    const vy = Math.sin(player.angle) * this.bulletSpeed;
    
    const bullet = {
      x: startX,
      y: startY,
      vx: vx,
      vy: vy,
      owner: ownerId,
      lifetime: this.bulletLifetime
    };
    
    this.bullets.push(bullet);
    // Emit bulletFired event to shooter for sound sync
    this.io.to(ownerId).emit('bulletFired');
  }

  // Update game state (called every frame)
  update() {
    // Update bullets
    this.updateBullets();
    // Update invincibility timers
    for (const player of Object.values(this.players)) {
      if (player.invincible) {
        player.invincibleTimer -= 1 / this.tickRate;
        if (player.invincibleTimer <= 0) {
          player.invincible = false;
          player.invincibleTimer = 0;
        }
      }
    }
    // Broadcast game state to all players
    this.broadcastGameState();
  }

  // Update bullet positions and handle collisions
  updateBullets() {
    this.bullets = this.bullets.filter(bullet => {
      // Move bullet
      bullet.x += bullet.vx / this.tickRate;
      bullet.y += bullet.vy / this.tickRate;
      bullet.lifetime -= 1 / this.tickRate;
      // Remove bullets that hit arena boundaries or expired
      if (this.isBulletOutOfBounds(bullet) || bullet.lifetime <= 0) {
        // Impact at border
        this.io.sockets.emit('bulletImpact', { x: bullet.x, y: bullet.y, type: 'border' });
        return false;
      }
      // Check bullet-obstacle collisions (including border obstacles)
      if (this.collidesWithObstacle(bullet.x, bullet.y, this.bulletSize * 2)) {
        // Impact at wall/obstacle
        this.io.sockets.emit('bulletImpact', { x: bullet.x, y: bullet.y, type: 'wall' });
        return false; // Remove bullet
      }
      // Check bullet-tank collisions
      for (const [playerId, player] of Object.entries(this.players)) {
        if (!player.isAlive || playerId === bullet.owner) continue;
        if (player.invincible) continue; // Skip invincible players
        const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
        if (distance < this.tankSize / 2) {
          this.handlePlayerHit(playerId, bullet.owner);
          // (No need to emit impact here, handled by hit/death logic)
          return false; // Remove bullet
        }
      }
      return true;
    });
  }

  // Check if bullet is out of arena bounds
  isBulletOutOfBounds(bullet) {
    return bullet.x < 0 || bullet.x > this.arenaWidth || 
           bullet.y < 0 || bullet.y > this.arenaHeight;
  }

  // Handle player being hit by a bullet
  handlePlayerHit(targetId, shooterId) {
    const target = this.players[targetId];
    const shooter = this.players[shooterId];
    if (!target || !target.isAlive) return;
    // Instantly kill the player on hit
    this.io.to(targetId).emit('playerHit', { killerId: shooterId });
    this.io.to(shooterId).emit('hitConfirmed', { targetId });
    this.handlePlayerDeath(targetId, shooterId);
  }

  // Handle player death
  handlePlayerDeath(deadPlayerId, killerId) {
    // Acquire lock for both killer and dead player to prevent race conditions
    const lockIds = [deadPlayerId];
    if (killerId) lockIds.push(killerId);
    // Try to acquire all locks
    for (const id of lockIds) {
      if (!this.acquireLock(id)) {
        console.warn(`[LOCK] Could not acquire lock for ${id}, skipping handlePlayerDeath`);
        return;
      }
    }
    try {
      console.log(`[DEBUG] handlePlayerDeath called for killer ${killerId}, dead ${deadPlayerId}`);
    const deadPlayer = this.players[deadPlayerId];
    if (!deadPlayer) return;
    let killerUsername = null;
    let killerColor = null;
    // Pot system logic
    if (killerId && this.players[killerId]) {
      const killer = this.players[killerId];
      // Transfer pot
      killer.pot += deadPlayer.pot;
      deadPlayer.pot = 0;
      // Notify both players of updated pots/wallets
      this.io.to(killerId).emit('potUpdate', {
        walletBalance: killer.walletBalance,
        pot: killer.pot
      });
      this.io.to(deadPlayerId).emit('potUpdate', {
        walletBalance: deadPlayer.walletBalance,
        pot: deadPlayer.pot
      });
        // Emit playerKilled event to the killer
        this.io.to(killerId).emit('playerKilled', {
          killerId,
          killedId: deadPlayerId,
          killedUsername: deadPlayer.username,
          killedColor: deadPlayer.tankColor
        });
      killerUsername = killer.username;
      killerColor = killer.tankColor;
    } else {
      // Died by environment or self: lose pot
      deadPlayer.pot = 0;
      this.io.to(deadPlayerId).emit('potUpdate', {
        walletBalance: deadPlayer.walletBalance,
        pot: deadPlayer.pot
      });
    }
      // Broadcast death event to all players with dead player's position
      this.io.sockets.emit('playerDied', {
        killerId,
        killerUsername,
        killerColor,
        x: deadPlayer.x,
        y: deadPlayer.y,
        targetId: deadPlayerId
      });
      // Remove player from game after death
      delete this.players[deadPlayerId];
      this.broadcastScoreboard();
    } finally {
      // Release all locks
      for (const id of lockIds) this.releaseLock(id);
    }
  }

  // Broadcast game state to all players
  broadcastGameState() {
    this.io.sockets.emit('gameState', {
      players: this.players,
      bullets: this.bullets.map(bullet => ({ x: bullet.x, y: bullet.y, owner: bullet.owner })),
      obstacles: this.obstacles
    });
  }

  // Broadcast scoreboard to all players
  broadcastScoreboard() {
    const scoreboard = Object.values(this.players).map(p => ({
      id: p.id || '',
      username: p.username,
      kills: p.kills,
      deaths: p.deaths
    })).sort((a, b) => b.kills - a.kills);
    this.io.sockets.emit('scoreboard', scoreboard);
  }

  // Get current game stats
  getGameStats() {
    return {
      playerCount: Object.keys(this.players).length,
      bulletCount: this.bullets.length,
      arenaSize: { width: this.arenaWidth, height: this.arenaHeight }
    };
  }

  // Attempt to join the game with entry fee and pot initialization
  async attemptJoinGame(socketId, fetchWalletCb, updateWalletCb) {
    const player = this.players[socketId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (!player.privyUserId) return { success: false, message: 'User ID missing.' };
    if (player.inGame) return { success: false, message: 'Player already in game.' };
    // Always fetch wallet from Privy
    const privyWallet = await fetchWalletCb();
    if (typeof privyWallet !== 'number' || privyWallet < 1) {
      return { success: false, message: 'Insufficient funds. Need at least $1 to join.' };
    }
    // Deduct $1 entry fee (persisted by callback)
    const newBalance = privyWallet - 1;
    await updateWalletCb(newBalance);
    player.walletBalance = newBalance;
    player.pot = 1;
    player.inGame = true;
    // Emit update
    this.io.to(socketId).emit('potUpdate', {
      walletBalance: player.walletBalance,
      pot: player.pot
    });
    return { success: true, message: 'Joined game. $1 entry fee paid.' };
  }

  // Cash out the player's pot to their wallet (do NOT remove from game)
  async cashOutPot(socketId, fetchWalletCb, updateWalletCb) {
    const player = this.players[socketId];
    if (!player) return { success: false, message: 'Player not found.' };
    if (!player.inGame) return { success: false, message: 'Not in game.' };
    if (player.pot <= 0) {
      this.io.to(socketId).emit('potUpdate', {
        walletBalance: player.walletBalance,
        pot: player.pot
      });
      return { success: false, message: 'No pot to cash out.' };
    }
    // Use in-memory wallet, not a fresh fetch from Privy
    console.log(`[DEBUG] Cashing out: in-memory wallet = $${player.walletBalance}, pot = $${player.pot}`);
    const newBalance = player.walletBalance + player.pot;
    await updateWalletCb(newBalance);
    player.walletBalance = newBalance;
    player.pot = 0;
    console.log(`[DEBUG] After cashout: wallet = $${player.walletBalance}, pot = $${player.pot}`);
    // Emit update
    this.io.to(socketId).emit('potUpdate', {
      walletBalance: player.walletBalance,
      pot: player.pot
    });
    return { success: true, message: 'Cashed out successfully.' };
  }

  collidesWithObstacle(x, y, size) {
    return this.obstacles.some(obs =>
      x + size/2 > obs.x && x - size/2 < obs.x + obs.w &&
      y + size/2 > obs.y && y - size/2 < obs.y + obs.h
    );
  }

  // Add a function to acquire a lock for a specific user
  acquireLock(userId) {
    if (this.locks[userId]) {
      console.warn(`Lock already acquired for user ${userId}. Waiting...`);
      return false; // Indicate that lock is not immediately available
    }
    this.locks[userId] = true;
    return true; // Indicate that lock was acquired
  }

  // Add a function to release a lock for a specific user
  releaseLock(userId) {
    if (this.locks[userId]) {
      delete this.locks[userId];
    }
  }
}

module.exports = TankGame;
