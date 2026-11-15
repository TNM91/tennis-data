import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library'
import type { SupabaseClient } from '@supabase/supabase-js'
import { expect, it, vi } from 'vitest'
import { applyTournamentApplePurchase } from '../apple-tournament-publication'
import type { ApplePurchaseConfiguration } from '../apple-purchase-server'

vi.mock('server-only', () => ({}))

const owner = '10000000-0000-4000-8000-000000000001'
const event = '10000000-0000-4000-8000-000000000002'
const token = '10000000-0000-4000-8000-000000000003'
const config: ApplePurchaseConfiguration = {
  mode: 'sandbox', environment: 'Sandbox', key: 'fixture', keyId: 'fixture', issuerId: owner,
}
const signedDate = Date.UTC(2026, 0, 1)
const receipt: JWSTransactionDecodedPayload = {
  transactionId: '101', appAccountToken: token, signedDate,
  environment: 'Sandbox', bundleId: 'com.tenaceiq.app',
  productId: 'com.tenaceiq.app.tournament.publish', type: 'Consumable',
  inAppOwnershipType: 'PURCHASED', storefront: 'USA', quantity: 1,
}

it('settles the authenticated event against Apple’s current transaction status', async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { state: 'refunded', token, publicId: null }, error: null })
  const store = { decode: vi.fn().mockResolvedValue(receipt),
    current: vi.fn().mockResolvedValue({ ...receipt, revocationDate: signedDate }) }
  const result = await applyTournamentApplePurchase({ rpc } as unknown as SupabaseClient, config, 'a.b.c', owner, event, store)
  expect(store.current).toHaveBeenCalledWith('101')
  expect(rpc).toHaveBeenCalledExactlyOnceWith('complete_native_tournament_purchase', {
    p_actor: owner, p_event: event, p_environment: 'Sandbox', p_token: token, p_transaction: '101',
    p_signed_at: new Date(signedDate).toISOString(), p_revoked: true,
  })
  expect(result).toMatchObject({ transactionId: '101', outcome: { state: 'refunded' } })
})

it('rejects an incorrect SKU, environment, quantity or current token before settlement', async () => {
  const rpc = vi.fn()
  for (const [submitted, current] of [
    [{ ...receipt, productId: 'com.tenaceiq.app.pro.monthly' }, receipt],
    [receipt, { ...receipt, environment: 'Production' }],
    [receipt, { ...receipt, quantity: 2 }],
    [receipt, { ...receipt, appAccountToken: event }],
  ]) {
    await expect(applyTournamentApplePurchase({ rpc } as unknown as SupabaseClient, config, 'a.b.c', owner, event, {
      decode: async () => submitted, current: async () => current,
    })).rejects.toThrow('Apple transaction mismatch')
  }
  expect(rpc).not.toHaveBeenCalled()
})
