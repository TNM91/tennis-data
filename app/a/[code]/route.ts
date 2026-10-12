import { availabilityRedirectHeaders, expandAvailabilityToken } from '@/lib/availability-short-links'

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const token = expandAvailabilityToken(code)
  if (!token) return new Response('This link is incomplete. Ask your captain to resend it.', { status: 404, headers: availabilityRedirectHeaders })
  const destination = '/availability/' + token
  const url = 'https://www.tenaceiq.com/a/' + code
  const image = 'https://www.tenaceiq.com/availability/opengraph-image?v=20261005'
  // Messaging crawlers receive the preview on their first request. Browsers
  // continue to the original page, whose API enforces scope and expiry.
  return new Response(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Are you available to play? | TenAceIQ</title>
<meta name="robots" content="noindex,nofollow,noarchive">
<meta name="description" content="Reply In, Out, or Maybe so your captain can build the lineup.">
<meta property="og:type" content="website"><meta property="og:site_name" content="TenAceIQ">
<meta property="og:title" content="Are you available to play?">
<meta property="og:description" content="Reply In, Out, or Maybe so your captain can build the lineup.">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${image}"><meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Match Availability — Are you in?">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="Are you available to play?">
<meta name="twitter:image" content="${image}">
</head><body><main><h1>Are you available to play?</h1><a href="${destination}">Reply for your match</a></main>
<script>window.location.replace(${JSON.stringify(destination)})</script>
</body></html>`, { headers: { ...availabilityRedirectHeaders, 'Content-Type': 'text/html; charset=utf-8' } })
}
