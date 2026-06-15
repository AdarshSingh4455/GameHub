'use client'

import { useState, useEffect } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import {
  TossResolver,
  InningsManager,
  CricketEngine,
  MatchState,
  Team,
  TossChoice,
  TossOutcome,
  BallRecord
} from '@/lib/cricketEngine'

type GameStep = 'setup' | 'toss' | 'toss_result' | 'play' | 'ended'

export default function CricketGame() {
  const { submitGameResult } = useGameSession()

  // Match Configuration
  const [overs, setOvers] = useState<number>(2)
  const [wickets, setWickets] = useState<number>(3)

  // Step state
  const [step, setStep] = useState<GameStep>('setup')

  // Toss state
  const [tossResult, setTossResult] = useState<{ tossWinner: Team; outcome: TossOutcome } | null>(null)
  const [tossChosenRole, setTossChosenRole] = useState<TossChoice | null>(null)
  const [isTossing, setIsTossing] = useState<boolean>(false)

  // Match State
  const [matchState, setMatchState] = useState<MatchState | null>(null)
  const [lastBall, setLastBall] = useState<BallRecord | null>(null)
  const [isAnimating, setIsAnimating] = useState<boolean>(false)
  const [commentary, setCommentary] = useState<string[]>([])

  // Reset function
  const handleReset = () => {
    setOvers(2)
    setWickets(3)
    setStep('setup')
    setTossResult(null)
    setTossChosenRole(null)
    setIsTossing(false)
    setMatchState(null)
    setLastBall(null)
    setIsAnimating(false)
    setCommentary([])
  }

  // Listen to global replay event
  useEffect(() => {
    const handleReplay = () => {
      handleReset()
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  }, [])

  // Handle Toss Flip
  const handleToss = (call: TossOutcome) => {
    setIsTossing(true)
    
    // Simulate coin spin animation delay
    setTimeout(() => {
      const result = TossResolver.resolveToss(call)
      setTossResult(result)
      setIsTossing(false)
      setStep('toss_result')
      
      if (result.tossWinner === 'cpu') {
        const cpuChoice = TossResolver.getCpuChoice()
        setTossChosenRole(cpuChoice)
      }
    }, 1200)
  }

  // Start the match after toss selection
  const startMatch = (choice?: TossChoice) => {
    if (!tossResult) return

    const actualChoice = choice || tossChosenRole
    if (!actualChoice) return

    let innings1Batting: Team = 'player'
    let innings1Bowling: Team = 'cpu'

    if (tossResult.tossWinner === 'player') {
      if (actualChoice === 'bowl') {
        innings1Batting = 'cpu'
        innings1Bowling = 'player'
      }
    } else {
      if (actualChoice === 'bowl') {
        // CPU won and chose to bowl first, so player bats
        innings1Batting = 'player'
        innings1Bowling = 'cpu'
      } else {
        // CPU won and chose to bat first
        innings1Batting = 'cpu'
        innings1Bowling = 'player'
      }
    }

    const initialMatchState: MatchState = {
      overs,
      wickets,
      phase: 'innings1',
      tossWinner: tossResult.tossWinner,
      tossChoice: actualChoice,
      innings1: InningsManager.createInnings(innings1Batting, innings1Bowling),
    }

    setMatchState(initialMatchState)
    setStep('play')
    setCommentary([
      `🏏 Match started! ${innings1Batting === 'player' ? 'You' : 'CPU'} will bat first.`,
      `🔧 Limit: ${overs} Overs | ${wickets} Wickets.`
    ])
  }

  // Handle Pick Selection
  const handlePlayBall = (playerPick: number) => {
    if (!matchState || isAnimating) return

    setIsAnimating(true)
    const cpuPick = CricketEngine.getCpuPick()

    // 600ms animation reveal delay
    setTimeout(() => {
      try {
        const { nextState, ballRecord } = CricketEngine.playBall(matchState, playerPick, cpuPick)
        setMatchState(nextState)
        setLastBall(ballRecord)
        setIsAnimating(false)

        // Generate commentary line
        const currentInnings = nextState.phase === 'innings2' && !nextState.innings2?.isCompleted
          ? nextState.innings2
          : nextState.innings1;
        
        if (!currentInnings) return;

        const isPlayerBatting = currentInnings.battingTeam === 'player'
        
        let comment = ''
        if (ballRecord.isOut) {
          comment = `🔴 OUT! ${isPlayerBatting ? 'You' : 'CPU'} matched at ${playerPick}.`
        } else {
          comment = `🏏 ${isPlayerBatting ? 'You scored' : 'CPU scored'} ${ballRecord.runs} runs (Player: ${playerPick}, CPU: ${cpuPick}).`
        }

        const newCommentary = [comment, ...commentary]

        // Handle transitions
        if (nextState.phase === 'innings2' && matchState.phase === 'innings1') {
          newCommentary.unshift(`🔄 Innings 1 over! CPU needs ${nextState.target} runs to win.`)
          setLastBall(null) // Reset display matchup
        } else if (nextState.phase === 'ended') {
          const winnerText = nextState.winner === 'player' 
            ? '🏆 Congratulations! You won the match!' 
            : nextState.winner === 'cpu'
            ? '💀 CPU won the match. Better luck next time!'
            : '🤝 Match ended in a DRAW!'
          newCommentary.unshift(`🏁 Match Ended!`, winnerText)
          setStep('ended')
        }

        setCommentary(newCommentary)
      } catch (error) {
        console.error('Error in CricketEngine playBall:', error)
        setIsAnimating(false)
      }
    }, 600)
  }

  // Trigger submission to server / guest simulation when ended
  useEffect(() => {
    if (step === 'ended' && matchState && matchState.winner) {
      const score = matchState.innings1?.battingTeam === 'player'
        ? matchState.innings1.score
        : matchState.innings2?.score ?? 0;
      
      const opponentScore = matchState.innings1?.battingTeam === 'cpu'
        ? matchState.innings1.score
        : matchState.innings2?.score ?? 0;

      const apiResult = matchState.winner === 'player'
        ? 'win'
        : matchState.winner === 'cpu'
        ? 'loss'
        : 'draw';

      submitGameResult({
        gameSlug: 'cricket',
        result: apiResult,
        metadata: {
          score,
          opponentScore,
          overs,
          wickets,
          innings1Score: matchState.innings1?.score,
          innings2Score: matchState.innings2?.score,
          winner: matchState.winner,
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const formatOvers = (balls: number) => {
    const ov = Math.floor(balls / 6)
    const b = balls % 6
    return `${ov}.${b}`
  }

  // --- RENDERING SCREENS ---

  // 1. Setup Screen
  if (step === 'setup') {
    return (
      <div className="card shadow-lg animate-fadeIn" style={{ padding: '2.5rem', maxWidth: 500, margin: '2rem auto', border: '1px solid hsl(220 20% 20%)', background: 'hsl(220 20% 12% / 0.8)', backdropFilter: 'blur(12px)', borderRadius: 20 }}>
        <div style={{ fontSize: '4rem', textAlign: 'center', marginBottom: '1rem' }}>🏏</div>
        <h2 style={{ fontWeight: 800, fontSize: '1.75rem', textAlign: 'center', marginBottom: '0.5rem', color: 'hsl(220 15% 92%)' }}>Hand Cricket Setup</h2>
        <p style={{ color: 'hsl(220 10% 55%)', textAlign: 'center', marginBottom: '2rem', fontSize: '0.9rem', lineHeight: 1.6 }}>
          Configure your match. Play overs-based hand cricket with wickets and full toss simulation.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'hsl(220 10% 70%)', marginBottom: '0.5rem' }}>Select Overs Limit</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[1, 2, 5, 10].map(o => (
                <button
                  key={o}
                  className={`btn ${overs === o ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setOvers(o)}
                  style={{ fontWeight: 700 }}
                >
                  {o} {o === 1 ? 'Over' : 'Overs'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'hsl(220 10% 70%)', marginBottom: '0.5rem' }}>Select Wickets Limit</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
              {[1, 3, 5, 10].map(w => (
                <button
                  key={w}
                  className={`btn ${wickets === w ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setWickets(w)}
                  style={{ fontWeight: 700 }}
                >
                  {w} {w === 1 ? 'Wkt' : 'Wkts'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          className="btn btn-primary btn-lg"
          style={{ width: '100%', borderRadius: 12, padding: '0.75rem' }}
          onClick={() => setStep('toss')}
          id="cricket-go-toss"
        >
          🪙 Proceed to Toss
        </button>
      </div>
    )
  }

  // 2. Toss Screen
  if (step === 'toss') {
    return (
      <div className="card shadow-lg animate-fadeIn" style={{ padding: '2.5rem', maxWidth: 500, margin: '2rem auto', border: '1px solid hsl(220 20% 20%)', background: 'hsl(220 20% 12% / 0.8)', backdropFilter: 'blur(12px)', borderRadius: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div
            className={isTossing ? 'animate-spin' : ''}
            style={{
              fontSize: '5rem',
              display: 'inline-block',
              transition: 'transform 0.5s',
              transform: isTossing ? 'rotateY(720deg)' : 'none',
            }}
          >
            🪙
          </div>
          <h2 style={{ fontWeight: 800, fontSize: '1.75rem', marginTop: '1rem', color: 'hsl(220 15% 92%)' }}>The Coin Toss</h2>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {isTossing ? 'Flipping coin in the air...' : 'Call Heads or Tails to determine who chooses.'}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => handleToss('heads')}
            disabled={isTossing}
            style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 700 }}
          >
            👨 Heads
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={() => handleToss('tails')}
            disabled={isTossing}
            style={{ padding: '1rem', fontSize: '1.1rem', fontWeight: 700 }}
          >
            🦊 Tails
          </button>
        </div>
      </div>
    )
  }

  // 3. Toss Result Screen
  if (step === 'toss_result' && tossResult) {
    const isPlayerWinner = tossResult.tossWinner === 'player'
    return (
      <div className="card shadow-lg animate-fadeIn" style={{ padding: '2.5rem', maxWidth: 500, margin: '2rem auto', border: '1px solid hsl(220 20% 20%)', background: 'hsl(220 20% 12% / 0.8)', backdropFilter: 'blur(12px)', borderRadius: 20 }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '4rem' }}>{isPlayerWinner ? '🎉' : '🤖'}</div>
          <h2 style={{ fontWeight: 800, fontSize: '1.75rem', marginTop: '1rem', color: 'hsl(220 15% 92%)' }}>
            {isPlayerWinner ? 'You Won the Toss!' : 'CPU Won the Toss!'}
          </h2>
          <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            The coin landed on <strong style={{ color: 'hsl(220 100% 65%)' }}>{tossResult.outcome.toUpperCase()}</strong>.
          </p>
        </div>

        {isPlayerWinner ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'hsl(220 10% 70%)', textAlign: 'center', fontSize: '0.95rem', fontWeight: 500 }}>Choose your role first:</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => startMatch('bat')}
                style={{ padding: '1rem', fontWeight: 700 }}
              >
                🏏 Bat First
              </button>
              <button
                className="btn btn-primary btn-lg"
                onClick={() => startMatch('bowl')}
                style={{ padding: '1rem', fontWeight: 700 }}
              >
                🎯 Bowl First
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'hsl(220 10% 70%)', fontSize: '1.05rem', marginBottom: '1.5rem', fontWeight: 600 }}>
              CPU decided to <span style={{ color: 'hsl(0 80% 60%)' }}>{tossChosenRole === 'bat' ? 'BAT' : 'BOWL'}</span> first.
            </p>
            <button
              className="btn btn-primary btn-lg"
              onClick={() => startMatch()}
              style={{ width: '100%', borderRadius: 12 }}
            >
              🚀 Let&apos;s Play!
            </button>
          </div>
        )}
      </div>
    )
  }

  // 4. Play Match Screen
  if (step === 'play' && matchState) {
    const currentInnings = matchState.phase === 'innings2' && matchState.innings2
      ? matchState.innings2
      : matchState.innings1

    if (!currentInnings) return null

    const isPlayerBatting = currentInnings.battingTeam === 'player'
    const isPlayerBowling = currentInnings.bowlingTeam === 'player'

    return (
      <div style={{ maxWidth: 600, margin: '1rem auto', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="animate-fadeIn">
        {/* Main Scorecard Banner */}
        <div className="card shadow-lg" style={{ padding: '1.25rem 1.5rem', background: 'hsl(220 20% 10% / 0.9)', border: '1px solid hsl(220 20% 18%)', borderRadius: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.25rem' }}>{isPlayerBatting ? '🏏' : '🎯'}</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 6, background: isPlayerBatting ? 'hsl(220 100% 65% / 0.15)' : 'hsl(0 80% 60% / 0.15)', color: isPlayerBatting ? 'hsl(220 100% 65%)' : 'hsl(0 80% 60%)', textTransform: 'uppercase' }}>
                {isPlayerBatting ? 'Player Batting' : 'CPU Batting'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)' }}>
              {matchState.phase === 'innings1' ? 'Innings 1' : 'Innings 2'}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'hsl(220 15% 95%)' }}>{currentInnings.score}</span>
              <span style={{ fontSize: '1.5rem', fontWeight: 600, color: 'hsl(220 10% 45%)', margin: '0 0.25rem' }}>/</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 700, color: 'hsl(220 10% 60%)' }}>{currentInnings.wicketsLost}</span>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(220 10% 75%)' }}>
                Overs: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatOvers(currentInnings.ballsBowled)}</span> / {overs}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'hsl(220 10% 50%)', marginTop: '0.1rem' }}>
                Wickets Limit: {wickets}
              </div>
            </div>
          </div>

          {/* Targets and calculations for Innings 2 */}
          {matchState.phase === 'innings2' && matchState.target && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid hsl(220 20% 16%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
              <div style={{ color: 'hsl(220 10% 60%)' }}>
                Target: <strong style={{ color: 'hsl(220 15% 90%)' }}>{matchState.target}</strong>
              </div>
              <div style={{ fontWeight: 600, color: 'hsl(220 100% 65%)' }}>
                {isPlayerBatting 
                  ? `Need ${Math.max(0, matchState.target - currentInnings.score)} runs from ${Math.max(0, (overs * 6) - currentInnings.ballsBowled)} balls`
                  : `CPU needs ${Math.max(0, matchState.target - currentInnings.score)} runs from ${Math.max(0, (overs * 6) - currentInnings.ballsBowled)} balls`}
              </div>
            </div>
          )}
        </div>

        {/* Action Reveal Arena */}
        <div className="card shadow-lg" style={{ padding: '2rem 1.5rem', background: 'hsl(220 20% 8% / 0.95)', border: '1px solid hsl(220 20% 16%)', borderRadius: 16, textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Player ({isPlayerBatting ? 'Bat' : 'Bowl'})</div>
              <div 
                className={isAnimating ? 'animate-pulse' : ''} 
                style={{ 
                  fontSize: '3.5rem', 
                  fontWeight: 900, 
                  height: '5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'hsl(220 20% 12%)',
                  borderRadius: 12,
                  border: isPlayerBatting ? '2px dashed hsl(220 100% 65% / 0.3)' : '2px dashed hsl(220 10% 30%)',
                  color: isPlayerBatting ? 'hsl(220 100% 65%)' : 'hsl(220 15% 90%)'
                }}
              >
                {isAnimating ? '❓' : (lastBall ? (isPlayerBatting ? lastBall.batsmanPick : lastBall.bowlerPick) : '-')}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>CPU ({isPlayerBatting ? 'Bowl' : 'Bat'})</div>
              <div 
                className={isAnimating ? 'animate-pulse' : ''} 
                style={{ 
                  fontSize: '3.5rem', 
                  fontWeight: 900, 
                  height: '5rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  background: 'hsl(220 20% 12%)',
                  borderRadius: 12,
                  border: isPlayerBowling ? '2px dashed hsl(0 80% 60% / 0.3)' : '2px dashed hsl(220 10% 30%)',
                  color: isPlayerBowling ? 'hsl(0 80% 60%)' : 'hsl(220 15% 90%)'
                }}
              >
                {isAnimating ? '❓' : (lastBall ? (isPlayerBatting ? lastBall.bowlerPick : lastBall.batsmanPick) : '-')}
              </div>
            </div>
          </div>

          <div style={{ minHeight: '2.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isAnimating ? (
              <span style={{ fontSize: '0.9rem', color: 'hsl(220 10% 55%)' }}>Evaluating play...</span>
            ) : lastBall ? (
              <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                {lastBall.isOut ? (
                  <span style={{ color: 'hsl(0 80% 60%)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    🔴 OUT! (Matched at {lastBall.batsmanPick})
                  </span>
                ) : (
                  <span style={{ color: 'hsl(142 70% 55%)' }}>
                    🏏 +{lastBall.runs} Runs!
                  </span>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '0.85rem', color: 'hsl(220 10% 55%)' }}>
                {isPlayerBatting ? 'Choose a number to bat' : 'Choose a number to bowl'}
              </span>
            )}
          </div>
        </div>

        {/* Input keypad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.5rem' }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <button
              key={n}
              className="btn btn-secondary"
              disabled={isAnimating}
              onClick={() => handlePlayBall(n)}
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                aspectRatio: '1',
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0
              }}
              id={`cricket-btn-${n}`}
            >
              {n}
            </button>
          ))}
        </div>

        {/* Commentary log */}
        <div className="card" style={{ padding: '1rem 1.25rem', maxHeight: 200, overflowY: 'auto', background: 'hsl(220 20% 8% / 0.8)', border: '1px solid hsl(220 20% 15%)' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'hsl(220 10% 50%)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>Ball-by-Ball Commentary</div>
          {commentary.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {commentary.map((log, index) => (
                <div key={index} style={{ fontSize: '0.8rem', color: index === 0 ? 'hsl(220 15% 90%)' : 'hsl(220 10% 55%)', fontFamily: 'monospace', borderLeft: index === 0 ? '2px solid hsl(220 100% 65%)' : 'none', paddingLeft: index === 0 ? '0.5rem' : 0 }}>
                  {log}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', color: 'hsl(220 10% 45%)', fontStyle: 'italic' }}>No balls bowled yet.</div>
          )}
        </div>
      </div>
    )
  }

  // 5. Ended Screen
  if (step === 'ended' && matchState) {
    const isPlayerWin = matchState.winner === 'player'
    const isCpuWin = matchState.winner === 'cpu'

    const playerInnings = matchState.innings1?.battingTeam === 'player' ? matchState.innings1 : matchState.innings2
    const cpuInnings = matchState.innings1?.battingTeam === 'cpu' ? matchState.innings1 : matchState.innings2

    return (
      <div className="card shadow-lg animate-slideUp" style={{ padding: '2.5rem', maxWidth: 500, margin: '2rem auto', border: '1px solid hsl(220 20% 20%)', background: 'hsl(220 20% 12% / 0.8)', backdropFilter: 'blur(12px)', borderRadius: 20, textAlign: 'center' }}>
        <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>
          {isPlayerWin ? '🏆' : isCpuWin ? '💀' : '🤝'}
        </div>
        <h2 style={{ fontWeight: 900, fontSize: '1.8rem', marginBottom: '0.5rem', color: isPlayerWin ? 'hsl(142 70% 55%)' : isCpuWin ? 'hsl(0 80% 60%)' : 'hsl(220 15% 90%)' }}>
          {isPlayerWin ? 'You Won!' : isCpuWin ? 'CPU Won!' : 'Match Drawn!'}
        </h2>
        <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.9rem', marginBottom: '2rem' }}>
          {isPlayerWin ? 'Great chase / defense! Your rewards have been sent.' : isCpuWin ? 'Hard luck. Get back in the nets!' : 'Equal scores. A perfectly balanced match!'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'hsl(220 20% 9%)', padding: '1.25rem', borderRadius: 16, marginBottom: '2rem', border: '1px solid hsl(220 20% 15%)' }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Your Score</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(220 100% 65%)' }}>
              {playerInnings ? `${playerInnings.score}/${playerInnings.wicketsLost}` : '0/0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginTop: '0.1rem' }}>
              ({playerInnings ? formatOvers(playerInnings.ballsBowled) : '0'} Ov)
            </div>
          </div>

          <div style={{ borderLeft: '1px solid hsl(220 20% 16%)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'hsl(220 10% 50%)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>CPU Score</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'hsl(0 80% 60%)' }}>
              {cpuInnings ? `${cpuInnings.score}/${cpuInnings.wicketsLost}` : '0/0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginTop: '0.1rem' }}>
              ({cpuInnings ? formatOvers(cpuInnings.ballsBowled) : '0'} Ov)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* Replay option is managed globally via post-game XP modal */}
        </div>
      </div>
    )
  }

  return null
}
