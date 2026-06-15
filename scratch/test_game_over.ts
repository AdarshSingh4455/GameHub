import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import dns from 'dns';
dns.setDefaultResultOrder('ipv4first');

async function testGameResult(gameSlug: string, result: 'win' | 'loss' | 'draw') {
  console.log(`\nTesting game over for: ${gameSlug} (${result})`);
  
  const { getGameXP, computeLevel } = await import('../src/lib/xp');
  const { prisma } = await import('../src/lib/prisma');
  const { checkAndUnlockAchievements } = await import('../src/lib/achievements');
  
  // profile: adarsh004455
  const profileId = '219a77ef-03ff-4ef0-96be-67ff5dc36387';
  
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
  });
  if (!profile) {
    throw new Error('Profile not found');
  }

  try {
    const responsePayload = await prisma.$transaction(async (tx) => {
      // Find game
      const game = await tx.game.findUnique({
        where: { slug: gameSlug },
      });
      if (!game) {
        throw new Error(`Game not found: ${gameSlug}`);
      }

      // Record match history
      await tx.matchRecord.create({
        data: {
          gameId: game.id,
          player1Id: profile.id,
          player2Score: 0,
          winnerId: result === 'win' ? profile.id : null,
          durationSecs: 60,
        },
      });

      // Update incremental game stats for favorites/high scores
      const stats = await tx.profileGameStats.findUnique({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
      });
      const newHighScore = Math.max(stats?.highScore ?? 0, 100);

      await tx.profileGameStats.upsert({
        where: {
          profileId_gameSlug: {
            profileId: profile.id,
            gameSlug,
          },
        },
        create: {
          profileId: profile.id,
          gameSlug,
          playCount: 1,
          winCount: result === 'win' ? 1 : 0,
          highScore: 100,
        },
        update: {
          playCount: { increment: 1 },
          winCount: { increment: result === 'win' ? 1 : 0 },
          highScore: newHighScore,
          lastPlayed: new Date(),
        },
      });

      // Fetch resolved game XP rewards from central config
      const baseXP = getGameXP(gameSlug, result);
      const baseCoins = result === 'win' ? 20 : 5;

      // Increment profile base rewards
      const updatedProfile = await tx.profile.update({
        where: { id: profile.id },
        data: {
          xp: { increment: baseXP },
          coins: { increment: baseCoins },
        },
      });

      // Record XP event
      await tx.xPEvent.create({
        data: {
          profileId: profile.id,
          type: result === 'win' ? 'MATCH_WIN' : 'MATCH_LOSS',
          amount: baseXP,
          meta: { gameSlug },
        },
      });

      // Check for achievements
      console.log('Checking achievements...');
      const newlyUnlocked = await checkAndUnlockAchievements(profile.id, gameSlug, result, tx);
      console.log('Achievements unlocked:', newlyUnlocked);

      // Calculate total rewards
      const totalXPGained = baseXP + newlyUnlocked.reduce((sum, a) => sum + a.xpReward, 0);
      const totalCoinsGained = baseCoins + newlyUnlocked.reduce((sum, a) => sum + a.coinReward, 0);

      const finalXP = profile.xp + totalXPGained
      const finalLevel = computeLevel(finalXP)
      const leveledUp = finalLevel > profile.level

      if (leveledUp) {
        await tx.profile.update({
          where: { id: profile.id },
          data: { level: finalLevel },
        });

        // Log LevelUp analytics event
        await tx.analyticsEvent.create({
          data: {
            profileId: profile.id,
            eventName: 'level_up',
            metadata: {
              oldLevel: profile.level,
              newLevel: finalLevel,
            },
          },
        });
      }

      return {
        gameSlug,
        result,
        xpGained: totalXPGained,
        coinsGained: totalCoinsGained,
        newXP: finalXP,
      };
    }, { maxWait: 15000, timeout: 30000 });

    console.log('Success payload:', responsePayload);
  } catch (err) {
    console.error('Transaction failed with error:', err);
  }
}

async function run() {
  await testGameResult('arrow-puzzle', 'win');
}

run().finally(async () => {
  const { prisma } = await import('../src/lib/prisma');
  await prisma.$disconnect();
});
