'use client'

import React from 'react'
import CricketGame    from '@/components/games/CricketGame'
import TicTacToeGame  from '@/components/games/TicTacToeGame'
import IframeGame     from '@/components/games/IframeGame'
import ScribbleLobby  from '@/components/games/ScribbleLobby'
import MemoryMatchGame from '@/components/games/MemoryMatchGame'
import FighterJetGame from '@/components/games/FighterJetGame'
import Game2048 from '@/components/games/Game2048'
import RockPaperScissorsGame from '@/components/games/RockPaperScissorsGame'
import NumberGuessingGame from '@/components/games/NumberGuessingGame'
import ArrowPuzzleGame from '@/components/games/ArrowPuzzleGame'
import ColorSortGame from '@/components/games/ColorSortGame'
import UnblockTrafficGame from '@/components/games/UnblockTrafficGame'
import WaterConnectGame from '@/components/games/WaterConnectGame'
import DotsAndBoxesGame from '@/components/games/DotsAndBoxesGame'
import BlockBlastGame from '@/components/games/BlockBlastGame'
import NeonTetrisGame from '@/components/games/NeonTetrisGame'
import WordWizardGame from '@/components/games/WordWizardGame'
import CandyBlastGame from '@/components/games/CandyBlastGame'
import HangmanGame from '@/components/games/HangmanGame'
import FourInARowGame from '@/components/games/FourInARowGame'
import SnakeArenaGame from '@/components/games/SnakeArenaGame'
import WhosSpyLandingPage from '@/components/games/WhosSpyLandingPage'

import GameChromeWrapper from '@/components/games/GameChromeWrapper'
import type { GameInfo } from '@/lib/games'

interface Props {
  game: GameInfo
  username: string
  slug: string
}

export default function GamePageClient({ game, username, slug }: Props) {
  return (
    <div
      className="animate-fadeIn"
      style={{
        maxWidth: game.componentName === 'snakearena' ? '100%' : 900,
        margin: '0 auto',
        width: '100%',
        padding: game.componentName === 'snakearena' ? '0 0.5rem' : '0 1rem'
      }}
    >
      <GameChromeWrapper
        slug={slug}
        name={game.name}
        emoji={game.emoji}
        description={game.description}
        type={game.type}
      >
        {(isFullscreen) => (
          <>
            {/* Native & Internal Games */}
            {game.componentName === 'cricket'    && <CricketGame />}
            {game.componentName === 'scribble'   && <ScribbleLobby />}
            {game.componentName === 'ttt'        && <TicTacToeGame />}
            {game.componentName === 'memory'     && <MemoryMatchGame />}
            {game.componentName === 'fighter'    && <FighterJetGame />}
            {game.componentName === '2048'       && <Game2048 />}
            {game.componentName === 'rps'        && <RockPaperScissorsGame />}
            {game.componentName === 'numguess'   && <NumberGuessingGame />}
            {game.componentName === 'arrowpuzzle' && <ArrowPuzzleGame />}
            {game.componentName === 'colorsort'   && <ColorSortGame />}
            {game.componentName === 'unblocktraffic' && <UnblockTrafficGame />}
            {game.componentName === 'waterconnect' && <WaterConnectGame />}
            {game.componentName === 'dotsboxes' && <DotsAndBoxesGame />}
            {game.componentName === 'blockblast' && <BlockBlastGame />}
            {game.componentName === 'neontetris' && <NeonTetrisGame />}
            {game.componentName === 'wordwizard' && <WordWizardGame />}
            {game.componentName === 'candycrush' && <CandyBlastGame />}
            {game.componentName === 'hangman' && <HangmanGame />}
            {game.componentName === 'fourinarow' && <FourInARowGame />}
            {game.componentName === 'snakearena' && <SnakeArenaGame />}
            {game.componentName === 'spy'        && <WhosSpyLandingPage />}

            {/* Legacy Iframe Games */}
            {game.componentName === 'iframe'     && (
              <IframeGame
                src={game.iframeSrc!}
                title={game.name}
                slug={slug}
                username={username}
                isFullscreen={isFullscreen}
              />
            )}

            {/* Placeholder for games not yet implemented */}
            {!['cricket', 'scribble', 'ttt', 'memory', 'fighter', '2048', 'iframe', 'rps', 'numguess', 'arrowpuzzle', 'colorsort', 'unblocktraffic', 'waterconnect', 'dotsboxes', 'blockblast', 'neontetris', 'wordwizard', 'candycrush', 'hangman', 'fourinarow', 'snakearena', 'spy'].includes(game.componentName) && (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', width: '100%' }}>
                <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>{game.emoji}</div>
                <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Coming Soon</h2>
                <p style={{ color: 'hsl(220 10% 55%)' }}>{game.name} is being rebuilt. Check back soon!</p>
              </div>
            )}
          </>
        )}
      </GameChromeWrapper>
    </div>
  )
}
