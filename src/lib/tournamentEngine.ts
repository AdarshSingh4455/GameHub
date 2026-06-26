import { prisma as defaultPrisma } from './prisma'

// Splitting algorithm: splits N players into sizes of 8, 6, 4
// to minimize waiting list and balance groups
export function getTournamentSplits(N: number, preferredSplit16: '8x2' | '4x4' = '8x2'): { splits: number[], waiting: number } {
  if (N < 4) return { splits: [], waiting: N };
  if (N === 4) return { splits: [4], waiting: 0 };
  if (N === 5) return { splits: [4], waiting: 1 };
  if (N === 6) return { splits: [6], waiting: 0 };
  if (N === 7) return { splits: [6], waiting: 1 };
  if (N === 8) return { splits: [8], waiting: 0 };
  if (N === 9) return { splits: [8], waiting: 1 };
  if (N === 10) return { splits: [8], waiting: 2 };
  if (N === 11) return { splits: [8], waiting: 3 };
  if (N === 12) return { splits: [6, 6], waiting: 0 };
  if (N === 13) return { splits: [6, 6], waiting: 1 };
  if (N === 14) return { splits: [8, 6], waiting: 0 };
  if (N === 15) return { splits: [8, 6], waiting: 1 };
  if (N === 16) {
    return preferredSplit16 === '4x4'
      ? { splits: [4, 4, 4, 4], waiting: 0 }
      : { splits: [8, 8], waiting: 0 };
  }

  // General N >= 17
  const num8s = Math.floor(N / 8);
  const rem = N % 8;

  if (rem === 0) {
    return { splits: Array(num8s).fill(8), waiting: 0 };
  } else if (rem === 1) {
    return { splits: Array(num8s).fill(8), waiting: 1 };
  } else if (rem === 2) {
    // 8 + 2 -> 6 + 4 (reduces waiting to 0)
    return { splits: [...Array(num8s - 1).fill(8), 6, 4], waiting: 0 };
  } else if (rem === 3) {
    return { splits: Array(num8s).fill(8), waiting: 3 };
  } else if (rem === 4) {
    return { splits: [...Array(num8s).fill(8), 4], waiting: 0 };
  } else if (rem === 5) {
    return { splits: [...Array(num8s).fill(8), 4], waiting: 1 };
  } else if (rem === 6) {
    return { splits: [...Array(num8s).fill(8), 6], waiting: 0 };
  } else { // rem === 7
    return { splits: [...Array(num8s).fill(8), 6], waiting: 1 };
  }
}

// Generate match times based on type (ONE_DAY hourly vs MULTI_DAY daily)
export function getMatchTiming(
  startDateStr: string,
  startTimeStr: string | null,
  roundIndex: number,
  type: 'ONE_DAY' | 'MULTI_DAY'
): { matchTime: Date; joinStart: Date; joinEnd: Date } {
  const start = new Date(startDateStr);
  
  if (startTimeStr) {
    // Parse time like "10:00 AM" or "20:00"
    const match = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const ampm = match[3];
      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
        if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      }
      start.setHours(hours, minutes, 0, 0);
    }
  }

  const matchTime = new Date(start);
  if (type === 'ONE_DAY') {
    // Round 0 = start, Round 1 = start + 2 hrs, Round 2 = start + 4 hrs
    matchTime.setHours(matchTime.getHours() + roundIndex * 2);
  } else {
    // Multi Day: Round 0 = start, Round 1 = start + 1 day, Round 2 = start + 2 days
    matchTime.setDate(matchTime.getDate() + roundIndex);
  }

  // Join opens 5 mins before, closes 10 mins after match start
  const joinStart = new Date(matchTime.getTime() - 5 * 60 * 1000);
  const joinEnd = new Date(matchTime.getTime() + 10 * 60 * 1000);

  return { matchTime, joinStart, joinEnd };
}

// Helper to create notifications
export async function createNotification(
  prisma: any,
  profileId: string,
  title: string,
  message: string
) {
  try {
    await prisma.notification.create({
      data: {
        profileId,
        type: 'TOURNAMENT',
        title,
        message,
        isRead: false
      }
    });
  } catch (err) {
    console.error('[createNotification] Failed:', err);
  }
}

