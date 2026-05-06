import { describe, expect, it } from 'vitest'

import {
  buildProductUsageEventInsert,
  normalizeProductUsageEventInput,
} from '../product-usage-events'

describe('product usage events', () => {
  it('normalizes supported event input', () => {
    expect(normalizeProductUsageEventInput({
      eventName: 'mylab_match_plan_action',
      surface: 'mylab',
      planId: 'player_plus',
      metadata: {
        action: 'open_read',
        long: 'x'.repeat(300),
      },
    })).toEqual({
      eventName: 'mylab_match_plan_action',
      surface: 'mylab',
      planId: 'player_plus',
      metadata: {
        action: 'open_read',
        long: 'x'.repeat(240),
      },
    })
  })

  it('rejects unknown event names and missing users', () => {
    expect(normalizeProductUsageEventInput({
      eventName: 'unknown' as 'mylab_match_plan_action',
      surface: 'mylab',
    })).toBeNull()

    expect(buildProductUsageEventInsert('', {
      eventName: 'billing_portal_opened',
      surface: 'billing',
    })).toBeNull()
  })

  it('builds insert payloads for authenticated users', () => {
    expect(buildProductUsageEventInsert('user-1', {
      eventName: 'captain_closeout_action',
      surface: 'captain',
      planId: 'captain',
      metadata: {
        stage: 'brief',
      },
    })).toEqual({
      user_id: 'user-1',
      event_name: 'captain_closeout_action',
      surface: 'captain',
      plan_id: 'captain',
      metadata: {
        stage: 'brief',
      },
    })
  })

  it('accepts upgrade checkout starts', () => {
    expect(buildProductUsageEventInsert('user-2', {
      eventName: 'upgrade_checkout_started',
      surface: 'upgrade',
      planId: 'captain',
      metadata: {
        requestId: 'captain-123',
        nextHref: '/captain',
      },
    })).toEqual({
      user_id: 'user-2',
      event_name: 'upgrade_checkout_started',
      surface: 'upgrade',
      plan_id: 'captain',
      metadata: {
        requestId: 'captain-123',
        nextHref: '/captain',
      },
    })
  })
})
