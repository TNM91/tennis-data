import {
  getMembershipTier,
  PRODUCT_PROOF_POINTS,
  type MembershipTierId,
} from './product-story'

export type PricingPlanId = 'free' | 'player_plus' | 'coach' | 'captain' | 'league' | 'full_court'
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
  coach: boolean
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
  coach: false,
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

const COACH_ENTITLEMENTS: PricingEntitlementGrant = {
  ...PLAYER_ENTITLEMENTS,
  coach: true,
}

const LEAGUE_COORDINATOR_ENTITLEMENTS: PricingEntitlementGrant = {
  ...NO_ENTITLEMENTS,
  leagueCoordinator: true,
  tiqTeamLeagueEntry: true,
  tiqIndividualLeagueCreator: true,
}

const FULL_COURT_ENTITLEMENTS: PricingEntitlementGrant = {
  ...CAPTAIN_ENTITLEMENTS,
  coach: true,
  leagueCoordinator: true,
  tiqTeamLeagueEntry: true,
  tiqIndividualLeagueCreator: true,
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
  coach: {
    amountCents: 999,
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
    amountCents: 1499,
    currency: USD,
    interval: 'season',
    checkoutMode: 'one_time',
    quantityMode: 'league',
  },
  full_court: {
    amountCents: 1999,
    currency: USD,
    interval: 'month',
    checkoutMode: 'subscription',
    quantityMode: 'account',
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
  return `${formatUsd(billing.amountCents)}/season workspace`
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
    outcome: 'Find context faster, then upgrade only when a workspace makes your tennis life easier.',
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
    outcome: 'Open My Lab, improve your data, prep matchups, and keep tennis messages together.',
    valueProps: getMembershipTier('player_plus').valueProps,
  },
  {
    id: 'coach',
    name: getMembershipTier('coach').name,
    subtitle: getMembershipTier('coach').shortPromise,
    audience: getMembershipTier('coach').audience,
    billing: PRICING_BILLING.coach,
    entitlementGrant: COACH_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.coach),
    ctaLabel: 'Unlock Coach',
    problem: 'Teaching players week after week?',
    friction: 'Lesson notes, player goals, drills, schedules, and follow-up messages get scattered fast.',
    solution: getMembershipTier('coach').description,
    outcome: 'Plan lessons, assign court work, and keep each player development path easier to track.',
    valueProps: getMembershipTier('coach').valueProps,
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
    ctaLabel: 'Unlock Captain',
    problem: 'Managing competitive team decisions?',
    friction: 'Availability chaos, lineup guesswork, and group-text coordination turn every week into extra work.',
    solution: getMembershipTier('captain').description,
    outcome: 'Save time, build smarter lineups, and keep the match week easier to understand.',
    valueProps: getMembershipTier('captain').valueProps,
  },
  {
    id: 'league',
    name: getMembershipTier('league').name,
    subtitle: getMembershipTier('league').shortPromise,
    audience: getMembershipTier('league').audience,
    billing: PRICING_BILLING.league,
    entitlementGrant: LEAGUE_COORDINATOR_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.league),
    ctaLabel: 'Unlock League',
    problem: 'Organizing a league, ladder, or tournament?',
    friction: 'Participants, schedules, results, and communication get messy fast in spreadsheets and message threads.',
    solution: getMembershipTier('league').description,
    outcome: 'Run one cleaner competition workspace with less manual cleanup and clearer visibility for everyone involved.',
    valueProps: getMembershipTier('league').valueProps,
  },
  {
    id: 'full_court',
    name: getMembershipTier('full_court').name,
    subtitle: getMembershipTier('full_court').shortPromise,
    audience: getMembershipTier('full_court').audience,
    billing: PRICING_BILLING.full_court,
    entitlementGrant: FULL_COURT_ENTITLEMENTS,
    priceLabel: formatPricingBillingLabel(PRICING_BILLING.full_court),
    badge: 'Full Suite',
    ctaLabel: 'Unlock Full-Court',
    problem: 'Running more than one tennis job?',
    friction: 'Coach work, captain work, league operations, tournaments, and player context split apart when the season gets busy.',
    solution: getMembershipTier('full_court').description,
    outcome: 'Run every TenAceIQ workspace with unlimited tournament room.',
    valueProps: getMembershipTier('full_court').valueProps,
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
    text: 'Coach is for player development. Captain is for team decisions. Full-Court unlocks everything.',
  },
] as const

export const ROLE_BASED_PLAN_RECOMMENDATION: Record<'player' | 'coach' | 'captain' | 'organizer', MembershipTierId> = {
  player: 'player_plus',
  coach: 'coach',
  captain: 'captain',
  organizer: 'league',
}

export function getPricingPlan(planId: PricingPlanId) {
  return PRICING_PLANS.find((plan) => plan.id === planId) ?? PRICING_PLANS[0]
}

export function getPlanHierarchyWeight(planId: PricingPlanId) {
  switch (planId) {
    case 'full_court':
      return 6
    case 'league':
      return 5
    case 'captain':
      return 4
    case 'coach':
      return 3
    case 'player_plus':
      return 2
    case 'free':
    default:
      return 0
  }
}
