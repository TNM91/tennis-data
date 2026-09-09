import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import {
  assignPracticeDisplayStatuses,
  normalizePracticeName,
  resolvePracticeToken,
  type PracticeResponseStatus,
} from '@/lib/captain-practice-rsvp'

export const runtime = 'nodejs'

type InviteRow = {
  id: string
  event_id: string
  capacity: number | null
  internal_schedule_events: {
    title: string
    scheduled_date: string
    scheduled_time: string
    facility: string
    status: string
    metadata: Record<string, unknown> | null
  } | null
}

type InviteeRow = {
  id: string
  player_name: string
  normalized_name: string
  profile_id: string | null
  response_status: PracticeResponseStatus
  note: string
  responded_at: string | null
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const loaded = await loadPractice((await params).token)
  if (!loaded.ok) return loaded.response
  return Response.json(buildPayload(loaded.invite, loaded.invitees), noStore())
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  let body: { playerName?: unknown; status?: unknown; note?: unknown }
  try {
    body = await request.json() as typeof body
  } catch {
    return Response.json({ ok: false, message: 'Choose a response and try again.' }, { status: 400 })
  }

  const token = (await params).token
  const loaded = await loadPractice(token)
  if (!loaded.ok) return loaded.response
  if (loaded.invite.internal_schedule_events?.status === 'cancelled') {
    return Response.json({ ok: false, message: 'This practice has been cancelled.' }, { status: 409 })
  }

  const normalizedName = normalizePracticeName(body.playerName)
  const status = typeof body.status === 'string' ? body.status.trim() as PracticeResponseStatus : 'unanswered'
  if (!normalizedName || !['in', 'out', 'maybe'].includes(status)) {
    return Response.json({ ok: false, message: 'Choose your name and response.' }, { status: 400 })
  }
  const invitee = loaded.invitees.find((row) => row.normalized_name === normalizedName)
  if (!invitee) {
    return Response.json({ ok: false, message: 'Choose your name from this team roster.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : ''
  let service: ReturnType<typeof getCaptainAvailabilityServiceClient>
  try {
    service = getCaptainAvailabilityServiceClient()
  } catch {
    return Response.json({ ok: false, message: 'Practice replies are temporarily unavailable.' }, { status: 503 })
  }
  const { error } = await service
    .from('captain_practice_invitees')
    .update({ response_status: status, note, responded_at: now, updated_at: now })
    .eq('id', invitee.id)
  if (error) return Response.json({ ok: false, message: 'Your RSVP could not be saved.' }, { status: 500 })

  if (invitee.profile_id) {
    await service.from('internal_schedule_event_responses').upsert({
      event_id: loaded.invite.event_id,
      profile_id: invitee.profile_id,
      response_status: status,
      note,
      updated_at: now,
    }, { onConflict: 'event_id,profile_id' })
  }

  const refreshed = loaded.invitees.map((row) => row.id === invitee.id
    ? { ...row, response_status: status, note, responded_at: now }
    : row)
  return Response.json(buildPayload(loaded.invite, refreshed, invitee.id), noStore())
}

async function loadPractice(rawToken: string): Promise<
  | { ok: true; invite: InviteRow; invitees: InviteeRow[] }
  | { ok: false; response: Response }
> {
  const token = resolvePracticeToken(rawToken)
  if (!token) return { ok: false, response: Response.json({ ok: false, message: 'This practice link is invalid.' }, { status: 404 }) }
  let service: ReturnType<typeof getCaptainAvailabilityServiceClient>
  try {
    service = getCaptainAvailabilityServiceClient()
  } catch {
    return { ok: false, response: Response.json({ ok: false, message: 'Practice replies are temporarily unavailable.' }, { status: 503 }) }
  }
  const { data, error } = await service
    .from('captain_practice_invites')
    .select('id,event_id,capacity,internal_schedule_events(title,scheduled_date,scheduled_time,facility,status,metadata)')
    .eq('public_token', token)
    .maybeSingle()
  if (error || !data) {
    return { ok: false, response: Response.json({ ok: false, message: 'This practice link is no longer available.' }, { status: 404 }) }
  }
  const invite = data as unknown as InviteRow
  const inviteesResult = await service
    .from('captain_practice_invitees')
    .select('id,player_name,normalized_name,profile_id,response_status,note,responded_at')
    .eq('invite_id', invite.id)
    .order('player_name', { ascending: true })
  if (inviteesResult.error) {
    return { ok: false, response: Response.json({ ok: false, message: 'Practice replies could not be loaded.' }, { status: 500 }) }
  }
  return { ok: true, invite, invitees: (inviteesResult.data ?? []) as InviteeRow[] }
}

function buildPayload(invite: InviteRow, invitees: InviteeRow[], selectedId = '') {
  const event = invite.internal_schedule_events
  const metadata = event?.metadata ?? {}
  const roster = assignPracticeDisplayStatuses(
    invitees.map((row) => ({
      id: row.id,
      playerName: row.player_name,
      responseStatus: row.response_status,
      respondedAt: row.responded_at || '',
    })),
    invite.capacity,
  )
  const selected = roster.find((row) => row.id === selectedId)
  return {
    ok: true,
    practice: {
      teamName: cleanMetadata(metadata.teamName) || event?.title.replace(/ practice$/i, '') || 'Team',
      leagueName: cleanMetadata(metadata.leagueName),
      scheduledDate: event?.scheduled_date || '',
      scheduledTime: event?.scheduled_time || '',
      facility: event?.facility || '',
      notes: cleanMetadata(metadata.practiceNotes),
      status: event?.status || 'proposed',
      capacity: invite.capacity,
    },
    roster,
    selectedStatus: selected?.displayStatus || null,
  }
}

function cleanMetadata(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function noStore() {
  return { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' } }
}
