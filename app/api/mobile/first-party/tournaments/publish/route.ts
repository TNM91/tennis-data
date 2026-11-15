import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { applyTournamentApplePurchase, tournamentAppleConfiguration } from '@/lib/apple-tournament-publication'
import { appleUuid } from '@/lib/apple-purchase-contract'
import { tournamentDraftRevision } from '@/lib/native-tournament-draft-contract'
import { FIRST_PARTY_COMPETITION_FEES } from '@/lib/first-party-competition-prices'

export const runtime = 'nodejs'
export const maxDuration = 60
const json = (body: object, status = 200) => accountResponse({ ...body, scope: 'first-party' }, status)

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    const params = new URL(request.url).searchParams
    const event = params.get('event')
    if (params.size !== 1 || !tournamentDraftRevision(event)) return json({ ok: false }, 400)
    const owner = account.user.id
    const config = tournamentAppleConfiguration()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!config || !key) return json({ ok: true, owner, event, available: false })
    const db = accountClient(key)
    const accountResult = await db.rpc('apple_purchase_account', { p_owner: owner })
    if (accountResult.error) return json({ ok: false }, 503)
    const sandbox = accountResult.data?.ownerId === owner && accountResult.data.sandboxEnabled === true
    if (config.mode === 'sandbox' && !sandbox) return json({ ok: true, owner, event, available: false })
    const environment = sandbox ? 'Sandbox' : 'Production'
    const common = { ok: true, owner, event, available: true, environment, productId: FIRST_PARTY_COMPETITION_FEES.tournament.productId }
    if (request.method === 'GET') {
      const result = await db.rpc('native_tournament_checkout', {
        p_owner: owner, p_event: event, p_environment: environment, p_action: 'status',
      })
      if (result.error) return json({ ok: false }, 503)
      if (!result.data?.state) return json({ ok: false }, result.data?.code === 'missing' ? 404 : 403)
      return json({ ...common, checkout: result.data })
    }
    const body = await readAccountJson(request, 26000)
    if (body?.action === 'reconcile' && typeof body.signedTransaction === 'string' && Object.keys(body).length === 2) {
      const result = await applyTournamentApplePurchase(db, { ...config, environment }, body.signedTransaction, owner, event)
      if (!result.outcome.state) return json({ ok: false }, result.outcome.code === 'missing' ? 404 : 409)
      return json({ ...common, checkout: result.outcome, transactionId: result.transactionId })
    }
    const expected = body?.expected
    const action = body?.action
    if (!appleUuid(body?.token) || !appleUuid(body?.cancelKey) ||
        !(action === 'prepare' && tournamentDraftRevision(expected) && Object.keys(body ?? {}).length === 4 ||
          action === 'cancel' && Object.keys(body ?? {}).length === 3)) return json({ ok: false }, 400)
    const result = await db.rpc('native_tournament_checkout', {
      p_owner: owner, p_event: event, p_environment: environment, p_action: action,
      p_token: body!.token, p_expected: expected ?? null, p_cancel_key: body!.cancelKey,
    })
    if (result.error) return json({ ok: false }, 503)
    if (!result.data?.state) return json({ ok: false, code: result.data?.code },
      result.data?.code === 'stale' ? 409 : result.data?.code === 'missing' ? 404 : 403)
    return json({ ...common, checkout: result.data })
  } catch {
    return json({ ok: false }, 503)
  }
}
export const GET = handle
export const POST = handle
