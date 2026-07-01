'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LudoState, PlayerColor, Coordinate, Move, Token } from './ludo/types';
import { ludoEngine, createLogEntry } from './ludo/engine';
import { LudoBoard } from './ludo/board';
import { Dice } from './ludo/dice';
import { getCoordinate } from './ludo/rules';
import { ludoAudio } from './ludo/audio';

const COLOR_NAMES: Record<PlayerColor, string> = {
  RED: 'Red', BLUE: 'Blue', YELLOW: 'Yellow', GREEN: 'Green',
};

const COLOR_HEX: Record<PlayerColor, string> = {
  RED: '#ff3366', BLUE: '#3388ff', YELLOW: '#ffaa00', GREEN: '#00cc66',
};

const COLOR_EMOJI: Record<PlayerColor, string> = {
  RED: '🔴', BLUE: '🔵', YELLOW: '🟡', GREEN: '🟢',
};

export default function LudoGame() {
  const [gameState, setGameState] = useState<LudoState>(() => ludoEngine.initializeGame(true));

  const [isMovingTokenId, setIsMovingTokenId] = useState<number | null>(null);
  const [movingTokenColor, setMovingTokenColor] = useState<PlayerColor | null>(null);
  const [movingCoordinate, setMovingCoordinate] = useState<Coordinate | null>(null);

  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);

  const [isAutoPlayer, setIsAutoPlayer] = useState<Record<PlayerColor, boolean>>({
    RED: false, BLUE: false, YELLOW: false, GREEN: false,
  });
  const [showControls, setShowControls] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerColor | null>(null);

  // ── Dice roll handler ──────────────────────────────────────────────────────
  const handleRollDice = useCallback(() => {
    if (gameState.phase !== 'DICE_ROLL' || diceRolling || isMovingTokenId !== null) return;
    ludoAudio.playRoll();
    setDiceRolling(true);
    setTimeout(() => {
      setDiceRolling(false);
      setGameState(prev => ludoEngine.rollDice(prev));
    }, 850);
  }, [gameState.phase, diceRolling, isMovingTokenId]);

  // ── Token move handler ─────────────────────────────────────────────────────
  const handleTokenClick = useCallback((tokenId: number, color: PlayerColor) => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return;

    const currentToken = gameState.players
      .find(p => p.color === color)!
      .tokens.find(t => t.id === tokenId)!;

    const startPos = currentToken.position;
    const { nextState, animatedPath } = ludoEngine.moveToken(gameState, tokenId);

    if (animatedPath.length === 0) {
      setGameState(nextState);
      return;
    }

    setIsMovingTokenId(tokenId);
    setMovingTokenColor(color);

    let pathIndex = 0;
    setMovingCoordinate(animatedPath[0]);

    const stepInterval = setInterval(() => {
      pathIndex++;
      if (pathIndex < animatedPath.length) {
        setMovingCoordinate(animatedPath[pathIndex]);
        if (startPos === 0 && pathIndex === 1) {
          ludoAudio.playDeploy();
        } else {
          ludoAudio.playMove();
        }
      } else {
        clearInterval(stepInterval);
        setIsMovingTokenId(null);
        setMovingTokenColor(null);
        setMovingCoordinate(null);

        let captureOccurred = false;
        nextState.players.forEach(p => {
          if (p.color === color) return;
          p.tokens.forEach(t => {
            const oldT = gameState.players.find(op => op.color === p.color)!.tokens.find(ot => ot.id === t.id)!;
            if (oldT.position > 0 && t.position === 0) captureOccurred = true;
          });
        });

        const endPos = nextState.players.find(p => p.color === color)!.tokens.find(t => t.id === tokenId)!.position;
        if (nextState.phase === 'FINISHED' && nextState.winner) {
          ludoAudio.playVictory();
          setShowWinnerModal(true);
        } else if (endPos === 57) {
          ludoAudio.playHome();
        } else if (captureOccurred) {
          ludoAudio.playCapture();
        } else {
          ludoAudio.playMove();
        }

        setGameState(nextState);
      }
    }, 160);
  }, [gameState, isMovingTokenId]);

  // ── Auto-play trigger ──────────────────────────────────────────────────────
  const handleAutoStep = useCallback(() => {
    if (gameState.phase === 'DICE_ROLL' && !diceRolling) {
      handleRollDice();
    } else if (gameState.phase === 'TOKEN_MOVE' && gameState.availableMoves.length > 0 && isMovingTokenId === null) {
      const randMove = gameState.availableMoves[Math.floor(Math.random() * gameState.availableMoves.length)];
      handleTokenClick(randMove.tokenId, gameState.currentTurn);
    }
  }, [gameState, diceRolling, isMovingTokenId, handleRollDice, handleTokenClick]);

  // Auto-play effect loop
  useEffect(() => {
    if (gameState.phase === 'FINISHED') return;
    const isCurrentAuto = isAutoPlayer[gameState.currentTurn];
    if (!isCurrentAuto) return;
    const delay = gameState.phase === 'DICE_ROLL' ? 900 : 700;
    const timer = setTimeout(handleAutoStep, delay);
    return () => clearTimeout(timer);
  }, [gameState.phase, gameState.currentTurn, diceRolling, isMovingTokenId, isAutoPlayer, handleAutoStep]);

  // ── Restart handler ────────────────────────────────────────────────────────
  const handleRestart = () => {
    setGameState(ludoEngine.initializeGame(true));
    setIsMovingTokenId(null);
    setMovingTokenColor(null);
    setMovingCoordinate(null);
    setDiceRolling(false);
    setShowWinnerModal(false);
    setSelectedPlayer(null);
  };

  // Toggle AI control per color
  const toggleAutoPlayer = (color: PlayerColor) => {
    setIsAutoPlayer(prev => ({ ...prev, [color]: !prev[color] }));
  };

  // ── Derived values ─────────────────────────────────────────────────────────
  const allTokens = useMemo(() => gameState.players.flatMap(p => p.tokens), [gameState.players]);

  const highlightedPath = useMemo((): Coordinate[] => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return [];
    const paths: Coordinate[] = [];
    const activePlayer = gameState.players.find(p => p.color === gameState.currentTurn)!;
    gameState.availableMoves.forEach(move => {
      const token = activePlayer.tokens.find(t => t.id === move.tokenId)!;
      if (token.position === 0) {
        paths.push(getCoordinate(gameState.currentTurn, token.id, 1));
      } else {
        for (let pos = token.position + 1; pos <= move.toPosition; pos++) {
          paths.push(getCoordinate(gameState.currentTurn, token.id, pos));
        }
      }
    });
    return paths;
  }, [gameState.phase, gameState.availableMoves, gameState.currentTurn, gameState.players, isMovingTokenId]);

  const recentLogs = useMemo(() => gameState.logs.slice(0, 4), [gameState.logs]);

  const currentPlayer = gameState.players.find(p => p.color === gameState.currentTurn)!;
  const currentColor = COLOR_HEX[gameState.currentTurn];

  const isActionable =
    (gameState.phase === 'DICE_ROLL' && !diceRolling && isMovingTokenId === null) ||
    (gameState.phase === 'TOKEN_MOVE' && gameState.availableMoves.length > 0 && isMovingTokenId === null);

  // ── Player stats for info panel ────────────────────────────────────────────
  const getPlayerStats = (color: PlayerColor) => {
    const p = gameState.players.find(pl => pl.color === color)!;
    return {
      finished: p.tokens.filter(t => t.position === 57).length,
      active: p.tokens.filter(t => t.position > 0 && t.position < 57).length,
      base: p.tokens.filter(t => t.position === 0).length,
    };
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: 'linear-gradient(160deg, #0c0c10 0%, #141418 50%, #0f0f14 100%)',
        color: '#fff',
        width: '100%',
        minHeight: '100%',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
        userSelect: 'none',
      }}
    >
      {/* Ambient gradient glow tied to current player */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '60%',
          background: `radial-gradient(ellipse at center, ${currentColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 1s ease',
          zIndex: 0,
        }}
      />

      {/* ── Winner overlay ──────────────────────────────────────────────────── */}
      {showWinnerModal && gameState.winner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 200,
            animation: 'fadeIn 0.3s ease',
          }}
        >
          <div
            style={{
              padding: '2.5rem 2rem',
              background: 'rgba(16, 16, 20, 0.96)',
              borderRadius: '28px',
              border: `2px solid ${COLOR_HEX[gameState.winner]}`,
              textAlign: 'center',
              boxShadow: `0 0 60px ${COLOR_HEX[gameState.winner]}60, 0 40px 80px rgba(0,0,0,0.6)`,
              maxWidth: '320px',
              width: '90%',
              animation: 'popIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ fontSize: '4.5rem', lineHeight: 1, marginBottom: '0.75rem' }}>🏆</div>
            <div
              style={{
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                color: COLOR_HEX[gameState.winner],
                marginBottom: '0.25rem',
                opacity: 0.8,
              }}
            >
              Winner
            </div>
            <h2
              style={{
                fontSize: '2rem',
                fontWeight: 900,
                color: '#fff',
                margin: '0 0 0.4rem 0',
              }}
            >
              {COLOR_NAMES[gameState.winner]}
            </h2>
            <p style={{ color: '#888', fontSize: '0.85rem', margin: '0 0 1.75rem 0' }}>
              All tokens safely reached home!
            </p>
            <button
              onClick={handleRestart}
              style={{
                background: `linear-gradient(135deg, ${COLOR_HEX[gameState.winner]}, ${COLOR_HEX[gameState.winner]}99)`,
                color: '#fff',
                border: 'none',
                padding: '14px 32px',
                borderRadius: '14px',
                fontSize: '1rem',
                fontWeight: 800,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                boxShadow: `0 6px 24px ${COLOR_HEX[gameState.winner]}55`,
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* ── Player Stats Modal ─────────────────────────────────────────────── */}
      {selectedPlayer && (
        <div
          onClick={() => setSelectedPlayer(null)}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 150,
            animation: 'fadeIn 0.2s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '88%',
              maxWidth: '320px',
              background: 'rgba(18, 18, 23, 0.98)',
              borderRadius: '22px',
              border: `2px solid ${COLOR_HEX[selectedPlayer]}66`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${COLOR_HEX[selectedPlayer]}33`,
              padding: '1.75rem 1.5rem',
              animation: 'popIn 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${COLOR_HEX[selectedPlayer]}, ${COLOR_HEX[selectedPlayer]}88)`,
                  boxShadow: `0 0 16px ${COLOR_HEX[selectedPlayer]}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                  fontWeight: 900,
                  color: '#fff',
                }}
              >
                {selectedPlayer[0]}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{COLOR_NAMES[selectedPlayer]} Player</div>
                <div style={{ fontSize: '0.72rem', color: '#666', marginTop: '2px' }}>
                  {isAutoPlayer[selectedPlayer] ? '🤖 AI Bot' : '👤 Human'}
                </div>
              </div>
            </div>

            {[
              { label: 'In Yard', value: `🏠 ${getPlayerStats(selectedPlayer).base}/4`, color: '#888' },
              { label: 'On Track', value: `🛣️ ${getPlayerStats(selectedPlayer).active}`, color: '#888' },
              { label: 'Finished', value: `👑 ${getPlayerStats(selectedPlayer).finished}/4`, color: COLOR_HEX[selectedPlayer] },
              { label: 'Turn', value: gameState.currentTurn === selectedPlayer ? 'ACTIVE' : 'WAITING', color: gameState.currentTurn === selectedPlayer ? COLOR_HEX[selectedPlayer] : '#555' },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <span style={{ color: '#666', fontSize: '0.82rem' }}>{row.label}</span>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: row.color }}>{row.value}</span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '10px', marginTop: '1.25rem' }}>
              <button
                onClick={() => toggleAutoPlayer(selectedPlayer)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: `1px solid ${COLOR_HEX[selectedPlayer]}44`,
                  background: isAutoPlayer[selectedPlayer] ? `${COLOR_HEX[selectedPlayer]}22` : 'rgba(255,255,255,0.04)',
                  color: isAutoPlayer[selectedPlayer] ? COLOR_HEX[selectedPlayer] : '#aaa',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                }}
              >
                {isAutoPlayer[selectedPlayer] ? '🤖 AI ON' : '👤 Manual'}
              </button>
              <button
                onClick={() => setSelectedPlayer(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: COLOR_HEX[selectedPlayer],
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  boxShadow: `0 4px 16px ${COLOR_HEX[selectedPlayer]}44`,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOP HEADER ────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px 8px 16px',
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>🎲</span>
          <h1
            style={{
              margin: 0,
              fontSize: '1.3rem',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #ffcc00, #ff3366)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Ludo Classic
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button
            onClick={() => setShowControls(p => !p)}
            style={{
              background: showControls ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#aaa',
              padding: '6px 10px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚙️
          </button>
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#ccc',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.72rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* ── CONTROLS PANEL (collapsible) ───────────────────────────────────── */}
      {showControls && (
        <div
          style={{
            width: '100%',
            padding: '6px 16px',
            display: 'flex',
            gap: '6px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            zIndex: 10,
            boxSizing: 'border-box',
            animation: 'slideDown 0.2s ease',
          }}
        >
          <button
            onClick={handleAutoStep}
            disabled={gameState.phase === 'FINISHED'}
            style={{
              background: 'rgba(255,214,0,0.12)',
              border: '1px solid rgba(255,214,0,0.3)',
              color: '#ffd600',
              padding: '5px 12px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ⚡ Auto-Step
          </button>
          {(['RED', 'GREEN', 'YELLOW', 'BLUE'] as PlayerColor[]).map(color => (
            <button
              key={color}
              onClick={() => toggleAutoPlayer(color)}
              style={{
                background: isAutoPlayer[color] ? `${COLOR_HEX[color]}20` : 'transparent',
                border: `1px solid ${COLOR_HEX[color]}55`,
                color: COLOR_HEX[color],
                padding: '5px 10px',
                borderRadius: '8px',
                fontSize: '0.68rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isAutoPlayer[color] ? '🤖' : '👤'} {COLOR_NAMES[color]}
            </button>
          ))}
        </div>
      )}

      {/* ── PLAYER STATUS STRIP ───────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '4px 16px 6px',
          width: '100%',
          justifyContent: 'center',
          flexWrap: 'wrap',
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {gameState.players.map(p => {
          const isTurn = gameState.currentTurn === p.color;
          const stats = getPlayerStats(p.color);
          return (
            <button
              key={p.color}
              onClick={() => setSelectedPlayer(p.color)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 11px',
                borderRadius: '50px',
                background: isTurn ? `${COLOR_HEX[p.color]}1a` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isTurn ? COLOR_HEX[p.color] : 'rgba(255,255,255,0.08)'}`,
                color: isTurn ? COLOR_HEX[p.color] : '#888',
                fontSize: '0.7rem',
                fontWeight: isTurn ? 800 : 600,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: isTurn ? `0 0 14px ${COLOR_HEX[p.color]}30` : 'none',
                animation: isTurn ? 'chipGlow 2s infinite ease-in-out' : 'none',
              }}
            >
              <span style={{ fontSize: '0.75rem' }}>{COLOR_EMOJI[p.color]}</span>
              <span>{COLOR_NAMES[p.color]}</span>
              {stats.finished > 0 && (
                <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>{'👑'.repeat(stats.finished)}</span>
              )}
              {isAutoPlayer[p.color] && <span style={{ fontSize: '0.65rem' }}>🤖</span>}
            </button>
          );
        })}
      </div>

      {/* ── BOARD (HERO ELEMENT) ──────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '1 1 auto',
          padding: '6px 0',
          zIndex: 10,
          position: 'relative',
        }}
      >
        <div
          style={{
            width: 'min(90vw, 90vh - 200px, 500px)',
            aspectRatio: '1 / 1',
            position: 'relative',
          }}
        >
          <LudoBoard
            tokens={allTokens}
            onTokenClick={handleTokenClick}
            availableMoves={gameState.availableMoves}
            currentTurn={gameState.currentTurn}
            isMovingTokenId={isMovingTokenId}
            movingTokenColor={movingTokenColor}
            movingCoordinate={movingCoordinate}
            highlightedPath={highlightedPath}
            onYardClick={color => setSelectedPlayer(color)}
          />
        </div>
      </div>

      {/* ── DICE + ACTION AREA ────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '20px',
          padding: '8px 16px',
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        {/* Turn indicator left */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            minWidth: '72px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${currentColor}, ${currentColor}88)`,
              boxShadow: `0 0 14px ${currentColor}88`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              fontWeight: 900,
              color: '#fff',
              animation: 'pulseRing 1.8s infinite ease-in-out',
            }}
          >
            {gameState.currentTurn[0]}
          </div>
          <span style={{ fontSize: '0.65rem', color: '#666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {COLOR_NAMES[gameState.currentTurn]}&apos;s Turn
          </span>
          <span style={{ fontSize: '0.65rem', color: '#555', fontWeight: 600 }}>
            {gameState.phase === 'DICE_ROLL'
              ? 'Roll dice'
              : gameState.phase === 'TOKEN_MOVE'
                ? `Move token`
                : 'Game over'}
          </span>
        </div>

        {/* Central dice */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {/* Dice container with glow platform */}
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '22px',
              border: `1px solid ${isActionable && gameState.phase === 'DICE_ROLL' ? currentColor + '44' : 'rgba(255,255,255,0.06)'}`,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isActionable && gameState.phase === 'DICE_ROLL'
                ? `0 0 24px ${currentColor}30, 0 8px 24px rgba(0,0,0,0.3)`
                : '0 8px 24px rgba(0,0,0,0.3)',
              transition: 'all 0.35s ease',
              position: 'relative',
            }}
          >
            <Dice
              value={gameState.diceValue}
              isRolling={diceRolling}
              onRoll={handleRollDice}
              disabled={gameState.phase !== 'DICE_ROLL' || diceRolling || isMovingTokenId !== null}
              playerColor={gameState.currentTurn}
            />

            {/* Roll prompt badge */}
            {gameState.phase === 'DICE_ROLL' && !diceRolling && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: currentColor,
                  color: '#fff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '50px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  boxShadow: `0 3px 10px ${currentColor}55`,
                  animation: 'bounceY 1.2s infinite ease-in-out',
                }}
              >
                Tap to Roll
              </div>
            )}
            {gameState.phase === 'TOKEN_MOVE' && !isMovingTokenId && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'rgba(255,255,255,0.1)',
                  color: '#fff',
                  fontSize: '0.6rem',
                  fontWeight: 800,
                  padding: '3px 10px',
                  borderRadius: '50px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                Pick token
              </div>
            )}
          </div>

          {/* Last roll value */}
          <div
            style={{
              fontSize: '0.7rem',
              color: '#555',
              fontWeight: 600,
              marginTop: '6px',
            }}
          >
            Last roll: <span style={{ color: '#ffd600', fontWeight: 800 }}>{gameState.diceValue}</span>
          </div>
        </div>

        {/* Consecutive sixes badge right */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            minWidth: '72px',
          }}
        >
          {gameState.consecutiveSixes > 0 && (
            <div
              style={{
                background: 'rgba(255,100,0,0.15)',
                border: '1px solid rgba(255,100,0,0.3)',
                borderRadius: '10px',
                padding: '6px 10px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '1.1rem' }}>{'🎲'.repeat(gameState.consecutiveSixes)}</div>
              <div style={{ fontSize: '0.6rem', color: '#ff6400', fontWeight: 800, marginTop: '2px' }}>
                {gameState.consecutiveSixes}x SIX!
              </div>
            </div>
          )}
          {gameState.consecutiveSixes === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.25 }}>
              <div style={{ fontSize: '0.65rem', color: '#aaa' }}>Consecutive</div>
              <div style={{ fontSize: '0.65rem', color: '#aaa' }}>Sixes: 0</div>
            </div>
          )}
        </div>
      </div>

      {/* ── GAME LOG ─────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%',
          padding: '4px 16px 12px',
          zIndex: 10,
          position: 'relative',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
            borderRadius: '14px',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            maxWidth: '480px',
            margin: '0 auto',
          }}
        >
          {recentLogs.length === 0 ? (
            <div style={{ fontSize: '0.72rem', color: '#333', textAlign: 'center' }}>Game started — roll to begin!</div>
          ) : (
            recentLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: idx === 0 ? 1 : Math.max(0.25, 1 - idx * 0.22),
                }}
              >
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: idx === 0 ? 700 : 400,
                    color: log.color ? COLOR_HEX[log.color] : '#666',
                    lineHeight: '1.3',
                  }}
                >
                  {log.message}
                </span>
                <span style={{ fontSize: '0.6rem', color: '#333', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {log.timestamp}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── STYLES ────────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes popIn {
          0% { transform: scale(0.7); opacity: 0; }
          80% { transform: scale(1.04); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes chipGlow {
          0%, 100% { box-shadow: 0 0 10px var(--chip-color, rgba(255,255,255,0.1)); }
          50% { box-shadow: 0 0 20px var(--chip-color, rgba(255,255,255,0.1)); }
        }
        @keyframes pulseRing {
          0%, 100% { box-shadow: 0 0 10px currentColor; transform: scale(1); }
          50% { box-shadow: 0 0 20px currentColor; transform: scale(1.08); }
        }
        @keyframes bounceY {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
