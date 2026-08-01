import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import {
  buildTeamConnectionKey,
  buildTeamConnections,
  mapRosterContactCandidate,
  mapRosterMembershipCandidate,
  type TeamConnection,
  type TeamConnectionContactRow,
  type TeamConnectionRosterRow,
  type TeamProfileLinkRow,
} from '@/lib/team-profile-links'

export const runtime = 'nodejs'

const TEAM_LINK_SELECT =
  'id,team_name,normalized_team_name,league_name,flight,team_role,matched_player_id,source_type,source_record_id,status,updated_at'

type TeamConnectionAction = 'accept' | 'decline' | 'unlink' | 'relink'

type TeamConnectionActionBody = {
  action?: unknown
  connectionId?: unknown
}

type ProfileConnectionRow = {
  linked_player_id?: string | null
  linked_player_name?: string | null
  linked_team_name?: string | null
  linked_league_name?: string | null
  linked_flight?: string | null
}

export async function GET(request: Request) {
  const auth = await getTeamConnectionAuth(request)
  if (!auth.ok) return auth.response

  const result = await loadTeamConnections(auth.service, auth.userId, auth.email)
  if (!result.ok) return Response.json({ ok: false, message: result.message }, { status: 500 })

  return Response.json({
    ok: true,
    pending: result.pending,
    connections: result.connections,
    captainOffer: getCaptainInviteOffer(),
  })
}

export async function POST(request: Request) {
  const auth = await getTeamConnectionAuth(request)
  if (!auth.ok) return auth.response

  let body: TeamConnectionActionBody
  try {
    body = (await request.json()) as TeamConnectionActionBody
  } catch {
    return Response.json({ ok: false, message: 'Invalid team connection request.' }, { status: 400 })
  }

  const action = normalizeAction(body.action)
  const connectionId = cleanText(body.connectionId)
  if (!action || !connectionId) {
    return Response.json({ ok: false, message: 'Choose a team connection action.' }, { status: 400 })
  }

  if (action === 'unlink' || action === 'relink') {
    const savedResult = await updateSavedConnection({
      service: auth.service,
      userId: auth.userId,
      connectionId,
      action,
    })
    if (!savedResult.ok) {
      return Response.json({ ok: false, message: savedResult.message }, { status: savedResult.status })
    }
    return Response.json({ ok: true, connection: savedResult.connection })
  }

  const candidateResult = await resolveDiscoveredCandidate({
    service: auth.service,
    userId: auth.userId,
    email: auth.email,
    candidateId: connectionId,
  })
  if (!candidateResult.ok) {
    return Response.json({ ok: false, message: candidateResult.message }, { status: candidateResult.status })
  }

  const now = new Date().toISOString()
  const candidate = candidateResult.candidate
  const payload = {
    profile_user_id: auth.userId,
    source_actor_user_id: candidateResult.sourceActorUserId || null,
    team_name: candidate.teamName,
    normalized_team_name: normalizeKey(candidate.teamName),
    league_name: candidate.leagueName,
    flight: candidate.flight,
    team_role: candidate.role,
    matched_player_id: candidateResult.matchedPlayerId || candidate.matchedPlayerId || null,
    source_type: candidate.sourceType,
    source_record_id: candidate.sourceRecordId || null,
    status: action === 'accept' ? 'accepted' : 'declined',
    accepted_at: action === 'accept' ? now : null,
    unlinked_at: null,
    updated_at: now,
  }

  const { data, error } = await auth.service
    .from('team_profile_links')
    .upsert(payload, {
      onConflict: 'profile_user_id,normalized_team_name,league_name,flight',
    })
    .select(TEAM_LINK_SELECT)
    .single()

  if (error) return Response.json({ ok: false, message: error.message }, { status: 500 })

  if (action === 'accept') {
    await linkAcceptedTeamToProfile({
      service: auth.service,
      userId: auth.userId,
      candidate,
      matchedPlayerId: candidateResult.matchedPlayerId || candidate.matchedPlayerId,
      matchedPlayerName: candidateResult.matchedPlayerName,
    })
  }

  const connections = buildTeamConnections({ savedLinks: [data as TeamProfileLinkRow] }).connections
  return Response.json({ ok: true, connection: connections[0] ?? null })
}

