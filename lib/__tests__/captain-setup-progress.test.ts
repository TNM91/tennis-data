import { describe, expect, it } from 'vitest'
import { getCaptainSetupProgress } from '../captain-setup-progress'

describe('Captain setup progress', () => {
  it('moves a linked player directly to team setup', () => {
    expect(getCaptainSetupProgress({
      profile: { linked_player_id: 'player-1' },
    })).toEqual({
      hasPlayer: true,
      hasTeam: false,
      hasMatchData: false,
      nextStep: 'team',
    })
  })

  it('recognizes roster and schedule handoffs without asking for completed work again', () => {
    const roster = getCaptainSetupProgress({
      profile: { linked_player_id: 'player-1' },
      importHandoff: {
        importType: 'team_summary',
        batchId: 'roster-1',
        team: 'Tri-Level Team',
        league: 'Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        players: 12,
        contacts: 11,
        matches: 0,
        captainRoles: 2,
        nextMatchDate: '',
        opponent: '',
      },
    })
    expect(roster.nextStep).toBe('schedule')
    expect(roster.hasTeam).toBe(true)

    expect(getCaptainSetupProgress({
      profile: { linked_player_id: 'player-1' },
      teamScopes: [{ team: 'Tri-Level Team', league: 'Tri-Level', flight: '3.5 / 4.0 / 4.5' }],
      importHandoff: {
        ...rosterImport,
        importType: 'schedule',
        matches: 8,
      },
    }).nextStep).toBe('ready')
  })

  it('recognizes durable team and match data after the import query is gone', () => {
    const progress = getCaptainSetupProgress({
      profile: {
        linked_player_id: 'player-1',
        linked_team_name: 'Tri-Level Team',
      },
      teamOptions: [{ matches: 8 }],
    })

    expect(progress).toEqual({
      hasPlayer: true,
      hasTeam: true,
      hasMatchData: true,
      nextStep: 'ready',
    })
  })
})

const rosterImport = {
  batchId: 'schedule-1',
  team: 'Tri-Level Team',
  league: 'Tri-Level',
  flight: '3.5 / 4.0 / 4.5',
  players: 0,
  contacts: 0,
  captainRoles: 0,
  nextMatchDate: '2026-08-12',
  opponent: 'Net Results',
} as const