// Generate matches for a sub-tournament division
export async function generateBracket(
  prisma: any,
  subTournamentId: string,
  participants: { id: string; name: string }[],
  type: 'ONE_DAY' | 'MULTI_DAY',
  startDate: string,
  startTime: string | null
) {
  const capacity = participants.length;

  const sub = await prisma.subTournament.findUnique({
    where: { id: subTournamentId }
  });
  if (sub) {
    await prisma.tournamentAuditLog.create({
      data: {
        tournamentId: sub.tournamentId,
        event: 'Bracket Generated',
        details: `Bracket generated for division: ${sub.name} with ${capacity} players.`
      }
    });
  }

  if (capacity === 8) {
    // Round 0: Quarter Finals (4 matches)
    const r0Timing = getMatchTiming(startDate, startTime, 0, type);
    const m1 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 0,
        p1Id: participants[0].id,
        p1Name: participants[0].name,
        p2Id: participants[1].id,
        p2Name: participants[1].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });
    const m2 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 1,
        p1Id: participants[2].id,
        p1Name: participants[2].name,
        p2Id: participants[3].id,
        p2Name: participants[3].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });
    const m3 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 2,
        p1Id: participants[4].id,
        p1Name: participants[4].name,
        p2Id: participants[5].id,
        p2Name: participants[5].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });
    const m4 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 3,
        p1Id: participants[6].id,
        p1Name: participants[6].name,
        p2Id: participants[7].id,
        p2Name: participants[7].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });

    // Round 1: Semi Finals (2 matches)
    const r1Timing = getMatchTiming(startDate, startTime, 1, type);
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 1,
        roundName: 'Semi Finals',
        matchIndex: 0,
        matchTime: r1Timing.matchTime,
        joinWindowStart: r1Timing.joinStart,
        joinWindowEnd: r1Timing.joinEnd
      }
    });
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 1,
        roundName: 'Semi Finals',
        matchIndex: 1,
        matchTime: r1Timing.matchTime,
        joinWindowStart: r1Timing.joinStart,
        joinWindowEnd: r1Timing.joinEnd
      }
    });

    // Round 2: Finals (1 match)
    const r2Timing = getMatchTiming(startDate, startTime, 2, type);
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 2,
        roundName: 'Finals',
        matchIndex: 0,
        matchTime: r2Timing.matchTime,
        joinWindowStart: r2Timing.joinStart,
        joinWindowEnd: r2Timing.joinEnd
      }
    });

  } else if (capacity === 6) {
    // Round 0: Quarter Finals (2 matches, participants 0 and 1 get byes)
    const r0Timing = getMatchTiming(startDate, startTime, 0, type);
    const m1 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 0,
        p1Id: participants[2].id,
        p1Name: participants[2].name,
        p2Id: participants[3].id,
        p2Name: participants[3].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });
    const m2 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Quarter Finals',
        matchIndex: 1,
        p1Id: participants[4].id,
        p1Name: participants[4].name,
        p2Id: participants[5].id,
        p2Name: participants[5].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });

    // Round 1: Semi Finals (2 matches, slots prefilled with bye players)
    const r1Timing = getMatchTiming(startDate, startTime, 1, type);
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 1,
        roundName: 'Semi Finals',
        matchIndex: 0,
        p1Id: participants[0].id,
        p1Name: participants[0].name,
        matchTime: r1Timing.matchTime,
        joinWindowStart: r1Timing.joinStart,
        joinWindowEnd: r1Timing.joinEnd
      }
    });
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 1,
        roundName: 'Semi Finals',
        matchIndex: 1,
        p1Id: participants[1].id,
        p1Name: participants[1].name,
        matchTime: r1Timing.matchTime,
        joinWindowStart: r1Timing.joinStart,
        joinWindowEnd: r1Timing.joinEnd
      }
    });

    // Round 2: Finals (1 match)
    const r2Timing = getMatchTiming(startDate, startTime, 2, type);
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 2,
        roundName: 'Finals',
        matchIndex: 0,
        matchTime: r2Timing.matchTime,
        joinWindowStart: r2Timing.joinStart,
        joinWindowEnd: r2Timing.joinEnd
      }
    });

  } else if (capacity === 4) {
    // Round 0: Semi Finals (2 matches)
    const r0Timing = getMatchTiming(startDate, startTime, 0, type);
    const m1 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Semi Finals',
        matchIndex: 0,
        p1Id: participants[0].id,
        p1Name: participants[0].name,
        p2Id: participants[1].id,
        p2Name: participants[1].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });
    const m2 = await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 0,
        roundName: 'Semi Finals',
        matchIndex: 1,
        p1Id: participants[2].id,
        p1Name: participants[2].name,
        p2Id: participants[3].id,
        p2Name: participants[3].name,
        matchTime: r0Timing.matchTime,
        joinWindowStart: r0Timing.joinStart,
        joinWindowEnd: r0Timing.joinEnd
      }
    });

    // Round 1: Finals (1 match)
    const r1Timing = getMatchTiming(startDate, startTime, 1, type);
    await prisma.tournamentMatch.create({
      data: {
        subTournamentId,
        roundIndex: 1,
        roundName: 'Finals',
        matchIndex: 0,
        matchTime: r1Timing.matchTime,
        joinWindowStart: r1Timing.joinStart,
        joinWindowEnd: r1Timing.joinEnd
      }
    });
  }
}