async function loadTeamConnections(service: SupabaseClient, userId: string, email: string) {
  const { data: profileData, error: profileError } = await service
    .from('profiles')
    .select('linked_player_id')
    .eq('id', userId)
    .maybeSingle()

  if (profileError) return { ok: false as const, message: profileError.message }
  const linkedPlayerId = cleanText((profileData as ProfileConnectionRow | null)?.linked_player_id)

  const [contactsResult, rosterResult, savedResult] = await Promise.all([
    email
      ? service
          .from('captain_roster_contacts')
          .select('id,captain_user_id,team_name,normalized_team_name,league_name,flight,role,email,normalized_name,updated_at')
          .eq('email', email)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    linkedPlayerId
      ? service
          .from('team_roster_members')
          .select('id,team_name,normalized_team_name,league_name,flight,player_id,updated_at')
          .eq('player_id', linkedPlayerId)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    service
      .from('team_profile_links')
      .select(TEAM_LINK_SELECT)
      .eq('profile_user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ])

  const error = contactsResult.error || rosterResult.error || savedResult.error
  if (error) return { ok: false as const, message: error.message }

  const built = buildTeamConnections({
    contacts: (contactsResult.data || []) as TeamConnectionContactRow[],
    rosterMemberships: (rosterResult.data || []) as TeamConnectionRosterRow[],
    savedLinks: (savedResult.data || []) as TeamProfileLinkRow[],
  })

  return { ok: true as const, ...built }
}

async function resolveDiscoveredCandidate(input: {
  service: SupabaseClient
  userId: string
  email: string
  candidateId: string
}) {
  const [sourceType, sourceRecordId] = input.candidateId.split(':', 2)
  if (!sourceRecordId) {
    return { ok: false as const, status: 400, message: 'This team connection is invalid.' }
  }

  if (sourceType === 'roster_contact') {
    const { data, error } = await input.service
      .from('captain_roster_contacts')
      .select('id,captain_user_id,team_name,normalized_team_name,league_name,flight,role,email,normalized_name,updated_at')
      .eq('id', sourceRecordId)
      .maybeSingle()

    if (error) return { ok: false as const, status: 500, message: error.message }
    const row = data as TeamConnectionContactRow | null
    if (!row || cleanText(row.email).toLowerCase() !== input.email) {
      return { ok: false as const, status: 403, message: 'This team connection belongs to another account.' }
    }

    const candidate = mapRosterContactCandidate(row)
    if (!candidate) return { ok: false as const, status: 404, message: 'This team connection is no longer available.' }
    const playerMatch = await findRosterPlayerForContact(input.service, row)
    return {
      ok: true as const,
      candidate,
      sourceActorUserId: cleanText(row.captain_user_id),
      matchedPlayerId: playerMatch.playerId,
      matchedPlayerName: playerMatch.playerName,
    }
  }

  if (sourceType === 'roster_membership') {
    const [{ data: profileData, error: profileError }, { data, error }] = await Promise.all([
      input.service.from('profiles').select('linked_player_id').eq('id', input.userId).maybeSingle(),
      input.service
        .from('team_roster_members')
        .select('id,team_name,normalized_team_name,league_name,flight,player_id,player_name,updated_at')
        .eq('id', sourceRecordId)
        .maybeSingle(),
    ])
    if (profileError || error) {
      return { ok: false as const, status: 500, message: profileError?.message || error?.message || 'Team connection failed.' }
    }
    const row = data as (TeamConnectionRosterRow & { player_name?: string | null }) | null
    const profilePlayerId = cleanText((profileData as ProfileConnectionRow | null)?.linked_player_id)
    if (!row || !profilePlayerId || cleanText(row.player_id) !== profilePlayerId) {
      return { ok: false as const, status: 403, message: 'This roster membership belongs to another player.' }
    }
    const candidate = mapRosterMembershipCandidate(row)
    if (!candidate) return { ok: false as const, status: 404, message: 'This roster membership is no longer available.' }
    return {
      ok: true as const,
      candidate,
      sourceActorUserId: '',
      matchedPlayerId: profilePlayerId,
      matchedPlayerName: cleanText(row.player_name),
    }
  }

  return { ok: false as const, status: 400, message: 'This team connection type is not supported.' }
}

async function findRosterPlayerForContact(service: SupabaseClient, contact: TeamConnectionContactRow) {
  const normalizedName = cleanText(contact.normalized_name)
  const normalizedTeamName = cleanText(contact.normalized_team_name) || normalizeKey(contact.team_name)
  if (!normalizedName || !normalizedTeamName) return { playerId: '', playerName: '' }

  const { data } = await service
    .from('team_roster_members')
    .select('player_id,player_name')
    .eq('normalized_team_name', normalizedTeamName)
    .eq('league_name', cleanText(contact.league_name))
    .eq('flight', cleanText(contact.flight))
    .limit(100)

  const match = ((data || []) as Array<{ player_id?: string | null; player_name?: string | null }>).find(
    (row) => normalizeKey(row.player_name) === normalizedName,
  )
  return {
    playerId: cleanText(match?.player_id),
    playerName: cleanText(match?.player_name),
  }
}

async function updateSavedConnection(input: {
  service: SupabaseClient
  userId: string
  connectionId: string
  action: 'unlink' | 'relink'
}) {
  const { data: existing, error: loadError } = await input.service
    .from('team_profile_links')
    .select(TEAM_LINK_SELECT)
    .eq('id', input.connectionId)
    .eq('profile_user_id', input.userId)
    .maybeSingle()

  if (loadError) return { ok: false as const, status: 500, message: loadError.message }
  if (!existing) return { ok: false as const, status: 404, message: 'Team connection was not found.' }

  const now = new Date().toISOString()
  const status = input.action === 'relink' ? 'accepted' : 'unlinked'
  const update = input.action === 'relink'
    ? { status, accepted_at: now, unlinked_at: null, updated_at: now }
    : { status, unlinked_at: now, updated_at: now }
  const { data, error } = await input.service
    .from('team_profile_links')
    .update(update)
    .eq('id', input.connectionId)
    .eq('profile_user_id', input.userId)
    .select(TEAM_LINK_SELECT)
    .single()

  if (error) return { ok: false as const, status: 500, message: error.message }

  const connection = buildTeamConnections({ savedLinks: [data as TeamProfileLinkRow] }).connections[0] ?? null
  if (input.action === 'relink' && connection) {
    await linkAcceptedTeamToProfile({ service: input.service, userId: input.userId, candidate: connection })
  } else if (input.action === 'unlink' && connection) {
    await clearProfileTeamIfMatching(input.service, input.userId, connection)
  }
  return { ok: true as const, connection }
}

async function linkAcceptedTeamToProfile(input: {
  service: SupabaseClient
  userId: string
  candidate: TeamConnection
  matchedPlayerId?: string
  matchedPlayerName?: string
}) {
  const { data } = await input.service
    .from('profiles')
    .select('linked_player_id,linked_player_name,linked_team_name,linked_league_name,linked_flight')
    .eq('id', input.userId)
    .maybeSingle()

  const profile = (data || {}) as ProfileConnectionRow
  const update: Record<string, string | null> = {}
  if (!cleanText(profile.linked_player_id) && cleanText(input.matchedPlayerId)) {
    update.linked_player_id = cleanText(input.matchedPlayerId)
    update.linked_player_name = cleanText(input.matchedPlayerName) || null
  }
  if (!cleanText(profile.linked_team_name)) {
    update.linked_team_name = input.candidate.teamName
    update.linked_league_name = input.candidate.leagueName
    update.linked_flight = input.candidate.flight
    update.linked_team_at = new Date().toISOString()
  }
  if (Object.keys(update).length) await input.service.from('profiles').update(update).eq('id', input.userId)
}

async function clearProfileTeamIfMatching(service: SupabaseClient, userId: string, connection: TeamConnection) {
  const { data } = await service
    .from('profiles')
    .select('linked_team_name,linked_league_name,linked_flight')
    .eq('id', userId)
    .maybeSingle()
  const profile = (data || {}) as ProfileConnectionRow
  if (buildTeamConnectionKey({
    teamName: profile.linked_team_name,
    leagueName: profile.linked_league_name,
    flight: profile.linked_flight,
    role: connection.role,
  }) !== buildTeamConnectionKey(connection)) return

  await service.from('profiles').update({
    linked_team_name: null,
    linked_league_name: null,
    linked_flight: null,
    linked_team_at: null,
  }).eq('id', userId)
}

async function getTeamConnectionAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to review team connections.' }, { status: 401 }) }
  }

  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to review team connections.' }, { status: 401 }) }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team connections are not configured yet.' }, { status: 503 }) }
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  return {
    ok: true as const,
    service,
    userId: data.user.id,
    email: cleanText(data.user.email).toLowerCase(),
  }
}

function getCaptainInviteOffer() {
  const couponConfigured = Boolean(process.env.STRIPE_CAPTAIN_TEAM_INVITE_COUPON_ID?.trim())
  return {
    available: couponConfigured,
    label: couponConfigured
      ? cleanText(process.env.CAPTAIN_TEAM_INVITE_OFFER_LABEL) || 'Captain invitation offer'
      : '',
  }
}

function normalizeAction(value: unknown): TeamConnectionAction | null {
  return value === 'accept' || value === 'decline' || value === 'unlink' || value === 'relink' ? value : null
}

function getBearerToken(request: Request) {
  const authHeader = request.headers.get('authorization')
  return authHeader?.toLowerCase().startsWith('bearer ')
    ? authHeader.slice('bearer '.length).trim()
    : ''
}

function normalizeKey(value: string | null | undefined) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
