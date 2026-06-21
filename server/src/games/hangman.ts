import {
  getGameSessionFromCache,
  saveGameSessionToCache,
  deleteGameSessionFromCache,
  validateTurn,
  persistSnapshotAsync
} from './framework'
import { logger } from '../utils/logger'

interface Player {
  userId: string
  username: string
}

interface HangmanMove {
  type: 'SUBMIT_WORD' | 'GUESS_LETTER' | 'GUESS_WORD'
  word?: string // for SUBMIT_WORD and GUESS_WORD
  letter?: string // for GUESS_LETTER
}

export async function getHangmanSession(roomCode: string, roomId: string, prisma: any): Promise<any> {
  return getGameSessionFromCache('hangman', roomCode, roomId, prisma)
}

export async function saveHangmanSession(roomCode: string, state: any): Promise<void> {
  return saveGameSessionToCache('hangman', roomCode, state)
}

export async function deleteHangmanSession(roomCode: string): Promise<void> {
  return deleteGameSessionFromCache('hangman', roomCode)
}

/**
 * Masks the secret words for security so players cannot inspect/cheat.
 */
export function getMaskedHangmanState(state: any, targetUserId: string): any {
  if (!state) return null
  
  // Deep copy the state
  const masked = JSON.parse(JSON.stringify(state))
  
  const isP1 = targetUserId === state.p1Id
  const isP2 = targetUserId === state.p2Id

  if (state.stage === 'WORD_SUBMISSION') {
    // Hide the other player's word during submission stage
    if (isP1) {
      masked.p2Word = state.p2Word ? '*'.repeat(state.p2Word.length) : ''
    } else if (isP2) {
      masked.p1Word = state.p1Word ? '*'.repeat(state.p1Word.length) : ''
    } else {
      // Spectator or other (shouldn't happen as no spectators allowed, but cover it)
      masked.p1Word = state.p1Word ? '*'.repeat(state.p1Word.length) : ''
      masked.p2Word = state.p2Word ? '*'.repeat(state.p2Word.length) : ''
    }
  } else if (state.stage === 'PLAYING') {
    // P1 is guessing p2Word. P1 should only see masked p2Word.
    // P1 entered p1Word, so P1 is allowed to see p1Word.
    if (isP1) {
      masked.p2Word = state.p2Word
        ? state.p2Word.split('').map((c: string) => state.p1Guesses.includes(c) ? c : '_').join('')
        : ''
    }
    // P2 is guessing p1Word. P2 should only see masked p1Word.
    // P2 entered p2Word, so P2 is allowed to see p2Word.
    else if (isP2) {
      masked.p1Word = state.p1Word
        ? state.p1Word.split('').map((c: string) => state.p2Guesses.includes(c) ? c : '_').join('')
        : ''
    } else {
      // Spectator
      masked.p1Word = state.p1Word ? '*'.repeat(state.p1Word.length) : ''
      masked.p2Word = state.p2Word ? '*'.repeat(state.p2Word.length) : ''
    }
  }

  return masked
}

