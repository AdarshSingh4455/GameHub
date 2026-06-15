import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedProfile } from '@/lib/multiplayer'

export async function POST(request: Request) {
  try {
    const profile = await getAuthenticatedProfile(request)
    if (!profile) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { roomCode, move } = body
    console.log(`[API POST /move] roomCode=${roomCode} userId=${profile?.userId} move=${JSON.stringify(move)}`)

    if (!roomCode || !move) {
      return NextResponse.json({ error: 'roomCode and move are required' }, { status: 400 })
    }

    // Run the entire move process in a transaction to prevent race conditions
    // Execute sequentially to be fully compatible with PgBouncer transaction mode
    const result = await (async () => {
      const normalizedCode = roomCode.trim().toUpperCase()

      // 1. Fetch room with players
      const room = await prisma.multiplayerRoom.findUnique({
        where: { roomCode: normalizedCode },
        include: {
          players: true
        }
      })

      if (!room) {
        throw new Error('Room not found')
      }

      console.log(`[DB LOAD] roomCode=${normalizedCode} roomId=${room.id}`)

      // 2. Validate player belongs to room
      const isPlayer = room.players.some(p => p.userId === profile.userId)
      if (!isPlayer) {
        throw new Error('You are not a player in this room')
      }

      let attempts = 0
      const maxAttempts = 10
      let updatedSession = null

      while (attempts < maxAttempts) {
        attempts++

        // 3. Fetch latest session state
        const session = await prisma.multiplayerGameSession.findUnique({
          where: { roomId: room.id }
        })

        if (!session) {
          throw new Error('Game session not found')
        }

        if (session.status === 'FINISHED') {
          throw new Error('Game is already finished')
        }

        const playerIds = room.players.map(p => p.userId)
        const opponentUserId = playerIds.find(id => id !== profile.userId) || ''

        const currentGameState = JSON.parse(JSON.stringify(session.gameState))

        let updatedStatus = session.status
        let updatedWinnerId = session.winnerId
        let updatedTurn = session.currentTurn
        let finalGameState = currentGameState

        // 4. Evaluate game slug
        if (room.gameSlug === 'cricket') {
          // --- Hand Cricket ---
          const { type } = move

          if (type === 'toss') {
            const { choice } = move // 'BAT' or 'BOWL'
            console.log(`[TOSS FLOW] Choice received. roomId=${room.id} userId=${profile.userId} choice=${choice} roomCode=${roomCode}`)
            if (currentGameState.stage !== 'TOSS') {
              throw new Error('Game is not in TOSS stage')
            }
            if (currentGameState.tossWinnerId !== profile.userId) {
              throw new Error('Only the toss winner can choose')
            }
            if (choice !== 'BAT' && choice !== 'BOWL') {
              throw new Error('Invalid toss choice')
            }

            currentGameState.tossChoice = choice
            if (choice === 'BAT') {
              currentGameState.battingUserId = profile.userId
              currentGameState.bowlingUserId = opponentUserId
            } else {
              currentGameState.battingUserId = opponentUserId
              currentGameState.bowlingUserId = profile.userId
            }

            console.log(`[BAT/BOWL SELECTION] battingUserId=${currentGameState.battingUserId} bowlingUserId=${currentGameState.bowlingUserId}`)

            // Fetch profiles for names
            const profiles = await prisma.profile.findMany({
              where: { userId: { in: playerIds } }
            })
            const getUsername = (uid: string) => profiles.find(p => p.userId === uid)?.username || 'Player'

            currentGameState.stage = 'FIRST_INNINGS'
            currentGameState.commentary.unshift(
              `🏏 ${getUsername(currentGameState.battingUserId)} will BAT first. ${getUsername(currentGameState.bowlingUserId)} will BOWL.`
            )

            console.log(`[STAGE TRANSITION] Toss complete. Stage is now FIRST_INNINGS.`)

            updatedTurn = null
            finalGameState = currentGameState

          } else if (type === 'play') {
            const { number } = move
            const numValue = parseInt(number, 10)
            console.log(`[MOVE SUBMISSION] Received play move (attempt ${attempts}). userId=${profile.userId} number=${numValue} stage=${currentGameState.stage} roomCode=${roomCode}`)
            if (isNaN(numValue) || numValue < 1 || numValue > 6) {
              throw new Error('Move number must be between 1 and 6')
            }

            if (currentGameState.stage !== 'FIRST_INNINGS' && currentGameState.stage !== 'SECOND_INNINGS') {
              throw new Error('Game is not in active innings stage')
            }

            // Register player's move
            if (!currentGameState.moves) {
              currentGameState.moves = {}
            }

            if (currentGameState.moves[profile.userId] !== undefined && currentGameState.moves[profile.userId] !== null) {
              throw new Error('You have already submitted a move for this turn')
            }

            currentGameState.moves[profile.userId] = numValue

            const movesCount = Object.keys(currentGameState.moves).length
            console.log(`[MOVE SUBMISSION] Registered move. movesCount=${movesCount} moves=${JSON.stringify(currentGameState.moves)}`)

            // Fetch profiles for names
            const profiles = await prisma.profile.findMany({
              where: { userId: { in: playerIds } }
            })
            const getUsername = (uid: string) => profiles.find(p => p.userId === uid)?.username || 'Player'

            if (movesCount === 2) {
              // Process simultaneous moves
              const batMove = currentGameState.moves[currentGameState.battingUserId]
              const bowlMove = currentGameState.moves[currentGameState.bowlingUserId]
              const isOut = batMove === bowlMove

              currentGameState.balls += 1
              console.log(`[MOVE SUBMISSION] Processing ball. batMove=${batMove} (userId=${currentGameState.battingUserId}), bowlMove=${bowlMove} (userId=${currentGameState.bowlingUserId})`)

              if (isOut) {
                currentGameState.wickets += 1
                currentGameState.commentary.unshift(
                  `🔴 OUT! Both players chose ${batMove}. ${getUsername(currentGameState.battingUserId)} is out.`
                )
                console.log(`[WICKETS UPDATE] OUT! Total wickets is now: ${currentGameState.wickets}/${currentGameState.maxWickets}`)
              } else {
                currentGameState.runs += batMove
                currentGameState.commentary.unshift(
                  `🏏 Runs: ${batMove} (Bat: ${batMove}, Bowl: ${bowlMove}). Score: ${currentGameState.runs}/${currentGameState.wickets}.`
                )
                console.log(`[RUNS UPDATE] Runs: +${batMove}. Total score is now: ${currentGameState.runs}/${currentGameState.wickets}`)
              }

              console.log(`[OVERS UPDATE] Balls faced this innings: ${currentGameState.balls} (${Math.floor(currentGameState.balls / 6)}.${currentGameState.balls % 6} overs)`)

              // Save history
              if (!currentGameState.history) {
                currentGameState.history = []
              }
              currentGameState.history.unshift({
                innings: currentGameState.innings,
                ball: currentGameState.balls,
                batMove,
                bowlMove,
                runs: isOut ? 0 : batMove,
                isOut
              })

              // Clear moves
              currentGameState.moves = {}

              // Check Innings 1 Over
              if (currentGameState.stage === 'FIRST_INNINGS') {
                if (currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6) {
                  const target = currentGameState.runs + 1
                  currentGameState.stage = 'SECOND_INNINGS'
                  currentGameState.innings = 2
                  currentGameState.target = target
                  currentGameState.innings1Score = currentGameState.runs

                  console.log(`[INNINGS SWITCH] Innings 1 over! Score: ${currentGameState.innings1Score}/${currentGameState.wickets}. Target set: ${target}`)

                  // Swap roles
                  const temp = currentGameState.battingUserId
                  currentGameState.battingUserId = currentGameState.bowlingUserId
                  currentGameState.bowlingUserId = temp

                  // Reset runs, wickets, balls
                  currentGameState.runs = 0
                  currentGameState.wickets = 0
                  currentGameState.balls = 0

                  currentGameState.commentary.unshift(
                    `🔄 Innings over. ${getUsername(currentGameState.battingUserId)} needs ${target} runs to win.`
                  )
                }
              } else if (currentGameState.stage === 'SECOND_INNINGS') {
                // Check Innings 2 Over
                const target = currentGameState.target
                let isFinished = false
                let winnerId: string | null = null

                if (currentGameState.runs >= target) {
                  // Batting team chased target
                  isFinished = true
                  winnerId = currentGameState.battingUserId
                } else if (currentGameState.wickets >= currentGameState.maxWickets || currentGameState.balls >= currentGameState.maxOvers * 6) {
                  isFinished = true
                  if (currentGameState.runs === target - 1) {
                    // Tie / Draw
                    winnerId = null
                  } else {
                    winnerId = currentGameState.bowlingUserId
                  }
                }

                if (isFinished) {
                  currentGameState.stage = 'FINISHED'
                  currentGameState.innings2Score = currentGameState.runs
                  currentGameState.commentary.unshift(
                    winnerId
                      ? `🏆 Match Over! Winner: ${getUsername(winnerId)}.`
                      : `🤝 Match Over! It's a DRAW/TIE.`
                  )

                  console.log(`[WINNER CALCULATION] Match finished! WinnerId=${winnerId || 'DRAW'} (Host score=${currentGameState.innings1Score}, Joiner score=${currentGameState.runs})`)

                  updatedStatus = 'FINISHED'
                  updatedWinnerId = winnerId || 'DRAW'
                }
              }
            }

            finalGameState = currentGameState

          } else {
            throw new Error('Invalid cricket move type')
          }

        } else if (room.gameSlug === 'dots-boxes') {
          // --- Dots & Boxes ---
          const { lineId } = move
          if (!lineId) {
            throw new Error('lineId is required')
          }

          // Validate turn
          if (session.currentTurn !== profile.userId) {
            throw new Error("It's not your turn")
          }

          const horizontalLines = currentGameState.horizontalLines || []
          const verticalLines = currentGameState.verticalLines || []
          const completedBoxes = currentGameState.completedBoxes || []
          const playerScores = currentGameState.playerScores || {}

          // Validate line not already claimed
          if (horizontalLines.includes(lineId) || verticalLines.includes(lineId)) {
            throw new Error('Line already claimed')
          }

          // Add line
          const parts = lineId.split('-')
          const type = parts[0]
          const r = parseInt(parts[1], 10)
          const c = parseInt(parts[2], 10)

          if (type === 'h') {
            horizontalLines.push(lineId)
          } else if (type === 'v') {
            verticalLines.push(lineId)
          } else {
            throw new Error('Invalid line ID format')
          }

          currentGameState.horizontalLines = horizontalLines
          currentGameState.verticalLines = verticalLines
          if (!currentGameState.lineOwners) {
            currentGameState.lineOwners = {}
          }
          currentGameState.lineOwners[lineId] = profile.userId

          // Check box completions
          const dotsSize = currentGameState.dotsSize || 6
          const sizeBoxes = dotsSize - 1
          let boxesCompletedThisTurn = 0

          const checkAndClaim = (br: number, bc: number) => {
            if (br < 0 || br >= sizeBoxes || bc < 0 || bc >= sizeBoxes) return false

            // Check if already completed
            const isAlreadyCompleted = completedBoxes.some((b: any) => b.r === br && b.c === bc)
            if (isAlreadyCompleted) return false

            const top = `h-${br}-${bc}`
            const bottom = `h-${br + 1}-${bc}`
            const left = `v-${br}-${bc}`
            const right = `v-${br}-${bc + 1}`

            const isClaimed = (horizontalLines.includes(top) || verticalLines.includes(top)) &&
                              (horizontalLines.includes(bottom) || verticalLines.includes(bottom)) &&
                              (horizontalLines.includes(left) || verticalLines.includes(left)) &&
                              (horizontalLines.includes(right) || verticalLines.includes(right))

            if (isClaimed) {
              completedBoxes.push({ r: br, c: bc, owner: profile.userId })
              return true
            }
            return false
          }

          if (type === 'h') {
            if (checkAndClaim(r, c)) boxesCompletedThisTurn++
            if (checkAndClaim(r - 1, c)) boxesCompletedThisTurn++
          } else {
            if (checkAndClaim(r, c)) boxesCompletedThisTurn++
            if (checkAndClaim(r, c - 1)) boxesCompletedThisTurn++
          }

          currentGameState.completedBoxes = completedBoxes

          let nextTurn = session.currentTurn
          if (boxesCompletedThisTurn > 0) {
            playerScores[profile.userId] = (playerScores[profile.userId] || 0) + boxesCompletedThisTurn
            currentGameState.playerScores = playerScores
          } else {
            // Switch turn
            nextTurn = opponentUserId
          }

          currentGameState.currentTurn = nextTurn
          updatedTurn = nextTurn

          // Check if game finished (total lines for 6x6 dots is 60)
          const totalLines = dotsSize * (dotsSize - 1) * 2
          const currentLinesCount = horizontalLines.length + verticalLines.length

          if (currentLinesCount === totalLines) {
            // Finished!
            const p1Score = playerScores[profile.userId] || 0
            const p2Score = playerScores[opponentUserId] || 0
            let winnerId: string | null = null

            if (p1Score > p2Score) {
              winnerId = profile.userId
            } else if (p2Score > p1Score) {
              winnerId = opponentUserId
            } // if tie, winnerId remains null

            currentGameState.currentTurn = null
            updatedStatus = 'FINISHED'
            updatedTurn = null
            updatedWinnerId = winnerId || 'DRAW'
          }

          finalGameState = currentGameState
        } else {
          throw new Error('Unsupported game slug')
        }

        const now = new Date()
        // Perform optimistic update
        const updateResult = await prisma.multiplayerGameSession.updateMany({
          where: {
            id: session.id,
            updatedAt: session.updatedAt
          },
          data: {
            status: updatedStatus,
            winnerId: updatedWinnerId,
            currentTurn: updatedTurn,
            gameState: finalGameState,
            lastActivityAt: now,
            updatedAt: now
          }
        })

        if (updateResult.count === 1) {
          // Success! Fetch the updated session and return it
          updatedSession = await prisma.multiplayerGameSession.findUnique({
            where: { id: session.id }
          })
          return { session: updatedSession }
        }

        console.warn(`[MOVE SUBMISSION] Optimistic lock conflict (attempt ${attempts}) for roomId=${room.id}. Retrying...`)
        // Wait for a short, randomized delay before retrying
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100))
      }

      throw new Error('Failed to update game session due to concurrent modifications')
    })()

    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    console.error('[POST /api/multiplayer/game/move]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 })
  }
}
