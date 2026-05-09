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
  { href: '/mylab', label: 'My Lab' },
  { href: '/matchup', label: 'Matchup' },
  { href: '/captain', label: 'Captain' },
  { href: '/league-coordinator', label: 'Coordinator' },
  { href: '/pricing', label: 'Pricing' },
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
  { href: '/captain/availability', label: 'Availability' },
  { href: '/captain/lineup-builder', label: 'Lineup' },
  { href: '/captain/messaging', label: 'Message' },
  { href: '/captain/weekly-brief', label: 'Brief' },
  { href: '/data-assist', label: 'Data Assist' },
]

export const COORDINATOR_NAV_ITEMS: NavItem[] = [
  { href: '/league-coordinator', label: 'Overview' },
  { href: '/league-coordinator#league-setup-form', label: 'Setup' },
  { href: '/league-coordinator/results', label: 'Team Results' },
  { href: '/league-coordinator/individual-results', label: 'Player Results' },
  { href: '/data-assist', label: 'Data Assist' },
  { href: '/compete/leagues', label: 'My Leagues' },
  { href: '/explore/leagues', label: 'Browse' },
  { href: '/pricing#league', label: 'Plan' },
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
    title: 'Player',
    items: [
      { href: '/profile', label: 'Profile' },
      { href: '/messages', label: 'Messages' },
      { href: '/data-assist', label: 'Data Assist' },
      { href: '/explore', label: 'Explore' },
      { href: '/mylab', label: 'My Lab' },
      { href: '/matchup', label: 'Matchup' },
      { href: '/compete', label: 'Compete' },
    ],
  },
  {
    title: 'Find',
    items: EXPLORE_NAV_ITEMS,
  },
  {
    title: 'Run',
    items: [
      { href: '/captain', label: 'Captain Hub' },
      ...CAPTAIN_QUICK_NAV_ITEMS,
    ],
  },
  {
    title: 'Coordinate',
    items: [
      { href: '/league-coordinator', label: 'League Coordinator' },
      { href: '/data-assist', label: 'Data Assist' },
      { href: '/compete/leagues', label: 'My Leagues' },
      { href: '/compete/results', label: 'Results' },
      { href: '/pricing#league', label: 'Coordinator Plan' },
    ],
  },
]
