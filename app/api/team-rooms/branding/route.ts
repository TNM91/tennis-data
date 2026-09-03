import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildTeamRoomScopeId, canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'

export const runtime = 'nodejs'

const MAX_LOGO_BYTES = 2 * 1024 * 1024
const ALLOWED_LOGO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

type TeamLinkRow = {
  profile_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  team_role: string
  team_roles: string[] | null
}

export async function POST(request: Request) {
  const auth = await getTeamBrandingAuth(request)
  if (!auth.ok) return auth.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ ok: false, message: 'The team logo could not be read.' }, { status: 400 })
  }
  const file = form.get('file')
  if (!(file instanceof File) || file.size < 1) {
    return Response.json({ ok: false, message: 'Choose a team logo first.' }, { status: 400 })
  }
  if (file.size > MAX_LOGO_BYTES) {
    return Response.json({ ok: false, message: 'Team logos must be 2 MB or smaller.' }, { status: 400 })
  }
  if (!ALLOWED_LOGO_TYPES.has(file.type)) {
    return Response.json({ ok: false, message: 'Use a JPG, PNG, or WebP team logo.' }, { status: 400 })
  }

  const selected = await loadSelectedTeamLink(auth.service, auth.userId, {
    teamName: cleanText(form.get('teamName')),
    leagueName: cleanText(form.get('leagueName')),
    flight: cleanText(form.get('flight')),
  })
  if (!selected) return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  if (!canManageTeamRoom(teamRoles(selected))) {
    return Response.json({ ok: false, message: 'Only a captain or co-captain can update the team logo.' }, { status: 403 })
  }

  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const { data: conversation, error: conversationError } = await auth.service
    .from('internal_conversations')
    .select('id,metadata')
    .eq('related_entity_type', 'team_room')
    .eq('related_entity_id', scopeId)
    .maybeSingle()
  if (conversationError) return Response.json({ ok: false, message: conversationError.message }, { status: 500 })
  if (!conversation?.id) return Response.json({ ok: false, message: 'Open Team Chat before adding a logo.' }, { status: 404 })

  const { data: participant } = await auth.service
    .from('internal_conversation_participants')
    .select('profile_id')
    .eq('conversation_id', conversation.id)
    .eq('profile_id', auth.userId)
    .maybeSingle()
  if (!participant) return Response.json({ ok: false, message: 'You no longer have access to this Team Chat.' }, { status: 403 })

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : 'webp'
  const path = `team-logos/${conversation.id}/${crypto.randomUUID()}.${extension}`
  const upload = await auth.service.storage.from('team-room-files').upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) return Response.json({ ok: false, message: upload.error.message }, { status: 500 })

  const previousMetadata = conversation.metadata && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
    ? conversation.metadata as Record<string, unknown>
    : {}
  const previousLogo = readTeamLogo(previousMetadata)
  const metadata = {
    ...previousMetadata,
    teamLogo: { bucket: 'team-room-files', path, mimeType: file.type },
  }
  const { error: updateError } = await auth.service
    .from('internal_conversations')
    .update({ metadata, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)
  if (updateError) {
    await auth.service.storage.from('team-room-files').remove([path])
    return Response.json({ ok: false, message: updateError.message }, { status: 500 })
  }
  if (previousLogo?.path && previousLogo.path !== path) {
    await auth.service.storage.from(previousLogo.bucket).remove([previousLogo.path])
  }

  return Response.json({ ok: true })
}

async function loadSelectedTeamLink(service: SupabaseClient, userId: string, scope: {
  teamName: string
  leagueName: string
  flight: string
}) {
  const { data } = await service
    .from('team_profile_links')
    .select('profile_user_id,team_name,normalized_team_name,league_name,flight,team_role,team_roles')
    .eq('profile_user_id', userId)
    .eq('status', 'accepted')
  const links = (data ?? []) as TeamLinkRow[]
  const key = normalizeTeamRoomKey(scope.teamName)
  return links.find((link) => (
    normalizeTeamRoomKey(link.team_name) === key
    && buildTeamRoomScopeId({ teamName: link.team_name, leagueName: link.league_name, flight: link.flight })
      === buildTeamRoomScopeId(scope)
  )) || null
}

async function getTeamBrandingAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to update the team logo.' }, { status: 401 }) }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to update the team logo.' }, { status: 401 }) }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) return { ok: false as const, response: Response.json({ ok: false, message: 'Team branding is not configured yet.' }, { status: 503 }) }
  return {
    ok: true as const,
    userId: data.user.id,
    service: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function readTeamLogo(metadata: Record<string, unknown>) {
  const raw = metadata.teamLogo
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const logo = raw as Record<string, unknown>
  const bucket = cleanText(logo.bucket)
  const path = cleanText(logo.path)
  return bucket === 'team-room-files' && path ? { bucket, path } : null
}

function teamRoles(link: TeamLinkRow) {
  const roles = Array.isArray(link.team_roles) ? link.team_roles.filter(Boolean) : []
  return roles.length ? roles : [link.team_role || 'player']
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
