export type SiteNavItem = {
  href: string
  label: string
  match?: 'exact' | 'startsWith'
}

export const PRIMARY_NAV: SiteNavItem[] = [
  { href: '/', label: 'Home', match: 'exact' },
  { href: '/players', label: 'Players', match: 'startsWith' },
  { href: '/rankings', label: 'Rankings', match: 'startsWith' },
  { href: '/matchup', label: 'Matchup', match: 'startsWith' },
  { href: '/leagues', label: 'Leagues', match: 'startsWith' },
  { href: '/teams', label: 'Teams', match: 'startsWith' },
  { href: '/captains-corner', label: "Captain's Corner", match: 'startsWith' },
  { href: '/admin', label: 'Admin', match: 'startsWith' },
]

export function isNavActive(pathname: string, item: SiteNavItem) {
  if (item.match === 'exact') return pathname === item.href
  if (item.href === '/') return pathname === '/'
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
