import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { loadSeasonRecipient, seasonPrivateHeaders } from '@/lib/season-kickoff-server'
import { buildTeamSeasonCalendars } from '@/lib/team-season-calendar'
import { buildSeasonCalendarDownload } from '@/lib/season-calendar-actions'

export const runtime = 'nodejs'
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const result = await loadSeasonRecipient(getCaptainAvailabilityServiceClient(), token, true)
    if (!result) return new Response('Calendar link unavailable.', { status: 404, headers: seasonPrivateHeaders })
    const items = buildTeamSeasonCalendars(result.scope.team, result.matches, 'season').flatMap(season => season.items)
    return new Response(buildSeasonCalendarDownload(items, `${result.scope.team} · Season matches`, 'America/Chicago'), {
      headers: { ...seasonPrivateHeaders, 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="TenAceIQ-season.ics"' },
    })
  } catch { return new Response('Calendar temporarily unavailable.', { status: 503, headers: seasonPrivateHeaders }) }
}
