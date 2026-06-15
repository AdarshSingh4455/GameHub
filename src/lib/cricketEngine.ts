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
  static getCpuPick(): number {
    return Math.floor(Math.random() * 6) + 1;
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
