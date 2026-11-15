import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { applyLeagueApplePurchase } from '@/lib/apple-league-publication'
import { applePurchaseConfiguration } from '@/lib/apple-purchase-server'
import { appleUuid } from '@/lib/apple-purchase-contract'
import { FIRST_PARTY_COMPETITION_FEES } from '@/lib/first-party-competition-prices'
import { isLeagueDraftRevision } from '@/lib/native-league-draft-contract'

export const runtime = 'nodejs'
export const maxDuration = 60

const json = (body: object, status = 200) => accountResponse(
  { ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' },
)

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    const params = new URL(request.url).searchParams
    const draft = params.get('draft')
    if (params.size !== 1 || !isLeagueDraftRevision(draft)) return json({ ok: false }, 400)
    const owner = account.user.id
    const unavailable = () => json({ ok: true, owner, draft, available: false })
    const config = applePurchaseConfiguration()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!config || !key) return unavailable()
    const db = accountClient(key)
    const eligibility = await db.rpc('apple_purchase_account', { p_owner: owner })
    if (eligibility.error) return json({ ok: false }, 503)
    const sandbox = eligibility.data?.ownerId === owner && eligibility.data.sandboxEnabled === true
    if (!sandbox && config.mode !== 'production') return unavailable()
    const environment = sandbox ? 'Sandbox' : 'Production'
    const canStart = sandbox
      ? config.mode !== 'off' && process.env.APPLE_LEAGUE_SANDBOX_CHECKOUT_ENABLED === 'true'
      : process.env.APPLE_LEAGUE_PURCHASES_ENABLED === 'true'
    const common = { ok: true, owner, draft, available: true, environment,
      productId: FIRST_PARTY_COMPETITION_FEES.league.productId }

    let action = 'status'
    let token = null
    let cancelKey = null
    if (request.method === 'POST') {
      const body = await readAccountJson(request, 26000)
      if (body?.action === 'reconcile' && typeof body.signedTransaction === 'string' && Object.keys(body).length === 2) {
        const result = await applyLeagueApplePurchase(db, { ...config, environment }, body.signedTransaction, owner, draft)
        return result.outcome.state
          ? json({ ...common, checkout: result.outcome, transactionId: result.transactionId })
          : json({ ok: false }, result.outcome.code === 'missing' ? 404 : 409)
      }
      if (!appleUuid(body?.token) || !appleUuid(body?.cancelKey) ||
          !(body?.action === 'prepare' && body.expected === draft && Object.keys(body).length === 4 ||
            body?.action === 'cancel' && Object.keys(body).length === 3)) return json({ ok: false }, 400)
      action = body.action
      token = body.token
      cancelKey = body.cancelKey
      if (action === 'prepare' && !canStart) return json({ ok: false }, 403)
    }
    const result = await db.rpc('native_league_checkout', {
      p_owner: owner, p_draft: draft, p_environment: environment, p_action: action, p_token: token, p_cancel_key: cancelKey,
    })
    if (result.error) return json({ ok: false }, 503)
    const checkout = result.data
    if (!checkout?.state) return json({ ok: false, code: checkout?.code }, checkout?.code === 'stale' ? 409 : 403)
    if (action === 'status' && !canStart && ['ready', 'setup'].includes(checkout.state)) return unavailable()
    return json({ ...common, checkout, canStart })
  } catch {
    return json({ ok: false }, 503)
  }
}

export const GET = handle
export const POST = handle
