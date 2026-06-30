'use client'
import { GamepadIcon, BotIcon, UsersIcon, TrophyIcon, FlagIcon } from '@/components/shared/Icons'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGameSession } from '@/lib/contexts/GameSessionContext'
import { useToast } from '@/lib/contexts/ToastContext'
import GameHUD from '@/components/layout/GameHUD'
import { incrementDailyChallengeProgress } from '@/lib/dailyChallenges'
import { io, Socket } from 'socket.io-client'

type GameMode = 'vs-ai' | 'local-pvp' | 'online'
type Difficulty = 'easy' | 'medium' | 'hard'
type BoardSize = '4x4' | '6x6' | '8x8'

interface GameState {
  size: number
  lines: string[]
  boxes: Record<string, string> // "r,c" -> player id/name
  turnId: string // player id/name
  scores: Record<string, number>
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'

export default function DotsAndBoxesGame() {
  const router = useRouter()
  const { user, submitGameResult } = useGameSession()
  const { addToast } = useToast()
  const toastCompat = (id: string, title: string, message: string) => {
    addToast(id as any, title, message)
  }

  // --- Setup Stage States ---
  const [inGame, setInGame] = useState(false)
  const [activeTab, setActiveTab] = useState<'offline' | 'online'>('offline')
  const [gameMode, setGameMode] = useState<GameMode>('vs-ai')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [boardSize, setBoardSize] = useState<BoardSize>('6x6')
  const [roomCode, setRoomCode] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [lobbyError, setLobbyError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isHost, setIsHost] = useState(false)

  // Ranked states
  const [isRanked, setIsRanked] = useState(false)
  const [opponentName, setOpponentName] = useState('ApexBot')
  const [myMmr, setMyMmr] = useState(1000)

  // URL query param parser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'ranked') {
        setIsRanked(true)
        setGameMode('vs-ai')
        const oppName = params.get('opponent') || 'ApexBot'
        setOpponentName(oppName)
        const mmrVal = parseInt(params.get('mmr') || '1000', 10)
        setMyMmr(mmrVal)

        // Scale difficulty based on MMR
        if (mmrVal < 1167) {
          setDifficulty('easy')
        } else if (mmrVal < 1834) {
          setDifficulty('medium')
        } else {
          setDifficulty('hard') // Dots and Boxes supports easy, medium, hard
        }

        // Auto start game
        setBoardSize('6x6')
        setDotsSize(6)
        setLines([])
        setLineOwners({})
        setBoxes({})
        setScores({ p1: 0, p2: 0 })
        setWinner(null)
        setCurrentTurn('P1')
        setInGame(true)
      }
    }
  }, [])

  // --- Active Game States ---
  const [dotsSize, setDotsSize] = useState(6) // 4, 6, or 8
  const [lines, setLines] = useState<string[]>([]) // list of drawn lines e.g. "h-0-0", "v-1-2"
  const [lineOwners, setLineOwners] = useState<Record<string, string>>({}) // maps lineId -> 'P1' | 'P2' | 'AI'
  const [boxes, setBoxes] = useState<Record<string, string>>({}) // "r,c" -> "P1" | "P2"
  const [currentTurn, setCurrentTurn] = useState<'P1' | 'P2' | 'AI'>('P1')
  const [scores, setScores] = useState({ p1: 0, p2: 0 })
  const [winner, setWinner] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [maxChainLength, setMaxChainLength] = useState(0)

  // --- Socket Refs ---
  const socketRef = useRef<any>(null)
  const roomCodeRef = useRef('')
  const myPlayerIdRef = useRef('')
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null)
  const aiScheduledRef = useRef(false)

  const username = user?.user_metadata?.username || user?.email?.split('@')[0] || 'Guest'

  // --- Setup Board Size ---
  const getDotsCount = (size: BoardSize) => {
    if (size === '4x4') return 4
    if (size === '8x8') return 8
    return 6
  }

  // --- Socket.IO Room Setup ---
  const createOnlineRoom = () => {
    router.push('/dashboard/multiplayer?action=create&game=dots-boxes')
  }

  const joinOnlineRoom = () => {
    if (!joinCode.trim()) {
      setLobbyError('Please enter a room code.')
      return
    }
    router.push(`/dashboard/multiplayer?action=join&game=dots-boxes&code=${joinCode.trim().toUpperCase()}`)
  }

  const startOnlineGame = () => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('dotsboxes:start', {
        roomCode: roomCodeRef.current,
        size: dotsSize
      })
    }
  }

  const setupSocketListeners = (socket: Socket) => {
    socket.on('dotsboxes:started', (state: GameState) => {
      setDotsSize(state.size)
      setLines([])
      setLineOwners({})
      setBoxes({})
      setScores({ p1: 0, p2: 0 })
      setWinner(null)
      setCurrentTurn(state.turnId === myPlayerIdRef.current ? 'P1' : 'P2')
      setInGame(true)
    })

    socket.on('dotsboxes:updated', (data: { state: GameState, lastMove: any, gameFinished: boolean, players: any[] }) => {
      const state = data.state
      setLines(state.lines)

      if (data.lastMove) {
        const { playerId, lineId } = data.lastMove
        const owner = playerId === myPlayerIdRef.current ? 'P1' : 'P2'
        setLineOwners(prev => ({ ...prev, [lineId]: owner }))
      }

      // Map server socket.id owners to P1 / P2
      const mappedBoxes: Record<string, string> = {}
      Object.entries(state.boxes).forEach(([key, ownerId]) => {
        mappedBoxes[key] = ownerId === myPlayerIdRef.current ? 'P1' : 'P2'
      })
      setBoxes(mappedBoxes)

      // Map scores
      const p1Id = myPlayerIdRef.current
      const p2Id = data.players.find(p => p.id !== p1Id)?.id || ''
      
      const p1Score = state.scores[p1Id] || 0
      const p2Score = state.scores[p2Id] || 0
      setScores({ p1: p1Score, p2: p2Score })

      // Turn mapping
      setCurrentTurn(state.turnId === p1Id ? 'P1' : 'P2')

      if (data.gameFinished) {
        let finalWinner = 'draw'
        if (p1Score > p2Score) {
          finalWinner = 'Player 1'
        } else if (p2Score > p1Score) {
          finalWinner = 'Player 2'
        }
        setWinner(finalWinner)
        triggerGameOver(p1Score, p2Score, finalWinner, 'online')
      }
    })

    socket.on('player-left', () => {
      addToast('info', 'Opponent Disconnected 🔌', 'Your multiplayer match has ended.')
      handleQuit()
    })
  }

  // --- Start Offline Matches ---
  const startOfflineGame = (mode: GameMode) => {
    setGameMode(mode)
    const size = getDotsCount(boardSize)
    setDotsSize(size)
    setLines([])
    setLineOwners({})
    setBoxes({})
    setScores({ p1: 0, p2: 0 })
    setWinner(null)
    setCurrentTurn('P1')
    setInGame(true)
  }

  // --- Turn Move Logic ---
  const handleLineClick = (lineId: string) => {
    if (winner || isThinking) return
    if (lines.includes(lineId)) return

    if (gameMode === 'online') {
      if (currentTurn !== 'P1') return // Not my turn
      if (socketRef.current) {
        socketRef.current.emit('dotsboxes:draw-line', {
          roomCode: roomCodeRef.current,
          lineId
        })
      }
      return
    }

    // Offline turn submission
    processLineDraw(lineId)
  }

  const makeFallbackAIMove = (currentLines: string[]) => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }

    const allLines: string[] = []
    for (let r = 0; r < dotsSize; r++) {
      for (let c = 0; c < dotsSize - 1; c++) {
        const line = `h-${r}-${c}`
        if (!currentLines.includes(line)) allLines.push(line)
      }
    }
    for (let r = 0; r < dotsSize - 1; r++) {
      for (let c = 0; c < dotsSize; c++) {
        const line = `v-${r}-${c}`
        if (!currentLines.includes(line)) allLines.push(line)
      }
    }

    aiScheduledRef.current = false
    setIsThinking(false)
    if (allLines.length > 0) {
      const selectedLine = allLines[Math.floor(Math.random() * allLines.length)]
      processLineDraw(selectedLine)
    }
  }

  const processLineDraw = (lineId: string) => {
    // Check if line is already drawn (from current state in this render frame)
    if (lines.includes(lineId)) return;

    // Local snapshot of lines and other states for computation
    const nextLines = [...lines, lineId]
    
    // Check box completions
    let boxesCompletedCount = 0
    const nextBoxes = { ...boxes }
    const sizeBoxes = dotsSize - 1

    const checkAndClaim = (br: number, bc: number) => {
      if (br < 0 || br >= sizeBoxes || bc < 0 || bc >= sizeBoxes) return false
      const key = `${br},${bc}`
      if (nextBoxes[key]) return false

      const top = `h-${br}-${bc}`
      const bottom = `h-${br + 1}-${bc}`
      const left = `v-${br}-${bc}`
      const right = `v-${br}-${bc + 1}`

      const isClaimed = nextLines.includes(top) &&
                        nextLines.includes(bottom) &&
                        nextLines.includes(left) &&
                        nextLines.includes(right)

      if (isClaimed) {
        nextBoxes[key] = currentTurn === 'P1' ? 'P1' : 'P2'
        return true
      }
      return false
    }

    const parts = lineId.split('-')
    const type = parts[0]
    const r = parseInt(parts[1], 10)
    const c = parseInt(parts[2], 10)

    if (type === 'h') {
      if (checkAndClaim(r, c)) boxesCompletedCount++
      if (checkAndClaim(r - 1, c)) boxesCompletedCount++
    } else {
      if (checkAndClaim(r, c)) boxesCompletedCount++
      if (checkAndClaim(r, c - 1)) boxesCompletedCount++
    }

    const nextScores = { ...scores }
    let nextTurn = currentTurn

    if (boxesCompletedCount > 0) {
      if (currentTurn === 'P1') {
        nextScores.p1 += boxesCompletedCount
      } else {
        nextScores.p2 += boxesCompletedCount
      }
    } else {
      if (gameMode === 'vs-ai') {
        nextTurn = currentTurn === 'P1' ? 'AI' : 'P1'
      } else {
        nextTurn = currentTurn === 'P1' ? 'P2' : 'P1'
      }
    }

    // Update lines using functional state update
    setLines(prev => {
      if (prev.includes(lineId)) return prev;
      return [...prev, lineId];
    });

    // Update lineOwners using functional state update
    setLineOwners(prev => ({ ...prev, [lineId]: currentTurn }));

    // Update boxes using functional state update
    setBoxes(prev => ({ ...prev, ...nextBoxes }));

    // Update scores using functional state update
    setScores(prev => ({ ...prev, ...nextScores }));

    // Update currentTurn using functional state update
    setCurrentTurn(() => nextTurn);

    if (currentTurn === 'P1' && boxesCompletedCount > maxChainLength) {
      setMaxChainLength(boxesCompletedCount)
    }

    // Check game completed
    const totalLines = dotsSize * (dotsSize - 1) * 2
    if (nextLines.length === totalLines) {
      let finalWinner = 'draw'
      if (nextScores.p1 > nextScores.p2) {
        finalWinner = 'Player 1'
      } else if (nextScores.p2 > nextScores.p1) {
        finalWinner = 'Player 2'
      }
      setWinner(finalWinner)
      triggerGameOver(nextScores.p1, nextScores.p2, finalWinner, gameMode)
    } else if (nextTurn === 'AI') {
      setIsThinking(true)
    }
  }

  // --- Strategic AI ---
  const makeAIMove = (currentLines: string[]) => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current)
      safetyTimerRef.current = null
    }

    const size = dotsSize
    const sizeBoxes = size - 1

    // 1. Gather all remaining undrawn lines
    const allLines: string[] = []
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size - 1; c++) {
        const line = `h-${r}-${c}`
        if (!currentLines.includes(line)) allLines.push(line)
      }
    }
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size; c++) {
        const line = `v-${r}-${c}`
        if (!currentLines.includes(line)) allLines.push(line)
      }
    }

    if (allLines.length === 0) {
      aiScheduledRef.current = false
      setIsThinking(false)
      return
    }

    let selectedLine = ''
    try {
      // Helper: count how many sides of box (br, bc) are filled
      const countBoxSides = (br: number, bc: number, linesList: string[]) => {
        const top = `h-${br}-${bc}`
        const bottom = `h-${br + 1}-${bc}`
        const left = `v-${br}-${bc}`
        const right = `v-${br}-${bc + 1}`
        
        let count = 0
        if (linesList.includes(top)) count++
        if (linesList.includes(bottom)) count++
        if (linesList.includes(left)) count++
        if (linesList.includes(right)) count++
        return count
      }

      // Helper: find boxes affected by line
      const getBoxesAffected = (line: string) => {
        const pts = line.split('-')
        const type = pts[0]
        const r = parseInt(pts[1], 10)
        const c = parseInt(pts[2], 10)
        const list: [number, number][] = []
        if (type === 'h') {
          if (r >= 0 && r < sizeBoxes && c >= 0 && c < sizeBoxes) list.push([r, c])
          if (r - 1 >= 0 && r - 1 < sizeBoxes && c >= 0 && c < sizeBoxes) list.push([r - 1, c])
        } else {
          if (r >= 0 && r < sizeBoxes && c >= 0 && c < sizeBoxes) list.push([r, c])
          if (r >= 0 && r < sizeBoxes && c - 1 >= 0 && c - 1 < sizeBoxes) list.push([r, c - 1])
        }
        return list
      }

      if (difficulty === 'easy') {
        // Easy AI: purely random lines
        selectedLine = allLines[Math.floor(Math.random() * allLines.length)]
      } else {
        // Priority 1: Take any box completion (where box has 3 sides filled)
        const scoringLines = allLines.filter(line => {
          const affected = getBoxesAffected(line)
          return affected.some(([br, bc]) => countBoxSides(br, bc, currentLines) === 3)
        })

        if (scoringLines.length > 0) {
          selectedLine = scoringLines[Math.floor(Math.random() * scoringLines.length)]
        } else if (difficulty === 'medium') {
          // Medium AI: prioritizes random but tries to avoid giving away immediate boxes
          const safeLines = allLines.filter(line => {
            const affected = getBoxesAffected(line)
            // Line is safe if it does NOT create a 3rd side (so count < 2)
            return affected.every(([br, bc]) => countBoxSides(br, bc, currentLines) < 2)
          })
          selectedLine = safeLines.length > 0
            ? safeLines[Math.floor(Math.random() * safeLines.length)]
            : allLines[Math.floor(Math.random() * allLines.length)]
        } else {
          // Hard AI: Strategic Chain minimization
          // Filter safe lines (where drawing does not create a 3rd side)
          const safeLines = allLines.filter(line => {
            const affected = getBoxesAffected(line)
            return affected.every(([br, bc]) => countBoxSides(br, bc, currentLines) < 2)
          })

          if (safeLines.length > 0) {
            selectedLine = safeLines[Math.floor(Math.random() * safeLines.length)]
          } else {
            // If we MUST give away a box (no safe moves), select the line that gives away the smallest chain
            let minChainScore = Infinity
            let bestUnsafe = allLines[0]

            allLines.forEach(line => {
              const affected = getBoxesAffected(line)
              let score = 0
              affected.forEach(([br, bc]) => {
                score += countBoxSides(br, bc, currentLines)
              })
              if (score < minChainScore) {
                minChainScore = score
                bestUnsafe = line
              }
            })
            selectedLine = bestUnsafe
          }
        }
      }
    } catch (err) {
      console.error("AI strategic selection failed:", err)
      selectedLine = allLines[Math.floor(Math.random() * allLines.length)]
    } finally {
      aiScheduledRef.current = false
      setIsThinking(false)
      if (selectedLine) {
        processLineDraw(selectedLine)
      } else if (allLines.length > 0) {
        processLineDraw(allLines[Math.floor(Math.random() * allLines.length)])
      }
    }
  }

  // --- Game Over Submit ---
  const triggerGameOver = (p1Score: number, p2Score: number, finalWinner: string, mode: GameMode) => {
    let resultPayload: 'win' | 'loss' | 'draw'
    if (finalWinner === 'draw') {
      resultPayload = 'draw'
    } else if (mode === 'vs-ai') {
      resultPayload = finalWinner === 'Player 1' ? 'win' : 'loss'
    } else {
      resultPayload = finalWinner === 'Player 1' ? 'win' : 'loss' // local PvP host is P1
    }

    // Increment Daily Challenges
    if (resultPayload === 'win') {
      incrementDailyChallengeProgress('db_win_1', 1, user, toastCompat)
    }
    incrementDailyChallengeProgress('db_play_3', 1, user, toastCompat)
    if (mode === 'vs-ai' && difficulty === 'hard' && resultPayload === 'win') {
      incrementDailyChallengeProgress('db_beat_hard', 1, user, toastCompat)
    }
    if (mode === 'online' && resultPayload === 'win') {
      incrementDailyChallengeProgress('db_win_online', 1, user, toastCompat)
    }

    // Guest achievement local sync
    if (!user) {
      const unlocked = JSON.parse(localStorage.getItem('gamehub_guest_achievements') || '[]') as string[]
      const newlyUnlocked: string[] = []

      if (resultPayload === 'win' && !unlocked.includes('db-first-victory')) {
        newlyUnlocked.push('db-first-victory')
        unlocked.push('db-first-victory')
      }
      if (maxChainLength >= 5 && !unlocked.includes('db-chain-master')) {
        newlyUnlocked.push('db-chain-master')
        unlocked.push('db-chain-master')
      }
      if (mode === 'online' && resultPayload === 'win' && !unlocked.includes('db-online-champion')) {
        newlyUnlocked.push('db-online-champion')
        unlocked.push('db-online-champion')
      }

      if (newlyUnlocked.length > 0) {
        localStorage.setItem('gamehub_guest_achievements', JSON.stringify(unlocked))
        newlyUnlocked.forEach(slug => {
          const name = slug === 'db-first-victory' ? 'First Victory' : slug === 'db-chain-master' ? 'Chain Master' : 'Online Champion'
          const xp = slug === 'db-first-victory' ? 100 : slug === 'db-chain-master' ? 150 : 250
          addToast('achievement_unlocked', 'Achievement Unlocked! 🏆', `${name} (+${xp} XP)`)
        })
      }
    }

    submitGameResult({
      gameSlug: 'dots-boxes',
      result: resultPayload,
      metadata: {
        score: p1Score * 100,
        opponentScore: p2Score * 100,
        gameMetadata: {
          mode,
          difficulty: mode === 'vs-ai' ? difficulty : undefined,
          p1Boxes: p1Score,
          p2Boxes: p2Score,
          maxChainLength,
          winner: finalWinner
        }
      }
    })

    if (isRanked) {
      fetch('/api/ranked/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: resultPayload,
          opponentName: opponentName,
          gameSlug: 'dots-and-boxes'
        })
      })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data.revealRank) {
            localStorage.setItem('gamehub_rank_reveal', 'pending')
          }
          if (data.promoted) {
            localStorage.setItem('gamehub_promotion_celebration', JSON.stringify({ oldRank: data.oldRank, newRank: data.newRank }))
          }
        }
      })
      .catch(err => console.error('Failed to submit ranked stats:', err))
    }
  }

  // --- Reset/Quit ---
  const handleQuit = () => {
    if (socketRef.current) {
      socketRef.current.emit('leave-room', { roomCode: roomCodeRef.current })
      socketRef.current.disconnect()
      socketRef.current = null
    }
    setRoomCode('')
    setInGame(false)
  }

  useEffect(() => {
    const handleReplay = () => {
      if (gameMode === 'online') {
        startOnlineGame()
      } else {
        startOfflineGame(gameMode)
      }
    }
    window.addEventListener('gamehub_replay', handleReplay)
    return () => window.removeEventListener('gamehub_replay', handleReplay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, dotsSize])

  // --- AI Turn Side Effect ---
  useEffect(() => {
    // Only run side-effect if we are offline vs AI, it's AI's turn, and game is active
    if (!inGame || gameMode !== 'vs-ai' || currentTurn !== 'AI' || winner) {
      return
    }

    // Guard against duplicate scheduling
    if (aiScheduledRef.current) {
      return
    }

    aiScheduledRef.current = true
    setIsThinking(true)

    const delay = difficulty === 'easy' ? 500 : difficulty === 'medium' ? 700 : 1000

    const aiTimer = setTimeout(() => {
      // Clear safety watchdog timer
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
      makeAIMove(lines)
    }, delay)

    safetyTimerRef.current = setTimeout(() => {
      clearTimeout(aiTimer)
      makeFallbackAIMove(lines)
    }, delay + 2000)

    // Cleanup: clear timeouts on unmount or state dependency change
    return () => {
      clearTimeout(aiTimer)
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current)
        safetyTimerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn, inGame, gameMode, winner, difficulty, dotsSize, lines, boxes])

  // --- Rendering Setup Menu ---
  if (!inGame && !roomCode) {
    return (
      <div
        className="card glass animate-fadeIn"
        style={{
          padding: '2rem',
          textAlign: 'center',
          maxWidth: 390,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
        }}
        id="dotsboxes-setup-menu"
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}><GamepadIcon size={48} className="text-blue-400" /></div>
          <h2 style={{ fontWeight: 900, fontSize: '1.55rem', margin: 0, color: 'white', letterSpacing: '-0.02em' }}>Dots & Boxes</h2>
          <p style={{ color: 'hsl(220 10% 60%)', fontSize: '0.82rem', marginTop: '0.3rem', lineHeight: 1.4 }}>
            Take turns connecting adjacent dots. Complete boxes to score and claim points. Extra turns granted upon box completions!
          </p>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'flex',
            backgroundColor: 'hsl(222 20% 6%)',
            padding: '4px',
            borderRadius: 12,
            border: '1px solid hsl(220 15% 18%)',
          }}
        >
          <button
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'offline' ? 'hsl(220 100% 60%)' : 'transparent',
              color: activeTab === 'offline' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => {
              setActiveTab('offline')
              setLobbyError(null)
            }}
            id="db-offline-tab"
          >
            Offline
          </button>
          <button
            style={{
              flex: 1,
              padding: '0.5rem',
              borderRadius: 8,
              fontSize: '0.85rem',
              fontWeight: 700,
              backgroundColor: activeTab === 'online' ? 'hsl(220 100% 60%)' : 'transparent',
              color: activeTab === 'online' ? 'white' : 'hsl(220 10% 60%)',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onClick={() => setActiveTab('online')}
            id="db-online-tab"
          >
            Online Room
          </button>
        </div>

        {activeTab === 'offline' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Grid Sizing */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-start' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>BOARD SIZE</label>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                {(['4x4', '6x6', '8x8'] as BoardSize[]).map(sz => (
                  <button
                    key={sz}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: boardSize === sz ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                      backgroundColor: boardSize === sz ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                      color: boardSize === sz ? 'white' : 'hsl(220 10% 60%)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setBoardSize(sz)}
                    id={`db-size-${sz}`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Setup */}
            <div
              style={{
                background: 'hsl(222 20% 7% / 0.5)',
                border: '1px solid hsl(220 15% 18%)',
                padding: '1rem',
                borderRadius: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ textAlign: 'left', fontSize: '0.8rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>
                <BotIcon size={14} className="inline mr-1" /> CHALLENGE AI
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(['easy', 'medium', 'hard'] as Difficulty[]).map(diff => (
                  <button
                    key={diff}
                    style={{
                      flex: 1,
                      padding: '0.4rem',
                      borderRadius: 8,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: difficulty === diff ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                      backgroundColor: difficulty === diff ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                      color: difficulty === diff ? 'white' : 'hsl(220 10% 60%)',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                    onClick={() => setDifficulty(diff)}
                    id={`db-ai-${diff}`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => startOfflineGame('vs-ai')}
                style={{ width: '100%', borderRadius: 10 }}
                id="db-start-ai"
              >
                Play vs AI
              </button>
            </div>

            {/* Local PvP */}
            <button
              className="btn btn-secondary"
              onClick={() => startOfflineGame('local-pvp')}
              style={{ width: '100%', borderRadius: 12 }}
              id="db-start-local"
            >
              <UsersIcon size={14} className="inline mr-1" /> Local Match (2 Players)
            </button>
          </div>
        ) : (
          /* Online Multiplayer */
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              background: 'hsl(222 20% 7% / 0.5)',
              border: '1px solid hsl(220 15% 18%)',
              padding: '1.25rem',
              borderRadius: 16,
            }}
            id="db-lobby-sim"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', alignItems: 'flex-start' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: 'hsl(220 10% 70%)' }}>BOARD SIZE</label>
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', marginBottom: '0.5rem' }}>
                {(['4x4', '6x6', '8x8'] as BoardSize[]).map(sz => (
                  <button
                    key={sz}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: 8,
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      border: '1px solid',
                      borderColor: boardSize === sz ? 'hsl(220 100% 60%)' : 'hsl(220 15% 22%)',
                      backgroundColor: boardSize === sz ? 'hsl(220 100% 60% / 0.15)' : 'transparent',
                      color: boardSize === sz ? 'white' : 'hsl(220 10% 60%)',
                      cursor: 'pointer',
                    }}
                    onClick={() => setBoardSize(sz)}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'left' }}>
              <input
                type="text"
                placeholder="Enter Room Code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase())
                  setLobbyError(null)
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.8rem',
                  borderRadius: 8,
                  backgroundColor: 'hsl(222 20% 5%)',
                  border: '1px solid hsl(220 15% 22%)',
                  color: 'white',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
                id="db-join-input"
              />
            </div>

            {lobbyError && (
              <div
                style={{
                  fontSize: '0.72rem',
                  color: 'hsl(0 80% 60%)',
                  background: 'hsl(0 80% 50% / 0.1)',
                  padding: '0.5rem',
                  borderRadius: 8,
                  textAlign: 'left',
                }}
              >
                ⚠️ {lobbyError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={joinOnlineRoom}
                disabled={loading}
                id="db-join-btn"
              >
                {loading ? 'Joining...' : 'Join Room'}
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 8 }}
                onClick={createOnlineRoom}
                disabled={loading}
                id="db-create-btn"
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // --- Rendering Online Lobby Host Screen ---
  if (!inGame && roomCode) {
    return (
      <div
        className="card glass animate-slideUp"
        style={{ padding: '2rem', textAlign: 'center', maxWidth: 390, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
        id="db-online-lobby"
      >
        <div style={{ display: 'flex', justifyContent: 'center' }}><GamepadIcon size={36} className="text-blue-400" /></div>
        <h2 style={{ fontWeight: 700, fontSize: '1.25rem', margin: 0 }}>Dots & Boxes Room</h2>
        <p style={{ color: 'hsl(220 10% 55%)', fontSize: '0.82rem', lineHeight: 1.4 }}>
          {isHost ? 'Waiting for opponent to connect. Share code to start.' : 'Connected! Waiting for host to launch the match.'}
        </p>
        
        <div style={{ background: 'hsl(222 18% 16%)', border: '2px dashed hsl(220 100% 60% / 0.4)', borderRadius: 12, padding: '1rem 2rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'hsl(220 10% 50%)', marginBottom: '0.25rem' }}>Room Code</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.15em', color: 'hsl(220 100% 60%)' }}>{roomCode}</div>
        </div>

        {isHost && (
          <button
            className="btn btn-primary"
            onClick={startOnlineGame}
            style={{ width: '100%', borderRadius: 10 }}
            id="db-lobby-start-btn"
          >
            🚀 Launch Match
          </button>
        )}
        <button
          className="btn btn-secondary"
          onClick={handleQuit}
          style={{ width: '100%', borderRadius: 10 }}
        >
          Cancel Room
        </button>
      </div>
    )
  }

  // --- Rendering Board Screen ---
  // Determine active turn metadata
  const isPlayer1Active = currentTurn === 'P1'

  let turnIcon: React.ReactNode = null
  let turnText = 'Player 1 Turn'
  let turnColor = 'hsl(210 100% 55%)'
  let turnBg = 'hsl(210 100% 50% / 0.1)'
  let turnBorder = 'hsl(210 100% 50% / 0.3)'

  if (winner) {
    if (winner === 'draw') {
      turnIcon = <UsersIcon size={14} className="inline mr-1" />
      turnText = 'Tie Match!'
      turnColor = 'hsl(45 100% 55%)'
      turnBg = 'hsl(45 100% 50% / 0.1)'
      turnBorder = 'hsl(45 100% 50% / 0.3)'
    } else {
      const isP1Win = winner === 'Player 1'
      turnIcon = <TrophyIcon size={14} className="inline mr-1 text-yellow-400" />
      turnText = isP1Win ? 'Player 1 Wins!' : (gameMode === 'vs-ai' ? 'AI Wins!' : 'Player 2 Wins!')
      turnColor = isP1Win ? 'hsl(210 100% 55%)' : 'hsl(355 100% 55%)'
      turnBg = isP1Win ? 'hsl(210 100% 50% / 0.15)' : 'hsl(355 100% 50% / 0.15)'
      turnBorder = isP1Win ? 'hsl(210 100% 50% / 0.4)' : 'hsl(355 100% 50% / 0.4)'
    }
  } else if (isThinking) {
    turnIcon = <BotIcon size={14} className="inline mr-1 text-purple-400" />
    turnText = 'AI Turn'
    turnColor = 'hsl(355 100% 55%)'
    turnBg = 'hsl(355 100% 50% / 0.1)'
    turnBorder = 'hsl(355 100% 50% / 0.3)'
  } else if (gameMode === 'online') {
    if (isPlayer1Active) {
      turnIcon = <UsersIcon size={14} className="inline mr-1 text-blue-500" />
      turnText = 'Your Turn'
      turnColor = 'hsl(210 100% 55%)'
      turnBg = 'hsl(210 100% 50% / 0.1)'
      turnBorder = 'hsl(210 100% 50% / 0.3)'
    } else {
      turnIcon = <UsersIcon size={14} className="inline mr-1 text-red-500" />
      turnText = 'Opponent Turn'
      turnColor = 'hsl(355 100% 55%)'
      turnBg = 'hsl(355 100% 50% / 0.1)'
      turnBorder = 'hsl(355 100% 50% / 0.3)'
    }
  } else if (gameMode === 'vs-ai') {
    if (isPlayer1Active) {
      turnIcon = '🔵'
      turnText = 'Your Turn'
      turnColor = 'hsl(210 100% 55%)'
      turnBg = 'hsl(210 100% 50% / 0.1)'
      turnBorder = 'hsl(210 100% 50% / 0.3)'
    } else {
      turnIcon = '🔴'
      turnText = 'AI Turn'
      turnColor = 'hsl(355 100% 55%)'
      turnBg = 'hsl(355 100% 50% / 0.1)'
      turnBorder = 'hsl(355 100% 50% / 0.3)'
    }
  } else {
    // local PvP
    if (isPlayer1Active) {
      turnIcon = '🔵'
      turnText = 'Player 1 Turn'
      turnColor = 'hsl(210 100% 55%)'
      turnBg = 'hsl(210 100% 50% / 0.1)'
      turnBorder = 'hsl(210 100% 50% / 0.3)'
    } else {
      turnIcon = '🔴'
      turnText = 'Player 2 Turn'
      turnColor = 'hsl(355 100% 55%)'
      turnBg = 'hsl(355 100% 50% / 0.1)'
      turnBorder = 'hsl(355 100% 50% / 0.3)'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        maxWidth: 'min(100%, 75vh, 480px)',
        margin: '0 auto',
        width: '100%',
        position: 'relative'
      }}
      id="db-active-game"
    >
      {/* scoreboard HUD */}
      <GameHUD id="db-scoreboard-hud" style={{ justifyContent: 'space-around' }}>
        <div>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(210 100% 55%)' }}>{scores.p1}</div>
          <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
            {gameMode === 'online' ? 'You (P1)' : 'Player 1'}
          </div>
        </div>
        <div style={{ borderLeft: '1px solid hsl(220 15% 20%)', paddingLeft: '1.5rem' }}>
          <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'hsl(355 100% 55%)' }}>{scores.p2}</div>
          <div style={{ fontSize: '0.62rem', color: 'hsl(220 10% 50%)', fontWeight: 700 }}>
            {gameMode === 'vs-ai' ? 'AI' : gameMode === 'online' ? 'Opponent (P2)' : 'Player 2'}
          </div>
        </div>
      </GameHUD>

      {/* Persistent Turn Indicator Banner */}
      <div
        style={{
          textAlign: 'center',
          fontWeight: 900,
          fontSize: '1.1rem',
          color: turnColor,
          backgroundColor: turnBg,
          border: `1px solid ${turnBorder}`,
          padding: '0.65rem 1.25rem',
          borderRadius: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: `0 0 15px ${turnColor}22`,
          textShadow: `0 0 8px ${turnColor}44`,
          animation: !winner ? 'db-pulse-anim 2s infinite ease-in-out' : 'none',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
        id="db-turn-indicator"
      >
        <span>{turnIcon}</span>
        <span>{turnText}</span>
      </div>

      {/* Responsive Dots Board */}
      <div
        style={{
          background: 'hsl(222 20% 7%)',
          borderRadius: 18,
          border: '1px solid hsl(220 15% 18%)',
          aspectRatio: '1',
          width: '100%',
          position: 'relative',
          padding: '24px',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        {/* SVG lines and boxes claim overlay */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          {/* 1. Claimed boxes render */}
          {Array.from({ length: dotsSize - 1 }).map((_, r) =>
            Array.from({ length: dotsSize - 1 }).map((_, c) => {
              const key = `${r},${c}`
              const owner = boxes[key]
              if (!owner) return null

              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent

              return (
                <div
                  key={`box-${key}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    left: `${left}%`,
                    width: `${widthPercent}%`,
                    height: `${widthPercent}%`,
                    padding: '8px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      background: owner === 'P1'
                        ? 'linear-gradient(135deg, hsl(210 100% 50% / 0.25), hsl(210 100% 40% / 0.15))'
                        : 'linear-gradient(135deg, hsl(355 100% 55% / 0.25), hsl(355 100% 45% / 0.15))',
                      border: owner === 'P1'
                        ? '1px solid hsl(210 100% 50% / 0.4)'
                        : '1px solid hsl(355 100% 55% / 0.4)',
                      borderRadius: 6,
                      boxShadow: owner === 'P1'
                        ? '0 0 10px hsl(210 100% 50% / 0.15)'
                        : '0 0 10px hsl(355 100% 55% / 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 'clamp(0.6rem, 3vw, 0.95rem)',
                      fontWeight: 900,
                      color: owner === 'P1' ? 'hsl(210 100% 70%)' : 'hsl(355 100% 75%)',
                      animation: 'fadeIn 0.4s ease-out'
                    }}
                  >
                    {owner === 'P1' ? 'P1' : 'P2'}
                  </div>
                </div>
              )
            })
          )}

          {/* 2. Interactive SVG lines overlay */}
          {Array.from({ length: dotsSize }).map((_, r) =>
            Array.from({ length: dotsSize }).map((_, c) => {
              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent

              // Render horizontal line to the right of (r, c)
              const renderHorizontal = c < dotsSize - 1
              // Render vertical line below (r, c)
              const renderVertical = r < dotsSize - 1

              return (
                <React.Fragment key={`lines-${r}-${c}`}>
                  {renderHorizontal && (() => {
                    const lineId = `h-${r}-${c}`
                    const isClaimed = lines.includes(lineId)
                    const owner = lineOwners[lineId]

                    const hoverClass = currentTurn === 'P1' ? 'hover-h-p1' : 'hover-h-p2'

                    return (
                      <div
                        id={`db-line-${lineId}`}
                        onClick={() => handleLineClick(lineId)}
                        style={{
                          position: 'absolute',
                          top: `calc(${top}% - 6px)`,
                          left: `${left}%`,
                          width: `${widthPercent}%`,
                          height: 12,
                          cursor: isClaimed || isThinking || winner ? 'default' : 'pointer',
                          zIndex: 10,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        className="db-line-trigger"
                      >
                        <div
                          style={{
                            width: '100%',
                            height: isClaimed ? 6 : 3,
                            background: isClaimed
                              ? owner === 'P1'
                                ? 'hsl(210 100% 50%)'
                                : 'hsl(355 100% 55%)'
                              : 'hsl(220 15% 18%)',
                            boxShadow: isClaimed
                              ? owner === 'P1'
                                ? '0 0 10px hsl(210 100% 50%)'
                                : '0 0 10px hsl(355 100% 55%)'
                              : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: isClaimed ? 1 : 0.25,
                          }}
                          className={`db-line-inner ${!isClaimed && !winner && !isThinking ? hoverClass : ''}`}
                        />
                      </div>
                    )
                  })()}

                  {renderVertical && (() => {
                    const lineId = `v-${r}-${c}`
                    const isClaimed = lines.includes(lineId)
                    const owner = lineOwners[lineId]

                    const hoverClass = currentTurn === 'P1' ? 'hover-v-p1' : 'hover-v-p2'
                    
                    return (
                      <div
                        id={`db-line-${lineId}`}
                        onClick={() => handleLineClick(lineId)}
                        style={{
                          position: 'absolute',
                          top: `${top}%`,
                          left: `calc(${left}% - 6px)`,
                          width: 12,
                          height: `${widthPercent}%`,
                          cursor: isClaimed || isThinking || winner ? 'default' : 'pointer',
                          zIndex: 10,
                          display: 'flex',
                          justifyContent: 'center'
                        }}
                        className="db-line-trigger"
                      >
                        <div
                          style={{
                            height: '100%',
                            width: isClaimed ? 6 : 3,
                            background: isClaimed
                              ? owner === 'P1'
                                ? 'hsl(210 100% 50%)'
                                : 'hsl(355 100% 55%)'
                              : 'hsl(220 15% 18%)',
                            boxShadow: isClaimed
                              ? owner === 'P1'
                                ? '0 0 10px hsl(210 100% 50%)'
                                : '0 0 10px hsl(355 100% 55%)'
                              : 'none',
                            borderRadius: 3,
                            transition: 'all 0.2s ease-in-out',
                            opacity: isClaimed ? 1 : 0.25,
                          }}
                          className={`db-line-inner ${!isClaimed && !winner && !isThinking ? hoverClass : ''}`}
                        />
                      </div>
                    )
                  })()}
                </React.Fragment>
              )
            })
          )}

          {/* 3. Dot Nodes grid layer */}
          {Array.from({ length: dotsSize }).map((_, r) =>
            Array.from({ length: dotsSize }).map((_, c) => {
              const widthPercent = 100 / (dotsSize - 1)
              const top = r * widthPercent
              const left = c * widthPercent

              return (
                <div
                  key={`dot-${r}-${c}`}
                  style={{
                    position: 'absolute',
                    top: `calc(${top}% - 5px)`,
                    left: `calc(${left}% - 5px)`,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    zIndex: 20,
                    boxShadow: '0 0 8px white, inset 0 0 2px black',
                    pointerEvents: 'none'
                  }}
                />
              )
            })
          )}
        </div>
      </div>

      {/* Action controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
        <button
          className="btn btn-secondary"
          style={{ width: '100%', borderRadius: 12 }}
          onClick={handleQuit}
          id="db-quit-btn"
        >
          <FlagIcon size={14} className="inline mr-1" /> Back to Setup Menu
        </button>
      </div>

      {/* Global CSS Inject for Hover Line animations and pulse */}
      <style jsx global>{`
        .db-line-trigger:hover .hover-h-p1 {
          opacity: 0.85 !important;
          background-color: hsl(210 100% 50%) !important;
          box-shadow: 0 0 8px hsl(210 100% 50%) !important;
          height: 6px !important;
        }
        .db-line-trigger:hover .hover-h-p2 {
          opacity: 0.85 !important;
          background-color: hsl(355 100% 55%) !important;
          box-shadow: 0 0 8px hsl(355 100% 55%) !important;
          height: 6px !important;
        }
        .db-line-trigger:hover .hover-v-p1 {
          opacity: 0.85 !important;
          background-color: hsl(210 100% 50%) !important;
          box-shadow: 0 0 8px hsl(210 100% 50%) !important;
          width: 6px !important;
        }
        .db-line-trigger:hover .hover-v-p2 {
          opacity: 0.85 !important;
          background-color: hsl(355 100% 55%) !important;
          box-shadow: 0 0 8px hsl(355 100% 55%) !important;
          width: 6px !important;
        }
        @keyframes db-pulse-anim {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(1.02); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
