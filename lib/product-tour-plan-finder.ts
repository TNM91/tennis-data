import { getPlanSignupHref, getPlanUnlockHref } from './plan-intent'
import { getPricingPlan, type BillablePricingPlanId } from './pricing-plans'
import type { ProductTourVideoId } from './product-tour-videos'

export type ProductTourRoleId =
  | 'free'
  | 'player'
  | 'coach'
  | 'captain'
  | 'league'
  | 'full-court'
  | 'club'

export type ProductTourPlanFinderOption = {
  id: ProductTourRoleId
  label: string
  prompt: string
  headline: string
  planIds: readonly BillablePricingPlanId[]
  priceLabel: string
  priceNote: string
  outcome: string
  valueProps: readonly string[]
  videoId: ProductTourVideoId
  ctaLabel: string
  ctaHref: string
  comparisonHref: string
}

function buildSinglePlanOption(input: Omit<ProductTourPlanFinderOption, 'priceLabel' | 'priceNote' | 'outcome' | 'valueProps'>) {
  const plan = getPricingPlan(input.planIds[0])
  return {
    ...input,
    priceLabel: plan.priceLabel,
    priceNote: plan.billing.interval === 'season' ? 'One competition season' : plan.billing.interval === 'none' ? 'Start free' : 'Billed monthly',
    outcome: plan.outcome,
    valueProps: plan.valueProps.slice(0, 3),
  } satisfies ProductTourPlanFinderOption
}

const clubStarter = getPricingPlan('club_starter')
const clubUnlimited = getPricingPlan('club_unlimited')

export const PRODUCT_TOUR_PLAN_FINDER_OPTIONS: readonly ProductTourPlanFinderOption[] = [
  buildSinglePlanOption({
    id: 'free',
    label: 'Free',
    prompt: 'I want to explore players, teams, leagues, rankings, and tournaments.',
    headline: 'Start with the tennis map.',
    planIds: ['free'],
    videoId: 'free',
    ctaLabel: 'Get Started Free',
    ctaHref: getPlanSignupHref('free'),
    comparisonHref: '/pricing#free',
  }),
  buildSinglePlanOption({
    id: 'player',
    label: 'Player',
    prompt: 'I want clearer answers for my own game.',
    headline: 'Make your tennis personal.',
    planIds: ['player_plus'],
    videoId: 'player',
    ctaLabel: getPricingPlan('player_plus').ctaLabel,
    ctaHref: getPlanUnlockHref('player_plus'),
    comparisonHref: '/pricing#player_plus',
  }),
  buildSinglePlanOption({
    id: 'coach',
    label: 'Coach',
    prompt: 'I develop players between lessons.',
    headline: 'Keep development moving.',
    planIds: ['coach'],
    videoId: 'coach',
    ctaLabel: getPricingPlan('coach').ctaLabel,
    ctaHref: getPlanUnlockHref('coach'),
    comparisonHref: '/pricing#coach',
  }),
  buildSinglePlanOption({
    id: 'captain',
    label: 'Captain',
    prompt: 'I make weekly team and lineup decisions.',
    headline: 'Lead match week with clarity.',
    planIds: ['captain'],
    videoId: 'captain',
    ctaLabel: getPricingPlan('captain').ctaLabel,
    ctaHref: getPlanUnlockHref('captain'),
    comparisonHref: '/pricing#captain',
  }),
  buildSinglePlanOption({
    id: 'league',
    label: 'League',
    prompt: 'I run a league, ladder, or tournament.',
    headline: 'Run one cleaner competition.',
    planIds: ['league'],
    videoId: 'league',
    ctaLabel: getPricingPlan('league').ctaLabel,
    ctaHref: getPlanUnlockHref('league'),
    comparisonHref: '/pricing#league',
  }),
  buildSinglePlanOption({
    id: 'full-court',
    label: 'Full-Court',
    prompt: 'I wear more than one tennis hat.',
    headline: 'Keep every role connected.',
    planIds: ['full_court'],
    videoId: 'full-court',
    ctaLabel: getPricingPlan('full_court').ctaLabel,
    ctaHref: getPlanUnlockHref('full_court'),
    comparisonHref: '/pricing#full_court',
  }),
  {
    id: 'club',
    label: 'Club',
    prompt: 'I connect staff, programs, players, teams, and competition.',
    headline: 'Give the club one tennis experience.',
    planIds: ['club_starter', 'club_unlimited'],
    priceLabel: `From ${clubStarter.priceLabel}`,
    priceNote: `${clubUnlimited.name} ${clubUnlimited.priceLabel}`,
    outcome: clubStarter.outcome,
    valueProps: clubStarter.valueProps.slice(0, 3),
    videoId: 'club',
    ctaLabel: 'Compare Club plans',
    ctaHref: '/pricing#club-plans',
    comparisonHref: '/pricing#club-plans',
  },
] as const

export function getProductTourPlanFinderOption(videoId: ProductTourVideoId) {
  return PRODUCT_TOUR_PLAN_FINDER_OPTIONS.find((option) => option.videoId === videoId) ?? null
}
