// client/src/privyWallet.js - Privy.io Integration for Tank Game

class PrivyWalletManager {
    constructor() {
        this.privy = null;
        this.user = null;
        this.wallet = null;
        this.solanaConnection = null;
        this.balance = 0;
        this.isInitialized = false;
        
        // Privy configuration
        this.config = {
            appId: window.GAME_CONFIG?.PRIVY_APP_ID || 'YOUR_PRIVY_APP_ID', // Use config or fallback
            config: {
                loginMethods: ['email', 'google', 'twitter'],
                appearance: {
                    theme: 'dark',
                    accentColor: '#ffd700',
                    showWalletLoginFirst: false,
                },
                defaultChain: 'solana',
                supportedChains: ['solana']
            }
        };
    }

    async initialize() {
        try {
            // Initialize Privy
            this.privy = new window.Privy(this.config);
            
            // Set up event listeners
            this.privy.on('user:login', (user) => {
                this.handleUserLogin(user);
            });

            this.privy.on('user:logout', () => {
                this.handleUserLogout();
            });

            // Check if user is already logged in
            if (this.privy.authenticated) {
                this.user = this.privy.user;
                await this.setupWallet();
            }

            this.isInitialized = true;
            console.log('✅ Privy wallet manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize Privy:', error);
            throw error;
        }
    }

    async handleUserLogin(user) {
        console.log('🔐 User logged in:', user);
        this.user = user;
        await this.setupWallet();
        this.updateUI();
    }

    handleUserLogout() {
        console.log('🔓 User logged out');
        this.user = null;
        this.wallet = null;
        this.balance = 0;
        this.updateUI();
    }

    async setupWallet() {
        if (!this.user) return;

        try {
            // Get the user's embedded wallet
            this.wallet = await this.user.wallet();
            
            // Set up Solana connection
            this.solanaConnection = new window.solanaWeb3.Connection(
                window.GAME_CONFIG?.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
                'confirmed'
            );

            // Get initial balance
            await this.updateBalance();
            
            console.log('💰 Wallet setup complete:', this.wallet.address);
        } catch (error) {
            console.error('❌ Failed to setup wallet:', error);
        }
    }

    async updateBalance() {
        if (!this.wallet || !this.solanaConnection) return;

        try {
            const balance = await this.solanaConnection.getBalance(this.wallet.address);
            this.balance = balance / 1e9; // Convert lamports to SOL
            console.log('💰 Balance updated:', this.balance, 'SOL');
        } catch (error) {
            console.error('❌ Failed to update balance:', error);
            this.balance = 0;
        }
    }

    async signTransaction(transactionData) {
        if (!this.wallet) {
            throw new Error('No wallet available');
        }

        try {
            // Create a dummy transaction for demonstration
            const transaction = new window.solanaWeb3.Transaction();
            
            // Add a simple transfer instruction (you can customize this)
            const transferInstruction = window.solanaWeb3.SystemProgram.transfer({
                fromPubkey: this.wallet.address,
                toPubkey: this.wallet.address, // Sending to self for demo
                lamports: 1000 // 0.000001 SOL
            });
            
            transaction.add(transferInstruction);
            
            // Sign the transaction
            const signedTransaction = await this.wallet.signTransaction(transaction);
            
            console.log('✍️ Transaction signed successfully');
            return signedTransaction;
        } catch (error) {
            console.error('❌ Failed to sign transaction:', error);
            throw error;
        }
    }

    async claimReward(amount = 0.001) {
        if (!this.wallet) {
            throw new Error('No wallet available');
        }

        try {
            // This is a demo function - in a real game, you'd integrate with your reward system
            console.log(`🎁 Claiming reward of ${amount} SOL...`);
            
            // Sign a dummy transaction to simulate reward claiming
            await this.signTransaction({
                type: 'reward_claim',
                amount: amount
            });
            
            // Update balance after claiming
            await this.updateBalance();
            
            return true;
        } catch (error) {
            console.error('❌ Failed to claim reward:', error);
            throw error;
        }
    }

    updateUI() {
        // Update menu UI if on menu page
        const menuContainer = document.querySelector('.menu-container');
        if (menuContainer) {
            this.updateMenuUI();
        }

        // Update game UI if on game page
        const gameContainer = document.getElementById('gameContainer');
        if (gameContainer) {
            this.updateGameUI();
        }
    }

    updateMenuUI() {
        const form = document.getElementById('menuForm');
        const errorMessage = document.getElementById('errorMessage');
        
        if (this.user && this.wallet) {
            // User is logged in - show wallet info and play button
            form.innerHTML = `
                <div class="wallet-info">
                    <div class="user-info">
                        <span class="username">${this.user.email || this.user.google?.email || 'Anonymous'}</span>
                        <span class="wallet-address">${this.wallet.address.slice(0, 6)}...${this.wallet.address.slice(-4)}</span>
                    </div>
                    <div class="balance-info">
                        <span class="balance-label">Balance:</span>
                        <span class="balance-value">${this.balance.toFixed(4)} SOL</span>
                    </div>
                    <button class="btn" id="playBtn" type="button">Play Game</button>
                    <button class="btn btn-secondary" id="logoutBtn" type="button">Logout</button>
                </div>
            `;
            
            // Add event listeners
            document.getElementById('playBtn').addEventListener('click', () => {
                window.location.href = `game.html?username=${encodeURIComponent(this.user.email || 'Player')}`;
            });
            
            document.getElementById('logoutBtn').addEventListener('click', () => {
                this.privy.logout();
            });
        } else {
            // User is not logged in - show login button
            form.innerHTML = `
                <button class="btn" id="loginBtn" type="button">Login with Privy</button>
            `;
            
            document.getElementById('loginBtn').addEventListener('click', () => {
                this.privy.login();
            });
        }
    }

    updateGameUI() {
        // Add wallet info to the game stats area
        const gameStats = document.getElementById('gameStats');
        if (gameStats && this.wallet) {
            // Add wallet info if not already present
            if (!document.getElementById('walletInfo')) {
                const walletInfo = document.createElement('div');
                walletInfo.id = 'walletInfo';
                walletInfo.className = 'stat-item';
                walletInfo.innerHTML = `
                    <span>Wallet:</span>
                    <span class="stat-value">${this.balance.toFixed(4)} SOL</span>
                `;
                gameStats.appendChild(walletInfo);
            } else {
                // Update existing wallet info
                const walletInfo = document.getElementById('walletInfo');
                walletInfo.innerHTML = `
                    <span>Wallet:</span>
                    <span class="stat-value">${this.balance.toFixed(4)} SOL</span>
                `;
            }
        }
    }

    // Public methods for external use
    isAuthenticated() {
        return this.user !== null && this.wallet !== null;
    }

    getUser() {
        return this.user;
    }

    getWallet() {
        return this.wallet;
    }

    getBalance() {
        return this.balance;
    }

    async refreshBalance() {
        await this.updateBalance();
        this.updateUI();
    }
}

// Export for use in other modules
window.PrivyWalletManager = PrivyWalletManager; 