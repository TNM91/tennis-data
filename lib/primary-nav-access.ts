import type { ProductAccessState } from './access-model'
import { getPlanSignupHref, getPlanUnlockHref } from './plan-intent'
import type { PricingPlanId } from './pricing-plans'

export const PRIMARY_NAV_VISUALS: Record<string, { step: string; intent: string; note: string }> = {
  '/explore': { step: '1', intent: 'Find', note: 'Players, teams, leagues' },
  '/mylab': { step: '2', intent: 'You', note: 'Your scorecard' },
  '/matchup': { step: '3', intent: 'Compare', note: 'Who to play next' },
  '/captain': { step: '4', intent: 'Run', note: 'Team decisions' },
  '/league-coordinator': { step: '5', intent: 'League Ops', note: 'Run the season' },
  '/pricing': { step: '$', intent: 'Plans', note: 'Choose a tier' },
}

export function getRequiredPlanForPrimaryNav(href: string): PricingPlanId | null {
  if (href === '/mylab' || href === '/matchup') return 'player_plus'
  if (href === '/captain') return 'captain'
  if (href === '/league-coordinator') return 'league'
  return null
}

export function canUsePrimaryNavItem(access: ProductAccessState, href: string) {
  const requiredPlan = getRequiredPlanForPrimaryNav(href)
  if (!requiredPlan) return true
  if (requiredPlan === 'player_plus') return access.canUseAdvancedPlayerInsights
  if (requiredPlan === 'captain') return access.canUseCaptainWorkflow
  if (requiredPlan === 'league') return access.canUseLeagueTools
  return true
}

export function getPrimaryNavTarget(href: string, access: ProductAccessState, authenticated: boolean) {
  const requiredPlan = getRequiredPlanForPrimaryNav(href)
  const locked = Boolean(requiredPlan && !canUsePrimaryNavItem(access, href))

  if (!locked || !requiredPlan) {
    return { href, locked }
  }

  return {
    href: authenticated ? getPlanUnlockHref(requiredPlan, href) : getPlanSignupHref(requiredPlan, href),
    locked,
  }
}

