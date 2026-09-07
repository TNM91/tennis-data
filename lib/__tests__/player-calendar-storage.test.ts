import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { loadAllPlayerCalendarItems } from '../player-calendar-storage'

describe('complete player season calendar', () => {
  it('paginates past old events and scopes every page to its owner', async () => {
    const rows = Array.from({ length: 1003 }, (_, i) => ({ id: String(i) }))
    const eq = vi.fn().mockReturnThis()
    const range = vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
    const query = { select: vi.fn().mockReturnThis(), eq, order: vi.fn().mockReturnThis(), range }
    const db = { from: () => query } as unknown as SupabaseClient
    expect(await loadAllPlayerCalendarItems(db, 'owner')).toHaveLength(1003)
    expect(range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]])
    expect(eq.mock.calls).toEqual(Array(3).fill(['player_user_id', 'owner']))
  })
  it('fails instead of returning a partial calendar when a later page fails', async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array(500).fill({ id: 'one' }), error: null }).mockResolvedValueOnce({ data: null, error: new Error('page failed') })
    const query = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range }
    await expect(loadAllPlayerCalendarItems({ from: () => query } as unknown as SupabaseClient, 'owner')).rejects.toThrow('page failed')
  })
})
