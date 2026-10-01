import { describe, expect, it } from 'vitest'
import {
  canRecoverLegacyLeagueOwnership,
  matchesLeagueNameConfirmation,
} from '@/lib/league-ownership-recovery'

describe('legacy league ownership recovery', () => {
  it('allows a confirmed matching email or a platform admin', () => {
    expect(canRecoverLegacyLeagueOwnership({
      requesterEmail: 'Owner@Example.com',
      requesterEmailConfirmed: true,
      previousOwnerEmail: 'owner@example.com',
      previousOwnerEmailConfirmed: true,
      requesterIsAdmin: false,
    })).toBe(true)

    expect(canRecoverLegacyLeagueOwnership({
      requesterEmail: 'admin@example.com',
      requesterEmailConfirmed: true,
      previousOwnerEmail: 'other@example.com',
      previousOwnerEmailConfirmed: true,
      requesterIsAdmin: true,
    })).toBe(true)
  })

  it('rejects unrelated or unconfirmed accounts', () => {
    expect(canRecoverLegacyLeagueOwnership({
      requesterEmail: 'owner@example.com',
      requesterEmailConfirmed: false,
      previousOwnerEmail: 'owner@example.com',
      previousOwnerEmailConfirmed: true,
      requesterIsAdmin: false,
    })).toBe(false)

    expect(canRecoverLegacyLeagueOwnership({
      requesterEmail: 'one@example.com',
      requesterEmailConfirmed: true,
      previousOwnerEmail: 'two@example.com',
      previousOwnerEmailConfirmed: true,
      requesterIsAdmin: false,
    })).toBe(false)
  })

  it('requires an exact league-name confirmation', () => {
    expect(matchesLeagueNameConfirmation('Northstar Fall Singles', 'Northstar Fall Singles')).toBe(true)
    expect(matchesLeagueNameConfirmation('Northstar Fall Singles', 'northstar fall singles')).toBe(false)
  })
})
