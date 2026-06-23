export type Team = 'player' | 'cpu';
export type TossChoice = 'bat' | 'bowl';
export type TossOutcome = 'heads' | 'tails';
export type MatchPhase = 'setup' | 'toss' | 'innings1' | 'innings2' | 'ended';

export interface BallRecord {
  ballNumber: number; // 1-indexed count in the current innings
  batsmanPick: number;
  bowlerPick: number;
  runs: number;
  isOut: boolean;
}

export interface InningsState {
  battingTeam: Team;
  bowlingTeam: Team;
  score: number;
  wicketsLost: number;
  ballsBowled: number;
  isCompleted: boolean;
  history: BallRecord[];
}

export interface MatchState {
  overs: number;
  wickets: number;
  phase: MatchPhase;
  tossWinner?: Team;
  tossChoice?: TossChoice;
  innings1?: InningsState;
  innings2?: InningsState;
  target?: number;
  winner?: Team | 'draw';
}

export class TossResolver {
  static resolveToss(playerCall: TossOutcome): { tossWinner: Team; outcome: TossOutcome } {
    const outcome: TossOutcome = Math.random() < 0.5 ? 'heads' : 'tails';
    const tossWinner: Team = playerCall === outcome ? 'player' : 'cpu';
    return { tossWinner, outcome };
  }

  static getCpuChoice(): TossChoice {
    return Math.random() < 0.5 ? 'bat' : 'bowl';
  }
}

export class InningsManager {
  static createInnings(battingTeam: Team, bowlingTeam: Team): InningsState {
    return {
      battingTeam,
      bowlingTeam,
      score: 0,
      wicketsLost: 0,
      ballsBowled: 0,
      isCompleted: false,
      history: [],
    };
  }

  static checkInningsCompleted(
    state: InningsState,
    maxOvers: number,
    maxWickets: number,
    target?: number
  ): boolean {
    // Check if all wickets are down
    if (state.wicketsLost >= maxWickets) {
      return true;
    }
    // Check if all overs completed
    if (state.ballsBowled >= maxOvers * 6) {
      return true;
    }
    // Check if target chased (only applicable for Innings 2)
    if (target !== undefined && state.score >= target) {
      return true;
    }
    return false;
  }
}

