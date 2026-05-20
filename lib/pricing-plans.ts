import {
  getMembershipTier,
  PRODUCT_PROOF_POINTS,
  type MembershipTierId,
} from './product-story'

export type PricingPlanId = 'free' | 'player_plus' | 'captain' | 'league'
export type PricingBillingInterval = 'none' | 'month' | 'season'
export type PricingCheckoutMode = 'none' | 'subscription' | 'one_time'
export type PricingQuantityMode = 'account' | 'league'
export type PricingCurrency = 'usd'

export type PricingBillingModel = {
  amountCents: number
  currency: PricingCurrency
  interval: PricingBillingInterval
  checkoutMode: PricingCheckoutMode
  quantityMode: PricingQuantityMode
}

export type PricingEntitlementGrant = {
  playerPlus: boolean
  captain: boolean
  leagueCoordinator: boolean
  tiqTeamLeagueEntry: boolean
  tiqIndividualLeagueCreator: boolean
}

export type PricingDiscountRule = {
  id: 'captain_first_league_half_off'
  label: string
  percentOff: number
  appliesToPlanId: PricingPlanId
  eligibility: 'active_captain_first_league'
}

export type PricingPlan = {
  id: PricingPlanId
  name: string
  subtitle: string
  audience: string
  billing: PricingBillingModel
  entitlementGrant: PricingEntitlementGrant
  discountRules?: PricingDiscountRule[]
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

const USD = 'usd' satisfies PricingCurrency

const NO_ENTITLEMENTS: PricingEntitlementGrant = {
  playerPlus: false,
  captain: false,
  leagueCoordinator: false,
  tiqTeamLeagueEntry: false,
  tiqIndividualLeagueCreator: false,
}

const PLAYER_ENTITLEMENTS: PricingEntitlementGrant = {
  ...NO_ENTITLEMENTS,
  playerPlus: true,
}

const CAPTAIN_ENTITLEMENTS: PricingEntitlementGrant = {
  ...PLAYER_ENTITLEMENTS,
  captain: true,
}

const LEAGUE_COORDINATOR_ENTITLEMENTS: PricingEntitlementGrant = {
  ...NO_ENTITLEMENTS,
  leagueCoordinator: true,
  tiqTeamLeagueEntry: true,
  tiqIndividualLeagueCreator: true,
}

const CAPTAIN_FIRST_LEAGUE_DISCOUNT: PricingDiscountRule = {
  id: 'captain_first_league_half_off',
  label: 'Captains get 1/2 off their first league',
  percentOff: 50,
  appliesToPlanId: 'league',
  eligibility: 'active_captain_first_league',
}

const PRICING_BILLING: Record<PricingPlanId, PricingBillingModel> = {
  free: {
    amountCents: 0,
    currency: USD,
    interval: 'none',
    checkoutMode: 'none',
    quantityMode: 'account',
  },
  player_plus: {
    amountCents: 499,
    currency: USD,
    interval: 'month',
    checkoutMode: 'subscription',
    quantityMode: 'account',
  },
  captain: {
    amountCents: 999,
    currency: USD,
    interval: 'month',
    checkoutMode: 'subscription',
    quantityMode: 'account',
  },
  league: {
    amountCents: 2500,
    currency: USD,
    interval: 'season',
    checkoutMode: 'one_time',
    quantityMode: 'league',
  },
}

function formatUsd(amountCents: number) {
  if (amountCents === 0) return '$0'
  const dollars = amountCents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export function formatPricingBillingLabel(billing: PricingBillingModel) {
  if (billing.amountCents === 0 || billing.interval === 'none') return '$0'
  if (billing.interval === 'month') return `${formatUsd(billing.amountCents)}/month`
  return `${formatUsd(billing.amountCents)}/season per ${billing.quantityMode}`
}

export function getPricingBillingCue(planId: PricingPlanId) {
  const plan = getPricingPlan(planId)
  if (plan.billing.checkoutMode === 'none') return 'Free account'
  if (plan.billing.checkoutMode === 'subscription') return 'Monthly subscription'
  return 'Season fee'
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: getMembershipTier('free').name,
    subtitle: getMembershipTier('free').shortPromise,
    audience: getMembershipTier('free').audience,
    billing: PRICING_BILLING.free,
    entitlementGrant: NO_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.free),
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
    billing: PRICING_BILLING.player_plus,
    entitlementGrant: PLAYER_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.player_plus),
    ctaLabel: 'Unlock Player',
    problem: 'Want TenAceIQ to revolve around your game?',
    friction: 'Raw match history does not tell you who to follow, how the next match shapes up, or what to prepare for next.',
    solution: getMembershipTier('player_plus').description,
    outcome: 'Follow what matters, compare matches faster, and prepare with a personalized tennis lab.',
    valueProps: getMembershipTier('player_plus').valueProps,
  },
  {
    id: 'captain',
    name: getMembershipTier('captain').name,
    subtitle: getMembershipTier('captain').shortPromise,
    audience: getMembershipTier('captain').audience,
    billing: PRICING_BILLING.captain,
    entitlementGrant: CAPTAIN_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.captain),
    badge: 'Most Popular',
    ctaLabel: 'Unlock Team Tools',
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
    billing: PRICING_BILLING.league,
    entitlementGrant: LEAGUE_COORDINATOR_ENTITLEMENTS,
    discountRules: [CAPTAIN_FIRST_LEAGUE_DISCOUNT],
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.league),
    alternatePriceNote: CAPTAIN_FIRST_LEAGUE_DISCOUNT.label,
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
    text: 'Team is for captains. League is for organizers and admins.',
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
