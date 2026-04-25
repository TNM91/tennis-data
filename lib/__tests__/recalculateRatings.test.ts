import { describe, it, expect } from 'vitest'
import {
  parseScoreMetrics,
  getRecencyWeight,
  getProvisionalkMultiplier,
  applyInactivityDecay,
  getNextRatingThreshold,
  getPreviousRatingThreshold,
  getRatingProgressToNextLevel,
  projectHeadToHeadWinProbability,
  projectDoublesTeamWinProbability,
  type WorkingPlayer,
} from '../recalculateRatings'

function makePlayer(overrides: Partial<WorkingPlayer> = {}): WorkingPlayer {
  return {
    id: 'test',
    name: 'Test Player',
    singlesBase: 3.5,
    singlesDynamic: 3.5,
    singlesUstaDynamic: 3.5,
    doublesBase: 3.5,
    doublesDynamic: 3.5,
    doublesUstaDynamic: 3.5,
    overallBase: 3.5,
    overallDynamic: 3.5,
    overallUstaDynamic: 3.5,
    matchesProcessed: 50,
    lastMatchDate: null,
    ...overrides,
  }
}

// ─── parseScoreMetrics ────────────────────────────────────────────────────────

describe('parseScoreMetrics', () => {
  it('returns fallback for null score', () => {
    const m = parseScoreMetrics(null, 'A')
    expect(m.parsed).toBe(false)
    expect(m.multiplier).toBe(1)
  })

  it('returns fallback for W/O', () => {
    const m = parseScoreMetrics('W/O', 'A')
    expect(m.parsed).toBe(false)
  })

  it('parses completed sets before a retirement, ignoring the RET token', () => {
    // "6-3 RET" → normalizer strips RET → "6-3" parses as one completed set
    const m = parseScoreMetrics('6-3 RET', 'A')
    expect(m.parsed).toBe(true)
    expect(m.sets).toHaveLength(1)
  })

  it('parses a dominant straight-sets win', () => {
    const m = parseScoreMetrics('6-0, 6-0', 'A')
    expect(m.parsed).toBe(true)
    expect(m.sets).toHaveLength(2)
    expect(m.bagelSets).toBe(2)
    expect(m.straightSetsWin).toBe(true)
    expect(m.decidingSetPlayed).toBe(false)
    expect(m.tiebreakSets).toBe(0)
    expect(m.dominanceRatio).toBe(1)
    expect(m.multiplier).toBeGreaterThan(1.5)
  })

  it('parses a standard straight-sets win', () => {
    const m = parseScoreMetrics('6-4, 6-3', 'A')
    expect(m.parsed).toBe(true)
    expect(m.straightSetsWin).toBe(true)
    expect(m.tiebreakSets).toBe(0)
    expect(m.gamesWonByWinner).toBe(12)
    expect(m.gamesWonByLoser).toBe(7)
  })

  it('7-5 is NOT counted as a tiebreak set', () => {
    const m = parseScoreMetrics('7-5, 6-3', 'A')
    expect(m.tiebreakSets).toBe(0)
    expect(m.straightSetsWin).toBe(true)
  })

  it('7-6 IS counted as a tiebreak set', () => {
    const m = parseScoreMetrics('7-6, 6-3', 'A')
    expect(m.tiebreakSets).toBe(1)
  })

  it('tiebreak sets are not double-counted in closeSets', () => {
    const m = parseScoreMetrics('7-6, 7-6', 'A')
    expect(m.tiebreakSets).toBe(2)
    expect(m.closeSets).toBe(0)
  })

  it('7-5 is counted in closeSets (not a tiebreak)', () => {
    const m = parseScoreMetrics('7-5, 6-3', 'A')
    expect(m.tiebreakSets).toBe(0)
    expect(m.closeSets).toBe(1)
  })

  it('parses a three-set match', () => {
    const m = parseScoreMetrics('6-4, 4-6, 6-3', 'A')
    expect(m.sets).toHaveLength(3)
    expect(m.decidingSetPlayed).toBe(true)
    expect(m.straightSetsWin).toBe(false)
  })

  it('super tiebreak (10-8) is ignored, only regular sets counted', () => {
    const m = parseScoreMetrics('6-4, 4-6, 10-8', 'A')
    expect(m.sets).toHaveLength(2)
    expect(m.totalGames).toBe(20)
  })

  it('super tiebreak stored with brackets is stripped by normalizer', () => {
    const m = parseScoreMetrics('6-4, 4-6, (10-8)', 'A')
    expect(m.sets).toHaveLength(2)
  })

  it('breadstick gives correct bonus', () => {
    const m = parseScoreMetrics('6-1, 6-0', 'A')
    expect(m.breadstickSets).toBe(1)
    expect(m.bagelSets).toBe(1)
  })

  it('multiplier is higher for a dominant win than a close win', () => {
    const dominant = parseScoreMetrics('6-0, 6-0', 'A')
    const close = parseScoreMetrics('7-6, 7-6', 'A')
    expect(dominant.multiplier).toBeGreaterThan(close.multiplier)
  })

  it('three-set win has lower multiplier than straight-set equivalent', () => {
    const straight = parseScoreMetrics('6-3, 6-3', 'A')
    const threeSet = parseScoreMetrics('6-3, 3-6, 6-3', 'A')
    expect(straight.multiplier).toBeGreaterThan(threeSet.multiplier)
  })
})

