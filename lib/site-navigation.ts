export type NavItem = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/explore', label: 'Explore' },
  { href: '/player-development', label: 'Improve' },
  { href: '/compete', label: 'Compete' },
  { href: '/manage', label: 'Manage' },
  { href: '/coaches', label: 'Coaches' },
  { href: '/leagues-and-tournaments', label: 'Leagues & Tournaments' },
  { href: '/mylab', label: 'My Lab' },
]

export const ACCOUNT_NAV_ITEMS: NavItem[] = [
  { href: '/level-up', label: 'Level Up' },
  { href: '/mylab', label: 'Open My Lab' },
  { href: '/tactics', label: 'Tactics Tools' },
  { href: '/coach', label: 'Coach Hub' },
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
  { href: '/coaches', label: 'Find coaches' },
  { href: '/coach', label: 'Coach Hub' },
  { href: '/tactics', label: 'Tactical Studio' },
  { href: '/player-development', label: 'Development paths' },
  { href: '/player-development/relentless-competitor-4-0/coach-planner', label: 'Coach planner' },
]

export const FOOTER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Start',
    items: [
      { href: '/', label: 'Home' },
      { href: '/explore', label: 'Explore' },
      { href: '/resources', label: 'Resources' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/legal/billing', label: 'Billing' },
      { href: '/messages?compose=support', label: 'Support' },
      { href: '/join', label: 'Start Free' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    title: 'Improve',
    items: [
      { href: '/level-up', label: 'Level Up' },
      { href: '/player-development', label: 'Player development' },
      { href: '/mylab', label: 'Open My Lab' },
      { href: '/data-assist', label: 'Improve data' },
      { href: '/matchup', label: 'Prep matchup' },
      { href: '/messages', label: 'Review messages' },
    ],
  },
  {
    title: 'Explore',
    items: EXPLORE_NAV_ITEMS,
  },
  {
    title: 'Compete',
    items: [
      { href: '/compete', label: 'Compete hub' },
      { href: '/matchup', label: 'Matchup insights' },
      { href: '/explore/rankings', label: 'Rankings' },
      { href: '/compete/results', label: 'Results' },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/manage', label: 'Manage hub' },
      ...CAPTAIN_QUICK_NAV_ITEMS,
    ],
  },
  {
    title: 'Coaches',
    items: COACH_QUICK_NAV_ITEMS,
  },
  {
    title: 'Leagues and tournaments',
    items: [
      { href: '/leagues', label: 'Find leagues' },
      { href: '/tournaments', label: 'Find tournaments' },
      { href: '/compete/schedule', label: 'Shared calendar' },
      { href: '/league-coordinator/tournaments', label: 'Build tournament' },
      { href: '/league-coordinator/results', label: 'Team book' },
      { href: '/league-coordinator/individual-results', label: 'Player book' },
    ],
  },
]
