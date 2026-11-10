import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTeamRoomScopeId, type TeamRoomScope } from './team-room'

export type ReviewedTeamRoom = TeamRoomScope & { roomId: string }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const membershipSources = ['manual_invite', 'tiq_entry']
const scopeKey = ({ teamName, leagueName, flight }: TeamRoomScope) => JSON.stringify([teamName, leagueName, flight])

export function readReviewedTeamRooms(config: string | undefined): ReadonlyMap<string, ReviewedTeamRoom> {
  const rooms = new Map<string, ReviewedTeamRoom>()
  if (!config?.trim()) return rooms
  const rows: unknown = JSON.parse(config)
  if (!Array.isArray(rows) || rows.length > 50) throw Error('Invalid team review configuration')
  const ids = new Set<string>()
  for (const value of rows) {
    const row = value as Partial<ReviewedTeamRoom> | null
    if (!row || typeof row.teamName !== 'string' || !row.teamName.trim() || row.teamName.length > 160 ||
        typeof row.leagueName !== 'string' || !row.leagueName.trim() || row.leagueName.length > 160 ||
        typeof row.flight !== 'string' || row.flight.length > 80 || typeof row.roomId !== 'string' ||
        !uuid.test(row.roomId) || [row.teamName, row.leagueName, row.flight].some(text => /[\u0000-\u001f\u007f]/.test(text))) {
      throw Error('Invalid reviewed team')
    }
    const { teamName, leagueName, flight, roomId } = row
    const room = { teamName, leagueName, flight, roomId: roomId.toLowerCase() }
    const key = scopeKey(room)
    if (rooms.has(key) || ids.has(room.roomId)) throw Error('Ambiguous reviewed team')
    rooms.set(key, room)
    ids.add(room.roomId)
  }
  return rooms
}

export function reviewedTeamRoom(rooms: ReadonlyMap<string, ReviewedTeamRoom>, scope: TeamRoomScope) {
  return rooms.get(scopeKey(scope))
}

export async function loadReviewedTeamLinks(service: SupabaseClient, owner: string, rooms: ReadonlyMap<string, ReviewedTeamRoom>) {
  if (!rooms.size) return []
  const { data, error } = await service.from('team_profile_links')
    .select('profile_user_id,team_name,league_name,flight,status,archived_at,source_type')
    .eq('profile_user_id', owner).eq('status', 'accepted').is('archived_at', null)
    .in('source_type', membershipSources).limit(51)
  if (error || !Array.isArray(data) || data.length > 50) throw Error('Team access unavailable')
  const accepted = new Map<string, ReviewedTeamRoom>()
  for (const row of data) {
    if (row.profile_user_id !== owner || row.status !== 'accepted' || row.archived_at !== null ||
        !membershipSources.includes(row.source_type)) continue
    const room = reviewedTeamRoom(rooms, { teamName: row.team_name, leagueName: row.league_name, flight: row.flight || '' })
    if (room) accepted.set(room.roomId, room)
  }
  return [...accepted.values()]
}

export async function findReviewedTeamConversation(service: SupabaseClient, room: ReviewedTeamRoom) {
  const result = await service.from('internal_conversations').select('id').eq('id', room.roomId)
    .eq('related_entity_type', 'team_room').eq('related_entity_id', buildTeamRoomScopeId(room))
    .eq('status', 'open').maybeSingle()
  if (result.error) throw Error('Conversation unavailable')
  return result.data?.id === room.roomId
}
