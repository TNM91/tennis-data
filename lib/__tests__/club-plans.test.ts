import { describe, expect, it } from 'vitest'

import { CLUB_PLANS } from '../product-story'

describe('club plans', () => {
  it('keeps Starter and Unlimited scale limits explicit', () => {
    expect(CLUB_PLANS.starter).toMatchObject({
      priceLabel: '$99/month',
      locationLimit: 1,
      coachStaffLimit: 10,
      playerProfileLimit: 150,
    })
    expect(CLUB_PLANS.unlimited).toMatchObject({
      priceLabel: '$199/month',
      locationLimit: null,
      coachStaffLimit: null,
      playerProfileLimit: null,
    })
    expect(CLUB_PLANS.unlimited.scaleLabel).toContain('Unlimited coaches/staff')
  })
})
