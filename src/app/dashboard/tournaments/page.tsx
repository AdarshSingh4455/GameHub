'use client'

import React, { useEffect, useState } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'

interface Participant {
  id: string
  name: string
  isBot: boolean
}

interface Match {
  id: string
  p1: string | null
  p2: string | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  status: 'PENDING' | 'COMPLETED'
}

interface Round {
  roundIndex: number
  name: string
  matches: Match[]
}

interface BracketData {
  participants: Participant[]
  rounds: Round[]
}

interface Tournament {
  id: string
  name: string
  description: string
  startDate: string
  endDate: string
  eligibleGames: string[]
  rewardCoins: number
  rewardTitle: string | null
  rewardBadge: string | null
  bracketData: BracketData | null
  status: 'REGISTERING' | 'ACTIVE' | 'COMPLETED' | 'ELIMINATED' | 'CLAIMED'
}

interface LeaderboardRow {
  rank: number
  username: string
  level: number
  score: number // wins count
  title: string | null
}

export default function TournamentsPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  const [activeSubTab, setActiveSubTab] = useState<'brackets' | 'leaderboard' | 'history'>('brackets')
  const [daily, setDaily] = useState<Tournament | null>(null)
  const [weekly, setWeekly] = useState<Tournament | null>(null)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [history, setHistory] = useState<Tournament[]>([])

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Simulation modal
  const [simulationModalOpen, setSimulationModalOpen] = useState(false)
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [simulating, setSimulating] = useState(false)
  const [simOutcome, setSimOutcome] = useState<'win' | 'lose' | null>(null)

  const fetchTournaments = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/tournaments')
      if (!res.ok) throw new Error('Failed to load tournaments')
      const data = await res.json()
      setDaily(data.daily)
      setWeekly(data.weekly)
      setHistory(data.history || [])

      // Default selection to Daily or first available
      if (selectedTournament) {
        // Refresh currently selected tournament if it matches
        const current = [data.daily, data.weekly].find(t => t?.id === selectedTournament.id)
        if (current) setSelectedTournament(current)
      } else if (data.daily) {
        setSelectedTournament(data.daily)
      } else if (data.weekly) {
        setSelectedTournament(data.weekly)
      }
    } catch (err) {
      console.error(err)
      addToast('error', 'Error', 'Failed to fetch tournaments')
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      setLeaderboardLoading(true)
      const res = await fetch('/api/leaderboard?game=tournaments')
      if (res.ok) {
        const data = await res.json()
        setLeaderboard(data.rows || [])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLeaderboardLoading(false)
    }
  }

  useEffect(() => {
    if (user) {
      fetchTournaments()
    }
  }, [user])

  useEffect(() => {
    if (activeSubTab === 'leaderboard') {
      fetchLeaderboard()
    }
  }, [activeSubTab])

  const handleRegister = async (tId: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', tournamentId: tId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      addToast('success', 'Registered!', 'You are registered. Let\'s start!')
      await fetchTournaments()
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Registration failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleStartTournament = async (tId: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', tournamentId: tId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start tournament')
      addToast('success', 'Tournament Active! ⚔️', 'Bracket generated! Play your first match.')
      await fetchTournaments()
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Failed to start tournament')
    } finally {
      setActionLoading(false)
    }
  }

  const handleResolveMatch = async (outcome: 'win' | 'lose') => {
    if (!selectedTournament || !activeMatch) return
    try {
      setSimulating(true)
      setSimOutcome(outcome)
      // Wait for 1.5 seconds for dramatic effect
      await new Promise(r => setTimeout(r, 1500))

      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'playMatch',
          tournamentId: selectedTournament.id,
          matchId: activeMatch.id,
          outcome
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Match resolution failed')

      if (outcome === 'win') {
        addToast('success', 'Match Won! 🎉', 'You advanced to the next round!')
      } else {
        addToast('info', 'Defeated ❌', 'You were eliminated from this tournament.')
      }

      setSimulationModalOpen(false)
      setActiveMatch(null)
      await fetchTournaments()
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Match resolution failed')
    } finally {
      setSimulating(false)
      setSimOutcome(null)
    }
  }

  const handleClaimRewards = async (tId: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claimRewards', tournamentId: tId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Rewards claim failed')
      addToast('success', 'Claimed! 🎁', `Granted +${data.coinsReward} coins and +${data.xpReward} XP!`)
      await fetchTournaments()
    } catch (err: any) {
      addToast('error', 'Error', err.message || 'Rewards claim failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Get user's current status text or buttons
  const isUserRegistered = (t: Tournament | null) => {
    if (!t || !t.bracketData) return false
    return t.bracketData.participants.some(p => p.id === user?.id)
  }

  const getUserActiveMatch = (t: Tournament | null) => {
    if (!t || t.status !== 'ACTIVE' || !t.bracketData) return null
    for (const round of t.bracketData.rounds) {
      const match = round.matches.find(m =>
        (m.p1 === user?.id || m.p2 === user?.id) && m.winnerId === null
      )
      if (match) return match
    }
    return null
  }

  const getParticipantName = (pId: string | null, bracket: BracketData | null) => {
    if (!pId) return 'TBD'
    const p = bracket?.participants.find(part => part.id === pId)
    return p ? p.name : 'Unknown'
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-fadeIn safe-bottom-padding">
      
      {/* Title Header */}
      <div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, margin: 0, color: 'white', letterSpacing: '-0.02em' }}>
          🏆 Tournaments Arena
        </h1>
        <p style={{ color: 'hsl(220 10% 55%)', margin: '0.2rem 0 0', fontSize: '0.9rem' }}>
          Register for daily/weekly bot-progression brackets, win rounds, and claim exclusive cosmetic titles.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid hsl(220 15% 18%)', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { id: 'brackets', label: 'Tournament Bracket' },
          { id: 'leaderboard', label: 'Leaderboard' },
          { id: 'history', label: 'Tournament History' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveSubTab(t.id as any)}
            style={{
              background: 'transparent',
              border: 'none',
              color: activeSubTab === t.id ? 'hsl(220 100% 70%)' : 'hsl(220 10% 50%)',
              fontWeight: 700,
              fontSize: '0.92rem',
              padding: '0.5rem 0.25rem 0.75rem',
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            {t.label}
            {activeSubTab === t.id && (
              <div style={{ position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, background: 'hsl(220 100% 60%)' }} />
            )}
          </button>
        ))}
      </div>

      {activeSubTab === 'brackets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Tournament Selection Selector */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {daily && (
              <button
                className={`btn btn-sm ${selectedTournament?.id === daily.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTournament(daily)}
              >
                📅 Daily Tournament
              </button>
            )}
            {weekly && (
              <button
                className={`btn btn-sm ${selectedTournament?.id === weekly.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedTournament(weekly)}
              >
                👑 Weekly Tournament
              </button>
            )}
          </div>

          {selectedTournament ? (
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'linear-gradient(135deg, hsl(222 18% 11%), hsl(222 18% 8%))', borderRadius: 20 }}>
              
              {/* Tournament Info Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid hsl(220 15% 16%)', paddingBottom: '1rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 850, margin: 0, color: 'white' }}>
                    {selectedTournament.name}
                  </h2>
                  <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>
                    {selectedTournament.description}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'hsl(45 100% 65%)' }}>
                    💰 {selectedTournament.rewardCoins} Coins
                  </div>
                  {selectedTournament.rewardTitle && (
                    <div style={{ fontSize: '0.72rem', color: 'hsl(220 10% 60%)', background: 'hsl(220 10% 20%)', padding: '0.1rem 0.4rem', borderRadius: 4 }}>
                      Title: {selectedTournament.rewardTitle}
                    </div>
                  )}
                </div>
              </div>

              {/* Tournament Status Controller Actions */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', background: 'hsl(220 15% 12% / 0.4)', padding: '1rem', borderRadius: 12 }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: 'hsl(220 10% 60%)' }}>Status: </span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: selectedTournament.status === 'ACTIVE' ? 'hsl(142 70% 55%)' : 'hsl(38 95% 60%)'
                  }}>
                    {selectedTournament.status}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {/* Action 1: Register */}
                  {!isUserRegistered(selectedTournament) && selectedTournament.status === 'REGISTERING' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleRegister(selectedTournament.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Registering...' : 'Register for Tournament'}
                    </button>
                  )}

                  {/* Action 2: Start */}
                  {isUserRegistered(selectedTournament) && selectedTournament.status === 'REGISTERING' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleStartTournament(selectedTournament.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Starting...' : '⚡ Generate Bracket & Start'}
                    </button>
                  )}

                  {/* Action 3: Claim Rewards */}
                  {(selectedTournament.status === 'COMPLETED' || selectedTournament.status === 'ELIMINATED') && (
                    <button
                      className="btn btn-primary animate-pulse-glow"
                      onClick={() => handleClaimRewards(selectedTournament.id)}
                      disabled={actionLoading}
                      style={{ background: 'linear-gradient(135deg, hsl(45 100% 60%), hsl(35 90% 50%))', border: 'none', color: 'black', fontWeight: 900 }}
                    >
                      🎁 Claim Rewards ({selectedTournament.status === 'COMPLETED' ? '1st Place' : 'Consolation'})
                    </button>
                  )}

                  {/* Action 4: Claimed */}
                  {selectedTournament.status === 'CLAIMED' && (
                    <span style={{ fontSize: '0.85rem', color: 'hsl(142 70% 50%)', fontWeight: 800 }}>
                      ✓ Rewards Claimed! Come back tomorrow.
                    </span>
                  )}
                </div>
              </div>

              {/* Bracket Tree Display */}
              {selectedTournament.bracketData ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '2rem', overflowX: 'auto', padding: '1rem 0' }}>
                  
                  {selectedTournament.bracketData.rounds.map((round, rIdx) => (
                    <div
                      key={round.roundIndex}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        minWidth: 200,
                        gap: '2rem'
                      }}
                    >
                      <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'hsl(220 10% 50%)', letterSpacing: '0.05em' }}>
                        {round.name}
                      </div>

                      {round.matches.map(match => {
                        const isUserMatch = match.p1 === user?.id || match.p2 === user?.id
                        const isPending = match.winnerId === null
                        const userCanPlay = isUserMatch && isPending && selectedTournament.status === 'ACTIVE'

                        return (
                          <div
                            key={match.id}
                            style={{
                              border: isUserMatch ? '1px solid hsl(220 100% 60% / 0.4)' : '1px solid hsl(220 15% 18%)',
                              background: isUserMatch
                                ? 'linear-gradient(135deg, hsl(220 100% 60% / 0.05), hsl(220 100% 60% / 0.01))'
                                : 'hsl(222 18% 10%)',
                              padding: '0.75rem',
                              borderRadius: 12,
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.4rem',
                              boxShadow: isUserMatch ? '0 4px 15px hsl(220 100% 60% / 0.05)' : 'none'
                            }}
                          >
                            {/* P1 Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.8rem',
                                fontWeight: match.winnerId === match.p1 ? 800 : 500,
                                color: match.winnerId === match.p1 ? 'white' : match.winnerId ? 'hsl(220 10% 45%)' : 'white'
                              }}>
                                {match.p1 === user?.id ? '⭐ You' : getParticipantName(match.p1, selectedTournament.bracketData)}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 60%)' }}>
                                {match.score1 ?? ''}
                              </span>
                            </div>

                            {/* Divider line */}
                            <div style={{ height: 1, background: 'hsl(220 15% 16%)' }} />

                            {/* P2 Row */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{
                                fontSize: '0.8rem',
                                fontWeight: match.winnerId === match.p2 ? 800 : 500,
                                color: match.winnerId === match.p2 ? 'white' : match.winnerId ? 'hsl(220 10% 45%)' : 'white'
                              }}>
                                {match.p2 === user?.id ? '⭐ You' : getParticipantName(match.p2, selectedTournament.bracketData)}
                              </span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 60%)' }}>
                                {match.score2 ?? ''}
                              </span>
                            </div>

                            {/* Match Action */}
                            {userCanPlay && (
                              <button
                                className="btn btn-primary btn-sm"
                                style={{
                                  marginTop: '0.5rem',
                                  fontSize: '0.72rem',
                                  padding: '0.3rem 0.5rem',
                                  borderRadius: 8,
                                  background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(250 100% 60%))'
                                }}
                                onClick={() => {
                                  setActiveMatch(match)
                                  setSimulationModalOpen(true)
                                }}
                              >
                                ⚔️ Play Match
                              </button>
                            )}
                          </div>
                        )
                      })}

                    </div>
                  ))}

                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed hsl(220 15% 16%)', borderRadius: 16 }}>
                  <span style={{ fontSize: '2rem' }}>🤝</span>
                  <h4 style={{ margin: '0.5rem 0 0.2rem', color: 'white', fontWeight: 700 }}>Bracket Not Generated</h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'hsl(220 10% 50%)' }}>
                    Register for the tournament and click start to generate your bracket.
                  </p>
                </div>
              )}

            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(220 10% 50%)' }}>
              Loading selected tournament details...
            </div>
          )}

        </div>
      )}

      {activeSubTab === 'leaderboard' && (
        <div className="card" style={{ padding: '1.25rem', borderRadius: 18, background: 'hsl(222 18% 10%)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 800, color: 'white' }}>
            🏆 Tournament Triumphs Leaderboard
          </h3>

          {leaderboardLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(220 10% 50%)' }}>
              Loading leaderboard rankings...
            </div>
          ) : leaderboard.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'hsl(220 10% 50%)' }}>
              No tournament wins logged yet. Be the first to claim victory!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {leaderboard.map(row => (
                <div
                  key={row.username}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: 'hsl(222 18% 12%)',
                    border: '1px solid hsl(220 15% 15%)',
                    borderRadius: 12
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      fontSize: '0.85rem',
                      fontWeight: 900,
                      color: row.rank === 1 ? 'hsl(45 100% 60%)' : row.rank === 2 ? 'hsl(220 10% 75%)' : row.rank === 3 ? 'hsl(35 60% 60%)' : 'hsl(220 10% 50%)'
                    }}>
                      #{row.rank}
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'white' }}>
                      {row.username} {row.title && <span style={{ fontSize: '0.68rem', color: 'hsl(220 100% 75%)', marginLeft: '0.3rem' }}>[{row.title}]</span>}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'hsl(220 100% 70%)' }}>
                    🏆 {row.score} Wins
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', border: '1px dashed hsl(220 15% 16%)', borderRadius: 18 }}>
              <span style={{ fontSize: '2.5rem' }}>🕒</span>
              <h3 style={{ fontWeight: 700, color: 'white', margin: '0.5rem 0 0' }}>No Past Tournaments</h3>
              <p style={{ color: 'hsl(220 10% 50%)', fontSize: '0.82rem', margin: '0.25rem 0 0' }}>Finished tournaments list will populate here.</p>
            </div>
          ) : (
            history.map(t => (
              <div key={t.id} className="card" style={{ padding: '1rem 1.25rem', background: 'hsl(222 18% 10%)', borderRadius: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontWeight: 750, color: 'white', fontSize: '0.92rem' }}>{t.name}</h4>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'hsl(220 10% 50%)' }}>Ended: {new Date(t.endDate).toLocaleDateString()}</p>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(142 70% 50%)', background: 'hsl(142 70% 50% / 0.1)', padding: '0.25rem 0.5rem', borderRadius: 8 }}>
                  COMPLETED
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Play/Simulation Modal */}
      {simulationModalOpen && activeMatch && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(5, 8, 16, 0.9)',
            backdropFilter: 'blur(8px)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 400,
              background: 'linear-gradient(135deg, hsl(222 20% 12%), hsl(222 18% 14%))',
              border: '1px solid hsl(220 15% 22%)',
              padding: '1.75rem',
              borderRadius: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem',
              boxShadow: '0 25px 60px rgba(0,0,0,0.65)'
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>
                ⚔️ Play Tournament Match
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: 'hsl(220 10% 55%)' }}>
                You are playing against <b>{getParticipantName(activeMatch.p1 === user?.id ? activeMatch.p2 : activeMatch.p1, selectedTournament?.bracketData || null)}</b>.
              </p>
            </div>

            {simulating ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 40,
                  height: 40,
                  border: '4px solid hsl(220 100% 60% / 0.1)',
                  borderTop: '4px solid hsl(220 100% 60%)',
                  borderRadius: '50%',
                  animation: 'spin 1s infinite linear'
                }} />
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                `}</style>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>
                  {simOutcome === 'win' ? 'Simulating game rounds... 🎲' : 'Submitting forfeit... 🏳️'}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  className="btn btn-primary"
                  style={{
                    background: 'linear-gradient(135deg, hsl(220 100% 60%), hsl(250 100% 60%))',
                    border: 'none',
                    fontWeight: 700
                  }}
                  onClick={() => handleResolveMatch('win')}
                >
                  🎲 Simulate Match (50% Win Chance)
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ color: 'hsl(220 10% 70%)' }}
                  onClick={() => handleResolveMatch('lose')}
                >
                  Forfeit / Simulated Loss
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ border: 'none', color: 'hsl(0 80% 60%)', marginTop: '0.5rem' }}
                  onClick={() => {
                    setSimulationModalOpen(false)
                    setActiveMatch(null)
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
