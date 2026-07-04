import type { ProductAccessState } from './access-model'
import { getPlanUnlockHref } from './plan-intent'
import type { PricingPlanId } from './pricing-plans'
import { getMembershipTier, PRODUCT_MODE_LANGUAGE } from './product-story'

export const PRIMARY_NAV_VISUALS: Record<string, { step: string; intent: string; note: string }> = {
  [PRODUCT_MODE_LANGUAGE.find.route]: { step: '1', intent: PRODUCT_MODE_LANGUAGE.find.label, note: 'Players, teams, leagues' },
  [PRODUCT_MODE_LANGUAGE.you.route]: { step: '2', intent: PRODUCT_MODE_LANGUAGE.you.label, note: 'Your scorecard' },
  [PRODUCT_MODE_LANGUAGE.coach.route]: { step: '3', intent: PRODUCT_MODE_LANGUAGE.coach.label, note: 'Lessons and assignments' },
  [PRODUCT_MODE_LANGUAGE.prep.route]: { step: '4', intent: PRODUCT_MODE_LANGUAGE.prep.label, note: 'Compare the next match' },
  [PRODUCT_MODE_LANGUAGE.team.route]: { step: '5', intent: PRODUCT_MODE_LANGUAGE.team.label, note: 'Lineups and readiness' },
  [PRODUCT_MODE_LANGUAGE.league.route]: { step: '6', intent: PRODUCT_MODE_LANGUAGE.league.label, note: 'Run the season' },
  [PRODUCT_MODE_LANGUAGE.plans.route]: { step: '$', intent: PRODUCT_MODE_LANGUAGE.plans.label, note: 'Choose a tier' },
}

function normalizePrimaryNavHref(href: string) {
  return href.split('?')[0].split('#')[0] || '/'
}

export function getRequiredPlanForPrimaryNav(href: string): PricingPlanId | null {
  const pathname = normalizePrimaryNavHref(href)

  if (pathname === '/mylab' || pathname === '/matchup' || pathname === '/tactics') return 'player_plus'
  if (pathname === '/coach') return 'coach'
  if (pathname === '/captain') return 'captain'
  if (pathname === '/league-coordinator') return 'league'
  return null
}

export function canUsePrimaryNavItem(access: ProductAccessState, href: string) {
  const requiredPlan = getRequiredPlanForPrimaryNav(href)
  if (!requiredPlan) return true
  if (requiredPlan === 'player_plus') return access.canUseAdvancedPlayerInsights
  if (requiredPlan === 'coach') return access.canUseCoachWorkflow
  if (requiredPlan === 'captain') return access.canUseCaptainWorkflow
  if (requiredPlan === 'league') return access.canUseLeagueTools
  return true
}

export function getPrimaryNavLockedLabel(label: string, requiredPlan: PricingPlanId | null) {
  if (!requiredPlan) return `${label} requires an active plan.`
  const planName = requiredPlan === 'league' ? 'League Office access' : getMembershipTier(requiredPlan).name
  return `${label} requires ${planName}. Create a free account first, then activate ${planName}.`
}

export function getPrimaryNavLockedTitle(label: string, requiredPlan: PricingPlanId | null) {
  if (!requiredPlan) return `${label} requires an active plan`
  const planName = requiredPlan === 'league' ? 'League Office access' : getMembershipTier(requiredPlan).name
  return `${label} requires ${planName}`
}

export function getPrimaryNavTarget(href: string, access: ProductAccessState, authenticated: boolean) {
  void authenticated
  const requiredPlan = getRequiredPlanForPrimaryNav(href)
  const locked = Boolean(requiredPlan && !canUsePrimaryNavItem(access, href))

  if (!locked || !requiredPlan) {
    return { href, locked, requiredPlan }
  }

  return {
    href: getPlanUnlockHref(requiredPlan, href),
    locked,
    requiredPlan,
  }
}

