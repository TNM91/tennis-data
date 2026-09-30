import { describe, expect, it } from 'vitest'
import {
  canAcceptLeagueDelegateInvite,
  getLeagueDelegateDisplayName,
  isLeagueDelegateInviteExpired,
  isValidLeagueDelegateEmail,
  normalizeLeagueDelegateEmail,
} from '@/lib/league-delegates'

describe('league delegate invitations', () => {
  it('normalizes and validates invited email addresses', () => {
    expect(normalizeLeagueDelegateEmail('  Captain@Example.COM ')).toBe('captain@example.com')
    expect(isValidLeagueDelegateEmail('captain@example.com')).toBe(true)
    expect(isValidLeagueDelegateEmail('captain')).toBe(false)
  })

  it('locks acceptance to the invited account', () => {
    expect(canAcceptLeagueDelegateInvite('Captain@Example.com', 'captain@example.COM')).toBe(true)
    expect(canAcceptLeagueDelegateInvite('captain@example.com', 'other@example.com')).toBe(false)
  })

  it('recognizes expired invites', () => {
    expect(isLeagueDelegateInviteExpired('2026-10-01T12:00:00.000Z', Date.parse('2026-10-01T11:59:59.000Z'))).toBe(false)
    expect(isLeagueDelegateInviteExpired('2026-10-01T12:00:00.000Z', Date.parse('2026-10-01T12:00:00.000Z'))).toBe(true)
  })

  it('uses profile metadata before falling back to the email name', () => {
    expect(getLeagueDelegateDisplayName({ full_name: 'Alex Captain' }, 'alex@example.com')).toBe('Alex Captain')
    expect(getLeagueDelegateDisplayName({}, 'alex@example.com')).toBe('alex')
  })
})
