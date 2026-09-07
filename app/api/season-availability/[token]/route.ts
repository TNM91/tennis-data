import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { loadSeasonRecipient, seasonPrivateHeaders } from '@/lib/season-kickoff-server'

export const runtime = 'nodejs'
type Context = { params: Promise<{ token: string }> }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: seasonPrivateHeaders })
export async function GET(_request: Request, context: Context) {
  try {
    const { token } = await context.params
    const result = await loadSeasonRecipient(getCaptainAvailabilityServiceClient(), token)
    return result ? json({ ok: true, ...result }) : json({ message: 'This personal link is no longer active. Ask your captain for help.' }, 404)
  } catch { return json({ message: 'Your season could not be loaded. Please retry.' }, 503) }
}
export async function POST(request: Request, context: Context) {
  try {
    const { token } = await context.params
    const service = getCaptainAvailabilityServiceClient()
    const recipient = await loadSeasonRecipient(service, token)
    if (!recipient) return json({ message: 'This personal link is no longer active. Ask your captain for help.' }, 404)
    const body = await request.json() as { responses?: unknown }
    if (!Array.isArray(body.responses) || !body.responses.length || body.responses.length > 250) return json({ message: 'Choose availability for at least one match.' }, 400)
    const allowed = new Map(recipient.matches.map(match => [match.id, match]))
    const seen = new Set<string>()
    for (const answer of body.responses) {
      const match = answer && typeof answer === 'object' ? allowed.get(answer.matchId) : null
      if (!match || seen.has(match.id) || match.match_date !== answer.matchDate || (match.match_time || '') !== answer.matchTime
        || (match.match_date || '') < recipient.today || !['available', 'maybe', 'unavailable'].includes(answer.status)) {
        return json({ message: 'The schedule changed or a response is invalid. Reload and review your dates before saving.' }, 409)
      }
      seen.add(match.id)
    }
    // Player identity is exclusively resolved from the personal token. Never
    // accept a player ID/name supplied by the browser.
    const { data, error } = await service.rpc('save_season_availability', { p_token: token, p_responses: body.responses })
    if (error) return json({ message: 'Your answers could not be saved. Reload to check for schedule changes, then retry.' }, 409)
    return json({ ok: true, saved: data })
  } catch { return json({ message: 'Your answers could not be saved. Please retry.' }, 503) }
}
