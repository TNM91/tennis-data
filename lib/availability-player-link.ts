import { supabase } from './supabase'
import type { UserProfileLink } from './user-profile'

export type AvailabilityPlayer = { id: string; name: string; location: string | null }

export function availabilityNamePattern(name: string) {
  return `%${name.trim().slice(0, 100).replace(/[\\%_]/g, '\\$&').split(/\s+/).join('%')}%`
}

export async function searchAvailabilityPlayers(name: string, signal: AbortSignal): Promise<AvailabilityPlayer[]> {
  if (name.trim().length < 2) return []
  // Search the public dataset before limiting results; don't search only an
  // initial capped download. No team roster or private contacts are exposed.
  const { data, error } = await supabase.from('players').select('id,name,location')
    .ilike('name', availabilityNamePattern(name)).order('name').limit(8).abortSignal(signal)
  if (error) throw new Error('Player search could not be loaded. Please try again.')
  return (data || []) as AvailabilityPlayer[]
}

export async function linkAvailabilityPlayer(token: string, playerId: string) {
  const response = await fetch('/api/profile/link', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkedPlayerId: playerId }), signal: AbortSignal.timeout(30000) })
  const result = await response.json() as { ok?: boolean; message?: string; player?: AvailabilityPlayer; profile?: UserProfileLink }
  if (!response.ok || !result.ok || result.player?.id !== playerId || result.profile?.linked_player_id !== playerId) {
    throw new Error(result.message || 'Your player could not be connected. Please retry before continuing.')
  }
  return result.profile
}
