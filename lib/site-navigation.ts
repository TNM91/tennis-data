export type NavItem = {
  href: string
  label: string
}

export type NavSection = {
  title: string
  items: NavItem[]
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/compete', label: 'Compete' },
  { href: '/captain', label: 'Captain' },
  { href: '/mylab', label: 'My Lab' },
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
]

export const CAPTAIN_NAV_ITEMS: NavItem[] = [
  { href: '/captain/availability', label: 'Availability' },
  { href: '/captain/lineup-builder', label: 'Lineup Builder' },
  { href: '/captain/lineup-projection', label: 'Lineup Projection' },
  { href: '/captain/lineup-availability', label: 'Lineup Availability' },
  { href: '/captain/scenario-builder', label: 'Scenario Builder' },
  { href: '/captain/analytics', label: 'Analytics' },
  { href: '/captain/messaging', label: 'Messaging' },
  { href: '/captain/team-brief', label: 'Team Brief' },
  { href: '/captain/weekly-brief', label: 'Weekly Brief' },
  { href: '/captain/season-dashboard', label: 'Season Dashboard' },
]

export const FOOTER_NAV_SECTIONS: NavSection[] = [
  {
    title: 'Platform',
    items: PRIMARY_NAV_ITEMS,
  },
  {
    title: 'Explore',
    items: EXPLORE_NAV_ITEMS,
  },
  {
    title: 'Captain',
    items: CAPTAIN_NAV_ITEMS,
  },
]
