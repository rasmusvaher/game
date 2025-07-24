import React, { useState, useEffect, useRef } from "react";

function AnimatedGridBackground() {
  const canvasRef = useRef();
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 40;
      const y = (e.clientY / window.innerHeight - 0.5) * 40;
      setOffset({ x, y });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#232424";
    ctx.fillRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = 0.13;
    ctx.strokeStyle = "#B4B4B4";
    ctx.lineWidth = 1;
    const gridSpacing = 40;
    const ox = offset.x % gridSpacing;
    const oy = offset.y % gridSpacing;
    for (let x = ox; x < width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = oy; y < height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }, [offset]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 32 }}>
      <div style={{
        width: 24, height: 24, border: '3px solid #fff3', borderTop: '3px solid #ffd700', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto'
      }} />
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function RefreshIcon({ onClick, loading }) {
  return (
    <span
      onClick={loading ? undefined : onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 10,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 0.85,
        fontSize: 20,
        transition: 'opacity 0.18s',
        userSelect: 'none',
      }}
      title={loading ? 'Refreshing...' : 'Reload balance'}
      tabIndex={0}
      role="button"
    >
      <svg
        width="22" height="22" viewBox="0 0 22 22" fill="none"
        style={{ display: 'block', animation: loading ? 'spin 0.8s linear infinite' : undefined }}
      >
        <path d="M17.657 6.343A8 8 0 1 0 19 11" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M19 4v7h-7" stroke="#ffd700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function MenuPlayerModel({ angle = 0 }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    // Draw gun (shorter rectangle)
    ctx.save();
    ctx.fillStyle = '#444';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.rect(20, -10, 38, 20); // gun body (shorter)
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    // Draw hands (small circles)
    ctx.save();
    ctx.fillStyle = '#f9c97a';
    ctx.beginPath();
    ctx.arc(28, -18, 13, 0, 2 * Math.PI); // top hand
    ctx.arc(28, 18, 13, 0, 2 * Math.PI); // bottom hand
    ctx.fill();
    ctx.restore();
    // Draw head (big circle)
    ctx.save();
    ctx.fillStyle = '#f9c97a';
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 38, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.restore();
  }, [angle]);
  return (
    <canvas
      id="menuPlayerModel"
      ref={canvasRef}
      width={110}
      height={110}
      style={{ display: 'block', background: 'none', pointerEvents: 'none', userSelect: 'none' }}
    />
  );
}

