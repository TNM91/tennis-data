import { getSignedInPlayerApiAuth, loadPlayerAccess } from './player-api-auth'
import { decideNativeLeagueEntry, loadNativeLeagueDecisions } from './native-league-decisions'
import { entryLeague } from './native-league-entry-contract'

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const respond = (firstParty: boolean) => (data: object, status: number) =>
  Response.json(firstParty ? { ...data, releaseScope: 'first-party' } : data, { status, headers })

async function authorize(request: Request, firstParty: boolean) {
  const auth = await getSignedInPlayerApiAuth(request)
  if (!auth.ok) {
    if (firstParty) return { ok: false as const, response: respond(true)({ ok: false, message: 'Sign in to review entry requests.' }, auth.response.status) }
    auth.response.headers.set('Cache-Control', headers['Cache-Control'])
    return auth
  }
  const access = await loadPlayerAccess(auth.supabase, auth.userId)
  return access.canUseLeagueTools ? auth : {
    ok: false as const,
    response: respond(firstParty)({ ok: false, message: 'League Office access is required.' }, 403),
  }
}

export async function getLeagueEntryRequests(request: Request, firstParty = false) {
  const json = respond(firstParty)
  try {
    const auth = await authorize(request, firstParty)
    if (!auth.ok) return auth.response
    let id: string
    try {
      const params = new URL(request.url).searchParams
      if ([...params.keys()].some(key => key !== 'league') || params.getAll('league').length !== 1) throw Error()
      id = entryLeague(params.get('league'))
    } catch {
      return json({ ok: false, message: 'Choose a league.' }, 400)
    }
    const result = firstParty
      ? await loadNativeLeagueDecisions(auth.supabase, auth.userId, id, true)
      : await loadNativeLeagueDecisions(auth.supabase, auth.userId, id)
    return json({ ok: true, ...result }, 200)
  } catch {
    return json({ ok: false, message: 'Entry requests are unavailable. Refresh to check access and changes.' }, 503)
  }
}

export async function postLeagueEntryDecision(request: Request, firstParty = false) {
  const json = respond(firstParty)
  try {
    const auth = await authorize(request, firstParty)
    if (!auth.ok) return auth.response
    let body: unknown
    try {
      if (new URL(request.url).search || request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') throw Error()
      const reader = request.body?.getReader()
      if (!reader) throw Error()
      const decoder = new TextDecoder()
      let raw = '', size = 0
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          size += next.value.byteLength
          if (size > 4096) {
            await reader.cancel()
            return json({ ok: false, message: 'Decision details are too large.' }, 413)
          }
          raw += decoder.decode(next.value, { stream: true })
        }
        raw += decoder.decode()
      } finally {
        reader.releaseLock()
      }
      body = JSON.parse(raw)
    } catch {
      return json({ ok: false, message: 'Check your entry decision.' }, 400)
    }
    const result = firstParty
      ? await decideNativeLeagueEntry(auth.supabase, auth.userId, body, true)
      : await decideNativeLeagueEntry(auth.supabase, auth.userId, body)
    return json(result, result.status)
  } catch {
    return json({ ok: false, message: 'Your decision could not be confirmed. Refresh requests before trying again.' }, 503)
  }
}
