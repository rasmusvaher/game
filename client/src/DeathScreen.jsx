import React from "react";

export default function DeathScreen({ killerName, killerColor, timeLeft }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.95)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      fontFamily: 'Segoe UI, Arial, sans-serif',
    }}>
      <h2 style={{ color: '#ff0000', fontSize: '2.2rem', marginBottom: 20 }}>💀 YOU DIED!</h2>
      <div style={{ fontSize: '1.2rem', color: '#ffd700', marginBottom: 16 }}>
        Killed by: <span style={{ color: killerColor || '#ffd700' }}>{killerName || 'Unknown'}</span>
      </div>
      <div style={{ fontSize: '1.1rem', color: '#ffd700', marginBottom: 24 }}>
        Spectating killer... Returning to menu in {timeLeft}
      </div>
      <div style={{ color: '#aaa', fontSize: '1rem', maxWidth: 400, textAlign: 'center' }}>
        You will spectate your killer for a few seconds, then return to the menu.
      </div>
    </div>
  );
} 