'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LudoState, PlayerColor, Coordinate, Move, LudoAIStrategy, LudoMultiplayerAdapter } from './ludo/types';
import { ludoEngine, createLogEntry } from './ludo/engine';
import { LudoBoard } from './ludo/board';
import { Dice } from './ludo/dice';
import { getCoordinate } from './ludo/rules';

const colorNames: Record<PlayerColor, string> = {
  RED: 'Red',
  BLUE: 'Blue',
  YELLOW: 'Yellow',
  GREEN: 'Green',
};

const colorHex: Record<PlayerColor, string> = {
  RED: '#ff3366',
  BLUE: '#3388ff',
  YELLOW: '#ffaa00',
  GREEN: '#00cc66',
};

const colorThemeBg: Record<PlayerColor, string> = {
  RED: 'rgba(255, 51, 102, 0.08)',
  BLUE: 'rgba(51, 136, 255, 0.08)',
  YELLOW: 'rgba(255, 170, 0, 0.08)',
  GREEN: 'rgba(0, 204, 102, 0.08)',
};

export default function LudoGame() {
  const [gameState, setGameState] = useState<LudoState>(() => ludoEngine.initializeGame(true));
  
  // Animation states for sliding tokens
  const [isMovingTokenId, setIsMovingTokenId] = useState<number | null>(null);
  const [movingTokenColor, setMovingTokenColor] = useState<PlayerColor | null>(null);
  const [movingCoordinate, setMovingCoordinate] = useState<Coordinate | null>(null);
  
  // Confetti / Celebration states
  const [showWinnerConfetti, setShowWinnerConfetti] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-move configuration (Preparation for AI / Local Automation)
  const [isAutoPlayer, setIsAutoPlayer] = useState<Record<PlayerColor, boolean>>({
    RED: false,
    BLUE: false,
    YELLOW: false,
    GREEN: false,
  });

  // Automatically scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.logs]);

  // Handle dice rolling animation and trigger state engine update
  const handleRollDice = () => {
    if (gameState.phase !== 'DICE_ROLL' || diceRolling) return;

    setDiceRolling(true);
    setTimeout(() => {
      setDiceRolling(false);
      setGameState((prev) => ludoEngine.rollDice(prev));
    }, 850);
  };

  // Perform step-by-step token sliding animation
  const handleTokenClick = (tokenId: number, color: PlayerColor) => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return;

    const { nextState, animatedPath } = ludoEngine.moveToken(gameState, tokenId);

    if (animatedPath.length === 0) {
      setGameState(nextState);
      return;
    }

    setIsMovingTokenId(tokenId);
    setMovingTokenColor(color);
    
    let pathIndex = 0;
    setMovingCoordinate(animatedPath[0]);

    // Slide transition timeline
    const stepInterval = setInterval(() => {
      pathIndex++;
      if (pathIndex < animatedPath.length) {
        setMovingCoordinate(animatedPath[pathIndex]);
      } else {
        clearInterval(stepInterval);
        setIsMovingTokenId(null);
        setMovingTokenColor(null);
        setMovingCoordinate(null);
        setGameState(nextState);

        // Check if game finished to trigger celebration
        if (nextState.phase === 'FINISHED' && nextState.winner) {
          setShowWinnerConfetti(true);
        }
      }
    }, 150); // Speed of token step-by-step movement (ms per cell)
  };

  // Trigger auto-move simulation for testing rules
  const handleTriggerAutoPlay = () => {
    if (gameState.phase === 'DICE_ROLL' && !diceRolling) {
      handleRollDice();
    } else if (gameState.phase === 'TOKEN_MOVE' && gameState.availableMoves.length > 0 && isMovingTokenId === null) {
      // Pick a random valid move
      const randMove = gameState.availableMoves[Math.floor(Math.random() * gameState.availableMoves.length)];
      handleTokenClick(randMove.tokenId, gameState.currentTurn);
    }
  };

  // Auto-play effect loop
  useEffect(() => {
    if (gameState.phase === 'FINISHED') return;

    const currentTurn = gameState.currentTurn;
    const isCurrentAuto = isAutoPlayer[currentTurn];

    if (isCurrentAuto) {
      const delay = gameState.phase === 'DICE_ROLL' ? 1000 : 800;
      const timer = setTimeout(() => {
        handleTriggerAutoPlay();
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [gameState.phase, gameState.currentTurn, diceRolling, isMovingTokenId, isAutoPlayer]);

  // Toggle automation status for a color
  const toggleAutoPlayer = (color: PlayerColor) => {
    setIsAutoPlayer((prev) => ({
      ...prev,
      [color]: !prev[color],
    }));
    setGameState((prev) => ({
      ...prev,
      logs: [
        createLogEntry(`Toggle Auto-Play for ${colorNames[color]} to ${!isAutoPlayer[color] ? 'ON' : 'OFF'}`),
        ...prev.logs,
      ],
    }));
  };

  const handleRestart = () => {
    setGameState(ludoEngine.initializeGame(true));
    setIsMovingTokenId(null);
    setMovingTokenColor(null);
    setMovingCoordinate(null);
    setDiceRolling(false);
    setShowWinnerConfetti(false);
  };

  // Extract all tokens in play
  const allTokens = useMemo(() => {
    return gameState.players.flatMap((p) => p.tokens);
  }, [gameState.players]);

  // Path highlight coordinates helper
  const getHighlightedPath = (): Coordinate[] => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return [];
    
    const activePlayer = gameState.players.find((p) => p.color === gameState.currentTurn)!;
    const paths: Coordinate[] = [];
    
    gameState.availableMoves.forEach((move) => {
      const token = activePlayer.tokens.find((t) => t.id === move.tokenId)!;
      const start = token.position;
      const end = move.toPosition;
      
      if (start === 0) {
        paths.push(getCoordinate(gameState.currentTurn, token.id, 1));
      } else {
        for (let pos = start + 1; pos <= end; pos++) {
          paths.push(getCoordinate(gameState.currentTurn, token.id, pos));
        }
      }
    });

    return paths;
  };

  // Future Adaptors click helper
  const triggerFutureAlert = (featureName: string) => {
    setGameState((prev) => ({
      ...prev,
      logs: [
        createLogEntry(`[Sprint 3 Preparation] ${featureName} adapter hook detected!`),
        ...prev.logs,
      ],
    }));
    alert(`${featureName} is prepared in Sprint 2 codebase hooks & will go live in Sprint 3!`);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1.5rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #121214 0%, #1e1e24 100%)',
        color: '#fff',
        borderRadius: '24px',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Visual background sparkles overlay */}
      <div className="bg-glow" style={{ border: `1px solid ${colorHex[gameState.currentTurn]}1a` }} />

      {/* Confetti canvas overlay on Victory */}
      {showWinnerConfetti && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 100,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '2.5rem',
              background: 'rgba(30, 30, 35, 0.85)',
              borderRadius: '24px',
              border: `2px solid ${colorHex[gameState.winner!]}`,
              textAlign: 'center',
              boxShadow: `0 0 40px ${colorHex[gameState.winner!]}88`,
              backdropFilter: 'blur(16px)',
              animation: 'confetti-popup 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ fontSize: '4.5rem', marginBottom: '1rem' }}>🏆</div>
            <h2 style={{ fontSize: '2rem', fontWeight: 800, color: colorHex[gameState.winner!], margin: '0 0 0.5rem 0' }}>
              {colorNames[gameState.winner!]} Wins!
            </h2>
            <p style={{ color: '#ccc', margin: '0 0 1.5rem 0' }}>All tokens successfully arrived home!</p>
            <button
              onClick={handleRestart}
              style={{
                background: colorHex[gameState.winner!],
                color: '#fff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: '12px',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 4px 15px ${colorHex[gameState.winner!]}66`,
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Ludo Game HUD Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '1.25rem',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.6rem' }}>🎲</span>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #ffcc00, #ff3366)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Premium Ludo
            </h1>
          </div>
          <p style={{ fontSize: '0.85rem', color: '#888', margin: '4px 0 0 0', fontWeight: 500 }}>
            Sprint 2 Animation & Design Upgrade (Local / Simulation engine)
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Quick Simulation Trigger */}
          <button
            onClick={handleTriggerAutoPlay}
            disabled={isMovingTokenId !== null || gameState.phase === 'FINISHED'}
            style={{
              background: 'rgba(255,214,0,0.1)',
              border: '1px solid rgba(255,214,0,0.25)',
              color: '#ffd600',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Auto-Step
          </button>
          
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '10px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2.5rem',
          width: '100%',
          zIndex: 10,
        }}
        className="ludo-grid"
      >
        {/* Left Side: SVG Board */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ maxWidth: '580px', width: '100%' }}>
            <LudoBoard
              tokens={allTokens}
              onTokenClick={handleTokenClick}
              availableMoves={gameState.availableMoves}
              currentTurn={gameState.currentTurn}
              isMovingTokenId={isMovingTokenId}
              movingTokenColor={movingTokenColor}
              movingCoordinate={movingCoordinate}
              highlightedPath={getHighlightedPath()}
            />
          </div>
        </div>

        {/* Right Side: Interactive HUD Control Panel */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            background: 'rgba(30, 30, 35, 0.45)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '1.5rem',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
          }}
        >
          {/* Active Turn Indicator Panel */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: colorThemeBg[gameState.currentTurn],
              padding: '12px 18px',
              borderRadius: '14px',
              border: `1.5px solid ${colorHex[gameState.currentTurn]}3c`,
              transition: 'all 0.3s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: colorHex[gameState.currentTurn],
                  boxShadow: `0 0 14px ${colorHex[gameState.currentTurn]}`,
                  animation: 'pulse-glow 1.5s infinite',
                }}
              />
              <span style={{ fontWeight: 800, fontSize: '1.15rem', color: colorHex[gameState.currentTurn] }}>
                {colorNames[gameState.currentTurn]}'s Turn
              </span>
            </div>
            
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 800,
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '5px 12px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                color: '#fff',
              }}
            >
              {gameState.phase.replace('_', ' ')}
            </span>
          </div>

          {/* Dice Block container */}
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.03)',
            }}
          >
            <Dice
              value={gameState.diceValue}
              isRolling={diceRolling}
              onRoll={handleRollDice}
              disabled={gameState.phase !== 'DICE_ROLL' || isMovingTokenId !== null}
              playerColor={gameState.currentTurn}
            />
          </div>

          {/* Player Standings with Automation settings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '0.85rem', margin: '0 0 4px 0', color: '#777', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Player Yards
            </h3>
            {gameState.players.map((player) => {
              const homeCount = player.tokens.filter((t) => t.position === 57).length;
              const activeCount = player.tokens.filter((t) => t.position > 0 && t.position < 57).length;
              const isCurrent = player.color === gameState.currentTurn;
              const isAuto = isAutoPlayer[player.color];

              return (
                <div
                  key={player.color}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '11px 15px',
                    background: isCurrent ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '12px',
                    borderLeft: `5px solid ${colorHex[player.color]}`,
                    border: isCurrent ? `1px solid rgba(255,255,255,0.08)` : 'none',
                    borderLeftColor: colorHex[player.color],
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, color: isCurrent ? colorHex[player.color] : '#fff' }}>
                      {colorNames[player.color]}
                    </span>
                    {/* Local Toggle Auto Mode button */}
                    <button
                      onClick={() => toggleAutoPlayer(player.color)}
                      style={{
                        background: isAuto ? `${colorHex[player.color]}22` : 'rgba(255,255,255,0.05)',
                        border: `1px solid ${isAuto ? colorHex[player.color] : 'rgba(255,255,255,0.1)'}`,
                        color: isAuto ? colorHex[player.color] : '#888',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      {isAuto ? 'AUTO' : 'MANUAL'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '14px', fontSize: '0.8rem', color: '#bbb' }}>
                    <span>🏠 {4 - homeCount - activeCount}</span>
                    <span>🛣️ {activeCount}</span>
                    <span style={{ fontWeight: 800, color: colorHex[player.color] }}>👑 {homeCount}/4</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Event Log Display */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              height: '140px',
              background: 'rgba(0,0,0,0.25)',
              borderRadius: '14px',
              padding: '12px 16px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '0.72rem', color: '#555', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '6px', marginBottom: '6px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Gameplay Log console
            </div>
            {gameState.logs.map((log) => (
              <div
                key={log.id}
                style={{
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  color: log.color ? colorHex[log.color] : '#aaa',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <span style={{ fontWeight: log.color ? 600 : 400 }}>{log.message}</span>
                <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>{log.timestamp}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {/* Future Integration Preparation Handles */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px' }}>
            <button onClick={() => triggerFutureAlert('Matchmaker & Ranked')} className="hook-btn">Ranked</button>
            <button onClick={() => triggerFutureAlert('Online Multiplayer Adaptor')} className="hook-btn">Online</button>
            <button onClick={() => triggerFutureAlert('Tournament bracket management')} className="hook-btn">Tournament</button>
            <button onClick={() => triggerFutureAlert('Spectator Hub')} className="hook-btn">Spectate</button>
            <button onClick={() => triggerFutureAlert('Replay System recorder')} className="hook-btn">Replays</button>
          </div>
        </div>
      </div>

      {/* Styled Grid layout and HUD styling */}
      <style>{`
        @media (min-width: 768px) {
          .ludo-grid {
            grid-template-columns: 1.25fr 1fr;
          }
        }
        .bg-glow {
          position: absolute;
          top: -20%;
          left: -20%;
          width: 140%;
          height: 140%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(255,255,255,0.01) 0%, rgba(0,0,0,0) 70%);
          pointer-events: none;
          z-index: 1;
        }
        @keyframes confetti-popup {
          0% { transform: scale(0.6); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        .hook-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.6);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 6px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .hook-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
          border-color: rgba(255,255,255,0.18);
        }
      `}</style>
    </div>
  );
}
