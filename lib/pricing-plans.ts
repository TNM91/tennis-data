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
    problem: 'Need a simple place to get started?',
    friction: 'It is hard to stay organized when your profile, teams, and match history live in different places.',
    solution: 'Start free with the core player experience.',
    outcome: 'Join your team, track your matches, and stay in the weekly flow without friction.',
    valueProps: [
      'Create your player profile',
      'Track matches and results',
      'Join teams and leagues',
      'Set availability',
      'View posted lineups',
      'Basic stats and history',
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
    problem: 'Not sure where you should play?',
    friction: 'Raw match history does not tell you where you fit best or how to improve faster.',
    solution: 'Unlock personal analytics and lineup-fit insight.',
    outcome: 'See where you should play, understand your game faster, and make better match decisions.',
    valueProps: [
      'Personal performance analytics',
      'Where should I play? recommendations',
      'Opponent insights when available',
      'Match performance projections',
      'Strengths and weaknesses breakdown',
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
      'AI-powered lineup builder',
      'Scenario builder',
      'Win probability projections',
      'Player availability dashboard',
      'Suggested optimal lineups',
      'Team messaging and notifications',
      'Conflict detection',
    ],
  },
  {
    id: 'league',
    name: 'League',
    subtitle: 'Run your league without spreadsheets',
    audience: 'Organizers who want structure, visibility, and simplicity',
    priceLabel: '$10/season per league',
    ctaLabel: 'Run Your League on TIQ',
    problem: 'Running your league in spreadsheets?',
    friction: 'Scheduling, standings, and league communication get messy fast when everything lives in manual tools.',
    solution: 'Move league operations into TIQ.',
    outcome: 'Create organized competition with cleaner scheduling, standings, and league-wide visibility.',
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
