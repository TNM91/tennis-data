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
  modeNavItem('coach'),
  modeNavItem('team'),
  modeNavItem('league'),
  modeNavItem('plans'),
]

export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: '/mylab', label: 'Open My Lab' },
  { href: '/coach', label: 'Coach workspace' },
  { href: '/data-assist', label: 'Improve data' },
  { href: '/matchup', label: 'Prep matchup' },
  { href: '/messages', label: 'Review messages' },
]

export const EXPLORE_NAV_ITEMS: NavItem[] = [
  { href: '/explore/players', label: 'Players' },
  { href: '/explore/teams', label: 'Teams' },
  { href: '/explore/leagues', label: 'Leagues' },
  { href: '/explore/rankings', label: 'Rankings' },
]

export const CAPTAIN_QUICK_NAV_ITEMS: NavItem[] = [
  { href: '/captain/availability', label: 'Who can play' },
  { href: '/captain/practice', label: 'Plan practice' },
  { href: '/tactics', label: 'Map tactics' },
  { href: '/captain/lineup-builder', label: 'Build lineup' },
  { href: '/captain/messaging', label: 'Send plan' },
]

export const COACH_QUICK_NAV_ITEMS: NavItem[] = [
  { href: '/coach', label: 'Coach workspace' },
  { href: '/tactics', label: 'Tactical Studio' },
  { href: '/player-development', label: 'Development paths' },
  { href: '/player-development/relentless-competitor-4-0/coach-planner', label: 'Coach planner' },
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
      { href: '/mylab', label: 'Open My Lab' },
      { href: '/data-assist', label: 'Improve data' },
      { href: '/matchup', label: 'Prep matchup' },
      { href: '/messages', label: 'Review messages' },
    ],
  },
  {
    title: PRODUCT_MODE_LANGUAGE.find.label,
    items: EXPLORE_NAV_ITEMS,
  },
  {
    title: PRODUCT_MODE_LANGUAGE.team.label,
    items: CAPTAIN_QUICK_NAV_ITEMS,
  },
  {
    title: PRODUCT_MODE_LANGUAGE.coach.label,
    items: COACH_QUICK_NAV_ITEMS,
  },
  {
    title: PRODUCT_MODE_LANGUAGE.league.label,
    items: [
      { href: '/compete/schedule', label: 'Shared calendar' },
      { href: '/league-coordinator/tournaments', label: 'Build tournament' },
      { href: '/league-coordinator/results', label: 'Team book' },
      { href: '/league-coordinator/individual-results', label: 'Player book' },
    ],
  },
]
