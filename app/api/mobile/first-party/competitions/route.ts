import { createClient } from '@supabase/supabase-js'
import { loadFirstPartyNativeCompetitions, loadTestflightLeagueScores } from '@/lib/native-competitions'
import { competitionInput, publicCompetitionOwner, type CompetitionSnapshot } from '@/lib/native-competitions-contract'
import { loadNativeLeagueMatchDay } from '@/lib/native-league-match-day'
import { loadNativeLeagueAttention } from '@/lib/native-league-attention'
import { getSignedInPlayerApiAuth, loadPlayerAccess } from '@/lib/player-api-auth'
import { supabaseKey, supabaseUrl } from '@/lib/supabase-public-config'

export const runtime = 'nodejs'
export const maxDuration = 30

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const allowedParams = new Set(['scope', 'q', 'league', 'audience', 'overview'])

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const audience = params.get('audience')
  const overview = params.get('overview')
  let input: ReturnType<typeof competitionInput>
  try {
    if ([...params.keys()].some(key => !allowedParams.has(key) || params.getAll(key).length !== 1) ||
        (audience !== null && audience !== 'public') || (overview !== null && overview !== '1')) throw Error('Invalid parameters')
    input = competitionInput(params.get('scope') ?? 'discover', params.get('q') ?? '', params.get('league') ?? '')
    if (audience === 'public' && (input.scope !== 'discover' || request.headers.has('Authorization'))) {
      throw Error('Invalid public request')
    }
  } catch {
    return Response.json({ ok: false, message: 'Choose a league or use a shorter search.' }, { status: 400, headers })
  }

  try {
    const auth = audience === 'public'
      ? {
          ok: true as const,
          userId: publicCompetitionOwner,
          emailVerified: false,
          supabase: createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          }),
        }
      : await getSignedInPlayerApiAuth(request)
    if (!auth.ok) {
      auth.response.headers.set('Cache-Control', headers['Cache-Control'])
      auth.response.headers.set('Referrer-Policy', headers['Referrer-Policy'])
      return auth.response
    }
    const matchDayRequested = request.headers.get('X-TenAceIQ-Match-Day') === '1'
    const attentionRequested = auth.emailVerified === true && request.headers.get('X-TenAceIQ-League-Attention') === '1'
    const demo = auth.userId !== publicCompetitionOwner && request.headers.get('X-TenAceIQ-League-Score') === '2'
      ? await loadTestflightLeagueScores(auth.supabase, auth.userId, input) : null
    if (demo?.detail) {
      const snapshot: CompetitionSnapshot = {
        owner: auth.userId, checkedAt: new Date().toISOString(),
        scope: input.scope, query: input.query, leagues: [demo.league], detail: demo.detail,
        moreLeagues: false, moreConnections: false, scoreReviewDemo: true, canOpenLeagueScores: true,
        connections: [{ leagueId: demo.league.id, kind: 'organizer', status: 'active' }],
      }
      const [matchDay, attention] = await Promise.all([
        matchDayRequested && auth.emailVerified === true
          ? loadNativeLeagueMatchDay(snapshot,auth.userId,true,true).catch(()=>undefined) : undefined,
        attentionRequested ? loadNativeLeagueAttention(snapshot,auth.userId).catch(()=>undefined) : undefined,
      ])
      return Response.json({ ok: true, releaseScope: 'first-party', ...snapshot, matchDay, attention }, { headers })
    }
    const snapshot = await loadFirstPartyNativeCompetitions(auth.supabase, auth.userId, input, overview === '1')
    if (demo) {
      if (snapshot.leagues.length >= 20) {
        const hidden = snapshot.leagues.pop()
        snapshot.connections = snapshot.connections.filter(entry => entry.leagueId !== hidden?.id)
        snapshot.moreLeagues = true
      }
      snapshot.leagues.unshift(demo.league)
      snapshot.connections.unshift({ leagueId: demo.league.id, kind: 'organizer', status: 'active' })
    }
    const active = snapshot.detail?.league.status === 'active' && auth.userId !== publicCompetitionOwner
    const organizer = active && snapshot.connections.some(connection => connection.kind === 'organizer' && connection.leagueId === input.selected)
    const team = active && snapshot.detail?.league.format === 'team'
    const access = organizer || team ? await loadPlayerAccess(auth.supabase, auth.userId) : null
    const canReviewEntries = organizer && access?.canUseLeagueTools
    const canOpenLeagueScores = team && (canReviewEntries || access?.canUseCaptainWorkflow)
    const matchDayActor = auth.emailVerified === true ? auth.userId : null
    const [matchDay, attention] = await Promise.all([
      matchDayRequested && input.selected ? loadNativeLeagueMatchDay(snapshot,
        matchDayActor, !!matchDayActor && access?.canUseCaptainWorkflow === true,
        !!matchDayActor && canReviewEntries === true,
      ).catch(()=>({matches:[]})) : undefined,
      attentionRequested && canReviewEntries === true ? loadNativeLeagueAttention(snapshot,auth.userId).catch(()=>undefined) : undefined,
    ])
    return Response.json({ ok: true, releaseScope: 'first-party', ...snapshot,
      matchDay, attention,
      ...(canOpenLeagueScores ? { canOpenLeagueScores: true } : {}),
      ...(canReviewEntries ? { canReviewEntries, canScheduleMatches: true } : {}) }, { headers })
  } catch {
    return Response.json({ ok: false, message: 'Leagues are unavailable. Refresh to try again.' }, { status: 503, headers })
  }
}
