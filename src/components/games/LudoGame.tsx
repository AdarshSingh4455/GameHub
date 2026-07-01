'use client'

import React, { useState, useEffect, useRef } from 'react';
import { LudoState, PlayerColor, Coordinate } from './ludo/types';
import { ludoEngine } from './ludo/engine';
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

export default function LudoGame() {
  const [gameState, setGameState] = useState<LudoState>(() => ludoEngine.initializeGame(true));
  
  // Animation states for sliding tokens
  const [isMovingTokenId, setIsMovingTokenId] = useState<number | null>(null);
  const [movingTokenColor, setMovingTokenColor] = useState<PlayerColor | null>(null);
  const [movingCoordinate, setMovingCoordinate] = useState<Coordinate | null>(null);
  
  const [diceRolling, setDiceRolling] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Automatically scroll logs to bottom
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.logs]);

  // Handle dice rolling animation and trigger state engine update
  const handleRollDice = () => {
    if (gameState.phase !== 'DICE_ROLL' || diceRolling) return;

    setDiceRolling(true);
    // Simulate dice rolling animation length
    setTimeout(() => {
      setDiceRolling(false);
      setGameState((prev) => ludoEngine.rollDice(prev));
    }, 850);
  };

  // Perform step-by-step token sliding animation
  const handleTokenClick = (tokenId: number, color: PlayerColor) => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return;

    // Get the state update and path coordinates from engine
    const { nextState, animatedPath } = ludoEngine.moveToken(gameState, tokenId);

    if (animatedPath.length === 0) {
      setGameState(nextState);
      return;
    }

    // Slide animation parameters
    setIsMovingTokenId(tokenId);
    setMovingTokenColor(color);
    
    let pathIndex = 0;
    setMovingCoordinate(animatedPath[0]);

    const stepInterval = setInterval(() => {
      pathIndex++;
      if (pathIndex < animatedPath.length) {
        setMovingCoordinate(animatedPath[pathIndex]);
      } else {
        clearInterval(stepInterval);
        // Reset animation states and apply final state update
        setIsMovingTokenId(null);
        setMovingTokenColor(null);
        setMovingCoordinate(null);
        setGameState(nextState);
      }
    }, 150); // Speed of token step-by-step movement (ms per cell)
  };

  // Reset the game
  const handleRestart = () => {
    setGameState(ludoEngine.initializeGame(true));
    setIsMovingTokenId(null);
    setMovingTokenColor(null);
    setMovingCoordinate(null);
    setDiceRolling(false);
  };

  // Extract all tokens in play
  const allTokens = gameState.players.flatMap((p) => p.tokens);

  // Path highlight coordinates helper
  const getHighlightedPath = (): Coordinate[] => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return [];
    
    // Highlight paths for the token(s) of current active player that are playable
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        padding: '1.5rem',
        background: 'linear-gradient(135deg, #111 0%, #1c1c1e 100%)',
        color: '#fff',
        borderRadius: '24px',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        width: '100%',
        margin: '0 auto',
      }}
    >
      {/* Dashboard Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '1rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #ffaa00, #ff3366)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ludo Engine
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#999', margin: '4px 0 0 0' }}>
            Sprint 1 Core Gameplay Engine (Local 4-Player mode)
          </p>
        </div>
        <button
          onClick={handleRestart}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#fff',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          Reset Game
        </button>
      </div>

      {/* Main Layout Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '2rem',
          width: '100%',
        }}
        className="ludo-grid"
      >
        {/* Ludo Board Column */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ maxWidth: '600px', width: '100%' }}>
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

        {/* Sidebar Controls Column */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '20px',
            padding: '1.5rem',
            backdropFilter: 'blur(16px)',
          }}
        >
          {/* Active Turn Dashboard */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.03)',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              border: `1px solid ${colorHex[gameState.currentTurn]}33`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: colorHex[gameState.currentTurn],
                  boxShadow: `0 0 10px ${colorHex[gameState.currentTurn]}`,
                }}
              />
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                {colorNames[gameState.currentTurn]}'s Turn
              </span>
            </div>
            
            {/* Phase Badge */}
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '4px 10px',
                borderRadius: '20px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {gameState.phase.replace('_', ' ')}
            </span>
          </div>

          {/* Dice & Controls Row */}
          <div
            style={{
              display: 'flex',
              gap: '1.5rem',
              alignItems: 'center',
              justifyContent: 'center',
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

          {/* Player Progress List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h3 style={{ fontSize: '0.9rem', margin: '0 0 4px 0', color: '#999', fontWeight: 600 }}>
              Player Standings
            </h3>
            {gameState.players.map((player) => {
              const homeCount = player.tokens.filter((t) => t.position === 57).length;
              const activeCount = player.tokens.filter((t) => t.position > 0 && t.position < 57).length;
              
              return (
                <div
                  key={player.color}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: player.color === gameState.currentTurn ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0,0,0,0.2)',
                    borderRadius: '10px',
                    borderLeft: `4px solid ${colorHex[player.color]}`,
                    transition: 'all 0.2s',
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{colorNames[player.color]}</span>
                  <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: '#ccc' }}>
                    <span>🏠 {4 - homeCount - activeCount}</span>
                    <span>🛣️ {activeCount}</span>
                    <span style={{ fontWeight: 700, color: colorHex[player.color] }}>👑 {homeCount}/4</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrolling Log Panel */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              height: '160px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '12px',
              padding: '10px 14px',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '0.8rem', color: '#666', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px', marginBottom: '4px', fontWeight: 700 }}>
              GAME EVENT LOGS
            </div>
            {gameState.logs.map((log) => (
              <div
                key={log.id}
                style={{
                  fontSize: '0.8rem',
                  lineHeight: '1.4',
                  color: log.color ? colorHex[log.color] : '#bbb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <span>{log.message}</span>
                <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: '0.75rem' }}>{log.timestamp}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>

      {/* Styled Grid layout CSS */}
      <style>{`
        @media (min-width: 768px) {
          .ludo-grid {
            grid-template-columns: 1.2fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}
