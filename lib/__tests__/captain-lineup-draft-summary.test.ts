import { describe, expect, it } from 'vitest'
import {
  isCaptainLineupSummaryCurrent,
  selectCaptainLineupSummaryForTeam,
  summarizeCaptainLineupDraft,
} from '@/lib/captain-lineup-draft-summary'

const slots = [
  { id: 'court-1', players: [{ playerId: 'one', playerName: 'One' }, { playerId: 'two', playerName: 'Two' }] },
  { id: 'court-2', players: [{ playerId: 'three', playerName: 'Three' }, { playerId: '', playerName: '' }] },
]

describe('captain lineup draft summaries', () => {
  it('returns compact progress without exposing player identities', () => {
    const summary = summarizeCaptainLineupDraft({
      competition_layer: 'usta',
      team_name: 'Aces',
      league_name: 'Fall League',
      flight: '4.0',
      match_date: '2026-09-14',
      opponent_team: 'Volleys',
      slots_json: slots,
      status: 'working',
      updated_at: '2026-09-08T12:00:00Z',
    })

    expect(summary).toMatchObject({ assignedPlayers: 3, requiredPlayers: 4, completedCourts: 1, totalCourts: 2, status: 'working' })
    expect(JSON.stringify(summary)).not.toContain('Three')
  })

  it('only reports final when the server flag and court completion agree', () => {
    expect(summarizeCaptainLineupDraft({ team_name: 'Aces', slots_json: slots, status: 'final' })?.status).toBe('working')
    expect(summarizeCaptainLineupDraft({
      team_name: 'Aces',
      slots_json: [{ players: [{ playerId: 'one' }] }],
      status: 'final',
    })?.status).toBe('final')
  })

  it('selects the exact upcoming match and removes past drafts from the continuation surface', () => {
    const older = summarizeCaptainLineupDraft({ team_name: 'Aces', match_date: '2026-09-10', opponent_team: 'Lobs', slots_json: slots, updated_at: '2026-09-08T13:00:00Z' })!
    const next = summarizeCaptainLineupDraft({ team_name: 'Aces', match_date: '2026-09-14', opponent_team: 'Volleys', slots_json: slots, updated_at: '2026-09-08T12:00:00Z' })!
    expect(selectCaptainLineupSummaryForTeam({ summaries: [older, next], teamName: 'aces', nextMatch: { date: '2026-09-14', opponent: 'Volleys' } })).toEqual(next)
    expect(isCaptainLineupSummaryCurrent(older, '2026-09-11')).toBe(false)
    expect(isCaptainLineupSummaryCurrent(next, '2026-09-11')).toBe(true)
  })
})
