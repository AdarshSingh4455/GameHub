'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'

const formatIST = (dateVal: string | Date | number, type: 'datetime' | 'time' | 'date' = 'datetime') => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  const options: Intl.DateTimeFormatOptions = { timeZone: 'Asia/Kolkata' };
  
  if (type === 'datetime') {
    options.year = 'numeric';
    options.month = 'short';
    options.day = 'numeric';
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  } else if (type === 'time') {
    options.hour = 'numeric';
    options.minute = '2-digit';
    options.hour12 = true;
  } else if (type === 'date') {
    options.year = 'numeric';
    options.month = 'short';
    options.day = 'numeric';
  }
  
  return d.toLocaleString('en-US', options);
};
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/layout/Card'
import { 
  Trophy, 
  Users, 
  Calendar, 
  Play, 
  ShieldAlert, 
  Award, 
  Clock, 
  UserPlus, 
  UserMinus, 
  CheckCircle, 
  Share2, 
  Eye, 
  ChevronRight, 
  Info,
  X,
  FileText,
  User,
  Plus
} from 'lucide-react'

interface Participant {
  id: string
  name: string
}

interface Match {
  id: string
  subTournamentId: string
  roundIndex: number
  roundName: string
  matchIndex: number
  p1Id: string | null
  p2Id: string | null
  p1Name: string | null
  p2Name: string | null
  p1Score: number | null
  p2Score: number | null
  winnerId: string | null
  status: 'PENDING' | 'PLAYING' | 'COMPLETED' | 'WALK_OVER' | 'DISQUALIFIED'
  matchTime: string
  joinWindowStart: string
  joinWindowEnd: string
  p1Joined: boolean
  p2Joined: boolean
  p1Ready: boolean
  p2Ready: boolean
}

interface SubTournament {
  id: string
  tournamentId: string
  name: string
  capacity: number
  status: 'ACTIVE' | 'COMPLETED'
  winnerId: string | null
  matches: Match[]
}

interface WaitingListState {
  waitingPosition: number
  playersNeeded: number
  estStart: string
}

interface Tournament {
  id: string
  name: string
  description: string | null
  gameSlug: string
  type: 'ONE_DAY' | 'MULTI_DAY'
  regStart: string
  regEnd: string
  startDate: string
  endDate: string
  durationDays: number
  maxPlayers: number
  bannerUrl: string | null
  rules: string | null
  isOfficial: boolean
  creatorId: string | null
  privacy: 'PUBLIC' | 'PRIVATE' | 'INVITE_CODE'
  inviteCode: string | null
  preferredSplit: string
  startTime: string | null
  winnerId: string | null
  rewardCoins: number
  rewardBadge: string | null
  rewardTitle: string | null
  rewardCosmetic: string | null
  status: 'ANNOUNCEMENT' | 'REGISTRATION_OPEN' | 'REGISTRATION_CLOSED' | 'ACTIVE' | 'COMPLETED' | 'CLAIMED'
  isRegistered: boolean
  registeredPlayers: number
  activePlayers: number
  currentRound: string
  countdown: number
  rewardsString: string
  waitingListState: WaitingListState | null
  registrations?: any[]
  subTournaments?: SubTournament[]
}

