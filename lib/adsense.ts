export const ADSENSE_PUBLISHER_ID = 'ca-pub-1351888380884789'

export const ADSENSE_ALLOWED_PATH_PREFIXES = [
  '/',
  '/about',
  '/contact',
  '/explore',
  '/faq',
  '/how-it-works',
  '/leagues',
  '/matchup',
  '/methodology',
  '/players',
  '/rankings',
  '/teams',
] as const

export function isAdSafePath(pathname: string): boolean {
  if (!pathname) return false

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/captain') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/join') ||
    pathname.startsWith('/forget-password') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/mylab') ||
    pathname.startsWith('/api')
  ) {
    return false
  }

  return ADSENSE_ALLOWED_PATH_PREFIXES.some((prefix) =>
    prefix === '/'
      ? pathname === '/'
      : pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function getConfiguredAdSlot(slot: string | undefined | null) {
  const trimmed = (slot || '').trim()
  return trimmed.length ? trimmed : null
}
