import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'
import { buildTeamRoomHref, buildTeamRoomScopeId, canManageTeamRoom, normalizeTeamRoomKey } from '@/lib/team-room'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])

type TeamLinkRow = {
  profile_user_id: string
  team_name: string
  normalized_team_name: string
  league_name: string
  flight: string
  team_role: string
  team_roles: string[] | null
}

type ParticipantRow = {
  profile_id: string
  muted: boolean | null
}

export async function POST(request: Request) {
  const auth = await getAttachmentAuth(request)
  if (!auth.ok) return auth.response

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ ok: false, message: 'The attachment could not be read.' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File) || file.size < 1) {
    return Response.json({ ok: false, message: 'Choose a photo or PDF first.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return Response.json({ ok: false, message: 'Attachments must be 5 MB or smaller.' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return Response.json({ ok: false, message: 'Use a JPG, PNG, WebP, or PDF file.' }, { status: 400 })
  }

  const selected = await loadSelectedTeamLink(auth.service, auth.userId, {
    teamName: cleanText(form.get('teamName')),
    leagueName: cleanText(form.get('leagueName')),
    flight: cleanText(form.get('flight')),
  })
  if (!selected) {
    return Response.json({ ok: false, message: 'This team is not linked to your profile.' }, { status: 403 })
  }

  const scopeId = buildTeamRoomScopeId({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const { data: conversation, error: conversationError } = await auth.service
    .from('internal_conversations')
    .select('id')
    .eq('related_entity_type', 'team_room')
    .eq('related_entity_id', scopeId)
    .maybeSingle()
  if (conversationError) return Response.json({ ok: false, message: conversationError.message }, { status: 500 })
  if (!conversation?.id) return Response.json({ ok: false, message: 'Open Team Chat before sharing a file.' }, { status: 404 })

  const { data: participant, error: participantError } = await auth.service
    .from('internal_conversation_participants')
    .select('profile_id')
    .eq('conversation_id', conversation.id)
    .eq('profile_id', auth.userId)
    .maybeSingle()
  if (participantError) return Response.json({ ok: false, message: participantError.message }, { status: 500 })
  if (!participant) {
    return Response.json({ ok: false, message: 'You no longer have access to this Team Chat.' }, { status: 403 })
  }

  const isAnnouncement = cleanText(form.get('announcement')) === 'true'
  if (isAnnouncement && !canManageTeamRoom(teamRoles(selected))) {
    return Response.json({ ok: false, message: 'Only a captain or co-captain can post an announcement.' }, { status: 403 })
  }

  const replyToMessageId = cleanText(form.get('replyToMessageId'))
  if (replyToMessageId) {
    const { data: replyTarget } = await auth.service
      .from('internal_messages')
      .select('id')
      .eq('id', replyToMessageId)
      .eq('conversation_id', conversation.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!replyTarget) return Response.json({ ok: false, message: 'The message you replied to is no longer available.' }, { status: 400 })
  }

  const safeName = sanitizeFileName(file.name)
  const storagePath = `${conversation.id}/${auth.userId}/${crypto.randomUUID()}-${safeName}`
  const bytes = Buffer.from(await file.arrayBuffer())
  const upload = await auth.service.storage.from('team-room-files').upload(storagePath, bytes, {
    contentType: file.type,
    upsert: false,
  })
  if (upload.error) return Response.json({ ok: false, message: upload.error.message }, { status: 500 })

  const caption = cleanText(form.get('body')).slice(0, 2200)
  const messageBody = caption || `Shared ${file.name.slice(0, 180)}.`
  const { data: message, error: messageError } = await auth.service
    .from('internal_messages')
    .insert({
      conversation_id: conversation.id,
      sender_user_id: auth.userId,
      body: messageBody,
      message_kind: isAnnouncement ? 'announcement' : 'message',
      reply_to_message_id: replyToMessageId || null,
      metadata: {
        teamRoomAttachment: {
          bucket: 'team-room-files',
          path: storagePath,
          name: file.name.slice(0, 180),
          mimeType: file.type,
          size: file.size,
        },
      },
    })
    .select('id')
    .single()
  if (messageError) {
    await auth.service.storage.from('team-room-files').remove([storagePath])
    return Response.json({ ok: false, message: messageError.message }, { status: 500 })
  }

  await auth.service
    .from('internal_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversation.id)

  const href = buildTeamRoomHref({
    teamName: selected.team_name,
    leagueName: selected.league_name,
    flight: selected.flight,
  })
  const { data: participants } = await auth.service
    .from('internal_conversation_participants')
    .select('profile_id,muted')
    .eq('conversation_id', conversation.id)
  const recipients = ((participants ?? []) as ParticipantRow[])
    .filter((row) => row.profile_id !== auth.userId && row.muted !== true)
    .map((row) => row.profile_id)
  if (recipients.length) {
    const title = isAnnouncement ? `${selected.team_name} announcement` : `New file in ${selected.team_name}`
    const notificationBody = caption || `${file.name} was shared with the team.`
    await auth.service.from('internal_notifications').insert(recipients.map((profileId) => ({
      recipient_profile_id: profileId,
      actor_user_id: auth.userId,
      notification_type: 'message',
      title,
      body: notificationBody.slice(0, 180),
      href,
      conversation_id: conversation.id,
    })))
    await sendTeamRoomPush(auth.service, recipients, {
      title,
      body: notificationBody.slice(0, 180),
      href,
      tag: `team-room-${conversation.id}`,
    })
  }

  return Response.json({ ok: true, messageId: message.id })
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
  const teamKey = normalizeTeamRoomKey(scope.teamName)
  return links.find((link) => (
    normalizeTeamRoomKey(link.team_name) === teamKey
    && buildTeamRoomScopeId({ teamName: link.team_name, leagueName: link.league_name, flight: link.flight })
      === buildTeamRoomScopeId(scope)
  )) || null
}

async function getAttachmentAuth(request: Request) {
  const token = getBearerToken(request)
  if (!token) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to share team files.' }, { status: 401 }) }
  }
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await authClient.auth.getUser(token)
  if (error || !data.user) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Sign in to share team files.' }, { status: 401 }) }
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!serviceKey) {
    return { ok: false as const, response: Response.json({ ok: false, message: 'Team files are not configured yet.' }, { status: 503 }) }
  }
  return {
    ok: true as const,
    userId: data.user.id,
    service: createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    }),
  }
}

function teamRoles(link: TeamLinkRow) {
  const roles = Array.isArray(link.team_roles) ? link.team_roles.filter(Boolean) : []
  return roles.length ? roles : [link.team_role || 'player']
}

function sanitizeFileName(value: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return (cleaned || 'team-file').slice(-160)
}

function getBearerToken(request: Request) {
  const value = request.headers.get('authorization') || ''
  return value.toLowerCase().startsWith('bearer ') ? value.slice('bearer '.length).trim() : ''
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