export default function TournamentsPage() {
  const { user } = useGameSession()
  const { addToast } = useToast()

  // Admin access control
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null) // null = loading

  useEffect(() => {
    fetch('/api/profile/details')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        const role = data?.profile?.role
        setIsAdmin(role === 'SUPER_ADMIN' || role === 'ADMIN')
      })
      .catch(() => setIsAdmin(false))
  }, [])

  // Tab selections
  const [activeDashboardSection, setActiveDashboardSection] = useState<'registrationOpen' | 'upcoming' | 'live' | 'myTournaments' | 'completed'>('registrationOpen')
  const [activeDetailsTab, setActiveDetailsTab] = useState<'overview' | 'schedule' | 'bracket' | 'players' | 'results' | 'rules'>('overview')

  // Lists
  const [registrationOpen, setRegistrationOpen] = useState<Tournament[]>([])
  const [upcoming, setUpcoming] = useState<Tournament[]>([])
  const [live, setLive] = useState<Tournament[]>([])
  const [completed, setCompleted] = useState<Tournament[]>([])
  const [myTournaments, setMyTournaments] = useState<Tournament[]>([])

  // Selected state
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  
  // Loading states
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [creationForm, setCreationForm] = useState({
    name: '',
    gameSlug: 'tic-tac-toe',
    maxPlayers: 8,
    startDate: '',
    startTime: '10:00 AM',
    privacy: 'PUBLIC'
  })

  // Match / Play flow
  const [activeMatch, setActiveMatch] = useState<Match | null>(null)
  const [playPanelOpen, setPlayPanelOpen] = useState(false)
  const [playingState, setPlayingState] = useState<'join' | 'waiting' | 'play' | 'finished'>('join')
  const [timerCount, setTimerCount] = useState(15)
  const [simulatedScoreP1, setSimulatedScoreP1] = useState(0)
  const [simulatedScoreP2, setSimulatedScoreP2] = useState(0)
  const [simulatedTurn, setSimulatedTurn] = useState<string>('')

  // Spectator state
  const [spectatingMatch, setSpectatingMatch] = useState<Match | null>(null)
  const [spectatorScores, setSpectatorScores] = useState({ p1: 0, p2: 0 })
  const [spectatorTimer, setSpectatorTimer] = useState(30)
  const [spectatorTurn, setSpectatorTurn] = useState<string>('')

  // Champion card state
  const [championCardOpen, setChampionCardOpen] = useState(false)
  const [championDetails, setChampionDetails] = useState<{ winner: string; tournament: string; game: string; date: string } | null>(null)

  // Team captain state
  const [teamFormOpen, setTeamFormOpen] = useState(false)
  const [teamForm, setTeamForm] = useState({ name: '' })
  const [teamMembers, setTeamMembers] = useState<Participant[]>([])
  const [inviteCodeText, setInviteCodeText] = useState('')

  // Countdown timer updates
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchTournaments = async (autoSelectId?: string) => {
    try {
      setLoading(true)
      setFetchError(null)
      const res = await fetch('/api/tournaments')
      
      let errorMsg = 'Failed to load tournaments'
      if (!res.ok) {
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch (_) {}
        throw new Error(errorMsg)
      }
      
      const data = await res.json()

      setRegistrationOpen(data.registrationOpen || [])
      setUpcoming(data.upcoming || [])
      setLive(data.live || [])
      setCompleted(data.completed || [])
      setMyTournaments(data.myTournaments || [])

      // Auto-refresh selected tournament details if open
      const currentSelectedId = autoSelectId || selectedTournament?.id
      if (currentSelectedId) {
        // Look up in all sections
        const all = [
          ...(data.registrationOpen || []),
          ...(data.upcoming || []),
          ...(data.live || []),
          ...(data.completed || [])
        ]
        const refreshed = all.find((t: Tournament) => t.id === currentSelectedId)
        if (refreshed) {
          setSelectedTournament(refreshed)
        }
      }
    } catch (err: any) {
      console.error(err)
      setFetchError(err.message || 'Failed to fetch tournaments')
      addToast('error', 'Error', err.message || 'Failed to fetch tournaments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournaments()
    // Poll every 10 seconds for real-time match brackets and state sync
    const interval = setInterval(() => {
      fetchTournaments()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel('tournament-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Tournament' }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TournamentRegistration' }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'SubTournament' }, () => {
        fetchTournaments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'TournamentMatch' }, () => {
        fetchTournaments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedTournament?.id]);


  // Timer tick for countdowns
  useEffect(() => {
    const tickCountdowns = () => {
      const updateList = (list: Tournament[]) =>
        list.map(t => (t.countdown > 0 ? { ...t, countdown: t.countdown - 1 } : t))
      setRegistrationOpen(prev => updateList(prev))
      setUpcoming(prev => updateList(prev))
      if (selectedTournament && selectedTournament.countdown > 0) {
        setSelectedTournament(prev => prev ? { ...prev, countdown: prev.countdown - 1 } : null)
      }
    }
    const timer = setInterval(tickCountdowns, 1000)
    return () => clearInterval(timer)
  }, [selectedTournament])

  const handleRegister = async (tId: string, customTeamId?: string, customTeamName?: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          tournamentId: tId,
          teamId: customTeamId,
          teamName: customTeamName
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed')
      addToast('success', 'Registered Successfully! 🏆', 'You are signed up for this tournament.')
      setTeamFormOpen(false)
      await fetchTournaments(tId)
    } catch (err: any) {
      addToast('error', 'Registration Failed', err.message)
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
      addToast('success', 'Tournament Started! ⚔', 'Playable brackets have been generated!')
      await fetchTournaments(tId)
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Ready Match action
  const handleReadyMatch = async (matchId: string) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'readyMatch',
          tournamentId: selectedTournament?.id,
          matchId
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Ready check failed')
      addToast('success', 'Marked Ready! ⚔️', 'Waiting for opponent to ready up.')
      
      // Update activeMatch local state
      setActiveMatch(data.match)
      if (data.match.status === 'PLAYING') {
        setPlayingState('play')
        setSimulatedTurn('Your Turn')
        setSimulatedScoreP1(0)
        setSimulatedScoreP2(0)
        setTimerCount(15)
      }
      await fetchTournaments(selectedTournament?.id || '')
    } catch (err: any) {
      addToast('error', 'Ready Check Failed', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Active match lobby polling
  useEffect(() => {
    let interval: any = null
    if (playPanelOpen && activeMatch && activeMatch.status === 'PENDING') {
      interval = setInterval(async () => {
        if (selectedTournament) {
          try {
            const res = await fetch(`/api/tournaments`)
            const data = await res.json()
            if (res.ok && data.success) {
              // Find our active match in the fresh lists
              let foundMatch = null
              const allLists = [
                ...(data.registrationOpen || []),
                ...(data.upcoming || []),
                ...(data.live || []),
                ...(data.completed || []),
                ...(data.myTournaments || [])
              ]
              for (const tourn of allLists) {
                if (tourn.id === selectedTournament.id) {
                  // Find sub tournament match
                  const detailsRes = await fetch(`/api/tournaments`) // Fetch fresh tournament details
                  // Since allTournaments are loaded in lists, we can scan subTournaments of this tournament
                  // Wait, let's look for our match in this tournament's registrations/subs. Let's find it.
                  // We can query subTournaments matches locally if they are embedded.
                }
              }

              // Let's call GET /api/tournaments which does disqualification updates and returns fresh brackets.
              // To load specifically the active match status, let's query the main tournament API.
              // We can scan tourn list
              const tEvent = allLists.find((x: any) => x.id === selectedTournament.id)
              if (tEvent) {
                // If it's active we can load
                const detailsRes = await fetch('/api/tournaments')
                const detailsData = await detailsRes.json()
                // Let's scan all matches in all lists
              }
            }
            
            // To ensure we get the absolute fresh match, let's do a quick direct fetch of tournaments list
            const refreshRes = await fetch('/api/tournaments')
            if (refreshRes.ok) {
              const refreshData = await refreshRes.json()
              const allLists = [
                ...(refreshData.registrationOpen || []),
                ...(refreshData.upcoming || []),
                ...(refreshData.live || []),
                ...(refreshData.completed || []),
                ...(refreshData.myTournaments || [])
              ]
              const tEvent = allLists.find((x: any) => x.id === selectedTournament.id)
              if (tEvent) {
                // Fetch the tournament again or load from details
                // The client context has selectedTournament, we can fetch subTournaments
                // Let's do a refresh of the matches
                const resDetails = await fetch('/api/tournaments')
                // Wait! In GameHub, GET /api/tournaments returns all tournaments with registrations and subTournaments included!
                // Let's inspect line 30 of /api/tournaments:
                // it includes registrations and subTournaments with matches!
                // So calling GET /api/tournaments gives us the entire bracket state!
                const rData = await resDetails.json()
                if (rData.success) {
                  // Find selected tournament in myTournaments or live list
                  const matchesLists = [...rData.live, ...rData.upcoming, ...rData.myTournaments, ...rData.completed]
                  const freshTournament = matchesLists.find((t: any) => t.id === selectedTournament.id)
                  if (freshTournament && freshTournament.subTournaments) {
                    // Let's find our match
                    let freshMatch: any = null
                    for (const sub of freshTournament.subTournaments) {
                      const m = sub.matches.find((x: any) => x.id === activeMatch.id)
                      if (m) {
                        freshMatch = m
                        break
                      }
                    }
                    if (freshMatch) {
                      setActiveMatch(freshMatch)
                      if (freshMatch.status === 'PLAYING') {
                        setPlayingState('play')
                        setSimulatedTurn('Your Turn')
                        setSimulatedScoreP1(0)
                        setSimulatedScoreP2(0)
                        setTimerCount(15)
                        addToast('success', 'Match Started! ⚔️', 'Let the battle begin!')
                      } else if (['WALK_OVER', 'DISQUALIFIED', 'COMPLETED'].includes(freshMatch.status)) {
                        // Match resolved externally (e.g. timeout walkover)
                        setPlayPanelOpen(false)
                        setActiveMatch(null)
                        addToast('info', 'Match Concluded', 'Lobby closed as match has resolved.')
                        await fetchTournaments(selectedTournament.id)
                      }
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error(e)
          }
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [playPanelOpen, activeMatch, selectedTournament])

  // Create tournament
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...creationForm,
          isOfficial: user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Creation failed')
      addToast('success', 'Success! 🎉', 'Tournament created and registration is open.')
      setCreateModalOpen(false)
      setCreationForm({
        name: '',
        gameSlug: 'tic-tac-toe',
        maxPlayers: 8,
        startDate: '',
        startTime: '10:00 AM',
        privacy: 'PUBLIC'
      })
      fetchTournaments()
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Join window flow
  const handleJoinMatch = async (match: Match) => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'joinMatch',
          tournamentId: selectedTournament?.id,
          matchId: match.id
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Join match failed')
      
      setActiveMatch(data.match)
      setPlayingState('waiting')
      setPlayPanelOpen(true)
      setTimerCount(10)
      addToast('success', 'Joined Lobby 🚪', 'Waiting for opponent to ready up.')
      
      // Simulate opponent joining after 2.5s if it's a bot match
      const isBotOpponent = data.match.p2Id?.startsWith('bot-') || data.match.p1Id?.startsWith('bot-')
      if (isBotOpponent) {
        setTimeout(async () => {
          setPlayingState('play')
          setSimulatedTurn('Your Turn')
          setSimulatedScoreP1(0)
          setSimulatedScoreP2(0)
          setTimerCount(15)
        }, 2500)
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Play match logic
  useEffect(() => {
    if (playPanelOpen && playingState === 'play' && timerCount > 0) {
      const timer = setTimeout(() => {
        setTimerCount(prev => prev - 1)
        // Mock game ticks
        if (timerCount % 3 === 0) {
          const tickVal = Math.floor(Math.random() * 2)
          setSimulatedScoreP1(prev => prev + tickVal)
          setSimulatedScoreP2(prev => prev + (1 - tickVal))
          setSimulatedTurn(Math.random() > 0.5 ? 'Opponent Turn' : 'Your Turn')
        }
      }, 1000)
      return () => clearTimeout(timer)
    } else if (playPanelOpen && playingState === 'play' && timerCount === 0) {
      setPlayingState('finished')
    }
  }, [playPanelOpen, playingState, timerCount])

  const handleResolveMatch = async (outcome: 'win' | 'lose') => {
    if (!selectedTournament || !activeMatch) return
    try {
      setActionLoading(true)
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resolveMatch',
          tournamentId: selectedTournament.id,
          matchId: activeMatch.id,
          outcome
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to submit score')
      
      addToast(outcome === 'win' ? 'success' : 'info', outcome === 'win' ? 'Victory! 🎉' : 'Eliminated', outcome === 'win' ? 'Advanced to next round!' : 'You have been knocked out.')
      setPlayPanelOpen(false)
      setActiveMatch(null)
      await fetchTournaments(selectedTournament.id)

      if (data.subTournamentFinished && outcome === 'win') {
        // Trigger champion card
        setChampionDetails({
          winner: user?.user_metadata?.username || user?.email?.split('@')[0] || 'Player',
          tournament: selectedTournament.name,
          game: selectedTournament.gameSlug,
          date: new Date().toLocaleDateString()
        })
        setChampionCardOpen(true)
      }
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Claim Rewards
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
      if (data.isOfficial) {
        addToast('success', 'Claimed! 🎁', `Granted +${data.coinsReward} coins and +${data.xpReward} XP!`)
      } else {
        addToast('success', 'Claimed! 🤝', 'Claimed community trophy badge!')
      }
      await fetchTournaments(tId)
    } catch (err: any) {
      addToast('error', 'Error', err.message)
    } finally {
      setActionLoading(false)
    }
  }

  // Spectator simulation
  const handleSpectateMatch = (match: Match) => {
    setSpectatingMatch(match)
    setSpectatorScores({ p1: 0, p2: 0 })
    setSpectatorTimer(30)
    setSpectatorTurn(match.p1Name || 'Player 1')
  }

  useEffect(() => {
    if (spectatingMatch && spectatorTimer > 0) {
      const timer = setTimeout(() => {
        setSpectatorTimer(prev => prev - 1)
        if (spectatorTimer % 4 === 0) {
          const scoreP1 = Math.random() > 0.5
          setSpectatorScores(prev => ({
            p1: prev.p1 + (scoreP1 ? 1 : 0),
            p2: prev.p2 + (scoreP1 ? 0 : 1)
          }))
          setSpectatorTurn(Math.random() > 0.5 ? (spectatingMatch.p1Name || 'Player 1') : (spectatingMatch.p2Name || 'Player 2'))
        }
      }, 1000)
      return () => clearTimeout(timer)
    } else if (spectatingMatch && spectatorTimer === 0) {
      setSpectatingMatch(null)
      addToast('info', 'Match Concluded', 'Spectator stream ended.')
    }
  }, [spectatingMatch, spectatorTimer])

  // Get active match for current user in selected tournament
  const getMyActiveMatch = () => {
    if (!selectedTournament || !selectedTournament.subTournaments) return null
    for (const sub of selectedTournament.subTournaments) {
      const found = sub.matches.find(
        m => (m.p1Id === user?.id || m.p2Id === user?.id) && m.winnerId === null && (m.status === 'PENDING' || m.status === 'PLAYING')
      )
      if (found) return found
    }
    return null
  }

  // Check if join window is open
  const isJoinWindowOpen = (m: Match) => {
    const now = Date.now()
    const start = new Date(m.joinWindowStart).getTime()
    const end = new Date(m.joinWindowEnd).getTime()
    return now >= start && now <= end
  }

  // Format countdown seconds
  const formatTime = (seconds: number) => {
    if (seconds <= 0) return '00:00:00'
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Render Bracket Tree
  const renderBracket = (sub: SubTournament) => {
    // Sort matches
    const roundsMap: Record<number, { name: string; matches: Match[] }> = {}
    sub.matches.forEach(m => {
      if (!roundsMap[m.roundIndex]) {
        roundsMap[m.roundIndex] = { name: m.roundName, matches: [] }
      }
      roundsMap[m.roundIndex].matches.push(m)
    })

    const sortedRounds = Object.keys(roundsMap)
      .map(Number)
      .sort((a, b) => a - b)

    // Calculate metrics
    const totalParticipants = sub.capacity
    const completedMatches = sub.matches.filter(m => ['COMPLETED', 'WALK_OVER', 'DISQUALIFIED'].includes(m.status))
    const eliminatedPlayers = completedMatches.length
    const remainingPlayers = Math.max(1, totalParticipants - eliminatedPlayers)

    const activeRounds = sub.matches.filter(m => m.status === 'PENDING' || m.status === 'PLAYING').map(m => m.roundName)
    const currentRoundName = activeRounds.length > 0 ? activeRounds[0] : 'Concluded'

    const finalsMatch = sub.matches.find(m => m.roundName === 'Finals')
    const championName = sub.winnerId !== null && finalsMatch 
      ? (finalsMatch.winnerId === finalsMatch.p1Id ? finalsMatch.p1Name : finalsMatch.p2Name) 
      : null

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Bracket Stats Panel */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          background: 'rgba(9, 11, 20, 0.6)',
          padding: '0.75rem 1.25rem',
          borderRadius: 12,
          border: '1px solid #1e293b'
        }}>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Current Round: <strong style={{ color: 'white' }}>{currentRoundName}</strong>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Remaining Players: <strong style={{ color: '#10b981' }}>{remainingPlayers}</strong>
          </div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Eliminated: <strong style={{ color: '#f87171' }}>{eliminatedPlayers}</strong>
          </div>
          {championName && (
            <div style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 900, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span>🏆 Champion:</span>
              <span>{championName}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '3rem', overflowX: 'auto', padding: '1.5rem 0.5rem', scrollbarWidth: 'thin' }}>
          {sortedRounds.map(rIndex => {
            const round = roundsMap[rIndex]
            return (
              <div key={rIndex} style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', minWidth: 220, justifyContent: 'space-around' }}>
                <div style={{ textTransform: 'uppercase', fontSize: '0.7rem', color: '#6366f1', fontWeight: 900, textAlign: 'center', letterSpacing: '0.1em' }}>
                  {round.name}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', justifyContent: 'center', height: '100%' }}>
                  {round.matches.sort((a,b) => a.matchIndex - b.matchIndex).map(match => {
                    const isP1User = match.p1Id === user?.id
                    const isP2User = match.p2Id === user?.id
                    const isUserInMatch = isP1User || isP2User
                    
                    // Champion path logic: Highlight path taken by overall champion
                    const isChampionPath = sub.winnerId !== null && (match.p1Id === sub.winnerId || match.p2Id === sub.winnerId)

                    return (
                      <div 
                        key={match.id}
                        className="bracket-match-node"
                        style={{
                          background: isChampionPath ? 'linear-gradient(135deg, #1e1b4b, #1e213d)' : 'linear-gradient(135deg, #131524, #191c33)',
                          borderRadius: 12,
                          padding: '0.8rem',
                          border: isChampionPath 
                            ? '1px solid #fbbf24' 
                            : isUserInMatch 
                              ? '1px solid #6366f1' 
                              : '1px solid #1f293d',
                          boxShadow: isChampionPath 
                            ? '0 0 15px rgba(251, 191, 36, 0.2)' 
                            : isUserInMatch 
                              ? '0 0 15px rgba(99, 102, 241, 0.25)' 
                              : 'none',
                          position: 'relative'
                        }}
                      >
                        {/* P1 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: match.winnerId === match.p1Id && match.winnerId ? 800 : 500,
                            color: match.p1Id === sub.winnerId && sub.winnerId
                              ? '#fbbf24'
                              : match.winnerId === match.p1Id && match.winnerId 
                                ? '#fff' 
                                : match.winnerId 
                                  ? '#4b5563' 
                                  : '#fff'
                          }}>
                            {isP1User ? '⭐ You' : (match.p1Name || 'TBD')}
                            {match.p1Id === sub.winnerId && sub.winnerId && ' 👑'}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f3f4f6' }}>
                            {match.p1Score !== null ? match.p1Score : ''}
                          </span>
                        </div>
                        
                        {/* Divider */}
                        <div style={{ height: 1, background: '#1f293d', margin: '0.3rem 0' }} />

                        {/* P2 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.8rem', 
                            fontWeight: match.winnerId === match.p2Id && match.winnerId ? 800 : 500,
                            color: match.p2Id === sub.winnerId && sub.winnerId
                              ? '#fbbf24'
                              : match.winnerId === match.p2Id && match.winnerId 
                                ? '#fff' 
                                : match.winnerId 
                                  ? '#4b5563' 
                                  : '#fff'
                          }}>
                            {isP2User ? '⭐ You' : (match.p2Name || 'TBD')}
                            {match.p2Id === sub.winnerId && sub.winnerId && ' 👑'}
                          </span>
                          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#f3f4f6' }}>
                            {match.p2Score !== null ? match.p2Score : ''}
                          </span>
                        </div>

                        {/* Live Badge / Play Button */}
                        {(match.status === 'PENDING' || match.status === 'PLAYING') && match.p1Id && match.p2Id && (
                          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.6rem' }}>
                            {isUserInMatch && isJoinWindowOpen(match) && (
                              <button 
                                className="btn-primary"
                                onClick={() => handleJoinMatch(match)}
                                style={{ flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.72rem', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                              >
                                <Play size={10} /> Play Now
                              </button>
                            )}
                            {!isUserInMatch && (
                              <button
                                onClick={() => handleSpectateMatch(match)}
                                style={{
                                  flex: 1,
                                  padding: '0.3rem 0.5rem',
                                  fontSize: '0.72rem',
                                  background: '#1e293b',
                                  border: '1px solid #334155',
                                  borderRadius: 6,
                                  color: '#94a3b8',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '0.2rem'
                                }}
                              >
                                <Eye size={10} /> Spectate
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Admin Gate ──
  // While role is being resolved, show a subtle spinner
  if (isAdmin === null) {
    return (
      <PageWrapper className="animate-fadeIn" style={{ maxWidth: 1100, marginInline: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '40vh' }}>
          <div style={{ textAlign: 'center', color: 'hsl(220 10% 50%)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏳</div>
            <p style={{ fontSize: '0.9rem' }}>Loading...</p>
          </div>
        </div>
      </PageWrapper>
    )
  }

  // Non-admins see a Coming Soon lock screen
  if (!isAdmin) {
    return (
      <PageWrapper className="animate-fadeIn" style={{ maxWidth: 900, marginInline: 'auto' }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          textAlign: 'center',
          gap: '1.5rem',
          padding: '2rem 1rem',
        }}>
          {/* Trophy icon with glow */}
          <div style={{
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              position: 'absolute',
              inset: '-20px',
              background: 'radial-gradient(circle, hsl(38 95% 55% / 0.15) 0%, transparent 70%)',
              borderRadius: '50%',
              animation: 'pulse 2s ease-in-out infinite',
            }} />
            <div style={{
              fontSize: '5rem',
              lineHeight: 1,
              filter: 'drop-shadow(0 0 20px hsl(38 95% 55% / 0.4))',
            }}>
              🏆
            </div>
          </div>

          {/* Lock badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.7rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '0.3rem 0.8rem',
            borderRadius: 99,
            background: 'hsl(220 100% 60% / 0.12)',
            border: '1px solid hsl(220 100% 60% / 0.3)',
            color: 'hsl(220 100% 70%)',
          }}>
            🔒 Coming Soon
          </div>

          <div>
            <h1 style={{
              fontSize: 'clamp(1.8rem, 5vw, 2.5rem)',
              fontWeight: 900,
              letterSpacing: '-0.03em',
              marginBottom: '0.5rem',
              background: 'linear-gradient(135deg, hsl(38 95% 60%), hsl(45 100% 65%))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Tournaments
            </h1>
            <p style={{
              fontSize: '1rem',
              color: 'hsl(220 10% 55%)',
              maxWidth: 480,
              lineHeight: 1.6,
              margin: '0 auto',
            }}>
              Competitive tournaments are in development and will be available to all players soon. Stay tuned for epic bracket battles, seasonal competitions, and exclusive rewards!
            </p>
          </div>

          {/* Feature teaser pills */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.6rem',
            justifyContent: 'center',
            marginTop: '0.5rem',
          }}>
            {['🏅 Exclusive Rewards', '📊 Bracket System', '🌍 Global Rankings', '⚔️ 1v1 Duels', '🎖️ Season Passes'].map(feat => (
              <span key={feat} style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                padding: '0.3rem 0.75rem',
                borderRadius: 99,
                background: 'hsl(220 20% 13%)',
                border: '1px solid hsl(220 20% 20%)',
                color: 'hsl(220 10% 65%)',
              }}>
                {feat}
              </span>
            ))}
          </div>

          <p style={{ fontSize: '0.8rem', color: 'hsl(220 10% 40%)', marginTop: '0.5rem' }}>
            Keep playing to be ready when the arena opens!
          </p>
        </div>

        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 0.6; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.05); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper className="animate-fadeIn safe-bottom-padding" style={{ maxWidth: 1100, marginInline: 'auto' }}>
      
      {/* Header banner */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        background: 'linear-gradient(90deg, #131525 0%, #1e213d 100%)',
        border: '1px solid #1e293b',
        borderRadius: 16,
        padding: '2rem 1.5rem',
        marginBottom: '1.5rem',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.4)',
        gap: '1.25rem',
        width: '100%'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', justifyContent: 'center' }}>
            <span style={{ fontSize: '2rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>🏆</span>
            <h1 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: 0, lineHeight: 1.2 }}>
              ESPORTS TOURNAMENT ARENA
            </h1>
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: '0.25rem 0 0', maxWidth: 680, lineHeight: 1.4 }}>
            Compete in official ranked events or create community brackets with friends. Automatically split, match, and climb brackets!
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setCreateModalOpen(true)}
            style={{ fontWeight: 800, padding: '0.55rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Plus size={16} /> Create Tournament
          </button>
        </div>
      </div>

      {fetchError ? (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '4rem 1.5rem', background: '#0e111e', border: '1px solid #ef4444', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.08)', gap: '1.25rem', textAlign: 'center', margin: '2rem 0'
        }}>
          <span style={{ fontSize: '3rem' }}>🔌</span>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 900, color: 'white', margin: 0 }}>
              Connection Error
            </h2>
            <p style={{ color: '#f87171', fontSize: '0.88rem', margin: '0.5rem 0 0', maxWidth: 460 }}>
              {fetchError}
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => fetchTournaments()}
            style={{ fontWeight: 800, padding: '0.6rem 1.5rem', background: '#ef4444', border: 'none', cursor: 'pointer', borderRadius: 8 }}
          >
            🔄 Retry Connection
          </button>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '6rem 1rem', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            width: 48, height: 48, border: '4px solid rgba(99, 102, 241, 0.1)', borderTop: '4px solid #6366f1',
            borderRadius: '50%', animation: 'spin 1s infinite linear'
          }} />
          <style>{`
            @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          `}</style>
          <p style={{ color: '#94a3b8', fontSize: '0.85rem', fontWeight: 700, margin: 0 }}>
            Loading Tournament Arena...
          </p>
        </div>
      ) : !selectedTournament ? (
        <>
          {/* Dashboard Section Selection */}
          <div className="horizontal-tab-bar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
            {[
              { id: 'registrationOpen', label: 'Registration Open', count: registrationOpen.length },
              { id: 'live', label: 'Live Events', count: live.length },
              { id: 'upcoming', label: 'Upcoming Brackets', count: upcoming.length },
              { id: 'myTournaments', label: 'My Tournaments', count: myTournaments.length },
              { id: 'completed', label: 'Completed', count: completed.length }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveDashboardSection(tab.id as any)}
                style={{
                  background: activeDashboardSection === tab.id ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  border: 'none',
                  color: activeDashboardSection === tab.id ? '#818cf8' : '#94a3b8',
                  padding: '0.5rem 1rem',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease-in-out'
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span style={{ 
                    background: activeDashboardSection === tab.id ? '#6366f1' : '#334155', 
                    color: '#fff', 
                    fontSize: '0.7rem', 
                    padding: '0.1rem 0.4rem', 
                    borderRadius: 12 
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1.25rem' }}>
            {(() => {
              let currentList: Tournament[] = []
              if (activeDashboardSection === 'registrationOpen') currentList = registrationOpen
              else if (activeDashboardSection === 'upcoming') currentList = upcoming
              else if (activeDashboardSection === 'live') currentList = live
              else if (activeDashboardSection === 'completed') currentList = completed
              else if (activeDashboardSection === 'myTournaments') currentList = myTournaments

              if (currentList.length === 0) {
                return (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '4rem 1rem', 
                    border: '1px dashed #1e293b', 
                    borderRadius: 16, 
                    color: '#64748b' 
                  }}>
                    <Trophy size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0, fontWeight: 700 }}>No Tournaments Available</p>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>Check back later or host your own community event!</p>
                  </div>
                )
              }

              return currentList.map(t => (
                <div 
                  key={t.id}
                  onClick={() => {
                    setSelectedTournament(t)
                    setActiveDetailsTab('overview')
                  }}
                  className="tournament-card"
                  style={{
                    background: 'linear-gradient(135deg, #0e111e 0%, #151829 100%)',
                    borderRadius: 16,
                    border: '1px solid #1e293b',
                    padding: '1.25rem',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    transition: 'all 0.25s ease'
                  }}
                >
                  {/* Banner indicator */}
                  {t.bannerUrl ? (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `url(${t.bannerUrl})` }} />
                  ) : (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: t.isOfficial ? 'linear-gradient(90deg, #6366f1, #ec4899)' : 'linear-gradient(90deg, #10b981, #3b82f6)' }} />
                  )}

                  {/* Header Row */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        padding: '0.2rem 0.5rem',
                        borderRadius: 6,
                        background: t.isOfficial ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                        color: t.isOfficial ? '#818cf8' : '#34d399',
                        border: t.isOfficial ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(16,185,129,0.3)'
                      }}>
                        {t.isOfficial ? '👑 Official' : '👥 Community'}
                      </span>

                      {/* Live Badge */}
                      {t.status === 'ACTIVE' && (
                        <span className="live-pulse" style={{
                          fontSize: '0.65rem',
                          fontWeight: 900,
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239,68,68,0.3)',
                          padding: '0.2rem 0.5rem',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
                          Round {t.currentRound.replace(' Live', '')} Live
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 900, color: 'white', margin: '0.25rem 0', letterSpacing: '-0.02em' }}>
                      {t.name}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.1rem 0 0.5rem', textTransform: 'uppercase', fontWeight: 800 }}>
                      🎮 {t.gameSlug.replace('-', ' ')}
                    </p>
                  </div>

                  {/* Mid details */}
                  <div style={{ background: '#090b14', borderRadius: 12, padding: '0.75rem', margin: '0.50rem 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Users size={12} color="#64748b" />
                        <div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>PLAYERS</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f3f4f6' }}>
                            {t.status === 'ACTIVE' ? `${t.activePlayers}/${t.registeredPlayers} Active` : `${t.registeredPlayers}/${t.maxPlayers} Joined`}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <Award size={12} color="#fbbf24" />
                        <div>
                          <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>REWARDS</div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#fbbf24' }}>
                            {t.rewardsString}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Footer Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.72rem', color: '#94a3b8' }}>
                      <Clock size={12} />
                      {t.status === 'REGISTRATION_OPEN' && (
                        <span>Closes in: <strong style={{ color: '#ef4444' }}>{formatTime(t.countdown)}</strong></span>
                      )}
                      {t.status === 'REGISTRATION_CLOSED' && (
                        <span>Starts in: <strong style={{ color: '#fbbf24' }}>{formatTime(t.countdown)}</strong></span>
                      )}
                      {t.status === 'ACTIVE' && (
                        <span style={{ color: '#34d399', fontWeight: 800 }}>LIVE NOW</span>
                      )}
                      {t.status === 'COMPLETED' && (
                        <span style={{ color: '#94a3b8', fontWeight: 700 }}>CONCLUDED</span>
                      )}
                      {t.status === 'CLAIMED' && (
                        <span style={{ color: '#10b981', fontWeight: 800 }}>REWARDS CLAIMED</span>
                      )}
                    </div>

                    <ChevronRight size={16} color="#475569" />
                  </div>
                </div>
              ))
            })()}
          </div>
        </>
      ) : (
        /* ================= SELECTED TOURNAMENT DETAILS PAGE ================= */
        <div className="animate-fadeIn">
          
          {/* Back button */}
          <button 
            className="btn btn-secondary btn-sm"
            onClick={() => setSelectedTournament(null)}
            style={{ marginBottom: '1rem', padding: '0.4rem 0.8rem', fontWeight: 800 }}
          >
            ← Back to Lobby
          </button>

          {/* Details header */}
          <div style={{
            background: 'linear-gradient(135deg, #0e111e 0%, #151829 100%)',
            border: '1px solid #1e293b',
            borderRadius: 16,
            padding: '1.5rem',
            marginBottom: '1.5rem',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 4px 30px rgba(0,0,0,0.35)'
          }}>
            {/* Game theme accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: selectedTournament.isOfficial ? 'linear-gradient(90deg, #6366f1, #ec4899)' : 'linear-gradient(90deg, #10b981, #3b82f6)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.25rem' }}>
              <div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 6,
                    background: selectedTournament.isOfficial ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                    color: selectedTournament.isOfficial ? '#818cf8' : '#34d399',
                    border: selectedTournament.isOfficial ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(16,185,129,0.3)'
                  }}>
                    {selectedTournament.isOfficial ? '👑 Official Tournament' : '👥 Community Tournament'}
                  </span>
                  
                  {selectedTournament.privacy !== 'PUBLIC' && (
                    <span style={{ fontSize: '0.65rem', background: '#334155', color: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 800 }}>
                      🔒 PRIVATE
                    </span>
                  )}
                </div>

                <h2 style={{ fontSize: '1.6rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', margin: 0 }}>
                  {selectedTournament.name}
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  {selectedTournament.description || 'No description provided.'}
                </p>

                {selectedTournament.inviteCode && (
                  <div style={{ marginTop: '0.50rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>Invite Code:</span>
                    <code style={{ background: '#1e293b', color: '#f3f4f6', padding: '0.2rem 0.6rem', borderRadius: 6, fontSize: '0.8rem', fontWeight: 900 }}>
                      {selectedTournament.inviteCode}
                    </code>
                  </div>
                )}
              </div>

              {/* Status details & actions */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>TOURNAMENT REWARD</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fbbf24' }}>
                    {selectedTournament.rewardsString}
                  </div>
                </div>

                {/* Main Action Trigger Buttons */}
                <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                  {/* Register */}
                  {!selectedTournament.isRegistered && selectedTournament.status === 'REGISTRATION_OPEN' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        const isTeamGame = selectedTournament.gameSlug === 'cricket' || selectedTournament.gameSlug === 'scribble'
                        if (isTeamGame) {
                          setTeamFormOpen(true)
                        } else {
                          handleRegister(selectedTournament.id)
                        }
                      }}
                      disabled={actionLoading}
                    >
                      {actionLoading ? 'Joining...' : 'Register Now'}
                    </button>
                  )}

                  {/* Start (If user registered and event is closed/startable) */}
                  {selectedTournament.isRegistered && selectedTournament.status === 'REGISTRATION_OPEN' && (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleStartTournament(selectedTournament.id)}
                      disabled={actionLoading || selectedTournament.registeredPlayers < 4}
                      style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      {actionLoading ? 'Initializing...' : '⚡ Close Reg & Start'}
                    </button>
                  )}

                  {/* Claim rewards */}
                  {(selectedTournament.status === 'COMPLETED') && selectedTournament.isRegistered && (
                    <button
                      className="btn btn-primary animate-pulse-glow"
                      onClick={() => handleClaimRewards(selectedTournament.id)}
                      disabled={actionLoading}
                      style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 900 }}
                    >
                      🎁 Claim Rewards
                    </button>
                  )}

                  {selectedTournament.status === 'CLAIMED' && (
                    <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 800 }}>
                      ✓ Rewards Claimed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Waiting list banner */}
            {selectedTournament.waitingListState && (
              <div style={{
                marginTop: '1.25rem',
                background: 'rgba(251, 191, 36, 0.08)',
                border: '1px solid rgba(251,191,36,0.25)',
                borderRadius: 12,
                padding: '0.85rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <ShieldAlert color="#fbbf24" size={20} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 900, color: '#fbbf24' }}>
                    You are in the Waiting List ⏳
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fbbf24', opacity: 0.8, marginTop: '0.15rem' }}>
                    Queue Position: <strong>#{selectedTournament.waitingListState.waitingPosition}</strong> · Players Needed: <strong>{selectedTournament.waitingListState.playersNeeded} more</strong> · Est. Start: <strong>{selectedTournament.waitingListState.estStart}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Details tab selector */}
          <div className="horizontal-tab-bar" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
            {[
              { id: 'overview', label: 'Overview', icon: <Info size={14} /> },
              { id: 'schedule', label: 'My Schedule', icon: <Calendar size={14} /> },
              { id: 'bracket', label: 'Brackets', icon: <Trophy size={14} /> },
              { id: 'players', label: 'Registered Players', icon: <Users size={14} /> },
              { id: 'results', label: 'Match Results', icon: <CheckCircle size={14} /> },
              { id: 'rules', label: 'Rules & Info', icon: <FileText size={14} /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveDetailsTab(tab.id as any)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: activeDetailsTab === tab.id ? '#818cf8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  position: 'relative',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.icon}
                {tab.label}
                {activeDetailsTab === tab.id && (
                  <div style={{ position: 'absolute', bottom: -8, left: 0, right: 0, height: 3, background: '#6366f1', borderRadius: 99 }} />
                )}
              </button>
            ))}
          </div>

          {/* ================= TABS PANELS CONTENT ================= */}

          {/* TAB 1: OVERVIEW */}
          {activeDetailsTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              <Card style={{ background: '#0e111e', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                  Tournament Specifications
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Game Mode</span>
                    <strong style={{ color: '#fff', textTransform: 'uppercase' }}>{selectedTournament.gameSlug.replace('-', ' ')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Bracket Split Mode</span>
                    <strong style={{ color: '#fff' }}>Knockout ({selectedTournament.preferredSplit === '8x2' ? '8-Player Brackets' : '4-Player Brackets'})</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Registration Pool</span>
                    <strong style={{ color: '#fff' }}>{selectedTournament.registeredPlayers} / {selectedTournament.maxPlayers} Joined</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Duration</span>
                    <strong style={{ color: '#fff' }}>{selectedTournament.durationDays} Day{selectedTournament.durationDays > 1 ? 's' : ''}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Schedule Type</span>
                    <strong style={{ color: '#fff' }}>{selectedTournament.type === 'ONE_DAY' ? 'One Day (Hourly Interval)' : 'Multi Day (24-Hour Interval)'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: '#64748b' }}>Match Start Time</span>
                    <strong style={{ color: '#fff' }}>{selectedTournament.startTime || '10:00 AM'}</strong>
                  </div>
                </div>
              </Card>

              <Card style={{ background: '#0e111e', padding: '1.25rem' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                  Lobby Details & Schedule Dates
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b' }}>Reg Starts</span>
                    <strong style={{ color: '#fff' }}>{formatIST(selectedTournament.regStart)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b' }}>Reg Ends</span>
                    <strong style={{ color: '#fff' }}>{formatIST(selectedTournament.regEnd)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b' }}>Event Start</span>
                    <strong style={{ color: '#fff' }}>{formatIST(selectedTournament.startDate)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <span style={{ color: '#64748b' }}>Event Conclusion</span>
                    <strong style={{ color: '#fff' }}>{formatIST(selectedTournament.endDate)}</strong>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* TAB 2: SCHEDULE */}
          {activeDetailsTab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(() => {
                const myMatch = getMyActiveMatch()
                if (!myMatch) {
                  return (
                    <div style={{ textAlign: 'center', padding: '3rem 1rem', border: '1px dashed #1e293b', borderRadius: 16, color: '#64748b' }}>
                      <Calendar size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <p style={{ margin: 0, fontWeight: 700 }}>No Active Matches Scheduled</p>
                      <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>
                        {selectedTournament.status === 'REGISTRATION_OPEN' 
                          ? 'Wait for the bracket to be generated after registration closes.' 
                          : 'You have been eliminated or have no active matches in this lobby.'}
                      </p>
                    </div>
                  )
                }

                const windowOpen = isJoinWindowOpen(myMatch)

                return (
                  <Card style={{ background: '#0e111e', border: '1px solid #6366f1', padding: '1.25rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div>
                        <span style={{ fontSize: '0.65rem', background: '#6366f1', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 800, textTransform: 'uppercase' }}>
                          Round Index: {myMatch.roundIndex + 1} ({myMatch.roundName})
                        </span>
                        <h4 style={{ fontSize: '1.15rem', color: '#fff', fontWeight: 900, margin: '0.5rem 0 0.25rem' }}>
                          VS {myMatch.p1Id === user?.id ? (myMatch.p2Name || 'Bot Opponent') : (myMatch.p1Name || 'Bot Opponent')}
                        </h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.78rem', margin: 0 }}>
                          Match Time: <strong>{formatIST(myMatch.matchTime)}</strong>
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        {windowOpen ? (
                          <button 
                            className="btn btn-primary animate-pulse-glow"
                            onClick={() => handleJoinMatch(myMatch)}
                          >
                            ⚔ Play Now
                          </button>
                        ) : (
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>JOIN WINDOW OPENS</div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f3f4f6' }}>
                              {formatIST(myMatch.joinWindowStart, 'time')}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })()}
            </div>
          )}

          {/* TAB 3: BRACKETS */}
          {activeDetailsTab === 'bracket' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {selectedTournament.subTournaments && selectedTournament.subTournaments.length > 0 ? (
                selectedTournament.subTournaments.map((sub, sIndex) => (
                  <Card key={sub.id} style={{ background: '#0e111e', padding: '1.25rem' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fff', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Division {sIndex + 1}: {sub.name}</span>
                      <span style={{ fontSize: '0.7rem', background: '#334155', color: '#cbd5e1', padding: '0.2rem 0.5rem', borderRadius: 6 }}>
                        {sub.capacity} PLAYERS
                      </span>
                    </div>
                    {renderBracket(sub)}
                  </Card>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', border: '1px dashed #1e293b', borderRadius: 16, color: '#64748b' }}>
                  <Trophy size={36} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                  <p style={{ margin: 0, fontWeight: 700 }}>Brackets Not Generated Yet</p>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem' }}>Brackets will automatically generate once registration closes.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PLAYERS */}
          {activeDetailsTab === 'players' && (
            <Card style={{ background: '#0e111e', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                Registrations Pool ({selectedTournament.registeredPlayers} Users)
              </h3>
              
              {selectedTournament.registrations && selectedTournament.registrations.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  {selectedTournament.registrations.map((r: any) => (
                    <div 
                      key={r.id}
                      style={{
                        background: '#090b14',
                        border: '1px solid #1e293b',
                        borderRadius: 12,
                        padding: '0.75rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: r.status === 'WAITING_LIST' ? '#fbbf24' : '#10b981' }} />
                        <span style={{ fontSize: '0.8rem', color: '#f3f4f6', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {r.team ? `🛡️ ${r.team.name}` : (r.profile?.username || 'Player')}
                        </span>
                      </div>
                      
                      <span style={{ 
                        fontSize: '0.62rem', 
                        fontWeight: 800, 
                        color: r.status === 'WAITING_LIST' ? '#fbbf24' : '#10b981',
                        textTransform: 'uppercase'
                      }}>
                        {r.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>No players registered yet.</p>
              )}
            </Card>
          )}

          {/* TAB 5: RESULTS */}
          {activeDetailsTab === 'results' && (
            <Card style={{ background: '#0e111e', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                Completed Match History
              </h3>

              {selectedTournament.subTournaments && selectedTournament.subTournaments.some(sub => sub.matches.some(m => m.status === 'COMPLETED' || m.status === 'WALK_OVER' || m.status === 'DISQUALIFIED')) ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedTournament.subTournaments.map(sub => 
                    sub.matches
                      .filter(m => m.status === 'COMPLETED' || m.status === 'WALK_OVER' || m.status === 'DISQUALIFIED')
                      .map(match => (
                        <div 
                          key={match.id}
                          style={{
                            background: '#090b14',
                            border: '1px solid #1e293b',
                            borderRadius: 12,
                            padding: '0.75rem 1rem',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '1rem'
                          }}
                        >
                          <div>
                            <span style={{ fontSize: '0.65rem', background: '#1e293b', color: '#cbd5e1', padding: '0.15rem 0.4rem', borderRadius: 4, textTransform: 'uppercase' }}>
                              {sub.name} - {match.roundName}
                            </span>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f3f4f6', marginTop: '0.25rem' }}>
                              {match.p1Name} vs {match.p2Name}
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 800 }}>
                              Score: {match.p1Score}-{match.p2Score}
                            </span>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 900,
                              background: 'rgba(16,185,129,0.15)',
                              color: '#34d399',
                              padding: '0.2rem 0.5rem',
                              borderRadius: 6
                            }}>
                              Winner: {match.p1Id === match.winnerId ? match.p1Name : match.p2Name}
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b' }}>
                  No match results registered yet.
                </div>
              )}
            </Card>
          )}

          {/* TAB 6: RULES */}
          {activeDetailsTab === 'rules' && (
            <Card style={{ background: '#0e111e', padding: '1.25rem' }}>
              <h3 style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 900, textTransform: 'uppercase', marginBottom: '1rem', borderBottom: '1px solid #1e293b', paddingBottom: '0.5rem' }}>
                Rules & Platform Guidelines
              </h3>
              
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6' }}>
                <p>
                  Welcome to the <strong>GameHub esports segment</strong>. Please review the mandatory bracket regulations before starting:
                </p>
                <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <li><strong>Join Window Protocol:</strong> Players must join within the allocated join window. Join opens 5 minutes before the match time and closes 10 minutes after.</li>
                  <li><strong>Automatic Walkovers:</strong> If a player fails to join/ready up within the 10-minute timeout after the match starts, they are automatically disqualified. The active opponent advances by default.</li>
                  <li><strong>Spectator mode:</strong> Eliminated players and visitors can spectate active match streams in real-time.</li>
                  <li><strong>Rewards & XP Rules:</strong> Official tournaments award platform Coins, Level XP, and Titles. User-created Community tournaments are purely casual and do not award any platform progression.</li>
                </ul>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ================= CREATE TOURNAMENT MODAL ================= */}
      {createModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(8px)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <Card style={{
            width: '100%', maxWidth: 520, background: '#0e111e', display: 'flex', flexDirection: 'column', gap: '1.25rem',
            border: '1px solid #1e293b', boxShadow: '0 25px 60px rgba(0,0,0,0.6)', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, color: 'white' }}>
                🏆 Host Tournament Event
              </h3>
              <button onClick={() => setCreateModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTournament} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Tournament Name</label>
                <input 
                  className="input" type="text" required
                  value={creationForm.name}
                  onChange={e => setCreationForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Select Game</label>
                  <select 
                    value={creationForm.gameSlug}
                    onChange={e => setCreationForm(prev => ({ ...prev, gameSlug: e.target.value }))}
                    style={{ background: '#090b14', border: '1px solid #1e293b', color: '#fff', borderRadius: 8, padding: '0.4rem', width: '100%', fontSize: '0.8rem' }}
                  >
                    <option value="tic-tac-toe">Tic-Tac-Toe</option>
                    <option value="cricket">Hand Cricket</option>
                    <option value="dots-boxes">Dots & Boxes</option>
                    <option value="scribble">Scribble</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Max Players</label>
                  <input 
                    className="input" type="number" min={4} required
                    value={creationForm.maxPlayers}
                    onChange={e => setCreationForm(prev => ({ ...prev, maxPlayers: parseInt(e.target.value, 10) || 8 }))}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Start Date</label>
                  <input 
                    className="input" type="date" required
                    value={creationForm.startDate}
                    onChange={e => setCreationForm(prev => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Start Time</label>
                  <input 
                    className="input" type="text" placeholder="10:00 AM" required
                    value={creationForm.startTime}
                    onChange={e => setCreationForm(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Privacy</label>
                <select 
                  value={creationForm.privacy}
                  onChange={e => setCreationForm(prev => ({ ...prev, privacy: e.target.value as any }))}
                  style={{ background: '#090b14', border: '1px solid #1e293b', color: '#fff', borderRadius: 8, padding: '0.4rem', width: '100%', fontSize: '0.8rem' }}
                >
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private (Approval req)</option>
                  <option value="INVITE_CODE">Invite Code Only</option>
                </select>
              </div>

              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={actionLoading}
                style={{ marginTop: '0.5rem', width: '100%', fontWeight: 800 }}
              >
                {actionLoading ? 'Creating...' : 'Create Tournament'}
              </button>
            </form>
          </Card>
        </div>
      )}

      {/* ================= PLAY MATCH WINDOW OVERLAY ================= */}
      {playPanelOpen && activeMatch && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 8, 16, 0.92)', backdropFilter: 'blur(10px)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifySelf: 'center', justifyItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <Card style={{
            width: '100%', maxWidth: 440, background: '#0e111e', border: '1px solid #6366f1',
            boxShadow: '0 25px 60px rgba(99, 102, 241, 0.25)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                ⚔️ {activeMatch.roundName}: Active Match Lobby
              </h3>
              <button 
                onClick={() => {
                  setPlayPanelOpen(false)
                  setActiveMatch(null)
                }} 
                style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Ready state checks or waiting overlay */}
            {activeMatch.status === 'PENDING' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', background: '#090b14', padding: '0.5rem', borderRadius: 8 }}>
                  ⏱️ Join window closes at: {formatIST(activeMatch.joinWindowEnd, 'time')}
                </div>
                
                {/* Player Cards Row */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', alignItems: 'stretch' }}>
                  {/* P1 Card */}
                  <div style={{
                    flex: 1,
                    background: activeMatch.p1Ready ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: activeMatch.p1Ready ? '1px solid #10b981' : '1px solid #1e293b',
                    borderRadius: 16,
                    padding: '1.25rem 0.75rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: 'center'
                  }}>
                    <div style={{ fontSize: '1.6rem' }}>🎮</div>
                    <div style={{ fontWeight: 800, color: 'white', fontSize: '0.82rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeMatch.p1Name || 'Player 1'}
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      color: activeMatch.p1Ready ? '#10b981' : activeMatch.p1Joined ? '#3b82f6' : '#64748b',
                      background: activeMatch.p1Ready ? 'rgba(16,185,129,0.12)' : activeMatch.p1Joined ? 'rgba(59,130,246,0.12)' : 'rgba(100,116,139,0.12)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6
                    }}>
                      {activeMatch.p1Ready ? '✅ READY' : activeMatch.p1Joined ? 'Joined' : 'Connecting...'}
                    </span>
                  </div>

                  {/* VS */}
                  <div style={{ alignSelf: 'center', fontWeight: 900, color: '#475569', fontSize: '0.9rem' }}>VS</div>

                  {/* P2 Card */}
                  <div style={{
                    flex: 1,
                    background: activeMatch.p2Ready ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                    border: activeMatch.p2Ready ? '1px solid #10b981' : '1px solid #1e293b',
                    borderRadius: 16,
                    padding: '1.25rem 0.75rem',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.5rem',
                    justifyContent: 'center'
                  }}>
                    <div style={{ fontSize: '1.6rem' }}>🤖</div>
                    <div style={{ fontWeight: 800, color: 'white', fontSize: '0.82rem', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {activeMatch.p2Name || 'Player 2'}
                    </div>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 900,
                      color: activeMatch.p2Ready ? '#10b981' : activeMatch.p2Joined ? '#3b82f6' : '#64748b',
                      background: activeMatch.p2Ready ? 'rgba(16,185,129,0.12)' : activeMatch.p2Joined ? 'rgba(59,130,246,0.12)' : 'rgba(100,116,139,0.12)',
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6
                    }}>
                      {activeMatch.p2Ready ? '✅ READY' : activeMatch.p2Joined ? 'Joined' : 'Connecting...'}
                    </span>
                  </div>
                </div>

                {/* Ready Up Button */}
                {(() => {
                  const isP1 = activeMatch.p1Id === user?.id
                  const userReady = isP1 ? activeMatch.p1Ready : activeMatch.p2Ready
                  
                  if (userReady) {
                    return (
                      <div style={{ textAlign: 'center', padding: '1rem', color: '#818cf8', fontWeight: 800, fontSize: '0.85rem', border: '1px dashed #312e81', borderRadius: 12 }}>
                        ⏳ Waiting for opponent to ready up...
                      </div>
                    )
                  } else {
                    return (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleReadyMatch(activeMatch.id)}
                        disabled={actionLoading}
                        style={{ width: '100%', fontWeight: 900, padding: '0.75rem', background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
                      >
                        {actionLoading ? 'Loading...' : '⚡ I AM READY'}
                      </button>
                    )
                  }
                })()}
              </div>
            )}

            {/* Waiting fallback for legacy state */}
            {activeMatch.status !== 'PENDING' && playingState === 'waiting' && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 40, height: 40, border: '4px solid rgba(99,102,241,0.15)', borderTop: '4px solid #6366f1',
                  borderRadius: '50%', animation: 'spin 1s infinite linear'
                }} />
                <style>{`
                  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                `}</style>
                <div style={{ fontWeight: 800, color: '#fff', fontSize: '0.9rem' }}>
                  Loading simulation lobby...
                </div>
              </div>
            )}

            {/* Play simulator */}
            {playingState === 'play' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                
                {/* Scoreboard display */}
                <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#090b14', padding: '1rem', borderRadius: 12 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{activeMatch.p1Name || 'You'}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#6366f1', marginTop: '0.25rem' }}>{simulatedScoreP1}</div>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 900, color: '#475569' }}>VS</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{activeMatch.p2Name || 'Opponent'}</div>
                    <div style={{ fontSize: '2rem', fontWeight: 900, color: '#f87171', marginTop: '0.25rem' }}>{simulatedScoreP2}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.78rem', background: '#1e293b', color: '#818cf8', padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 900 }}>
                    {simulatedTurn}
                  </span>
                  
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                    Match Timer: <strong>{timerCount}s</strong>
                  </span>
                </div>

                <div style={{ height: 6, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: `${(timerCount / 15) * 100}%`, height: '100%', background: '#6366f1', transition: 'width 1s linear' }} />
                </div>
              </div>
            )}

            {/* Finished actions */}
            {playingState === 'finished' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                <CheckCircle size={44} color="#10b981" style={{ alignSelf: 'center' }} />
                
                <div>
                  <h4 style={{ fontSize: '1.05rem', color: '#fff', fontWeight: 900, margin: 0 }}>
                    Match Complete!
                  </h4>
                  <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Submit simulated game results to brackets:
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    className="btn btn-primary"
                    onClick={() => handleResolveMatch('win')}
                    style={{ flex: 1, fontWeight: 800, background: 'linear-gradient(135deg, #10b981, #059669)' }}
                  >
                    🎲 Submit Win
                  </button>
                  
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleResolveMatch('lose')}
                    style={{ flex: 1, fontWeight: 800 }}
                  >
                    Submit Defeat
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ================= SPECTATOR MODE OVERLAY ================= */}
      {spectatingMatch && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 8, 16, 0.95)', backdropFilter: 'blur(8px)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <Card style={{
            width: '100%', maxWidth: 420, background: '#0e111e', border: '1px solid #fbbf24',
            boxShadow: '0 25px 60px rgba(251, 191, 36, 0.15)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                👁️ Spectator Mode: Live Stream
              </h3>
              <button onClick={() => setSpectatingMatch(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: '#090b14', padding: '1rem', borderRadius: 12 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{spectatingMatch.p1Name || 'P1'}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#6366f1', marginTop: '0.25rem' }}>{spectatorScores.p1}</div>
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#475569' }}>VS</div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#fff' }}>{spectatingMatch.p2Name || 'P2'}</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 900, color: '#f87171', marginTop: '0.25rem' }}>{spectatorScores.p2}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
              <span style={{ background: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: 6, fontWeight: 900 }}>
                🎮 Turn: {spectatorTurn}
              </span>
              
              <span style={{ color: '#94a3b8' }}>
                Conclusion In: <strong>{spectatorTimer}s</strong>
              </span>
            </div>

            <div style={{ height: 6, background: '#1e293b', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{ width: `${(spectatorTimer / 30) * 100}%`, height: '100%', background: '#fbbf24', transition: 'width 1s linear' }} />
            </div>
          </Card>
        </div>
      )}

      {/* ================= PREMIUM CHAMPION CELEBRATION MODAL ================= */}
      {championCardOpen && championDetails && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(3, 5, 12, 0.96)', backdropFilter: 'blur(12px)', zIndex: 999999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto'
        }}>
          <style>{`
            @keyframes pulseGlow {
              0%, 100% { filter: drop-shadow(0 0 15px rgba(251, 191, 36, 0.5)); }
              50% { filter: drop-shadow(0 0 35px rgba(251, 191, 36, 0.85)); }
            }
            @keyframes trophyBounce {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-15px) scale(1.03); }
            }
          `}</style>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', width: '100%', maxWidth: 460 }}>
            {/* Celebration Card Frame */}
            <div 
              id="champion-card-capture"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #0f1123 0%, #05060c 100%)',
                borderRadius: 28,
                border: '3px solid #fbbf24',
                padding: '2.5rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 0 60px rgba(251, 191, 36, 0.25)',
                position: 'relative',
                overflow: 'hidden',
                gap: '1.5rem'
              }}
            >
              {/* Radial gradient background mesh */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.12) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              {/* Header Title */}
              <div>
                <div style={{
                  fontSize: '0.78rem', color: '#fbbf24', fontWeight: 900, letterSpacing: '0.25em',
                  textTransform: 'uppercase', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center'
                }}>
                  <Award color="#fbbf24" size={16} /> GameHub Arena Champion
                </div>
                <h1 style={{
                  fontSize: '1.75rem', fontWeight: 950, margin: 0,
                  background: 'linear-gradient(to right, #ffffff, #fbbf24, #f59e0b)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  textShadow: '0 4px 12px rgba(251, 191, 36, 0.15)'
                }}>
                  CONGRATULATIONS!
                </h1>
              </div>

              {/* Trophy Block with Bounce Animation */}
              <div style={{
                position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'trophyBounce 3s ease-in-out infinite'
              }}>
                {/* Glowing halo behind trophy */}
                <div style={{
                  position: 'absolute', width: 90, height: 90, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 70%)',
                  animation: 'pulseGlow 2s ease-in-out infinite'
                }} />
                <Trophy color="#fbbf24" size={96} style={{ filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.3))' }} />
              </div>

              {/* Champion Username */}
              <div>
                <h2 style={{
                  fontSize: '2rem', fontWeight: 950, color: '#fff', margin: 0, letterSpacing: '-0.02em',
                  background: 'linear-gradient(to bottom, #ffffff, #e2e8f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                }}>
                  {championDetails.winner}
                </h2>
                <span style={{
                  display: 'inline-block', fontSize: '0.75rem', background: 'rgba(251, 191, 36, 0.15)',
                  color: '#fbbf24', padding: '0.3rem 0.8rem', borderRadius: 99, fontWeight: 900,
                  marginTop: '0.5rem', border: '1px solid rgba(251,191,36,0.25)', letterSpacing: '0.05em'
                }}>
                  🏆 RANK #1 CHAMPION
                </span>
              </div>

              {/* Tournament Meta Info */}
              <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: 16, padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 800 }}>Tournament</span>
                  <span style={{ color: '#fff', fontWeight: 900 }}>{championDetails.tournament}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 800 }}>Game Mode</span>
                  <span style={{ color: '#3b82f6', fontWeight: 900, textTransform: 'uppercase' }}>🎮 {championDetails.game.replace('-', ' ')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 800 }}>Date Cleared</span>
                  <span style={{ color: '#94a3b8', fontWeight: 800 }}>{championDetails.date}</span>
                </div>
              </div>

              {/* Reward stats display */}
              <div style={{ width: '100%' }}>
                {selectedTournament?.isOfficial ? (
                  <div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                      Rewards Earned
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                      <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)', border: '1px solid rgba(251, 191, 36, 0.2)', borderRadius: 14, padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#fbbf24' }}>
                          +{selectedTournament.rewardCoins}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.15rem' }}>COINS</div>
                      </div>
                      <div style={{ flex: 1, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: 14, padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#818cf8' }}>
                          +500
                        </div>
                        <div style={{ fontSize: '0.65rem', color: '#6366f1', fontWeight: 800, marginTop: '0.15rem' }}>XP PROGRESSION</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px dashed rgba(239, 68, 68, 0.2)', borderRadius: 12, padding: '0.75rem', fontSize: '0.75rem', color: '#f87171', fontWeight: 800 }}>
                    🛡️ Community Tournament: Zero Progression Mode (Earned bragging rights!)
                  </div>
                )}
              </div>
            </div>

            {/* Actions Panel */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const text = `🏆 I just won the Champion title in the "${championDetails.tournament}" Tournament playing ${championDetails.game}! Play now on GameHub!`
                  navigator.clipboard.writeText(text)
                  addToast('success', 'Shared Card! 📤', 'Champion Card text shared to clipboard. Ready to post!')
                }}
                style={{ flex: 1, background: 'linear-gradient(135deg, #fbbf24, #d97706)', border: 'none', color: '#000', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', height: 44, borderRadius: 12 }}
              >
                <Share2 size={16} /> Share to Story
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => {
                  setChampionCardOpen(false)
                  setPlayPanelOpen(false)
                  setActiveMatch(null)
                }}
                style={{ flex: 1, fontWeight: 950, color: '#fff', border: '1px solid #1e293b', background: '#0e111e', cursor: 'pointer', transition: 'all 0.2s', height: 44, borderRadius: 12 }}
              >
                Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TEAM CAPTAIN REGISTRATION MODAL ================= */}
      {teamFormOpen && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(5, 8, 16, 0.85)', backdropFilter: 'blur(8px)', zIndex: 99999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <Card style={{
            width: '100%', maxWidth: 400, background: '#0e111e', border: '1px solid #1e293b',
            boxShadow: '0 25px 60px rgba(0,0,0,0.5)', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 900, color: 'white' }}>
                🛡️ Team Captain Panel
              </h3>
              <button onClick={() => setTeamFormOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.3rem' }}>Create Team Name</label>
                <input 
                  className="input" type="text" placeholder="Enter Team Name" required
                  value={teamForm.name}
                  onChange={e => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => handleRegister(selectedTournament?.id || '', undefined, teamForm.name)}
                  disabled={actionLoading || !teamForm.name}
                  style={{ width: '100%', fontWeight: 800 }}
                >
                  {actionLoading ? 'Creating Team...' : 'Register Team'}
                </button>
              </div>

              <div style={{ height: 1, background: '#1e293b', margin: '0.5rem 0' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>Or Join Team using Invite Code</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    className="input" type="text" placeholder="Invite Code"
                    value={inviteCodeText}
                    onChange={e => setInviteCodeText(e.target.value)}
                  />
                  <button 
                    className="btn btn-secondary"
                    onClick={() => handleRegister(selectedTournament?.id || '', inviteCodeText)}
                    disabled={actionLoading || !inviteCodeText}
                    style={{ fontWeight: 800 }}
                  >
                    Join
                  </button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

    </PageWrapper>
  )
}
