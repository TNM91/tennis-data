import { getAdminApiAuth } from '@/lib/admin-api-auth'
import { summarizeAccountTiers, type AccountTierRow } from '@/lib/admin-account-tiers'

export const runtime = 'nodejs'

const PAGE_SIZE = 1000
const PROFILE_COLUMNS = 'role,stripe_customer_id,stripe_subscription_id,player_plus_subscription_active,player_plus_subscription_status,player_plus_access_expires_at,coach_subscription_active,coach_subscription_status,coach_access_expires_at,captain_subscription_active,captain_subscription_status,captain_access_expires_at,tiq_team_league_entry_enabled,tiq_individual_league_creator_enabled,league_access_expires_at'

export async function GET(request: Request) {
  const auth = await getAdminApiAuth(request)
  if (!auth.ok) return auth.response

  const rows: AccountTierRow[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await auth.service
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .order('id')
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      return Response.json({ ok: false, message: 'Account tiers could not be loaded.' }, { status: 500 })
    }
    rows.push(...((data ?? []) as AccountTierRow[]))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  return Response.json({ ok: true, ...summarizeAccountTiers(rows), asOf: new Date().toISOString() }, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
