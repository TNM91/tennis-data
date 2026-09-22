import { buildMatchWeekIcs } from '@/lib/captain-match-week-links'
import { getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const row = await findAvailabilityRequest(token)
  if (!row) return new Response('Calendar invite unavailable.', { status: 404 })

  const ics = buildMatchWeekIcs({
    uid: `captain-availability-${row.id}`,
    eventDate: row.match_date,
    eventTime: row.match_time,
    opponent: row.opponent_team,
    location: row.facility,
    details: `Match Week availability for ${row.team_name}.`,
  })
  if (!ics) return new Response('A match date and time are required before creating a calendar invite.', { status: 422 })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tenaceiq-match-week.ics"',
      'Cache-Control': 'private, no-store',
    },
  })
}

async function findAvailabilityRequest(token: string) {
  if (!isUuid(token)) return null
  const service = getCaptainAvailabilityServiceClient()
  const select = 'id,team_name,match_date,opponent_team,match_time,facility,expires_at'
  const { data: direct } = await service
    .from('captain_availability_requests')
    .select(select)
    .eq('request_token', token)
    .maybeSingle()
  if (direct && new Date(direct.expires_at).getTime() >= Date.now()) return direct

  const { data: invite } = await service
    .from('captain_availability_request_invites')
    .select('request_id')
    .eq('response_token', token)
    .maybeSingle()
  if (!invite) return null

  const { data: requested } = await service
    .from('captain_availability_requests')
    .select(select)
    .eq('id', invite.request_id)
    .maybeSingle()
  if (!requested || new Date(requested.expires_at).getTime() < Date.now()) return null
  return requested
}
