import { availabilityRedirectHeaders, expandAvailabilityToken } from '@/lib/availability-short-links'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!expandAvailabilityToken(code)) {
    return new Response('This lineup review link is incomplete. Ask the captain to resend it.', { status: 404, headers: availabilityRedirectHeaders })
  }
  return new Response(null, {
    status: 307,
    headers: {
      ...availabilityRedirectHeaders,
      Location: `/lineup-review/${encodeURIComponent(code)}`,
    },
  })
}
