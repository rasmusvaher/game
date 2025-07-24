// client/src/game.js - Enhanced Tank Deathmatch Client

import { io } from "socket.io-client";

class TankGameClient {
    constructor(canvas, options = {}) {
        this.canvas = canvas || document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        // Removed legacy responsive canvas resizing code
        
        // Get parameters from URL
        this.gameParams = this.getUrlParameters();
        this.username = this.gameParams.username || 'Player';
        const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
        this.serverUrl = this.gameParams.server || window.location.origin;
        
        this.socket = io(API_BASE_URL);
        
        // Game state
        this.players = {};
        this.bullets = [];
        this.myId = null;
        this.isAlive = true;
        
        // Client-side prediction and interpolation
        this.predictedPlayers = {}; // Local predictions for smooth movement
        this.interpolatedPlayers = {}; // Smooth interpolation for other players
        this.interpolatedBullets = []; // Smooth interpolation for bullets
        this.serverUpdateRate = 60; // Expected server updates per second
        this.interpolationDelay = 100; // ms delay for interpolation (adjusts for ping)
        this.lastServerUpdate = 0;
        this.serverUpdateBuffer = []; // Buffer for interpolation
        this.reconciliationThreshold = 50; // pixels - if server position differs by more than this, snap to server
        
        // Performance tracking
        this.fps = 60;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.ping = 0;
        this.lastPingTime = 0;
        
        // Animation and effects
        // this.particles = []; // Removed
        this.screenShake = 0;
        this.flashEffect = 0;
        // this.bulletImpacts = []; // Removed
        this.deathSplats = []; // Re-add as an array for static splats
        this.impactCircles = [];
        
        // Input state
        this.keys = {
            w: false, s: false, a: false, d: false,
            ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false
        };
        this.mouseX = 0; // world
        this.mouseY = 0; // world
        this.mouseScreenX = 0; // canvas/screen
        this.mouseScreenY = 0; // canvas/screen
        this.isShooting = false;
        this.mouseInside = false;
        
        // Game settings
        this.tankSize = 30;
        this.bulletSize = 6;
        this.arenaWidth = 7500; // New size
        this.arenaHeight = 7500; // New size
        this.borderThickness = 150; // Proportional border
        // Camera/viewport
        this.viewportWidth = 1200; // Canvas size (window into the map)
        this.viewportHeight = 800;
        this.cameraX = 0;
        this.cameraY = 0;
        
        // UI elements
        // this.scoreboardContent = document.getElementById('scoreboardContent');
        // this.gameOver = document.getElementById('gameOver');
        // this.respawnTimer = document.getElementById('respawnTimer');
        // this.killerName = document.getElementById('killerName');
        // this.loading = document.getElementById('loading');
        // this.playerCount = document.getElementById('playerCount');
        // this.fpsCounter = document.getElementById('fpsCounter');
        // this.pingValue = document.getElementById('pingValue');
        
        this.obstacles = [];
        
        this.init();
        this.lastShotClientTime = 0;
        // Add user gesture handler to unlock audio
        // Sound effects (paths relative to HTML file)
        this.sounds = {
            spawn: new Audio('assets/spawn.wav'),
            shoot: new Audio('assets/shoot.wav'),
            death: new Audio('assets/death.wav'),
            kill: new Audio('assets/kill.wav')
        };
        // Set all sound volumes to 1.0
        Object.values(this.sounds).forEach(audio => { audio.volume = 1.0; });
        // Make shooting sound 50% lower volume
        this.sounds.shoot.volume = 0.25;
        // Unlock audio on any user interaction (pointerdown, keydown, click)
        const unlockAudio = () => {
            Object.values(this.sounds).forEach(audio => {
                if (audio && audio.paused) {
                    audio.play().catch(() => {});
                    audio.pause();
                    audio.currentTime = 0;
                }
            });
            window.removeEventListener('pointerdown', unlockAudio);
            window.removeEventListener('keydown', unlockAudio);
            window.removeEventListener('click', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
        window.addEventListener('click', unlockAudio);
        this.killPopupTimer = 0;
        this.killPopupText = '';
        this.onPlayerDeath = options.onPlayerDeath;
        // Pot system fields
        this.privyUserId = options.privyUserId;
        this.email = options.email;
        // Remove all references to fake/in-memory wallet and pot
        // Use the Privy Solana wallet balance as the only currency
        // Remove: this.walletBalance, this.pot, and related logic
        // All pot and wallet logic should reflect the real wallet balance
        // Remove any code that references or updates a fake wallet or pot
        // Ensure all UI and logic use the real balance from the Privy wallet
        this.statusMessage = '';
        this.statusMessageTimer = 0;
        // For hold-P cash out
        this.pKeyDownTime = null;
        this.cashOutPending = false;
        // Create wallet/pot overlay
        // this.createPotOverlay(); // Removed
        // Fetch wallet balance from backend if privyUserId or email is provided
        if (this.privyUserId || this.email) {
            fetch(`${API_BASE_URL}/api/get-wallet-balance`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: this.privyUserId, email: this.email })
            })
            .then(res => res.json())
            .then(data => {
                if (typeof data.walletBalance === 'number') {
                    // this.walletBalance = data.walletBalance; // Removed
                    // this.updatePotOverlay(); // Removed
                }
            });
        }
        this.lastShotClientTime = 0;
        this.deathScreenTimer = 0;
        this.deathKillerName = '';
        this.deathKillerColor = '';
        // Set this.walletBalance = 0 for the local player
        this.walletBalance = 0;
    }
    
    getUrlParameters() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key && value) {
                params[decodeURIComponent(key)] = decodeURIComponent(value);
            }
        }
        
        return params;
    }
    
    async init() {
        // Reset input state on new game
        Object.keys(this.keys).forEach(k => this.keys[k] = false);
        this.isShooting = false;
        // Set mouse to player position and enable aiming immediately
        if (this.myId && this.players[this.myId]) {
            this.mouseX = this.players[this.myId].x;
            this.mouseY = this.players[this.myId].y;
        } else {
            this.mouseX = this.arenaWidth / 2;
            this.mouseY = this.arenaHeight / 2;
        }
        this.mouseInside = true;
        this.setupEventListeners();
        this.setupSocketListeners();
        this.updatePlayerName();
        this.gameLoop();
    }
    
    updatePlayerName() {
        const playerNameElement = document.getElementById('playerName');
        if (playerNameElement) {
            playerNameElement.textContent = this.username;
        }
    }
    
    setupEventListeners() {
        // Remove any previous listeners to prevent duplication
        if (this._eventListenersSet) return;
        this._eventListenersSet = true;
        // Keyboard events
        document.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = true;
            }
        });
        document.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key)) {
                this.keys[e.key] = false;
            }
        });
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = this.canvas.width / rect.width;
            const scaleY = this.canvas.height / rect.height;
            // Convert mouse position to canvas (viewport) coordinates
            const canvasX = Math.max(0, Math.min((e.clientX - rect.left) * scaleX, this.canvas.width));
            const canvasY = Math.max(0, Math.min((e.clientY - rect.top) * scaleY, this.canvas.height));
            this.mouseScreenX = canvasX;
            this.mouseScreenY = canvasY;
            // Convert to world coordinates using camera offset
            this.mouseX = this.cameraX + canvasX;
            this.mouseY = this.cameraY + canvasY;
            // Clamp to map bounds
            this.mouseX = Math.max(0, Math.min(this.arenaWidth, this.mouseX));
            this.mouseY = Math.max(0, Math.min(this.arenaHeight, this.mouseY));
        });
        this.canvas.addEventListener('mouseenter', () => {
            this.mouseInside = true;
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.mouseInside = false;
            // Reset mouse to tank center and disable shooting
            if (this.myId && this.players[this.myId]) {
                this.mouseX = this.players[this.myId].x;
                this.mouseY = this.players[this.myId].y;
            } else {
                this.mouseX = this.arenaWidth / 2;
                this.mouseY = this.arenaHeight / 2;
            }
            this.isShooting = false;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            this.isShooting = true;
        });
        this.canvas.addEventListener('mouseup', () => {
            this.isShooting = false;
        });
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        // Add P key for cash out
        document.addEventListener('keydown', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                if (!this.pKeyDownTime && !this.cashOutPending) {
                    this.pKeyDownTime = Date.now();
                    this.cashOutPending = true;
                    // Inline cashout hold logic
                    const checkHold = () => {
                        if (!this.pKeyDownTime || !this.cashOutPending) return;
                        const held = Date.now() - this.pKeyDownTime;
                        if (held >= 3000) {
                            this.socket.emit('playerCashOut'); // <-- Added this line to trigger cashout
                            this.pKeyDownTime = null;
                            this.cashOutPending = false;
                        } else {
                            this._cashoutTimeout = setTimeout(checkHold, 50);
                        }
                    };
                    checkHold();
                }
            }
        });
        document.addEventListener('keyup', (e) => {
            if (e.key === 'p' || e.key === 'P') {
                this.pKeyDownTime = null;
                this.cashOutPending = false;
                if (this._cashoutTimeout) clearTimeout(this._cashoutTimeout);
            }
        });
    }
    
    setupSocketListeners() {
        
        this.socket.on('connect', () => {
            // this.loading.style.display = 'none';
            
            // Send player data to server, including privyUserId/email and walletBalance
            this.socket.emit('playerJoin', {
                username: this.username,
                // walletBalance: this.walletBalance, // Removed
                privyUserId: this.privyUserId,
                email: this.email
            });
            
            // Start ping measurement
            this.startPingMeasurement();
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('🔌 Connection error:', error);
            // this.loading.textContent = 'Connection failed. Retrying...';
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('🔌 Disconnected from server:', reason);
            // this.loading.style.display = 'block';
        });
        
        this.socket.on('error', (error) => {
            console.error('🔌 Socket error:', error);
        });
        
        this.socket.on('gameState', (gameState) => {
            // Store server update with timestamp for interpolation
            const updateTime = Date.now();
            this.serverUpdateBuffer.push({
                timestamp: updateTime,
                players: gameState.players,
                bullets: gameState.bullets
            });
            
            // Keep only recent updates (last 500ms)
            this.serverUpdateBuffer = this.serverUpdateBuffer.filter(
                update => updateTime - update.timestamp < 500
            );
            
            // Update obstacles (static, no interpolation needed)
            this.obstacles = gameState.obstacles || [];
            
            // Set my ID if not set
            if (!this.myId && gameState.players[this.socket.id]) {
                this.myId = this.socket.id;
                // this.updateUI();
            }
            
            // Update interpolation delay based on ping
            this.interpolationDelay = Math.max(50, Math.min(200, this.ping * 0.5));
        });
        
        this.socket.on('scoreboard', (scoreboard) => {
            // this.updateScoreboard(scoreboard);
        });
        
        this.socket.on('playerHit', (data) => {
            this.handlePlayerHit(data);
        });
        
        this.socket.on('playerDied', (data) => {
            if (data && data.targetId === this.myId) {
                this.playSound('death');
                this.deathScreenTimer = 5 * this.fps;
                this.deathKillerName = data.killerUsername || 'Unknown';
                this.deathKillerColor = data.killerColor || '#e53935';
                this.handlePlayerDeath(data); // Only call for the dead player
            }
            // Add death splat effect for all players
            let deadId = (data && (data.targetId || data.deadPlayerId || data.playerId)) || this.myId;
            let splatX = null, splatY = null;
            if (this.players[deadId]) {
                splatX = this.players[deadId].x;
                splatY = this.players[deadId].y;
            } else if (data && typeof data.x === 'number' && typeof data.y === 'number') {
                splatX = data.x;
                splatY = data.y;
            }
            if (splatX !== null && splatY !== null) {
                this.deathSplats.push({
                    x: splatX,
                    time: Date.now(),
                    alpha: 1,
                    blobs: Array.from({length: 6 + Math.floor(Math.random()*4)}, (_,i) => ({
                        dx: (Math.random()-0.5)*this.tankSize*0.7,
                        dy: (Math.random()-0.5)*this.tankSize*0.7,
                        r: this.tankSize*0.4 + Math.random()*this.tankSize*0.25
                    }))
                });
            }
        });
        
        this.socket.on('playerKilled', (data) => {
            if (data && data.killerId === this.myId) {
                this.playSound('kill');
            }
            this.handlePlayerKill(data);
        });
        
        this.socket.on('playerRespawned', (data) => {
            this.handlePlayerRespawn(data);
        });

        this.socket.on('bulletImpact', (data) => {
            // Add a better impact effect: random radius, fade out over 3 frames
            const radius = 15 + Math.random() * 7;
            this.impactCircles.push({ x: data.x, y: data.y, type: data.type, radius, life: 3, maxLife: 3 });
        });

        this.socket.on('bulletFired', () => {
            this.playSound('shoot');
        });
        this.socket.on('joinSuccess', (data) => {
            // this.walletBalance = data.walletBalance; // Removed
            // this.pot = data.pot; // Removed
            // (status message removed)
            // this.updatePotOverlay(); // Removed
            // Persist walletBalance in Privy
            if (this.privyUserId) {
                fetch(`${API_BASE_URL}/api/set-wallet-balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.privyUserId, walletBalance: data.walletBalance })
                });
            }
        });
        this.socket.on('joinFailed', (data) => {
            // (status message removed)
            // this.updatePotOverlay(); // Removed
        });
        this.socket.on('potUpdate', (data) => {
            // this.walletBalance = data.walletBalance; // Removed
            // this.pot = data.pot; // Removed
            // this.updatePotOverlay(); // Removed
            // Persist walletBalance in Privy
            if (this.privyUserId) {
                fetch(`${API_BASE_URL}/api/set-wallet-balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.privyUserId, walletBalance: data.walletBalance })
                });
            }
        });
        this.socket.on('cashOutResult', (data) => {
            // this.walletBalance = data.walletBalance; // Removed
            // this.pot = data.pot; // Removed
            // (status message removed)
            // this.updatePotOverlay(); // Removed
            // Persist walletBalance in Privy
            if (this.privyUserId) {
                fetch(`${API_BASE_URL}/api/set-wallet-balance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: this.privyUserId, walletBalance: data.walletBalance })
                });
            }
            // Dispatch custom event for App.jsx to update menu wallet
            window.dispatchEvent(new CustomEvent('cashOutResult', { detail: { walletBalance: data.walletBalance } }));
            this.quitToMenu(); // <-- Added: return to menu after cashout
        });
        this.socket.on('forceDisconnect', (data) => {
            alert(data && data.message ? data.message : 'You have been logged out due to login from another device or tab.');
            this.quitToMenu();
        });
    }
    
    sendInput() {
        if (!this.myId || !this.isAlive || !this.mouseInside) return;
        // No longer call predictLocalPlayer() here; it's now in gameLoop
        this.socket.emit('playerInput', {
            keys: this.keys,
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            shoot: this.isShooting,
            clientTime: Date.now()
        });
    }
    
    predictLocalPlayer() {
        if (!this.myId || !this.players[this.myId]) return;
        if (!this.obstacles || this.obstacles.length === 0) return;
        // Use a separate prediction state, never mutate server state
        const serverPlayer = this.players[this.myId];
        let predicted = this.predictedPlayers[this.myId] || { ...serverPlayer };
        const moveSpeed = 200; // pixels per second
        let vx = 0, vy = 0;
        if (this.keys.w || this.keys.ArrowUp) vy -= moveSpeed;
        if (this.keys.s || this.keys.ArrowDown) vy += moveSpeed;
        if (this.keys.a || this.keys.ArrowLeft) vx -= moveSpeed;
        if (this.keys.d || this.keys.ArrowRight) vx += moveSpeed;
        if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
        }
        const deltaTime = 1 / 60;
        let predictedX = predicted.x + vx * deltaTime;
        let predictedY = predicted.y + vy * deltaTime;
        const collisionSize = this.tankSize * 0.9;
        if (!this.collidesWithObstacle(predictedX, predicted.y, collisionSize)) {
            predicted.x = predictedX;
        }
        if (!this.collidesWithObstacle(predicted.x, predictedY, collisionSize)) {
            predicted.y = predictedY;
        }
        predicted.angle = Math.atan2(this.mouseY - predicted.y, this.mouseX - predicted.x);
        this.predictedPlayers[this.myId] = { ...predicted };
        // Overwrite players[myId] with predicted state for instant rendering
        this.players[this.myId] = this.predictedPlayers[this.myId];
    }
    
    updateUI() {
        if (!this.myId || !this.players[this.myId]) return;
        
        // Update game stats
        // this.playerCount.textContent = Object.keys(this.players).length;
        // this.fpsCounter.textContent = this.fps;
        // this.pingValue.textContent = `${this.ping}ms`;
    }
    
    updateScoreboard(scoreboard) {
        // this.scoreboardContent.innerHTML = '';
        // If there's a heading element, set it to 'Leaderboard'
        const heading = document.querySelector('#scoreboard h3');
        if (heading) heading.textContent = '🏆 Leaderboard';
        // scoreboard.forEach((player, index) => {
        //     const playerDiv = document.createElement('div');
        //     playerDiv.className = `player-score ${player.id === this.myId ? 'you' : ''}`;
        //     const displayName = player.id === this.myId ? 'You' : (player.username || `Player ${player.id.slice(0, 6)}`);
        //     playerDiv.innerHTML = `
        //         <span>${index + 1}. ${displayName}</span>
        //         <span>${player.kills}/${player.deaths}</span>
        //     `;
        //     this.scoreboardContent.appendChild(playerDiv);
        // });
    }
    
    handlePlayerHit(data) {
        // Enhanced hit effects
        this.screenShake = 0.3;
        this.flashEffect = 0.10; // Changed from 0.3 to 0.10
        // Create hit particles
        if (this.myId && this.players[this.myId]) {
            const player = this.players[this.myId];
            // this.createParticles(player.x, player.y, '#ff0000', 8); // Removed
        }
        this.playSound('hit');
    }
    
    playSound(type) {
        if (this.sounds && this.sounds[type]) {
            this.sounds[type].currentTime = 0;
            this.sounds[type].play().catch(e => {
                // Log error if sound fails to play
                console.warn('Sound play error:', type, e);
            });
        }
        // Visual effects for shooting
        if (type === 'shoot' && this.myId && this.players[this.myId]) {
            const player = this.players[this.myId];
            // Muzzle flash at cannon
            // this.createParticles( // Removed
            //     player.x + Math.cos(player.angle) * (this.tankSize/2 + 8),
            //     player.y + Math.sin(player.angle) * (this.tankSize/2 + 8),
            //     '#FFD600', 8
            // );
            this.flashEffect = 0.12; // Changed from 0.08 to 0.12
        }
    }
    
    startPingMeasurement() {
        setInterval(() => {
            this.lastPingTime = Date.now();
            this.socket.emit('ping');
        }, 1000);
        
        this.socket.on('pong', () => {
            this.ping = Date.now() - this.lastPingTime;
        });
    }
    
    handlePlayerDeath(data) {
        // Play death sound and effect
        this.playSound('death');
        // Only send to menu if this client is the one who died
        if (data && data.targetId === this.myId) {
            this.quitToMenu();
        }
    }
    
    handlePlayerKill(data) {
        // Show kill confirmation
        this.playSound('kill');
        this.killPopupText = 'KILL!';
        this.killPopupTimer = 60; // Show for 1 second (60 frames)
        // Extra effect: brief glow
        if (this.myId && this.players[this.myId]) {
            const player = this.players[this.myId];
            // this.createParticles(player.x, player.y, '#FFD600', 12); // Removed
            this.flashEffect = 0.18; // Changed from 0.18 to 0.18
        }
        
        // Show claim reward button if wallet is authenticated
        // This section is removed as PrivyWalletManager is removed
        // if (this.walletManager && this.walletManager.isAuthenticated() && this.claimRewardBtn) {
        //     this.claimRewardBtn.style.display = 'block';
        //     // Hide after 10 seconds
        //     setTimeout(() => {
        //         if (this.claimRewardBtn) {
        //             this.claimRewardBtn.style.display = 'none';
        //         }
        //     }, 10000);
        // }
    }
    
    handlePlayerRespawn(data) {
        // this.gameOver.style.display = 'none';
        this.isAlive = true;
        // Reset input state
        Object.keys(this.keys).forEach(k => this.keys[k] = false);
        this.isShooting = false;
        // Set mouse to player position and enable aiming immediately
        if (this.myId && this.players[this.myId]) {
            this.mouseX = this.players[this.myId].x;
            this.mouseY = this.players[this.myId].y;
        } else {
            this.mouseX = this.arenaWidth / 2;
            this.mouseY = this.arenaHeight / 2;
        }
        this.mouseInside = true;
        // Play spawn sound and effect
        this.playSound('spawn');
        // this.createParticles(this.mouseX, this.mouseY, '#00eaff', 18); // Removed
        this.flashEffect = 0.15;
    }
    
    render() {
        // Camera follows the PREDICTED position of the local player for smoothness
        let camX = 0, camY = 0;
        const minimapMargin = 180; // px
        let localPlayer = this.players[this.myId];
        // Use predicted position if available
        if (this.myId && this.predictedPlayers[this.myId]) {
            localPlayer = this.predictedPlayers[this.myId];
        }
        if (this.myId && localPlayer) {
            camX = localPlayer.x - this.viewportWidth / 2;
            camY = localPlayer.y - this.viewportHeight / 2;
            // Clamp camera to map bounds, but add margin for minimap
            camX = Math.max(minimapMargin, Math.min(this.arenaWidth - this.viewportWidth, camX));
            camY = Math.max(minimapMargin, Math.min(this.arenaHeight - this.viewportHeight, camY));
            this.cameraX = camX;
            this.cameraY = camY;
        }
        // Always recalculate mouseX/mouseY from mouseScreenX/mouseScreenY and camera
        this.mouseX = this.cameraX + this.mouseScreenX;
        this.mouseY = this.cameraY + this.mouseScreenY;
        this.mouseX = Math.max(0, Math.min(this.arenaWidth, this.mouseX));
        this.mouseY = Math.max(0, Math.min(this.arenaHeight, this.mouseY));
        // Set canvas size to viewport
        this.canvas.width = this.viewportWidth;
        this.canvas.height = this.viewportHeight;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // All drawing is offset by camera
        this.ctx.save();
        this.ctx.translate(-this.cameraX, -this.cameraY);
        // Fill the entire map (void) with #F3F3F3
        this.ctx.fillStyle = '#F3F3F3';
        this.ctx.fillRect(0, 0, this.arenaWidth, this.arenaHeight);
        // Draw thick #B4B4B4 border around the arena
        this.ctx.save();
        this.ctx.strokeStyle = '#B4B4B4';
        this.ctx.lineWidth = this.borderThickness;
        this.ctx.shadowBlur = 0;
        this.ctx.strokeRect(
            this.borderThickness/2,
            this.borderThickness/2,
            this.arenaWidth - this.borderThickness,
            this.arenaHeight - this.borderThickness
        );
        this.ctx.restore();
        // Fill the arena area with #EAEAEA
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.rect(this.borderThickness, this.borderThickness, this.arenaWidth - 2*this.borderThickness, this.arenaHeight - 2*this.borderThickness);
        this.ctx.clip();
        this.ctx.fillStyle = '#EAEAEA';
        this.ctx.fillRect(this.borderThickness, this.borderThickness, this.arenaWidth - 2*this.borderThickness, this.arenaHeight - 2*this.borderThickness);
        // Draw thin gray grid inside the arena
        this.ctx.strokeStyle = '#D0D0D0';
        this.ctx.lineWidth = 1;
        for (let x = this.borderThickness; x <= this.arenaWidth - this.borderThickness; x += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, this.borderThickness);
            this.ctx.lineTo(x, this.arenaHeight - this.borderThickness);
            this.ctx.stroke();
        }
        for (let y = this.borderThickness; y <= this.arenaHeight - this.borderThickness; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(this.borderThickness, y);
            this.ctx.lineTo(this.arenaWidth - this.borderThickness, y);
            this.ctx.stroke();
        }
        this.ctx.restore();
        // Draw obstacles as #B4B4B4 (only those in viewport)
        this.obstacles.forEach(obs => {
            if (
                obs.x + obs.w > this.cameraX &&
                obs.x < this.cameraX + this.viewportWidth &&
                obs.y + obs.h > this.cameraY &&
                obs.y < this.cameraY + this.viewportHeight
            ) {
                this.ctx.fillStyle = '#B4B4B4';
                this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            }
        });

        // Draw simple bullet impact circles (fade out over 3 frames)
        if (!this.impactCircles) this.impactCircles = [];
        this.impactCircles = this.impactCircles.filter(impact => impact.life > 0);
        this.impactCircles.forEach(impact => {
            this.ctx.save();
            const alpha = 0.7 * (impact.life / impact.maxLife);
            this.ctx.globalAlpha = alpha;
            const r = impact.radius;
            // Radial gradient for soft glow
            const grad = this.ctx.createRadialGradient(impact.x, impact.y, 0, impact.x, impact.y, r);
            grad.addColorStop(0, impact.type === 'wall' ? '#fff' : '#ffe066');
            grad.addColorStop(0.5, impact.type === 'wall' ? '#888' : '#FFD600');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            this.ctx.beginPath();
            this.ctx.arc(impact.x, impact.y, r, 0, Math.PI * 2);
            this.ctx.fillStyle = grad;
            this.ctx.fill();
            // White border
            this.ctx.lineWidth = 2.5;
            this.ctx.strokeStyle = '#fff';
            this.ctx.stroke();
            this.ctx.restore();
            impact.life--;
        });
        
        // Optimized rendering: only draw visible players
        Object.entries(this.players).forEach(([id, player]) => {
            if (!player.isAlive) return;
            let renderPlayer = player;
            // For the local player, use the predicted position for rendering
            if (id === this.myId && this.predictedPlayers[this.myId]) {
                renderPlayer = this.predictedPlayers[this.myId];
            }
            if (
                renderPlayer.x + this.tankSize/2 > 0 &&
                renderPlayer.x - this.tankSize/2 < this.arenaWidth &&
                renderPlayer.y + this.tankSize/2 > 0 &&
                renderPlayer.y - this.tankSize/2 < this.arenaHeight
            ) {
                const isMe = id === this.myId;
                // Draw invincibility aura if player is invincible
                if (player.invincible && player.invincibleTimer > 0) {
                    this.ctx.save();
                    const auraAlpha = Math.max(0.25, player.invincibleTimer / 1.5 * 0.7); // Fade out
                    this.ctx.globalAlpha = auraAlpha;
                    this.ctx.beginPath();
                    this.ctx.arc(player.x, player.y, this.tankSize * 0.95, 0, Math.PI * 2);
                    this.ctx.fillStyle = isMe ? 'rgba(0,200,255,0.5)' : 'rgba(255,255,0,0.5)';
                    this.ctx.shadowColor = isMe ? '#00eaff' : '#ffe600';
                    this.ctx.shadowBlur = 18;
                    this.ctx.fill();
                    this.ctx.restore();
                }
                // Draw player model (head, hands, gun) - matches menu design
                this.ctx.save();
                this.ctx.translate(renderPlayer.x, renderPlayer.y);
                // Calculate angle from player to mouse (for local player) or use player.angle
                let tankAngle = 0;
                if (id === this.myId && this.mouseInside) {
                    tankAngle = Math.atan2(this.mouseY - renderPlayer.y, this.mouseX - renderPlayer.x);
                } else if (renderPlayer.angle !== undefined) {
                    tankAngle = renderPlayer.angle;
                }
                this.ctx.rotate(tankAngle);
                // Draw gun (shorter rectangle)
                this.ctx.save();
                this.ctx.fillStyle = '#444';
                this.ctx.strokeStyle = '#222';
                this.ctx.lineWidth = 4;
                this.ctx.beginPath();
                this.ctx.rect(this.tankSize * 0.67, -this.tankSize * 0.18, this.tankSize * 1.25, this.tankSize * 0.36); // gun body
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                // Draw hands (small circles)
                this.ctx.save();
                this.ctx.fillStyle = '#f9c97a';
                this.ctx.beginPath();
                this.ctx.arc(this.tankSize * 0.62, -this.tankSize * 0.36, this.tankSize * 0.28, 0, 2 * Math.PI); // top hand
                this.ctx.arc(this.tankSize * 0.62, this.tankSize * 0.36, this.tankSize * 0.28, 0, 2 * Math.PI); // bottom hand
                this.ctx.fill();
                this.ctx.restore();
                // Draw head (big circle)
                this.ctx.save();
                this.ctx.fillStyle = '#f9c97a';
                this.ctx.strokeStyle = '#222';
                this.ctx.lineWidth = 6;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, this.tankSize * 0.76, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
                this.ctx.restore();
                this.ctx.restore(); // End player rotation/translation
                // Draw pot balance above head (for all players, always upright)
                this.ctx.save();
                this.ctx.font = 'bold 18px Segoe UI, Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'bottom';
                this.ctx.globalAlpha = 0.92;
                const potY = renderPlayer.y - this.tankSize * 0.95;
                // Add a loading state for wallet and pot
                if (typeof this.walletBalance !== 'number') {
                    // Show loading for pot
                    this.ctx.save();
                    this.ctx.font = 'bold 18px Segoe UI, Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'bottom';
                    this.ctx.globalAlpha = 0.92;
                this.ctx.fillStyle = '#fff';
                    this.ctx.strokeStyle = '#222';
                    this.ctx.lineWidth = 4;
                    this.ctx.strokeText('Loading...', renderPlayer.x, potY);
                    this.ctx.fillStyle = '#00ffae';
                    this.ctx.fillText('Loading...', renderPlayer.x, potY);
                this.ctx.restore();
                } else {
                    const potValue = (id === this.myId) ? (typeof this.walletBalance === 'number' ? this.walletBalance : 0) : (typeof renderPlayer.walletBalance === 'number' ? renderPlayer.walletBalance : 0);
                    this.ctx.fillStyle = '#fff';
                    this.ctx.strokeStyle = '#222';
                    this.ctx.lineWidth = 4;
                    // Draw outline for readability
                    this.ctx.strokeText(`$${potValue.toFixed(2)}`, renderPlayer.x, potY);
                    this.ctx.fillStyle = '#00ffae';
                    this.ctx.fillText(`$${potValue.toFixed(2)}`, renderPlayer.x, potY);
                    this.ctx.restore();
                }
                // Draw cashout progress bar above head if local player is holding P
                // Ensure potValue is defined for this block as well
                let potValue = 0;
                if (id === this.myId) {
                  potValue = (typeof this.walletBalance === 'number') ? this.walletBalance : 0;
                } else if (renderPlayer && typeof renderPlayer.walletBalance === 'number') {
                  potValue = renderPlayer.walletBalance;
                }
                if (id === this.myId && this.cashOutPending && this.pKeyDownTime) {
                    const now = Date.now();
                    const elapsed = Math.min(3, (now - this.pKeyDownTime) / 1000);
                    const pct = Math.max(0, Math.min(1, elapsed / 3));
                    const barW = this.tankSize * 4.2;
                    const barH = 30;
                    const barY = renderPlayer.y - this.tankSize * 0.95 - 48;
                    this.ctx.save();
                    this.ctx.globalAlpha = 0.98;
                    // Shadow/glow
                    this.ctx.shadowColor = '#ffd70088';
                    this.ctx.shadowBlur = 12;
                    // Bar background (rounded rect)
                    this.ctx.fillStyle = '#23243a';
                    this.#drawRoundedRect(renderPlayer.x - barW/2, barY, barW, barH, 11);
                    this.ctx.fill();
                    // Bar fill (gold gradient)
                    const grad = this.ctx.createLinearGradient(renderPlayer.x - barW/2, 0, renderPlayer.x + barW/2, 0);
                    grad.addColorStop(0, '#ffe066');
                    grad.addColorStop(1, '#ffd700');
                    this.ctx.fillStyle = grad;
                    this.#drawRoundedRect(renderPlayer.x - barW/2, barY, barW * pct, barH, 11);
                    this.ctx.fill();
                    // Bar border
                    this.ctx.lineWidth = 2.5;
                    this.ctx.strokeStyle = '#fff';
                    this.#drawRoundedRect(renderPlayer.x - barW/2, barY, barW, barH, 11);
                    this.ctx.stroke();
                    // Text
                    this.ctx.shadowBlur = 0;
                    this.ctx.font = 'bold 15px Segoe UI, Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillStyle = '#23243a';
                    let cashText = `Cashing Out ($${potValue.toFixed(2)})`;
                    // Shrink font if text is too wide
                    while (this.ctx.measureText(cashText).width > barW - 18 && this.ctx.font.includes('15px')) {
                        this.ctx.font = 'bold 13px Segoe UI, Arial';
                    }
                    this.ctx.fillText(cashText, renderPlayer.x, barY + barH/2);
                    this.ctx.restore();
                }
            }
        });
        
        // Optimized rendering: only draw visible bullets
        this.bullets.forEach(bullet => {
            if (
                bullet.x + this.bulletSize > 0 &&
                bullet.x - this.bulletSize < this.arenaWidth &&
                bullet.y + this.bulletSize > 0 &&
                bullet.y - this.bulletSize < this.arenaHeight
            ) {
                const isMyBullet = bullet.owner === this.myId;
                const color = isMyBullet ? '#00aaff' : '#e53935';
                this.ctx.save();
                // Bullet shadow/trail
                for (let t = 1; t <= 6; t++) {
                    this.ctx.globalAlpha = 0.10 * (1 - t * 0.13);
                    this.ctx.beginPath();
                    this.ctx.ellipse(
                        bullet.x - (bullet.vx/this.fps) * t * 0.7,
                        bullet.y - (bullet.vy/this.fps) * t * 0.7,
                        this.bulletSize * 0.9 * (1 - t*0.10),
                        this.bulletSize * 0.6 * (1 - t*0.10),
                        0, 0, Math.PI * 2
                    );
                    this.ctx.fillStyle = '#888';
                    this.ctx.fill();
                }
                this.ctx.globalAlpha = 1.0;
                // Animate bullet scale for realism
                const scale = 1 + 0.12 * Math.sin(Date.now()/60 + bullet.x + bullet.y);
                this.ctx.beginPath();
                this.ctx.ellipse(bullet.x, bullet.y, this.bulletSize * 0.8 * scale, this.bulletSize * 0.5 * scale, 0, 0, Math.PI * 2);
                this.ctx.fillStyle = color;
                this.ctx.shadowColor = color;
                this.ctx.shadowBlur = 8;
                this.ctx.fill();
                this.ctx.lineWidth = 1;
                this.ctx.strokeStyle = isMyBullet ? '#003355' : '#660000';
                this.ctx.stroke();
                this.ctx.restore();
            }
        });
        
        // Draw particles
        // this.particles.forEach(particle => { // Removed
        //     this.ctx.save();
        //     this.ctx.globalAlpha = particle.alpha;
        //     this.ctx.fillStyle = particle.color;
        //     this.ctx.beginPath();
        //     this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
        //     this.ctx.fill();
        //     this.ctx.restore();
        // });
        
        // Draw bullet impact shockwaves
        // this.bulletImpacts.forEach(impact => { // Removed
        //     this.ctx.save();
        //     this.ctx.globalAlpha = impact.alpha;
        //     this.ctx.beginPath();
        //     this.ctx.arc(impact.x, impact.y, impact.radius, 0, Math.PI * 2);
        //     this.ctx.strokeStyle = impact.type === 'wall' ? '#888' : '#FFD600';
        //     this.ctx.lineWidth = 2.5;
        //     this.ctx.shadowColor = impact.type === 'wall' ? '#888' : '#FFD600';
        //     this.ctx.shadowBlur = 8;
        //     this.ctx.stroke();
        //     this.ctx.restore();
        // });
        
        // Draw death splats (below players)
        this.deathSplats.forEach(splat => {
            this.ctx.save();
            this.ctx.globalAlpha = 1; // Changed from 0.32 to 1
            this.ctx.beginPath();
            this.ctx.arc(splat.x, splat.y, this.tankSize * 0.5, 0, Math.PI * 2); // Changed from splat.blobs to a single circle
            this.ctx.fillStyle = '#b3001b';
            this.ctx.shadowColor = '#b3001b';
            this.ctx.shadowBlur = 8;
            this.ctx.fill();
            this.ctx.restore();
        });
        
        this.ctx.restore(); // End camera translation
        // --- Draw screen-space overlays (crosshair, flash, popups, minimap) ---
        // Draw minimap in top-left
        this.drawMinimap();
        
        // Always draw the tutorial overlay in the bottom left
        this.ctx.save();
        const tutPad = 18;
        const tutX = tutPad;
        const tutY = this.viewportHeight - tutPad - 90;
        this.ctx.font = 'bold 18px Segoe UI, Arial';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        this.ctx.shadowColor = '#181828';
        this.ctx.shadowBlur = 6;
        this.ctx.globalAlpha = 0.98;
        let y = tutY;
        const lineH = 26;
        this.ctx.fillStyle = '#ffd700';
        this.ctx.fillText('WSAD or arrow keys to move', tutX, y);
        y += lineH;
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText('Move mouse to aim', tutX, y);
        y += lineH;
        this.ctx.fillText('Left click to shoot', tutX, y);
        y += lineH;
        this.ctx.fillText('Hold P to cashout', tutX, y);
        this.ctx.restore();
        // Always draw the crosshair at the mouse position
        const clampedX = Math.max(0, Math.min(this.viewportWidth, this.mouseScreenX));
        const clampedY = Math.max(0, Math.min(this.viewportHeight, this.mouseScreenY));
        const size = 10;
        this.ctx.save();
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(clampedX - size, clampedY);
        this.ctx.lineTo(clampedX + size, clampedY);
        this.ctx.moveTo(clampedX, clampedY - size);
        this.ctx.lineTo(clampedX, clampedY + size);
        this.ctx.stroke();
        this.ctx.restore();
        // Draw flash effect (always covers the whole canvas)
        if (this.flashEffect > 0) {
            this.ctx.save();
            this.ctx.fillStyle = `rgba(255, 255, 255, ${this.flashEffect})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.restore();
        }
        // Draw kill popup if active (screen space)
        if (this.killPopupTimer > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(1, this.killPopupTimer / 20);
            this.ctx.font = 'bold 48px Segoe UI, Arial';
            this.ctx.fillStyle = '#FFD600';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.killPopupText, this.canvas.width/2, 80);
            this.ctx.restore();
        }
        
        // Improve game over effect
        if (!this.isAlive) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.6;
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;
            this.ctx.font = 'bold 54px Segoe UI, Arial';
            this.ctx.fillStyle = '#222';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Game Over', this.canvas.width/2, this.canvas.height/2 - 30);
            this.ctx.font = '24px Segoe UI, Arial';
            this.ctx.fillStyle = '#444';
            this.ctx.fillText('You fought bravely! Click to play again.', this.canvas.width/2, this.canvas.height/2 + 20);
            this.ctx.restore();
        }
        
        if (this.deathScreenTimer > 0) {
            this.ctx.save();
            this.ctx.globalAlpha = 0.92;
            this.ctx.fillStyle = '#181828';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.globalAlpha = 1.0;
            this.ctx.font = 'bold 54px Segoe UI, Arial';
            this.ctx.fillStyle = '#FFD600';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('You Died', this.canvas.width/2, this.canvas.height/2 - 40);
            this.ctx.font = 'bold 32px Segoe UI, Arial';
            this.ctx.fillStyle = this.deathKillerColor || '#e53935';
            this.ctx.fillText(`Killed by: ${this.deathKillerName}`, this.canvas.width/2, this.canvas.height/2 + 18);
            this.ctx.font = '20px Segoe UI, Arial';
            this.ctx.fillStyle = '#fff';
            this.ctx.fillText('Returning to menu...', this.canvas.width/2, this.canvas.height/2 + 60);
            this.ctx.restore();
        }
        
        this.ctx.restore();
    }
    
    updateQuitBarPosition() {
        const quitBarContainer = document.getElementById('quitBarContainer');
        if (!quitBarContainer || !this.myId || !this.players[this.myId]) return;
        // Ensure the bar is visible before measuring
        quitBarContainer.style.display = 'block';
        const player = this.players[this.myId];
        const canvas = this.canvas;
        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;
        quitBarContainer.style.left = (rect.left + (player.x - this.cameraX) * scaleX - quitBarContainer.offsetWidth/2) + 'px';
        quitBarContainer.style.top = (rect.top + (player.y - this.cameraY - 60) * scaleY) + 'px';
        quitBarContainer.style.position = 'fixed';
        // Optionally hide again if needed elsewhere
    }
    
    gameLoop(currentTime) {
        // Calculate FPS
        if (this.lastFrameTime) {
            const deltaTime = currentTime - this.lastFrameTime;
            this.fps = Math.round(1000 / deltaTime);
        }
        this.lastFrameTime = currentTime;
        // Prune visual effect arrays to prevent memory bloat
        if (this.deathSplats.length > 40) this.deathSplats.splice(0, this.deathSplats.length - 40);
        if (this.impactCircles.length > 40) this.impactCircles.splice(0, this.impactCircles.length - 40);
        if (this.serverUpdateBuffer.length > 60) this.serverUpdateBuffer.splice(0, this.serverUpdateBuffer.length - 60);
        // Update effects
        // this.updateEffects(); // Removed
        // Interpolate game state for smooth rendering
        this.interpolateGameState();
        // Always run prediction for local player before rendering (fixes input delay)
        this.predictLocalPlayer();
        // Send input
        this.sendInput();
        // Render
        this.render();
        // Update UI
        this.updateUI();
        this.updateQuitBarPosition();
        if (this.deathScreenTimer > 0) {
            this.deathScreenTimer--;
            if (this.deathScreenTimer === 0) {
                this.quitToMenu();
            }
        }
        // Continue loop
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    interpolateGameState() {
        if (this.serverUpdateBuffer.length < 2) return;
        
        const currentTime = Date.now();
        const targetTime = currentTime - this.interpolationDelay;
        
        // Find the two server updates to interpolate between
        let prevUpdate = null;
        let nextUpdate = null;
        
        for (let i = 0; i < this.serverUpdateBuffer.length - 1; i++) {
            if (this.serverUpdateBuffer[i].timestamp <= targetTime && 
                this.serverUpdateBuffer[i + 1].timestamp >= targetTime) {
                prevUpdate = this.serverUpdateBuffer[i];
                nextUpdate = this.serverUpdateBuffer[i + 1];
                break;
            }
        }
        
        if (!prevUpdate || !nextUpdate) return;
        
        // Calculate interpolation factor
        const timeDiff = nextUpdate.timestamp - prevUpdate.timestamp;
        const alpha = timeDiff > 0 ? (targetTime - prevUpdate.timestamp) / timeDiff : 0;
        
        // Interpolate players
        this.interpolatedPlayers = {};
        const allPlayerIds = new Set([
            ...Object.keys(prevUpdate.players),
            ...Object.keys(nextUpdate.players)
        ]);
        
        allPlayerIds.forEach(playerId => {
            const prevPlayer = prevUpdate.players[playerId];
            const nextPlayer = nextUpdate.players[playerId];
            
            if (prevPlayer && nextPlayer) {
                // Interpolate position and angle
                this.interpolatedPlayers[playerId] = {
                    ...prevPlayer,
                    x: prevPlayer.x + (nextPlayer.x - prevPlayer.x) * alpha,
                    y: prevPlayer.y + (nextPlayer.y - prevPlayer.y) * alpha,
                    angle: this.interpolateAngle(prevPlayer.angle, nextPlayer.angle, alpha)
                };
            } else if (prevPlayer) {
                this.interpolatedPlayers[playerId] = prevPlayer;
            } else if (nextPlayer) {
                this.interpolatedPlayers[playerId] = nextPlayer;
            }
        });
        
        // Interpolate bullets
        this.interpolatedBullets = [];
        const allBullets = new Set([
            ...prevUpdate.bullets.map(b => b.owner + '_' + b.x + '_' + b.y),
            ...nextUpdate.bullets.map(b => b.owner + '_' + b.x + '_' + b.y)
        ]);
        
        allBullets.forEach(bulletKey => {
            const prevBullet = prevUpdate.bullets.find(b => b.owner + '_' + b.x + '_' + b.y === bulletKey);
            const nextBullet = nextUpdate.bullets.find(b => b.owner + '_' + b.x + '_' + b.y === bulletKey);
            
            if (prevBullet && nextBullet) {
                this.interpolatedBullets.push({
                    ...prevBullet,
                    x: prevBullet.x + (nextBullet.x - prevBullet.x) * alpha,
                    y: prevBullet.y + (nextBullet.y - prevBullet.y) * alpha
                });
            } else if (prevBullet) {
                this.interpolatedBullets.push(prevBullet);
            } else if (nextBullet) {
                this.interpolatedBullets.push(nextBullet);
            }
        });
        
        // Use interpolated data for rendering
        this.players = this.interpolatedPlayers;
        this.bullets = this.interpolatedBullets;
        // Clean up players/bullets that no longer exist on the server
        const serverPlayerIds = new Set(Object.keys(nextUpdate.players));
        Object.keys(this.predictedPlayers).forEach(pid => {
            if (!serverPlayerIds.has(pid)) delete this.predictedPlayers[pid];
        });
        // Apply client-side prediction for local player with smoothing reconciliation
        if (this.myId && this.predictedPlayers[this.myId]) {
            const serverPlayer = this.interpolatedPlayers[this.myId];
            const predictedPlayer = this.predictedPlayers[this.myId];
            if (serverPlayer) {
                // Check if server position is too different from prediction
                const distance = Math.hypot(serverPlayer.x - predictedPlayer.x, serverPlayer.y - predictedPlayer.y);
                if (distance > this.reconciliationThreshold) {
                    // Server caught cheating or major desync - snap to server position
                    this.predictedPlayers[this.myId] = { ...serverPlayer };
                    this.players[this.myId] = { ...serverPlayer };
                    // Optionally, log or show a warning
                } else {
                    // Smoothly lerp predicted position toward server position
                    const smoothing = 0.15; // 0 = no smoothing, 1 = instant snap
                    this.predictedPlayers[this.myId].x += (serverPlayer.x - predictedPlayer.x) * smoothing;
                    this.predictedPlayers[this.myId].y += (serverPlayer.y - predictedPlayer.y) * smoothing;
                    this.predictedPlayers[this.myId].angle = this.interpolateAngle(predictedPlayer.angle, serverPlayer.angle, smoothing);
                    // Use predicted for rendering
                    this.players[this.myId] = this.predictedPlayers[this.myId];
                }
            } else {
                // No server data yet, use prediction
                this.players[this.myId] = predictedPlayer;
            }
        }
    }
    
    interpolateAngle(prevAngle, nextAngle, alpha) {
        // Handle angle wrapping for smooth rotation
        let diff = nextAngle - prevAngle;
        if (diff > Math.PI) diff -= 2 * Math.PI;
        if (diff < -Math.PI) diff += 2 * Math.PI;
        return prevAngle + diff * alpha;
    }
    
    // updateEffects() { // Removed
    //     // Update screen shake
    //     if (this.screenShake > 0) {
    //         this.screenShake *= 0.9;
    //         if (this.screenShake < 0.1) this.screenShake = 0;
    //     }
        
    //     // Update flash effect
    //     if (this.flashEffect > 0) {
    //         this.flashEffect *= 0.95;
    //         if (this.flashEffect < 0.05) this.flashEffect = 0;
    //     }
        
    //     // Update particles
    //     this.particles = this.particles.filter(particle => {
    //         particle.x += particle.vx;
    //         particle.y += particle.vy;
    //         particle.life -= 1;
    //         particle.alpha *= 0.98;
    //         return particle.life > 0 && particle.alpha > 0.1;
    //     });

    //     // Update bullet impact shockwaves
    //     this.bulletImpacts = this.bulletImpacts.filter(impact => {
    //         impact.radius += 2.5;
    //         impact.alpha *= 0.92;
    //         return impact.radius < impact.maxRadius && impact.alpha > 0.05;
    //     });

    //     // Update kill popup timer
    //     if (this.killPopupTimer > 0) {
    //         this.killPopupTimer--;
    //     }
    //     // Update status message timer
    //     if (this.statusMessageTimer > 0) {
    //         this.statusMessageTimer--;
    //         if (this.statusMessageTimer === 0) {
    //             this.statusMessage = '';
    //             // this.updatePotOverlay(); // Removed
    //         }
    //     }
    //     const now = Date.now();
    //     this.deathSplats = this.deathSplats.filter(splat => {
    //         const age = (now - splat.time) / 1000;
    //         splat.alpha = Math.max(0, 1 - age / 10);
    //         return age < 10 && splat.alpha > 0.01;
    //     });
    // }
    
    // Remove the createParticles method and all calls to this.createParticles
    // In playSound, handlePlayerHit, handlePlayerKill, handlePlayerRespawn, spawnBulletImpactEffect, remove any this.createParticles calls

    // Add client-side collidesWithObstacle
    collidesWithObstacle(x, y, size) {
        return this.obstacles.some(obs =>
            x + size/2 > obs.x && x - size/2 < obs.x + obs.w &&
            y + size/2 > obs.y && y - size/2 < obs.y + obs.h
        );
    }

    // Remove resizeCanvas() method
    drawMinimap() {
        // Minimap config
        const mapW = 160, mapH = 160;
        const pad = 16;
        const x0 = pad, y0 = pad; // Top-left corner
        // Background
        this.ctx.save();
        this.ctx.globalAlpha = 0.75;
        this.ctx.fillStyle = '#fff';
        this.ctx.strokeStyle = '#bbb';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.roundRect(x0, y0, mapW, mapH, 14);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.globalAlpha = 1.0;
        // Map scale
        const scaleX = mapW / this.arenaWidth;
        const scaleY = mapH / this.arenaHeight;
        // Obstacles
        this.obstacles.forEach(obs => {
            this.ctx.save();
            this.ctx.fillStyle = '#B4B4B4';
            this.ctx.globalAlpha = 0.7;
            this.ctx.fillRect(
                x0 + obs.x * scaleX,
                y0 + obs.y * scaleY,
                obs.w * scaleX,
                obs.h * scaleY
            );
            this.ctx.restore();
        });
        // Other players (red shining dots)
        Object.entries(this.players).forEach(([id, player]) => {
            if (!player.isAlive) return;
            if (id === this.myId) return;
            const px = x0 + player.x * scaleX;
            const py = y0 + player.y * scaleY;
            this.ctx.save();
            // Shining effect
            const shine = 0.5 + 0.5 * Math.sin(Date.now() / 200 + player.x + player.y);
            this.ctx.globalAlpha = 0.7 + 0.3 * shine;
            this.ctx.beginPath();
            this.ctx.arc(px, py, 7, 0, Math.PI * 2);
            this.ctx.fillStyle = '#e53935';
            this.ctx.shadowColor = '#ff0000';
            this.ctx.shadowBlur = 12;
            this.ctx.fill();
            this.ctx.restore();
        });
        // Your player (green arrow)
        if (this.myId && this.players[this.myId]) {
            const me = this.players[this.myId];
            const px = x0 + me.x * scaleX;
            const py = y0 + me.y * scaleY;
            const angle = me.angle || 0;
            this.ctx.save();
            this.ctx.translate(px, py);
            this.ctx.rotate(angle + Math.PI/2); // Fix: arrow points the correct way
            // Sleek triangle pointer
            this.ctx.beginPath();
            this.ctx.moveTo(0, -8); // tip
            this.ctx.lineTo(5, 6);  // right base
            this.ctx.lineTo(0, 3);  // center base
            this.ctx.lineTo(-5, 6); // left base
            this.ctx.closePath();
            this.ctx.fillStyle = '#00c853';
            this.ctx.shadowColor = '#00e676';
            this.ctx.shadowBlur = 6;
            this.ctx.fill();
            this.ctx.restore();
        }
        // Minimap border
        this.ctx.save();
        this.ctx.lineWidth = 2.5;
        this.ctx.strokeStyle = '#888';
        this.ctx.beginPath();
        this.ctx.roundRect(x0, y0, mapW, mapH, 18);
        this.ctx.stroke();
        this.ctx.restore();
    }

    // Remove createPotOverlay, updatePotOverlay, getPotOverlayHTML, and all calls to them
    // Remove setStatusMessage(msg, seconds = 2)
    // Remove checkCashOutHold()

    // Add a quitToMenu method to emit playerQuit
    quitToMenu() {
        if (this.socket && this.socket.connected) {
            this.socket.emit('playerQuit');
        }
        // Optionally reload or redirect to menu
        window.location.href = 'menu.html';
    }

    #drawRoundedRect(x, y, w, h, r) {
        this.ctx.beginPath();
        this.ctx.moveTo(x + r, y);
        this.ctx.lineTo(x + w - r, y);
        this.ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        this.ctx.lineTo(x + w, y + h - r);
        this.ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        this.ctx.lineTo(x + r, y + h);
        this.ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        this.ctx.lineTo(x, y + r);
        this.ctx.quadraticCurveTo(x, y, x + r, y);
        this.ctx.closePath();
    }
}

// Expose TankGameClient globally for index.js to instantiate after DOM is ready
window.TankGameClient = TankGameClient;

// Remove any window.addEventListener('load', ...) that instantiates TankGameClient

// Remove all remaining direct DOM manipulation for UI elements that do not exist in the React app, such as gameOver, respawnTimer, killerName, fpsCounter, pingValue, quitOverlay, and quitBar. Only keep canvas/game logic and Socket.IO communication. Remove window.addEventListener('DOMContentLoaded', ...) at the end. 