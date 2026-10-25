import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { buildPracticeIcs, resolvePracticeToken } from '@/lib/captain-practice-rsvp'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const token = resolvePracticeToken((await params).token)
  if (!token) return new Response('Calendar invite unavailable.', { status: 404 })
  let service: ReturnType<typeof getCaptainAvailabilityServiceClient>
  try {
    service = getCaptainAvailabilityServiceClient()
  } catch {
    return new Response('Calendar service is temporarily unavailable.', { status: 503 })
  }
  const { data, error } = await service
    .from('captain_practice_invites')
    .select('id,internal_schedule_events(title,status,scheduled_date,scheduled_time,facility,metadata)')
    .eq('public_token', token)
    .maybeSingle()
  const event = (data as unknown as {
    id: string
    internal_schedule_events: {
      status: string
      title: string
      scheduled_date: string
      scheduled_time: string
      facility: string
      metadata: Record<string, unknown> | null
    } | null
  } | null)?.internal_schedule_events
  if (error) return new Response('Calendar service is temporarily unavailable.', { status: 503, headers: { 'Cache-Control': 'private, no-store' } })
  if (!data || !event) return new Response('Calendar invite unavailable.', { status: 404 })
  if (!['proposed', 'confirmed'].includes(event.status)) return new Response('This practice is no longer open for calendar additions.', { status: 409, headers: { 'Cache-Control': 'private, no-store' } })
  const metadata = event.metadata ?? {}
  const ics = buildPracticeIcs({
    uid: `captain-practice-${data.id}`,
    teamName: typeof metadata.teamName === 'string' ? metadata.teamName : event.title.replace(/ practice$/i, ''),
    scheduledDate: event.scheduled_date,
    scheduledTime: event.scheduled_time,
    scheduledEndTime: typeof metadata.practiceEndTime === 'string' ? metadata.practiceEndTime : '',
    facility: event.facility,
    notes: typeof metadata.practiceNotes === 'string' ? metadata.practiceNotes : '',
  })
  if (!ics) return new Response('A practice date and time are required before adding it to a calendar.', { status: 422 })
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tenaceiq-practice.ics"',
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
