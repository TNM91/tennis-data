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
    solution: 'Search public tennis data and view available player, team, and league pages.',
    outcome: 'Find your league, track your team, and understand the basics before you upgrade.',
    valueProps: [
      'Search basic public tennis data',
      'View basic players, teams, and leagues where available',
      'Find your league',
      'Track your team',
      'See posted match results',
      'Start your TenAceIQ profile',
    ],
  },
  {
    id: 'player_plus',
    name: 'Player+',
    subtitle: 'Play smarter. Improve faster.',
    audience: 'Players who want a competitive edge',
    priceLabel: '$4.99/month',
    alternatePriceNote: 'or $25/season',
    ctaLabel: 'Unlock Player+',
    problem: 'Want to know how you match up before you play?',
    friction: 'Raw match history does not show matchup fit, likely pressure points, or what to prepare for.',
    solution: 'Unlock Matchup, MyLab, follows, and smarter player/team preparation.',
    outcome: 'Compare players before the match, prepare faster, and know what gives you an edge.',
    valueProps: [
      'Unlock Matchup',
      'Unlock MyLab',
      'Compare players before the match',
      'Follow players, teams, and leagues',
      'Prepare faster for upcoming matches',
      'Smarter player and team prep',
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
    problem: 'Still building lineups manually?',
    friction: 'Availability chaos, lineup guesswork, and group-text coordination turn every week into extra work.',
    solution: 'Unlock the full captain workflow in one place.',
    outcome: 'Save time, build smarter lineups, reduce stress, and win more matches.',
    valueProps: [
      'Unlock Lineup Builder',
      'Unlock Scenario Builder',
      'Manage availability and team planning',
      'Compare lineup options',
      'Message your team from captain workflows',
      'Prep faster for match week',
      'Reduce weekly guesswork',
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
    problem: 'Need cleaner league and admin workflows?',
    friction: 'Scheduling, imports, standings, and league communication get messy fast in manual tools.',
    solution: 'Use league tools for management, imports, and admin workflows where applicable.',
    outcome: 'Run a cleaner season with better data, clearer operations, and less manual cleanup.',
    valueProps: [
      'League creation and management',
      'Scheduling tools',
      'Standings and results tracking',
      'Team and player organization',
      'League-wide communication',
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
    text: 'Profiles, availability, teams, leagues, and match history.',
  },
  {
    title: 'Upgrade by role',
    text: 'Player+ for your game, Captain for the team week, League for organizers.',
  },
  {
    title: 'Built for outcomes',
    text: 'Better decisions, less stress, cleaner competition.',
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
