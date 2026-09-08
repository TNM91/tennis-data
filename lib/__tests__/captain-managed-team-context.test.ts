import { describe, expect, it } from 'vitest'
import {
  buildCaptainManagedTeamOptions,
  captainTeamScopeKey,
  chooseCaptainManagedTeam,
  orderCaptainScheduledMatches,
} from '../captain-managed-team-context'
import type { TeamConnection } from '../team-profile-links'

const connection = (overrides: Partial<TeamConnection> = {}): TeamConnection => ({
  id: 'link-1',
  sourceType: 'roster_contact',
  sourceRecordId: 'source-1',
  teamName: 'Aces',
  leagueName: '2026 Fall',
  flight: '4.0',
  role: 'captain',
  roles: ['captain'],
  status: 'accepted',
  isRoleUpdate: false,
  declinedRoles: [],
  roleAcceptedAt: {},
  matchedPlayerId: '',
  isDefault: false,
  archivedAt: '',
  updatedAt: '2026-09-01T12:00:00.000Z',
  ...overrides,
})

describe('captain managed team context', () => {
  it('shows only active accepted captain and co-captain teams', () => {
    const options = buildCaptainManagedTeamOptions([
      connection({ id: 'captain', teamName: 'Captain team' }),
      connection({ id: 'co', teamName: 'Co team', role: 'co_captain', roles: ['co_captain'] }),
      connection({ id: 'player', teamName: 'Player team', role: 'player', roles: ['player'] }),
      connection({ id: 'archived', teamName: 'Old team', archivedAt: '2026-08-01T00:00:00.000Z' }),
      connection({ id: 'unlinked', teamName: 'Unlinked team', status: 'unlinked' }),
    ])

    expect(options.map((option) => option.team)).toEqual(['Captain team', 'Co team'])
  })

  it('keeps same-name seasons separate and honors the exact requested scope', () => {
    const options = buildCaptainManagedTeamOptions([
      connection({ id: 'fall', leagueName: '2026 Fall' }),
      connection({ id: 'summer', leagueName: '2026 Summer', isDefault: true }),
    ])

    expect(new Set(options.map(captainTeamScopeKey)).size).toBe(2)
    expect(chooseCaptainManagedTeam(options, { team: 'Aces', league: '2026 Fall', flight: '4.0' })?.league).toBe('2026 Fall')
    expect(chooseCaptainManagedTeam(options, {})?.league).toBe('2026 Summer')
  })

  it('places the nearest upcoming match first and recent history behind it', () => {
    const ordered = orderCaptainScheduledMatches([
      { id: 'oldest', match_date: '2026-08-01', match_time: '18:00' },
      { id: 'later', match_date: '2026-09-21', match_time: '18:00' },
      { id: 'recent', match_date: '2026-09-01', match_time: '18:00' },
      { id: 'next', match_date: '2026-09-14', match_time: '18:00' },
      { id: 'unscheduled', match_date: null, match_time: null },
    ], new Date('2026-09-08T10:00:00'))

    expect(ordered.map((match) => match.id)).toEqual(['next', 'later', 'recent', 'oldest', 'unscheduled'])
  })
})
