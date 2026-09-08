import { availabilityRedirectHeaders, expandAvailabilityToken } from '@/lib/availability-short-links'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const token = expandAvailabilityToken(code)
  if (!token) return new Response('This link is incomplete. Ask your captain to resend it.', { status: 404, headers: availabilityRedirectHeaders })
  // The original page/API still enforces player scope, expiry and revocation.
  return new Response(null, { status: 307, headers: { ...availabilityRedirectHeaders, Location: `/availability/${token}` } })
}
