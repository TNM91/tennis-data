import { expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { assignMissouriPlayerRefreshPages } from '../tennisrecord/missouri-player-refresh'

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
