import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildTeamRoomHref } from '@/lib/team-room'

export const runtime = 'nodejs'

type InviteRow = {
  id: string
  invite_token: string
  conversation_id: string
  created_by_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  expires_at: string
  accepted_count: number | null
  revoked_at: string | null
}

export async function GET(request: Request) {
  const auth = await getJoinAuth(request)
  if (!auth.ok) return auth.response
  const token = new URL(request.url).searchParams.get('token')?.trim() || ''
  const invite = await loadInvite(auth.service, token)
  if (!invite.ok) return Response.json({ ok: false, message: invite.message }, { status: invite.status })

  const { data: existing } = await auth.service
    .from('team_profile_links')
    .select('id,status')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', invite.row.normalized_team_name)
    .eq('league_name', invite.row.league_name)
    .eq('flight', invite.row.flight)
    .maybeSingle()

  return Response.json({
    ok: true,
    invite: {
      teamName: invite.row.team_name,
      leagueName: invite.row.league_name,
      flight: invite.row.flight,
      expiresAt: invite.row.expires_at,
      alreadyJoined: existing?.status === 'accepted',
      roomHref: buildTeamRoomHref({
        teamName: invite.row.team_name,
        leagueName: invite.row.league_name,
        flight: invite.row.flight,
      }),
    },
  })
}

export async function POST(request: Request) {
  const auth = await getJoinAuth(request)
  if (!auth.ok) return auth.response
  let token = ''
  try {
    const body = await request.json() as { token?: unknown }
    token = typeof body.token === 'string' ? body.token.trim() : ''
  } catch {
    return Response.json({ ok: false, message: 'Invalid team invite.' }, { status: 400 })
  }

  const invite = await loadInvite(auth.service, token)
  if (!invite.ok) return Response.json({ ok: false, message: invite.message }, { status: invite.status })
  const row = invite.row
  const now = new Date().toISOString()

  const { count } = await auth.service
    .from('team_profile_links')
    .select('id', { count: 'exact', head: true })
    .eq('profile_user_id', auth.userId)
    .eq('status', 'accepted')

  const { data: existing } = await auth.service
    .from('team_profile_links')
    .select('id,status,accepted_at,is_default,team_roles,role_accepted_at')
    .eq('profile_user_id', auth.userId)
    .eq('normalized_team_name', row.normalized_team_name)
    .eq('league_name', row.league_name)
    .eq('flight', row.flight)
    .maybeSingle()

  const existingRoles = Array.isArray(existing?.team_roles) ? existing.team_roles.filter(Boolean) : []
  const roles = Array.from(new Set([...existingRoles, 'player']))
  const roleAcceptedAt = {
    ...((existing?.role_accepted_at && typeof existing.role_accepted_at === 'object') ? existing.role_accepted_at : {}),
    player: ((existing?.role_accepted_at as Record<string, unknown> | null)?.player as string | undefined) || now,
  }
  const { error: linkError } = await auth.service
    .from('team_profile_links')
    .upsert({
      profile_user_id: auth.userId,
      source_actor_user_id: row.created_by_user_id,
      team_name: row.team_name,
      normalized_team_name: row.normalized_team_name,
      league_name: row.league_name,
      flight: row.flight,
      team_role: roles.includes('captain') ? 'captain' : roles.includes('co_captain') ? 'co_captain' : 'player',
      team_roles: roles,
      declined_roles: [],
      role_accepted_at: roleAcceptedAt,
      source_type: 'manual_invite',
      source_record_id: row.id,
      status: 'accepted',
      accepted_at: existing?.accepted_at || now,
      unlinked_at: null,
      is_default: existing?.is_default === true || (count ?? 0) === 0,
      updated_at: now,
    }, { onConflict: 'profile_user_id,normalized_team_name,league_name,flight' })
  if (linkError) return Response.json({ ok: false, message: linkError.message }, { status: 500 })

  const { error: participantError } = await auth.service
    .from('internal_conversation_participants')
    .upsert({
      conversation_id: row.conversation_id,
      profile_id: auth.userId,
      participant_role: roles.includes('captain') || roles.includes('co_captain') ? 'coordinator' : 'member',
      last_read_at: now,
    }, { onConflict: 'conversation_id,profile_id' })
  if (participantError) return Response.json({ ok: false, message: participantError.message }, { status: 500 })

  await auth.service
    .from('team_room_invites')
    .update({ accepted_count: Math.max(0, row.accepted_count ?? 0) + (existing?.status === 'accepted' ? 0 : 1) })
    .eq('id', row.id)

  if (!existing || existing.status !== 'accepted') {
    const { data: profile } = await auth.service
      .from('profiles')
      .select('message_display_name,linked_player_name')
      .eq('id', auth.userId)
      .maybeSingle()
    const displayName = profile?.message_display_name?.trim() || profile?.linked_player_name?.trim() || 'A new teammate'
    await auth.service.from('internal_messages').insert({
      conversation_id: row.conversation_id,
      sender_user_id: auth.userId,
      body: `${displayName} joined the Team Room.`,
      message_kind: 'system',
    })
    await auth.service
      .from('internal_conversations')
      .update({ updated_at: now })
      .eq('id', row.conversation_id)
  }

  if ((count ?? 0) === 0) {
    await auth.service.from('profiles').update({
      linked_team_name: row.team_name,
      linked_league_name: row.league_name,
      linked_flight: row.flight,
      linked_team_at: now,
    }).eq('id', auth.userId)
  }

  return Response.json({
    ok: true,
    roomHref: buildTeamRoomHref({ teamName: row.team_name, leagueName: row.league_name, flight: row.flight }),
  })
}

async function loadInvite(service: SupabaseClient, token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) {
    return { ok: false as const, status: 404, message: 'This team invite is invalid.' }
  }
  const { data, error } = await service
    .from('team_room_invites')
    .select('id,invite_token,conversation_id,created_by_user_id,team_name,normalized_team_name,league_name,flight,expires_at,accepted_count,revoked_at')
    .eq('invite_token', token)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) return { ok: false as const, status: 500, message: error.message }
  if (!data) return { ok: false as const, status: 404, message: 'This team invite has expired or is no longer active.' }
  return { ok: true as const, row: data as InviteRow }
}

async function getJoinAuth(request: Request) {
  const value = request.headers.get('authorization') || ''
  const token = value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to join this team.' }, { status: 401 }) }
  }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to join this team.' }, { status: 401 }) }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team invites are not configured yet.' }, { status: 503 }) }
  }
  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return { ok: true as const, service, userId: data.user.id }
}
