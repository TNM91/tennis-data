import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appleUuid, type AppleEnvironment } from '../../lib/apple-purchase-contract'
import { FIRST_PARTY_COMPETITION_FEES } from '../../lib/first-party-competition-prices'
import { NativeApple, transaction, type AppleTransaction } from './apple-purchases'
import { appleNativePurchaseError } from './apple-purchase-progress'
import type { ScenarioSend } from './captain-scenarios-data'
import { html } from './match-details'

const { productId } = FIRST_PARTY_COMPETITION_FEES.tournament
const canUseStore = () => Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('TiqPurchases')
type Checkout = { state: 'setup' | 'ready' | 'pending' | 'paid' | 'refunded'; token?: string; publicId?: string; start?: true }
type Publication = { environment: AppleEnvironment; checkout: Checkout }
type Attempt = { token: string; cancelKey: string }

export function mountTournamentPublish(
  host: HTMLElement, client: SupabaseClient, owner: string, event: string, revision: string | null,
  active: () => boolean, send: ScenarioSend, onOpen: (id: string) => void, setLocked: (locked: boolean, published: boolean) => void,
) {
  if (!revision || !canUseStore()) return
  const current = () => active() && host.isConnected
  const url = 'https://www.tenaceiq.com/api/mobile/first-party/tournaments/publish?' + new URLSearchParams({ event })
  let publication: Publication | null = null
  let unavailable = false
  let price = ''
  let busy = false
  let notice = ''
  let stale = false
  let retryCancel: Attempt | null = null
  const attemptKey = (environment: AppleEnvironment) => `tournament-checkout:${environment}:${owner}:${event}`

  function savedAttempt(environment: AppleEnvironment): Attempt | null {
    try {
      const value = JSON.parse(localStorage.getItem(attemptKey(environment)) ?? 'null')
      return appleUuid(value?.token) && appleUuid(value?.cancelKey) ? value : null
    } catch { return null }
  }

  function rememberAttempt(environment: AppleEnvironment, attempt: Attempt | null) {
    if (attempt) localStorage.setItem(attemptKey(environment), JSON.stringify(attempt))
    else localStorage.removeItem(attemptKey(environment))
  }

  async function session() {
    const result = await client.auth.getSession()
    if (!current() || result.error || result.data.session?.user.id !== owner) throw Error('account_changed')
    return result.data.session
  }

  async function request(body?: object, receipt?: AppleTransaction): Promise<Publication | null> {
    const account = await session()
    const response = await send({
      url, method: body ? 'POST' : 'GET',
      headers: { Authorization: 'Bearer ' + account.access_token, 'Cache-Control': 'no-store',
        ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { data: body } : {}),
      responseType: 'json', disableRedirects: true, webFetchExtra: { cache: 'no-store' },
      connectTimeout: 12000, readTimeout: receipt ? 55000 : 15000,
    })
    await session()
    const data = response.data
    if (response.status === 409 && data?.code === 'stale') throw Error('settings_changed')
    if (response.status !== 200 || data?.ok !== true || data.scope !== 'first-party' ||
        data.owner !== owner || data.event !== event) throw Error('publish_unavailable')
    if (!body && data.available === false) return null
    const checkout = data.checkout as Checkout | undefined
    if (data.available !== true || data.productId !== productId || !['Sandbox', 'Production'].includes(data.environment) ||
        !checkout || !['setup', 'ready', 'pending', 'paid', 'refunded'].includes(checkout.state) ||
        (['pending', 'paid', 'refunded'].includes(checkout.state) && !appleUuid(checkout.token)) ||
        (checkout.publicId != null && (data.environment !== 'Production' || !/^tiq-native-event-[a-f0-9-]{36}$/.test(checkout.publicId))) ||
        (data.environment === 'Production' && checkout.state === 'paid' && !checkout.publicId) ||
        (receipt && (data.transactionId !== receipt.transactionId || data.environment !== receipt.environment ||
          checkout.token !== receipt.accountToken || !['paid', 'refunded'].includes(checkout.state)))) {
      throw Error('publish_unavailable')
    }
    return { environment: data.environment, checkout }
  }

  async function finish(tx: AppleTransaction) {
    publication = await request({ action: 'reconcile', signedTransaction: tx.signedTransaction }, tx)
    await session()
    if (!(await NativeApple.finish(tx)).finished) throw Error('finish_pending')
  }

  async function load() {
    publication = await request()
    unavailable = !publication
    let context = publication
    if (!context) return
    const unstarted = savedAttempt(context.environment)
    if (unstarted) {
      if (context.checkout.state === 'pending' && context.checkout.token === unstarted.token) {
        await cancel(unstarted, context.environment)
      } else {
        rememberAttempt(context.environment, null)
      }
      context = publication!
    }
    if (context.checkout.state === 'ready' && !price) {
      const catalog = await NativeApple.products({ environment: context.environment, productId })
      const value = catalog.available && catalog.products.find(product => product.id === productId)?.price
      if (typeof value !== 'string' || !value || value.length > 32) throw Error('price_unavailable')
      price = value
    }
    if (!context.checkout.token) return
    const { transactions } = await NativeApple.pending({ productId })
    const tx = transactions.find(tx => transaction(tx) && tx.environment === context.environment && tx.accountToken === context.checkout.token)
    if (tx) await finish(tx)
  }

  async function cancel(attempt: Attempt, environment: AppleEnvironment) {
    retryCancel = attempt
    rememberAttempt(environment, attempt)
    publication = await request({ action: 'cancel', ...attempt })
    rememberAttempt(environment, null)
    retryCancel = null
  }

  async function buy() {
    const context = publication
    if (!context || context.checkout.state !== 'ready' || !price || !revision) return
    const attempt = { token: crypto.randomUUID(), cancelKey: crypto.randomUUID() }
    // Only attempts that have yet to open StoreKit, or that Apple canceled, can be cleared on re-entry.
    rememberAttempt(context.environment, attempt)
    try {
      publication = await request({ action: 'prepare', ...attempt, expected: revision })
      await session()
    } catch (error) {
      if (error instanceof Error && error.message === 'settings_changed') {
        rememberAttempt(context.environment, null)
        throw error
      }
      if (current()) await cancel(attempt, context.environment)
      throw error
    }
    rememberAttempt(context.environment, null)
    if (publication?.checkout.start !== true || publication.checkout.token !== attempt.token ||
        publication.environment !== context.environment) return
    let result
    try {
      result = await NativeApple.purchase({ productId, accountToken: attempt.token, environment: context.environment })
    } catch (error) {
      const native = appleNativePurchaseError(error)
      if (native.beforeConfirmation || ['purchase_product_unavailable', 'purchase_sync_pending', 'store_busy'].includes(native.message)) {
        if (current()) await cancel(attempt, context.environment)
        else rememberAttempt(context.environment, attempt)
        throw Error('purchase_not_started')
      }
      throw error
    }
    if (result.state === 'cancelled') {
      if (current()) await cancel(attempt, context.environment)
      else rememberAttempt(context.environment, attempt)
      notice = 'Purchase canceled.'
    } else if (result.state === 'purchased') {
      if (!transaction(result) || result.accountToken !== attempt.token || result.environment !== context.environment) {
        throw Error('publish_unavailable')
      }
      await finish(result)
    }
  }

  async function run(action: () => Promise<void>) {
    if (busy || !current()) return
    busy = true
    notice = ''
    render()
    try { await action() }
    catch (error) {
      const code = error instanceof Error ? error.message : ''
      stale ||= code === 'settings_changed'
      notice = code === 'settings_changed' ? 'Settings changed. Reopen the tournament before publishing.' :
        code === 'purchase_not_started' ? 'Apple couldn’t open checkout. Try again.' :
        code === 'price_unavailable' ? 'Apple pricing is unavailable. Try again shortly.' :
        publication?.checkout.state === 'pending' || retryCancel ? 'Checkout is still being checked. Check the purchase again shortly.' :
        publication?.checkout.state === 'paid' ? 'Purchase verified. Apple confirmation can finish when you check again.' :
        'Couldn’t check publishing. Try again shortly.'
    } finally {
      busy = false
      if (current()) render()
    }
  }

  function render() {
    const context = publication
    const state = context?.checkout.state
    const publicId = state === 'paid' ? context?.checkout.publicId : undefined
    setLocked(busy || state === 'pending' || (context?.environment === 'Production' && (state === 'paid' || state === 'refunded')), !!publicId)
    if (unavailable || (busy && !context)) { host.replaceChildren(); return }
    const sandbox = context?.environment === 'Sandbox'
    const status = busy ? 'Checking tournament publication…' : notice || {
      setup: 'Set a future entry deadline to publish.',
      ready: sandbox ? 'Test checkout keeps the tournament private.' : 'Publishing opens all divisions for player entries.',
      pending: 'Waiting for Apple to confirm this purchase.',
      paid: sandbox ? 'Test purchase complete. Your tournament is private.' : 'Published. View your divisions and entry deadline.',
      refunded: sandbox ? 'Apple refunded this test purchase.' : 'Apple refunded the purchase. The tournament is closed to new entries.',
    }[state ?? 'ready']
    host.innerHTML = `<section class="entry-receipts" aria-label="Publish tournament"><article>
      <strong>Publish tournament</strong><p role="status">${html(status)}</p>
      ${busy ? '' : publicId ? '<button type="button" data-publish-open>View tournament</button>' :
        state === 'ready' && price && !retryCancel && !stale ? `<button type="button" data-publish-buy>${sandbox ? 'Test publish' : 'Publish tournament'} · ${html(price)}</button>` : ''}
      ${!busy && (state === 'pending' || notice && (retryCancel || state !== 'ready' || !price))
        ? '<button type="button" class="secondary" data-publish-check>Check purchase</button>' : ''}
    </article></section>`
    host.querySelector('[data-publish-buy]')?.addEventListener('click', () => { void run(buy) })
    host.querySelector('[data-publish-check]')?.addEventListener('click', () => {
      void run(async () => { if (retryCancel && publication) await cancel(retryCancel, publication.environment); await load() })
    })
    if (publicId) host.querySelector('[data-publish-open]')?.addEventListener('click', () => onOpen(publicId))
  }

  void run(load)
}
