import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlayerCalendarItemRow } from './player-calendar-items'

export const playerCalendarSelect = 'id,player_user_id,title,scheduled_date,scheduled_time,location,kind,recurrence_rule,availability_status,created_at,updated_at'

// Do not silently hide a new season behind the oldest 100 personal items.
export async function loadAllPlayerCalendarItems(db: SupabaseClient, userId: string): Promise<PlayerCalendarItemRow[]> {
  const rows: PlayerCalendarItemRow[] = []
  const pageSize = 500
  for (let offset = 0; offset < 10000; offset += pageSize) {
    const { data, error } = await db.from('player_calendar_items').select(playerCalendarSelect)
      .eq('player_user_id', userId).order('scheduled_date', { ascending: true })
      .order('scheduled_time', { ascending: true }).order('id', { ascending: true }).range(offset, offset + pageSize - 1)
    if (error) throw error
    rows.push(...((data ?? []) as PlayerCalendarItemRow[]))
    if (!data || data.length < pageSize) return rows
  }
  throw new Error('Your calendar is too large to load completely. Contact support; no partial feed was published.')
}
