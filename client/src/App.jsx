import React, { useEffect, useState, useRef, useCallback } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { useSolanaWallets } from "@privy-io/react-auth/solana";
import { PRIVY_APP_ID } from "./config";
import WalletInfo from "./WalletInfo.jsx";
import GameCanvas from "./GameCanvas.jsx";
import MenuScreen, { MenuPlayerModel } from "./MenuScreen.jsx";
import DeathScreen from "./DeathScreen.jsx";
import { Transaction, SystemProgram, PublicKey, Connection } from '@solana/web3.js';
import { TransactionMessage, VersionedTransaction } from '@solana/web3.js';

function LoadingScreen() {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let running = true;
    function animate() {
      setAngle(a => (a + 6) % 360);
      if (running) requestAnimationFrame(animate);
    }
    animate();
    return () => { running = false; };
  }, []);
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #23243a 60%, #181828 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999
    }}>
      <div style={{ filter: 'drop-shadow(0 4px 16px #0008)', marginBottom: 32 }}>
        <MenuPlayerModel angle={angle} />
      </div>
      <div style={{ color: '#ffd700', fontWeight: 700, fontSize: 28, letterSpacing: 1, textShadow: '0 2px 8px #0008' }}>
        Loading...
      </div>
    </div>
  );
}

function MainApp() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets, isConnected, ready: walletsReady, refresh: refreshWallets, createWallet } = useSolanaWallets();
  const [inGame, setInGame] = useState(false);
  const [isDead, setIsDead] = useState(false);
  const [killerName, setKillerName] = useState("");
  const [killerColor, setKillerColor] = useState("");
  const [deathTimer, setDeathTimer] = useState(5);
  // Remove username state
  // const [username, setUsername] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const deathTimerRef = useRef();
  // Remove fakeWalletBalance and related logic
  // Use Privy Solana wallet balance for all wallet displays and in-game logic
  // Remove: const [fakeWalletBalance, setFakeWalletBalance] = useState(100);
  // Remove: useEffect polling window.fakeWalletBalance
  // Remove: reloadWallet and related fetches
  // Instead, get balance from wallet object (from useSolanaWallets)

  // Solana wallet info
  const wallet = wallets?.[0];
  const walletReady = walletsReady && wallet && wallet.address;
  const walletAddress = wallet?.address || "";
  const solBalance = wallet
    ? wallet.balance !== undefined
      ? (wallet.balance / 1e9).toFixed(4)
      : "0.0000"
    : "-";

  const [manualSolBalance, setManualSolBalance] = useState('0.0000');
  const [manualBalanceLoading, setManualBalanceLoading] = useState(false);

  // Function to fetch balance directly from Solana
  // const fetchSolanaBalance = useCallback(async () => {
  //   if (!wallet || !wallet.address) return;
  //   setManualBalanceLoading(true);
  //   try {
  //     const { Connection, PublicKey } = window.solanaWeb3 || {};
  //     if (!Connection || !PublicKey) throw new Error('Solana web3.js not loaded');
  //     const connection = new Connection(wallet.network?.rpcUrl || 'https://api.mainnet-beta.solana.com', 'confirmed');
  //     const pubkey = new PublicKey(wallet.address);
  //     const lamports = await connection.getBalance(pubkey);
  //     setManualSolBalance((lamports / 1e9).toFixed(4));
  //   } catch (err) {
  //     setManualSolBalance('0.0000');
  //   }
  //   setManualBalanceLoading(false);
  // }, [wallet]);

  // REMOVE: Fetch on mount and when wallet changes
  // useEffect(() => {
  //   fetchSolanaBalance();
  // }, [fetchSolanaBalance]);

  const [backendSolBalance, setBackendSolBalance] = useState('0.0000');
  const [backendBalanceLoading, setBackendBalanceLoading] = useState(false);
  const [solUsdPrice, setSolUsdPrice] = useState(null);

  // Function to fetch balance and SOL/USD price from backend
  const fetchBackendBalance = useCallback(async () => {
    if (!user) return;
    setBackendBalanceLoading(true);
    try {
      const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
      const res = await fetch(`${API_BASE_URL}/api/get-wallet-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email })
      });
      let solBalance = 0;
      if (res.ok) {
        const data = await res.json();
        solBalance = data.walletBalance || 0;
        setBackendSolBalance(solBalance.toFixed(4));
      } else {
        setBackendSolBalance('0.0000');
      }
      // Fetch SOL/USD price from backend
      try {
        const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
        const priceRes = await fetch(`${API_BASE_URL}/api/sol-price`);
        const priceData = await priceRes.json();
        const price = Number(priceData?.price);
        setSolUsdPrice(!isNaN(price) && price > 0 ? price : null);
        console.log('Fetched SOL/USD price:', price);
      } catch (err) {
        setSolUsdPrice(null);
      }
    } catch (err) {
      setBackendSolBalance('0.0000');
      setSolUsdPrice(null);
    }
    setBackendBalanceLoading(false);
  }, [user]);

  // Fetch on mount and when user changes
  useEffect(() => {
    fetchBackendBalance();
  }, [fetchBackendBalance]);

  const [sessionPotSol, setSessionPotSol] = useState(null);
  const [hotWallet, setHotWallet] = useState(null);

  // Debug logging for wallet state
  useEffect(() => {
    console.log('Privy Authenticated:', authenticated);
    console.log('Wallets:', wallets);
    console.log('Wallet Connected:', isConnected);
    console.log('Wallet Ready:', walletsReady);
    console.log('Wallet Address:', walletAddress);
    console.log('Sol Balance:', solBalance);
  }, [authenticated, wallets, isConnected, walletsReady, walletAddress, solBalance]);

  // Add detailed logging for wallet creation and readiness
  useEffect(() => {
    console.log('[DEBUG] Authenticated:', authenticated);
    console.log('[DEBUG] walletsReady:', walletsReady);
    console.log('[DEBUG] wallets:', wallets);
    if (wallets && wallets.length > 0) {
      console.log('[DEBUG] wallet address:', wallets[0].address);
    }
  }, [authenticated, walletsReady, wallets]);

  // After wallet creation/refresh, log the result
  useEffect(() => {
    if (wallets && wallets.length > 0) {
      console.log('[DEBUG] Wallet is ready:', wallets[0].address);
    } else {
      console.log('[DEBUG] Wallet is NOT ready');
    }
  }, [wallets]);

  // Ensure Solana wallet exists after login
  useEffect(() => {
    async function ensureSolanaWallet() {
      if (authenticated && walletsReady && createWallet && (!wallets || wallets.length === 0)) {
        setWalletLoading(true);
        try {
          // Try to create wallet via Privy backend if missing
          if (user && user.id) {
            const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
            const res = await fetch(`${API_BASE_URL}/api/create-solana-wallet`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: user.id })
            });
            if (res.ok) {
              const data = await res.json();
              console.log('[WALLET] Created Solana wallet for user:', data.solanaWallet);
              if (refreshWallets) await refreshWallets();
            } else {
              console.log('[WALLET] Failed to create Solana wallet via backend');
            }
          } else {
          await createWallet();
          if (refreshWallets) await refreshWallets();
          }
        } catch (err) {
          console.error('Failed to create wallet:', err);
        } finally {
          setWalletLoading(false);
        }
      }
    }
    ensureSolanaWallet();
  }, [authenticated, walletsReady, wallet, createWallet, refreshWallets, user, wallets]);

  // Callback for TankGameClient to notify React of death
  const handlePlayerDeath = useCallback((killerName, killerColor) => {
    setIsDead(true);
    setKillerName(killerName);
    setKillerColor(killerColor);
    setDeathTimer(5);
    if (deathTimerRef.current) clearInterval(deathTimerRef.current);
    deathTimerRef.current = setInterval(() => {
      setDeathTimer(prev => {
        if (prev <= 1) {
          clearInterval(deathTimerRef.current);
          setIsDead(false);
          setInGame(false); // Return to menu
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Patch: After cashout, update menu wallet immediately and set a global variable
  const lastCashOutWallet = useRef(null);
  useEffect(() => {
    function handleCashOutResult(e) {
      if (e.detail && typeof e.detail.walletBalance === 'number') {
        // setFakeWalletBalance(e.detail.walletBalance); // Removed
        lastCashOutWallet.current = e.detail.walletBalance;
        // window.lastWalletBalance = e.detail.walletBalance; // GLOBAL // Removed
      }
    }
    window.addEventListener('cashOutResult', handleCashOutResult);
    return () => window.removeEventListener('cashOutResult', handleCashOutResult);
  }, []);

  // Fetch wallet balance from backend when menu is shown, unless we just cashed out
  useEffect(() => {
    async function fetchWalletBalance() {
      if (authenticated && !inGame && user) {
        setWalletLoading(true);
        // Use global wallet value if available
        // if (typeof window.lastWalletBalance === 'number') { // Removed
        //   setFakeWalletBalance(window.lastWalletBalance); // Removed
        //   console.log('[MENU] Using wallet from global lastWalletBalance:', window.lastWalletBalance); // Removed
        //   window.lastWalletBalance = null; // Removed
        //   setWalletLoading(false); // Removed
        //   return; // Removed
        // } // Removed
        const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
        const res = await fetch(`${API_BASE_URL}/api/get-wallet-balance`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, email: user.email })
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.walletBalance === 'number') {
            // setFakeWalletBalance(data.walletBalance); // Removed
            console.log('[MENU] Fetched wallet from Privy:', data.walletBalance);
          }
        }
        setWalletLoading(false);
      }
    }
    fetchWalletBalance();
  }, [authenticated, inGame, user]);

  // Withdraw handler
  const handleWithdraw = useCallback(async (destination, amount) => {
    // 1. Fetch SOL/USD price
    let solPrice = 0;
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
      const data = await res.json();
      solPrice = data?.solana?.usd || 0;
    } catch (err) {
      throw new Error('Failed to fetch SOL price. Try again later.');
    }
    if (!solPrice) throw new Error('Could not get SOL price.');
    // 2. Validate minimum $1 in SOL
    if (amount * solPrice < 1) {
      throw new Error('Minimum withdraw is $1 in SOL.');
    }
    // 3. Use Privy Solana wallet to send transaction
    const wallet = wallets?.[0];
    if (!wallet || !wallet.signAndSendTransaction) {
      throw new Error('Wallet not ready.');
    }
    try {
      // Use Solana web3.js to create transaction
      const { Connection, PublicKey, SystemProgram, Transaction } = window.solanaWeb3 || {};
      if (!Connection || !PublicKey || !SystemProgram || !Transaction) {
        throw new Error('Solana web3.js not loaded.');
      }
      const connection = new Connection(wallet.network?.rpcUrl || 'https://api.mainnet-beta.solana.com', 'confirmed');
      const fromPubkey = new PublicKey(wallet.address);
      const toPubkey = new PublicKey(destination);
      const lamports = Math.floor(amount * 1e9);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
      );
      tx.feePayer = fromPubkey;
      const { blockhash } = await connection.getRecentBlockhash();
      tx.recentBlockhash = blockhash;
      // Sign and send
      const signed = await wallet.signTransaction(tx);
      const txid = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(txid, 'confirmed');
      return true;
    } catch (err) {
      throw new Error('Withdraw failed: ' + (err.message || err));
    }
  }, [wallets]);

  // Join for $1 handler (real-time SOL conversion and backend session)
  const handleJoinForDollar = useCallback(async () => {
    // 1. Fetch SOL/USD price from backend
    let solPrice = 0;
    try {
      const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
      const res = await fetch(`${API_BASE_URL}/api/sol-price`);
      const data = await res.json();
      solPrice = data?.price || 0;
      window.lastSolPrice = solPrice;
    } catch (err) {
      throw new Error('Failed to fetch SOL price. Try again later.');
    }
    if (!solPrice) throw new Error('Could not get SOL price.');
    // 2. Call backend to get entry fee in SOL and hot wallet
    let potSol = 0; // Set entry fee to 0
    let hotWalletAddr = null;
    try {
      const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
      const joinRes = await fetch(`${API_BASE_URL}/api/join-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, solUsdPrice: solPrice })
      });
      if (!joinRes.ok) throw new Error('Failed to start game session');
      const joinData = await joinRes.json();
      // potSol = joinData.potSol; // Ignore backend value, force 0
      hotWalletAddr = joinData.hotWallet;
      setSessionPotSol(potSol);
      setHotWallet(hotWalletAddr);
    } catch (err) {
      throw new Error('Failed to start game session: ' + (err.message || err));
    }
    // 3. Bypass transaction, immediately join game
    setInGame(true);
    return true;
  }, [wallets, user, setInGame]);

  // Cashout handler
  const handleCashout = useCallback(async () => {
    if (!user) return;
    try {
      const API_BASE_URL = window.API_BASE_URL || 'https://game-ucr1.onrender.com'; // Replace with your Render backend URL
      const res = await fetch(`${API_BASE_URL}/api/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      if (!res.ok) throw new Error('Failed to cash out');
      const data = await res.json();
      setSessionPotSol(null);
      setHotWallet(null);
      return data;
    } catch (err) {
      throw new Error('Failed to cash out: ' + (err.message || err));
    }
  }, [user]);

  // Show loading screen until everything is ready
  if (!ready || walletLoading) {
    return <LoadingScreen />;
  }

  if (!authenticated) {
    return (
      <MenuScreen
        onPlay={() => setInGame(true)}
        onLogin={login}
        onLogout={logout}
        onSignup={login}
        isLoggedIn={authenticated}
        walletConnected={walletReady}
        walletAddress={walletAddress}
        solBalance={backendSolBalance}
        solUsdPrice={solUsdPrice}
        walletLoading={backendBalanceLoading}
        onReloadWallet={fetchBackendBalance}
        onWithdraw={handleWithdraw}
        onJoinForDollar={handleJoinForDollar}
      />
    );
  }

  if (!inGame) {
    return (
      <MenuScreen
        onPlay={() => setInGame(true)}
        onLogin={login}
        onLogout={logout}
        onSignup={login}
        isLoggedIn={authenticated}
        walletConnected={walletReady}
        walletAddress={walletAddress}
        solBalance={backendSolBalance}
        solUsdPrice={solUsdPrice}
        walletLoading={backendBalanceLoading}
        onReloadWallet={fetchBackendBalance}
        onWithdraw={handleWithdraw}
        onJoinForDollar={handleJoinForDollar}
      />
    );
  }

  // In game: show game canvas and overlays
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      {/* Removed Quit to Menu button and WalletInfo for fullscreen game */}
      <GameCanvas onPlayerDeath={handlePlayerDeath} isDead={isDead} privyUserId={user?.id} email={user?.email} />
      {isDead && <DeathScreen killerName={killerName} killerColor={killerColor} timeLeft={deathTimer} />}
    </div>
  );
}

export default function App() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "twitter"],
        appearance: {
          theme: "dark",
          accentColor: "#ffd700",
        },
        // Only allow Phantom and Solflare
        externalWallets: {
          phantom: true,
          solflare: true,
        },
      }}
    >
      <MainApp />
    </PrivyProvider>
  );
} 