import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient } from '@/lib/captain-availability-request-server'
import { resolveCaptainLineupReviewToken } from '@/lib/captain-lineup-review'

export const runtime = 'nodejs'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response
  const { token: rawToken } = await params
  const token = resolveCaptainLineupReviewToken(rawToken)
  if (!token) return Response.json({ ok: false, message: 'This lineup review is invalid.' }, { status: 404 })

  const service = getCaptainAvailabilityServiceClient()
  const { data, error } = await service
    .from('captain_lineup_reviews')
    .select('created_by,status,proposed_slots_json')
    .eq('review_token', token)
    .maybeSingle()
  if (error || !data) return Response.json({ ok: false, message: 'This lineup review was not found.' }, { status: 404 })
  if (!auth.isAdmin && data.created_by !== auth.userId) {
    return Response.json({ ok: false, message: 'Only the captain who requested this review can apply it.' }, { status: 403 })
  }
  if (!data.proposed_slots_json) {
    return Response.json({ ok: false, message: 'The co-captain has not sent a suggestion yet.' }, { status: 409 })
  }

  const acceptedAt = new Date().toISOString()
  const { error: updateError } = await service
    .from('captain_lineup_reviews')
    .update({ status: 'accepted', accepted_at: acceptedAt, updated_at: acceptedAt })
    .eq('review_token', token)
  if (updateError) return Response.json({ ok: false, message: 'The suggestion could not be marked applied.' }, { status: 500 })
  return Response.json({ ok: true })
}
