'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LudoState, PlayerColor, Coordinate, Move, Token } from './ludo/types';
import { ludoEngine, createLogEntry } from './ludo/engine';
import { LudoBoard } from './ludo/board';
import { Dice } from './ludo/dice';
import { getCoordinate } from './ludo/rules';
import { ludoAudio } from './ludo/audio';

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

const colorStatusIcon: Record<PlayerColor, string> = {
  RED: '🔴',
  BLUE: '🔵',
  YELLOW: '🟡',
  GREEN: '🟢',
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

  // Yard Stats Popup State
  const [selectedYardColor, setSelectedYardColor] = useState<PlayerColor | null>(null);

  // Expandable controls toggle for advanced/debug features
  const [showExtraControls, setShowExtraControls] = useState(false);

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

    ludoAudio.playRoll();
    setDiceRolling(true);
    setTimeout(() => {
      setDiceRolling(false);
      setGameState((prev) => ludoEngine.rollDice(prev));
    }, 850);
  };

  // Perform step-by-step token sliding animation with synchronized audio triggers
  const handleTokenClick = (tokenId: number, color: PlayerColor) => {
    if (gameState.phase !== 'TOKEN_MOVE' || isMovingTokenId !== null) return;

    const currentToken = gameState.players
      .find((p) => p.color === color)!
      .tokens.find((t) => t.id === tokenId)!;

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

    // Slide transition timeline with synchronized audio
    const stepInterval = setInterval(() => {
      pathIndex++;
      if (pathIndex < animatedPath.length) {
        setMovingCoordinate(animatedPath[pathIndex]);
        // Play tick step sounds
        if (startPos === 0 && pathIndex === 1) {
          ludoAudio.playDeploy(); // deployment sound
        } else {
          ludoAudio.playMove(); // hop sound
        }
      } else {
        clearInterval(stepInterval);
        setIsMovingTokenId(null);
        setMovingTokenColor(null);
        setMovingCoordinate(null);
        
        // Check if there was a capture (opponent token sent back to 0)
        let captureOccurred = false;
        nextState.players.forEach((p) => {
          if (p.color === color) return;
          p.tokens.forEach((t) => {
            const oldT = gameState.players.find((op) => op.color === p.color)!.tokens.find((ot) => ot.id === t.id)!;
            if (oldT.position > 0 && t.position === 0) {
              captureOccurred = true;
            }
          });
        });

        // Resolve landing sounds
        const endPos = nextState.players.find((p) => p.color === color)!.tokens.find((t) => t.id === tokenId)!.position;
        if (nextState.phase === 'FINISHED' && nextState.winner) {
          ludoAudio.playVictory();
          setShowWinnerConfetti(true);
        } else if (endPos === 57) {
          ludoAudio.playHome();
        } else if (captureOccurred) {
          ludoAudio.playCapture();
        } else {
          ludoAudio.playMove();
        }

        setGameState(nextState);
      }
    }, 160); // Speed of token step-by-step movement (ms per cell)
  };

  // Trigger auto-move simulation for testing rules
  const handleTriggerAutoPlay = () => {
    if (gameState.phase === 'DICE_ROLL' && !diceRolling) {
      handleRollDice();
    } else if (gameState.phase === 'TOKEN_MOVE' && gameState.availableMoves.length > 0 && isMovingTokenId === null) {
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
    setSelectedYardColor(null);
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

  const handleYardClick = (color: PlayerColor) => {
    setSelectedYardColor(color);
  };

  // Get active stats for the popup yard color
  const getYardStats = (color: PlayerColor) => {
    const player = gameState.players.find((p) => p.color === color)!;
    const finishedCount = player.tokens.filter((t) => t.position === 57).length;
    const activeCount = player.tokens.filter((t) => t.position > 0 && t.position < 57).length;
    const baseCount = player.tokens.filter((t) => t.position === 0).length;
    return {
      name: `${colorNames[color]} Base Yard`,
      finished: finishedCount,
      active: activeCount,
      base: baseCount,
      isTurn: gameState.currentTurn === color,
      type: isAutoPlayer[color] ? 'AI Bot' : 'Human Player',
    };
  };

  const yardStats = selectedYardColor ? getYardStats(selectedYardColor) : null;

  // Render recent 5 log entries
  const recentLogs = useMemo(() => {
    return gameState.logs.slice(0, 5);
  }, [gameState.logs]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.75rem',
        background: 'linear-gradient(135deg, #0d0d0f 0%, #151518 100%)',
        color: '#fff',
        borderRadius: '20px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.6)',
        border: '1px solid rgba(255, 255, 255, 0.04)',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="bg-glow" style={{ border: `1px solid ${colorHex[gameState.currentTurn]}12` }} />

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
            zIndex: 150,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '2rem',
              background: 'rgba(20, 20, 24, 0.95)',
              borderRadius: '24px',
              border: `2px solid ${colorHex[gameState.winner!]}`,
              textAlign: 'center',
              boxShadow: `0 0 40px ${colorHex[gameState.winner!]}aa`,
              backdropFilter: 'blur(20px)',
            }}
          >
            <div style={{ fontSize: '4rem', marginBottom: '0.75rem' }}>🏆</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: colorHex[gameState.winner!], margin: '0 0 0.5rem 0' }}>
              {colorNames[gameState.winner!]} Wins!
            </h2>
            <p style={{ color: '#ccc', margin: '0 0 1.25rem 0' }}>All tokens successfully arrived home!</p>
            <button
              onClick={handleRestart}
              style={{
                background: colorHex[gameState.winner!],
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: `0 4px 12px ${colorHex[gameState.winner!]}66`,
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Premium Yard Info Modal/Popup */}
      {selectedYardColor && yardStats && (
        <div
          onClick={() => setSelectedYardColor(null)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'fade-in 0.15s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '88%',
              maxWidth: '340px',
              background: 'rgba(25, 25, 30, 0.95)',
              borderRadius: '20px',
              border: `2px solid ${colorHex[selectedYardColor]}aa`,
              boxShadow: `0 15px 30px rgba(0,0,0,0.5), 0 0 20px ${colorHex[selectedYardColor]}44`,
              padding: '1.5rem',
              textAlign: 'center',
              animation: 'popup-spring 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                backgroundColor: colorHex[selectedYardColor],
                boxShadow: `0 0 12px ${colorHex[selectedYardColor]}`,
                margin: '0 auto 10px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              {selectedYardColor[0]}
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.75rem 0', color: colorHex[selectedYardColor] }}>
              {yardStats.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Controller</span>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>{yardStats.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Tokens in Yard</span>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>🏠 {yardStats.base} / 4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Tokens on Track</span>
                <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.85rem' }}>🛣️ {yardStats.active}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Tokens Finished</span>
                <span style={{ fontWeight: 700, color: colorHex[selectedYardColor], fontSize: '0.85rem' }}>👑 {yardStats.finished} / 4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span style={{ color: '#888', fontSize: '0.8rem' }}>Turn Status</span>
                <span style={{ fontWeight: 700, color: yardStats.isTurn ? colorHex[selectedYardColor] : '#ff4444', fontSize: '0.85rem' }}>
                  {yardStats.isTurn ? 'ACTIVE' : 'WAITING'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => toggleAutoPlayer(selectedYardColor)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Toggle {isAutoPlayer[selectedYardColor] ? 'Manual' : 'AI Bot'}
              </button>
              <button
                onClick={() => setSelectedYardColor(null)}
                style={{
                  flex: 1,
                  background: colorHex[selectedYardColor],
                  color: '#fff',
                  border: 'none',
                  padding: '8px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compact Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
          paddingBottom: '0.4rem',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '1.2rem' }}>🎲</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #ffcc00, #ff3366)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Ludo Classic
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setShowExtraControls((prev) => !prev)}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#888',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚙️ Controls
          </button>
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: '#fff',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Expandable Extra Controls */}
      {showExtraControls && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            background: 'rgba(0,0,0,0.25)',
            padding: '6px 10px',
            borderRadius: '8px',
            width: '100%',
            justifyContent: 'center',
            zIndex: 11,
          }}
        >
          <button
            onClick={handleTriggerAutoPlay}
            disabled={isMovingTokenId !== null || gameState.phase === 'FINISHED'}
            style={{
              background: 'rgba(255,214,0,0.12)',
              border: '1px solid rgba(255,214,0,0.25)',
              color: '#ffd600',
              padding: '5px 10px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            ⚡ Auto-Step
          </button>
          <button
            onClick={() => toggleAutoPlayer('RED')}
            style={{
              background: isAutoPlayer.RED ? 'rgba(255,51,102,0.15)' : 'transparent',
              border: '1px solid rgba(255,51,102,0.3)',
              color: '#ff3366',
              fontSize: '0.65rem',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Red AI
          </button>
          <button
            onClick={() => toggleAutoPlayer('GREEN')}
            style={{
              background: isAutoPlayer.GREEN ? 'rgba(0,204,102,0.15)' : 'transparent',
              border: '1px solid rgba(0,204,102,0.3)',
              color: '#00cc66',
              fontSize: '0.65rem',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Green AI
          </button>
          <button
            onClick={() => toggleAutoPlayer('YELLOW')}
            style={{
              background: isAutoPlayer.YELLOW ? 'rgba(255,170,0,0.15)' : 'transparent',
              border: '1px solid rgba(255,170,0,0.3)',
              color: '#ffaa00',
              fontSize: '0.65rem',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Yellow AI
          </button>
          <button
            onClick={() => toggleAutoPlayer('BLUE')}
            style={{
              background: isAutoPlayer.BLUE ? 'rgba(51,136,255,0.15)' : 'transparent',
              border: '1px solid rgba(51,136,255,0.3)',
              color: '#3388ff',
              fontSize: '0.65rem',
              padding: '4px 8px',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Blue AI
          </button>
        </div>
      )}

      {/* Main Layout Area: Vertically Centered Ludo Board with Outside Corner Dice */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          flex: '1 1 auto',
          position: 'relative',
          padding: '24px 0',
          zIndex: 10,
        }}
      >
        {/* Core Board Container with 12% margins to hold the outer corner dice */}
        <div style={{ position: 'relative', width: '74%', maxWidth: '380px' }}>
          <LudoBoard
            tokens={allTokens}
            onTokenClick={handleTokenClick}
            availableMoves={gameState.availableMoves}
            currentTurn={gameState.currentTurn}
            isMovingTokenId={isMovingTokenId}
            movingTokenColor={movingTokenColor}
            movingCoordinate={movingCoordinate}
            highlightedPath={getHighlightedPath()}
            onYardClick={handleYardClick}
          />

          {/* RED Dice: Top-Left outside */}
          <div style={{ position: 'absolute', top: '1%', left: '-18%', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'RED' ? 1.0 : 0.4,
                pointerEvents: gameState.currentTurn === 'RED' ? 'auto' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Dice
                value={gameState.diceValue}
                isRolling={diceRolling && gameState.currentTurn === 'RED'}
                onRoll={handleRollDice}
                disabled={gameState.currentTurn !== 'RED' || gameState.phase !== 'DICE_ROLL' || isMovingTokenId !== null}
                playerColor="RED"
              />
            </div>
          </div>

          {/* GREEN Dice: Top-Right outside */}
          <div style={{ position: 'absolute', top: '1%', right: '-18%', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'GREEN' ? 1.0 : 0.4,
                pointerEvents: gameState.currentTurn === 'GREEN' ? 'auto' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Dice
                value={gameState.diceValue}
                isRolling={diceRolling && gameState.currentTurn === 'GREEN'}
                onRoll={handleRollDice}
                disabled={gameState.currentTurn !== 'GREEN' || gameState.phase !== 'DICE_ROLL' || isMovingTokenId !== null}
                playerColor="GREEN"
              />
            </div>
          </div>

          {/* YELLOW Dice: Bottom-Right outside */}
          <div style={{ position: 'absolute', bottom: '1%', right: '-18%', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'YELLOW' ? 1.0 : 0.4,
                pointerEvents: gameState.currentTurn === 'YELLOW' ? 'auto' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Dice
                value={gameState.diceValue}
                isRolling={diceRolling && gameState.currentTurn === 'YELLOW'}
                onRoll={handleRollDice}
                disabled={gameState.currentTurn !== 'YELLOW' || gameState.phase !== 'DICE_ROLL' || isMovingTokenId !== null}
                playerColor="YELLOW"
              />
            </div>
          </div>

          {/* BLUE Dice: Bottom-Left outside */}
          <div style={{ position: 'absolute', bottom: '1%', left: '-18%', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'BLUE' ? 1.0 : 0.4,
                pointerEvents: gameState.currentTurn === 'BLUE' ? 'auto' : 'none',
                transition: 'opacity 0.2s ease',
              }}
            >
              <Dice
                value={gameState.diceValue}
                isRolling={diceRolling && gameState.currentTurn === 'BLUE'}
                onRoll={handleRollDice}
                disabled={gameState.currentTurn !== 'BLUE' || gameState.phase !== 'DICE_ROLL' || isMovingTokenId !== null}
                playerColor="BLUE"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Redesigned Compact Player Chips */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          width: '100%',
          flexWrap: 'wrap',
          marginBottom: '0.4rem',
        }}
      >
        {gameState.players.map((p) => {
          const isTurn = gameState.currentTurn === p.color;
          const finished = p.tokens.filter((t) => t.position === 57).length;
          const inPlay = p.tokens.filter((t) => t.position > 0 && t.position < 57).length;
          
          return (
            <div
              key={p.color}
              onClick={() => handleYardClick(p.color)}
              style={{
                padding: '6px 12px',
                background: isTurn ? `${colorHex[p.color]}1a` : 'rgba(255,255,255,0.03)',
                border: `1.5px solid ${isTurn ? colorHex[p.color] : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '20px',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: isTurn ? `0 0 10px ${colorHex[p.color]}22` : 'none',
              }}
              className="player-chip-hover"
            >
              <span>{colorStatusIcon[p.color]}</span>
              <span style={{ fontWeight: 800, color: isTurn ? colorHex[p.color] : '#ddd' }}>
                {colorNames[p.color]}
              </span>
              <span style={{ opacity: 0.6, fontSize: '0.65rem' }}>
                ({finished}👑 / {inPlay}🛣️)
              </span>
            </div>
          );
        })}
      </div>

      {/* Redesigned Compact Controls and Console Log Panel */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.4rem',
          background: 'rgba(15, 15, 18, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          borderRadius: '14px',
          padding: '0.75rem',
          backdropFilter: 'blur(10px)',
          width: '100%',
          maxWidth: '450px',
        }}
      >
        {/* Turn status and recent roll indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: colorThemeBg[gameState.currentTurn],
            padding: '6px 10px',
            borderRadius: '8px',
            border: `1px solid ${colorHex[gameState.currentTurn]}25`,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: colorHex[gameState.currentTurn] }}>
            👉 Turn: {colorNames[gameState.currentTurn]}
          </span>
          <span style={{ fontSize: '0.8rem', color: '#ffd600', fontWeight: 800 }}>
            🎲 Roll: {gameState.diceValue}
          </span>
        </div>

        {/* Compact Game Logs (last 4 entries only) */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
            maxHeight: '68px',
            overflowY: 'hidden',
          }}
        >
          {recentLogs.map((log) => (
            <div
              key={log.id}
              style={{
                fontSize: '0.7rem',
                lineHeight: '1.3',
                color: log.color ? colorHex[log.color] : '#888',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: log.color ? 600 : 400 }}>{log.message}</span>
              <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: '0.65rem' }}>{log.timestamp}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>

      <style>{`
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
        @keyframes popup-spring {
          0% { transform: scale(0.65); opacity: 0; }
          80% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .player-chip-hover:hover {
          background: rgba(255,255,255,0.08) !important;
          transform: translateY(-1px);
        }
      `}</style>
    </div>
  );
}
