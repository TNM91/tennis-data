import { describe, expect, it } from 'vitest'
import type { CaptainLineupSlot } from '../captain-lineup-format'
import type { OpponentScoutCourt, OpponentScoutFixture, OpponentSeasonScout } from '../captain-opponent-season-scout'
import { projectOpponentSeasonLineup } from '../captain-opponent-season-projection'

const pool = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, name: id.toUpperCase() }))
const doubles: CaptainLineupSlot = { id: 'd1', label: 'Doubles 1', slotType: 'doubles', players: [{ playerId: '', playerName: '' }, { playerId: '', playerName: '' }] }
function court(ids: string[], slotIndex = 0, overrides: Partial<OpponentScoutCourt> = {}): OpponentScoutCourt {
  return { key: `slot:${slotIndex}`, label: 'Court', slotIndex, slotType: ids.length === 1 ? 'singles' : 'doubles', playerIds: ids, playerNames: ids.map((id) => id.toUpperCase()), result: 'W', score: '6-3 6-4', scoreOriented: true, gamesFor: 12, gamesAgainst: 7, defaulted: false, needsReview: false, ...overrides }
}
function fixture(date: string, courts: OpponentScoutCourt[]): OpponentScoutFixture {
  return { key: date, date, opponent: 'Other team', courts, wins: 0, losses: 0, unknown: 0, expectedCourts: 5 }
}
function scout(fixtures: OpponentScoutFixture[]): OpponentSeasonScout { return { ready: true, fixtures, lines: [] } }
const project = (fixtures: OpponentScoutFixture[], slots = [doubles]) => projectOpponentSeasonLineup(scout(fixtures), slots, pool, () => true)

describe('recent-season opponent drafts', () => {
  it('favors repeated combinations over a latest one-off, regardless of wins', () => {
    const plan = project([fixture('2026-10-03', [court(['c', 'd'])]), fixture('2026-09-26', [court(['a', 'b'], 0, { result: 'L' })]), fixture('2026-09-19', [court(['b', 'a'], 0, { result: null })])])
    expect(plan.filled).toBe(2)
    expect(plan.courts[0].selected).toMatchObject({ playerIds: ['a', 'b'], appearances: 2, wins: 0, losses: 1, unknown: 1, latestDate: '2026-09-26' })
    expect(plan.courts[0].candidates).toHaveLength(2)
  })
  it('breaks equal appearance counts by the latest appearance', () => {
    expect(project([fixture('2026-09-01', [court(['a', 'b'])]), fixture('2026-10-01', [court(['c', 'd'])])]).courts[0].selected?.playerIds).toEqual(['c', 'd'])
  })
  it('uses only the last four scoped fixtures and does not mutate inputs', () => {
    const fixtures = Array.from({ length: 5 }, (_, index) => fixture(`2026-09-0${index + 1}`, [court(index ? ['c', 'd'] : ['a', 'b'])]))
    const original = JSON.stringify({ fixtures, doubles })
    const plan = project(fixtures)
    expect(plan.fixtureCount).toBe(4)
    expect(plan.courts[0].candidates).toHaveLength(1)
    expect(plan.courts[0].selected?.appearances).toBe(4)
    expect(JSON.stringify({ fixtures, doubles })).toBe(original)
  })
  it.each([
    { needsReview: true }, { defaulted: true }, { slotType: 'singles' as const },
    { playerIds: ['a'] }, { playerIds: ['a', 'a'] }, { playerIds: ['a', ''] }, { slotIndex: null }, { result: null, score: '' },
  ])('excludes unusable recorded courts %j', (overrides) => {
    expect(project([fixture('2026-10-01', [court(['a', 'b'], 0, overrides)])]).filled).toBe(0)
  })
  it('keeps pairs together when a player is absent from the current roster', () => {
    const plan = projectOpponentSeasonLineup(scout([fixture('2026-10-01', [court(['a', 'b'])])]), [doubles], pool.filter((player) => player.id !== 'b'), () => true)
    expect(plan.filled).toBe(0)
    expect(plan.slots[0].players.every((player) => !player.playerId)).toBe(true)
    expect(plan.courts[0].candidates).toHaveLength(1)
  })
  it('checks full pair eligibility and can fall back to an eligible recorded pair', () => {
    const plan = projectOpponentSeasonLineup(scout([fixture('2026-10-01', [court(['a', 'b'])]), fixture('2026-09-24', [court(['c', 'd'])])]), [doubles], pool, (players) => !players.some((player) => player.id === 'a'))
    expect(plan.courts[0].selected?.playerIds).toEqual(['c', 'd'])
  })
  it('fills a compatible partner while preserving an existing player', () => {
    const slot = { ...doubles, players: [{ playerId: 'b', playerName: 'My label' }, { playerId: '', playerName: '' }] }
    const plan = project([fixture('2026-10-01', [court(['a', 'b'])])], [slot])
    expect(plan.filled).toBe(1)
    expect(plan.slots[0].players).toEqual([{ playerId: 'b', playerName: 'My label' }, { playerId: 'a', playerName: 'A' }])
    expect(plan.courts[0].preserved).toBe(true)
    expect(projectOpponentSeasonLineup(scout([fixture('2026-10-01', [court(['a', 'b'])])]), plan.slots, pool, () => true).filled).toBe(0)
  })
  it('preserves manual names and leaves incompatible pair choices alone', () => {
    for (const player of [{ playerId: '', playerName: 'Manual player' }, { playerId: 'e', playerName: 'E' }]) {
      const slot = { ...doubles, players: [player, { playerId: '', playerName: '' }] }
      expect(project([fixture('2026-10-01', [court(['a', 'b'])])], [slot]).slots[0]).toEqual(slot)
    }
  })
  it('reserves all entered players and gives repeated courts priority over one-offs', () => {
    const singles: CaptainLineupSlot[] = [0, 1].map((index) => ({ id: `s${index}`, label: `Singles ${index + 1}`, slotType: 'singles', players: [{ playerId: '', playerName: '' }] }))
    const plan = project([fixture('2026-10-01', [court(['a']), court(['a'], 1)]), fixture('2026-09-24', [court(['b']), court(['a'], 1)])], singles)
    expect(plan.slots[1].players[0].playerId).toBe('a')
    expect(plan.slots[0].players[0].playerId).toBe('b')
    expect(plan.filled).toBe(2)
    const reserved = project([fixture('2026-10-01', [court(['a'])])], [singles[0], { ...singles[1], players: [{ playerId: 'a', playerName: 'A' }] }])
    expect(reserved.filled).toBe(0)
  })
  it('does not use unscoped or loading history', () => {
    expect(projectOpponentSeasonLineup({ ...scout([fixture('2026-10-01', [court(['a', 'b'])])]), ready: false }, [doubles], pool, () => true)).toMatchObject({ filled: 0, fixtureCount: 0 })
  })
})