export async function processHangmanMove(
  roomCode: string,
  roomId: string,
  userId: string,
  move: HangmanMove,
  players: Player[],
  prisma: any
): Promise<{ state: any; snapshotPersisted: boolean; gameFinished: boolean; winnerId: string | null }> {
  
  const currentGameState = await getHangmanSession(roomCode, roomId, prisma)
  if (!currentGameState) {
    throw new Error('Game session not found')
  }

  const p1Id = currentGameState.p1Id
  const p2Id = currentGameState.p2Id
  const isP1 = userId === p1Id
  const opponentUserId = isP1 ? p2Id : p1Id

  let gameFinished = false
  let winnerId: string | null = null
  let updatedStatus = 'PLAYING'
  let snapshotPersisted = false
  let nextTurn: string | null = currentGameState.currentTurn

  // 1. Stage: WORD_SUBMISSION
  if (currentGameState.stage === 'WORD_SUBMISSION') {
    if (move.type !== 'SUBMIT_WORD') {
      throw new Error('Game is in word submission phase')
    }
    const cleanWord = (move.word || '').trim().toUpperCase()
    if (!cleanWord || cleanWord.length < 3 || !/^[A-Z]+$/.test(cleanWord)) {
      throw new Error('Invalid word. Must be alphabetic and at least 3 letters.')
    }

    if (isP1) {
      currentGameState.p1Word = cleanWord
    } else {
      currentGameState.p2Word = cleanWord
    }

    // Check if both words are submitted to start the match
    if (currentGameState.p1Word && currentGameState.p2Word) {
      currentGameState.stage = 'PLAYING'
      // Set initial turn expiration
      currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
    }

    // Persist and save
    persistSnapshotAsync(roomId, currentGameState, 'PLAYING', null, nextTurn, 'hangman', prisma)
    await saveHangmanSession(roomCode, currentGameState)
    snapshotPersisted = true

    return {
      state: currentGameState,
      snapshotPersisted,
      gameFinished: false,
      winnerId: null
    }
  }

  // 2. Stage: PLAYING
  if (currentGameState.stage === 'PLAYING') {
    // Authoritative turn check
    validateTurn(currentGameState, userId)

    if (move.type === 'GUESS_LETTER') {
      const letter = (move.letter || '').toUpperCase().trim()
      if (letter.length !== 1 || !/^[A-Z]$/.test(letter)) {
        throw new Error('Invalid letter guess')
      }

      // Check duplicate guess
      const guessedList = isP1 ? currentGameState.p1Guesses : currentGameState.p2Guesses
      if (guessedList.includes(letter)) {
        throw new Error('Letter already guessed')
      }

      // Record guess
      guessedList.push(letter)

      // Evaluate guess against target word
      const targetWord = isP1 ? currentGameState.p2Word : currentGameState.p1Word
      const isCorrect = targetWord.includes(letter)

      if (!isCorrect) {
        if (isP1) {
          currentGameState.p1Lives--
          currentGameState.p1IncorrectGuesses.push(letter)
        } else {
          currentGameState.p2Lives--
          currentGameState.p2IncorrectGuesses.push(letter)
        }
      }

      // Check win/loss conditions
      const solved = targetWord.split('').every((c: string) => guessedList.includes(c))
      const livesOut = isP1 ? currentGameState.p1Lives <= 0 : currentGameState.p2Lives <= 0

      if (solved) {
        gameFinished = true
        winnerId = userId
      } else if (livesOut) {
        // Active player ran out of lives -> Opponent wins
        gameFinished = true
        winnerId = opponentUserId
      } else {
        // Toggle turn
        nextTurn = opponentUserId
        currentGameState.currentTurn = nextTurn
        currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
      }
    } 
    else if (move.type === 'GUESS_WORD') {
      const guess = (move.word || '').toUpperCase().trim()
      if (!guess || !/^[A-Z]+$/.test(guess)) {
        throw new Error('Invalid full word guess')
      }

      let attemptsLeft = isP1 ? currentGameState.p1FullGuessesLeft : currentGameState.p2FullGuessesLeft
      if (attemptsLeft <= 0) {
        throw new Error('No full-word guesses remaining')
      }

      attemptsLeft--
      if (isP1) {
        currentGameState.p1FullGuessesLeft = attemptsLeft
      } else {
        currentGameState.p2FullGuessesLeft = attemptsLeft
      }

      const targetWord = isP1 ? currentGameState.p2Word : currentGameState.p1Word
      const isCorrect = guess === targetWord

      if (isCorrect) {
        gameFinished = true
        winnerId = userId
      } else {
        if (attemptsLeft <= 0) {
          // Second wrong guess -> Immediate defeat
          gameFinished = true
          winnerId = opponentUserId
        } else {
          // Switch turn
          nextTurn = opponentUserId
          currentGameState.currentTurn = nextTurn
          currentGameState.turnExpiration = new Date(Date.now() + 60000).toISOString()
        }
      }
    } else {
      throw new Error('Unsupported move type')
    }
  }

  // Handle Match Finish
  if (gameFinished && winnerId) {
    currentGameState.stage = 'FINISHED'
    currentGameState.winnerId = winnerId
    currentGameState.currentTurn = null
    currentGameState.turnExpiration = null
    updatedStatus = 'FINISHED'
    nextTurn = null

    // Final database persistence
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'hangman', prisma)
    await deleteHangmanSession(roomCode)
    snapshotPersisted = true
  }

  if (!snapshotPersisted) {
    persistSnapshotAsync(roomId, currentGameState, updatedStatus, winnerId, nextTurn, 'hangman', prisma)
    await saveHangmanSession(roomCode, currentGameState)
    snapshotPersisted = true
  }

  return {
    state: currentGameState,
    snapshotPersisted,
    gameFinished,
    winnerId
  }
}
