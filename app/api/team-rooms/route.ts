import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildTeamRoomHref,
  buildTeamRoomScopeId,
  canManageTeamRoom,
  normalizeTeamRoomKey,
} from '@/lib/team-room'

export const runtime = 'nodejs'

type TeamLinkRow = {
  id?: string
  profile_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  team_role: string
  team_roles: string[] | null
  is_default?: boolean | null
  updated_at?: string | null
}

type ConversationRow = {
  id: string
  subject: string | null
  created_by_user_id: string
  related_entity_id: string
  created_at: string | null
  updated_at: string | null
}

type ParticipantRow = {
  profile_id: string
  participant_role: string | null
  muted: boolean | null
}

type ProfileRow = {
  id: string
  message_display_name?: string | null
  linked_player_name?: string | null
  role?: string | null
}

type MessageRow = {
  id: string
  sender_user_id: string
  body: string
  message_kind: string | null
  created_at: string | null
}

type TeamRoomActionBody = {
  action?: unknown
  teamName?: unknown
  leagueName?: unknown
  flight?: unknown
  body?: unknown
  announcement?: unknown
  muted?: unknown
}

export async function GET(request: Request) {
  const auth = await getTeamRoomAuth(request)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const linksResult = await loadAcceptedTeamLinks(auth.service, auth.userId)
  if (!linksResult.ok) return Response.json({ ok: false, message: linksResult.message }, { status: 500 })
  if (!linksResult.links.length) {
    return Response.json({
      ok: true,
      room: null,
      teams: [],
      message: 'Link a team to your profile before opening its Team Room.',
    })
  }

  const selected = selectTeamLink(linksResult.links, {
    teamName: url.searchParams.get('team'),
    leagueName: url.searchParams.get('league'),
    flight: url.searchParams.get('flight'),
  })
  if (!selected) {
    return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  }

  const roomResult = await loadTeamRoom(auth.service, auth.userId, selected)
  if (!roomResult.ok) return Response.json({ ok: false, message: roomResult.message }, { status: roomResult.status })

  return Response.json({
    ok: true,
    teams: linksResult.links.map(toTeamOption),
    room: roomResult.room,
  })
}

export async function POST(request: Request) {
  const auth = await getTeamRoomAuth(request)
  if (!auth.ok) return auth.response

  let body: TeamRoomActionBody
  try {
    body = await request.json() as TeamRoomActionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid Team Room request.' }, { status: 400 })
  }

  const linksResult = await loadAcceptedTeamLinks(auth.service, auth.userId)
  if (!linksResult.ok) return Response.json({ ok: false, message: linksResult.message }, { status: 500 })
  const selected = selectTeamLink(linksResult.links, {
    teamName: cleanText(body.teamName),
    leagueName: cleanText(body.leagueName),
    flight: cleanText(body.flight),
  })
  if (!selected) {
    return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  }

  const roomResult = await ensureTeamRoom(auth.service, selected)
  if (!roomResult.ok) return Response.json({ ok: false, message: roomResult.message }, { status: roomResult.status })
  const conversation = roomResult.conversation
  await syncTeamRoomParticipants(auth.service, conversation.id, selected)

  const action = cleanText(body.action)
  if (action === 'send') {
    const messageBody = cleanText(body.body).slice(0, 2400)
    if (!messageBody) return Response.json({ ok: false, message: 'Write a message first.' }, { status: 400 })
    const isAnnouncement = body.announcement === true
    if (isAnnouncement && !canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can post an announcement.' }, { status: 403 })
    }

    const { data: message, error } = await auth.service
      .from('internal_messages')
      .insert({
        conversation_id: conversation.id,
        sender_user_id: auth.userId,
        body: messageBody,
        message_kind: isAnnouncement ? 'announcement' : 'message',
      })
      .select('id,sender_user_id,body,message_kind,created_at')
      .single()
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

    await auth.service
      .from('internal_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation.id)

    await notifyTeamRoom(auth.service, {
      conversationId: conversation.id,
      actorUserId: auth.userId,
      teamName: selected.team_name,
      scope: selected,
      body: messageBody,
      announcement: isAnnouncement,
    })

    return Response.json({ ok: true, message: toMessage(message as MessageRow, new Map(), auth.userId) })
  }

  if (action === 'create_invite') {
    if (!canManageTeamRoom(teamRoles(selected))) {
      return Response.json({ ok: false, message: 'Only a captain or co-captain can invite new team members.' }, { status: 403 })
    }
    const now = new Date().toISOString()
    const { data: existing } = await auth.service
      .from('team_room_invites')
      .select('invite_token,expires_at')
      .eq('conversation_id', conversation.id)
      .eq('created_by_user_id', auth.userId)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let token = cleanText(existing?.invite_token)
    let expiresAt = cleanText(existing?.expires_at)
    if (!token) {
      const { data, error } = await auth.service
        .from('team_room_invites')
        .insert({
          conversation_id: conversation.id,
          created_by_user_id: auth.userId,
          team_name: selected.team_name,
          normalized_team_name: selected.normalized_team_name,
          league_name: selected.league_name,
          flight: selected.flight,
        })
        .select('invite_token,expires_at')
        .single()
      if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
      token = cleanText(data.invite_token)
      expiresAt = cleanText(data.expires_at)
    }

    const inviteUrl = `${new URL(request.url).origin}/team-room/join?token=${encodeURIComponent(token)}`
    return Response.json({ ok: true, inviteUrl, expiresAt })
  }

  if (action === 'set_mute') {
    const muted = body.muted === true
    const { error } = await auth.service
      .from('internal_conversation_participants')
      .update({ muted })
      .eq('conversation_id', conversation.id)
      .eq('profile_id', auth.userId)
    if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })
    return Response.json({ ok: true, muted })
  }

  return Response.json({ ok: false, message: 'Choose a Team Room action.' }, { status: 400 })
}