// ─── getRecencyWeight ─────────────────────────────────────────────────────────

describe('getRecencyWeight', () => {
  it('returns max weight for the most recent match (same date)', () => {
    const w = getRecencyWeight('2026-04-24', '2026-04-24')
    expect(w).toBeCloseTo(1.12, 2)
  })

  it('returns min weight for a match 730+ days old', () => {
    const w = getRecencyWeight('2024-04-24', '2026-04-24')
    expect(w).toBeCloseTo(0.88, 2)
  })

  it('returns ~1.0 for a match 365 days ago', () => {
    const w = getRecencyWeight('2025-04-24', '2026-04-24')
    expect(w).toBeCloseTo(1.0, 1)
  })

  it('clamps weight to 1.12 when match date exceeds most recent', () => {
    const w = getRecencyWeight('2026-05-01', '2026-04-24')
    expect(w).toBeCloseTo(1.12, 2)
  })
})

// ─── getProvisionalkMultiplier ────────────────────────────────────────────────

describe('getProvisionalkMultiplier', () => {
  it('returns 2.0 for a new player with 0 matches', () => {
    expect(getProvisionalkMultiplier(0)).toBe(2.0)
  })

  it('returns 2.0 up to the 9th match', () => {
    expect(getProvisionalkMultiplier(9)).toBe(2.0)
  })

  it('drops to 1.5 at 10 matches', () => {
    expect(getProvisionalkMultiplier(10)).toBe(1.5)
  })

  it('holds 1.5 through 19 matches', () => {
    expect(getProvisionalkMultiplier(19)).toBe(1.5)
  })

  it('drops to 1.2 at 20 matches', () => {
    expect(getProvisionalkMultiplier(20)).toBe(1.2)
  })

  it('holds 1.2 through 29 matches', () => {
    expect(getProvisionalkMultiplier(29)).toBe(1.2)
  })

  it('drops to 1.0 at 30 matches', () => {
    expect(getProvisionalkMultiplier(30)).toBe(1.0)
  })

  it('stays at 1.0 for veterans', () => {
    expect(getProvisionalkMultiplier(200)).toBe(1.0)
  })
})

// ─── applyInactivityDecay ────────────────────────────────────────────────────