export default function MenuScreen({
  onPlay,
  onLogin,
  onLogout,
  onSignup,
  isLoggedIn,
  walletConnected,
  walletAddress,
  solBalance,
  solUsdPrice,
  walletLoading,
  onReloadWallet,
  onWithdraw, // <-- new prop
  onJoinForDollar, // <-- new prop
  onAudioReady // <-- add this prop, make it optional
}) {
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioCtxRef = useRef();
  const bufferRef = useRef();
  const sourceRef = useRef();
  const gainRef = useRef();
  const [loadingAudio, setLoadingAudio] = useState(true);
  const [loading, setLoading] = useState(false);
  const [playerAngle, setPlayerAngle] = useState(0);
  const targetAngleRef = useRef(0);
  const animationFrameRef = useRef();
  const playerImgRef = useRef();

  // Local loading state for balance reload
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Handle reload with local loading state for balance only
  const handleReload = async () => {
    if (balanceLoading) return;
    setBalanceLoading(true);
    try {
      await onReloadWallet?.();
    } finally {
      setTimeout(() => setBalanceLoading(false), 600); // debounce for UX
    }
  };

  // Load and play music using Web Audio API
  useEffect(() => {
    let isMounted = true;
    async function setupAudio() {
      if (!window.AudioContext && !window.webkitAudioContext) return;
      setLoadingAudio(true);
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioCtxRef.current = ctx;
        gainRef.current = ctx.createGain();
        gainRef.current.gain.value = 0.375; // 25% lower than 0.5
        gainRef.current.connect(ctx.destination);
        // Fetch and decode audio
        const response = await fetch('assets/lobbymusic.wav');
        if (!response.ok) throw new Error('Audio file not found');
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        bufferRef.current = audioBuffer;
        setAudioReady(true);
        setLoadingAudio(false);
        if (!muted && isMounted) {
          playLoop();
        }
      } catch (err) {
        setAudioReady(false);
        setLoadingAudio(false);
        if (typeof onAudioReady === 'function') {
          onAudioReady(true); // Allow app to proceed even if audio fails
        }
      }
    }
    setupAudio();
    return () => {
      isMounted = false;
      stopLoop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
    // eslint-disable-next-line
  }, []);

  // Play/stop on mute toggle
  useEffect(() => {
    if (!audioReady) return;
    if (muted) {
      stopLoop();
    } else {
      playLoop();
    }
    // eslint-disable-next-line
  }, [muted, audioReady]);

  function playLoop() {
    stopLoop();
    if (!audioCtxRef.current || !bufferRef.current) return;
    const ctx = audioCtxRef.current;
    const source = ctx.createBufferSource();
    source.buffer = bufferRef.current;
    source.loop = true;
    source.connect(gainRef.current);
    sourceRef.current = source;
    source.start(0);
  }
  function stopLoop() {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch (e) {}
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
  }

  // Unlock audio on user gesture
  useEffect(() => {
    function unlockAudio() {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    }
    window.addEventListener('pointerdown', unlockAudio);
    window.addEventListener('keydown', unlockAudio);
    window.addEventListener('click', unlockAudio);
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('click', unlockAudio);
    };
  }, []);

  // Mouse tracking for player model rotation (instant, no animation)
  useEffect(() => {
    function handleMouseMove(e) {
      const canvas = document.getElementById('menuPlayerModel');
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      setPlayerAngle(angle);
    }
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Call onAudioReady when audio is ready, or immediately if unsupported
  useEffect(() => {
    if ((window.AudioContext || window.webkitAudioContext)) {
      if (audioReady && typeof onAudioReady === 'function') {
        onAudioReady(true);
      }
    } else {
      if (typeof onAudioReady === 'function') {
        onAudioReady(true);
      }
    }
    return () => {
      if (typeof onAudioReady === 'function') {
        onAudioReady(false);
      }
    };
  }, [audioReady, onAudioReady]);

  // Add at the top:
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawError, setWithdrawError] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const minSol = 0.01; // Placeholder: $1 in SOL, update with price API
  const [withdrawSuccess, setWithdrawSuccess] = useState(false);
  const [copyMsg, setCopyMsg] = useState("");

  // Add state for join confirmation and error
  const [showJoinConfirm, setShowJoinConfirm] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [joining, setJoining] = useState(false);

  // In the MenuScreen component, before rendering, ensure solBalance is a number
  const safeSolBalance = (typeof solBalance === 'number') ? solBalance : parseFloat(solBalance);
  const displaySolBalance = (!isNaN(safeSolBalance) && isFinite(safeSolBalance)) ? safeSolBalance.toFixed(4) : '0.0000';

  // In the MenuScreen component, ensure displaySolBalance is a number for USD calculation
  const solBalanceNum = parseFloat(displaySolBalance);

  // Calculate the entry fee in SOL
  const entryFeeSol = solUsdPrice && typeof solUsdPrice === 'number' && solUsdPrice > 0 ? (1 / solUsdPrice) : 0;

  return (
    <div style={{ minHeight: "100vh", minWidth: "100vw", height: "100vh", width: "100vw", position: "relative", fontFamily: "Segoe UI, Arial, sans-serif", overflow: "hidden" }}>
      <style>{`
        html, body, #root {
          height: 100vh !important;
          width: 100vw !important;
          overflow: hidden !important;
        }
      `}</style>
      <AnimatedGridBackground />
      {/* Menu music audio (Web Audio API fallback message) */}
      {loadingAudio && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', textAlign: 'center', color: '#ffd700', zIndex: 100 }}>
          Loading music...
        </div>
      )}
      {!window.AudioContext && !window.webkitAudioContext && (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', textAlign: 'center', color: '#ffd700', zIndex: 100 }}>
          Your browser does not support the Web Audio API. Music may not play smoothly.
        </div>
      )}
      {/* Auth Buttons Top Right */}
      <div style={{
        position: "absolute",
        top: 32,
        right: 40,
        zIndex: 10,
        display: "flex",
        gap: 16,
        alignItems: "center"
      }}>
        {!isLoggedIn ? (
          <>
            <button className="btn auth-btn" style={{ ...authBtnStyle, width: 'auto', minWidth: 90, padding: '10px 22px', marginBottom: 0 }} onClick={onLogin}>Login</button>
            <button className="btn auth-btn" style={{ ...authBtnStyle, width: 'auto', minWidth: 90, padding: '10px 22px', marginBottom: 0 }} onClick={onSignup}>Sign Up</button>
          </>
        ) : (
          <button className="btn auth-btn" style={{ ...authBtnStyle, width: 'auto', minWidth: 90, padding: '10px 22px', marginBottom: 0 }} onClick={onLogout}>Logout</button>
        )}
      </div>
      {/* Title at ~10% from top, centered */}
      <div style={{
        position: "absolute",
        top: "8%",
        left: 0,
        width: "100vw",
        textAlign: "center",
        zIndex: 3,
        pointerEvents: "none",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <style>{`
          .blood-drip {
            animation: dripAnim 2.2s infinite cubic-bezier(.4,1.6,.6,1);
            transform-origin: top center;
          }
          @keyframes dripAnim {
            0% { transform: scaleY(1) translateY(0); opacity: 1; }
            60% { transform: scaleY(1.1) translateY(2px); opacity: 1; }
            80% { transform: scaleY(1.2) translateY(8px); opacity: 0.85; }
            100% { transform: scaleY(1) translateY(0); opacity: 1; }
          }
        `}</style>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 0, position: 'relative' }}>
          <span style={{
            fontFamily: 'Impact, Arial Black, Arial, sans-serif',
            fontWeight: 900,
            fontSize: 68,
            color: '#fff',
            letterSpacing: 4,
            textShadow: '0 2px 8px #000',
            position: 'relative',
        zIndex: 2,
            display: 'inline-block',
            lineHeight: 1.1,
          }}>
            {
              [...'GUN DEATHMATCH'].map((char, i) => (
                (i >= 4 && i < 9 && char !== ' ')
                  ? <span key={i} style={{ position: 'relative', display: 'inline-block', marginRight: 2, color: '#b3001b', textShadow: '0 2px 8px #000, 0 0px 12px #b3001b' }}>
                      {char}
                      <svg className="blood-drip" width="22" height="32" style={{ position: 'absolute', left: '50%', top: 44, transform: 'translateX(-50%)', zIndex: 2 }} viewBox="0 0 22 32">
                        <path d="M11 0 Q13 14 11 32 Q9 14 11 0" fill="#b3001b" stroke="#b3001b" strokeWidth="1.5" />
                        <ellipse cx="11" cy="29" rx="5" ry="3.5" fill="#b3001b" />
                      </svg>
                    </span>
                  : <span key={i} style={{ marginRight: 2 }}>{char}</span>
              ))
            }
            {/* Alpha badge */}
            <span style={{
              position: 'absolute',
              right: '-90px',
              bottom: '-28px',
              background: '#fff',
              color: '#ff2a2a',
              fontWeight: 900,
              fontSize: 22,
              padding: '4px 18px',
              borderRadius: 12,
              boxShadow: '0 2px 12px #ffd70033',
              transform: 'rotate(-22deg)',
              letterSpacing: 2,
              zIndex: 10,
              border: '2.5px solid #ff2a2a',
              textShadow: 'none',
              pointerEvents: 'none',
            }}>
              Alpha!
            </span>
          </span>
        </div>
      </div>
      {/* Model player character below title, centered and rotatable */}
      <div style={{
        position: "absolute",
        top: "calc(10% + 70px)",
        left: 0,
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        zIndex: 4,
        pointerEvents: "none"
      }}>
        <div style={{ filter: 'drop-shadow(0 4px 16px #0008)' }}>
          <MenuPlayerModel angle={playerAngle} />
        </div>
      </div>
      {/* Center Card, shifted down for more space below model */}
      <div style={{
        position: "absolute",
        top: "calc(10% + 180px)",
        left: 0,
        width: "100vw",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        zIndex: 2,
        pointerEvents: "none"
      }}>
        <div style={{
          background: "rgba(30,30,40,0.35)",
          borderRadius: 22,
          boxShadow: "0 0 40px 8px rgba(0,0,0,0.18)",
          padding: "44px 32px 32px 32px",
          minWidth: 320,
          maxWidth: 400,
          width: "90vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 2,
          position: "relative",
          backdropFilter: "blur(18px)",
          border: "1.5px solid #fff2",
          pointerEvents: "auto"
        }}>
          {/* Replace Play button with Join for $1 */}
          <button
            className="btn play-btn"
            style={{ ...playBtnStyle, marginBottom: 36, width: "100%", opacity: walletLoading ? 0.6 : 1 }}
            onClick={() => {
              setJoinError("");
              if (walletLoading) {
                setJoinError("Wallet is loading. Please wait...");
                return;
              }
              setShowJoinConfirm(true);
            }}
            disabled={walletLoading}
          >
            {walletLoading ? 'Connecting Wallet...' : 'Join for $1'}
          </button>
          {joinError && (
            <div style={{ color: '#ff2a2a', fontWeight: 600, fontSize: 16, margin: '12px 0', textAlign: 'center', background: '#23243a', borderRadius: 8, padding: 12, boxShadow: '0 2px 12px #b3001b33' }}>{joinError}</div>
          )}
          {showJoinConfirm && (
            <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(24,24,40,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#23243a', borderRadius: 16, padding: 32, minWidth: 340, boxShadow: '0 4px 32px #000a', color: '#fff', position: 'relative' }}>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 18 }}>Join Game</div>
                <div style={{ fontSize: 16, marginBottom: 18 }}>Join the game for $1? This will be deducted from your wallet.</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      setJoining(true);
                      try {
                        await onJoinForDollar();
                        setShowJoinConfirm(false);
                      } catch (err) {
                        setJoinError(err.message || "Failed to join game.");
                      }
                      setJoining(false);
                    }}
                    style={{ background: '#ffd700', color: '#23243a', fontWeight: 700, border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 16, cursor: 'pointer', opacity: joining ? 0.6 : 1 }}
                    disabled={joining}
                  >
                    {joining ? 'Joining...' : 'Confirm'}
                  </button>
                  <button onClick={() => setShowJoinConfirm(false)} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 16, cursor: 'pointer' }}>Cancel</button>
                </div>
              </div>
            </div>
          )}
          {/* Wallet Box - glassmorphic */}
          <div style={{
            marginTop: 0,
            width: "100%",
            background: "rgba(255,255,255,0.13)",
            border: "1.5px solid #fff3",
            borderRadius: 16,
            padding: 22,
            color: "#fff",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 2px 18px 0px #ffd70022",
            zIndex: 2,
            position: "relative",
            backdropFilter: "blur(12px)",
          }}>
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 10 }}>
              <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1, color: "#ffd700", marginRight: 2 }}>Wallet</span>
              <RefreshIcon onClick={handleReload} loading={balanceLoading} />
            </div>
            {/* In the wallet box, show both SOL and USD balance */}
            <div style={{ fontSize: 18, marginBottom: 10, color: '#fff', fontWeight: 600, letterSpacing: 0.5, textAlign: 'center' }}>
              Balance: <span style={{ color: "#00ffae", fontWeight: 700 }}>${displaySolBalance}</span> SOL
              {solUsdPrice && typeof solUsdPrice === 'number' && !isNaN(solUsdPrice) && !isNaN(solBalanceNum) ? (
                <span style={{ color: '#ffd700', fontWeight: 700, marginLeft: 12 }}>
                  (${(solBalanceNum * solUsdPrice).toFixed(2)} USD)
                </span>
              ) : (
                <span style={{ color: '#ffd700', fontWeight: 700, marginLeft: 12 }}>
                  (-- USD)
              </span>
              )}
            </div>
            <div style={{ marginTop: 12, width: '100%', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#ffd700', marginBottom: 4 }}>
                Deposit SOL to your wallet:
              </div>
              <div style={{ fontFamily: 'monospace', background: '#181828', borderRadius: 6, padding: '4px 10px', display: 'inline-block', marginBottom: 6 }}>
                {walletAddress}
                <button style={{ marginLeft: 8, fontSize: 13, padding: '2px 8px', borderRadius: 4, border: 'none', background: '#ffd700', color: '#23243a', cursor: 'pointer' }} onClick={() => {
                  navigator.clipboard.writeText(walletAddress);
                  setCopyMsg('Copied!');
                  setTimeout(() => setCopyMsg(''), 1200);
                }}>Copy</button>
                {copyMsg && <span style={{ marginLeft: 8, color: '#00ffae', fontSize: 13 }}>{copyMsg}</span>}
              </div>
              <div style={{ fontSize: 13, color: '#aaa', marginBottom: 8 }}>
                Send at least $1 in SOL to deposit.
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Withdraw modal */}
      {showWithdraw && (
        <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(24,24,40,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#23243a', borderRadius: 16, padding: 32, minWidth: 340, boxShadow: '0 4px 32px #000a', color: '#fff', position: 'relative' }}>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 18 }}>Withdraw SOL</div>
            {withdrawSuccess ? (
              <div style={{ color: '#00ffae', fontWeight: 700, fontSize: 17, marginBottom: 18 }}>Withdrawal successful!</div>
            ) : (
              <>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 15 }}>Destination Address</label>
                  <input type="text" value={withdrawAddress} onChange={e => setWithdrawAddress(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #ffd700', marginTop: 4, fontSize: 15 }} placeholder="Solana address" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 15 }}>Amount (SOL)</label>
                  <input type="number" min={minSol} step="0.0001" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1.5px solid #ffd700', marginTop: 4, fontSize: 15 }} placeholder="e.g. 0.1" />
                </div>
                {withdrawError && <div style={{ color: '#ff2a2a', marginBottom: 10 }}>{withdrawError}</div>}
              </>
            )}
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              {!withdrawSuccess && <button
                onClick={async () => {
                  setWithdrawError("");
                  setWithdrawSuccess(false);
                  if (!withdrawAddress || withdrawAddress.length < 32) {
                    setWithdrawError("Enter a valid Solana address.");
                    return;
                  }
                  const amt = parseFloat(withdrawAmount);
                  if (isNaN(amt) || amt < minSol) {
                    setWithdrawError(`Minimum withdraw is $1 in SOL (${minSol} SOL).`);
                    return;
                  }
                  setWithdrawing(true);
                  try {
                    await onWithdraw(withdrawAddress, amt);
                    setWithdrawSuccess(true);
                    setWithdrawAddress("");
                    setWithdrawAmount("");
                  } catch (err) {
                    setWithdrawError(err.message || "Withdraw failed.");
                  }
                  setWithdrawing(false);
                }}
                style={{ background: '#ffd700', color: '#23243a', fontWeight: 700, border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 16, cursor: 'pointer', opacity: withdrawing ? 0.6 : 1 }}
                disabled={withdrawing || !withdrawAddress || withdrawAddress.length < 32 || !withdrawAmount || isNaN(parseFloat(withdrawAmount)) || parseFloat(withdrawAmount) < minSol}
              >
                {withdrawing ? <span style={{ display: 'inline-block', width: 18, height: 18, border: '3px solid #fff3', borderTop: '3px solid #23243a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginRight: 8 }} /> : null}
                {withdrawing ? 'Withdrawing...' : 'Withdraw'}
              </button>}
              <button onClick={() => {
                setShowWithdraw(false);
                setWithdrawAddress("");
                setWithdrawAmount("");
                setWithdrawError("");
                setWithdrawSuccess(false);
              }} style={{ background: '#444', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 22px', fontSize: 16, cursor: 'pointer' }}>Close</button>
            </div>
            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      )}
      {/* Button Styles */}
      <style>{`
        .btn {
          background: #23243a;
          color: #fff;
          font-size: 1.1rem;
          font-weight: bold;
          border: none;
          border-radius: 10px;
          padding: 14px 0;
          width: 100%;
          margin-bottom: 8px;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
          transition: background 0.18s, box-shadow 0.18s, transform 0.13s, color 0.18s;
        }
        .btn:hover, .btn:focus {
          background: #2d2e4a;
          color: #ffd700;
          box-shadow: 0 4px 16px #ffd70022;
          transform: translateY(-2px) scale(1.03);
        }
        .btn:active {
          background: #181828;
          color: #ffd700;
          transform: scale(0.97);
        }
        .btn:disabled {
          background: #444;
          color: #aaa;
          cursor: not-allowed;
        }
        .play-btn {
          background: linear-gradient(90deg, #ffd700 60%, #fff 100%);
          color: #23243a;
          font-size: 1.3rem;
          font-weight: 900;
          letter-spacing: 1px;
          box-shadow: 0 2px 12px #ffd70033;
        }
        .play-btn:hover, .play-btn:focus {
          background: linear-gradient(90deg, #fff 0%, #ffd700 100%);
          color: #181828;
        }
        .play-btn:active {
          background: #ffd700;
          color: #23243a;
        }
        .auth-btn {
          background: #23243a;
          color: #fff;
        }
        .auth-btn:hover, .auth-btn:focus {
          background: #ffd70022;
          color: #ffd700;
        }
        .auth-btn:active {
          background: #181828;
          color: #ffd700;
        }
      `}</style>
    </div>
  );
}

const playBtnStyle = {
  width: "100%",
  padding: "18px 0",
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(90deg, #ffd700 60%, #fff 100%)",
  color: "#23243a",
  fontSize: "1.3rem",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background 0.18s, box-shadow 0.18s, transform 0.13s, color 0.18s",
  boxShadow: "0 2px 8px #ffd70033",
  marginBottom: 8,
};

const authBtnStyle = {
  width: "100%",
  padding: "14px 0",
  borderRadius: 10,
  border: "none",
  background: "#23243a",
  color: "#fff",
  fontSize: "1.1rem",
  fontWeight: "bold",
  cursor: "pointer",
  transition: "background 0.18s, box-shadow 0.18s, transform 0.13s, color 0.18s",
  boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
  marginBottom: 0,
};

export { MenuPlayerModel }; 