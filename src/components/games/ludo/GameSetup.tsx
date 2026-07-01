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

// Indian Ludo clockwise order
const ALL_COLORS: PlayerColor[] = ['RED', 'GREEN', 'YELLOW', 'BLUE'];

// ─── Types ────────────────────────────────────────────────────────────────

type SetupStep = 'MODE' | 'CONFIG';

interface GameSetupProps {
  onStart: (config: GameConfig) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function ModeCard({
  icon,
  title,
  description,
  badge,
  selected,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  badge?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: selected
          ? 'linear-gradient(135deg, rgba(255,204,0,0.12), rgba(255,51,102,0.10))'
          : 'rgba(255,255,255,0.03)',
        border: `2px solid ${selected ? '#ffcc00' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: '18px',
        padding: '1.5rem 1.25rem',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.25s ease',
        position: 'relative',
        flex: '1 1 0',
        minWidth: '120px',
        boxShadow: selected ? '0 0 24px rgba(255,204,0,0.18)' : 'none',
        color: '#fff',
        outline: 'none',
      }}
    >
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '50px',
            fontSize: '0.6rem',
            fontWeight: 800,
            padding: '2px 8px',
            color: '#aaa',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {badge}
        </div>
      )}
      <div style={{ fontSize: '2.25rem', marginBottom: '0.6rem', lineHeight: 1 }}>{icon}</div>
      <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.3rem' }}>{title}</div>
      <div style={{ fontSize: '0.75rem', color: '#888', lineHeight: '1.4' }}>{description}</div>
      {selected && (
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '12px',
            fontSize: '1rem',
          }}
        >
          ✓
        </div>
      )}
    </button>
  );
}

function ColorToken({ color, size = 40 }: { color: PlayerColor; size?: number }) {
  const hex = COLOR_HEX[color];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <defs>
        <radialGradient id={`token-${color}`} cx="38%" cy="32%" r="60%">
          <stop offset="0%" stopColor={hex} stopOpacity="1" />
          <stop offset="100%" stopColor={hex} stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <circle cx="20" cy="22" r="13" fill="rgba(0,0,0,0.35)" />
      <circle cx="20" cy="20" r="16" fill={`url(#token-${color})`} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="5" fill={hex} opacity={0.6} />
      <circle cx="14" cy="14" r="4" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

// ─── Main Setup Component ──────────────────────────────────────────────────

export default function GameSetup({ onStart }: GameSetupProps) {
  const [step, setStep] = useState<SetupStep>('MODE');
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  // LOCAL / VS_AI configuration
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4>(4);
  const [humanColor, setHumanColor] = useState<PlayerColor>('RED');
  const [aiCount, setAiCount] = useState<1 | 2 | 3>(3);

  // Online
  const [onlineAction, setOnlineAction] = useState<'CREATE' | 'JOIN' | null>(null);
  const [roomCode, setRoomCode] = useState('');

  // ── Handlers ──────────────────────────────────────────────────────────

  const selectMode = (mode: GameMode) => {
    setSelectedMode(mode);
    setStep('CONFIG');
  };

  const buildLocalConfig = (): GameConfig => {
    const count = playerCount;
    // Select `count` colors from the clockwise order
    const activeColors = ALL_COLORS.slice(0, count);
    const playerConfigs: PlayerConfig[] = ALL_COLORS.map((color, i) => ({
      color,
      role: i < count ? 'HUMAN' : 'NONE',
      name: `Player ${COLOR_NAMES[color]}`,
    }));
    return { mode: 'LOCAL', activeColors, playerConfigs };
  };

  const buildAIConfig = (): GameConfig => {
    const aiColors = ALL_COLORS.filter(c => c !== humanColor).slice(0, aiCount);
    const activeColors = [humanColor, ...aiColors];
    const playerConfigs: PlayerConfig[] = ALL_COLORS.map(color => {
      if (color === humanColor) return { color, role: 'HUMAN', name: 'You' };
      if (aiColors.includes(color)) return { color, role: 'AI', name: `AI ${COLOR_NAMES[color]}` };
      return { color, role: 'NONE', name: COLOR_NAMES[color] };
    });
    return { mode: 'VS_AI', activeColors, playerConfigs };
  };

  const handleStart = () => {
    if (!selectedMode) return;
    if (selectedMode === 'LOCAL') onStart(buildLocalConfig());
    else if (selectedMode === 'VS_AI') onStart(buildAIConfig());
    // Online: placeholder — handled by join/create UI
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        width: '100%',
        padding: '2rem 1.25rem',
        background: 'linear-gradient(160deg, #0c0c10 0%, #141418 60%, #0f0f14 100%)',
        color: '#fff',
        fontFamily: "'Inter', -apple-system, sans-serif",
        boxSizing: 'border-box',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient top glow */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '50%',
          background: 'radial-gradient(ellipse, rgba(255,204,0,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2rem' }}>
        <span style={{ fontSize: '2.5rem' }}>🎲</span>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: '2rem',
              fontWeight: 900,
              background: 'linear-gradient(90deg, #ffcc00, #ff3366)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.03em',
            }}
          >
            Ludo Classic
          </h1>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#555', fontWeight: 600 }}>
            The authentic Indian board game
          </p>
        </div>
      </div>

      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
      >
        {/* ── Step 1: Mode Selection ──────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            {step === 'MODE' ? 'Select game mode' : 'Game mode'}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <ModeCard
              icon="👥"
              title="Local Play"
              description="Pass & play on one device"
              selected={selectedMode === 'LOCAL'}
              onClick={() => selectMode('LOCAL')}
            />
            <ModeCard
              icon="🤖"
              title="vs AI"
              description="Practice against bot players"
              badge="Beta"
              selected={selectedMode === 'VS_AI'}
              onClick={() => selectMode('VS_AI')}
            />
            <ModeCard
              icon="🌐"
              title="Online"
              description="Play with friends online"
              badge="Soon"
              selected={selectedMode === 'ONLINE'}
              onClick={() => selectMode('ONLINE')}
            />
          </div>
        </div>

        {/* ── Step 2: Config ──────────────────────────────────────────────── */}
        {step === 'CONFIG' && selectedMode === 'LOCAL' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '1.25rem',
              animation: 'slideDown 0.25s ease',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '1rem' }}>
              Number of players
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {([2, 3, 4] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setPlayerCount(n)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    border: `2px solid ${playerCount === n ? '#ffcc00' : 'rgba(255,255,255,0.08)'}`,
                    background: playerCount === n ? 'rgba(255,204,0,0.12)' : 'rgba(255,255,255,0.03)',
                    color: playerCount === n ? '#ffcc00' : '#888',
                    fontWeight: 800,
                    fontSize: '1.1rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Show which colors will play */}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.72rem', color: '#555', fontWeight: 600 }}>Playing:</span>
              {ALL_COLORS.slice(0, playerCount).map(color => (
                <div key={color} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ColorToken color={color} size={28} />
                  <span style={{ fontSize: '0.7rem', color: COLOR_HEX[color], fontWeight: 700 }}>{COLOR_NAMES[color]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'CONFIG' && selectedMode === 'VS_AI' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '1.25rem',
              animation: 'slideDown 0.25s ease',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}
          >
            {/* Color picker */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                Your color
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                {ALL_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setHumanColor(color)}
                    style={{
                      background: 'none',
                      border: `2.5px solid ${humanColor === color ? COLOR_HEX[color] : 'transparent'}`,
                      borderRadius: '50%',
                      padding: '4px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: humanColor === color ? `0 0 16px ${COLOR_HEX[color]}66` : 'none',
                    }}
                    title={COLOR_NAMES[color]}
                  >
                    <ColorToken color={color} size={44} />
                  </button>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '6px', fontSize: '0.75rem', color: COLOR_HEX[humanColor], fontWeight: 700 }}>
                Playing as {COLOR_NAMES[humanColor]}
              </div>
            </div>

            {/* AI count */}
            <div>
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                AI opponents
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {([1, 2, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => setAiCount(n)}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '12px',
                      border: `2px solid ${aiCount === n ? '#a855f7' : 'rgba(255,255,255,0.08)'}`,
                      background: aiCount === n ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                      color: aiCount === n ? '#a855f7' : '#888',
                      fontWeight: 800,
                      fontSize: '1rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {n} 🤖
                  </button>
                ))}
              </div>

              {/* Show opponent assignment */}
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ALL_COLORS.filter(c => c !== humanColor).slice(0, aiCount).map(color => (
                  <div
                    key={color}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      background: `${COLOR_HEX[color]}15`,
                      border: `1px solid ${COLOR_HEX[color]}33`,
                      borderRadius: '50px',
                      padding: '4px 10px',
                    }}
                  >
                    <ColorToken color={color} size={20} />
                    <span style={{ fontSize: '0.7rem', color: COLOR_HEX[color], fontWeight: 700 }}>
                      AI {COLOR_NAMES[color]}
                    </span>
                    <span style={{ fontSize: '0.65rem' }}>🤖</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'CONFIG' && selectedMode === 'ONLINE' && (
          <div
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: '16px',
              padding: '1.5rem',
              animation: 'slideDown 0.25s ease',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🌐</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: '0.4rem' }}>Online Multiplayer</div>
            <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '1.25rem', lineHeight: 1.5 }}>
              Real-time online play is coming soon. For now, try Local Play or vs AI!
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                disabled
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#555',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'not-allowed',
                }}
              >
                ➕ Create Room
              </button>
              <button
                disabled
                style={{
                  padding: '12px 20px',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'rgba(255,255,255,0.04)',
                  color: '#555',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'not-allowed',
                }}
              >
                🔑 Join Room
              </button>
            </div>

            <div
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                background: 'rgba(255,170,0,0.12)',
                border: '1px solid rgba(255,170,0,0.25)',
                borderRadius: '8px',
                padding: '6px 14px',
                fontSize: '0.7rem',
                color: '#ffaa00',
                fontWeight: 700,
              }}
            >
              🚧 Coming in next sprint
            </div>
          </div>
        )}

        {/* ── Start Button ─────────────────────────────────────────────────── */}
        {step === 'CONFIG' && selectedMode !== 'ONLINE' && (
          <button
            onClick={handleStart}
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: 'linear-gradient(135deg, #ffcc00, #ff3366)',
              color: '#fff',
              fontWeight: 900,
              fontSize: '1.1rem',
              cursor: 'pointer',
              letterSpacing: '-0.01em',
              boxShadow: '0 8px 32px rgba(255,51,102,0.35), 0 4px 16px rgba(255,204,0,0.2)',
              transition: 'all 0.2s ease',
              animation: 'slideUp 0.3s ease',
            }}
          >
            🎲 Start Game
          </button>
        )}

        {/* Back to mode selection */}
        {step === 'CONFIG' && (
          <button
            onClick={() => { setStep('MODE'); setSelectedMode(null); }}
            style={{
              background: 'none',
              border: 'none',
              color: '#555',
              fontSize: '0.78rem',
              cursor: 'pointer',
              fontWeight: 600,
              textAlign: 'center',
              padding: '4px',
            }}
          >
            ← Change mode
          </button>
        )}
      </div>

      {/* Token decoration (bottom corners) */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '0',
          right: '0',
          display: 'flex',
          justifyContent: 'center',
          gap: '12px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      >
        {ALL_COLORS.map(c => <ColorToken key={c} color={c} size={28} />)}
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
