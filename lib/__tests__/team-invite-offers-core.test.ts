import { describe, expect, it } from 'vitest'
import {
  getTeamInviteOfferAcceptedSince,
  resolveTeamInviteOffer,
  TEAM_INVITE_OFFER_WINDOW_DAYS,
} from '../team-invite-offers-core'

describe('team invitation offer eligibility', () => {
  it('opens the configured offer for a recent first-time team connection', () => {
    expect(resolveTeamInviteOffer({
      couponId: 'coupon_player_invite',
      label: 'First month $1.49, then $2.99/month',
      hasActiveAccess: false,
      hasRecentAcceptedLink: true,
      hasPriorSubscription: false,
    })).toEqual({
      available: true,
      label: 'First month $1.49, then $2.99/month',
      couponId: 'coupon_player_invite',
    })
  })

  it('withholds repeat, expired, active, and unconfigured offers', () => {
    const base = {
      couponId: 'coupon_invite',
      label: 'Invitation offer',
      hasActiveAccess: false,
      hasRecentAcceptedLink: true,
      hasPriorSubscription: false,
    }

    expect(resolveTeamInviteOffer({ ...base, hasPriorSubscription: true }).available).toBe(false)
    expect(resolveTeamInviteOffer({ ...base, hasRecentAcceptedLink: false }).available).toBe(false)
    expect(resolveTeamInviteOffer({ ...base, hasActiveAccess: true }).available).toBe(false)
    expect(resolveTeamInviteOffer({ ...base, couponId: '' }).available).toBe(false)
  })

  it('uses a 14-day redemption window', () => {
    const now = Date.UTC(2026, 7, 1, 12)
    expect(TEAM_INVITE_OFFER_WINDOW_DAYS).toBe(14)
    expect(getTeamInviteOfferAcceptedSince(now)).toBe('2026-07-18T12:00:00.000Z')
  })
})
