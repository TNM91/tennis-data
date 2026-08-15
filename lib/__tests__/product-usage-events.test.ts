import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  PRODUCT_USAGE_EVENT_NAMES,
  PRODUCT_USAGE_EVENT_SURFACES,
  buildProductUsageEventInsert,
  normalizeProductUsageEventInput,
} from '../product-usage-events'

describe('product usage events', () => {
  it('keeps production event and surface constraints aligned with the application registry', () => {
    const migration = readFileSync(
      join(process.cwd(), 'supabase/migrations/20260814000200_add_product_tour_usage_events.sql'),
      'utf8',
    )

    for (const eventName of PRODUCT_USAGE_EVENT_NAMES) {
      expect(migration).toContain(`'${eventName}'`)
    }
    for (const surface of PRODUCT_USAGE_EVENT_SURFACES) {
      expect(migration).toContain(`'${surface}'`)
    }
  })

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

  it('accepts captain default-team saves', () => {
    expect(normalizeProductUsageEventInput({
      eventName: 'captain_default_team_saved',
      surface: 'captain',
      planId: 'captain',
      metadata: {
        team: 'Northside',
        source: 'cloud',
      },
    })?.eventName).toBe('captain_default_team_saved')
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

  it('accepts Club upgrade checkout plan ids', () => {
    expect(normalizeProductUsageEventInput({
      eventName: 'upgrade_checkout_started',
      surface: 'upgrade',
      planId: 'club_unlimited',
      metadata: { nextHref: '/clubs' },
    })?.planId).toBe('club_unlimited')
  })

  it('accepts profile cloud sync repair observability', () => {
    expect(buildProductUsageEventInsert('user-profile-sync', {
      eventName: 'profile_cloud_sync_repair',
      surface: 'profile',
      planId: 'player_plus',
      metadata: {
        result: 'cloud_synced',
        via: 'api',
        profileSourceBefore: 'local',
        hasPlayerId: true,
        hasError: false,
      },
    })).toEqual({
      user_id: 'user-profile-sync',
      event_name: 'profile_cloud_sync_repair',
      surface: 'profile',
      plan_id: 'player_plus',
      metadata: {
        result: 'cloud_synced',
        via: 'api',
        profileSourceBefore: 'local',
        hasPlayerId: true,
        hasError: false,
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

  it('accepts portal personalization and lane-use analytics', () => {
    for (const eventName of [
      'portal_personalization_opened',
      'portal_personalization_saved',
      'portal_personalization_save_blocked',
      'portal_lane_opened',
      'portal_shortcut_opened',
    ] as const) {
      expect(normalizeProductUsageEventInput({
        eventName,
        surface: 'portal',
        metadata: {
          pinnedLanes: ['find', 'you', 'team', 'club'],
        },
      })?.eventName).toBe(eventName)
    }
  })
})
