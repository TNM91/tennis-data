import { loadFirstPartyNativeTournaments } from '@/lib/native-tournaments'
import { tournamentInput } from '@/lib/native-tournaments-contract'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { loadTournamentEntryPublications } from '@/lib/first-party-tournament-entry'

export const runtime = 'nodejs'
export const maxDuration = 30

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const allowedParams = new Set(['q', 'tournament', 'division'])

export async function GET(request: Request) {
  try {
    const auth = await getSignedInPlayerApiAuth(request)
    if (!auth.ok) {
      auth.response.headers.set('Cache-Control', headers['Cache-Control'])
      auth.response.headers.set('Referrer-Policy', headers['Referrer-Policy'])
      return auth.response
    }

    const params = new URL(request.url).searchParams
    let input: ReturnType<typeof tournamentInput>
    try {
      if ([...params.keys()].some(key => !allowedParams.has(key) || params.getAll(key).length !== 1)) {
        throw Error('Invalid parameters')
      }
      input = tournamentInput(params.get('q') ?? '', params.get('tournament') ?? '', params.get('division') ?? '')
    } catch {
      return Response.json({ ok: false, message: 'Choose a tournament or use a shorter search.' }, { status: 400, headers })
    }

    const snapshot = await loadFirstPartyNativeTournaments(auth.supabase, auth.userId, input)
    const active = snapshot.detail?.active
    if (active) {
      const publications = await loadTournamentEntryPublications(auth.supabase, [active.parentId, active.id].filter(Boolean), undefined, undefined, auth.userId)
      const division = publications.get(active.id)
      const entryAvailable = !!division && (division.event_id ?? '') === active.parentId &&
        (!active.parentId || publications.has(active.parentId))
      return Response.json({ ok: true, scope: 'first-party', ...snapshot,
        detail: { ...snapshot.detail, entryAvailable } }, { headers })
    }
    return Response.json({ ok: true, scope: 'first-party', ...snapshot }, { headers })
  } catch {
    return Response.json({ ok: false, message: 'Tournaments are unavailable. Refresh to try again.' }, { status: 503, headers })
  }
}
