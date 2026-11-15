import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { isLeagueDraftRevision, readLeagueDraft, readSavedLeagueDraft, type LeagueDraft } from '@/lib/native-league-draft-contract'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return accountResponse({ ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })
}

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return response({ ok: false }, 401)
    if (new URL(request.url).search) return response({ ok: false }, 400)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return response({ ok: false }, 503)

    const owner = account.user.id
    const service = accountClient(key)
    if (request.method === 'GET') {
      const result = await service.rpc('native_league_draft', { p_owner: owner })
      if (result.error) return response({ ok: false }, 503)
      const saved = result.data === null ? null : readSavedLeagueDraft(result.data)
      return response({ ok: true, owner, saved })
    }

    const body = await readAccountJson(request, 2048)
    if (!body || Object.keys(body).length !== 3 || !isLeagueDraftRevision(body.revision) ||
        (body.expected !== null && !isLeagueDraftRevision(body.expected)) || body.revision === body.expected) {
      return response({ ok: false }, 400)
    }
    let draft: LeagueDraft
    try {
      draft = readLeagueDraft(body.draft)
    } catch {
      return response({ ok: false }, 400)
    }
    const result = await service.rpc('save_native_league_draft', {
      p_owner: owner, p_expected: body.expected, p_revision: body.revision, p_draft: draft,
    })
    if (result.error?.message === 'native_league_checkout_pending') return response({ ok: false, code: 'checkout_pending' }, 409)
    if (result.error?.message === 'native_league_checkout_revision_used') return response({ ok: false, code: 'stale' }, 409)
    if (result.error) return response({ ok: false }, 503)
    if (result.data?.code === 'stale') return response({ ok: false, code: 'stale' }, 409)
    if (result.data?.code === 'forbidden') return response({ ok: false }, 403)
    const saved = readSavedLeagueDraft(result.data)
    if (saved.revision !== body.revision) return response({ ok: false }, 503)
    return response({ ok: true, owner, saved })
  } catch {
    return response({ ok: false }, 503)
  }
}

export const GET = handle
export const POST = handle
