import { loadFirstPartySetup } from '@/lib/first-party-setup'
import { loadFirstPartyCompetitionTrophies } from '@/lib/first-party-competition-trophies'
import { accountClient, accountResponse, verifiedAccount } from '@/lib/mobile-account-auth'
import { loadPlayerAccess } from '@/lib/player-api-auth'
import { supabaseKey } from '@/lib/supabase-public-config'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status: number) => accountResponse({ ...body, releaseScope: 'first-party' }, status)

export async function GET(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    if (new URL(request.url).search) return json({ ok: false }, 400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return json({ ok: false }, 503)
    const owner = account.user.id
    const db = accountClient(supabaseKey, account.token)
    const service = accountClient(key)
    const [tracks, competitionTrophies] = await Promise.all([
      loadPlayerAccess(db, owner).then(access => loadFirstPartySetup(db, service, owner, access)),
      loadFirstPartyCompetitionTrophies(db, service, owner).catch(() => null),
    ])
    return json({ ok: true, owner, tracks, competitionTrophies }, 200)
  } catch {
    return json({ ok: false }, 503)
  }
}
