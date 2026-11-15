import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { FIRST_PARTY_COMPETITION_FEES } from './first-party-competition-prices'
import { appleTransactionVerification, currentAppleCompetitionPurchase, type ApplePurchaseConfiguration } from './apple-purchase-server'

export async function applyLeagueApplePurchase(
  db: SupabaseClient, config: ApplePurchaseConfiguration, signed: string,
  owner: string | null, draft: string | null,
  verification = appleTransactionVerification(config),
) {
  const current = await currentAppleCompetitionPurchase(config, signed, FIRST_PARTY_COMPETITION_FEES.league.productId, verification)
  const result = await db.rpc('complete_native_league_purchase', {
    p_actor: owner, p_draft: draft, p_token: current.token, p_transaction: current.id,
    p_environment: config.environment, p_signed_at: current.signedAt, p_revoked: current.revoked,
  })
  if (result.error || !result.data) throw Error('League purchase unavailable')
  return { outcome: result.data, transactionId: current.id }
}
