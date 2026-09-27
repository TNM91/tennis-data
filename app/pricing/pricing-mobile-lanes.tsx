'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import ProductTourVideoButton from '@/app/components/product-tour-video'
import { getPlanDestinationHref, getPlanSignupHref, getPlanUnlockHref } from '@/lib/plan-intent'
import { PAID_CHECKOUT_ENABLED } from '@/lib/paid-checkout'
import {
  getPricingBillingCue,
  getPricingPlan,
  type BillablePricingPlanId,
  type CorePricingPlanId,
} from '@/lib/pricing-plans'
import { PRICING_PLAN_VIDEO_IDS, type ProductTourVideoId } from '@/lib/product-tour-videos'
import styles from './pricing-mobile-lanes.module.css'

type LaneId = 'play' | 'lead' | 'organize'

type LaneChoice = {
  planId: BillablePricingPlanId
  label: string
  icon: TiqFeatureIconName
}

type PricingLane = {
  id: LaneId
  label: string
  cue: string
  icon: TiqFeatureIconName
  choices: LaneChoice[]
}

const LANES: PricingLane[] = [
  {
    id: 'play',
    label: 'Play',
    cue: 'Explore or build your game.',
    icon: 'exploreTennis',
    choices: [
      { planId: 'free', label: 'Explore', icon: 'exploreTennis' },
      { planId: 'player_plus', label: 'Player', icon: 'improveTennis' },
    ],
  },
  {
    id: 'lead',
    label: 'Lead',
    cue: 'Guide players or a team.',
    icon: 'captainTennis',
    choices: [
      { planId: 'captain', label: 'Captain', icon: 'captainTennis' },
      { planId: 'coach', label: 'Coach', icon: 'coachTennis' },
    ],
  },
  {
    id: 'organize',
    label: 'Organize',
    cue: 'Run competition or a club.',
    icon: 'leagueTennis',
    choices: [
      { planId: 'league', label: 'League', icon: 'leagueTennis' },
      { planId: 'club_starter', label: 'Club', icon: 'clubTennis' },
    ],
  },
]

const DEFAULT_PLAN_BY_LANE: Record<LaneId, BillablePricingPlanId> = {
  play: 'free',
  lead: 'captain',
  organize: 'league',
}

const CLUB_PLANS: BillablePricingPlanId[] = ['club_starter', 'club_unlimited']

function isCorePlan(planId: BillablePricingPlanId): planId is CorePricingPlanId {
  return !planId.startsWith('club_')
}

function getVideoId(planId: BillablePricingPlanId): ProductTourVideoId {
  return isCorePlan(planId) ? PRICING_PLAN_VIDEO_IDS[planId] : 'club'
}

function getPlanHref(planId: BillablePricingPlanId, active: boolean) {
  if (active && isCorePlan(planId)) return getPlanDestinationHref(planId)
  return planId === 'free' ? getPlanSignupHref(planId) : getPlanUnlockHref(planId)
}

function getPlanCta(planId: BillablePricingPlanId, active: boolean) {
  if (active) return 'Open your tools'
  if (planId === 'free') return 'Start free'
  if (!PAID_CHECKOUT_ENABLED) return 'Join early access'
  return getPricingPlan(planId).ctaLabel
}

