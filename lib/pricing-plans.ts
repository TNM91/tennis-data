import {
  getMembershipTier,
  PRODUCT_PROOF_POINTS,
  type MembershipTierId,
} from '@/lib/product-story'

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
    name: getMembershipTier('free').name,
    subtitle: getMembershipTier('free').shortPromise,
    audience: getMembershipTier('free').audience,
    priceLabel: '$0',
    ctaLabel: 'Get Started Free',
    problem: 'Want to understand the tennis landscape faster?',
    friction: 'Player, team, league, and ranking information is scattered across too many places.',
    solution: getMembershipTier('free').description,
    outcome: 'Find context faster, then upgrade only when a tool makes your tennis life easier.',
    valueProps: getMembershipTier('free').valueProps,
  },
  {
    id: 'player_plus',
    name: getMembershipTier('player_plus').name,
    subtitle: getMembershipTier('player_plus').shortPromise,
    audience: getMembershipTier('player_plus').audience,
    priceLabel: '$4.99/month',
    ctaLabel: 'Unlock Player',
    problem: 'Want TenAceIQ to revolve around your game?',
    friction: 'Raw match history does not tell you who to follow, how you match up, or what to prepare for next.',
    solution: getMembershipTier('player_plus').description,
    outcome: 'Follow what matters, compare matchups faster, and prepare with a personalized tennis lab.',
    valueProps: getMembershipTier('player_plus').valueProps,
  },
  {
    id: 'captain',
    name: getMembershipTier('captain').name,
    subtitle: getMembershipTier('captain').shortPromise,
    audience: getMembershipTier('captain').audience,
    priceLabel: '$9.99/month',
    badge: 'Most Popular',
    ctaLabel: 'Unlock Captain Tools',
    problem: 'Running a team every week?',
    friction: 'Availability chaos, lineup guesswork, and group-text coordination turn every week into extra work.',
    solution: getMembershipTier('captain').description,
    outcome: 'Save time, build smarter lineups, and keep the team week easier to understand.',
    valueProps: getMembershipTier('captain').valueProps,
  },
  {
    id: 'league',
    name: getMembershipTier('league').name,
    subtitle: getMembershipTier('league').shortPromise,
    audience: getMembershipTier('league').audience,
    priceLabel: '$25/season per league',
    alternatePriceNote: 'Captains get 1/2 off their first league',
    ctaLabel: 'Run Your League on TIQ',
    problem: 'Organizing a league or season?',
    friction: 'Rosters, schedules, results, and communication get messy fast in manual tools.',
    solution: getMembershipTier('league').description,
    outcome: 'Run a cleaner league with less manual cleanup and clearer visibility for everyone involved.',
    valueProps: getMembershipTier('league').valueProps,
  },
]

export const PRICING_PROOF_POINTS = PRODUCT_PROOF_POINTS

export const PRICING_HOW_IT_WORKS = [
  'Join',
  'Track',
  'Upgrade',
] as const

export const WHY_TENACEIQ_POINTS = [
  {
    title: 'Free is useful',
    text: getMembershipTier('free').description,
  },
  {
    title: 'Player is personalized',
    text: getMembershipTier('player_plus').upgradeCue,
  },
  {
    title: 'Upgrade by role',
    text: 'Captain is for team leaders. TIQ League Coordinator is for organizers and admins.',
  },
] as const

export const ROLE_BASED_PLAN_RECOMMENDATION: Record<'player' | 'captain' | 'organizer', MembershipTierId> = {
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
