'use client'

import { LockKeyIcon } from '@phosphor-icons/react/dist/csr/LockKey'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { getPricingPlan, type BillablePricingPlanId } from '@/lib/pricing-plans'
import styles from './auth-plan-continuity.module.css'

const PLAN_ICON_BY_ID: Record<BillablePricingPlanId, TiqFeatureIconName> = {
  free: 'exploreTennis',
  player_plus: 'myLab',
  coach: 'coachTennis',
  captain: 'captainTennis',
  league: 'leagueTennis',
  full_court: 'competeTennis',
  club_starter: 'clubTennis',
  club_unlimited: 'clubOperations',
}

const PLAN_DESTINATION_BY_ID: Record<BillablePricingPlanId, string> = {
  free: 'Explore',
  player_plus: 'My Lab',
  coach: 'Coach Hub',
  captain: 'Team Hub',
  league: 'League Office',
  full_court: 'Full-Court',
  club_starter: 'Club workspace',
  club_unlimited: 'Club workspace',
}

export default function AuthPlanContinuity({
  planId,
  step,
}: {
  planId: Exclude<BillablePricingPlanId, 'free'>
  step: 'sign-in' | 'account' | 'confirmation'
}) {
  const plan = getPricingPlan(planId)
  const stepLabel = step === 'sign-in'
    ? 'After sign in'
    : step === 'confirmation'
      ? 'After confirmation'
      : 'After account setup'

  return (
    <aside className={styles.card} aria-label={`${plan.name} selection saved`} data-auth-plan-continuity="true">
      <TiqFeatureIcon name={PLAN_ICON_BY_ID[planId]} size="sm" variant="surface" />
      <div className={styles.identity}>
        <span>Plan saved</span>
        <strong>{plan.name}</strong>
        <small>{stepLabel} · {PLAN_DESTINATION_BY_ID[planId]}</small>
      </div>
      <div className={styles.price}>
        <strong>{plan.priceLabel}</strong>
        <span><LockKeyIcon aria-hidden="true" size={12} weight="fill" /> Stays selected</span>
      </div>
    </aside>
  )
}
