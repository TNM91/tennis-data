import type { SupabaseClient } from '@supabase/supabase-js'
import type { NativeTournamentSetup } from '../../lib/native-tournament-setup-contract'
import { APPLE_PRO_PRODUCT } from '../../lib/apple-membership-products'
import { FIRST_PARTY_COMPETITION_FEES } from '../../lib/first-party-competition-prices'

const owner = '11111111-1111-4111-8111-111111111111'
const leagueId = '22222222-2222-4222-8222-222222222222'
const tournamentId = '33333333-3333-4333-8333-333333333333'
const league = { revision: leagueId, draft: {
  name: 'Winter Doubles League', location: 'Northside Tennis Center', format: 'team',
  startsOn: '2027-01-04', weeks: 8, timeZone: 'America/Chicago',
} }
const tournament: NativeTournamentSetup = {
  revision: tournamentId,
  draft: { name: 'Winter Open', date: '2026-12-12', venue: 'Northside Tennis Center',
    division: 'Open Singles', discipline: 'singles', format: 'single_elimination' },
  settingsRevision: '44444444-4444-4444-8444-444444444444',
  settings: { registrationClosesOn: '2026-12-11', timeZone: 'America/Chicago',
    divisions: [{ id: '55555555-5555-4555-8555-555555555555', name: 'Open Singles',
      discipline: 'singles', format: 'single_elimination' }] },
}
const prices = [
  { id: APPLE_PRO_PRODUCT.productId, price: '$4.99' },
  { id: FIRST_PARTY_COMPETITION_FEES.tournament.productId, price: '$5.00' },
  { id: FIRST_PARTY_COMPETITION_FEES.league.productId, price: '$25.00' },
]
const client = { auth: { getSession: async () => ({
  data: { session: { user: { id: owner }, access_token: 'screenshot-only' } }, error: null,
}) } } as unknown as SupabaseClient

function response(options: { url: string; method?: string }) {
  if (options.method && options.method.toUpperCase() !== 'GET') throw Error('Screenshot data is read-only')
  const url = new URL(options.url)
  const base = { ok: true, scope: 'first-party', owner }
  const publish = { ...base, available: true, canStart: true,
    environment: 'Production', checkout: { state: 'ready' } }
  let data: unknown
  switch (url.pathname) {
    case '/api/mobile/account':
      data = { ok: true, email: 'review@example.test', reviewDays: 7, fulfillment: 'automated',
        verificationRequired: false, request: null }
      break
    case '/api/mobile/apple-purchases':
      data = { ok: true, applePurchases: 1, enabled: true, environment: 'Production', canPurchase: true,
        webAccess: false, activeProductId: null, products: [{ id: APPLE_PRO_PRODUCT.productId }] }
      break
    case '/api/mobile/first-party/leagues/draft':
      data = { ...base, saved: league }
      break
    case '/api/mobile/first-party/leagues/publish':
      data = { ...publish, draft: leagueId, productId: FIRST_PARTY_COMPETITION_FEES.league.productId }
      break
    case '/api/mobile/first-party/tournaments/desk':
      data = url.searchParams.has('event') ? { ...base, setup: tournament }
        : { ...base, events: [tournament], next: null }
      break
    case '/api/mobile/first-party/tournaments/publish':
      data = { ...publish, event: tournamentId, productId: FIRST_PARTY_COMPETITION_FEES.tournament.productId }
      break
    default:
      return { status: 404, data: { ok: false }, headers: {}, url: options.url }
  }
  return { status: 200, data, headers: {}, url: options.url }
}

// Render the release components with sample data and the confirmed U.S. prices.
// Every path that could write data or charge a purchase is rejected.
const headers = (name: string, methods: string[]) => ({ name, methods: methods.map(name => ({ name, rtype: 'promise' })) })
Object.assign(window, {
  CapacitorCustomPlatform: { name: 'ios' },
  Capacitor: {
    PluginHeaders: [
      headers('TiqPurchases', ['products', 'pending', 'addListener', 'removeListener']),
      headers('CapacitorHttp', ['get', 'request']),
      headers('TiqBiometricSignIn', ['status']),
    ],
    nativePromise: async (plugin: string, method: string, options: { url: string; method?: string; productId?: string }) => {
      if (plugin === 'CapacitorHttp' && (method === 'get' || method === 'request')) return response(options)
      if (plugin === 'TiqBiometricSignIn' && method === 'status') {
        return { available: true, saved: true, forCurrentOwner: true, biometry: 'faceID' }
      }
      if (plugin === 'TiqPurchases' && method === 'addListener') return 'screenshot-listener'
      if (plugin === 'TiqPurchases' && method === 'removeListener') return {}
      if (plugin === 'TiqPurchases' && method === 'pending') return { transactions: [] }
      if (plugin === 'TiqPurchases' && method === 'products') {
        return { available: true, products: prices.filter(row => options.productId
          ? row.id === options.productId : row.id === APPLE_PRO_PRODUCT.productId) }
      }
      throw Error('Screenshot data is read-only')
    },
  },
})

async function visible(selector: string, text = ''): Promise<HTMLElement> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const match = Array.from(document.querySelectorAll<HTMLElement>(selector)).find(element =>
      element.getBoundingClientRect().height > 0 && element.textContent?.includes(text))
    if (match) return match
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw Error('Missing ' + selector + ' ' + text)
}

async function capture(screen: string) {
  document.body.dataset.screen = 'lab'
  const trigger = document.querySelector<HTMLElement>('#app')!
  trigger.innerHTML = '<h1>My Lab</h1>'
  try {
    let offer: HTMLElement
    if (screen === 'pro') {
      const { openAccountSettings } = await import('../../mobile/src/account-settings')
      openAccountSettings(client, owner, () => true, async () => {}, trigger)
      const section = await visible('[data-apple-membership]', 'TenAceIQ Pro')
      offer = await visible('[data-apple-membership] button', 'Subscribe · $4.99/month')
      section.scrollIntoView({ block: 'start', behavior: 'instant' })
    } else if (screen === 'league') {
      const { openLeagueDraft } = await import('../../mobile/src/league-draft-view')
      openLeagueDraft(client, owner, () => true, trigger, () => {})
      offer = await visible('[data-publish-buy]', 'Publish league · $25.00')
    } else if (screen === 'tournament') {
      const { openTournamentDraft } = await import('../../mobile/src/tournament-draft')
      openTournamentDraft(client, owner, () => true, () => {}, trigger)
      const open = await visible('[data-draft-event]', 'Open tournament Winter Open')
      open.click()
      offer = await visible('[data-publish-buy]', 'Publish tournament · $5.00')
    } else {
      return 'Unknown screen'
    }
    if (screen !== 'pro') offer.closest('article')?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    if (offer.getBoundingClientRect().bottom > innerHeight) offer.scrollIntoView({ block: 'end', behavior: 'instant' })
    await document.fonts.ready
    await Promise.all(Array.from(document.images, image => image.decode().catch(() => {})))
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    const bounds = offer.getBoundingClientRect()
    return bounds.top >= 0 && bounds.bottom <= innerHeight ? screen : 'Offer clipped'
  } catch (error) {
    return error instanceof Error ? error.message : 'Capture failed'
  }
}

Object.assign(window, { tiqStoreScreenshot: capture })