// Propagate match winner to the next round slot
export async function propagateWinner(
  prisma: any,
  subTournamentId: string,
  roundIndex: number,
  matchIndex: number,
  winnerId: string,
  winnerName: string
) {
  // Find sub-tournament size to determine next match indexes
  const sub = await prisma.subTournament.findUnique({
    where: { id: subTournamentId },
    include: { matches: true }
  });
  if (!sub) return;

  const totalMatches = sub.matches.length;
  // Sizes determines capacity
  let capacity = 8;
  if (totalMatches === 7) capacity = 8;
  else if (totalMatches === 5) capacity = 6;
  else if (totalMatches === 3) capacity = 4;

  const nextRoundIndex = roundIndex + 1;
  let nextMatchIndex = 0;
  let isP2 = false;

  if (capacity === 8) {
    if (roundIndex === 0) {
      // QF (0, 1, 2, 3) -> SF (0, 1)
      nextMatchIndex = Math.floor(matchIndex / 2);
      isP2 = matchIndex % 2 === 1;
    } else if (roundIndex === 1) {
      // SF (0, 1) -> Finals (0)
      nextMatchIndex = 0;
      isP2 = matchIndex === 1;
    } else {
      // Finals won! Sub-tournament completed
      await prisma.subTournament.update({
        where: { id: subTournamentId },
        data: { status: 'COMPLETED', winnerId }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Winner Declared',
          details: `Winner of ${sub.name} is ${winnerName || 'Player'}`
        }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Tournament Completed',
          details: `Division bracket ${sub.name} completed successfully.`
        }
      });
      return;
    }
  } else if (capacity === 6) {
    if (roundIndex === 0) {
      // QF (0, 1) -> SF (0, 1) as Player 2 (since p1 is the bye player)
      nextMatchIndex = matchIndex;
      isP2 = true;
    } else if (roundIndex === 1) {
      // SF (0, 1) -> Finals (0)
      nextMatchIndex = 0;
      isP2 = matchIndex === 1;
    } else {
      // Finals won! Completed
      await prisma.subTournament.update({
        where: { id: subTournamentId },
        data: { status: 'COMPLETED', winnerId }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Winner Declared',
          details: `Winner of ${sub.name} is ${winnerName || 'Player'}`
        }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Tournament Completed',
          details: `Division bracket ${sub.name} completed successfully.`
        }
      });
      return;
    }
  } else { // capacity === 4
    if (roundIndex === 0) {
      // SF (0, 1) -> Finals (0)
      nextMatchIndex = 0;
      isP2 = matchIndex === 1;
    } else {
      // Finals won! Completed
      await prisma.subTournament.update({
        where: { id: subTournamentId },
        data: { status: 'COMPLETED', winnerId }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Winner Declared',
          details: `Winner of ${sub.name} is ${winnerName || 'Player'}`
        }
      });
      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: sub.tournamentId,
          event: 'Tournament Completed',
          details: `Division bracket ${sub.name} completed successfully.`
        }
      });
      return;
    }
  }

  // Find next match and update it
  const nextMatch = await prisma.tournamentMatch.findFirst({
    where: {
      subTournamentId,
      roundIndex: nextRoundIndex,
      matchIndex: nextMatchIndex
    }
  });

  if (nextMatch) {
    const updateData: any = {};
    if (isP2) {
      updateData.p2Id = winnerId;
      updateData.p2Name = winnerName;
    } else {
      updateData.p1Id = winnerId;
      updateData.p1Name = winnerName;
    }
    await prisma.tournamentMatch.update({
      where: { id: nextMatch.id },
      data: updateData
    });
  }
}

