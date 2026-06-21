export interface RankDetails {
  rank: string      // "Bronze" | "Silver" | "Gold" | "Platinum" | "Diamond" | "Master" | "Grandmaster"
  tier: string      // "I" | "II" | "III" | "" (Master/Grandmaster have no tiers)
  label: string     // e.g., "Gold II"
  minMmr: number
  maxMmr: number
  progress: number  // 0 to 100% inside current tier
  badgeColor: string
  glowColor: string
}

export function getRankDetails(mmr: number): RankDetails {
  // Clamp MMR to positive values
  const val = Math.max(0, mmr)

  if (val < 1000) {
    // Bronze
    const range = 1000
    const progress = Math.min(100, Math.floor((val / range) * 100))
    let tier = "III"
    if (val >= 666) tier = "I"
    else if (val >= 333) tier = "II"

    return {
      rank: "Bronze",
      tier,
      label: `Bronze ${tier}`,
      minMmr: 0,
      maxMmr: 999,
      progress,
      badgeColor: "hsl(25 40% 55%)",
      glowColor: "hsla(25 40% 55% / 0.3)"
    }
  }

  if (val < 1500) {
    // Silver
    const subVal = val - 1000
    const range = 500
    const progress = Math.min(100, Math.floor((subVal / range) * 100))
    let tier = "III"
    if (subVal >= 333) tier = "I"
    else if (subVal >= 166) tier = "II"

    return {
      rank: "Silver",
      tier,
      label: `Silver ${tier}`,
      minMmr: 1000,
      maxMmr: 1499,
      progress,
      badgeColor: "hsl(220 10% 75%)",
      glowColor: "hsla(220 10% 75% / 0.3)"
    }
  }

  if (val < 2000) {
    // Gold
    const subVal = val - 1500
    const range = 500
    const progress = Math.min(100, Math.floor((subVal / range) * 100))
    let tier = "III"
    if (subVal >= 333) tier = "I"
    else if (subVal >= 166) tier = "II"

    return {
      rank: "Gold",
      tier,
      label: `Gold ${tier}`,
      minMmr: 1500,
      maxMmr: 1999,
      progress,
      badgeColor: "hsl(45 100% 55%)",
      glowColor: "hsla(45 100% 55% / 0.4)"
    }
  }

  if (val < 2500) {
    // Platinum
    const subVal = val - 2000
    const range = 500
    const progress = Math.min(100, Math.floor((subVal / range) * 100))
    let tier = "III"
    if (subVal >= 333) tier = "I"
    else if (subVal >= 166) tier = "II"

    return {
      rank: "Platinum",
      tier,
      label: `Platinum ${tier}`,
      minMmr: 2000,
      maxMmr: 2499,
      progress,
      badgeColor: "hsl(180 80% 50%)",
      glowColor: "hsla(180 80% 50% / 0.4)"
    }
  }

  if (val < 3000) {
    // Diamond
    const subVal = val - 2500
    const range = 500
    const progress = Math.min(100, Math.floor((subVal / range) * 100))
    let tier = "III"
    if (subVal >= 333) tier = "I"
    else if (subVal >= 166) tier = "II"

    return {
      rank: "Diamond",
      tier,
      label: `Diamond ${tier}`,
      minMmr: 2500,
      maxMmr: 2999,
      progress,
      badgeColor: "hsl(200 100% 60%)",
      glowColor: "hsla(200 100% 60% / 0.5)"
    }
  }

  if (val < 3500) {
    // Master
    const subVal = val - 3000
    const range = 500
    const progress = Math.min(100, Math.floor((subVal / range) * 100))

    return {
      rank: "Master",
      tier: "",
      label: "Master",
      minMmr: 3000,
      maxMmr: 3499,
      progress,
      badgeColor: "hsl(280 80% 65%)",
      glowColor: "hsla(280 80% 65% / 0.5)"
    }
  }

  // Grandmaster (3500+)
  const subVal = val - 3500
  // No upper limit, progress represents level of grandmaster rating steps
  const progress = Math.min(100, Math.floor((subVal / 1000) * 100))

  return {
    rank: "Grandmaster",
    tier: "",
    label: "Grandmaster",
    minMmr: 3500,
    maxMmr: 99999,
    progress,
    badgeColor: "hsl(0 90% 60%)",
    glowColor: "hsla(0 90% 60% / 0.6)"
  }
}
