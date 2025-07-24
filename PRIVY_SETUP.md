# Privy.io Integration Setup Guide

This guide will help you set up Privy.io authentication and wallet management for your tank game.

## Prerequisites

1. Node.js and npm installed
2. A Privy.io account (sign up at https://console.privy.io)

## Setup Steps

### 1. Install Dependencies

First, install the new dependencies in the client directory:

```bash
cd client
npm install
```

### 2. Get Your Privy App ID

1. Go to [Privy Console](https://console.privy.io)
2. Create a new app or select an existing one
3. Copy your App ID from the dashboard

### 3. Configure the App

Edit `client/src/config.js` and replace `YOUR_PRIVY_APP_ID` with your actual Privy App ID:

```javascript
const CONFIG = {
    PRIVY_APP_ID: 'clt_your_actual_app_id_here',
    // ... other settings
};
```

### 4. Configure Privy App Settings

In your Privy Console:

1. **Login Methods**: Enable the login methods you want (email, Google, Twitter)
2. **Chains**: Add Solana as a supported chain
3. **Redirect URLs**: Add your local development URL (e.g., `http://localhost:8000`)
4. **App Settings**: Configure appearance and other settings as needed

### 5. Start the Application

```bash
# Terminal 1 - Start the server
cd server
npm start

# Terminal 2 - Start the client (if using webpack dev server)
cd client
npm start
```

Or simply start the server and access the game at `http://localhost:8000`

## Features

### Authentication
- Users can login with email, Google, or Twitter
- No wallet extension required
- Embedded wallet creation and management

### Wallet Management
- Automatic Solana wallet creation
- Real-time SOL balance display
- Wallet address display in UI

### Game Integration
- Wallet info displayed in game stats
- Claim reward button appears after kills
- Transaction signing for rewards (demo)

### UI Updates
- **Menu**: Shows login button or wallet info based on authentication status
- **Game**: Displays wallet balance in the top stats bar
- **Rewards**: Claim button appears after successful kills

## File Structure

```
client/src/
├── config.js          # Configuration settings
├── privyWallet.js     # Privy wallet manager
├── menu.js           # Updated menu with Privy integration
├── game.js           # Updated game with wallet features
├── menu.html         # Updated menu UI
└── game.html         # Updated game UI
```

## Customization

### Changing Login Methods
Edit the `loginMethods` array in `privyWallet.js`:

```javascript
loginMethods: ['email', 'google', 'twitter', 'discord']
```

### Changing Network
Edit `config.js` to use devnet for testing:

```javascript
SOLANA_NETWORK: 'devnet',
SOLANA_RPC_URL: 'https://api.devnet.solana.com',
```

### Customizing Rewards
Edit the reward amount in `config.js`:

```javascript
REWARD_AMOUNT: 0.005, // 0.005 SOL per reward
```

## Troubleshooting

### Common Issues

1. **"Failed to initialize Privy"**
   - Check that your App ID is correct in `config.js`
   - Ensure your Privy app is properly configured
   - Check browser console for detailed error messages

2. **"No wallet available"**
   - Make sure the user is logged in
   - Check that Solana is enabled in your Privy app settings

3. **Balance not updating**
   - Check network connectivity
   - Verify RPC URL is correct
   - Check browser console for errors

### Debug Mode

Enable debug logging by adding this to your browser console:

```javascript
localStorage.setItem('privy_debug', 'true');
```

## Security Notes

- This is a demo implementation
- For production, implement proper server-side validation
- Consider rate limiting for reward claims
- Add proper error handling and user feedback
- Implement proper transaction validation

## Next Steps

1. **Server Integration**: Add server-side wallet validation
2. **Real Rewards**: Implement actual SOL transfers
3. **Leaderboards**: Add wallet-based leaderboards
4. **NFTs**: Integrate NFT rewards or achievements
5. **Tournaments**: Add wallet-based tournament systems 