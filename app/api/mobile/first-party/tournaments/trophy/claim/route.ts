import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { tournamentDraftRevision } from '@/lib/native-tournament-draft-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse({ ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })

export async function POST(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    const body = await readAccountJson(request, 256)
    if (new URL(request.url).search || !body || Object.keys(body).length !== 1 || !tournamentDraftRevision(body.code)) {
      return json({ ok: false }, 400)
    }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return json({ ok: false }, 503)
    const owner = account.user.id
    const result = await accountClient(key).rpc('claim_native_tournament_trophy',
      { p_owner: owner, p_code: body.code }).retry(false)
    if (result.error) return json({ ok: false }, 503)
    if (result.data === null) return json({ ok: false }, 404)
    if (!tournamentDraftRevision(result.data)) return json({ ok: false }, 503)
    return json({ ok: true, owner, trophyId: 'tiq-title-' + result.data })
  } catch {
    return json({ ok: false }, 503)
  }
}
