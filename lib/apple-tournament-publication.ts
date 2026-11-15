import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { applePurchaseConfiguration, appleTransactionVerification, currentAppleCompetitionPurchase, type ApplePurchaseConfiguration } from './apple-purchase-server'
import { FIRST_PARTY_COMPETITION_FEES } from './first-party-competition-prices'

export function tournamentAppleConfiguration() {
  const config = applePurchaseConfiguration()
  return process.env.APPLE_TOURNAMENT_PURCHASES_ENABLED === 'true' && config?.mode !== 'off' ? config : null
}

export async function applyTournamentApplePurchase(
  db: SupabaseClient, config: ApplePurchaseConfiguration, signed: string,
  owner: string | null, event: string | null,
  verification = appleTransactionVerification(config),
) {
  const current = await currentAppleCompetitionPurchase(config, signed, FIRST_PARTY_COMPETITION_FEES.tournament.productId, verification)
  const result = await db.rpc('complete_native_tournament_purchase', {
    p_actor: owner, p_token: current.token, p_environment: config.environment,
    p_transaction: current.id, p_signed_at: current.signedAt, p_revoked: current.revoked, p_event: event,
  })
  if (result.error || !result.data) throw Error('Tournament purchase unavailable')
  return { outcome: result.data, transactionId: current.id, environment: config.environment }
}
