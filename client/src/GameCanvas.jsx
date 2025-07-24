import React, { useEffect, useRef } from "react";
import './game.js';

export default function GameCanvas({ onPlayerDeath, isDead, privyUserId, email }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    // Prevent scrollbars on body
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    if (window.TankGameClient && canvasRef.current) {
      new window.TankGameClient(canvasRef.current, { onPlayerDeath, privyUserId, email });
    }
  }, [onPlayerDeath, privyUserId, email]);

  return (
      <canvas
        id="gameCanvas"
        ref={canvasRef}
        width={1200}
        height={800}
        style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        background: '#F3F3F3',
        display: 'block',
        cursor: 'none',
        maxWidth: '100vw',
        maxHeight: '100vh',
        aspectRatio: '3 / 2',
        objectFit: 'contain',
        boxSizing: 'border-box',
        zIndex: 1,
        overflow: 'hidden', // Prevent scrollbars on canvas
        }}
      />
  );
} 