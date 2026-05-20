import { PRODUCT_MODE_LANGUAGE, type ProductModeId } from './product-story'

export type NavItem = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  items: NavItem[]
}

function modeNavItem(modeId: ProductModeId): NavItem {
  const mode = PRODUCT_MODE_LANGUAGE[modeId]
  return { href: mode.route, label: mode.label }
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  modeNavItem('find'),
  modeNavItem('you'),
  modeNavItem('prep'),
  modeNavItem('team'),
  modeNavItem('league'),
  modeNavItem('plans'),
]

export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: '/profile', label: 'Profile' },
  { href: '/messages', label: 'Messages' },
  { href: '/data-assist', label: 'Data Assist' },
]

export const EXPLORE_NAV_ITEMS: NavItem[] = [
  { href: '/explore/players', label: 'Players' },
  { href: '/explore/teams', label: 'Teams' },
  { href: '/explore/leagues', label: 'Leagues' },
  { href: '/explore/rankings', label: 'Rankings' },
]

export const COMPETE_NAV_ITEMS: NavItem[] = [
  { href: '/compete/leagues', label: 'My Leagues' },
  { href: '/compete/teams', label: 'My Teams' },
  { href: '/compete/schedule', label: 'Schedule' },
  { href: '/compete/results', label: 'Results' },
  { href: '/data-assist', label: 'Data Assist' },
]

export const CAPTAIN_NAV_ITEMS: NavItem[] = [
  { href: '/captain/availability', label: 'Availability' },
  { href: '/captain/lineup-builder', label: 'Lineup' },
  { href: '/captain/scenario-builder', label: 'Scenarios' },
  { href: '/captain/messaging', label: 'Message' },
  { href: '/captain/weekly-brief', label: 'Brief' },
  { href: '/captain/lineup-projection', label: 'Projection' },
  { href: '/captain/lineup-availability', label: 'Match Availability' },
  { href: '/captain/analytics', label: 'Captain IQ' },
  { href: '/captain/team-brief', label: 'Team Brief' },
]

export const CAPTAIN_QUICK_NAV_ITEMS: NavItem[] = [
  { href: '/captain/availability', label: 'Who can play' },
  { href: '/captain/lineup-builder', label: 'Build lineup' },
  { href: '/captain/messaging', label: 'Send plan' },
  { href: '/captain/weekly-brief', label: 'Read brief' },
  { href: '/data-assist', label: 'Refresh data' },
]

export const COORDINATOR_NAV_ITEMS: NavItem[] = [
  { href: '/league-coordinator', label: 'Command' },
  { href: '/league-coordinator#league-setup-form', label: 'Setup season' },
  { href: '/league-coordinator/results', label: 'Team book' },
  { href: '/league-coordinator/individual-results', label: 'Player book' },
  { href: '/data-assist', label: 'Uploads' },
  { href: '/compete/leagues', label: 'My leagues' },
  { href: '/explore/leagues', label: 'Public pages' },
  { href: '/pricing#league', label: 'League plan' },
]

export const FOOTER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Start',
    items: [
      { href: '/', label: 'Home' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/legal/billing', label: 'Billing' },
      { href: '/messages?compose=support', label: 'Support' },
      { href: '/join', label: 'Start Free' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    title: PRODUCT_MODE_LANGUAGE.you.label,
    items: [
      { href: '/profile', label: 'Profile' },
      { href: '/messages', label: 'Messages' },
      { href: '/data-assist', label: 'Data Assist' },
      modeNavItem('find'),
      { href: '/mylab', label: 'My Lab' },
      modeNavItem('prep'),
      { href: '/compete', label: 'Compete' },
    ],
  },
  {
    title: PRODUCT_MODE_LANGUAGE.find.label,
    items: EXPLORE_NAV_ITEMS,
  },
  {
    title: PRODUCT_MODE_LANGUAGE.team.label,
    items: [
      { href: '/captain', label: 'Team Hub' },
      ...CAPTAIN_QUICK_NAV_ITEMS,
    ],
  },
  {
    title: PRODUCT_MODE_LANGUAGE.league.label,
    items: [
      { href: '/league-coordinator', label: 'League Command' },
      { href: '/data-assist', label: 'Data Assist' },
      { href: '/compete/leagues', label: 'My Leagues' },
      { href: '/compete/results', label: 'Results' },
      { href: '/pricing#league', label: 'League Plan' },
    ],
  },
]
