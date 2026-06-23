'use client'

import React, { useState, useEffect } from 'react'
import { useSocket } from '@/lib/contexts/SocketContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { validateAndSuggest } from '@/lib/wordValidation'
import WordValidationModal from '@/components/shared/WordValidationModal'
import MatchReactions from './MatchReactions'

interface Player {
  userId: string
  username: string
}

interface MultiplayerHangmanGameProps {
  roomCode: string
  session: any
  players: Player[]
  currentUserId: string
  onLeave: () => void
}

export default function MultiplayerHangmanGame({
  roomCode,
  session,
  players,
  currentUserId,
  onLeave,
}: MultiplayerHangmanGameProps) {
  const { socket } = useSocket()
  const { addToast } = useToast()

  // Game state shortcuts
  const gameState = session?.gameState || {}
  const stage = gameState.stage || 'WORD_SUBMISSION'
  const isP1 = currentUserId === gameState.p1Id
  const opponentId = isP1 ? gameState.p2Id : gameState.p1Id
  const opponent = players.find(p => p.userId === opponentId) || { username: 'Opponent' }

  // Local UI States
  const [secretWordInput, setSecretWordInput] = useState('')
  const [isWordSubmitted, setIsWordSubmitted] = useState(false)

  // Validation Suggestion States
  const [validationModalOpen, setValidationModalOpen] = useState(false)
  const [originalWord, setOriginalWord] = useState('')
  const [suggestedWord, setSuggestedWord] = useState('')

  // Full Word Guess States
  const [fullGuessInput, setFullGuessInput] = useState('')
  const [guessModalOpen, setGuessModalOpen] = useState(false)

  // Map state values relative to current player
  const myWord = isP1 ? gameState.p1Word : gameState.p2Word
  const opponentWord = isP1 ? gameState.p2Word : gameState.p1Word // masked from server
  const myGuesses = isP1 ? gameState.p1Guesses || [] : gameState.p2Guesses || []
  const opponentGuesses = isP1 ? gameState.p2Guesses || [] : gameState.p1Guesses || []
  const opponentSolvedCount = myWord
    ? (gameState.winnerId === opponentId
        ? myWord.length
        : myWord.split('').filter((char: string) => opponentGuesses.includes(char)).length)
    : 0
  const myLives = isP1 ? gameState.p1Lives : gameState.p2Lives
  const opponentLives = isP1 ? gameState.p2Lives : gameState.p1Id ? gameState.p1Lives : 8
  const myIncorrect = isP1 ? gameState.p1IncorrectGuesses || [] : gameState.p2IncorrectGuesses || []
  const opponentIncorrect = isP1 ? gameState.p2IncorrectGuesses || [] : gameState.p1IncorrectGuesses || []
  const myGuessesLeft = isP1 ? gameState.p1FullGuessesLeft : gameState.p2FullGuessesLeft

  const isMyTurn = gameState.currentTurn === currentUserId

  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [showTimeoutOverlay, setShowTimeoutOverlay] = useState(false)
  const [timeoutPlayerName, setTimeoutPlayerName] = useState('')

  // Calculate time left based on turnExpiration from server
  useEffect(() => {
    if (stage !== 'PLAYING' || !gameState.turnExpiration) {
      setTimeLeft(null)
      return
    }

    const calculateTime = () => {
      const exp = new Date(gameState.turnExpiration).getTime()
      const diff = Math.max(0, Math.round((exp - Date.now()) / 1000))
      setTimeLeft(diff)
    }

    calculateTime()
    const interval = setInterval(calculateTime, 1000)
    return () => clearInterval(interval)
  }, [stage, gameState.turnExpiration])

  // Monitor lastMove for TIMEOUT move to trigger overlay
  useEffect(() => {
    if (session?.lastMove?.move?.type === 'TIMEOUT') {
      const timedOutUserId = session.lastMove.userId
      const player = players.find(p => p.userId === timedOutUserId)
      setTimeoutPlayerName(player ? player.username : 'A player')
      setShowTimeoutOverlay(true)
      const timer = setTimeout(() => {
        setShowTimeoutOverlay(false)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [session?.lastMove, players])

  // Check if current player has already submitted word
  useEffect(() => {
    if (stage === 'WORD_SUBMISSION') {
      if ((isP1 && gameState.p1Word) || (!isP1 && gameState.p2Word)) {
        setIsWordSubmitted(true)
      } else {
        setIsWordSubmitted(false)
      }
    }
  }, [stage, gameState.p1Word, gameState.p2Word, isP1])

  // Word submission handler with validation
  const handleWordSubmit = (wordToSubmit: string) => {
    const cleanWord = wordToSubmit.trim().toUpperCase()
    if (!cleanWord || cleanWord.length < 3 || !/^[A-Z]+$/.test(cleanWord)) {
      addToast('warning', 'Invalid Word ⚠️', 'Word must contain only letters and be at least 3 letters long.')
      return
    }

    const suggestion = validateAndSuggest(cleanWord)
    if (suggestion) {
      setOriginalWord(cleanWord)
      setSuggestedWord(suggestion)
      setValidationModalOpen(true)
    } else {
      emitWord(cleanWord)
    }
  }

  const emitWord = (word: string) => {
    if (!socket) return
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'SUBMIT_WORD', word }
    }, (res: any) => {
      if (res?.error) {
        addToast('error', 'Error', res.error)
      } else {
        setIsWordSubmitted(true)
        addToast('success', 'Word Submitted 👍', 'Waiting for opponent...')
      }
    })
  }

  // Guess Letter
  const handleLetterGuess = (letter: string) => {
    if (!isMyTurn || myGuesses.includes(letter) || stage !== 'PLAYING') return
    if (!socket) return

    socket.emit('submit-move', {
      roomCode,
      move: { type: 'GUESS_LETTER', letter }
    }, (res: any) => {
      if (res?.error) {
        addToast('error', 'Error', res.error)
      }
    })
  }

  // Guess Word
  const handleFullWordGuess = () => {
    const guess = fullGuessInput.trim().toUpperCase()
    if (!guess || !/^[A-Z]+$/.test(guess)) {
      addToast('warning', 'Invalid Guess ⚠️', 'Please enter a valid word.')
      return
    }
    if (!socket) return

    setGuessModalOpen(false)
    socket.emit('submit-move', {
      roomCode,
      move: { type: 'GUESS_WORD', word: guess }
    }, (res: any) => {
      if (res?.error) {
        addToast('error', 'Error', res.error)
      }
      setFullGuessInput('')
    })
  }

  // Replay Vote
  const handleReplayVote = () => {
    if (!socket) return
    socket.emit('vote-replay', { roomCode })
  }

  // SVG drawing helper for hangman
  const renderHangmanSVG = (livesRemaining: number) => {
    const errorCount = 8 - livesRemaining
    return (
      <svg width="70" height="70" viewBox="0 0 100 100" style={{ display: 'block' }}>
        {/* Base */}
        {errorCount >= 1 && <line x1="10" y1="90" x2="90" y2="90" stroke="white" strokeWidth="5" />}
        {/* Post */}
        {errorCount >= 2 && <line x1="30" y1="90" x2="30" y2="10" stroke="white" strokeWidth="5" />}
        {/* Beam */}
        {errorCount >= 3 && <line x1="30" y1="10" x2="70" y2="10" stroke="white" strokeWidth="5" />}
        {/* Rope */}
        {errorCount >= 4 && <line x1="70" y1="10" x2="70" y2="25" stroke="white" strokeWidth="3" />}
        {/* Head */}
        {errorCount >= 5 && <circle cx="70" cy="35" r="10" stroke="white" strokeWidth="4" fill="none" />}
        {/* Body */}
        {errorCount >= 6 && <line x1="70" y1="45" x2="70" y2="70" stroke="white" strokeWidth="4" />}
        {/* Arms */}
        {errorCount >= 7 && <line x1="70" y1="55" x2="50" y2="50" stroke="white" strokeWidth="4" />}
        {errorCount >= 7 && <line x1="70" y1="55" x2="90" y2="50" stroke="white" strokeWidth="4" />}
        {/* Legs */}
        {errorCount >= 8 && <line x1="70" y1="70" x2="55" y2="85" stroke="white" strokeWidth="4" />}
        {errorCount >= 8 && <line x1="70" y1="70" x2="85" y2="85" stroke="white" strokeWidth="4" />}
      </svg>
    )
  }

  // Count how many characters are solved in the masked word representation
  const countSolvedCharacters = (wordRep: string) => {
    if (!wordRep) return 0
    return wordRep.split('').filter(c => c !== '_' && c !== ' ').length
  }

  return (
    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative' }}>
      
      {/* 1. WORD SUBMISSION STAGE */}
      {stage === 'WORD_SUBMISSION' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', borderRadius: 16 }}>
          <div>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>✍️</span>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800 }}>Enter Your Secret Word</h3>
            <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.85rem' }}>
              Submit the word your opponent will have to guess. Minimum 3 letters.
            </p>
          </div>

          {!isWordSubmitted ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="ENTER WORD"
                value={secretWordInput}
                onChange={e => setSecretWordInput(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
                style={{
                  width: '100%', padding: '0.75rem', borderRadius: 12, backgroundColor: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 18%)',
                  color: 'white', fontWeight: 800, textAlign: 'center', letterSpacing: '0.1em', fontSize: '1.2rem', outline: 'none'
                }}
              />
              <button
                onClick={() => handleWordSubmit(secretWordInput)}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', borderRadius: 12, fontWeight: 700 }}
              >
                Submit Word 🚀
              </button>
            </div>
          ) : (
            <div style={{ padding: '1.5rem', background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: 'hsl(220 100% 60%)', animation: 'spin 0.8s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 60%)' }}>
                Your word is submitted. Waiting for {opponent.username} to submit...
              </span>
            </div>
          )}
        </div>
      )}

      {/* 2. PLAYING STAGE */}
      {stage === 'PLAYING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fadeIn">
          {/* HUD Turn Indicator */}
          <div
            style={{
              padding: '0.75rem', borderRadius: 12, textAlign: 'center', fontWeight: 800, fontSize: '0.95rem', border: '1px solid',
              borderColor: isMyTurn ? 'hsl(220 100% 50% / 0.3)' : 'hsl(220 15% 18%)',
              background: isMyTurn ? 'linear-gradient(90deg, hsl(220 100% 60% / 0.1), hsl(270 80% 60% / 0.1))' : 'hsl(220 20% 8%)',
              color: isMyTurn ? 'hsl(220 100% 70%)' : 'hsl(220 10% 60%)'
            }}
          >
            {isMyTurn 
              ? `👉 It is Your Turn! ${timeLeft !== null ? `⏳ ${timeLeft}s` : ''}` 
              : `⏳ Waiting for ${opponent.username}... ${timeLeft !== null ? `(${timeLeft}s)` : ''}`
            }
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            {/* My Gameboard */}
            <div style={isMyTurn && timeLeft !== null ? {
              background: `conic-gradient(from 0deg, hsl(220 100% 60%) ${Math.min(360, Math.round((timeLeft / 60) * 360))}deg, rgba(255,255,255,0.05) ${Math.min(360, Math.round((timeLeft / 60) * 360))}deg)`,
              padding: '3px',
              borderRadius: '16px',
              boxShadow: '0 0 15px hsl(220 100% 60% / 0.3)',
              transition: 'background 0.5s linear'
            } : { padding: '3px' }}>
              <div className="card glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: 14, background: 'hsl(222 20% 10%)', position: 'relative', height: '100%' }}>
                {isMyTurn && timeLeft !== null && (
                  <span style={{
                    position: 'absolute', top: '10px', right: '10px',
                    backgroundColor: 'hsl(220 100% 50%)', color: 'white',
                    padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800
                  }}>
                    ⏳ {timeLeft}s
                  </span>
                )}
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(270 80% 75%)', textTransform: 'uppercase' }}>
                  Your Puzzle
                </div>
                <div style={{ minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderHangmanSVG(myLives)}
                </div>
                {/* Masked opponent's word representation */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', flexWrap: 'wrap', margin: '0.5rem 0' }}>
                  {(opponentWord || '').split('').map((char: string, index: number) => (
                    <span
                      key={index}
                      style={{
                        width: 14, height: 22, borderBottom: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.95rem', fontWeight: 800, color: char !== '_' ? 'white' : 'transparent',
                        borderColor: char !== '_' ? 'hsl(220 100% 60%)' : 'hsl(220 15% 25%)'
                      }}
                    >
                      {char !== '_' ? char : ''}
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', textAlign: 'center' }}>
                  ❤️ Lives: <strong style={{ color: 'white' }}>{myLives}</strong>
                </div>
              </div>
            </div>

            {/* Opponent Progress Board */}
            <div style={!isMyTurn && timeLeft !== null ? {
              background: `conic-gradient(from 0deg, hsl(220 100% 60%) ${Math.min(360, Math.round((timeLeft / 60) * 360))}deg, rgba(255,255,255,0.05) ${Math.min(360, Math.round((timeLeft / 60) * 360))}deg)`,
              padding: '3px',
              borderRadius: '16px',
              boxShadow: '0 0 15px hsl(220 100% 60% / 0.3)',
              transition: 'background 0.5s linear'
            } : { padding: '3px' }}>
              <div className="card glass" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', borderRadius: 14, opacity: 0.85, background: 'hsl(222 20% 10%)', position: 'relative', height: '100%' }}>
                {!isMyTurn && timeLeft !== null && (
                  <span style={{
                    position: 'absolute', top: '10px', right: '10px',
                    backgroundColor: 'hsl(220 100% 50%)', color: 'white',
                    padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 800
                  }}>
                    ⏳ {timeLeft}s
                  </span>
                )}
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 55%)', textTransform: 'uppercase' }}>
                  {opponent.username} Progress
                </div>
                <div style={{ minHeight: 70, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderHangmanSVG(opponentLives)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', margin: '0.5rem 0' }}>
                  <span style={{ fontSize: '0.75rem', color: 'hsl(220 10% 55%)' }}>Solved Letters:</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'white' }}>
                    {opponentSolvedCount}
                    <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 50%)' }}>
                      /{myWord?.length || 0}
                    </span>
                  </span>
                </div>
                <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 55%)', textAlign: 'center' }}>
                  ❤️ Lives: <strong style={{ color: 'white' }}>{opponentLives}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Action options */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setGuessModalOpen(true)}
              disabled={!isMyTurn || myGuessesLeft <= 0}
              className="btn btn-secondary"
              style={{ flex: 1, borderRadius: 10, fontSize: '0.8rem', padding: '0.5rem' }}
            >
              💡 Guess Word ({myGuessesLeft} left)
            </button>
            <button
              onClick={onLeave}
              className="btn btn-ghost"
              style={{ flex: 1, borderRadius: 10, fontSize: '0.8rem', padding: '0.5rem', border: '1px solid hsl(220 15% 18%)' }}
            >
              🚪 Quit Room
            </button>
          </div>

          {/* Interactive virtual keyboard */}
          <div className="card glass" style={{ padding: '0.75rem', borderRadius: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.3rem' }}>
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
                const isGuessed = myGuesses.includes(letter)
                const isCorrect = isGuessed && opponentWord?.includes(letter)

                let bg = 'hsl(220 20% 9%)'
                let text = 'hsl(220 10% 70%)'
                if (isGuessed) {
                  bg = isCorrect ? 'hsl(142 70% 45% / 0.15)' : 'hsl(350 90% 60% / 0.12)'
                  text = isCorrect ? 'hsl(142 70% 55%)' : 'hsl(350 90% 65%)'
                }

                return (
                  <button
                    key={letter}
                    disabled={isGuessed || !isMyTurn}
                    onClick={() => handleLetterGuess(letter)}
                    style={{
                      height: 38, border: '1px solid hsl(220 15% 18%)', borderRadius: 8, fontSize: '0.9rem', fontWeight: 800, cursor: isGuessed || !isMyTurn ? 'default' : 'pointer',
                      backgroundColor: bg,
                      color: text,
                      borderColor: isGuessed ? 'transparent' : 'hsl(220 15% 18%)',
                      opacity: isGuessed || !isMyTurn ? 0.6 : 1,
                      transition: 'all 0.15s'
                    }}
                  >
                    {letter}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. FINISHED STAGE */}
      {stage === 'FINISHED' && (
        <div className="card glass text-center animate-fadeIn" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', borderRadius: 16 }}>
          {gameState.winnerId === currentUserId ? (
            <div>
              <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>🏆</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(142 70% 50%)' }}>Victory!</h2>
              <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Superb! You solved the word first and won the match.
              </p>
            </div>
          ) : (
            <div>
              <span style={{ fontSize: '3.5rem', display: 'block', marginBottom: '0.5rem' }}>💀</span>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(350 90% 55%)' }}>Defeated</h2>
              <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                Your opponent solved their puzzle first!
              </p>
            </div>
          )}

          <div style={{ background: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 15%)', borderRadius: 12, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'hsl(220 10% 55%)' }}>Word you guessed:</span>
              <strong style={{ color: 'white', letterSpacing: '0.05em' }}>{opponentWord}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'hsl(220 10% 55%)' }}>Word opponent guessed:</span>
              <strong style={{ color: 'white', letterSpacing: '0.05em' }}>{isP1 ? gameState.p1Word : gameState.p2Word}</strong>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleReplayVote} className="btn btn-primary" style={{ flex: 2, padding: '0.75rem', borderRadius: 12, fontWeight: 700 }}>
              Vote Replay 🔄
            </button>
            <button onClick={onLeave} className="btn btn-secondary" style={{ flex: 1, padding: '0.75rem', borderRadius: 12, fontWeight: 700 }}>
              Leave Room
            </button>
          </div>
        </div>
      )}

      {/* Word Validation Did you mean modal */}
      <WordValidationModal
        isOpen={validationModalOpen}
        originalWord={originalWord}
        suggestedWord={suggestedWord}
        onUseSuggestion={() => {
          setValidationModalOpen(false)
          setSecretWordInput(suggestedWord)
          emitWord(suggestedWord)
        }}
        onKeepOriginal={() => {
          setValidationModalOpen(false)
          emitWord(originalWord)
        }}
      />

      {/* Full Guess Modal Overlay */}
      {guessModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(5,8,16,0.85)', backdropFilter: 'blur(8px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div className="card glass" style={{ background: 'hsl(222 18% 12% / 0.95)', border: '1px solid hsl(220 15% 22%)', borderRadius: 20, padding: '2rem', maxWidth: 400, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="text-center">
              <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.25rem' }}>💡</span>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Guess Opponent Word</h3>
              <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.82rem', marginTop: '0.25rem' }}>
                If you guess incorrectly and run out of attempts ({myGuessesLeft} left), you will immediately lose the match!
              </p>
            </div>

            <input
              type="text"
              placeholder="ENTER ENTIRE WORD"
              value={fullGuessInput}
              onChange={e => setFullGuessInput(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase())}
              style={{
                width: '100%', padding: '0.75rem', borderRadius: 12, backgroundColor: 'hsl(220 20% 7%)', border: '1px solid hsl(220 15% 18%)',
                color: 'white', fontWeight: 800, textAlign: 'center', letterSpacing: '0.05em', outline: 'none', fontSize: '1.2rem'
              }}
            />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleFullWordGuess} className="btn btn-primary" style={{ flex: 2, padding: '0.65rem', borderRadius: 10, fontWeight: 700 }}>
                Submit Guess 🚀
              </button>
              <button onClick={() => setGuessModalOpen(false)} className="btn btn-secondary" style={{ flex: 1, padding: '0.65rem', borderRadius: 10, fontWeight: 700 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Floating Reactions overlay */}
      {stage === 'PLAYING' && (
        <MatchReactions
          socket={socket}
          roomCode={roomCode}
          currentUserId={currentUserId}
          players={players}
        />
      )}

      {/* Timeout Overlay */}
      {showTimeoutOverlay && (
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(5, 8, 16, 0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, borderRadius: 16,
          backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card glass text-center" style={{
            padding: '2rem', border: '1px solid hsl(0 80% 50% / 0.4)',
            background: 'hsl(0 80% 50% / 0.1)', borderRadius: 14,
            boxShadow: '0 0 20px hsl(0 80% 50% / 0.2)'
          }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'hsl(0 80% 65%)', margin: 0 }}>
              ⏰ TIME OUT
            </h3>
            <p style={{ color: 'white', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 700 }}>
              {timeoutPlayerName} lost a life due to timeout! 💔
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
