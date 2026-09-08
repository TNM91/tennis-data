import { availabilityRedirectHeaders } from '@/lib/availability-short-links'

export async function GET() {
  // Browsers carry the original fragment through a redirect with no fragment.
  // Decoding happens on the private season page; the server never sees the code.
  return new Response(null, { status: 307, headers: { ...availabilityRedirectHeaders, Location: '/season-availability' } })
}
