-- Safe migration script for Phase 21.5 Hangman Database updates
-- Add hangmanMmr, hangmanWins, hangmanLosses, hangmanStreak to Profile table

ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "hangmanMmr" integer NOT NULL DEFAULT 1000;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "hangmanWins" integer NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "hangmanLosses" integer NOT NULL DEFAULT 0;
ALTER TABLE "Profile" ADD COLUMN IF NOT EXISTS "hangmanStreak" integer NOT NULL DEFAULT 0;
