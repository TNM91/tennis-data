import { getClubApiAuth } from '@/lib/club-api-auth'
import { mapClubBillingAccountRow } from '@/lib/club-billing'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const auth = await getClubApiAuth(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.supabase
    .from('club_billing_accounts')
    .select('owner_user_id,plan_id,status,stripe_customer_id,stripe_subscription_id')
    .eq('owner_user_id', auth.userId)
    .maybeSingle()

  if (error) {
    return Response.json({ ok: false, message: 'Club billing could not be checked.' }, { status: 500 })
  }

  return Response.json({ ok: true, billing: mapClubBillingAccountRow(data as Record<string, unknown> | null) })
}
