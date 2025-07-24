console.log('Menu JS loaded');
// client/src/menu.js - Privy Integration for Tank Deathmatch Menu

document.addEventListener('DOMContentLoaded', async () => {
    const errorMessage = document.getElementById('errorMessage');
    
    // Initialize Privy wallet manager
    window.walletManager = new PrivyWalletManager();
    
    try {
        await window.walletManager.initialize();
        
        // Set up periodic balance updates
        setInterval(async () => {
            if (window.walletManager.isAuthenticated()) {
                await window.walletManager.refreshBalance();
            }
        }, 30000); // Update balance every 30 seconds
        
        // Fetch fake in-game wallet balance from backend
        async function fetchFakeWalletBalance() {
            try {
                const res = await fetch('/api/fake-wallet-balance');
                if (!res.ok) throw new Error('Failed to fetch fake wallet balance');
                const data = await res.json();
                window.fakeWalletBalance = data.balance;
            } catch (err) {
                console.error('Failed to fetch fake wallet balance:', err);
                window.fakeWalletBalance = null;
            }
        }

        // Periodically refresh fake wallet balance
        setInterval(fetchFakeWalletBalance, 10000); // every 10s
        fetchFakeWalletBalance();

        console.log('✅ Menu initialized with Privy integration');
    } catch (error) {
        console.error('❌ Failed to initialize Privy in menu:', error);
        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize wallet. Please refresh the page.';
        }
    }
}); 