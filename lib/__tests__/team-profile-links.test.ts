import { describe, expect, it } from 'vitest'
import {
  buildTeamConnectionKey,
  buildTeamConnections,
  getTeamConnectionRoleLabel,
  isCaptainTeamConnection,
  normalizeTeamConnectionRole,
} from '../team-profile-links'

describe('team profile links', () => {
  it('discovers a captain or co-captain from an imported roster contact', () => {
    const result = buildTeamConnections({
      contacts: [{
        id: 'contact-1',
        team_name: 'Net Results',
        league_name: '2026 Adult 40 & Over',
        flight: 'Men 4.0',
        role: 'Co-Captain',
        updated_at: '2026-08-01T12:00:00.000Z',
      }],
      rosterMemberships: [{
        id: 'membership-1',
        team_name: 'Net Results',
        league_name: '2026 Adult 40 & Over',
        flight: 'Men 4.0',
        player_id: 'player-1',
      }],
    })

    expect(result.pending).toHaveLength(1)
    expect(result.pending[0]).toMatchObject({
      id: 'roster_contact:contact-1',
      role: 'co_captain',
      teamName: 'Net Results',
    })
  })

  it('does not resurface a team after the member saved a decision', () => {
    const result = buildTeamConnections({
      rosterMemberships: [{
        id: 'membership-1',
        team_name: 'Net Results',
        league_name: 'Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        player_id: 'player-1',
      }],
      savedLinks: [{
        id: 'link-1',
        team_name: 'Net Results',
        league_name: 'Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        team_role: 'player',
        status: 'unlinked',
        source_type: 'roster_membership',
      }],
    })

    expect(result.pending).toEqual([])
    expect(result.connections[0]).toMatchObject({ id: 'link-1', status: 'unlinked' })
  })

  it('surfaces a later captain-role upgrade for an already linked player team', () => {
    const result = buildTeamConnections({
      contacts: [{
        id: 'contact-2',
        team_name: 'Net Results',
        league_name: 'Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        role: 'Captain',
      }],
      savedLinks: [{
        id: 'link-2',
        team_name: 'Net Results',
        league_name: 'Tri-Level',
        flight: '3.5 / 4.0 / 4.5',
        team_role: 'player',
        status: 'accepted',
        source_type: 'roster_membership',
      }],
    })

    expect(result.pending[0]).toMatchObject({ role: 'captain', id: 'roster_contact:contact-2' })
  })

  it('normalizes team roles and stable scope keys', () => {
    expect(normalizeTeamConnectionRole('Co-Captain')).toBe('co_captain')
    expect(getTeamConnectionRoleLabel('co_captain')).toBe('co-captain')
    expect(isCaptainTeamConnection('co_captain')).toBe(true)
    expect(buildTeamConnectionKey({
      teamName: ' Net Results ',
      leagueName: 'Tri-Level',
      flight: '3.5 / 4.0 / 4.5',
      role: 'captain',
    })).toBe('net results__tri level__3 5 4 0 4 5__captain')
  })
})
