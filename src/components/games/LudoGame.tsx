'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { LudoState, PlayerColor, Coordinate, GameConfig, Move, Token } from './ludo/types';
import { ludoEngine, createLogEntry } from './ludo/engine';
import { LudoBoard } from './ludo/board';
import { Dice } from './ludo/dice';
import { getCoordinate } from './ludo/rules';
import { ludoAudio } from './ludo/audio';
import { ludoAI } from './ludo/ai';
import GameSetup from './ludo/GameSetup';

// ─── Display constants ──────────────────────────────────────────────────────

const COLOR_NAMES: Record<PlayerColor, string> = {
  RED: 'Red', BLUE: 'Blue', YELLOW: 'Yellow', GREEN: 'Green',
};

const COLOR_HEX: Record<PlayerColor, string> = {
  RED: '#ff3366', BLUE: '#3388ff', YELLOW: '#ffaa00', GREEN: '#00cc66',
};

const COLOR_EMOJI: Record<PlayerColor, string> = {
  RED: '🔴', BLUE: '🔵', YELLOW: '🟡', GREEN: '🟢',
};

// ─── AI helpers ─────────────────────────────────────────────────────────────

const getAIDifficulty = (name: string): 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT' => {
  if (name.includes('EASY')) return 'EASY';
  if (name.includes('HARD')) return 'HARD';
  if (name.includes('EXPERT')) return 'EXPERT';
  return 'MEDIUM';
};

