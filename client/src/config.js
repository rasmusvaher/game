// client/src/config.js - Configuration for Privy and other settings

export const PRIVY_APP_ID = 'cmd65x2wt03gmld0mpfldjm07';

const CONFIG = {
    PRIVY_APP_ID: 'cmd65x2wt03gmld0mpfldjm07',
    // Solana network configuration
    SOLANA_NETWORK: 'mainnet-beta', // or 'devnet' for testing
    SOLANA_RPC_URL: "https://solana-mainnet.rpc.extrnode.com/4282db3b-a0fd-4b18-9deb-3ecd8da312ae",
    // Game settings
    BALANCE_UPDATE_INTERVAL: 30000, // 30 seconds
    REWARD_AMOUNT: 0.001, // SOL amount for rewards
};

// Export for use in other modules
window.GAME_CONFIG = CONFIG; 

export const SOLANA_RPC_URL = "https://solana-mainnet.rpc.extrnode.com/4282db3b-a0fd-4b18-9deb-3ecd8da312ae"; 