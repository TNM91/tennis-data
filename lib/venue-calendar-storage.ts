import type { SupabaseClient } from '@supabase/supabase-js'
import { venueLocation, venuePreferenceSelect, venueSelect, type VenuePreference, type VerifiedVenue } from './venue-directory'

type LocatedRow = { location?: string | null; venue_directory_id?: string | null; venue_preference_id?: string | null }
// Owner-scoped even when called by a service-role subscription feed. Private
// confirmations can never be exposed through another player's calendar.
export async function applyCalendarVenueLocations<T extends LocatedRow>(db: SupabaseClient, userId: string, rows: T[]): Promise<T[]> {
  const preferenceIds = [...new Set(rows.map(row=>row.venue_preference_id).filter((id): id is string=>!!id))]
  const preferences = new Map<string, VenuePreference>()
  for (let i=0;i<preferenceIds.length;i+=100) {
    const result = await db.from('calendar_venue_preferences').select(venuePreferenceSelect).eq('owner_user_id',userId).in('id',preferenceIds.slice(i,i+100))
    if (result.error) throw result.error
    for (const preference of (result.data || []) as VenuePreference[]) preferences.set(preference.id,preference)
  }
  if (preferenceIds.some(id=>!preferences.has(id))) throw new Error('A saved venue could not be checked. Retry your calendar.')
  const directoryIds = [...new Set([...rows.map(row=>row.venue_directory_id), ...[...preferences.values()].map(row=>row.directory_id)].filter((id): id is string=>!!id))]
  const venues = new Map<string, VerifiedVenue>()
  for (let i=0;i<directoryIds.length;i+=100) {
    const result = await db.from('calendar_venue_directory').select(venueSelect).in('id',directoryIds.slice(i,i+100))
    if (result.error) throw result.error
    for (const venue of (result.data || []) as VerifiedVenue[]) venues.set(venue.id,venue)
  }
  return rows.map(row=>{
    const preference = row.venue_preference_id ? preferences.get(row.venue_preference_id) : undefined
    const venue = venues.get(preference?.directory_id || row.venue_directory_id || '')
    return venue || preference ? {...row,location:venueLocation(venue || preference!)} : row
  })
}