async function loadTeamRoom(service: SupabaseClient, userId: string, selected: TeamLinkRow) {
  const ensured = await ensureTeamRoom(service, selected)
  if (!ensured.ok) return ensured
  const conversation = ensured.conversation
  const members = await syncTeamRoomParticipants(service, conversation.id, selected)

  const { data: messageRows, error: messageError } = await service
    .from('internal_messages')
    .select('id,sender_user_id,body,message_kind,created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true })
    .limit(300)
  if (messageError) return { ok: false as const, status: 500, message: messageError.message }

  const senderIds = Array.from(new Set(((messageRows ?? []) as MessageRow[]).map((row) => row.sender_user_id)))
  const profileById = await loadProfileMap(service, senderIds)
  await service
    .from('internal_conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversation.id)
    .eq('profile_id', userId)

  const currentParticipant = members.find((member) => member.id === userId)
  return {
    ok: true as const,
    room: {
      id: conversation.id,
      subject: conversation.subject || `${selected.team_name} Team Room`,
      teamName: selected.team_name,
      leagueName: selected.league_name,
      flight: selected.flight,
      roles: teamRoles(selected),
      canManage: canManageTeamRoom(teamRoles(selected)),
      muted: currentParticipant?.muted ?? false,
      members,
      messages: ((messageRows ?? []) as MessageRow[]).map((row) => toMessage(row, profileById, userId)),
      href: buildTeamRoomHref({
        teamName: selected.team_name,
        leagueName: selected.league_name,
        flight: selected.flight,
      }),
    },
  }
}

async function ensureTeamRoom(service: SupabaseClient, selected: TeamLinkRow) {
  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  let { data, error } = await service
    .from('internal_conversations')
    .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
    .eq('related_entity_type', 'team_room')
    .eq('related_entity_id', scopeId)
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }

  if (!data) {
    const inserted = await service
      .from('internal_conversations')
      .insert({
        conversation_type: 'team',
        subject: `${selected.team_name} Team Room`,
        status: 'open',
        created_by_user_id: selected.profile_user_id,
        related_entity_type: 'team_room',
        related_entity_id: scopeId,
        metadata: {
          entityType: 'team_room',
          entityId: scopeId,
          teamName: selected.team_name,
          leagueName: selected.league_name,
          flight: selected.flight,
        },
      })
      .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
      .single()
    data = inserted.data
    error = inserted.error
    if (error) {
      const raced = await service
        .from('internal_conversations')
        .select('id,subject,created_by_user_id,related_entity_id,created_at,updated_at')
        .eq('related_entity_type', 'team_room')
        .eq('related_entity_id', scopeId)
        .maybeSingle()
      if (raced.error || !raced.data) {
        return { ok: false as const, status: 500, message: raced.error?.message || error.message }
      }
      data = raced.data
    }
  }

  return { ok: true as const, conversation: data as ConversationRow }
}

async function syncTeamRoomParticipants(service: SupabaseClient, conversationId: string, selected: TeamLinkRow) {
  const { data: linkedRows } = await service
    .from('team_profile_links')
    .select('profile_user_id,team_role,team_roles,team_name,normalized_team_name,league_name,flight,status')
    .eq('normalized_team_name', selected.normalized_team_name)
    .eq('status', 'accepted')

  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const scopedLinks = ((linkedRows ?? []) as TeamLinkRow[]).filter((link) => buildTeamRoomScopeId({
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
  }) === scopeId)
  if (!scopedLinks.some((link) => link.profile_user_id === selected.profile_user_id)) scopedLinks.push(selected)

  const participantRows = scopedLinks.map((link) => ({
    conversation_id: conversationId,
    profile_id: link.profile_user_id,
    participant_role: canManageTeamRoom(teamRoles(link)) ? 'coordinator' : 'member',
  }))
  if (participantRows.length) {
    await service
      .from('internal_conversation_participants')
      .upsert(participantRows, { onConflict: 'conversation_id,profile_id' })
  }

  const { data: existingRows } = await service
    .from('internal_conversation_participants')
    .select('profile_id,participant_role,muted')
    .eq('conversation_id', conversationId)
  const activeIds = new Set(participantRows.map((row) => row.profile_id))
  const staleIds = ((existingRows ?? []) as ParticipantRow[])
    .map((row) => row.profile_id)
    .filter((id) => !activeIds.has(id))
  if (staleIds.length) {
    await service
      .from('internal_conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .in('profile_id', staleIds)
  }

  const profileById = await loadProfileMap(service, participantRows.map((row) => row.profile_id))
  const participantById = new Map(((existingRows ?? []) as ParticipantRow[]).map((row) => [row.profile_id, row]))
  return scopedLinks.map((link) => {
    const profile = profileById.get(link.profile_user_id)
    return {
      id: link.profile_user_id,
      name: profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || 'Team member',
      roles: teamRoles(link),
      muted: participantById.get(link.profile_user_id)?.muted === true,
    }
  }).sort((left, right) => left.name.localeCompare(right.name))
}

async function notifyTeamRoom(service: SupabaseClient, input: {
  conversationId: string
  actorUserId: string
  teamName: string
  scope: TeamLinkRow
  body: string
  announcement: boolean
}) {
  const { data } = await service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', input.conversationId)
  const recipients = ((data ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== input.actorUserId && row.muted !== true)
  if (!recipients.length) return

  await service.from('internal_notifications').insert(recipients.map((row) => ({
    recipient_profile_id: row.profile_id,
    actor_user_id: input.actorUserId,
    notification_type: 'message',
    title: input.announcement ? `${input.teamName} announcement` : `New message in ${input.teamName}`,
    body: input.body.slice(0, 180),
    href: buildTeamRoomHref({
      teamName: input.scope.team_name,
      leagueName: input.scope.league_name,
      flight: input.scope.flight,
    }),
    conversation_id: input.conversationId,
  })))
}

async function loadAcceptedTeamLinks(service: SupabaseClient, userId: string) {
  const { data, error } = await service
    .from('team_profile_links')
    .select('id,profile_user_id,team_name,normalized_team_name,league_name,flight,team_role,team_roles,is_default,updated_at')
    .eq('profile_user_id', userId)
    .eq('status', 'accepted')
    .order('is_default', { ascending: false })
    .order('updated_at', { ascending: false })
  if (error) return { ok: false as const, message: error.message, links: [] as TeamLinkRow[] }
  return { ok: true as const, links: (data ?? []) as TeamLinkRow[] }
}

function selectTeamLink(links: TeamLinkRow[], scope: {
  teamName?: string | null
  leagueName?: string | null
  flight?: string | null
}) {
  const teamKey = normalizeTeamRoomKey(scope.teamName)
  if (!teamKey) return links[0] ?? null
  const teamMatches = links.filter((link) => normalizeTeamRoomKey(link.team_name) === teamKey)
  if (!teamMatches.length) return null
  const requestedScopeId = buildTeamRoomScopeId({
    teamName: scope.teamName || '',
    leagueName: scope.leagueName || '',
    flight: scope.flight || '',
  })
  return teamMatches.find((link) => buildTeamRoomScopeId({
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
  }) === requestedScopeId) ?? teamMatches[0]
}

function toTeamOption(link: TeamLinkRow) {
  return {
    teamName: link.team_name,
    leagueName: link.league_name,
    flight: link.flight,
    roles: teamRoles(link),
    isDefault: link.is_default === true,
    href: buildTeamRoomHref({ teamName: link.team_name, leagueName: link.league_name, flight: link.flight }),
  }
}

function teamRoles(link: TeamLinkRow) {
  const roles = Array.isArray(link.team_roles) ? link.team_roles.filter(Boolean) : []
  return roles.length ? roles : [link.team_role || 'player']
}

async function loadProfileMap(service: SupabaseClient, ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)))
  if (!uniqueIds.length) return new Map<string, ProfileRow>()
  const { data } = await service
    .from('profiles')
    .select('id,message_display_name,linked_player_name,role')
    .in('id', uniqueIds)
  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
}

function toMessage(row: MessageRow, profileById: Map<string, ProfileRow>, currentUserId: string) {
  const profile = profileById.get(row.sender_user_id)
  return {
    id: row.id,
    senderUserId: row.sender_user_id,
    senderName: profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || 'Team member',
    body: row.body,
    kind: row.message_kind === 'announcement'
      ? 'announcement'
      : row.message_kind === 'system' ? 'system' : 'message',
    createdAt: row.created_at || '',
    isMine: row.sender_user_id === currentUserId,
  }
}

async function getTeamRoomAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to open your Team Room.' }, { status: 401 }) }
  }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to open your Team Room.' }, { status: 401 }) }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team Rooms are not configured yet.' }, { status: 503 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { ok: true as const, service, userId: data.user.id }
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
