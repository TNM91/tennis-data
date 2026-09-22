import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getClubApiAuth } from '@/lib/club-api-auth'
import { buildTeamRoomHref, buildTeamRoomScopeId } from '@/lib/team-room'
import { canRunClubPrograms, cleanClubMultiline, cleanClubText, isClubManager, normalizeClubRoles, type ClubRole } from '@/lib/club-workspace'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

type StaffAccess = { name: string; roles: ClubRole[] }
type GroupRow = { id: string; name: string; group_type: string; lead_user_id: string | null }
type TeamLinkRow = { team_name: string; normalized_team_name: string; league_name: string; flight: string; team_role: string; team_roles: string[] | null }
type TeamChannel = { group: GroupRow; link: TeamLinkRow; scopeId: string }
type ReadRow = { channel_type: string; channel_id: string; last_read_at: string }
type TeamMessageRow = { id: string; conversation_id: string; sender_user_id: string; body: string; message_kind: string; created_at: string; deleted_at: string | null }
type ClinicMessageRow = { id: string; group_id: string; author_user_id: string; author_name: string; body: string; kind: string; created_at: string }
type ResponseRow = { conversation_id: string; profile_id: string; response: string; updated_at: string }

export async function GET(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  const access = await loadClubStaffAccess(auth.supabase, clubId, auth.userId)
  if (!access.ok) return access.response
  const service = getClubCommunicationService()
  if (!service) return Response.json({ ok: false, message: 'Club communication is not configured yet.' }, { status: 503 })

  const channels = await loadEligibleChannels(auth.supabase, clubId, auth.userId, access.staff.roles)
  if (!channels.ok) return channels.response
  const readResult = await auth.supabase
    .from('club_communication_reads')
    .select('channel_type,channel_id,last_read_at')
    .eq('club_id', clubId)
    .eq('user_id', auth.userId)
  if (readResult.error) return clubCommunicationDatabaseError(readResult.error.message)

  const recentSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const [clinicResult, conversationResult] = await Promise.all([
    channels.clinics.length
      ? service.from('club_group_messages').select('id,group_id,author_user_id,author_name,body,kind,created_at').in('group_id', channels.clinics.map((group) => group.id)).gte('created_at', recentSince).order('created_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    channels.teams.length
      ? service.from('internal_conversations').select('id,related_entity_id').eq('related_entity_type', 'team_room').in('related_entity_id', channels.teams.map((channel) => channel.scopeId))
      : Promise.resolve({ data: [], error: null }),
  ])
  const firstError = clinicResult.error || conversationResult.error
  if (firstError) return clubCommunicationDatabaseError(firstError.message)

  const conversations = (conversationResult.data ?? []) as Array<{ id: string; related_entity_id: string }>
  const conversationIds = conversations.map((conversation) => conversation.id)
  const [teamMessageResult, responseResult] = await Promise.all([
    conversationIds.length
      ? service.from('internal_messages').select('id,conversation_id,sender_user_id,body,message_kind,created_at,deleted_at').in('conversation_id', conversationIds).is('deleted_at', null).gte('created_at', recentSince).order('created_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    conversationIds.length
      ? service.from('team_room_message_responses').select('conversation_id,profile_id,response,updated_at').in('conversation_id', conversationIds).gte('updated_at', recentSince).order('updated_at', { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
  ])
  const activityError = teamMessageResult.error || responseResult.error
  if (activityError) return clubCommunicationDatabaseError(activityError.message)

  const teamMessages = (teamMessageResult.data ?? []) as TeamMessageRow[]
  const responses = (responseResult.data ?? []) as ResponseRow[]
  const profileIds = Array.from(new Set([...teamMessages.map((row) => row.sender_user_id), ...responses.map((row) => row.profile_id)].filter(Boolean)))
  const profileResult = profileIds.length
    ? await service.from('profiles').select('id,message_display_name,linked_player_name').in('id', profileIds)
    : { data: [], error: null }
  if (profileResult.error) return clubCommunicationDatabaseError(profileResult.error.message)

  const readByChannel = new Map(((readResult.data ?? []) as ReadRow[]).map((row) => [`${row.channel_type}:${row.channel_id}`, row.last_read_at]))
  const profileNames = new Map(((profileResult.data ?? []) as Array<{ id: string; message_display_name: string | null; linked_player_name: string | null }>).map((row) => [row.id, cleanClubText(row.message_display_name, 120) || cleanClubText(row.linked_player_name, 120) || 'Team member']))
  const defaultReadAt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const items = [
    ...buildClinicItems(channels.clinics, clinicResult.data as ClinicMessageRow[], readByChannel, auth.userId, defaultReadAt),
    ...buildTeamItems(channels.teams, conversations, teamMessages, responses, profileNames, readByChannel, auth.userId, defaultReadAt),
  ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  return Response.json({ ok: true, items, staffName: access.staff.name })
}

export async function PATCH(request: Request, context: { params: Promise<{ clubId: string }> }) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response
  const { clubId } = await context.params
  const access = await loadClubStaffAccess(auth.supabase, clubId, auth.userId)
  if (!access.ok) return access.response
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, message: 'Choose the conversations to mark read.' }, { status: 400 })
  }
  const channels = await loadEligibleChannels(auth.supabase, clubId, auth.userId, access.staff.roles)
  if (!channels.ok) return channels.response
  const eligible = new Map<string, 'team' | 'clinic'>([
    ...channels.clinics.map((group) => [group.id, 'clinic'] as const),
    ...channels.teams.map((channel) => [channel.group.id, 'team'] as const),
  ])
  const requestedId = cleanClubText(body.channelId, 80)
  const selected = requestedId ? [[requestedId, eligible.get(requestedId)]] : Array.from(eligible.entries())
  const valid = selected.flatMap(([channelId, channelType]) => channelType ? [{ channelId, channelType }] : [])
  if (!valid.length || requestedId && !eligible.has(requestedId)) {
    return Response.json({ ok: false, message: 'That Club conversation is not available.' }, { status: 403 })
  }
  const reviewedAt = new Date().toISOString()
  const result = await auth.supabase.from('club_communication_reads').upsert(valid.map((channel) => ({
    club_id: clubId,
    user_id: auth.userId,
    channel_type: channel.channelType,
    channel_id: channel.channelId,
    last_read_at: reviewedAt,
  })), { onConflict: 'club_id,user_id,channel_type,channel_id' })
  if (result.error) return clubCommunicationDatabaseError(result.error.message)
  return Response.json({ ok: true, reviewedAt, channelIds: valid.map((channel) => channel.channelId) })
}

async function loadClubStaffAccess(supabase: SupabaseClient, clubId: string, userId: string) {
  const result = await supabase.from('club_memberships').select('display_name,email,roles,status').eq('club_id', clubId).eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (result.error) return { ok: false as const, response: clubCommunicationDatabaseError(result.error.message) }
  const roles = normalizeClubRoles(result.data?.roles)
  if (!result.data || !canRunClubPrograms(roles)) return { ok: false as const, response: Response.json({ ok: false, message: 'Club staff access is required to follow communication.' }, { status: 403 }) }
  return { ok: true as const, staff: { name: cleanClubText(result.data.display_name, 120) || cleanClubText(result.data.email, 180) || 'Club staff', roles } satisfies StaffAccess }
}

async function loadEligibleChannels(supabase: SupabaseClient, clubId: string, userId: string, roles: ClubRole[]) {
  const [groupResult, linkResult] = await Promise.all([
    supabase.from('club_groups').select('id,name,group_type,lead_user_id').eq('club_id', clubId).eq('is_active', true),
    supabase.from('team_profile_links').select('team_name,normalized_team_name,league_name,flight,team_role,team_roles').eq('profile_user_id', userId).eq('status', 'accepted'),
  ])
  const firstError = groupResult.error || linkResult.error
  if (firstError) return { ok: false as const, response: clubCommunicationDatabaseError(firstError.message) }
  const groups = (groupResult.data ?? []) as GroupRow[]
  const manager = isClubManager(roles)
  const clinics = groups.filter((group) => group.group_type === 'clinic' && (manager || roles.includes('coach') && group.lead_user_id === userId))
  const manageableLinks = ((linkResult.data ?? []) as TeamLinkRow[]).filter((link) => {
    const teamRoles = Array.isArray(link.team_roles) ? link.team_roles : [link.team_role]
    return teamRoles.includes('captain') || teamRoles.includes('co_captain')
  })
  const teams = groups.filter((group) => group.group_type === 'team').flatMap((group) => {
    const groupKeys = new Set(getTeamNameKeys(group.name))
    const link = manageableLinks.find((candidate) => getTeamNameKeys(candidate.team_name).some((key) => groupKeys.has(key)) || groupKeys.has(cleanClubText(candidate.normalized_team_name).toLowerCase()))
    if (!link) return []
    return [{ group, link, scopeId: buildTeamRoomScopeId({ teamName: link.team_name, leagueName: link.league_name, flight: link.flight }) } satisfies TeamChannel]
  })
  return { ok: true as const, clinics, teams }
}

function buildClinicItems(groups: GroupRow[], messages: ClinicMessageRow[], reads: Map<string, string>, userId: string, defaultReadAt: string) {
  return groups.flatMap((group) => {
    const rows = messages.filter((message) => message.group_id === group.id)
    const latest = rows[0]
    if (!latest) return []
    const lastReadAt = reads.get(`clinic:${group.id}`) || defaultReadAt
    return [{
      id: `clinic:${group.id}`,
      channelId: group.id,
      channelType: 'clinic' as const,
      channelName: group.name,
      href: `/clubs/clinics/${group.id}?tab=messages`,
      authorName: cleanClubText(latest.author_name, 120) || 'Club member',
      body: cleanClubMultiline(latest.body, 500),
      activityType: 'message' as const,
      createdAt: latest.created_at,
      unreadCount: rows.filter((message) => message.author_user_id !== userId && isAfter(message.created_at, lastReadAt)).length,
      needsReply: latest.author_user_id !== userId,
    }]
  })
}

function buildTeamItems(channels: TeamChannel[], conversations: Array<{ id: string; related_entity_id: string }>, messages: TeamMessageRow[], responses: ResponseRow[], profileNames: Map<string, string>, reads: Map<string, string>, userId: string, defaultReadAt: string) {
  const conversationByScope = new Map(conversations.map((conversation) => [conversation.related_entity_id, conversation]))
  return channels.flatMap((channel) => {
    const conversation = conversationByScope.get(channel.scopeId)
    if (!conversation) return []
    const channelMessages = messages.filter((message) => message.conversation_id === conversation.id)
    const channelResponses = responses.filter((response) => response.conversation_id === conversation.id)
    const latestMessage = channelMessages[0]
    const latestResponse = channelResponses[0]
    const responseIsLatest = Boolean(latestResponse && (!latestMessage || isAfter(latestResponse.updated_at, latestMessage.created_at)))
    const latest = responseIsLatest
      ? { authorId: latestResponse.profile_id, authorName: profileNames.get(latestResponse.profile_id) || 'Team member', body: `${responseLabel(latestResponse.response)} availability.`, createdAt: latestResponse.updated_at, activityType: 'availability_reply' as const }
      : latestMessage
        ? { authorId: latestMessage.sender_user_id, authorName: profileNames.get(latestMessage.sender_user_id) || 'Team member', body: cleanClubMultiline(latestMessage.body, 500), createdAt: latestMessage.created_at, activityType: 'message' as const }
        : null
    if (!latest) return []
    const lastReadAt = reads.get(`team:${channel.group.id}`) || defaultReadAt
    const unreadMessages = channelMessages.filter((message) => message.sender_user_id !== userId && isAfter(message.created_at, lastReadAt)).length
    const unreadResponses = channelResponses.filter((response) => response.profile_id !== userId && isAfter(response.updated_at, lastReadAt)).length
    return [{
      id: `team:${channel.group.id}`,
      channelId: channel.group.id,
      channelType: 'team' as const,
      channelName: channel.group.name,
      href: buildTeamRoomHref({ teamName: channel.link.team_name, leagueName: channel.link.league_name, flight: channel.link.flight }),
      authorName: latest.authorName,
      body: latest.body,
      activityType: latest.activityType,
      createdAt: latest.createdAt,
      unreadCount: unreadMessages + unreadResponses,
      needsReply: latest.activityType === 'message' && latest.authorId !== userId && latestMessage?.message_kind === 'message',
    }]
  })
}

function getTeamNameKeys(value: unknown) {
  const normalized = cleanClubText(value).replace(/\s+/g, ' ').toLowerCase()
  return normalized ? Array.from(new Set([normalized, normalized.replace(/\s*\/\s*/g, '/')])) : []
}

function responseLabel(value: string) {
  if (value === 'yes') return 'Confirmed'
  if (value === 'no') return 'Declined'
  return 'Marked maybe for'
}

function isAfter(value: string, comparison: string) {
  return new Date(value).getTime() > new Date(comparison).getTime()
}

function getClubCommunicationService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  return key ? createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null
}

function clubCommunicationDatabaseError(message: string) {
  const missingSchema = message.toLowerCase().includes('club_communication_reads')
  return Response.json({ ok: false, message: missingSchema ? 'Club communication is ready in the app, but its database update has not been applied yet.' : 'Club communication could not load. Try again.' }, { status: 500 })
}
