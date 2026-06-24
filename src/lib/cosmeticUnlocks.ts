import { prisma } from '@/lib/prisma'

export async function checkAndUnlockProgressionItems(
  profileId: string,
  level: number,
  streak: number,
  totalWins: number,
  tx?: any
) {
  const client = tx || prisma

  // 1. Fetch profile to check if it's a guest
  const profile = await client.profile.findUnique({
    where: { id: profileId },
    select: { isGuest: true }
  })

  if (!profile || profile.isGuest) {
    return [] // Do not unlock for guest or non-existent profile
  }

  // 2. Define the list of progression cosmetics and their unlock conditions
  const unlocks = [
    { name: 'Neon Frame', cond: level >= 5 },
    { name: 'Prestige Border', cond: level >= 10 },
    { name: 'Ruby Glow', cond: level >= 25 },
    { name: 'Cosmic Trail', cond: level >= 15 },
    { name: 'Golden Aura', cond: level >= 50 },
    
    // Level frames
    { name: 'Bronze Frame', cond: level >= 15 },
    { name: 'Silver Frame', cond: level >= 30 },
    { name: 'Gold Frame', cond: level >= 45 },
    { name: 'Platinum Frame', cond: level >= 60 },
    { name: 'Diamond Frame', cond: level >= 75 },
    { name: 'Master Frame', cond: level >= 90 },
    { name: 'Legendary Frame', cond: level >= 100 },

    // Streaks
    { name: 'Rainbow Sparkles', cond: streak >= 7 },

    // Wins & Titles
    { name: 'Champion Frame', cond: totalWins >= 50 },
    { name: 'Cosmic Title', cond: level >= 15 },
    { name: 'Game Legend', cond: totalWins >= 100 },
    { name: 'Rookie', cond: totalWins >= 25 },
    { name: 'Challenger', cond: totalWins >= 50 },
    { name: 'Rising Star', cond: totalWins >= 75 },
    { name: 'Veteran', cond: totalWins >= 100 },
    { name: 'Elite', cond: totalWins >= 200 },
    { name: 'Mastermind', cond: totalWins >= 350 },
    { name: 'Immortal', cond: totalWins >= 500 }
  ]

  // 3. Filter down to items the user qualifies for
  const qualifyingNames = unlocks.filter(u => u.cond).map(u => u.name)

  if (qualifyingNames.length === 0) {
    return []
  }

  // 4. Query the database to find actual CosmeticItem records for these qualifying names
  const items = await client.cosmeticItem.findMany({
    where: {
      name: { in: qualifyingNames }
    }
  })

  if (items.length === 0) {
    return []
  }

  const qualifyingItemIds = items.map((i: any) => i.id)

  // 5. Fetch user's existing inventory to avoid duplicates
  const existingInventory = await client.profileInventory.findMany({
    where: {
      profileId,
      cosmeticItemId: { in: qualifyingItemIds }
    },
    select: { cosmeticItemId: true }
  })
  const existingItemIds = new Set(existingInventory.map((inv: any) => inv.cosmeticItemId))

  // 6. Determine which items are NOT already in the inventory
  const newlyUnlockedItemsToAward = items.filter((i: any) => !existingItemIds.has(i.id))

  if (newlyUnlockedItemsToAward.length === 0) {
    return []
  }

  // 7. Award newly unlocked items
  const newlyUnlockedItems: any[] = []
  for (const item of newlyUnlockedItemsToAward) {
    try {
      // Create the ProfileInventory record
      await client.profileInventory.create({
        data: {
          profileId,
          cosmeticItemId: item.id
        }
      })
      newlyUnlockedItems.push(item)
    } catch (e) {
      console.error(`[checkAndUnlockProgressionItems] Failed to award item ${item.name} (${item.id}) to ${profileId}`, e)
    }
  }

  return newlyUnlockedItems
}
