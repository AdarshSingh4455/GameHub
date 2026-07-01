'use client';

import React, { useState } from 'react';
import { PlayerColor, GameConfig, GameMode, PlayerConfig, PlayerRole } from './types';

// ─── Constants ────────────────────────────────────────────────────────────

const COLOR_NAMES: Record<PlayerColor, string> = {
  RED: 'Red', BLUE: 'Blue', YELLOW: 'Yellow', GREEN: 'Green',
};

const COLOR_HEX: Record<PlayerColor, string> = {
  RED: '#ff3366', BLUE: '#3388ff', YELLOW: '#ffaa00', GREEN: '#00cc66',
};

const COLOR_EMOJI: Record<PlayerColor, string> = {
  RED: '🔴', BLUE: '🔵', YELLOW: '🟡', GREEN: '🟢',
};

// Indian Ludo clockwise order
const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

interface GameSetupProps {
  onStart: (config: GameConfig) => void;
}

type AIDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export default function GameSetup({ onStart }: GameSetupProps) {
  // Mode selection state
  const [selectedMode, setSelectedMode] = useState<GameMode>('LOCAL');

  // Local config
  const [localPlayersCount, setLocalPlayersCount] = useState<2 | 3 | 4>(4);

  // AI config
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('MEDIUM');
  const [aiCount, setAiCount] = useState<1 | 2 | 3>(3);
  const [humanColor, setHumanColor] = useState<PlayerColor>('RED');

  // Online config
  const [onlineAction, setOnlineAction] = useState<'NONE' | 'CREATE' | 'JOIN'>('NONE');
  const [roomCode, setRoomCode] = useState('');

  // ── Helper generators ──────────────────────────────────────────────────────

  const getAIConfigs = (): { activeColors: PlayerColor[]; configs: PlayerConfig[]; turnOrder: PlayerColor[] } => {
    // Determine which colors are active based on human color and AI count
    const remainingColors = ALL_COLORS.filter(c => c !== humanColor);
    const assignedAIColors = remainingColors.slice(0, aiCount);

    const activeColors = [humanColor, ...assignedAIColors];
    
    // Sort active colors in clockwise order to establish true turn order
    const turnOrder = ALL_COLORS.filter(c => activeColors.includes(c));

    const configs: PlayerConfig[] = ALL_COLORS.map(color => {
      if (color === humanColor) {
        return { color, role: 'HUMAN', name: 'You (Human)' };
      }
      if (assignedAIColors.includes(color)) {
        return { color, role: 'AI', name: `AI ${COLOR_NAMES[color]} (${aiDifficulty.toLowerCase()})` };
      }
      return { color, role: 'NONE', name: COLOR_NAMES[color] };
    });

    return { activeColors, configs, turnOrder };
  };

  const handleStartGame = () => {
    if (selectedMode === 'LOCAL') {
      const activeColors = ALL_COLORS.slice(0, localPlayersCount);
      const playerConfigs: PlayerConfig[] = ALL_COLORS.map((color, i) => ({
        color,
        role: i < localPlayersCount ? 'HUMAN' : 'NONE',
        name: `Player ${COLOR_NAMES[color]}`,
      }));
      onStart({
        mode: 'LOCAL',
        activeColors,
        playerConfigs,
      });
    } else if (selectedMode === 'VS_AI') {
      const { activeColors, configs } = getAIConfigs();
      // Embed difficulty state inside configuration name string so the game engine is informed
      const customConfigs = configs.map(c => {
        if (c.role === 'AI') {
          return {
            ...c,
            name: `🤖 AI ${COLOR_NAMES[c.color]} (${aiDifficulty})`
          };
        }
        return c;
      });

      onStart({
        mode: 'VS_AI',
        activeColors,
        playerConfigs: customConfigs,
      });
    }
  };

  const { turnOrder: aiTurnOrder } = getAIConfigs();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: '100%',
        padding: '2rem 1.5rem',
        background: 'radial-gradient(circle at 50% 10%, #15151c 0%, #09090c 100%)',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        boxSizing: 'border-box',
        position: 'relative',
        overflowY: 'auto',
      }}
    >
      {/* Animated glow background */}
      <div className="setup-glow" />

      {/* Glassmorphic setup box */}
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(20, 20, 26, 0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          padding: '2rem 1.75rem',
          boxSizing: 'border-box',
          position: 'relative',
          zIndex: 5,
        }}
      >
        {/* Banner with Logo */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ fontSize: '3rem', animation: 'float 4s infinite ease-in-out', display: 'inline-block' }}>🎲</div>
          <h1
            style={{
              margin: '0.5rem 0 0.2rem 0',
              fontSize: '1.85rem',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #ffcc00, #ff3366)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
            }}
          >
            Ludo Classic
          </h1>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#5e616c', fontWeight: 600 }}>
            Premium Board Game Arena
          </p>
        </div>

        {/* ── MODE TABS (In-place Transition Cards) ───────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            background: 'rgba(0, 0, 0, 0.25)',
            padding: '6px',
            borderRadius: '16px',
            marginBottom: '1.5rem',
          }}
        >
          {(['LOCAL', 'VS_AI', 'ONLINE'] as const).map(mode => {
            const isSel = selectedMode === mode;
            const labels = { LOCAL: 'Local', VS_AI: 'vs AI', ONLINE: 'Online' };
            const icons = { LOCAL: '👥', VS_AI: '🤖', ONLINE: '🌍' };
            return (
              <button
                key={mode}
                onClick={() => {
                  setSelectedMode(mode);
                  setOnlineAction('NONE');
                }}
                style={{
                  background: isSel
                    ? 'linear-gradient(135deg, rgba(255, 204, 0, 0.15), rgba(255, 51, 102, 0.15))'
                    : 'transparent',
                  border: `1.5px solid ${isSel ? 'rgba(255, 204, 0, 0.4)' : 'transparent'}`,
                  color: isSel ? '#ffd600' : '#8c8e9d',
                  borderRadius: '12px',
                  padding: '10px 4px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  transition: 'all 0.25s ease',
                  outline: 'none',
                }}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: '2px' }}>{icons[mode]}</div>
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {/* ── MODE CONFIGURATION (In-place Transition Panels) ─────────────── */}
        <div style={{ minHeight: '190px' }}>
          {/* LOCAL PLAY PANEL */}
          {selectedMode === 'LOCAL' && (
            <div className="fade-in-panel">
              <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#ffcc00', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Local Match Setup
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#888', lineHeight: 1.4 }}>
                Pass and play with friends on the same screen. No connection required.
              </p>

              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: '#5e616c', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Total Players
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {([2, 3, 4] as const).map(num => {
                    const activeColors = ALL_COLORS.slice(0, num);
                    return (
                      <button
                        key={num}
                        onClick={() => setLocalPlayersCount(num)}
                        style={{
                          flex: 1,
                          padding: '12px 6px',
                          borderRadius: '12px',
                          border: `1px solid ${localPlayersCount === num ? '#ff3366' : 'rgba(255,255,255,0.06)'}`,
                          background: localPlayersCount === num ? 'rgba(255, 51, 102, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                          color: localPlayersCount === num ? '#ff3366' : '#8c8e9d',
                          fontWeight: 900,
                          fontSize: '1rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {num} Players
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Player assignments preview */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '12px' }}>
                <span style={{ fontSize: '0.68rem', color: '#4c4e56', fontWeight: 700 }}>COLORS:</span>
                {ALL_COLORS.slice(0, localPlayersCount).map(color => (
                  <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 700, color: COLOR_HEX[color] }}>
                    <span>{COLOR_EMOJI[color]}</span>
                    <span>{COLOR_NAMES[color]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PLAY VS AI PANEL */}
          {selectedMode === 'VS_AI' && (
            <div className="fade-in-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#ffcc00', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  AI Practice Match
                </h3>

                {/* Difficulty selector */}
                <label style={{ display: 'block', fontSize: '0.7rem', color: '#5e616c', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  AI Difficulty
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {(['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const).map(diff => (
                    <button
                      key={diff}
                      onClick={() => setAiDifficulty(diff)}
                      style={{
                        padding: '8px 2px',
                        borderRadius: '8px',
                        border: `1.5px solid ${aiDifficulty === diff ? '#ffcc00' : 'rgba(255,255,255,0.06)'}`,
                        background: aiDifficulty === diff ? 'rgba(255,204,0,0.1)' : 'rgba(255,255,255,0.02)',
                        color: aiDifficulty === diff ? '#ffcc00' : '#8c8e9d',
                        fontSize: '0.68rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker & AI Count Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#5e616c', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    Your Color
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {ALL_COLORS.map(color => {
                      const isSel = humanColor === color;
                      return (
                        <button
                          key={color}
                          onClick={() => setHumanColor(color)}
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: COLOR_HEX[color],
                            border: `3px solid ${isSel ? '#fff' : 'transparent'}`,
                            cursor: 'pointer',
                            boxShadow: isSel ? `0 0 12px ${COLOR_HEX[color]}` : 'none',
                            transition: 'all 0.2s',
                          }}
                          title={COLOR_NAMES[color]}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', color: '#5e616c', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                    AI Opponents
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {([1, 2, 3] as const).map(num => (
                      <button
                        key={num}
                        onClick={() => setAiCount(num)}
                        style={{
                          flex: 1,
                          padding: '6px 2px',
                          borderRadius: '8px',
                          border: `1.5px solid ${aiCount === num ? '#3388ff' : 'rgba(255,255,255,0.06)'}`,
                          background: aiCount === num ? 'rgba(51, 136, 255, 0.1)' : 'rgba(255, 255, 255, 0.02)',
                          color: aiCount === num ? '#3388ff' : '#8c8e9d',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pre-game Setup Preview Card */}
              <div
                style={{
                  background: 'rgba(0,0,0,0.22)',
                  borderRadius: '14px',
                  padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                <div style={{ fontSize: '0.65rem', color: '#5e616c', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
                  Match Preview & Turn Order
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {aiTurnOrder.map((color, idx) => {
                    const isHuman = color === humanColor;
                    return (
                      <div key={color} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: '#555', fontWeight: 800 }}>{idx + 1}.</span>
                          <span style={{ color: COLOR_HEX[color], fontWeight: 800 }}>{COLOR_EMOJI[color]} {COLOR_NAMES[color]}</span>
                        </div>
                        <span style={{ color: isHuman ? '#fff' : '#666', fontWeight: 700, fontSize: '0.7rem' }}>
                          {isHuman ? '👤 You' : `🤖 AI Opponent`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ONLINE MULTIPLAYER PANEL */}
          {selectedMode === 'ONLINE' && (
            <div className="fade-in-panel" style={{ textAlign: 'center', padding: '12px 0' }}>
              <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#ffcc00', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Online Arena
              </h3>
              <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.78rem', color: '#888', lineHeight: 1.4 }}>
                Real-time online multiplayer lobby. Play with players worldwide.
              </p>

              {onlineAction === 'NONE' && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button
                    onClick={() => setOnlineAction('CREATE')}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '12px',
                      border: '1.5px solid #a855f7',
                      background: 'rgba(168, 85, 247, 0.1)',
                      color: '#c084fc',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                    }}
                  >
                    ➕ Create Room
                  </button>
                  <button
                    onClick={() => setOnlineAction('JOIN')}
                    style={{
                      padding: '12px 18px',
                      borderRadius: '12px',
                      border: '1.5px solid #00cc66',
                      background: 'rgba(0, 204, 102, 0.1)',
                      color: '#4ade80',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                    }}
                  >
                    🔑 Join Room
                  </button>
                </div>
              )}

              {onlineAction === 'CREATE' && (
                <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '8px' }}>Creating private server lobby...</div>
                  <div style={{ display: 'inline-block', background: 'rgba(255,170,0,0.12)', border: '1px solid rgba(255,170,0,0.25)', borderRadius: '8px', padding: '6px 12px', fontSize: '0.7rem', color: '#ffaa00', fontWeight: 700 }}>
                    🚧 Service Under Maintenance
                  </div>
                  <button onClick={() => setOnlineAction('NONE')} style={{ display: 'block', margin: '8px auto 0 auto', background: 'none', border: 'none', color: '#555', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 700 }}>← Back</button>
                </div>
              )}

              {onlineAction === 'JOIN' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '280px', margin: '0 auto' }}>
                  <input
                    type="text"
                    placeholder="Enter Room Code"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'rgba(0,0,0,0.2)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      textAlign: 'center',
                      outline: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setOnlineAction('NONE')} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.05)', color: '#888', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                    <button disabled style={{ flex: 1, padding: '8px', borderRadius: '8px', border: 'none', background: '#555', color: '#888', fontSize: '0.72rem', fontWeight: 700, cursor: 'not-allowed' }}>Join</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── PRIMARY CTA ACTION BUTTON ──────────────────────────────────── */}
        {selectedMode !== 'ONLINE' && (
          <button
            onClick={handleStartGame}
            style={{
              width: '100%',
              padding: '15px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #ffcc00, #ff3366)',
              color: '#fff',
              fontWeight: 900,
              fontSize: '1.05rem',
              cursor: 'pointer',
              letterSpacing: '0.02em',
              boxShadow: '0 8px 32px rgba(255, 51, 102, 0.3), 0 4px 16px rgba(255, 204, 0, 0.15)',
              transition: 'all 0.2s ease',
              marginTop: '0.5rem',
            }}
            className="setup-cta"
          >
            🎲 Start Match
          </button>
        )}
      </div>

      <style>{`
        .setup-glow {
          position: absolute;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 80%;
          height: 60%;
          background: radial-gradient(ellipse at center, rgba(255, 204, 0, 0.08) 0%, rgba(255, 51, 102, 0.04) 50%, transparent 70%);
          pointer-events: none;
          z-index: 1;
        }

        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
        }

        .fade-in-panel {
          animation: slideIn 0.25s ease-out forwards;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .setup-cta:hover {
          transform: translateY(-2px);
          filter: brightness(1.1);
          box-shadow: 0 10px 32px rgba(255, 51, 102, 0.4), 0 5px 20px rgba(255, 204, 0, 0.25);
        }
        
        .setup-cta:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}
