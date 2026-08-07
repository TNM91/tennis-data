import { describe, expect, it } from 'vitest'
import { getClubRosterConnectionLabel, getClubRosterConnectionStatus } from '../club-roster-reconciliation'

describe('Club roster reconciliation', () => {
  it('recognizes an existing member by normalized email or full phone number', () => {
    expect(getClubRosterConnectionStatus({
      contact: { email: 'PLAYER@EXAMPLE.COM' },
      memberships: [{ email: 'player@example.com', status: 'active' }],
      invites: [],
    })).toBe('connected')
    expect(getClubRosterConnectionStatus({
      contact: { phone: '+1 (314) 555-1212' },
      memberships: [{ phone: '3145551212', status: 'active' }],
      invites: [],
    })).toBe('connected')
  })

  it('does not use short phone fragments or names as automatic matches', () => {
    expect(getClubRosterConnectionStatus({
      contact: { phone: '555-1212' },
      memberships: [{ phone: '3145551212', status: 'active' }],
      invites: [],
    })).toBe('email_needed')
  })

  it('recognizes a live invitation but permits a new invitation after expiration', () => {
    const now = new Date('2026-08-07T12:00:00Z')
    expect(getClubRosterConnectionStatus({
      contact: { email: 'player@example.com' },
      memberships: [],
      invites: [{ email: 'player@example.com', status: 'pending', expires_at: '2026-08-08T12:00:00Z' }],
      now,
    })).toBe('pending')
    expect(getClubRosterConnectionStatus({
      contact: { email: 'player@example.com' },
      memberships: [],
      invites: [{ email: 'player@example.com', status: 'pending', expires_at: '2026-08-06T12:00:00Z' }],
      now,
    })).toBe('ready')
  })

  it('uses short end-user labels for every status', () => {
    expect(getClubRosterConnectionLabel('connected')).toBe('Already connected')
    expect(getClubRosterConnectionLabel('pending')).toBe('Invite pending')
    expect(getClubRosterConnectionLabel('ready')).toBe('Ready to invite')
    expect(getClubRosterConnectionLabel('email_needed')).toBe('Email needed')
  })
})
