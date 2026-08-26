import { describe, it, expect } from 'vitest'
import {
  recalculateDynamicRatings,
  applyVerifiedBaselineGuard,
  applyDoublesPartnerBurdenGuard,
  parseScoreMetrics,
  competitionAdjustedRating,
  matchCompetitionRatingFloor,
  getScoreAwarePerformance,
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
import type { SupabaseClient } from '@supabase/supabase-js'

function makePlayer(overrides: Partial<WorkingPlayer> = {}): WorkingPlayer {
  return {
    id: 'test',
    name: 'Test Player',
    hasVerifiedBaseline: false,
    singlesBase: 3.5,
    singlesDynamic: 3.5,
    singlesUstaDynamic: 3.5,
    doublesBase: 3.5,
    doublesDynamic: 3.5,
    doublesUstaDynamic: 3.5,
    overallBase: 3.5,
    overallDynamic: 3.5,
    overallUstaDynamic: 3.5,
    singlesMatchesProcessed: 0,
    doublesMatchesProcessed: 0,
    overallMatchesProcessed: 0,
    matchesProcessed: 50,
    lastMatchDate: null,
    ...overrides,
  }
}

describe('recalculateDynamicRatings pagination', () => {
  it('reads every page of player and participant rows in a dry run', async () => {
    const calls: Record<string, Array<[number, number]>> = {
      players: [],
      matches: [],
      match_players: [],
    }
    const rows = {
      players: Array.from({ length: 1001 }, (_, index) => ({
        id: `player-${index}`,
        name: `Player ${index}`,
        singles_rating: 3.5,
        singles_dynamic_rating: 3.5,
        doubles_rating: 3.5,
        doubles_dynamic_rating: 3.5,
        overall_rating: 3.5,
        overall_dynamic_rating: 3.5,
      })),
      matches: [],
      match_players: Array.from({ length: 1001 }, (_, index) => ({
        match_id: `match-${index}`,
        player_id: `player-${index}`,
        side: 'A',
        seat: 1,
      })),
    }

    const client = {
      from(table: keyof typeof rows) {
        const builder = {
          select: () => builder,
          not: () => builder,
          eq: () => builder,
          order: () => builder,
          range: (from: number, to: number) => {
            calls[table].push([from, to])
            return Promise.resolve({ data: rows[table].slice(from, to + 1), error: null })
          },
        }
        return builder
      },
    } as unknown as SupabaseClient

    const result = await recalculateDynamicRatings(undefined, client, { dryRun: true })

    expect(result.dryRun).toBe(true)
    expect(result.playerCount).toBe(1001)
    expect(calls.players).toEqual([[0, 999], [1000, 1999]])
    expect(calls.match_players).toEqual([[0, 999], [1000, 1999]])
  })
})

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

  it('parses whitespace-separated set scores from TennisRecord', () => {
    const m = parseScoreMetrics('6-4 6-4', 'A')
    expect(m.parsed).toBe(true)
    expect(m.sets).toHaveLength(2)
    expect(m.totalGamesA).toBe(12)
    expect(m.totalGamesB).toBe(8)
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

  it('keeps a 1-0 deciding match tiebreak out of game-share scoring', () => {
    const m = parseScoreMetrics('7-6 5-7 1-0', 'B')
    expect(m.sets).toHaveLength(3)
    expect(m.decidingSetPlayed).toBe(true)
    expect(m.totalGamesA).toBe(12)
    expect(m.totalGamesB).toBe(13)
    expect(m.gamesWonByWinner).toBe(13)
    expect(m.gamesWonByLoser).toBe(12)
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

describe('competition rating context', () => {
  it('uses the stated flight only to protect an unverified default from depressing a court expectation', () => {
    const match = { league_name: '2026 Tri-Level 18+ Missouri Valley M 4.5', flight: '4.5' }
    expect(matchCompetitionRatingFloor(match)).toBe(4.5)
    expect(competitionAdjustedRating(makePlayer({ hasVerifiedBaseline: false }), 3.5, match)).toBe(4.5)
    expect(competitionAdjustedRating(makePlayer({ hasVerifiedBaseline: true }), 4.1, match)).toBe(4.1)
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

  it('smoothly decays by the 9th match', () => {
    expect(getProvisionalkMultiplier(9)).toBe(1.7)
  })

  it('continues smooth decay at 10 matches', () => {
    expect(getProvisionalkMultiplier(10)).toBe(1.667)
  })

  it('continues smooth decay through 19 matches', () => {
    expect(getProvisionalkMultiplier(19)).toBe(1.367)
  })

  it('continues smooth decay at 20 matches', () => {
    expect(getProvisionalkMultiplier(20)).toBe(1.333)
  })

  it('approaches veteran weight by 29 matches', () => {
    expect(getProvisionalkMultiplier(29)).toBe(1.033)
  })

  it('drops to 1.0 at 30 matches', () => {
    expect(getProvisionalkMultiplier(30)).toBe(1.0)
  })

  it('stays at 1.0 for veterans', () => {
    expect(getProvisionalkMultiplier(200)).toBe(1.0)
  })

  it('uses a conservative evidence multiplier for a verified NTRP baseline', () => {
    expect(getProvisionalkMultiplier(0, true)).toBe(0.55)
    expect(getProvisionalkMultiplier(15, true)).toBeCloseTo(0.775, 3)
    expect(getProvisionalkMultiplier(30, true)).toBe(1.0)
  })
})

describe('verified NTRP baseline calibration', () => {
  it('does not move a verified player below their official baseline on a small sample', () => {
    expect(applyVerifiedBaselineGuard(3.7, 4.0, 0, true)).toBe(4.0)
    expect(applyVerifiedBaselineGuard(3.7, 4.0, 11, true)).toBe(4.0)
  })

  it('allows a measured downward signal only after sustained evidence', () => {
    expect(applyVerifiedBaselineGuard(3.7, 4.0, 21, true)).toBeGreaterThanOrEqual(3.96)
    expect(applyVerifiedBaselineGuard(3.7, 4.0, 60, true)).toBe(3.8)
  })

  it('does not constrain an unverified baseline', () => {
    expect(applyVerifiedBaselineGuard(3.7, 4.0, 0, false)).toBe(3.7)
  })

  it('keeps a verified player at their baseline after an isolated lopsided loss', async () => {
    const rows = {
      players: [
        { id: 'a', name: 'Verified player', rating_source: 'verified', singles_rating: 4, singles_dynamic_rating: 4, doubles_rating: 4, doubles_dynamic_rating: 4, overall_rating: 4, overall_dynamic_rating: 4 },
        { id: 'b', name: 'Opponent', rating_source: 'verified', singles_rating: 4, singles_dynamic_rating: 4, doubles_rating: 4, doubles_dynamic_rating: 4, overall_rating: 4, overall_dynamic_rating: 4 },
      ],
      matches: [{ id: 'match-1', match_date: '2026-08-01', match_type: 'singles', score: '0-6, 0-6', winner_side: 'B', match_source: 'usta', rating_eligible: true, created_at: '2026-08-01T00:00:00Z' }],
      match_players: [
        { match_id: 'match-1', player_id: 'a', side: 'A', seat: 1 },
        { match_id: 'match-1', player_id: 'b', side: 'B', seat: 1 },
      ],
    }
    const client = {
      from(table: keyof typeof rows) {
        const builder = {
          select: () => builder,
          not: () => builder,
          eq: () => builder,
          order: () => builder,
          range: (from: number, to: number) => Promise.resolve({ data: rows[table].slice(from, to + 1), error: null }),
        }
        return builder
      },
    } as unknown as SupabaseClient

    const result = await recalculateDynamicRatings(undefined, client, { dryRun: true })
    const player = result.players.find((candidate) => candidate.id === 'a')

    expect(player?.overallDynamic).toBe(4)
    expect(player?.singlesDynamic).toBe(4)
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

  it('does not change a player inactive for 1 year', () => {
    const player = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2025-04-24' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(4.5)
  })

  it('preserves all six dynamic ratings during inactivity', () => {
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
    expect(player.singlesDynamic).toBe(4.5)
    expect(player.doublesDynamic).toBe(4.0)
    expect(player.overallDynamic).toBe(4.2)
    expect(player.singlesUstaDynamic).toBe(4.5)
    expect(player.doublesUstaDynamic).toBe(4.0)
    expect(player.overallUstaDynamic).toBe(4.2)
  })

  it('does not regress lower-rated players upward toward 3.5', () => {
    const player = makePlayer({ singlesDynamic: 2.0, lastMatchDate: '2023-01-01' })
    applyInactivityDecay([player].values(), NOW)
    expect(player.singlesDynamic).toBe(2.0)
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

  it('does not vary ratings by inactivity duration', () => {
    const p1 = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2025-01-01' })
    const p2 = makePlayer({ singlesDynamic: 4.5, lastMatchDate: '2024-01-01' })
    applyInactivityDecay([p1].values(), NOW)
    applyInactivityDecay([p2].values(), NOW)
    expect(p2.singlesDynamic).toBe(p1.singlesDynamic)
  })
})

describe('getScoreAwarePerformance', () => {
  it('keeps a close contest between equal ratings near-neutral', () => {
    const tight = parseScoreMetrics('7-6, 7-6', 'A')
    const dominant = parseScoreMetrics('6-0, 6-0', 'A')
    expect(getScoreAwarePerformance(tight, 'A', 4.0, 4.0).a).toBeCloseTo(1 / 26, 3)
    expect(getScoreAwarePerformance(dominant, 'A', 4.0, 4.0).a).toBeCloseTo(0.5, 3)
  })

  it('allows a close loss to a much stronger player to be positive', () => {
    const closeLoss = parseScoreMetrics('4-6 4-6', 'B')
    const performance = getScoreAwarePerformance(closeLoss, 'B', 4.1, 4.9)
    expect(performance.a).toBeGreaterThan(0)
    expect(performance.b).toBeLessThan(0)
  })

  it('credits a close doubles loss when a weaker partner makes the pair an underdog', () => {
    // A 4.0 player paired with a 3.0 player faces two 4.0 players. The pair
    // is evaluated at 3.5 against 4.0, so a 4-6, 4-6 loss outperforms the
    // team expectation instead of being treated as a penalty.
    const closeDoublesLoss = parseScoreMetrics('4-6 4-6', 'B')
    const performance = getScoreAwarePerformance(closeDoublesLoss, 'B', 3.5, 4.0)
    expect(performance.a).toBeGreaterThan(0)
    expect(performance.b).toBeLessThan(0)
  })

  it('protects the stronger partner from a close doubles-loss penalty against a comparable pair', () => {
    const closeLoss = parseScoreMetrics('4-6 4-6', 'B')
    const rawTeamPerformance = getScoreAwarePerformance(closeLoss, 'B', 4.25, 4.5).a

    expect(rawTeamPerformance).toBeLessThan(0)
    expect(applyDoublesPartnerBurdenGuard(rawTeamPerformance, 4.5, [4.0], 4.5, closeLoss)).toBe(0)
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
