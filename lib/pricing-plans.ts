export type PricingPlanId = 'free' | 'player_plus' | 'captain' | 'league'

export type PricingPlan = {
  id: PricingPlanId
  name: string
  subtitle: string
  audience: string
  priceLabel: string
  alternatePriceNote?: string
  badge?: string
  ctaLabel: string
  problem: string
  friction: string
  solution: string
  outcome: string
  valueProps: string[]
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    subtitle: 'Get in the game',
    audience: 'Players getting started',
    priceLabel: '$0',
    ctaLabel: 'Get Started Free',
    problem: 'Want to find your tennis world faster?',
    friction: 'Basic player, team, and league information is scattered across too many places.',
    solution: 'Search players, view public ratings and history, and explore teams and leagues.',
    outcome: 'Find your league, track your team, and understand the basics before you upgrade.',
    valueProps: [
      'Search players',
      'View public ratings and history',
      'Explore teams and leagues',
      'Follow basic tennis data',
    ],
  },
  {
    id: 'player_plus',
    name: 'Player+',
    subtitle: 'Play smarter. Improve faster.',
    audience: 'Players who want a competitive edge',
    priceLabel: '$4.99/month',
    ctaLabel: 'Unlock Player+',
    problem: 'Want to know how you match up before you play?',
    friction: 'Raw match history does not tell you who has the edge or what to prepare for.',
    solution: 'Unlock Matchup, MyLab, and follows in one personalized tennis dashboard.',
    outcome: 'Compare players before the match, track form, and prepare with more confidence.',
    valueProps: [
      'Unlock Matchup',
      'Unlock MyLab',
      'Follow players, teams, and leagues in one dashboard',
      'Compare players before matches',
      'Track form, trends, and insights',
    ],
  },
  {
    id: 'captain',
    name: 'Captain',
    subtitle: 'Run your team like a pro',
    audience: 'Captains tired of guesswork and group texts',
    priceLabel: '$9.99/month',
    badge: 'Most Popular',
    ctaLabel: 'Unlock Captain Tools',
    problem: 'Running a team every week?',
    friction: 'Availability chaos, lineup guesswork, and group-text coordination turn every week into extra work.',
    solution: 'Use Captain tools to see availability, build lineups, test scenarios, and message players.',
    outcome: 'Save time, build smarter lineups, reduce stress, and win more matches.',
    valueProps: [
      'Unlock lineup tools',
      'Scenario Builder',
      'Availability',
      'Team messaging',
      'Match planning tools',
    ],
  },
  {
    id: 'league',
    name: 'League',
    subtitle: 'Manage league operations',
    audience: 'Organizers and admins who need clean season workflows',
    priceLabel: '$25/season per league',
    alternatePriceNote: 'Captains get 1/2 off their first league',
    ctaLabel: 'Run Your League on TIQ',
    problem: 'Organizing a league or season?',
    friction: 'Rosters, schedules, results, and communication get messy fast in manual tools.',
    solution: 'Create and manage TIQ leagues with teams, rosters, schedules, and results in one place.',
    outcome: 'Run a cleaner season with less manual cleanup.',
    valueProps: [
      'Create and manage TIQ leagues',
      'Manage teams and rosters',
      'Build schedules',
      'Track results',
      'Organize league communication',
    ],
  },
]

export const PRICING_PROOF_POINTS = [
  'Less admin',
  'Sharper lineups',
  'Cleaner league play',
  'Better match prep',
] as const

export const PRICING_HOW_IT_WORKS = [
  'Join',
  'Track',
  'Upgrade',
] as const

export const WHY_TENACEIQ_POINTS = [
  {
    title: 'Free is useful',
    text: 'Search players, teams, leagues, ratings, and match history.',
  },
  {
    title: 'Player+ is the next step',
    text: 'Unlock Matchup, MyLab, follows, form, trends, and smarter match prep.',
  },
  {
    title: 'Upgrade by role',
    text: 'Captain is for team leaders. League is for organizers.',
  },
] as const

export const ROLE_BASED_PLAN_RECOMMENDATION: Record<'player' | 'captain' | 'organizer', PricingPlanId> = {
  player: 'player_plus',
  captain: 'captain',
  organizer: 'league',
}

export function getPricingPlan(planId: PricingPlanId) {
  return PRICING_PLANS.find((plan) => plan.id === planId) ?? PRICING_PLANS[0]
}

export function getPlanHierarchyWeight(planId: PricingPlanId) {
  switch (planId) {
    case 'captain':
      return 3
    case 'player_plus':
      return 2
    case 'league':
      return 1
    case 'free':
    default:
      return 0
  }
}
