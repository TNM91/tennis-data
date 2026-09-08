// Lossless encoding, not truncation: keep every bit of the existing bearer
// token. No new invitation, database mapping, expiration or access rule.
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function compactAvailabilityToken(token: string): string | null {
  if (!uuidPattern.test(token)) return null
  const hex = token.replaceAll('-', '')
  const bytes = Array.from({ length: 16 }, (_, index) => String.fromCharCode(parseInt(hex.slice(index * 2, index * 2 + 2), 16))).join('')
  return btoa(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

export function expandAvailabilityToken(code: string): string | null {
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null
  const bytes = atob(code.replaceAll('-', '+').replaceAll('_', '/') + '==')
  const hex = Array.from(bytes, byte => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  const token = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  // Reject alternative spellings with nonzero unused base64 padding bits.
  return compactAvailabilityToken(token) === code ? token : null
}

export function matchAvailabilityPath(token: string) {
  const code = compactAvailabilityToken(token)
  return code ? `/a/${code}` : `/availability/${encodeURIComponent(token)}`
}

export function seasonAvailabilityPath(token: string) {
  const code = compactAvailabilityToken(token)
  // Keep season secrets in the fragment, never in the page request or referrer.
  return code ? `/s#${code}` : `/season-availability#${encodeURIComponent(token)}`
}

export function readSeasonAvailabilityToken(fragment: string) {
  const value = fragment.replace(/^#/, '')
  return expandAvailabilityToken(value) || (uuidPattern.test(value) ? value : '')
}

export const availabilityRedirectHeaders = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}
