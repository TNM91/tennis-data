import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { courtAccountId, courtLeagueId, readCourtSubmission } from '@/lib/native-court-result-contract'
import { CourtUnavailable, loadCourtDesk, loadPostedCourtScorecards, publishCourtResult } from '@/lib/first-party-court-results'
import { loadPrivateTeamScorecards } from '@/lib/first-party-team-results'
import { supabaseKey } from '@/lib/supabase-public-config'
import { teamScorecardsHeader } from '@/lib/team-results-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse({ ...body, releaseScope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })

async function handle(request: Request) {
  const account = await verifiedAccount(request)
  if (!account) return json({ ok: false }, 401)
  const params = new URL(request.url).searchParams
  const league = params.get('league'), fixture = params.get('fixture')
  const write = request.method === 'POST'
  const owner = account.user.id
  if (params.size === 0 && !write) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return json({ ok: false }, 503)
    const service = accountClient(key)
    const [scorecards, teamScorecards] = await Promise.all([
      loadPostedCourtScorecards(service, owner),
      request.headers.get(teamScorecardsHeader) === '1' ? loadPrivateTeamScorecards(service, owner).catch(() => {
        console.error('First-party team court scores unavailable')
        return null
      }) : undefined,
    ])
    return json({ ok: true, owner, scorecards, ...(teamScorecards !== undefined ? { teamScorecards } : {}) })
  }
  if (params.size !== 2 || !courtLeagueId(league) || !courtAccountId(fixture)) return json({ ok: false }, 400)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return json({ ok: false }, 503)
  const db = accountClient(supabaseKey, account.token), service = accountClient(key)
  if (!write) return json({ ok: true, owner, desk: await loadCourtDesk(db, service, owner, league, fixture) })
  const body = await readAccountJson(request, 2048)
  if (!body) return json({ ok: false }, 400)
  let input
  try { input = readCourtSubmission(body) }
  catch (error) { return json({ ok: false, message: error instanceof Error ? error.message : 'Check the score.' }, 400) }
  const court = await publishCourtResult(db, service, owner, league, fixture, input)
  return json({ ok: true, owner, league, fixture, court })
}

async function respond(request: Request) {
  try { return await handle(request) }
  catch (error) {
    if (error instanceof CourtUnavailable) return json({ ok: false, message: error.message }, error.status)
    console.error('First-party court results unavailable', { method: request.method })
    return json({ ok: false, message: 'Court scores are unavailable. Try again.' }, 503)
  }
}

export const GET = respond
export const POST = respond
