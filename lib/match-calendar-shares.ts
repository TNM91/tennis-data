import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCalendarVenueLocations } from './venue-calendar-storage'
import type { PlayerCalendarItemRow } from './player-calendar-items'

export const matchShareSelect = 'id,label,team_name,season_key,time_zone,item_ids,status,created_at,updated_at'
export type MatchCalendarShare = { id: string; label: string; team_name: string; season_key: string; time_zone: string; item_ids: string[]; status: string; created_at: string; updated_at: string }
export const shareTimeZones = ['America/New_York','America/Chicago','America/Denver','America/Phoenix','America/Los_Angeles','America/Anchorage','Pacific/Honolulu']
export const isShareId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function shareItemIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 500 || value.some(id => typeof id !== 'string' || !id || id.length > 180)) return null
  return [...new Set(value)]
}

// Defense in depth: the service-role public feed still applies owner, explicit
// ID allowlist and match-kind filters. Never load an entire personal calendar.
export async function loadSharedMatches(db: SupabaseClient, ownerId: string, ids: string[]) {
  const rows: PlayerCalendarItemRow[] = []
  for (let offset = 0; offset < ids.length; offset += 100) {
    const {data,error} = await db.from('player_calendar_items')
      .select('id,player_user_id,title,scheduled_date,scheduled_time,location,kind,venue_directory_id,venue_preference_id,created_at,updated_at')
      .eq('player_user_id',ownerId).eq('kind','match').in('id',ids.slice(offset,offset+100))
    if (error) throw error
    rows.push(...((data || []) as PlayerCalendarItemRow[]))
  }
  return (await applyCalendarVenueLocations(db,ownerId,rows)).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date) || (a.scheduled_time || '').localeCompare(b.scheduled_time || ''))
}
