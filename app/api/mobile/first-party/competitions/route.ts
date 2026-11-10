import { createClient } from '@supabase/supabase-js'
import { loadFirstPartyNativeCompetitions } from '@/lib/native-competitions'
import { competitionInput, publicCompetitionOwner } from '@/lib/native-competitions-contract'
import { getSignedInPlayerApiAuth } from '@/lib/player-api-auth'
import { supabaseKey, supabaseUrl } from '@/lib/supabase-public-config'

export const runtime = 'nodejs'
export const maxDuration = 30

const headers = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }
const allowedParams = new Set(['scope', 'q', 'league', 'audience'])

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const audience = params.get('audience')
  let input: ReturnType<typeof competitionInput>
  try {
    if ([...params.keys()].some(key => !allowedParams.has(key) || params.getAll(key).length !== 1) ||
        (audience !== null && audience !== 'public')) throw Error('Invalid parameters')
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
    const snapshot = await loadFirstPartyNativeCompetitions(auth.supabase, auth.userId, input)
    return Response.json({ ok: true, releaseScope: 'first-party', ...snapshot }, { headers })
  } catch {
    return Response.json({ ok: false, message: 'Leagues are unavailable. Refresh to try again.' }, { status: 503, headers })
  }
}
