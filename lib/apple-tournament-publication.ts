import 'server-only'
import type { JWSTransactionDecodedPayload } from '@apple/app-store-server-library'
import type { SupabaseClient } from '@supabase/supabase-js'
import { appleTransactionId, appleUuid } from './apple-purchase-contract'
import { applePurchaseConfiguration, appleTransactionVerification, type ApplePurchaseConfiguration } from './apple-purchase-server'
import { FIRST_PARTY_COMPETITION_FEES } from './first-party-competition-prices'

export function tournamentAppleConfiguration() {
  const config = applePurchaseConfiguration()
  return process.env.APPLE_TOURNAMENT_PURCHASES_ENABLED === 'true' && config?.mode !== 'off' ? config : null
}

function validatedTransaction(data: JWSTransactionDecodedPayload, config: ApplePurchaseConfiguration) {
  const { transactionId, appAccountToken, signedDate } = data
  if (!appleTransactionId(transactionId) || !appleUuid(appAccountToken) ||
      data.environment !== config.environment || data.bundleId !== 'com.tenaceiq.app' ||
      data.productId !== FIRST_PARTY_COMPETITION_FEES.tournament.productId ||
      data.type !== 'Consumable' || data.inAppOwnershipType !== 'PURCHASED' || data.quantity !== 1 ||
      data.storefront !== 'USA' || typeof signedDate !== 'number' || signedDate <= 0 ||
      !Number.isSafeInteger(signedDate) || signedDate > Date.now() + 300000) {
    throw Error('Apple transaction mismatch')
  }
  return { id: transactionId, token: appAccountToken.toLowerCase(), signedAt: new Date(signedDate).toISOString(),
    revoked: data.revocationDate !== undefined }
}

export async function applyTournamentApplePurchase(
  db: SupabaseClient, config: ApplePurchaseConfiguration, signed: string,
  owner: string | null, event: string | null,
  verification = appleTransactionVerification(config),
) {
  if (signed.length > 24000 || !/^[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+\.[-_A-Za-z0-9]+$/.test(signed)) {
    throw Error('Apple transaction mismatch')
  }
  const submitted = validatedTransaction(await verification.decode(signed), config)
  // Check Apple's current representation before using an older signed receipt.
  const current = validatedTransaction(await verification.current(submitted.id), config)
  if (current.id !== submitted.id || current.token !== submitted.token) throw Error('Apple transaction mismatch')
  const result = await db.rpc('complete_native_tournament_purchase', {
    p_actor: owner, p_token: current.token, p_environment: config.environment,
    p_transaction: current.id, p_signed_at: current.signedAt, p_revoked: current.revoked, p_event: event,
  })
  if (result.error || !result.data) throw Error('Tournament purchase unavailable')
  return { outcome: result.data, transactionId: current.id, environment: config.environment }
}