const getThinkingDelay = (difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT'): number => {
  const ranges = {
    EASY: [700, 1200],
    MEDIUM: [900, 1500],
    HARD: [1200, 1800],
    EXPERT: [1500, 2200],
  };
  const [min, max] = ranges[difficulty];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// ─── Component ─────────────────────────────────────────────────────────────

export default function LudoGame() {
  const [gameConfig, setGameConfig] = useState<GameConfig | null>(null);
  const [gameState, setGameState] = useState<LudoState | null>(null);

  // Animation states (local only)
  const [isMovingTokenId, setIsMovingTokenId] = useState<number | null>(null);
  const [movingTokenColor, setMovingTokenColor] = useState<PlayerColor | null>(null);
  const [movingCoordinate, setMovingCoordinate] = useState<Coordinate | null>(null);

  // UI state
  const [diceRolling, setDiceRolling] = useState(false);
  const [showWinnerModal, setShowWinnerModal] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerColor | null>(null);
  const [showControls, setShowControls] = useState(false);

  // AI thinking state
  const [aiThinking, setAiThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState('');

  // Debug AI overrides
  const [isAutoPlayer, setIsAutoPlayer] = useState<Record<PlayerColor, boolean>>({
    RED: false, GREEN: false, YELLOW: false, BLUE: false,
  });

  // Concurrency & Animation Locks
  const isAnimatingRef = useRef(false);
  const animationCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTurnRef = useRef<PlayerColor | null>(null);

  // ── Start game from setup ───────────────────────────────────────────────
  const handleStart = useCallback((config: GameConfig) => {
    setGameConfig(config);
    const initialState = ludoEngine.initializeGame(config);
    const auto: Record<PlayerColor, boolean> = { RED: false, GREEN: false, YELLOW: false, BLUE: false };
    config.playerConfigs.forEach(pc => {
      if (pc.role === 'AI') auto[pc.color] = true;
    });
    setIsAutoPlayer(auto);
    setGameState(initialState);
    setShowWinnerModal(false);
    setIsMovingTokenId(null);
    setMovingTokenColor(null);
    setMovingCoordinate(null);
    setDiceRolling(false);
    setAiThinking(false);
    isAnimatingRef.current = false;
    lastTurnRef.current = initialState.currentTurn;
  }, []);

  // ── Unified, transport-agnostic executeMove pipeline ───────────────────
  const executeMove = useCallback((tokenId: number, color: PlayerColor) => {
    // ── Pre-flight validation & Synchronous Lock ──
    if (!gameState) return;
    if (gameState.phase !== 'TOKEN_MOVE' || isAnimatingRef.current) return;

    // Verify move is legal
    const isLegal = gameState.availableMoves.some(
      m => m.tokenId === tokenId && gameState.currentTurn === color,
    );
    if (!isLegal) return;

    // Acquire lock immediately (synchronously prevents concurrent double-clicks/taps)
    isAnimatingRef.current = true;

    const startPos = gameState.players
      .find(p => p.color === color)!
      .tokens.find(t => t.id === tokenId)!.position;

    // Compute final state and movement path in the engine
    const { nextState, animatedPath } = ludoEngine.moveToken(gameState, tokenId);

    if (animatedPath.length === 0) {
      isAnimatingRef.current = false;
      setGameState(nextState);
      return;
    }

    // ── Phase 1: Forward step-by-step movement animation ──
    setIsMovingTokenId(tokenId);
    setMovingTokenColor(color);
    setMovingCoordinate(animatedPath[0]);

    let pathIndex = 0;
    animationCleanupRef.current = setInterval(() => {
      pathIndex++;

      if (pathIndex < animatedPath.length) {
        setMovingCoordinate(animatedPath[pathIndex]);
        if (startPos === 0 && pathIndex === 1) {
          ludoAudio.playDeploy();
        } else {
          ludoAudio.playMove();
        }
      } else {
        // Forward animation complete
        if (animationCleanupRef.current) clearInterval(animationCleanupRef.current);
        
        // Resolve landing and capture logic
        const endPos = nextState.players.find(p => p.color === color)!.tokens.find(t => t.id === tokenId)!.position;

        // Detect if an opponent token was captured
        let capturedTokenInfo: { color: PlayerColor; id: number; fromPosition: number } | null = null;
        gameState.players.forEach(opp => {
          if (opp.color === color) return;
          opp.tokens.forEach(t => {
            const nextT = nextState.players.find(p => p.color === opp.color)!.tokens.find(nt => nt.id === t.id)!;
            if (t.position > 0 && nextT.position === 0) {
              capturedTokenInfo = { color: opp.color, id: t.id, fromPosition: t.position };
            }
          });
        });

        // ── Phase 2: Capture backward-travel animation ──
        if (capturedTokenInfo) {
          // Play capture explosion sound once
          ludoAudio.playCapture();

          // Wait 200ms on the capture cell before executing reverse travel
          setTimeout(() => {
            const cap = capturedTokenInfo!;
            const revPath: Coordinate[] = [];
            
            // Build backward coordinate path from current track location back to 0 (base yard slot)
            for (let pos = cap.fromPosition; pos >= 0; pos--) {
              revPath.push(getCoordinate(cap.color, cap.id, pos));
            }

            setIsMovingTokenId(cap.id);
            setMovingTokenColor(cap.color);
            setMovingCoordinate(revPath[0]);

            let revIndex = 0;
            const revInterval = setInterval(() => {
              revIndex++;
              if (revIndex < revPath.length) {
                setMovingCoordinate(revPath[revIndex]);
                ludoAudio.playMove(); // clicking reverse steps
              } else {
                // Reverse animation completed — release visual overrides and commit
                clearInterval(revInterval);
                setIsMovingTokenId(null);
                setMovingTokenColor(null);
                setMovingCoordinate(null);
                
                // Commit state and release locks
                isAnimatingRef.current = false;
                setGameState(nextState);
              }
            }, 80); // swift backward slide
          }, 200);
        } else {
          // No capture: snap active visual coordinates and resolve sound
          setIsMovingTokenId(null);
          setMovingTokenColor(null);
          setMovingCoordinate(null);

          if (nextState.phase === 'FINISHED' && nextState.winner) {
            ludoAudio.playVictory();
            setShowWinnerModal(true);
          } else if (endPos === 57) {
            ludoAudio.playHome();
          } else {
            ludoAudio.playMove();
          }

          // Commit state and release locks
          isAnimatingRef.current = false;
          setGameState(nextState);
        }
      }
    }, 160); // 160ms cell-by-cell linear forward step duration
  }, [gameState]);

  // ── Roll dice ───────────────────────────────────────────────────────────
  const handleRollDice = useCallback(() => {
    if (!gameState) return;
    if (gameState.phase !== 'DICE_ROLL' || diceRolling || isAnimatingRef.current) return;

    // Acquire animation lock
    isAnimatingRef.current = true;
    ludoAudio.playRollBegin();
    setDiceRolling(true);

    setTimeout(() => {
      ludoAudio.playRollImpact();
      setDiceRolling(false);
      
      setGameState(prev => {
        if (!prev) return prev;
        const next = ludoEngine.rollDice(prev);
        ludoAudio.playRollReveal();
        
        // Release animation lock
        isAnimatingRef.current = false;
        return next;
      });
    }, 850);
  }, [gameState, diceRolling]);

  // ── Human move selector callback ────────────────────────────────────────
  const handleTokenClick = useCallback((tokenId: number, color: PlayerColor) => {
    executeMove(tokenId, color);
  }, [executeMove]);

  // ── Auto-step (for AI decisions or debug checks) ────────────────────────
  const handleAutoStep = useCallback(() => {
    if (!gameState || gameState.phase === 'FINISHED' || isAnimatingRef.current) return;

    if (gameState.phase === 'DICE_ROLL' && !diceRolling) {
      handleRollDice();
    } else if (gameState.phase === 'TOKEN_MOVE' && gameState.availableMoves.length > 0 && isMovingTokenId === null) {
      const player = gameState.players.find(p => p.color === gameState.currentTurn)!;
      const diff = getAIDifficulty(player.name);
      
      const bestMove = ludoAI.selectMove(gameState, diff);
      if (bestMove) {
        executeMove(bestMove.tokenId, gameState.currentTurn);
      } else {
        // Fallback random move selection
        const rnd = gameState.availableMoves[Math.floor(Math.random() * gameState.availableMoves.length)];
        executeMove(rnd.tokenId, gameState.currentTurn);
      }
    }
  }, [gameState, diceRolling, isMovingTokenId, handleRollDice, executeMove]);

  // ── Turn change audio trigger ───────────────────────────────────────────
  useEffect(() => {
    if (!gameState) return;
    if (lastTurnRef.current && lastTurnRef.current !== gameState.currentTurn) {
      ludoAudio.playTurnChange();
    }
    lastTurnRef.current = gameState.currentTurn;
  }, [gameState?.currentTurn]);

  // ── AI thinking timer and controller ────────────────────────────────────
  useEffect(() => {
    if (!gameState || gameState.phase === 'FINISHED') return;

    const activePlayer = gameState.players.find(p => p.color === gameState.currentTurn)!;
    const isCurrentAuto = isAutoPlayer[gameState.currentTurn] || activePlayer.isAuto;

    if (!isCurrentAuto || diceRolling || isMovingTokenId !== null || isAnimatingRef.current) {
      setAiThinking(false);
      return;
    }

    const diff = getAIDifficulty(activePlayer.name);
    const delay = getThinkingDelay(diff);

    setAiThinking(true);
    setThinkingText(`${COLOR_NAMES[gameState.currentTurn]} is thinking...`);

    const timer = setTimeout(() => {
      setAiThinking(false);
      handleAutoStep();
    }, delay);

    return () => clearTimeout(timer);
  }, [
    gameState?.phase,
    gameState?.currentTurn,
    diceRolling,
    isMovingTokenId,
    isAutoPlayer,
    handleAutoStep,
  ]);

  // ── Toggle AI for a color ───────────────────────────────────────────────
  const toggleAutoPlayer = (color: PlayerColor) => {
    setIsAutoPlayer(prev => ({ ...prev, [color]: !prev[color] }));
  };

  // ── Restart / Exit to Menu ──────────────────────────────────────────────
  const handleRestart = () => {
    if (animationCleanupRef.current) clearInterval(animationCleanupRef.current);
    setGameConfig(null);
    setGameState(null);
    setIsMovingTokenId(null);
    setMovingTokenColor(null);
    setMovingCoordinate(null);
    setDiceRolling(false);
    setShowWinnerModal(false);
    setSelectedPlayer(null);
    setAiThinking(false);
    isAnimatingRef.current = false;
  };

  // ── Highlighted path (cells a token could reach) ────────────────────────
  const highlightedPath = useMemo((): Coordinate[] => {
    if (!gameState) return [];
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
  }, [gameState?.phase, gameState?.availableMoves, gameState?.currentTurn, isMovingTokenId]);

  const allTokens = useMemo(
    () => gameState?.players.flatMap(p => p.tokens) ?? [],
    [gameState?.players],
  );

  const recentLogs = useMemo(
    () => (gameState?.logs ?? []).slice(0, 5),
    [gameState?.logs],
  );

  const getStats = (color: PlayerColor) => {
    if (!gameState) return { finished: 0, active: 0, base: 0 };
    const p = gameState.players.find(pl => pl.color === color)!;
    return {
      finished: p.tokens.filter(t => t.position === 57).length,
      active: p.tokens.filter(t => t.position > 0 && t.position < 57).length,
      base: p.tokens.filter(t => t.position === 0).length,
    };
  };

  // ── Guard: show setup if no config ──────────────────────────────────────
  if (!gameConfig || !gameState) {
    return <GameSetup onStart={handleStart} />;
  }

  const currentColor = COLOR_HEX[gameState.currentTurn];
  const activeColors = gameState.activeColors;

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
      {/* Ambient glow tied to current player */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '60%',
          background: `radial-gradient(ellipse, ${currentColor}15 0%, transparent 70%)`,
          pointerEvents: 'none',
          transition: 'background 1s ease',
          zIndex: 0,
        }}
      />

      {/* ── AI Thinking Dot Animation Banner ─────────────────────────────────── */}
      {aiThinking && (
        <div
          style={{
            position: 'absolute',
            top: '56px',
            background: 'rgba(20, 20, 26, 0.9)',
            border: `1.5px solid ${currentColor}66`,
            boxShadow: `0 8px 24px ${currentColor}22`,
            padding: '8px 18px',
            borderRadius: '50px',
            fontSize: '0.78rem',
            fontWeight: 800,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'fadeIn 0.25s ease',
          }}
        >
          <span>🤖 {thinkingText}</span>
          <div className="thinking-dots">
            <span className="dot" style={{ backgroundColor: currentColor }} />
            <span className="dot" style={{ backgroundColor: currentColor, animationDelay: '0.2s' }} />
            <span className="dot" style={{ backgroundColor: currentColor, animationDelay: '0.4s' }} />
          </div>
        </div>
      )}

      {/* ── Winner Overlay ───────────────────────────────────────────────── */}
      {showWinnerModal && gameState.winner && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.78)',
            backdropFilter: 'blur(14px)',
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
              background: 'rgba(14, 14, 18, 0.97)',
              borderRadius: '28px',
              border: `2px solid ${COLOR_HEX[gameState.winner]}`,
              textAlign: 'center',
              boxShadow: `0 0 60px ${COLOR_HEX[gameState.winner]}55, 0 40px 80px rgba(0,0,0,0.6)`,
              maxWidth: '320px',
              width: '90%',
              animation: 'popIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ fontSize: '4.5rem', lineHeight: 1, marginBottom: '0.75rem' }}>🏆</div>
            <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: COLOR_HEX[gameState.winner], marginBottom: '0.25rem', opacity: 0.8 }}>
              Winner
            </div>
            <h2 style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', margin: '0 0 0.5rem 0' }}>
              {COLOR_NAMES[gameState.winner]}
            </h2>
            {gameState.finishOrder.length > 1 && (
              <div style={{ fontSize: '0.75rem', color: '#555', marginBottom: '0.75rem' }}>
                {gameState.finishOrder.slice(1).map((c, i) => (
                  <span key={c} style={{ color: COLOR_HEX[c] }}>
                    {i > 0 ? ' · ' : ''}#{i + 2} {COLOR_NAMES[c]}
                  </span>
                ))}
              </div>
            )}
            <p style={{ color: '#666', fontSize: '0.82rem', margin: '0 0 1.75rem 0' }}>
              All tokens arrived home safely!
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => handleStart(gameConfig)}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: `1px solid ${COLOR_HEX[gameState.winner]}44`,
                  background: 'rgba(255,255,255,0.05)',
                  color: '#ccc',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Rematch
              </button>
              <button
                onClick={handleRestart}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: 'none',
                  background: `linear-gradient(135deg, ${COLOR_HEX[gameState.winner]}, ${COLOR_HEX[gameState.winner]}99)`,
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  boxShadow: `0 6px 20px ${COLOR_HEX[gameState.winner]}44`,
                }}
              >
                New Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Player Info Modal ────────────────────────────────────────────── */}
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
              maxWidth: '300px',
              background: 'rgba(16, 16, 22, 0.98)',
              borderRadius: '20px',
              border: `2px solid ${COLOR_HEX[selectedPlayer]}55`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.5), 0 0 30px ${COLOR_HEX[selectedPlayer]}22`,
              padding: '1.5rem',
              animation: 'popIn 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: `radial-gradient(circle at 35% 35%, ${COLOR_HEX[selectedPlayer]}, ${COLOR_HEX[selectedPlayer]}77)`,
                  boxShadow: `0 0 14px ${COLOR_HEX[selectedPlayer]}66`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '1rem',
                  color: '#fff',
                }}
              >
                {selectedPlayer[0]}
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '1rem' }}>{COLOR_NAMES[selectedPlayer]}</div>
                <div style={{ fontSize: '0.68rem', color: '#555', marginTop: '1px' }}>
                  {isAutoPlayer[selectedPlayer]
                    ? '🤖 AI'
                    : gameState.players.find(p => p.color === selectedPlayer)?.isAuto
                      ? '🤖 AI'
                      : '👤 Human'}
                </div>
              </div>
            </div>

            {[
              { label: 'In Yard',   val: `🏠 ${getStats(selectedPlayer).base}/4`,   col: '#555' },
              { label: 'On Track',  val: `🛣️ ${getStats(selectedPlayer).active}`,     col: '#888' },
              { label: 'Finished',  val: `👑 ${getStats(selectedPlayer).finished}/4`, col: COLOR_HEX[selectedPlayer] },
              {
                label: 'Status',
                val: gameState.currentTurn === selectedPlayer ? 'ACTIVE' : 'WAITING',
                col: gameState.currentTurn === selectedPlayer ? COLOR_HEX[selectedPlayer] : '#444',
              },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: '#555', fontSize: '0.8rem' }}>{row.label}</span>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: row.col }}>{row.val}</span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: '8px', marginTop: '1rem' }}>
              <button
                onClick={() => toggleAutoPlayer(selectedPlayer)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '10px',
                  border: `1px solid ${COLOR_HEX[selectedPlayer]}33`,
                  background: isAutoPlayer[selectedPlayer] ? `${COLOR_HEX[selectedPlayer]}18` : 'rgba(255,255,255,0.04)',
                  color: isAutoPlayer[selectedPlayer] ? COLOR_HEX[selectedPlayer] : '#666',
                  fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                }}
              >
                {isAutoPlayer[selectedPlayer] ? '🤖 AI ON' : '👤 Manual'}
              </button>
              <button
                onClick={() => setSelectedPlayer(null)}
                style={{
                  flex: 1, padding: '9px', borderRadius: '10px',
                  border: 'none',
                  background: COLOR_HEX[selectedPlayer],
                  color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer',
                  boxShadow: `0 4px 14px ${COLOR_HEX[selectedPlayer]}44`,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 6px', zIndex: 10, position: 'relative', boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.3rem' }}>🎲</span>
          <h1 style={{
            margin: 0, fontSize: '1.2rem', fontWeight: 900,
            background: 'linear-gradient(90deg, #ffcc00, #ff3366)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Ludo Classic
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowControls(p => !p)}
            style={{
              background: showControls ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)', color: '#aaa',
              padding: '5px 9px', borderRadius: '8px', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer',
            }}
          >⚙️</button>
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#ccc', padding: '5px 11px', borderRadius: '8px', fontSize: '0.7rem',
              fontWeight: 700, cursor: 'pointer',
            }}
          >← Menu</button>
        </div>
      </div>

      {/* ── Collapsible controls ────────────────────────────────────────── */}
      {showControls && (
        <div style={{
          width: '100%', padding: '4px 16px', display: 'flex', gap: '6px',
          flexWrap: 'wrap', justifyContent: 'center', zIndex: 10,
          boxSizing: 'border-box', animation: 'slideDown 0.2s ease',
        }}>
          <button
            onClick={handleAutoStep}
            disabled={!gameState || gameState.phase === 'FINISHED' || aiThinking || isAnimatingRef.current}
            style={{
              background: 'rgba(255,214,0,0.12)', border: '1px solid rgba(255,214,0,0.3)',
              color: '#ffd600', padding: '5px 12px', borderRadius: '8px',
              fontSize: '0.68rem', fontWeight: 800, cursor: 'pointer',
            }}
          >⚡ Auto-Step</button>
          {activeColors.map(color => (
            <button key={color}
              onClick={() => toggleAutoPlayer(color)}
              style={{
                background: isAutoPlayer[color] ? `${COLOR_HEX[color]}20` : 'transparent',
                border: `1px solid ${COLOR_HEX[color]}55`, color: COLOR_HEX[color],
                padding: '5px 10px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
              }}
            >{isAutoPlayer[color] ? '🤖' : '👤'} {COLOR_NAMES[color]}</button>
          ))}
        </div>
      )}

      {/* ── Player status strip ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '5px', padding: '4px 16px 4px',
        width: '100%', justifyContent: 'center', flexWrap: 'wrap',
        zIndex: 10, position: 'relative', boxSizing: 'border-box',
      }}>
        {activeColors.map(color => {
          const isTurn = gameState.currentTurn === color;
          const stats = getStats(color);
          const isFinished = gameState.finishOrder.includes(color);
          return (
            <button key={color}
              onClick={() => setSelectedPlayer(color)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '50px',
                background: isTurn ? `${COLOR_HEX[color]}1a` : isFinished ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isTurn ? COLOR_HEX[color] : isFinished ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)'}`,
                color: isTurn ? COLOR_HEX[color] : isFinished ? '#333' : '#777',
                fontSize: '0.68rem', fontWeight: isTurn ? 800 : 500,
                cursor: 'pointer', transition: 'all 0.2s ease',
                boxShadow: isTurn ? `0 0 12px ${COLOR_HEX[color]}28` : 'none',
                opacity: isFinished ? 0.5 : 1,
              }}
            >
              <span style={{ fontSize: '0.72rem' }}>{COLOR_EMOJI[color]}</span>
              <span>{COLOR_NAMES[color]}</span>
              {stats.finished > 0 && (
                <span style={{ fontSize: '0.6rem', opacity: 0.9 }}>
                  {'👑'.repeat(stats.finished)}
                </span>
              )}
              {(isAutoPlayer[color] || gameState.players.find(p => p.color === color)?.isAuto) && (
                <span style={{ fontSize: '0.6rem' }}>🤖</span>
              )}
              {isFinished && (
                <span style={{ fontSize: '0.6rem' }}>✓</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── BOARD (Hero Element) ─────────────────────────────────────────── */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flex: '1 1 auto', padding: '4px 0', zIndex: 10, position: 'relative',
      }}>
        <div style={{
          width: 'min(90vw, calc(90vh - 210px), 500px)',
          aspectRatio: '1 / 1',
          position: 'relative',
        }}>
          <LudoBoard
            tokens={allTokens}
            onTokenClick={handleTokenClick}
            availableMoves={gameState.availableMoves}
            currentTurn={gameState.currentTurn}
            isMovingTokenId={isMovingTokenId}
            movingTokenColor={movingTokenColor}
            movingCoordinate={movingCoordinate}
            highlightedPath={highlightedPath}
            onYardClick={setSelectedPlayer}
          />
        </div>
      </div>

      {/* ── Dice + Turn Area ─────────────────────────────────────────────── */}
      <div style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '16px', padding: '6px 16px 4px', zIndex: 10, position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* Left: Turn indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '70px' }}>
          <div style={{
            width: '30px', height: '30px', borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${currentColor}, ${currentColor}77)`,
            boxShadow: `0 0 14px ${currentColor}77`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.85rem', fontWeight: 900, color: '#fff',
          }}>
            {gameState.currentTurn[0]}
          </div>
          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
            {COLOR_NAMES[gameState.currentTurn]}&apos;s turn
          </span>
          <span style={{ fontSize: '0.6rem', color: '#444', fontWeight: 600 }}>
            {gameState.phase === 'DICE_ROLL'
              ? (diceRolling ? 'Rolling…' : 'Roll dice')
              : gameState.phase === 'TOKEN_MOVE'
                ? (isMovingTokenId !== null ? 'Moving…' : 'Pick token')
                : 'Game over'}
          </span>
        </div>

        {/* Center: Dice */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            borderRadius: '20px',
            border: `1px solid ${gameState.phase === 'DICE_ROLL' && !diceRolling ? currentColor + '44' : 'rgba(255,255,255,0.06)'}`,
            padding: '12px 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: gameState.phase === 'DICE_ROLL' && !diceRolling
              ? `0 0 20px ${currentColor}25, 0 8px 20px rgba(0,0,0,0.3)`
              : '0 8px 20px rgba(0,0,0,0.3)',
            transition: 'all 0.3s ease',
            position: 'relative',
          }}>
            <Dice
              value={gameState.diceValue}
              isRolling={diceRolling}
              onRoll={handleRollDice}
              disabled={gameState.phase !== 'DICE_ROLL' || diceRolling || isMovingTokenId !== null || aiThinking || isAnimatingRef.current}
              playerColor={gameState.currentTurn}
            />

            {/* Tap to roll badge */}
            {gameState.phase === 'DICE_ROLL' && !diceRolling && isMovingTokenId === null && !aiThinking && !isAnimatingRef.current && (
              <div style={{
                position: 'absolute', bottom: '-11px', left: '50%',
                transform: 'translateX(-50%)',
                background: currentColor, color: '#fff',
                fontSize: '0.58rem', fontWeight: 800,
                padding: '2px 9px', borderRadius: '50px',
                letterSpacing: '0.07em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                boxShadow: `0 2px 8px ${currentColor}55`,
                animation: 'bounceY 1.2s infinite ease-in-out',
              }}>Tap to roll</div>
            )}

            {/* Pick token badge */}
            {gameState.phase === 'TOKEN_MOVE' && isMovingTokenId === null && !aiThinking && !isAnimatingRef.current && (
              <div style={{
                position: 'absolute', bottom: '-11px', left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(255,255,255,0.08)', color: '#fff',
                fontSize: '0.58rem', fontWeight: 800,
                padding: '2px 9px', borderRadius: '50px',
                letterSpacing: '0.06em', textTransform: 'uppercase', whiteSpace: 'nowrap',
                border: '1px solid rgba(255,255,255,0.1)',
              }}>Pick token</div>
            )}
          </div>
          <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: 600, marginTop: '4px' }}>
            Last: <span style={{ color: '#ffd600', fontWeight: 800 }}>{gameState.diceValue}</span>
          </div>
        </div>

        {/* Right: Consecutive sixes + roll count */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: '70px' }}>
          {gameState.consecutiveSixes > 0 ? (
            <div style={{
              background: 'rgba(255,100,0,0.12)', border: '1px solid rgba(255,100,0,0.25)',
              borderRadius: '10px', padding: '5px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.9rem' }}>{'🎲'.repeat(gameState.consecutiveSixes)}</div>
              <div style={{ fontSize: '0.58rem', color: '#ff6400', fontWeight: 800, marginTop: '1px', textTransform: 'uppercase' }}>
                {gameState.consecutiveSixes}× six!
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', opacity: 0.2 }}>
              <div style={{ fontSize: '0.6rem', color: '#aaa', lineHeight: '1.4' }}>Consec.<br/>sixes: 0</div>
            </div>
          )}
        </div>
      </div>

      {/* ── Game log ────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', padding: '4px 16px 10px',
        zIndex: 10, position: 'relative', boxSizing: 'border-box',
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '12px', padding: '8px 12px',
          display: 'flex', flexDirection: 'column', gap: '3px',
          maxWidth: '460px', margin: '0 auto',
        }}>
          {recentLogs.map((log, idx) => (
            <div key={log.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              gap: '8px', opacity: idx === 0 ? 1 : Math.max(0.18, 1 - idx * 0.22),
            }}>
              <span style={{
                fontSize: '0.7rem', fontWeight: idx === 0 ? 700 : 400,
                color: log.color ? COLOR_HEX[log.color] : '#555', lineHeight: '1.3',
              }}>
                {log.message}
              </span>
              <span style={{ fontSize: '0.58rem', color: '#2a2a2a', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {log.timestamp}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn   { from { opacity: 0; }                      to { opacity: 1; } }
        @keyframes popIn    { 0% { transform: scale(0.7); opacity: 0; } 80% { transform: scale(1.04); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes slideDown{ from { transform: translateY(-8px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes bounceY  { 0%, 100% { transform: translateX(-50%) translateY(0); } 50% { transform: translateX(-50%) translateY(-3px); } }

        .thinking-dots {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          margin-left: 4px;
        }

        .thinking-dots .dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          display: inline-block;
          animation: dotKey 1.4s infinite ease-in-out both;
        }

        @keyframes dotKey {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>
    </div>
  );
}