export class CricketEngine {
  static getCpuPick(state: MatchState | null, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): number {
    const defaultPick = () => Math.floor(Math.random() * 6) + 1;
    if (!state) return defaultPick();

    const currentInnings = state.phase === 'innings2' && state.innings2
      ? state.innings2
      : state.innings1;

    if (!currentInnings) return defaultPick();

    const isCpuBatting = currentInnings.battingTeam === 'cpu';
    const isCpuBowling = currentInnings.bowlingTeam === 'cpu';

    // Get player's picks in this current active innings
    const isPlayerBatting = currentInnings.battingTeam === 'player';
    const playerPicks = currentInnings.history.map(h => isPlayerBatting ? h.batsmanPick : h.bowlerPick);
    const lastPicks = playerPicks.slice(-5); // last 5 picks

    if (difficulty === 'easy') {
      return defaultPick();
    }

    // Anti-Abuse Logic: If player is batting (CPU bowling) and player is spamming 6:
    if (isCpuBowling && isPlayerBatting && lastPicks.length > 0) {
      const lastPick = lastPicks[lastPicks.length - 1];
      if (lastPick === 6) {
        // Count consecutive sixes
        let consecutiveSixes = 0;
        for (let i = lastPicks.length - 1; i >= 0; i--) {
          if (lastPicks[i] === 6) {
            consecutiveSixes++;
          } else {
            break;
          }
        }
        
        let outProb = 0.35; // default prediction chance for a single 6
        if (consecutiveSixes === 2) outProb = 0.70;
        if (consecutiveSixes >= 3) outProb = 0.95;
        
        if (Math.random() < outProb) {
          return 6; // CPU bowls 6 to catch player spamming 6
        }
      }
    }

    // Medium Difficulty: Pattern recognition of last 3 picks
    if (difficulty === 'medium') {
      const mediumLastPicks = playerPicks.slice(-3);
      if (mediumLastPicks.length >= 2) {
        const p1 = mediumLastPicks[mediumLastPicks.length - 1];
        const p2 = mediumLastPicks[mediumLastPicks.length - 2];
        if (p1 === p2) {
          // 40% chance CPU acts on this prediction
          if (Math.random() < 0.40) {
            if (isCpuBowling) {
              return p1; // Bowl same to match player
            } else {
              // Bat: choose anything other than p1 to avoid being matched
              let choice = defaultPick();
              while (choice === p1) {
                choice = defaultPick();
              }
              return choice;
            }
          }
        }
      }
      return defaultPick();
    }

    // Hard Difficulty: Pattern recognition + situational intelligence
    if (difficulty === 'hard') {
      // 1. Situational Intelligence (Innings 2 run chase analysis)
      if (state.phase === 'innings2' && state.target !== undefined) {
        const target = state.target;
        const currentScore = currentInnings.score;
        const runsNeeded = target - currentScore;
        const ballsRemaining = (state.overs * 6) - currentInnings.ballsBowled;
        const wicketsRemaining = state.wickets - currentInnings.wicketsLost;

        if (ballsRemaining > 0 && wicketsRemaining > 0) {
          const runRateRequired = runsNeeded / ballsRemaining;

          if (isCpuBatting) {
            // Case A: High required run rate, need big boundaries
            if (runsNeeded > 0 && runRateRequired > 4) {
              // Pick 5 or 6 aggressively
              if (Math.random() < 0.70) {
                return Math.random() < 0.5 ? 5 : 6;
              }
            }
            // Case B: Very easy target, play super safe
            else if (runsNeeded <= 3 && ballsRemaining >= 5) {
              const safePicks = [1, 2, 3];
              return safePicks[Math.floor(Math.random() * safePicks.length)];
            }
            // Case C: CPU is close to winning
            else if (runsNeeded === 1) {
              return Math.random() < 0.5 ? 2 : 3;
            }
          } else {
            // CPU Bowling (player is batting)
            // Case A: Player needs a high run rate (e.g. 12 off 2 balls)
            if (runsNeeded > 0 && runRateRequired > 4) {
              // Player must choose 5 or 6, bowl 5 or 6 to catch them out
              if (Math.random() < 0.75) {
                return Math.random() < 0.5 ? 5 : 6;
              }
            }
            // Case B: Player needs 1 or 2 runs to win, ample balls
            else if (runsNeeded <= 2 && ballsRemaining >= 3) {
              // Player will likely bat safe, bowl 1 or 2 to match
              if (Math.random() < 0.60) {
                return Math.random() < 0.5 ? 1 : 2;
              }
            }
          }
        }
      }

      // 2. Pattern Recognition (last 5 picks)
      if (lastPicks.length >= 2) {
        const p1 = lastPicks[lastPicks.length - 1];
        const p2 = lastPicks[lastPicks.length - 2];
        
        // A. Direct repetition (65% action chance)
        if (p1 === p2 && Math.random() < 0.65) {
          if (isCpuBowling) return p1;
          else {
            let choice = defaultPick();
            while (choice === p1) choice = defaultPick();
            return choice;
          }
        }

        // B. Alternating pattern (e.g. 6, 4, 6, 4)
        if (lastPicks.length >= 4) {
          const p3 = lastPicks[lastPicks.length - 3];
          const p4 = lastPicks[lastPicks.length - 4];
          if (p1 === p3 && p2 === p4) {
            // Next pick is likely p2
            if (Math.random() < 0.60) {
              if (isCpuBowling) return p2;
              else {
                let choice = defaultPick();
                while (choice === p2) choice = defaultPick();
                return choice;
              }
            }
          }
        }
      }

      // 3. Favorite Number detection
      if (playerPicks.length >= 4) {
        const counts: Record<number, number> = {};
        let favorite = playerPicks[0];
        let maxCount = 1;
        for (const p of playerPicks) {
          counts[p] = (counts[p] || 0) + 1;
          if (counts[p] > maxCount) {
            maxCount = counts[p];
            favorite = p;
          }
        }
        
        // If favorite is used more than 35% of the time
        if (maxCount / playerPicks.length > 0.35 && Math.random() < 0.50) {
          if (isCpuBowling) return favorite;
          else {
            let choice = defaultPick();
            while (choice === favorite) choice = defaultPick();
            return choice;
          }
        }
      }

      return defaultPick();
    }

    return defaultPick();
  }

