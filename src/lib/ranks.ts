import { Prisma } from '@prisma/client'

export async function recalculateLeaderboardRanks(tx: Prisma.TransactionClient) {
  // Use a single bulk raw SQL query with window function to update ranks
  // SET "previousRank" = "currentRank", "currentRank" = ranked.rank only where it changed
  await tx.$executeRaw`
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY xp DESC) as rank
      FROM "Profile"
    )
    UPDATE "Profile"
    SET "previousRank" = "currentRank",
        "currentRank" = ranked.rank
    FROM ranked
    WHERE "Profile".id = ranked.id 
      AND ("Profile"."currentRank" IS NULL OR "Profile"."currentRank" != ranked.rank)
  `
}
