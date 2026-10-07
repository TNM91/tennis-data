import { describe, expect, it, vi } from 'vitest'
import { compareRecentOpponentLineups } from '../captain-recent-lineup-comparison'
import type { CaptainLineupSlot } from '../captain-lineup-format'
import type { OpponentScoutCourt, OpponentSeasonScout } from '../captain-opponent-season-scout'

const slot: CaptainLineupSlot = { id: 's1', label: 'Singles 1', slotType: 'singles', players: [{ playerId: 'us', playerName: 'Our player' }] }
const court: OpponentScoutCourt = { key: 's1', label: 'Singles 1', slotIndex: 0, slotType: 'singles', playerIds: ['them'], playerNames: ['Their player'], result: 'W', score: '6-4 6-3', scoreOriented: true, gamesFor: 12, gamesAgainst: 7, defaulted: false, needsReview: false }
function scout(overrides: Partial<OpponentScoutCourt> = {}): OpponentSeasonScout {
  return { ready: true, lines: [], fixtures: [1, 3, 2, 4, 5].map((day) => ({ key: String(day), date: `2026-09-0${day}`, opponent: 'Other team', courts: [{ ...court, ...overrides }], wins: 1, losses: 0, unknown: 0, expectedCourts: 1 })) }
}
describe('recent opponent lineup comparisons', () => {
  it('uses the newest four scoped fixtures without changing either draft', () => {
    const source = scout()
    const before = JSON.stringify({ source, slot })
    const project = vi.fn(() => 0.7)
    const result = compareRecentOpponentLineups(source, [slot], project)
    expect(result.courts[0].weeks.map((week) => week.key)).toEqual(['5', '4', '3', '2'])
    expect(result.courts[0]).toMatchObject({ assessed: 4, minimum: 0.7, maximum: 0.7, status: 'Favored across recorded weeks' })
    expect(project.mock.calls[0]).toEqual([slot, { ...slot, players: [{ playerId: 'them', playerName: 'Their player' }] }, 0])
    expect(JSON.stringify({ source, slot })).toBe(before)
  })
  it('flags changing matchups and consistently difficult courts', () => {
    let calls = 0
    expect(compareRecentOpponentLineups(scout(), [slot], () => ++calls === 1 ? 0.6 : 0.3).courts[0].status).toBe('Changes with their lineup')
    expect(compareRecentOpponentLineups(scout(), [slot], () => 0.3).courts[0].status).toBe('Underdog across recorded weeks')
  })
  it.each([{ needsReview: true }, { defaulted: true }, { slotIndex: null }, { slotType: 'doubles' as const }, { playerIds: [] }, { result: null, score: '' }])('does not assess unusable courts %j', (overrides) => {
    const project = vi.fn(() => 0.8)
    expect(compareRecentOpponentLineups(scout(overrides), [slot], project).courts[0].assessed).toBe(0)
    expect(project).not.toHaveBeenCalled()
  })
  it('does not substitute a current projection for missing history or incomplete choices', () => {
    expect(compareRecentOpponentLineups(scout(), [{ ...slot, players: [] }], () => 0.8).courts[0].status).toBe('Complete your court')
    expect(compareRecentOpponentLineups({ ...scout(), ready: false }, [slot], () => 0.8).fixtureCount).toBe(0)
    expect(compareRecentOpponentLineups(scout(), [slot], () => null).courts[0].assessed).toBe(0)
  })
  it('rejects duplicate court records and invalid probabilities', () => {
    const source = scout()
    source.fixtures.forEach((fixture) => fixture.courts.push(court))
    expect(compareRecentOpponentLineups(source, [slot], () => 0.8).courts[0].assessed).toBe(0)
    for (const value of [NaN, Infinity, -1, 2]) expect(compareRecentOpponentLineups(scout(), [slot], () => value).courts[0].assessed).toBe(0)
  })
  it('compares the recorded doubles pair together and rejects incomplete or duplicate partners', () => {
    const doubles: CaptainLineupSlot = { ...slot, slotType: 'doubles', players: [{ playerId: 'us', playerName: 'First' }, { playerId: 'partner', playerName: 'Second' }] }
    const source = scout({ slotType: 'doubles', playerIds: ['them', 'their-partner'], playerNames: ['Opponent', 'Partner'] })
    const project = vi.fn<(team: CaptainLineupSlot, opponent: CaptainLineupSlot, index: number) => number>(() => 0.5)
    expect(compareRecentOpponentLineups(source, [doubles], project).courts[0].assessed).toBe(4)
    expect(project.mock.calls[0][1].players.map((player) => player.playerId)).toEqual(['them', 'their-partner'])
    for (const playerIds of [['them'], ['them', 'them']]) expect(compareRecentOpponentLineups(scout({ slotType: 'doubles', playerIds }), [doubles], () => 0.9).courts[0].assessed).toBe(0)
  })
})
