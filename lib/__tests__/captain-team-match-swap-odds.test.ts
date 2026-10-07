import { describe, expect, it } from 'vitest'
import { suggestRecentLineupSwaps, resolveCurrentRecentLineupSwap, type RecentSwapGuards } from '../captain-recent-lineup-swaps'
import type { CaptainLineupSlot } from '../captain-lineup-format'
import type { OpponentSeasonScout } from '../captain-opponent-season-scout'

const slots: CaptainLineupSlot[] = Array.from({ length: 5 }, (_, index) => ({ id: `s${index}`, label: `Singles ${index + 1}`, slotType: 'singles', players: [{ playerId: `u${index}`, playerName: `Player ${index}` }] }))
function scout(): OpponentSeasonScout {
  return { ready: true, lines: [], fixtures: [1, 2, 3].map((week) => ({ key: `w${week}`, date: `2026-09-0${week}`, opponent: 'Other team', expectedCourts: 5, wins: 5, losses: 0, unknown: 0,
    courts: slots.map((slot, index) => ({ key: slot.id, label: slot.label, slotIndex: index, slotType: 'singles', playerIds: [`o${index}`], playerNames: ['Opponent'], result: 'W', score: '6-4 6-3', scoreOriented: true, gamesFor: 12, gamesAgainst: 7, defaulted: false, needsReview: false })) })) }
}
const guards: RecentSwapGuards = { lockedSlotIds: new Set(['s2', 's3', 's4']), lockedPlayerIds: new Set(), excludedSlotIds: new Set(), eligible: () => true }
function project(before: number[], after: number[]) {
  return (team: CaptainLineupSlot, _opponent: CaptainLineupSlot, index: number) => team.players[0]?.playerId === `u${index}` ? before[index] : after[index]
}

