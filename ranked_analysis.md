# Ranked Competitive System Technical Analysis

This document provides a comprehensive technical analysis of the Ranked Competitive systems in GameHub, detailing data models, MMR calculations, progression structures, seasonal reset mechanics, system limitations, and a roadmap for transitioning to a production-grade matchmaking architecture.

---

## 1. Database Architecture & Schemas

The Ranked competitive system interacts with four primary data models in the Prisma schema:

### A. Profile (Matchmaking & Rank Stats)
Stores the player's current competitive standing.
*   `rankedMmr` (Int, Default: 1000): The player's current Matchmaking Rating.
*   `rankedWins` (Int, Default: 0): Total ranked wins in the current season.
*   `rankedLosses` (Int, Default: 0): Total ranked losses in the current season.
*   `rankedStreak` (Int, Default: 0): Win streak (positive) or loss streak (negative).
*   `rankedPeakRank` (String, Default: "Bronze"): Highest historical tier reached.

### B. RankedMatch (Match Logs)
Maintains a chronological record of matches played by each profile.
*   `id` (String, UUID): Unique match identifier.
*   `profileId` (String): Foreign key to the player's Profile.
*   `opponentName` (String): Name of the opponent (human or simulated bot).
*   `result` (String): Outcome of the match (`win`, `loss`, or `draw`).
*   `mmrChange` (Int): The change in MMR resulting from this match.
*   `playedAt` (DateTime, Default: now()): Timestamp of match completion.

### C. RankedSeason (Seasonal Configurations)
Tracks active and historical competitive seasons.
*   `id` (String): Season key (e.g., `season-genesis`).
*   `name` (String): User-facing name (e.g., `Season 1: Genesis`).
*   `startDate` (DateTime): Start timestamp of the season.
*   `endDate` (DateTime): Expiry timestamp of the season.
*   `isActive` (Boolean): Flag representing if it is the current playable season.
*   `rewards` (Json): Configured rewards for top finishers (e.g., champion title, badge frame).

### D. SeasonSnapshot (Leaderboard Archives)
Stores historical competitive snapshots of top players for the Hall of Fame.
*   `id` (String, UUID): Unique snapshot identifier.
*   `seasonId` (String): Linked RankedSeason identifier.
*   `profileId` (String): Linked Profile identifier.
*   `username` (String): Username snapshot.
*   `mmr` (Int): Final MMR achieved in that season.
*   `rank` (String): Final division label achieved.
*   `wins` (Int): Final win count.
*   `losses` (Int): Final loss count.
*   `winRate` (Int): Percentage win rate snapshot.

---

## 2. MMR Mechanics & Progression Structure

GameHub uses a tiered ranking system mapping MMR ranges to competitive divisions:

```
[ Bronze ] ──> [ Silver ] ──> [ Gold ] ──> [ Platinum ] ──> [ Diamond ] ──> [ Master ] ──> [ Grandmaster ]
  0-999         1000-1499      1500-1999    2000-2499      2500-2999      3000-3499        3500+
```

### Rank & Division Mapping

*   **Bronze**: 0 to 999 MMR (Bronze III: 0-333, Bronze II: 333-666, Bronze I: 666-999)
*   **Silver**: 1000 to 1499 MMR (Silver III: 1000-1166, Silver II: 1166-1333, Silver I: 1333-1499)
*   **Gold**: 1500 to 1999 MMR (Gold III: 1500-1666, Gold II: 1666-1833, Gold I: 1833-1999)
*   **Platinum**: 2000 to 2499 MMR (Platinum III: 2000-2166, Platinum II: 2166-2333, Platinum I: 2333-2499)
*   **Diamond**: 2500 to 2999 MMR (Diamond III: 2500-2666, Diamond II: 2666-2833, Diamond I: 2833-2999)
*   **Master**: 3000 to 3499 MMR (Flat tier, no divisions)
*   **Grandmaster**: 3500+ MMR (Flat tier, progress measures steps of 1000 rating increments)

### MMR Calculation Formula

