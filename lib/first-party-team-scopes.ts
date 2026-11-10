import type { SupabaseClient } from '@supabase/supabase-js'
import { buildTeamRoomScopeId, canManageTeamRoom, type TeamRoomScope } from './team-room'

export type ReviewedTeamRoom = TeamRoomScope & { roomId: string }
type FirstPartyTeamLink = TeamRoomScope & { isCaptain: boolean }
type ReviewedTeamLink = ReviewedTeamRoom & Pick<FirstPartyTeamLink, 'isCaptain'>
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

async function loadFirstPartyTeamLinks(service: SupabaseClient, owner: string): Promise<FirstPartyTeamLink[]> {
  const { data, error } = await service.from('team_profile_links')
    .select('profile_user_id,team_name,league_name,flight,status,archived_at,source_type,team_role,team_roles')
    .eq('profile_user_id', owner).eq('status', 'accepted').is('archived_at', null)
    .in('source_type', membershipSources).limit(51)
  if (error || !Array.isArray(data) || data.length > 50) throw Error('Team access unavailable')
  return data.flatMap(row => {
    if (row.profile_user_id !== owner || row.status !== 'accepted' || row.archived_at !== null ||
        !membershipSources.includes(row.source_type)) return []
    return [{ teamName: row.team_name, leagueName: row.league_name, flight: row.flight || '',
      isCaptain: canManageTeamRoom(row.team_roles ?? [row.team_role]),
    }]
  })
}

function matchReviewedTeamLinks(links: FirstPartyTeamLink[], rooms: ReadonlyMap<string, ReviewedTeamRoom>) {
  const accepted = new Map<string, ReviewedTeamLink>()
  for (const link of links) {
    const room = reviewedTeamRoom(rooms, link)
    if (room) accepted.set(room.roomId, { ...room, isCaptain: link.isCaptain })
  }
  return [...accepted.values()]
}

export async function loadReviewedTeamLinks(service: SupabaseClient, owner: string, rooms: ReadonlyMap<string, ReviewedTeamRoom>) {
  if (!rooms.size) return []
  return matchReviewedTeamLinks(await loadFirstPartyTeamLinks(service, owner), rooms)
}

export async function loadEligibleCaptainRoomIds(service: SupabaseClient, owner: string, reviewed: ReviewedTeamLink[]) {
  const links = reviewed.filter(link => link.isCaptain)
  if (!links.length) return []
  const ids = links.map(link => link.roomId)
  const [rooms, members, removals] = await Promise.all([
    service.from('internal_conversations').select('id,related_entity_id').in('id', ids)
      .eq('related_entity_type', 'team_room').eq('status', 'open').limit(50),
    service.from('internal_conversation_participants').select('conversation_id').in('conversation_id', ids).eq('profile_id', owner).limit(50),
    service.from('team_room_member_removals').select('conversation_id').in('conversation_id', ids).eq('profile_id', owner).limit(50),
  ])
  if (rooms.error || members.error || removals.error || !Array.isArray(rooms.data) ||
      !Array.isArray(members.data) || !Array.isArray(removals.data)) throw Error('Captain chat access unavailable')
  const open = new Map(rooms.data.map(room => [room.id, room.related_entity_id]))
  const participating = new Set(members.data.map(row => row.conversation_id))
  const removed = new Set(removals.data.map(row => row.conversation_id))
  return links.filter(link => open.get(link.roomId) === buildTeamRoomScopeId(link) &&
    participating.has(link.roomId) && !removed.has(link.roomId)).map(link => link.roomId)
}

export async function loadCaptainChatSetupStatus(service: SupabaseClient, owner: string, rooms: ReadonlyMap<string, ReviewedTeamRoom>) {
  const links = await loadFirstPartyTeamLinks(service, owner)
  if (!links.some(link => link.isCaptain)) return 'needs-team' as const
  const reviewed = matchReviewedTeamLinks(links, rooms).filter(link => link.isCaptain)
  if (!reviewed.length) return 'needs-review' as const
  const ready = await loadEligibleCaptainRoomIds(service, owner, reviewed)
  return ready.length ? 'ready' as const : 'needs-room-access' as const
}

export async function findReviewedTeamConversation(service: SupabaseClient, room: ReviewedTeamRoom) {
  const result = await service.from('internal_conversations').select('id').eq('id', room.roomId)
    .eq('related_entity_type', 'team_room').eq('related_entity_id', buildTeamRoomScopeId(room))
    .eq('status', 'open').maybeSingle()
  if (result.error) throw Error('Conversation unavailable')
  return result.data?.id === room.roomId
}