describe('team-match odds in recent lineup swaps', () => {
  it('rejects higher expected court wins that reduce the chance of winning three of five courts', () => {
    // Two other wins mean only one of the traded courts is needed: 91% falls to 84%.
    const result = suggestRecentLineupSwaps(scout(), slots, project([0.9, 0.1, 1, 1, 0], [0.6, 0.6, 1, 1, 0]), guards)
    expect(result).toEqual([])
  })
  it('accepts a lower expected court total that improves the full team winning path', () => {
    // One other win means both traded courts are needed: .95*.30 vs .60*.60.
    const result = suggestRecentLineupSwaps(scout(), slots, project([0.95, 0.3, 1, 0, 0], [0.6, 0.6, 1, 0, 0]), guards)[0]
    expect(result.ranking).toBe('team-match')
    expect(result.teamBeforeMean).toBeCloseTo(0.285)
    expect(result.teamAfterMean).toBeCloseTo(0.36)
    expect(result.beforeMean).toBeCloseTo(1.25)
    expect(result.afterMean).toBeCloseTo(1.2)
    expect(result).toMatchObject({ neededWins: 3, courtCount: 5, teamWeeks: 3 })
  })
  it('ranks by match-win improvement rather than the larger expected-court gain', () => {
    const allowed = { ...guards, lockedSlotIds: new Set(['s2']), eligible: (from: CaptainLineupSlot, to: CaptainLineupSlot) => ([from.id, to.id].every((id) => ['s0', 's1'].includes(id)) || [from.id, to.id].every((id) => ['s3', 's4'].includes(id))) }
    const before = [0.95, 0.3, 1, 0, 0]
    const after = [0.6, 0.6, 1, 0.04, 0.04]
    const result = suggestRecentLineupSwaps(scout(), slots, project(before, after), allowed)
    expect(result.map((swap) => swap.sourceId)).toEqual(['s0', 's3'])
    expect(result[0].rankingGain).toBeGreaterThan(result[1].rankingGain)
    expect(result[0].afterMean - result[0].beforeMean).toBeLessThan(result[1].afterMean - result[1].beforeMean)
  })
  it('does not fill an unknown unchanged court with a 50% estimate', () => {
    const source = scout()
    source.fixtures.forEach((fixture) => { fixture.courts = fixture.courts.filter((court) => court.slotIndex !== 4) })
    const result = suggestRecentLineupSwaps(source, slots, project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0]), guards)[0]
    expect(result).toMatchObject({ ranking: 'court-wins', teamWeeks: 0, teamBeforeMean: null, teamAfterMean: null })
    expect(result.weeks.every((week) => week.teamBefore === null && week.teamAfter === null)).toBe(true)
  })
  it('uses explicit current-match defaults and keeps those courts out of swap candidates', () => {
    const source = scout()
    source.fixtures.forEach((fixture) => { fixture.courts = fixture.courts.filter((court) => court.slotIndex !== 4) })
    const draft = slots.map((slot, index) => index === 4 ? { ...slot, players: [{ playerId: '', playerName: '' }] } : slot)
    const estimate = project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0])
    const settings = { supported: true, expectedCourts: 5, knownDefaults: [{ label: 'singles 5', awardedTo: 'opponent' as const }] }
    const result = suggestRecentLineupSwaps(source, draft, estimate, { ...guards, teamScoring: settings })[0]
    expect(result.teamBeforeMean).toBeCloseTo(0.16)
    expect(result.teamAfterMean).toBeCloseTo(0.33)
    expect(result.ranking).toBe('team-match')
    // Awarding that default to us instead makes the new one-court path worse.
    expect(suggestRecentLineupSwaps(source, draft, estimate, { ...guards, teamScoring: { ...settings, knownDefaults: [{ label: 'Singles 5', awardedTo: 'team' }] } })).toEqual([])
  })
  it('does not carry a historical default forward to the upcoming match', () => {
    const source = scout()
    source.fixtures.forEach((fixture) => { fixture.courts[4].defaulted = true })
    const result = suggestRecentLineupSwaps(source, slots, project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0]), guards)[0]
    expect(result.ranking).toBe('court-wins')
    expect(result.teamWeeks).toBe(0)
  })
  it('reports only complete weeks and requires two of them to rank by team odds', () => {
    const source = scout()
    source.fixtures[0].courts[4].needsReview = true
    const estimate = project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0])
    expect(suggestRecentLineupSwaps(source, slots, estimate, guards)[0]).toMatchObject({ ranking: 'team-match', teamWeeks: 2, fixtureCount: 3 })
    source.fixtures[1].courts[4].needsReview = true
    expect(suggestRecentLineupSwaps(source, slots, estimate, guards)[0]).toMatchObject({ ranking: 'court-wins', teamWeeks: 1 })
  })
  it('rejects a court-only recommendation contradicted by its single complete team week', () => {
    const source = scout()
    source.fixtures[0].courts[4].needsReview = true
    source.fixtures[1].courts[4].needsReview = true
    expect(suggestRecentLineupSwaps(source, slots, project([0.9, 0.1, 1, 1, 0], [0.6, 0.6, 1, 1, 0]), guards)).toEqual([])
  })
  it('withholds majority odds for unsupported or mismatched formats', () => {
    const estimate = project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0])
    for (const teamScoring of [{ supported: false, expectedCourts: 5 }, { supported: true, expectedCourts: 3 }]) {
      expect(suggestRecentLineupSwaps(scout(), slots, estimate, { ...guards, teamScoring })[0]).toMatchObject({ ranking: 'court-wins', teamWeeks: 0 })
    }
  })
  it('invalidates a suggested swap when an unchanged court rating changes the team odds', () => {
    const source = scout()
    const old = suggestRecentLineupSwaps(source, slots, project([0.2, 0.8, 1, 0, 0], [0.55, 0.6, 1, 0, 0]), guards)
    const changed = suggestRecentLineupSwaps(source, slots, project([0.2, 0.8, 0.8, 0, 0], [0.55, 0.6, 0.8, 0, 0]), guards)
    expect(resolveCurrentRecentLineupSwap(old[0], slots, changed)).toBeNull()
  })
})
