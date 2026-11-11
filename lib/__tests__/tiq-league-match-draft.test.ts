import { describe, expect, it } from 'vitest'
import { buildLeagueDraftContext, buildLeagueMatchDraft, findLeagueDraftBatchConflicts } from '../tiq-league-match-draft'
import type { TiqLeagueScheduleItem } from '../tiq-league-schedule-service'

const players = ['Aces', 'Breakers', 'Court Crew', 'Deuce'].map((playerName, index) => ({
  value: `team-${index}`,
  playerId: `team-${index}`,
  playerName,
}))
const weeks = [
  { week: 1, date: '2026-11-16' },
  { week: 3, date: '2026-11-30' },
  { week: 4, date: '2026-12-07' },
]
const options = {
  weeks,
  time: '18:30',
  facility: 'Riverside Tennis Center',
  simultaneousMatches: 2,
  remainingMatchEvents: 20,
}
const existing: TiqLeagueScheduleItem = {
  id: 'posted', leagueId: 'league', leagueFormat: 'team',
  participantAId: '', participantAName: ' Breakers ', participantBId: 'team-2', participantBName: 'Old Team Name',
  scheduledDate: weeks[0].date, scheduledTime: '18:30:00', facility: 'riverside tennis center',
  status: 'coordinator_set', notes: '', proposedByUserId: 'owner', confirmedByUserId: 'owner',
  createdAt: '', updatedAt: '',
}

describe('League Office round-robin draft', () => {
  it('fills selected weeks once per participant and keeps the entered time and site', () => {
    const context = buildLeagueDraftContext(players, [], [])
    const draft = buildLeagueMatchDraft({ ...options, context })
    expect(draft.rows).toHaveLength(6)
    expect(draft.unplaced).toBe(0)
    expect(new Set(draft.rows.map((row) => row.key)).size).toBe(6)
    for (const week of weeks) {
      const matches = draft.rows.filter((row) => row.date === week.date)
      expect(matches).toHaveLength(2)
      expect(new Set(matches.flatMap(({ a, b }) => [a.value, b.value])).size).toBe(4)
      expect(matches.every((row) => row.week === week.week && row.time === options.time && row.facility === options.facility)).toBe(true)
    }
  })

  it('keeps existing slots and results out of the draft even when earlier records use names or reversed sides', () => {
    const played = [{ a: players[3], b: players[0] }]
    const context = buildLeagueDraftContext(players, [existing], played)
    const draft = buildLeagueMatchDraft({ ...options, context })
    expect(draft.rows).toHaveLength(4)
    expect(draft.unplaced).toBe(0)
    expect(draft.rows.every((row) => !context.pairs.has(row.key))).toBe(true)
    expect(draft.rows.some((row) => row.date === weeks[0].date)).toBe(false)
  })

  it('respects venue and season capacity and ignores cancelled fixtures', () => {
    const context = buildLeagueDraftContext(players, [{ ...existing, status: 'cancelled' }], [])
    const draft = buildLeagueMatchDraft({ ...options, context, simultaneousMatches: 1, remainingMatchEvents: 2 })
    expect(draft.rows.map((row) => row.date)).toEqual([weeks[0].date, weeks[1].date])
    expect(draft.unplaced).toBe(4)
    const occupied = buildLeagueDraftContext(players, [existing], [])
    const full = buildLeagueMatchDraft({ ...options, context: occupied, simultaneousMatches: 1, weeks: weeks.slice(0, 1) })
    expect(full).toEqual({ rows: [], unplaced: 5 })
  })

  it('supports byes and rejects a roster with ambiguous names', () => {
    const odd = buildLeagueMatchDraft({ ...options, context: buildLeagueDraftContext(players.slice(0, 3), [], []) })
    expect(odd.rows).toHaveLength(3)
    expect(new Set(odd.rows.map((row) => row.date)).size).toBe(3)
    const duplicates = buildLeagueDraftContext([...players, { ...players[0], value: 'another', playerId: 'another' }], [], [])
    expect(duplicates.unique).toBe(false)
    expect(buildLeagueMatchDraft({ ...options, context: duplicates }).rows).toEqual([])
  })

  it('checks edited draft slots together and allows different starts at one site', () => {
    const context = buildLeagueDraftContext(players, [], [])
    const { rows } = buildLeagueMatchDraft({ ...options, context })
    const sameStart = findLeagueDraftBatchConflicts(rows.slice(0, 2), context, 1)
    expect(sameStart.size).toBe(2)
    const splitStarts = [rows[0], { ...rows[1], time: '19:30' }]
    expect(findLeagueDraftBatchConflicts(splitStarts, context, 1).size).toBe(0)
    const overlappingPlayers = [rows[0], { ...rows[2], date: rows[0].date, time: '19:30' }]
    expect(findLeagueDraftBatchConflicts(overlappingPlayers, context, 1).size).toBe(2)
  })
})