On match completion, the system adjusts MMR using static deltas modified by streak rewards:
1.  **Win**: Base increase of `+25 MMR`.
    *   **Streak Bonus**: A win streak $\ge 3$ grants a bonus of `+5 MMR` per win in the streak, capped at a maximum bonus of `+15 MMR` (total max `+40 MMR` per win).
    *   $\text{Bonus} = \min(15, (\text{streak} - 2) \times 5)$.
2.  **Loss**: Base decrease of `-18 MMR`.
3.  **Draw**: `0 MMR` change.
4.  **MMR Floor**: Capped at `0` (ratings cannot drop below 0).

---

## 3. Matchmaking & Seasonal Reset Pipeline

### Matchmaking Queue
*   **Trigger**: A player starts matchmaking in the client.
*   **Search Phase**: A client-side interval timer simulates searching for 4 to 7 seconds.
*   **Match Confirmation**: Generates a local simulated bot opponent within $\pm 40$ MMR of the player's current rating.
*   **Lobby Flow**: Prompt displays to accept the match. If accepted, the client loads a local multiplayer instance (e.g., Snake Arena, Tic-Tac-Toe, Four in a Row) against the simulated bot.

### Seasonal Reset Flow (POST `/api/ranked/seasons`)
Admin triggers a seasonal rotation:
1.  **Collect Standings**: Queries the top 10 profiles by `rankedMmr` descending.
2.  **Record Snapshots**: Inserts a `SeasonSnapshot` record for each top player containing their final MMR, rank, wins, and losses, linked to the active season.
3.  **Deactivate Season**: Sets `isActive = false` on the current `RankedSeason`.
4.  **Reset Profiles**: Resets all profiles in the database back to:
    *   `rankedMmr = 1000` (Baseline rating)
    *   `rankedWins = 0` / `rankedLosses = 0`
    *   `rankedStreak = 0`
    *   `rankedPeakRank = 'Bronze'`
5.  **Create Season**: Creates a new `RankedSeason` incremented by 1 (e.g. `Season 2: Genesis`) with a duration of 90 days.

---

## 4. Current System Limitations

1.  **Simulated Opponents**: Matchmaking occurs client-side against local bots rather than pairing real human players over network websockets.
2.  **Static MMR Deltas**: MMR changes are fixed (+25 for win, -18 for loss) rather than calculated using dynamic formulas (such as Elo or Glicko-2) which evaluate the relative skill difference between opponents.
3.  **Hard MMR Reset**: Resetting all active players to exactly 1000 MMR on season transition throws professional players and beginners into the same matchmaking pool. This results in highly unbalanced matchmaking lobbies for the first few weeks of a new season.
4.  **Client-Side Exploits**: Match outcomes are reported by the client post-game, exposing the MMR updating transaction to client-side data tampering.

---

## 5. Redesign & Scalability Roadmap

### Short-Term Refinements

#### Implement Soft MMR Reset
Replace the hard reset with a compression formula to retain skill separation while pulling players closer to the 1000 baseline:
$$\text{MMR}_{\text{new}} = 1000 + (\text{MMR}_{\text{old}} - 1000) \times 0.5$$

#### Adopt standard Elo Rating Formula
Calculate the expected outcome $E_A$ and update ratings dynamically based on the opponent's relative rating:
$$E_A = \frac{1}{1 + 10^{(\text{MMR}_B - \text{MMR}_A)/400}}$$
$$\text{MMR}_{\text{new}} = \text{MMR}_A + K \times (S_A - E_A)$$
*   $K$: Rating adjustment weight factor (e.g., 32).
*   $S_A$: Actual outcome (1 for Win, 0 for Loss, 0.5 for Draw).

### Long-Term Architecture

#### Socket-Based Matchmaking Queue
1.  **Matchmaking Server**: Maintain a Redis-backed queue of online players searching for ranked matches.
2.  **Expanding Matchmaking Bands**: Match players using search windows that expand gradually over time:
    *   $t = 0$: Search range is $\pm 50$ MMR.
    *   $t = 5s$: Search range expands to $\pm 120$ MMR.
    *   $t = 15s$: Search range expands to $\pm 250$ MMR.
3.  **Dedicated Game Lobbies**: When a match is found, instantiate a stateful WebSocket multiplayer game lobby on the server. The server computes match states and determines outcomes, mitigating client-side tampering.
