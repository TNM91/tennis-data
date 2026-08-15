import { describe, expect, it } from 'vitest'
import { buildTeamMemberships, isProfileLinkedToTeam } from '../team-membership-core'

describe('team membership access', () => {
  it('keeps guests outside private team access', () => {
    expect(isProfileLinkedToTeam(null, [], 'Baseline Aces')).toBe(false)
  })

  it('combines the explicit team link with every rostered team', () => {
    const memberships = buildTeamMemberships(
      {
        linked_player_id: 'player-1',
        linked_player_name: 'Alex Ace',
        linked_team_name: 'Baseline Aces',
        linked_league_name: 'Adult 18 & Over',
        linked_flight: '4.0',
      },
      [
        { team_name: 'Baseline Aces', league_name: 'Adult 18 & Over', flight: '4.0', player_id: 'player-1' },
        { team_name: 'Friday Rally', league_name: 'TIQ Summer', flight: 'Open', player_id: 'player-1' },
      ],
    )

    expect(memberships).toHaveLength(2)
    expect(memberships.map((membership) => membership.teamName)).toEqual(['Baseline Aces', 'Friday Rally'])
  })

  it('grants team access from a matching rostered player id', () => {
    expect(isProfileLinkedToTeam(
      {
        linked_player_id: 'player-1',
        linked_player_name: 'Alex Ace',
        linked_team_name: null,
        linked_league_name: null,
      },
      ['player-2', 'player-1'],
      'Baseline Aces',
    )).toBe(true)
  })

  it('does not treat a different team link as membership', () => {
    expect(isProfileLinkedToTeam(
      {
        linked_player_id: 'player-1',
        linked_player_name: 'Alex Ace',
        linked_team_name: 'Other Team',
        linked_league_name: 'Other League',
      },
      ['player-2'],
      'Baseline Aces',
      'Adult 18 & Over',
    )).toBe(false)
  })

  it('uses the same linked membership for Free, Player, and Captain product layers', () => {
    const profile = {
      linked_player_id: 'player-1',
      linked_player_name: 'Alex Ace',
      linked_team_name: 'Baseline Aces',
      linked_league_name: 'Adult 18 & Over',
    }

    for (const role of ['member', 'player', 'captain']) {
      expect(isProfileLinkedToTeam(profile, [], 'Baseline Aces', 'Adult 18 & Over'), role).toBe(true)
    }
  })

  it('keeps multiple rostered teams available to one linked player', () => {
    const memberships = buildTeamMemberships(
      {
        linked_player_id: 'player-1',
        linked_player_name: 'Alex Ace',
        linked_team_name: null,
        linked_league_name: null,
      },
      [
        { team_name: 'Baseline Aces', league_name: 'USTA 18+', flight: '4.0', player_id: 'player-1' },
        { team_name: 'Friday Rally', league_name: 'TIQ Summer', flight: 'Open', player_id: 'player-1' },
      ],
    )

    expect(memberships).toMatchObject([
      { teamName: 'Baseline Aces', source: 'roster' },
      { teamName: 'Friday Rally', source: 'roster' },
    ])
  })
})