describe('applyInactivityDecay', () => {
  const NOW = new Date('2026-04-24').getTime()

  it('does not decay an active player (last match 30 days ago)', () => {
    const player = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2026-03-25' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(4.5)
  })

  it('does not decay at exactly the 90-day threshold', () => {
    const player = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2026-01-24' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(4.5)
  })

  it('decays a player inactive for 1 year', () => {
    const player = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2025-04-24' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBeLessThan(4.5)
    expect(player.singlesDynamic).toBeGreaterThan(3.5)
  })

  it('decays all six dynamic ratings together', () => {
    const player = makePlayer({
      singlesDynamic: 4.5,
      doublesDynamic: 4.0,
      overallDynamic: 4.2,
      singlesUstaDynamic: 4.5,
      doublesUstaDynamic: 4.0,
      overallUstaDynamic: 4.2,
      lastMatchDate: '2025-04-24',
    })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBeLessThan(4.5)
    expect(player.doublesDynamic).toBeLessThan(4.0)
    expect(player.overallDynamic).toBeLessThan(4.2)
    expect(player.singlesUstaDynamic).toBeLessThan(4.5)
    expect(player.doublesUstaDynamic).toBeLessThan(4.0)
    expect(player.overallUstaDynamic).toBeLessThan(4.2)
  })

  it('regresses toward 3.5 (not toward 0)', () => {
    const player = makePlayer({ singlesDynamic: 2.0, lastMatchDate: '2023-01-01' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBeGreaterThan(2.0)
    expect(player.singlesDynamic).toBeLessThan(3.5)
  })

  it('skips players with null lastMatchDate', () => {
    const player = makePlayer({ singlesDynamic: 4.5, lastMatchDate: null })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(4.5)
  })

  it('skips players with 0 matchesProcessed', () => {
    const player = makePlayer({ singlesDynamic: 4.5, matchesProcessed: 0, lastMatchDate: '2023-01-01' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(4.5)
  })

  it('longer inactivity produces more decay', () => {
    const p1 = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2025-01-01' })
    const p2 = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2024-01-01' })
    applyInactivityDecay([p1].values(), NOW)
    applyInactivityDecay([p2].values(), NOW)
    expect(p2.singlesDynamic).toBeLessThan(p1.singlesDynamic)
  })
})

// ─── Rating band helpers ──────────────────────────────────────────────────────

describe('getNextRatingThreshold', () => {
  it('returns the next band above 4.2', () => {
    expect(getNextRatingThreshold(4.2)).toBe(4.5)
  })

  it('returns the next band above an exact band value', () => {
    expect(getNextRatingThreshold(4.0)).toBe(4.5)
  })

  it('returns MAX_RATING when already at top', () => {
    expect(getNextRatingThreshold(7.0)).toBe(7.0)
  })

  it('returns 2.0 for a 1.5 player', () => {
    expect(getNextRatingThreshold(1.5)).toBe(2.0)
  })
})

describe('getPreviousRatingThreshold', () => {
  it('returns the band below 4.2', () => {
    expect(getPreviousRatingThreshold(4.2)).toBe(4.0)
  })

  it('returns the band below an exact band value', () => {
    expect(getPreviousRatingThreshold(4.0)).toBe(3.5)
  })

  it('returns MIN_RATING when at the bottom', () => {
    expect(getPreviousRatingThreshold(1.5)).toBe(1.5)
  })
})

describe('getRatingProgressToNextLevel', () => {
  it('calculates progress correctly at 4.2 toward 4.5', () => {
    const p = getRatingProgressToNextLevel(4.2)
    expect(p.current).toBe(4.2)
    expect(p.previous).toBe(4.0)
    expect(p.next).toBe(4.5)
    expect(p.bandWidth).toBe(0.5)
    expect(p.gainedWithinBand).toBeCloseTo(0.2, 2)
    expect(p.progressPct).toBeCloseTo(40, 0)
  })

  it('shows 0% progress at MIN_RATING (1.5) where previous === current', () => {
    // At 1.5, getPreviousRatingThreshold returns 1.5 (the floor), so gainedWithinBand = 0
    const p = getRatingProgressToNextLevel(1.5)
    expect(p.progressPct).toBe(0)
  })
})

// ─── Win probability ──────────────────────────────────────────────────────────

describe('projectHeadToHeadWinProbability', () => {
  it('returns 50 for equal ratings', () => {
    expect(projectHeadToHeadWinProbability(4.0, 4.0)).toBe(50)
  })

  it('higher-rated player has greater than 50% chance', () => {
    expect(projectHeadToHeadWinProbability(4.5, 3.5)).toBeGreaterThan(50)
  })

  it('lower-rated player has less than 50% chance', () => {
    expect(projectHeadToHeadWinProbability(3.5, 4.5)).toBeLessThan(50)
  })

  it('probabilities from both perspectives sum to ~100', () => {
    const a = projectHeadToHeadWinProbability(4.2, 3.8)
    const b = projectHeadToHeadWinProbability(3.8, 4.2)
    expect(a + b).toBeCloseTo(100, 0)
  })
})

describe('projectDoublesTeamWinProbability', () => {
  it('returns 50 for equal teams', () => {
    expect(projectDoublesTeamWinProbability([4.0, 4.0], [4.0, 4.0])).toBe(50)
  })

  it('stronger team has higher win probability', () => {
    expect(projectDoublesTeamWinProbability([4.5, 4.5], [3.5, 3.5])).toBeGreaterThan(50)
  })
})
