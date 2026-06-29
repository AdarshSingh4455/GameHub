import { LightbulbIcon } from '@/components/shared/Icons'
import React from 'react'

interface WordValidationModalProps {
  isOpen: boolean
  originalWord: string
  suggestedWord: string
  onUseSuggestion: () => void
  onKeepOriginal: () => void
}

export default function WordValidationModal({
  isOpen,
  originalWord,
  suggestedWord,
  onUseSuggestion,
  onKeepOriginal,
}: WordValidationModalProps) {
  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(5, 8, 16, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="card glass"
        style={{
          background: 'linear-gradient(185deg, hsl(222 20% 10%), hsl(222 18% 14%))',
          border: '1px solid hsl(220 15% 22%)',
          borderRadius: 20,
          padding: '2rem',
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto' }}><LightbulbIcon size={48} className="text-yellow-400" /></div>
        
        <div>
          <h3
            style={{
              fontSize: '1.25rem',
              fontWeight: 800,
              color: 'white',
              marginBottom: '0.5rem',
            }}
          >
            Spelling Suggestion
          </h3>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>
            We found a similar word in our dictionary. Did you mean:
          </p>
        </div>

        <div
          style={{
            background: 'hsl(220 20% 8%)',
            border: '1px solid hsl(220 15% 18%)',
            padding: '1rem',
            borderRadius: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', textTransform: 'uppercase', fontWeight: 700 }}>
            Suggested:
          </div>
          <div
            style={{
              fontSize: '1.5rem',
              fontWeight: 800,
              color: 'hsl(220 100% 70%)',
              letterSpacing: '0.05em',
            }}
          >
            &quot;{suggestedWord}&quot;
          </div>
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginTop: '0.25rem' }}>
            Original word: &quot;{originalWord}&quot;
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button
            onClick={onUseSuggestion}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.9rem',
              background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(270 80% 60%))',
              border: 'none',
              cursor: 'pointer',
              color: 'white',
            }}
          >
            Use &quot;{suggestedWord}&quot;
          </button>
          
          <button
            onClick={onKeepOriginal}
            className="btn btn-secondary"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: 12,
              fontWeight: 700,
              fontSize: '0.9rem',
              backgroundColor: 'transparent',
              border: '1px solid hsl(220 15% 25%)',
              cursor: 'pointer',
              color: 'hsl(220 10% 80%)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'hsl(220 10% 50%)'
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'hsl(220 15% 25%)'
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Keep Original Word
          </button>
        </div>
      </div>
    </div>
  )
}
