import { describe, expect, it } from 'vitest'
import {
  buildPublicPlayerEvidence, hasDiscoverablePlayerEvidence,
  type PublicMatchRow, type PublicParticipantRow,
} from '../public-player-evidence'

const playerId = '00000000-0000-0000-0000-000000000001'
const opponentId = '00000000-0000-0000-0000-000000000002'
const partnerId = '00000000-0000-0000-0000-000000000003'
const fourthId = '00000000-0000-0000-0000-000000000004'
function match(id: string, overrides: Partial<PublicMatchRow> = {}): PublicMatchRow {
  return { id, match_date: '2026-10-01', match_type: 'singles', score: '6-4 6-3', winner_side: 'A', public_history_eligible: true, league_name: 'Local league', ...overrides }
}
function participant(matchId: string, id: string, side: string, name = 'Alex'): PublicParticipantRow {
  return { match_id: matchId, player_id: id, side, players: { id, name, location: null } }
}
const lineup = (id: string) => [participant(id, playerId, 'A', 'Alex'), participant(id, opponentId, 'B', 'Blair')]

describe('public player evidence safeguards', () => {
  it('never promotes private, future, unscored, or unfinished results', () => {
    const rows = [
      match('private', { public_history_eligible: false }),
      match('future', { match_date: '2027-01-01' }),
      match('invalid-date', { match_date: 'unknown' }),
      match('impossible-date', { match_date: '2026-02-31' }),
      match('placeholder-score', { score: '1-0' }),
      match('unscored', { score: null }),
      match('retirement', { score: '6-4 2-1 RET' }),
      match('walkover', { score: '1-0 W/O' }),
      match('no-winner', { winner_side: null }),
    ]
    expect(buildPublicPlayerEvidence(rows, rows.flatMap(({ id }) => lineup(id)), '2026-10-10')).toEqual([])
  })

  it('requires a full unambiguous doubles lineup and preserves partner context', () => {
    const row = match('doubles', { match_type: 'doubles', winner_side: 'B' })
    const participants = [...lineup(row.id), participant(row.id, partnerId, 'A', 'Casey'), participant(row.id, fourthId, 'B', 'Drew')]
    expect(buildPublicPlayerEvidence([row], participants.slice(0, 3))).toEqual([])
    expect(buildPublicPlayerEvidence([row], [...participants, participants[0]])).toEqual([])
    expect(buildPublicPlayerEvidence([row], participants.map((p) => ({ ...p, side: 'A' })))).toEqual([])
    const alex = buildPublicPlayerEvidence([row], participants).find(({ player }) => player.id === playerId)!
    expect(alex.results[0]).toMatchObject({ result: 'L', partner: { id: partnerId }, opponents: [{ id: opponentId }, { id: fourthId }] })
  })

  it('excludes missing names and mismatched identities instead of inventing opponents', () => {
    expect(buildPublicPlayerEvidence([match('one')], [participant('one', playerId, 'A'), participant('one', opponentId, 'B', 'Player not linked')])).toEqual([])
    expect(buildPublicPlayerEvidence([match('one')], [participant('one', playerId, 'A'), participant('one', opponentId, 'B', '  ')])).toEqual([])
    const participants = lineup('one')
    participants[1].players = { id: playerId, name: 'Wrong person', location: null }
    expect(buildPublicPlayerEvidence([match('one')], participants)).toEqual([])
  })

  it('does not count duplicate matches toward discovery and bounds the displayed sample', () => {
    const rows = Array.from({ length: 9 }, (_, i) => match(String(i), { match_date: `2026-10-0${i + 1}` }))
    const evidence = buildPublicPlayerEvidence([rows[0], rows[0]], lineup(rows[0].id))
    expect(evidence[0].results).toHaveLength(1)
    expect(hasDiscoverablePlayerEvidence(evidence[0])).toBe(false)
    const full = buildPublicPlayerEvidence(rows, rows.flatMap(({ id }) => lineup(id)))
    expect(full[0].results).toHaveLength(6)
    expect(full[0].results[0].date).toBe('2026-10-09')
    expect(hasDiscoverablePlayerEvidence(full[0])).toBe(true)
  })
})
