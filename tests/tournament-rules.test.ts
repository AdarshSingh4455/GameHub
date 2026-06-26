process.env.MOCK_AUTH = 'true'
import { prisma } from '../src/lib/prisma'
import {
  getTournamentSplits,
  generateBracket,
  propagateWinner,
  checkAndCreateFromWaitingList,
  checkAndProcessDisqualifications,
  getMatchTiming,
  createNotification
} from '../src/lib/tournamentEngine'

async function runTests() {
  console.log('=== STARTING TOURNAMENT SYSTEM REBUILD TESTS ===')

  // 1. Test Capacity Splitting
  console.log('\n--- 1. Testing Capacity Splitting Algorithm ---')
  const splitTests = [
    { N: 4, expected: { splits: [4], waiting: 0 } },
    { N: 6, expected: { splits: [6], waiting: 0 } },
    { N: 8, expected: { splits: [8], waiting: 0 } },
    { N: 10, expected: { splits: [8], waiting: 2 } },
    { N: 12, expected: { splits: [6, 6], waiting: 0 } },
    { N: 16, preferred: '8x2' as const, expected: { splits: [8, 8], waiting: 0 } },
    { N: 16, preferred: '4x4' as const, expected: { splits: [4, 4, 4, 4], waiting: 0 } },
    { N: 20, expected: { splits: [8, 8, 4], waiting: 0 } },
    { N: 22, expected: { splits: [8, 8, 6], waiting: 0 } },
    { N: 24, expected: { splits: [8, 8, 8], waiting: 0 } }
  ]

  for (const tc of splitTests) {
    const res = getTournamentSplits(tc.N, tc.preferred)
    console.log(`N = ${tc.N} (pref: ${tc.preferred || 'default'}): splits = [${res.splits.join(', ')}], waiting = ${res.waiting}`)
    // Assertions
    if (JSON.stringify(res.splits) !== JSON.stringify(tc.expected.splits) || res.waiting !== tc.expected.waiting) {
      throw new Error(`Failed split test for N=${tc.N}. Expected splits [${tc.expected.splits.join(', ')}], waiting ${tc.expected.waiting}. Got splits [${res.splits.join(', ')}], waiting ${res.waiting}`)
    }
  }
  console.log('✓ Capacity splitting tests passed!')

  // 2. Setup mock tournament context in DB for logic testing
  console.log('\n--- 2. Setting Up DB Test State ---')
  const testTournament = await prisma.tournament.create({
    data: {
      name: 'Test Championship',
      description: 'Testing bracket generation and splits',
      gameSlug: 'tic-tac-toe',
      startDate: new Date(),
      endDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      eligibleGames: ['tic-tac-toe'],
      status: 'ANNOUNCEMENT',
      isOfficial: true,
      rewardCoins: 500
    }
  })
  console.log(`Created test tournament: ${testTournament.id}`)

  // 3. Test Bracket Generation (Sizes 4, 6, 8)
  console.log('\n--- 3. Testing Bracket Generation (Sizes 4, 6, 8) ---')
  
  // Size 4
  const sub4 = await prisma.subTournament.create({
    data: { tournamentId: testTournament.id, name: 'Div-4', capacity: 4 }
  })
  await generateBracket(
    prisma,
    sub4.id,
    [
      { id: 'p1', name: 'Player 1' },
      { id: 'p2', name: 'Player 2' },
      { id: 'p3', name: 'Player 3' },
      { id: 'p4', name: 'Player 4' }
    ],
    'ONE_DAY',
    testTournament.startDate.toISOString(),
    '10:00 AM'
  )
  const matches4 = await prisma.tournamentMatch.findMany({ where: { subTournamentId: sub4.id } })
  console.log(`Generated size-4 sub-tournament. Match count: ${matches4.length} (expected 3)`)
  if (matches4.length !== 3) throw new Error('Size 4 bracket should have 3 matches')

  // Size 6 (includes byes)
  const sub6 = await prisma.subTournament.create({
    data: { tournamentId: testTournament.id, name: 'Div-6', capacity: 6 }
  })
  await generateBracket(
    prisma,
    sub6.id,
    [
      { id: 'p1', name: 'Player 1' },
      { id: 'p2', name: 'Player 2' },
      { id: 'p3', name: 'Player 3' },
      { id: 'p4', name: 'Player 4' },
      { id: 'p5', name: 'Player 5' },
      { id: 'p6', name: 'Player 6' }
    ],
    'ONE_DAY',
    testTournament.startDate.toISOString(),
    '10:00 AM'
  )
  const matches6 = await prisma.tournamentMatch.findMany({ where: { subTournamentId: sub6.id } })
  console.log(`Generated size-6 sub-tournament. Match count: ${matches6.length} (expected 5)`)
  if (matches6.length !== 5) throw new Error('Size 6 bracket should have 5 matches')
  const r1Matches6 = matches6.filter((m: any) => m.roundIndex === 1)
  console.log(`Round 1 match 0: p1 = ${r1Matches6[0].p1Name}, p2 = ${r1Matches6[0].p2Name} (expected P1 name to be Player 1 from bye)`)
  if (r1Matches6[0].p1Id !== 'p1') throw new Error('First bye player should advance to Round 1 Match 0')
  if (r1Matches6[1].p1Id !== 'p2') throw new Error('Second bye player should advance to Round 1 Match 1')

  // Size 8
  const sub8 = await prisma.subTournament.create({
    data: { tournamentId: testTournament.id, name: 'Div-8', capacity: 8 }
  })
  await generateBracket(
    prisma,
    sub8.id,
    Array.from({ length: 8 }).map((_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` })),
    'ONE_DAY',
    testTournament.startDate.toISOString(),
    '10:00 AM'
  )
  const matches8 = await prisma.tournamentMatch.findMany({ where: { subTournamentId: sub8.id } })
  console.log(`Generated size-8 sub-tournament. Match count: ${matches8.length} (expected 7)`)
  if (matches8.length !== 7) throw new Error('Size 8 bracket should have 7 matches')

  console.log('✓ Bracket generation tests passed!')

  // 4. Test Waiting List & Automatic Spin-off
  console.log('\n--- 4. Testing Waiting List Spin-off ---')
  // Add 3 players to waiting list
  await prisma.tournamentRegistration.create({
    data: { tournamentId: testTournament.id, profileId: 'test-user-a', status: 'WAITING_LIST', waitingPosition: 1 }
  })
  await prisma.tournamentRegistration.create({
    data: { tournamentId: testTournament.id, profileId: 'test-user-b', status: 'WAITING_LIST', waitingPosition: 2 }
  })
  await prisma.tournamentRegistration.create({
    data: { tournamentId: testTournament.id, profileId: 'p3', status: 'WAITING_LIST', waitingPosition: 3 }
  })

  // Verify positions
  let waitingList = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: testTournament.id, status: 'WAITING_LIST' },
    orderBy: { registeredAt: 'asc' }
  })
  console.log(`Waiting list size: ${waitingList.length} (expected 3)`)
  if (waitingList.length !== 3) throw new Error('Waiting list size mismatch')

  // Trigger check - should NOT spin off
  await checkAndCreateFromWaitingList(prisma, testTournament.id)
  let subCountBefore = await prisma.subTournament.count({ where: { tournamentId: testTournament.id } })
  console.log(`Sub-tournament count: ${subCountBefore} (expected 3: Div-4, Div-6, Div-8)`)
  if (subCountBefore !== 3) throw new Error('Should not create tournament with < 4 waiting players')

  // Add 4th player
  await prisma.tournamentRegistration.create({
    data: { tournamentId: testTournament.id, profileId: 'p4', status: 'WAITING_LIST', waitingPosition: 4 }
  })

  // Trigger check - SHOULD spin off!
  await checkAndCreateFromWaitingList(prisma, testTournament.id)
  let subCountAfter = await prisma.subTournament.count({ where: { tournamentId: testTournament.id } })
  console.log(`Sub-tournament count after 4th player: ${subCountAfter} (expected 4)`)
  if (subCountAfter !== 4) throw new Error('Should have automatically spun off a size 4 tournament')

  // Verify waiting list is empty
  let waitingListAfter = await prisma.tournamentRegistration.findMany({
    where: { tournamentId: testTournament.id, status: 'WAITING_LIST' }
  })
  console.log(`Waiting list size after spin-off: ${waitingListAfter.length} (expected 0)`)
  if (waitingListAfter.length !== 0) throw new Error('Waiting list should be empty after spin-off')
  console.log('✓ Waiting list and spin-off tests passed!')

  // 5. Test Join Window Timings
  console.log('\n--- 5. Testing Join Window Timings ---')
  const timing = getMatchTiming(new Date().toISOString(), '12:00 PM', 0, 'ONE_DAY')
  console.log(`Match time: ${timing.matchTime.toLocaleTimeString()}`)
  console.log(`Join opens: ${timing.joinStart.toLocaleTimeString()} (expected 5m before)`)
  console.log(`Join closes: ${timing.joinEnd.toLocaleTimeString()} (expected 10m after)`)
  const durationDiff = timing.joinEnd.getTime() - timing.joinStart.getTime()
  if (durationDiff !== 15 * 60 * 1000) throw new Error('Join window duration should be exactly 15 minutes')
  console.log('✓ Join window timing tests passed!')

  // 6. Test Auto-Disqualification & Walkover
  console.log('\n--- 6. Testing Auto-Disqualification & Walkovers ---')
  
  // Find a match and set its joinWindowEnd to the past
  const matchToDisqualify = await prisma.tournamentMatch.findFirst({
    where: { subTournamentId: sub4.id, roundIndex: 0, matchIndex: 0 }
  })
  if (!matchToDisqualify) throw new Error('Could not find match to disqualify')

  await prisma.tournamentMatch.update({
    where: { id: matchToDisqualify.id },
    data: {
      joinWindowStart: new Date(Date.now() - 30 * 60 * 1000),
      joinWindowEnd: new Date(Date.now() - 15 * 60 * 1000),
      p1Joined: true,
      p1Ready: true,   // Player 1 readied up
      p2Joined: false,
      p2Ready: false   // Player 2 did not ready up (will be disqualified)
    }
  })

  // Run disqualifications
  const countDisqualified = await checkAndProcessDisqualifications(prisma)
  console.log(`Processed disqualifications: ${countDisqualified}`)
  if (countDisqualified === 0) throw new Error('Expected at least 1 match to be processed for disqualification')

  // Check match state
  const updatedMatch = await prisma.tournamentMatch.findUnique({
    where: { id: matchToDisqualify.id }
  })
  console.log(`Match status: ${updatedMatch.status} (expected WALK_OVER), Winner: ${updatedMatch.winnerId} (expected p1)`)
  if (updatedMatch.status !== 'WALK_OVER' || updatedMatch.winnerId !== 'p1') {
    throw new Error('Player 1 should have won by walkover')
  }

  // Check next round match propagation
  const nextRoundMatch = await prisma.tournamentMatch.findFirst({
    where: { subTournamentId: sub4.id, roundIndex: 1, matchIndex: 0 }
  })
  console.log(`Next round match p1Id: ${nextRoundMatch.p1Id} (expected p1)`)
  if (nextRoundMatch.p1Id !== 'p1') {
    throw new Error('Winner p1 should have advanced to round 1')
  }

  console.log('✓ Auto-disqualification and walkover tests passed!')

  // 7. Verify Notifications
  console.log('\n--- 7. Testing In-App Notifications ---')
  const notifications = await prisma.notification.findMany({
    where: { profileId: 'test-user-b' }
  })
  console.log(`Notifications sent to test-user-b: ${notifications.length}`)
  for (const n of notifications) {
    console.log(`- [${n.title}]: ${n.message}`)
  }
  if (notifications.length === 0) throw new Error('Expected disqualification notification to be sent')
  console.log('✓ Notifications tests passed!')

  console.log('\n=== ALL TOURNAMENT SYSTEM REBUILD TESTS PASSED SUCCESSFULLY! ===')
}

runTests().catch(err => {
  console.error('\n❌ TEST RUN FAILED:', err)
  process.exit(1)
})
