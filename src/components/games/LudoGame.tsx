'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LudoState, PlayerColor, Coordinate, Move, Token } from './ludo/types';
import { ludoEngine, createLogEntry } from './ludo/engine';
import { LudoBoard } from './ludo/board';
import { Dice } from './ludo/dice';
import { getCoordinate, isSafeCell } from './ludo/rules';
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

  const triggerFutureAlert = (featureName: string) => {
    setGameState((prev) => ({
      ...prev,
      logs: [
        createLogEntry(`[Sprint 3 Adapter] Connected ${featureName} adapter hook!`),
        ...prev.logs,
      ],
    }));
    alert(`${featureName} is connected to the Ludo core and ready for deployment!`);
  };

  // Yard Click Handler
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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        background: 'linear-gradient(135deg, #101012 0%, #1a1a1f 100%)',
        color: '#fff',
        borderRadius: '24px',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        width: '100%',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
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
            zIndex: 150,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '2.5rem',
              background: 'rgba(25, 25, 30, 0.9)',
              borderRadius: '24px',
              border: `2px solid ${colorHex[gameState.winner!]}`,
              textAlign: 'center',
              boxShadow: `0 0 45px ${colorHex[gameState.winner!]}aa`,
              backdropFilter: 'blur(20px)',
              animation: 'confetti-popup 0.6s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div style={{ fontSize: '4.5rem', marginBottom: '1rem' }}>🏆</div>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 800, color: colorHex[gameState.winner!], margin: '0 0 0.5rem 0' }}>
              {colorNames[gameState.winner!]} Wins!
            </h2>
            <p style={{ color: '#ccc', margin: '0 0 1.5rem 0' }}>All tokens successfully arrived home!</p>
            <button
              onClick={handleRestart}
              style={{
                background: colorHex[gameState.winner!],
                color: '#fff',
                border: 'none',
                padding: '12px 30px',
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
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            animation: 'fade-in 0.2s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '360px',
              background: 'rgba(30, 30, 35, 0.9)',
              borderRadius: '24px',
              border: `2px solid ${colorHex[selectedYardColor]}88`,
              boxShadow: `0 20px 40px rgba(0,0,0,0.5), 0 0 25px ${colorHex[selectedYardColor]}33`,
              padding: '1.75rem',
              textAlign: 'center',
              animation: 'popup-spring 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: colorHex[selectedYardColor],
                boxShadow: `0 0 15px ${colorHex[selectedYardColor]}`,
                margin: '0 auto 12px auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.25rem',
                color: '#fff',
                fontWeight: 800,
              }}
            >
              {selectedYardColor[0]}
            </div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 1rem 0', color: colorHex[selectedYardColor] }}>
              {yardStats.name}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Controller Type</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>{yardStats.type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Tokens in Yard</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>🏠 {yardStats.base} / 4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Tokens on Track</span>
                <span style={{ fontWeight: 700, color: '#fff' }}>🛣️ {yardStats.active}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Tokens Finished</span>
                <span style={{ fontWeight: 700, color: colorHex[selectedYardColor] }}>👑 {yardStats.finished} / 4</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Current Turn Status</span>
                <span style={{ fontWeight: 700, color: yardStats.isTurn ? colorHex[selectedYardColor] : '#ff5555' }}>
                  {yardStats.isTurn ? 'ACTIVE TURN' : 'WAITING'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => toggleAutoPlayer(selectedYardColor)}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: '#fff',
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
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
                  padding: '10px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: `0 4px 10px ${colorHex[selectedYardColor]}44`,
                }}
              >
                Close
              </button>
            </div>
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
          paddingBottom: '0.75rem',
          zIndex: 10,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.4rem' }}>🎲</span>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0, background: 'linear-gradient(to right, #ffcc00, #ff3366)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Classic Ludo
            </h1>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#888', margin: '2px 0 0 0', fontWeight: 500 }}>
            Classic Indian Ludo Board • Tap Base Yards for Statistics
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleTriggerAutoPlay}
            disabled={isMovingTokenId !== null || gameState.phase === 'FINISHED'}
            style={{
              background: 'rgba(255,214,0,0.12)',
              border: '1px solid rgba(255,214,0,0.25)',
              color: '#ffd600',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ⚡ Auto-Step
          </button>
          
          <button
            onClick={handleRestart}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Main Layout containing Board with 4 outer-positioned corner Dice */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          maxWidth: '540px',
          margin: '0 auto',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Relative board wrapper enabling corner overlay positioning for all 4 dice */}
        <div style={{ position: 'relative', width: '100%' }}>
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

          {/* RED Dice: Top-Left corner */}
          <div style={{ position: 'absolute', top: '2.5%', left: '2.5%', pointerEvents: 'auto', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'RED' ? 1.0 : 0.28,
                transition: 'opacity 0.3s ease',
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

          {/* GREEN Dice: Top-Right corner */}
          <div style={{ position: 'absolute', top: '2.5%', right: '2.5%', pointerEvents: 'auto', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'GREEN' ? 1.0 : 0.28,
                transition: 'opacity 0.3s ease',
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

          {/* YELLOW Dice: Bottom-Right corner */}
          <div style={{ position: 'absolute', bottom: '2.5%', right: '2.5%', pointerEvents: 'auto', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'YELLOW' ? 1.0 : 0.28,
                transition: 'opacity 0.3s ease',
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

          {/* BLUE Dice: Bottom-Left corner */}
          <div style={{ position: 'absolute', bottom: '2.5%', left: '2.5%', pointerEvents: 'auto', zIndex: 12 }}>
            <div
              style={{
                opacity: gameState.currentTurn === 'BLUE' ? 1.0 : 0.28,
                transition: 'opacity 0.3s ease',
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

      {/* Control Panel: Standings & Console Logs */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          background: 'rgba(25, 25, 30, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '1rem',
          backdropFilter: 'blur(16px)',
          width: '100%',
          maxWidth: '540px',
        }}
      >
        {/* Dynamic active status header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: colorThemeBg[gameState.currentTurn],
            padding: '8px 12px',
            borderRadius: '10px',
            border: `1px solid ${colorHex[gameState.currentTurn]}32`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: colorHex[gameState.currentTurn],
                boxShadow: `0 0 10px ${colorHex[gameState.currentTurn]}`,
              }}
            />
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: colorHex[gameState.currentTurn] }}>
              Active: {colorNames[gameState.currentTurn]}
            </span>
          </div>
          <span style={{ fontSize: '0.7rem', color: '#888', fontWeight: 700, textTransform: 'uppercase' }}>
            {gameState.phase.replace('_', ' ')}
          </span>
        </div>

        {/* Small Standings overview */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
          {gameState.players.map((p) => {
            const isTurn = gameState.currentTurn === p.color;
            const finished = p.tokens.filter((t) => t.position === 57).length;
            return (
              <div
                key={p.color}
                onClick={() => handleYardClick(p.color)}
                style={{
                  flex: '1 0 auto',
                  padding: '6px 12px',
                  background: isTurn ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)',
                  border: `1.5px solid ${isTurn ? colorHex[p.color] : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '10px',
                  fontSize: '0.72rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colorHex[p.color] }} />
                <span style={{ fontWeight: 700, color: '#eee' }}>{colorNames[p.color]}</span>
                <span style={{ opacity: 0.6 }}>👑 {finished}/4</span>
              </div>
            );
          })}
        </div>

        {/* Gameplay Logs */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            height: '100px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '12px',
            padding: '8px 12px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            overflowY: 'auto',
          }}
        >
          {gameState.logs.map((log) => (
            <div
              key={log.id}
              style={{
                fontSize: '0.75rem',
                lineHeight: '1.3',
                color: log.color ? colorHex[log.color] : '#aaa',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span style={{ fontWeight: log.color ? 600 : 400 }}>{log.message}</span>
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.7rem' }}>{log.timestamp}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {/* Sprint 3 Connective Adaptation Triggers */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
          <button onClick={() => triggerFutureAlert('Matchmaker')} className="s3-btn">Ranked MMR</button>
          <button onClick={() => triggerFutureAlert('Spectate Hub')} className="s3-btn">Spectate Mode</button>
          <button onClick={() => triggerFutureAlert('Replays')} className="s3-btn">Replays</button>
          <button onClick={() => triggerFutureAlert('Room Lobby')} className="s3-btn">Lobby UI</button>
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
        @keyframes confetti-popup {
          0% { transform: scale(0.65); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes popup-spring {
          0% { transform: scale(0.5); opacity: 0; }
          80% { transform: scale(1.08); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        .s3-btn {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5);
          font-size: 0.65rem;
          font-weight: 700;
          padding: 5px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .s3-btn:hover {
          background: rgba(255,255,255,0.08);
          color: #fff;
          border-color: rgba(255,255,255,0.15);
        }
      `}</style>
    </div>
  );
}
