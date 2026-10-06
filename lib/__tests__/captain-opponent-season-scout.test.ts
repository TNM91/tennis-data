import { describe, expect, it } from 'vitest'
import { buildOpponentSeasonScout, fillOpponentSeasonDraft, opponentCourtScore } from '../captain-opponent-season-scout'
import type { CaptainLineupSlot } from '../captain-lineup-format'

const slots: CaptainLineupSlot[] = [{ id: 'opponent-1', label: 'Doubles 1', slotType: 'doubles', players: [{ playerId: '', playerName: '' }, { playerId: '', playerName: '' }] }]
const match = { id: 'm1', league_name: '2026 Fall', flight: '4.0', match_date: '2026-10-01', home_team: 'Other', away_team: 'Rivals (F)', line_number: '1', match_type: 'doubles', winner_side: 'B' as const, score: '6-3 6-4' }
const players = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Blair' }, { id: 'c', name: 'Casey' }]
const links = [{ match_id: 'm1', player_id: 'b', side: 'B' as const, seat: 2 }, { match_id: 'm1', player_id: 'a', side: 'B' as const, seat: 1 }, { match_id: 'm1', player_id: 'c', side: 'A' as const, seat: 1 }]
const input = { opponent: 'Rivals', league: '2026 Fall', flight: '4.0', beforeDate: '2026-10-11', matches: [match], links, players, slots }

describe('opponent score orientation', () => {
  it.each([
    ['6-3 6-4', 'B', 'B', '6-3 6-4', 12, 7, 'W'],
    ['3-6 4-6', 'B', 'B', '6-3 6-4', 12, 7, 'W'],
    ['6-3 6-4', 'B', 'A', '3-6 4-6', 7, 12, 'L'],
    ['6-4 3-6 10-8', 'B', 'B', '6-4 3-6 10-8', 9, 10, 'W'],
    ['6-4 3-6 1-0', 'A', 'A', '6-4 3-6 1-0', 9, 10, 'W'],
    ['7-6(5) 6-4', 'A', 'B', '6-7(5) 4-6', 10, 13, 'L'],
    ['6-4 3-6 6-2', 'A', 'A', '6-4 3-6 6-2', 15, 12, 'W'],
  ] as const)('normalizes %s for winner %s / team %s', (raw, winner, side, score, gamesFor, gamesAgainst, result) => {
    expect(opponentCourtScore(raw, winner, side)).toEqual({ score, gamesFor, gamesAgainst, result, scoreOriented: true })
  })
  it.each(['Default', '6-3 2-1 RET', 'garbage', '6-0'])('preserves incomplete %s without invented games', (raw) => {
    expect(opponentCourtScore(raw, 'B', 'B')).toMatchObject({ score: raw, result: 'W', gamesFor: null, scoreOriented: false })
  })
  it('does not infer a missing winner from winner-first scores', () => {
    expect(opponentCourtScore('6-3 6-4', null, 'B')).toMatchObject({ result: null, gamesFor: null, scoreOriented: false })
  })
})