// Automatically create new sub-tournaments from waiting list when >= 4 players
export async function checkAndCreateFromWaitingList(
  prisma: any,
  tournamentId: string
) {
  // Fetch all registrations in the waiting list sorted by date
  const waitingRegs = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'WAITING_LIST'
    },
    orderBy: { registeredAt: 'asc' },
    include: { profile: true, team: true }
  });

  if (waitingRegs.length >= 4) {
    const event = await prisma.tournament.findUnique({
      where: { id: tournamentId }
    });
    if (!event) return;

    // Grab first 4
    const selected = waitingRegs.slice(0, 4);
    const participants = selected.map((r: any) => {
      if (r.team) {
        return { id: r.team.id, name: r.team.name };
      } else {
        return { id: r.profileId, name: r.profile?.username || `Player_${r.profileId.substring(0, 5)}` };
      }
    });

    // Create Sub Tournament of size 4
    const countSubs = await prisma.subTournament.count({ where: { tournamentId } });
    const sub = await prisma.subTournament.create({
      data: {
        tournamentId,
        name: `${event.name} - Division ${countSubs + 1}`,
        capacity: 4,
        status: 'ACTIVE'
      }
    });

    // Generate bracket of size 4
    await generateBracket(
      prisma,
      sub.id,
      participants,
      event.type as 'ONE_DAY' | 'MULTI_DAY',
      typeof event.startDate === 'string' ? event.startDate : (event.startDate as Date).toISOString(),
      event.startTime
    );

    // Update registration status to REGISTERED
    for (const r of selected) {
      await prisma.tournamentRegistration.update({
        where: { id: r.id },
        data: { status: 'REGISTERED', waitingPosition: 0 }
      });

      // Send notification: Tournament Started!
      await createNotification(
        prisma,
        r.profileId,
        'Tournament Bracket Generated! ⚔️',
        `Your waiting list group is active in ${event.name}! View your match schedule.`
      );
    }

    // Re-adjust other waiting list positions (1-indexed)
    const remainingRegs = await prisma.tournamentRegistration.findMany({
      where: { tournamentId, status: 'WAITING_LIST' },
      orderBy: { registeredAt: 'asc' }
    });

    for (let i = 0; i < remainingRegs.length; i++) {
      await prisma.tournamentRegistration.update({
        where: { id: remainingRegs[i].id },
        data: { waitingPosition: i + 1 }
      });
    }

    // Check again recursively
    await checkAndCreateFromWaitingList(prisma, tournamentId);
  }
}

