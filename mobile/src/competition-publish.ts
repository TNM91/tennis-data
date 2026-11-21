import { Capacitor } from '@capacitor/core'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appleUuid, type AppleEnvironment } from '../../lib/apple-purchase-contract'
import { FIRST_PARTY_COMPETITION_FEES } from '../../lib/first-party-competition-prices'
import { nativeLeaguePublicationId } from '../../lib/native-league-publication'
import { NativeApple, transaction, type AppleTransaction } from './apple-purchases'
import { appleNativePurchaseError } from './apple-purchase-progress'
import type { ScenarioSend } from './captain-scenarios-data'
import { html } from './match-details'

const canUseStore = () => Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('TiqPurchases')
type Checkout = { state: 'setup' | 'ready' | 'pending' | 'paid' | 'refunded'; token?: string; publicId?: string; start?: true }
type Publication = { environment: AppleEnvironment; checkout: Checkout; canStart: boolean }
type Attempt = { token: string; cancelKey: string }

export function mountCompetitionPublish(
  kind: 'tournament' | 'league', host: HTMLElement, client: SupabaseClient, owner: string, id: string, revision: string | null,
  active: () => boolean, send: ScenarioSend, onOpen: (id: string) => void,
  setLocked: (locked: boolean, published: boolean, canStartAnother: boolean) => void,
) {
  if (!revision || !canUseStore()) return
  const { productId } = FIRST_PARTY_COMPETITION_FEES[kind]
  const league = kind === 'league'
  const subject = league ? 'league season' : 'tournament'
  const lookup = league ? 'draft' : 'event'
  let disposed = false
  const current = () => !disposed && active() && host.isConnected
  const url = `https://www.tenaceiq.com/api/mobile/first-party/${kind}s/publish?` + new URLSearchParams({ [lookup]: id })
  let publication: Publication | null = null
  let unavailable = false
  let price = ''
  let busy = false
  let notice = ''
  let stale = false
  let retryCancel: Attempt | null = null
  const attemptKey = (environment: AppleEnvironment) => `${kind}-checkout:${environment}:${owner}:${id}`
  const needsCheck = () => !unavailable && (publication?.checkout.state === 'pending' || !!notice &&
    (!!retryCancel || publication?.checkout.state !== 'ready' || !price))

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
        data.owner !== owner || data[lookup] !== id) throw Error('publish_unavailable')
    if (!body && data.available === false) return null
    const checkout = data.checkout as Checkout | undefined
    if (data.available !== true || data.productId !== productId || !['Sandbox', 'Production'].includes(data.environment) ||
        !checkout || !['setup', 'ready', 'pending', 'paid', 'refunded'].includes(checkout.state) ||
        (['pending', 'paid', 'refunded'].includes(checkout.state) && !appleUuid(checkout.token)) ||
        (checkout.publicId != null && (data.environment !== 'Production' ||
          !(league ? nativeLeaguePublicationId(checkout.publicId) : /^tiq-native-event-[a-f0-9-]{36}$/.test(checkout.publicId)))) ||
        (data.environment === 'Production' && checkout.state === 'paid' && !checkout.publicId) ||
        (receipt && (data.transactionId !== receipt.transactionId || data.environment !== receipt.environment ||
          checkout.token !== receipt.accountToken || !['paid', 'refunded'].includes(checkout.state)))) {
      throw Error('publish_unavailable')
    }
    return { environment: data.environment, checkout, canStart: !league || data.canStart === true }
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
      // A ready status can arrive while an earlier prepare is still in flight.
      // Ask the server to close the token before discarding our cancel key.
      context = await cancel(unstarted, context.environment)
    }
    if (context.checkout.state === 'ready' && context.canStart && !price) {
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
    const updated = await request({ action: 'cancel', ...attempt })
    if (updated?.environment !== environment) throw Error('publish_unavailable')
    publication = updated
    rememberAttempt(environment, null)
    retryCancel = null
    return updated
  }

  async function check() {
    if (retryCancel && publication) await cancel(retryCancel, publication.environment)
    await load()
  }

  async function buy() {
    const context = publication
    if (!context || context.checkout.state !== 'ready' || !context.canStart || !price || !revision) return
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
      notice = code === 'settings_changed' ? league ? 'Your season draft changed. Reopen it to continue.' : 'Settings changed. Reopen the tournament before publishing.' :
        code === 'purchase_not_started' ? 'Apple couldn’t open checkout. Try again.' :
        code === 'price_unavailable' ? 'Apple pricing is unavailable. Try again shortly.' :
        publication?.checkout.state === 'pending' || retryCancel ? 'Checkout is still being checked. Check the purchase again shortly.' :
        publication?.checkout.state === 'paid' ? 'Purchase verified. Apple confirmation can finish when you check again.' :
        `Couldn’t load ${subject} checkout. Try again shortly.`
    } finally {
      busy = false
      if (current()) render()
    }
  }

  function render() {
    const context = publication
    const state = context?.checkout.state
    const publicId = state === 'paid' ? context?.checkout.publicId : undefined
    const finished = context?.environment === 'Production' && (state === 'paid' || state === 'refunded')
    const checkLabel = retryCancel || state === 'pending' || state === 'paid' || state === 'refunded' ? 'Check purchase' :
      state === 'ready' && !price ? 'Retry loading price' : 'Retry checkout'
    setLocked(busy || state === 'pending' || finished, !!publicId, finished && !busy && !notice)
    if (unavailable || (busy && !context)) { host.replaceChildren(); return }
    const sandbox = context?.environment === 'Sandbox'
    const heading = league ? sandbox ? 'Test league checkout' : 'Publish league' : 'Publish tournament'
    const status = busy ? `Checking ${subject} checkout…` : notice || {
      setup: league ? 'Update the dates to publish a season that’s still open.' : 'Set a future entry deadline to publish.',
      ready: league ? !context?.canStart ? 'Checkout is paused.' :
        sandbox ? 'Try Apple’s sandbox checkout. Your league stays private.' : 'Publish this season to start accepting entry requests.' :
        sandbox ? 'Test checkout keeps the tournament private.' : 'Publishing opens all divisions for player entries.',
      pending: 'Waiting for Apple to confirm this purchase.',
      paid: sandbox ? `Test purchase complete. Your ${league ? 'league draft' : 'tournament'} is private.` :
        league ? 'Your season is published. Open it to review entry requests.' : 'Published. View your divisions and entry deadline.',
      refunded: sandbox ? 'Apple refunded this test purchase.' : `Apple refunded the purchase. The ${subject} is closed to new entries.`,
    }[state ?? 'ready']
    host.innerHTML = `<section class="entry-receipts" aria-label="${heading}"><article>
      <strong>${heading}</strong><p role="status">${html(status)}</p>
      ${busy ? '' : publicId ? `<button type="button" data-publish-open>View ${league ? 'league' : 'tournament'}</button>` :
        state === 'ready' && context?.canStart && price && !retryCancel && !stale ? `<button type="button" data-publish-buy>${sandbox ? league ? 'Test checkout' : 'Test publish' : heading} · ${html(price)}</button>` : ''}
      ${!busy && needsCheck()
        ? `<button type="button" class="secondary" data-publish-check>${checkLabel}</button>` : ''}
    </article></section>`
    host.querySelector('[data-publish-buy]')?.addEventListener('click', () => { void run(buy) })
    host.querySelector('[data-publish-check]')?.addEventListener('click', () => { void run(check) })
    if (publicId) host.querySelector('[data-publish-open]')?.addEventListener('click', () => onOpen(publicId))
  }

  const recover = () => { if (needsCheck()) void run(check) }
  const resume = () => { if (document.visibilityState === 'visible') recover() }
  window.addEventListener('online', recover)
  document.addEventListener('visibilitychange', resume)
  void run(load)
  return () => {
    disposed = true
    window.removeEventListener('online', recover)
    document.removeEventListener('visibilitychange', resume)
  }
}