export default function PricingMobileLanes({
  accessPending,
  activePlanIds,
  recommendedPlanId,
}: {
  accessPending: boolean
  activePlanIds: CorePricingPlanId[]
  recommendedPlanId: CorePricingPlanId
}) {
  const [activeLaneId, setActiveLaneId] = useState<LaneId>('lead')
  const [selectedPlanId, setSelectedPlanId] = useState<BillablePricingPlanId>('captain')
  const activeLane = LANES.find((lane) => lane.id === activeLaneId) ?? LANES[1]
  const selectedPlan = getPricingPlan(selectedPlanId)
  const selectedChoice = activeLane.choices.find((choice) => (
    choice.planId === selectedPlanId || (choice.planId === 'club_starter' && selectedPlanId === 'club_unlimited')
  )) ?? activeLane.choices[0]
  const active = isCorePlan(selectedPlanId) && activePlanIds.includes(selectedPlanId)
  const recommended = isCorePlan(selectedPlanId) && !active && recommendedPlanId === selectedPlanId
  const fullCourt = getPricingPlan('full_court')

  function selectLane(lane: PricingLane) {
    setActiveLaneId(lane.id)
    setSelectedPlanId(DEFAULT_PLAN_BY_LANE[lane.id])
  }

  return (
    <div className={styles.shell} data-pricing-mobile-lanes="true">
      <nav className={styles.laneTabs} aria-label="Choose a pricing lane" role="tablist">
        {LANES.map((lane) => {
          const selected = lane.id === activeLaneId
          return (
            <button
              key={lane.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`${styles.laneTab} ${selected ? styles.laneTabActive : ''}`}
              onClick={() => selectLane(lane)}
            >
              <TiqFeatureIcon name={lane.icon} size="sm" variant={selected ? 'surface' : 'ghost'} />
              <strong>{lane.label}</strong>
              <small>{lane.cue}</small>
            </button>
          )
        })}
      </nav>

      <section className={styles.lanePanel} aria-label={`${activeLane.label} plans`}>
        <div className={styles.roleTabs} role="tablist" aria-label={`${activeLane.label} roles`}>
          {activeLane.choices.map((choice) => {
            const selected = choice.planId === selectedChoice.planId
            return (
              <button
                key={choice.planId}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`${styles.roleTab} ${selected ? styles.roleTabActive : ''}`}
                onClick={() => setSelectedPlanId(choice.planId)}
              >
                <TiqFeatureIcon name={choice.icon} size="sm" variant="ghost" />
                <span>{choice.label}</span>
                <small>{getPricingPlan(choice.planId).priceLabel}</small>
              </button>
            )
          })}
        </div>

        {selectedChoice.planId === 'club_starter' ? (
          <div className={styles.clubToggle} role="tablist" aria-label="Choose a Club plan">
            {CLUB_PLANS.map((planId) => {
              const plan = getPricingPlan(planId)
              return (
                <button
                  key={planId}
                  type="button"
                  role="tab"
                  aria-selected={selectedPlanId === planId}
                  className={selectedPlanId === planId ? styles.clubToggleActive : undefined}
                  onClick={() => setSelectedPlanId(planId)}
                >
                  <span>{planId === 'club_starter' ? 'Starter' : 'Unlimited'}</span>
                  <small>{plan.priceLabel}</small>
                </button>
              )
            })}
          </div>
        ) : null}

        <article id={`mobile-${selectedPlanId}`} className={styles.planCard}>
          <div className={styles.planMeta}>
            <span>{selectedPlan.name}</span>
            <strong>{accessPending ? selectedPlan.priceLabel : active ? 'Unlocked' : selectedPlan.priceLabel}</strong>
          </div>
          <div className={styles.titleRow}>
            <h3>{selectedPlan.subtitle}</h3>
            {recommended ? <span className={styles.badge}>Recommended</span> : null}
            {active ? <span className={styles.badge}>Active</span> : null}
          </div>
          <p>{selectedPlan.audience}</p>
          <ul className={styles.benefits}>
            {selectedPlan.valueProps.slice(0, 2).map((benefit) => <li key={benefit}>{benefit}</li>)}
          </ul>

          <details className={styles.details}>
            <summary>Everything included</summary>
            <div className={styles.detailsBody}>
              <p>{selectedPlan.outcome}</p>
              <ul>
                {selectedPlan.valueProps.slice(2).map((benefit) => <li key={benefit}>{benefit}</li>)}
              </ul>
              <span>{getPricingBillingCue(selectedPlanId)}</span>
              <ProductTourVideoButton
                videoId={getVideoId(selectedPlanId)}
                variant="compact"
                label={`Watch ${selectedPlan.name} overview`}
                source={`pricing-mobile-${selectedPlanId}`}
              />
            </div>
          </details>

          <Link
            href={accessPending ? '#compare' : getPlanHref(selectedPlanId, active)}
            className={styles.primaryAction}
          >
            {accessPending ? 'Compare access' : getPlanCta(selectedPlanId, active)}
            <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
          </Link>
        </article>
      </section>

      <aside className={styles.fullCourt}>
        <div>
          <span>Need every role?</span>
          <strong>Full-Court · {fullCourt.priceLabel}</strong>
        </div>
        <Link href={getPlanUnlockHref('full_court')}>See Full-Court <ArrowRightIcon aria-hidden="true" size={17} weight="bold" /></Link>
      </aside>

      <a href="#compare" className={styles.stickyCompare}>
        Compare all plans
        <ArrowRightIcon aria-hidden="true" size={18} weight="bold" />
      </a>
    </div>
  )
}