// Scans pending matches and automatically disqualifies expired join windows
export async function checkAndProcessDisqualifications(prisma: any = defaultPrisma) {
  const now = new Date();

  // Find all matches that are PENDING, whose joinWindowEnd has passed
  const overdueMatches = await prisma.tournamentMatch.findMany({
    where: {
      status: 'PENDING',
      joinWindowEnd: { lt: now }
    },
    include: {
      subTournament: {
        include: { tournament: true }
      }
    }
  });

  for (const m of overdueMatches) {
    const isP1Active = m.p1Ready;
    const isP2Active = m.p2Ready;

    let winnerId = null;
    let winnerName = null;
    let matchStatus = 'DISQUALIFIED';
    let logMessage = '';

    if (isP1Active && !isP2Active) {
      // P1 wins by walkover, P2 disqualified
      winnerId = m.p1Id;
      winnerName = m.p1Name;
      matchStatus = 'WALK_OVER';
      m.p1Score = 1;
      m.p2Score = 0;
      logMessage = `${m.p2Name || 'Player 2'} disqualified for inactivity (did not ready up). ${m.p1Name || 'Player 1'} wins by walkover!`;
      
      if (m.p1Id && !m.p1Id.startsWith('bot-')) {
        await createNotification(prisma, m.p1Id, 'Won by Walkover! 🏆', `Your opponent missed the join window in ${m.subTournament.tournament.name}. You advanced!`);
      }
      if (m.p2Id && !m.p2Id.startsWith('bot-')) {
        await createNotification(prisma, m.p2Id, 'Disqualified from Match ❌', `You missed the join window in ${m.subTournament.tournament.name} and were disqualified.`);
      }

      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: m.subTournament.tournament.id,
          event: 'Walkover',
          details: logMessage
        }
      });

    } else if (!isP1Active && isP2Active) {
      // P2 wins by walkover, P1 disqualified
      winnerId = m.p2Id;
      winnerName = m.p2Name;
      matchStatus = 'WALK_OVER';
      m.p1Score = 0;
      m.p2Score = 1;
      logMessage = `${m.p1Name || 'Player 1'} disqualified for inactivity (did not ready up). ${m.p2Name || 'Player 2'} wins by walkover!`;

      if (m.p2Id && !m.p2Id.startsWith('bot-')) {
        await createNotification(prisma, m.p2Id, 'Won by Walkover! 🏆', `Your opponent missed the join window in ${m.subTournament.tournament.name}. You advanced!`);
      }
      if (m.p1Id && !m.p1Id.startsWith('bot-')) {
        await createNotification(prisma, m.p1Id, 'Disqualified from Match ❌', `You missed the join window in ${m.subTournament.tournament.name} and were disqualified.`);
      }

      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: m.subTournament.tournament.id,
          event: 'Walkover',
          details: logMessage
        }
      });

    } else {
      // Neither readied up! Disqualify both, but choose one fallback to advance to keep bracket active
      winnerId = m.p1Id || m.p2Id;
      winnerName = m.p1Name || m.p2Name;
      matchStatus = 'DISQUALIFIED';
      m.p1Score = 0;
      m.p2Score = 0;
      logMessage = `Both players missed the join/ready window in ${m.roundName}. ${winnerName || 'Player 1'} advanced to keep the bracket playable.`;

      if (m.p1Id && !m.p1Id.startsWith('bot-')) {
        await createNotification(prisma, m.p1Id, 'Disqualified from Match ❌', `You missed the join window in ${m.subTournament.tournament.name} and were disqualified.`);
      }
      if (m.p2Id && !m.p2Id.startsWith('bot-')) {
        await createNotification(prisma, m.p2Id, 'Disqualified from Match ❌', `You missed the join window in ${m.subTournament.tournament.name} and were disqualified.`);
      }

      await prisma.tournamentAuditLog.create({
        data: {
          tournamentId: m.subTournament.tournament.id,
          event: 'Disqualification',
          details: logMessage
        }
      });
    }

    // Update match
    await prisma.tournamentMatch.update({
      where: { id: m.id },
      data: {
        status: matchStatus,
        winnerId,
        p1Score: m.p1Score,
        p2Score: m.p2Score
      }
    });

    // Propagate winner
    if (winnerId && winnerName) {
      await propagateWinner(
        prisma,
        m.subTournamentId,
        m.roundIndex,
        m.matchIndex,
        winnerId,
        winnerName
      );
    }
  }

  return overdueMatches.length;
}
