import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assignMissouriPlayerRefreshPages, enrollDiscoveredMissouriPlayers } from '../tennisrecord/missouri-player-refresh'

it('assigns only verified MO active-season profile/history URLs and preserves queue holds', async () => {
  const update = vi.fn(), filters: Record<string, unknown> = {}
  const query = { update: (value: unknown) => { update(value); return query }, in: (key: string, value: unknown) => { filters[key] = value; return query }, or: async (value: string) => { filters.or = value; return { error: null } } }
  const service = { from: vi.fn(() => query) } as unknown as SupabaseClient
  await assignMissouriPlayerRefreshPages(service, [
    { source_url: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Missouri%20Player', state: 'MO' },
    { source_url: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Kansas%20Player', state: 'KS' },
    { source_url: 'https://evil.example/adult/profile.aspx?playername=A', state: 'MO' },
  ], 'missouri-campaign', new Date('2026-10-03'))
  expect(update).toHaveBeenCalledWith({ campaign_id: 'missouri-campaign' })
  expect(filters.status).toEqual(['pending', 'done'])
  expect(filters.or).toBe('campaign_id.is.null,campaign_id.neq.missouri-campaign')
  const urls = filters.source_url as string[]
  expect(urls).toHaveLength(3)
  expect(urls.every(url => new URL(url).searchParams.get('playername') === 'Missouri Player')).toBe(true)
  expect(urls.filter(url => url.includes('matchhistory')).map(url => new URL(url).searchParams.get('year'))).toEqual(['2026', '2027'])
})

it('does not touch the queue when no verified Missouri profile is supplied', async () => {
  const from = vi.fn()
  await assignMissouriPlayerRefreshPages({ from } as unknown as SupabaseClient, [{ source_url: 'https://www.tennisrecord.com/adult/profile.aspx?playername=A', state: null }], 'mo')
  expect(from).not.toHaveBeenCalled()
})

it('enrolls newly discovered Missouri histories without losing source identity or reopening held pages', async () => {
  const updates: unknown[] = [], statuses: unknown[] = [], conditions: string[] = []
  const query = {
    select: () => query, eq: () => query,
    maybeSingle: async () => ({ data: { id: 'mo' }, error: null }),
    update: (value: unknown) => { updates.push(value); return query },
    in: (column: string, value: unknown) => { if (column === 'status') statuses.push(value); return query },
    or: async (value: string) => { conditions.push(value); return { error: null } },
  }
  const service = { from: () => query } as unknown as SupabaseClient
  const enqueue = vi.fn(async () => 3)
  const now = new Date('2026-10-03T12:00:00Z')
  expect(await enrollDiscoveredMissouriPlayers(service, [
    { sourceUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Alex%20Player&s=2', state: 'MO' },
    { sourceUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=Other', state: 'KS' },
    { sourceUrl: 'https://evil.example/adult/profile.aspx?playername=Wrong', state: 'MO' },
  ], enqueue, now)).toBe(3)
  const [urls, campaign] = enqueue.mock.calls[0] as unknown as [string[], string]
  expect(campaign).toBe('mo')
  expect(urls).toHaveLength(3)
  expect(urls.every(url => new URL(url).searchParams.get('s') === '2')).toBe(true)
  expect(urls.filter(url => url.includes('matchhistory')).map(url => new URL(url).searchParams.get('year'))).toEqual(['2026', '2027'])
  expect(updates).toEqual([{ campaign_id: 'mo' }, { refresh_season: 2026, refresh_due_at: now.toISOString() }])
  expect(statuses).toEqual([['pending', 'done'], ['pending', 'done']])
  expect(conditions).toContain('refresh_season.is.null,refresh_season.neq.2026')
})

it('does not query campaigns for a parsed player without Missouri profile evidence', async () => {
  const from = vi.fn(), enqueue = vi.fn()
  expect(await enrollDiscoveredMissouriPlayers({ from } as unknown as SupabaseClient,
    [{ sourceUrl: 'https://www.tennisrecord.com/adult/profile.aspx?playername=A', state: '' }], enqueue)).toBe(0)
  expect(from).not.toHaveBeenCalled()
  expect(enqueue).not.toHaveBeenCalled()
})
