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

  it('accepts public search and data-quality events', () => {
    expect(buildProductUsageEventInsert('user-3', {
      eventName: 'search_result_clicked',
      surface: 'search',
      metadata: {
        query: '4.0 league near me',
        group: 'Leagues',
        href: '/leagues',
      },
    })).toEqual({
      user_id: 'user-3',
      event_name: 'search_result_clicked',
      surface: 'search',
      plan_id: null,
      metadata: {
        query: '4.0 league near me',
        group: 'Leagues',
        href: '/leagues',
      },
    })

    expect(normalizeProductUsageEventInput({
      eventName: 'data_issue_reported',
      surface: 'data_assist',
      metadata: {
        entity: 'team',
      },
    })?.surface).toBe('data_assist')
  })

  it('accepts Matchup and Data Assist workflow analytics', () => {
    for (const eventName of [
      'player_a_selected',
      'player_b_selected',
      'matchup_preview_viewed',
      'matchup_unlock_clicked',
      'upload_type_selected',
      'scorecard_upload_started',
      'schedule_upload_started',
      'team_summary_upload_started',
    ] as const) {
      expect(normalizeProductUsageEventInput({
        eventName,
        surface: eventName.includes('upload') || eventName.includes('scorecard') || eventName.includes('schedule') || eventName.includes('team_summary')
          ? 'data_assist'
          : 'matchup',
        metadata: {
          source: 'test',
        },
      })?.eventName).toBe(eventName)
    }
  })
})
