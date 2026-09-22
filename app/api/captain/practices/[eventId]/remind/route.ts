import { createClient } from '@supabase/supabase-js'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { practiceRsvpPath } from '@/lib/captain-practice-rsvp'
import { sendTeamRoomPush } from '@/lib/team-room-push-server'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : ''
  if (!token) return Response.json({ ok: false, message: 'Sign in to remind your team.' }, { status: 401 })
  const authClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
  const { data: userData } = await authClient.auth.getUser(token)
  const userId = userData.user?.id || ''
  if (!userId) return Response.json({ ok: false, message: 'Sign in to remind your team.' }, { status: 401 })

  const eventId = (await params).eventId
  const service = getCaptainAvailabilityServiceClient()
  const { data: invite } = await service
    .from('captain_practice_invites')
    .select('id,public_token,created_by_user_id,internal_schedule_events(title,scheduled_date,scheduled_time,facility,conversation_id,metadata)')
    .eq('event_id', eventId)
    .maybeSingle()
  if (!invite || invite.created_by_user_id !== userId) {
    return Response.json({ ok: false, message: 'Only the captain who created this practice can send reminders.' }, { status: 403 })
  }

  const { data: waiting, error } = await service
    .from('captain_practice_invitees')
    .select('player_name,phone,profile_id')
    .eq('invite_id', invite.id)
    .eq('response_status', 'unanswered')
    .order('player_name', { ascending: true })
  if (error) return Response.json({ ok: false, message: 'The waiting list could not be checked.' }, { status: 500 })
  const rows = (waiting ?? []) as Array<{ player_name: string; phone: string; profile_id: string | null }>
  if (!rows.length) return Response.json({ ok: true, count: 0, phoneCount: 0, message: 'Everyone has replied.' })

  const event = invite.internal_schedule_events as unknown as {
    title: string
    scheduled_date: string
    scheduled_time: string
    facility: string
    conversation_id: string
    metadata: Record<string, unknown> | null
  } | null
  const teamName = typeof event?.metadata?.teamName === 'string'
    ? event.metadata.teamName
    : event?.title.replace(/ practice$/i, '') || 'Team'
  const responsePath = practiceRsvpPath(invite.public_token)
  const responseUrl = new URL(responsePath, request.url).toString()
  const when = [event?.scheduled_date, event?.scheduled_time].filter(Boolean).join(' at ')
  const reminderBody = `${teamName} practice${when ? ` · ${when}` : ''}\nPlease mark In, Out, or Maybe: ${responseUrl}`
  const phones = Array.from(new Set(rows.map((row) => cleanPhone(row.phone)).filter(Boolean)))
  const profileIds = Array.from(new Set(rows.map((row) => row.profile_id).filter((id): id is string => Boolean(id))))
  if (profileIds.length) {
    await service.from('internal_notifications').insert(profileIds.map((profileId) => ({
      recipient_profile_id: profileId,
      actor_user_id: userId,
      notification_type: 'schedule',
      title: `${teamName} practice needs your RSVP`,
      body: 'Mark In, Out, or Maybe so your captain can plan practice.',
      href: responsePath,
      conversation_id: event?.conversation_id || null,
    })))
    await sendTeamRoomPush(service, profileIds, {
      title: `${teamName} practice needs your RSVP`,
      body: 'Mark In, Out, or Maybe so your captain can plan practice.',
      href: responsePath,
      tag: `practice-${eventId}`,
    })
  }

  return Response.json({
    ok: true,
    count: rows.length,
    phoneCount: phones.length,
    names: rows.map((row) => row.player_name),
    reminderBody,
    smsHref: phones.length ? `sms:${phones.join(',')}?&body=${encodeURIComponent(reminderBody)}` : '',
    message: `Reminder prepared for ${rows.length} unanswered player${rows.length === 1 ? '' : 's'}.`,
  })
}

function cleanPhone(value: string) {
  const digits = (value || '').replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  return digits.length >= 11 ? `+${digits}` : ''
}