describe('opponent season scope and courts', () => {
  it('joins the opponent side in seat order and aggregates games', () => {
    const scout = buildOpponentSeasonScout(input)
    expect(scout.fixtures[0].courts[0]).toMatchObject({ playerNames: ['Alex', 'Blair'], slotIndex: 0, result: 'W', gamesFor: 12, gamesAgainst: 7 })
    expect(scout.lines[0]).toMatchObject({ wins: 1, losses: 0, scoredCourts: 1, gamesFor: 12, appearances: 1 })
  })
  it('excludes other seasons, leagues, flights, teams, future and same-day matches', () => {
    const wrong = [
      { match_date: '2025-10-01' }, { match_date: '2026-10-11' }, { match_date: '2026-10-12' },
      { league_name: '2026 Spring' }, { flight: '3.5' }, { away_team: 'Different' }, { league_name: null }, { match_date: null },
    ].map((change, index) => ({ ...match, ...change, id: `wrong-${index}` }))
    expect(buildOpponentSeasonScout({ ...input, matches: [match, ...wrong] }).fixtures).toHaveLength(1)
  })
  it('requires the full selected match scope', () => {
    expect(buildOpponentSeasonScout({ ...input, flight: '' })).toEqual({ ready: false, fixtures: [], lines: [] })
  })
  it('supports verified roster aliases but ignores stale aliases after switching opponent', () => {
    expect(buildOpponentSeasonScout({ ...input, aliases: ['Rivals', 'Roster Name'], matches: [{ ...match, away_team: 'Roster Name' }] }).fixtures).toHaveLength(1)
    expect(buildOpponentSeasonScout({ ...input, opponent: 'New team', aliases: ['Rivals', 'Roster Name'] }).fixtures).toHaveLength(0)
  })
  it('deduplicates repeated imports and marks conflicting courts unresolved', () => {
    expect(buildOpponentSeasonScout({ ...input, matches: [match, { ...match, id: 'copy' }] }).lines[0].appearances).toBe(1)
    const duplicateLinks = links.map((link) => ({ ...link, match_id: 'copy' }))
    const scout = buildOpponentSeasonScout({ ...input, links: [...links, ...duplicateLinks], matches: [match, { ...match, id: 'copy', winner_side: 'A' }] })
    expect(scout.fixtures[0].courts[0]).toMatchObject({ needsReview: true, result: null, gamesFor: null })
    expect(scout.lines[0]).toMatchObject({ wins: 0, losses: 0, scoredCourts: 0 })
  })
  it('keeps historical players visible even when no longer eligible to draft', () => {
    expect(buildOpponentSeasonScout({ ...input, players: [] }).fixtures[0].courts[0].playerNames).toEqual(['Player not linked', 'Player not linked'])
  })
  it('does not map a recorded singles court to a doubles slot', () => {
    expect(buildOpponentSeasonScout({ ...input, matches: [{ ...match, match_type: 'singles' }] }).fixtures[0].courts[0].slotIndex).toBeNull()
  })
  it('maps TennisRecord discipline numbers and captain global numbers to the same court', () => {
    const format: CaptainLineupSlot[] = [
      { ...slots[0], id: 's1', label: 'Singles 1', slotType: 'singles' },
      { ...slots[0], id: 's2', label: 'Singles 2', slotType: 'singles' },
      ...[1, 2, 3].map((number) => ({ ...slots[0], id: `d${number}`, label: `Doubles ${number}` })),
    ]
    const scout = buildOpponentSeasonScout({ ...input, slots: format, matches: [
      { ...match, id: 'tr', source: 'tennisrecord', line_number: '3' },
      { ...match, id: 'captain', source: 'captain_upload', line_number: '5', match_date: '2026-09-24' },
    ] })
    expect(scout.fixtures.map((fixture) => fixture.courts[0].slotIndex)).toEqual([4, 4])
    expect(scout.lines).toHaveLength(1)
    expect(scout.lines[0].label).toBe('Doubles 3')
  })
  it('counts defaults as results with no game total', () => {
    expect(buildOpponentSeasonScout({ ...input, matches: [{ ...match, score: 'Default' }] }).lines[0]).toMatchObject({ wins: 1, defaults: 1, scoredCourts: 0 })
  })
  it('lists recent weeks first and does not claim missing courts are losses', () => {
    const scout = buildOpponentSeasonScout({ ...input, matches: [match, { ...match, id: 'm2', match_date: '2026-10-08', winner_side: null }], slots: [...slots, { ...slots[0], id: 'opponent-2' }] })
    expect(scout.fixtures[0]).toMatchObject({ date: '2026-10-08', wins: 0, losses: 0, unknown: 1, expectedCourts: 2 })
  })
})

describe('drafting a recorded opponent week', () => {
  const fixture = buildOpponentSeasonScout(input).fixtures[0]
  it('fills eligible open spots without changing a selected player', () => {
    const current = [{ ...slots[0], players: [{ playerId: 'c', playerName: 'Casey' }, { playerId: '', playerName: '' }] }]
    const draft = fillOpponentSeasonDraft(current, fixture, players, (player) => player.id !== 'a')
    expect(draft.filled).toBe(1)
    expect(draft.slots[0].players).toEqual([{ playerId: 'c', playerName: 'Casey' }, { playerId: 'b', playerName: 'Blair' }])
    expect(current[0].players[1].playerId).toBe('')
  })
  it('preserves manual names and skips missing and already selected players', () => {
    const current = [{ ...slots[0], players: [{ playerId: 'a', playerName: 'Alex' }, { playerId: '', playerName: 'Manual player' }] }]
    expect(fillOpponentSeasonDraft(current, fixture, [players[0]], () => true)).toEqual({ slots: current, filled: 0 })
  })
  it('skips conflicting courts', () => {
    expect(fillOpponentSeasonDraft(slots, { ...fixture, courts: fixture.courts.map((court) => ({ ...court, needsReview: true })) }, players, () => true).filled).toBe(0)
  })
})