  static playBall(
    state: MatchState,
    playerPick: number,
    cpuPick: number
  ): { nextState: MatchState; ballRecord: BallRecord } {
    if (state.phase !== 'innings1' && state.phase !== 'innings2') {
      throw new Error(`Cannot play ball in phase ${state.phase}`);
    }

    const currentInnings = state.phase === 'innings1' ? state.innings1 : state.innings2;
    if (!currentInnings || currentInnings.isCompleted) {
      throw new Error('Current innings is not active or is already completed');
    }

    const battingTeam = currentInnings.battingTeam;
    
    // Determine batsman and bowler picks based on who is batting
    const batsmanPick = battingTeam === 'player' ? playerPick : cpuPick;
    const bowlerPick = battingTeam === 'player' ? cpuPick : playerPick;

    const isOut = batsmanPick === bowlerPick;
    const runs = isOut ? 0 : batsmanPick;

    // Update innings details
    const newHistory = [...currentInnings.history];
    const newBallRecord: BallRecord = {
      ballNumber: currentInnings.ballsBowled + 1,
      batsmanPick,
      bowlerPick,
      runs,
      isOut,
    };
    newHistory.push(newBallRecord);

    const updatedInnings: InningsState = {
      ...currentInnings,
      score: currentInnings.score + runs,
      wicketsLost: currentInnings.wicketsLost + (isOut ? 1 : 0),
      ballsBowled: currentInnings.ballsBowled + 1,
      history: newHistory,
    };

    // Check completion of this innings
    const target = state.phase === 'innings2' ? state.target : undefined;
    updatedInnings.isCompleted = InningsManager.checkInningsCompleted(
      updatedInnings,
      state.overs,
      state.wickets,
      target
    );

    // Create a new match state copy
    const nextState: MatchState = {
      ...state,
    };

    if (state.phase === 'innings1') {
      nextState.innings1 = updatedInnings;
      if (updatedInnings.isCompleted) {
        // Prepare Innings 2
        nextState.phase = 'innings2';
        nextState.target = updatedInnings.score + 1;
        
        // The other team bats in innings 2
        const nextBatting = updatedInnings.bowlingTeam;
        const nextBowling = updatedInnings.battingTeam;
        nextState.innings2 = InningsManager.createInnings(nextBatting, nextBowling);
      }
    } else {
      nextState.innings2 = updatedInnings;
      if (updatedInnings.isCompleted) {
        nextState.phase = 'ended';
        
        // Determine the winner
        const score1 = state.innings1!.score;
        const score2 = updatedInnings.score;
        const targetVal = state.target!;

        if (score2 >= targetVal) {
          // Innings 2 batting team chased the target successfully
          nextState.winner = updatedInnings.battingTeam;
        } else if (updatedInnings.wicketsLost >= state.wickets || updatedInnings.ballsBowled >= state.overs * 6) {
          // Innings 2 batting team failed to chase
          if (score2 === score1) {
            nextState.winner = 'draw';
          } else {
            nextState.winner = updatedInnings.bowlingTeam;
          }
        } else {
          // Fallback comparison
          if (score2 > score1) {
            nextState.winner = updatedInnings.battingTeam;
          } else if (score2 < score1) {
            nextState.winner = updatedInnings.bowlingTeam;
          } else {
            nextState.winner = 'draw';
          }
        }
      }
    }

    return { nextState, ballRecord: newBallRecord };
  }
}
