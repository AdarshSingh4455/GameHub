-- 🌱 GameHub Phase 21: Ranked Competitive Database Migration Script
-- Safe migration script to be executed directly in the Supabase SQL Editor.
-- This script adds missing ranked columns and creates ranked tables without dropping existing data.

-- 1. Add new fields to the "Profile" table safely if they do not exist
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rankedMmr" INTEGER DEFAULT 1000 NOT NULL;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rankedWins" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rankedLosses" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rankedStreak" INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "rankedPeakRank" TEXT DEFAULT 'Bronze' NOT NULL;

-- 2. Create the "RankedSeason" table safely if it does not exist
CREATE TABLE IF NOT EXISTS "RankedSeason" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rewards" JSONB,

    CONSTRAINT "RankedSeason_pkey" PRIMARY KEY ("id")
);

-- Create unique index on RankedSeason name if missing
CREATE UNIQUE INDEX IF NOT EXISTS "RankedSeason_name_key" ON "RankedSeason"("name");

-- 3. Create the "SeasonSnapshot" table safely if it does not exist
CREATE TABLE IF NOT EXISTS "SeasonSnapshot" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "mmr" INTEGER NOT NULL,
    "rank" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SeasonSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create unique index on SeasonSnapshot if missing
CREATE UNIQUE INDEX IF NOT EXISTS "SeasonSnapshot_seasonId_profileId_key" ON "SeasonSnapshot"("seasonId", "profileId");

-- 4. Create the "RankedMatch" table safely if it does not exist
CREATE TABLE IF NOT EXISTS "RankedMatch" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "opponentName" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "mmrChange" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankedMatch_pkey" PRIMARY KEY ("id")
);

-- 5. Add foreign key constraints defensively using PL/pgSQL DO blocks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'SeasonSnapshot_seasonId_fkey'
    ) THEN
        ALTER TABLE "SeasonSnapshot" 
        ADD CONSTRAINT "SeasonSnapshot_seasonId_fkey" 
        FOREIGN KEY ("seasonId") REFERENCES "RankedSeason"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'SeasonSnapshot_profileId_fkey'
    ) THEN
        ALTER TABLE "SeasonSnapshot" 
        ADD CONSTRAINT "SeasonSnapshot_profileId_fkey" 
        FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'RankedMatch_profileId_fkey'
    ) THEN
        ALTER TABLE "RankedMatch" 
        ADD CONSTRAINT "RankedMatch_profileId_fkey" 
        FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE;
    END IF;
END $$;
