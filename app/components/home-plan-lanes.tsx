'use client'

import { useState } from 'react'
import { ArrowRightIcon } from '@phosphor-icons/react/dist/csr/ArrowRight'
import { CaretDownIcon } from '@phosphor-icons/react/dist/csr/CaretDown'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import TrackedProductLink from '@/app/components/tracked-product-link'
import { getPricingPlan, type BillablePricingPlanId } from '@/lib/pricing-plans'
import styles from './home-plan-lanes.module.css'

type LaneId = 'play' | 'lead' | 'organize'

type LaneChoice = {
  planId: BillablePricingPlanId
  label: string
  icon: TiqFeatureIconName
  href: string
}

type PlanLane = {
  id: LaneId
  label: string
  summary: string
  icon: TiqFeatureIconName
  choices: LaneChoice[]
}

const LANES: PlanLane[] = [
  {
    id: 'play',
    label: 'Play',
    summary: 'Find your game and make it personal.',
    icon: 'exploreTennis',
    choices: [
      { planId: 'free', label: 'Explore', icon: 'exploreTennis', href: '/explore' },
      { planId: 'player_plus', label: 'Player', icon: 'improveTennis', href: '/pricing#player_plus' },
    ],
  },
  {
    id: 'lead',
    label: 'Lead',
    summary: 'Guide players and teams with clarity.',
    icon: 'captainTennis',
    choices: [
      { planId: 'captain', label: 'Captain', icon: 'captainTennis', href: '/pricing#captain' },
      { planId: 'coach', label: 'Coach', icon: 'coachTennis', href: '/pricing#coach' },
    ],
  },
  {
    id: 'organize',
    label: 'Organize',
    summary: 'Run competition and clubs with less admin.',
    icon: 'leagueTennis',
    choices: [
      { planId: 'league', label: 'League', icon: 'leagueTennis', href: '/pricing#league' },
      { planId: 'club_starter', label: 'Club', icon: 'clubTennis', href: '/pricing#club_starter' },
    ],
  },
]

const DEFAULT_PLAN_BY_LANE: Record<LaneId, BillablePricingPlanId> = {
  play: 'free',
  lead: 'captain',
  organize: 'league',
}

function shortPrice(planId: BillablePricingPlanId) {
  const label = getPricingPlan(planId).priceLabel
  return label === '$0' ? 'Free' : label.replace('/month', '/mo')
}

export default function HomePlanLanes() {
  const [activeLaneId, setActiveLaneId] = useState<LaneId>('lead')
  const [selectedPlanId, setSelectedPlanId] = useState<BillablePricingPlanId>('captain')
  const selectedPlan = getPricingPlan(selectedPlanId)
  const activeLane = LANES.find((lane) => lane.id === activeLaneId) ?? LANES[1]
  const selectedChoice = activeLane.choices.find((choice) => choice.planId === selectedPlanId) ?? activeLane.choices[0]
  const fullCourt = getPricingPlan('full_court')

  const openLane = (lane: PlanLane) => {
    setActiveLaneId(lane.id)
    setSelectedPlanId(DEFAULT_PLAN_BY_LANE[lane.id])
  }

  return (
    <section className={styles.section} aria-labelledby="home-plan-lanes-title">
      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <span className={styles.eyebrow}>Choose your lane</span>
          <h2 id="home-plan-lanes-title">Pick your court.</h2>
          <p>Same game. Different roles. Open the tools built for how you play tennis.</p>
        </div>
        <div className={styles.athlete} aria-hidden="true" />
      </div>

      <div className={styles.lanes}>
        {LANES.map((lane) => {
          const expanded = lane.id === activeLaneId

          return (
            <article key={lane.id} className={`${styles.lane} ${expanded ? styles.expanded : ''}`}>
              <button
                type="button"
                className={styles.laneHeader}
                aria-expanded={expanded}
                aria-controls={`home-plan-lane-${lane.id}`}
                onClick={() => openLane(lane)}
              >
                <TiqFeatureIcon name={lane.icon} size="md" variant={expanded ? 'surface' : 'ghost'} />
                <span className={styles.laneHeading}>
                  <strong>{lane.label}</strong>
                  <small>{lane.summary}</small>
                </span>
                <CaretDownIcon className={styles.caret} aria-hidden="true" size={24} weight="bold" />
              </button>

              <div id={`home-plan-lane-${lane.id}`} className={styles.laneBody} hidden={!expanded}>
                <div className={styles.roleTabs} role="tablist" aria-label={`${lane.label} plans`}>
                  {lane.choices.map((choice) => {
                    const selected = selectedPlanId === choice.planId
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
                        <small>{shortPrice(choice.planId)}</small>
                      </button>
                    )
                  })}
                </div>

                <div className={styles.planDetail} role="tabpanel">
                  <div className={styles.planCopy}>
                    <div className={styles.planMeta}>
                      <span>{selectedChoice.label}</span>
                      <strong>{selectedPlan.priceLabel}</strong>
                    </div>
                    <h3>{selectedPlan.subtitle}</h3>
                    <p>{selectedPlan.audience}</p>
                    <ul>
                      {selectedPlan.valueProps.slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                  <div className={styles.courtGraphic} aria-hidden="true" />
                  <TrackedProductLink href={selectedChoice.href} className={styles.primaryAction}>
                    {selectedPlanId === 'free' ? 'Explore Free' : selectedPlan.ctaLabel}
                    <ArrowRightIcon aria-hidden="true" size={20} weight="bold" />
                  </TrackedProductLink>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className={styles.allRoles}>
        <div>
          <span>Need every role?</span>
          <strong>Full-Court · {fullCourt.priceLabel}</strong>
        </div>
        <TrackedProductLink href="/pricing#full_court" className={styles.allRolesLink}>
          See Full-Court
          <ArrowRightIcon aria-hidden="true" size={18} weight="bold" />
        </TrackedProductLink>
      </div>

      <TrackedProductLink href="/pricing" className={styles.compareLink}>
        Compare every plan
        <ArrowRightIcon aria-hidden="true" size={18} weight="bold" />
      </TrackedProductLink>
    </section>
  )
}
