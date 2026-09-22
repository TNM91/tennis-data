'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useState } from 'react'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import type { ProductTourPlanFinderOption, ProductTourRoleId } from '@/lib/product-tour-plan-finder'
import ProductTourVideoButton from './product-tour-video'
import styles from './product-tour-plan-finder.module.css'

const ROLE_ICONS: Record<ProductTourRoleId, TiqFeatureIconName> = {
  free: 'exploreTennis',
  player: 'myLab',
  coach: 'coachTennis',
  captain: 'captainTennis',
  league: 'leagueTennis',
  'full-court': 'competeTennis',
  club: 'clubTennis',
}

export default function ProductTourPlanFinder({
  options,
}: {
  options: readonly ProductTourPlanFinderOption[]
}) {
  const [selectedRole, setSelectedRole] = useState<ProductTourRoleId>('free')
  const selected = options.find((option) => option.id === selectedRole) ?? options[0]

  function selectRole(roleId: ProductTourRoleId) {
    setSelectedRole(roleId)
    track('Product Tour Plan Finder', { action: 'role_selected', roleId })
    void trackProductUsageEvent({
      eventName: 'product_tour_role_selected',
      surface: 'public_site',
      metadata: { roleId, source: 'platform-tour-plan-finder' },
    })
  }

  return (
    <section className={styles.finder} aria-labelledby="tour-plan-finder-title">
      <div className={styles.heading}>
        <span>Find your starting point</span>
        <h2 id="tour-plan-finder-title">What would you like TenAceIQ to make easier?</h2>
        <p>Choose the tennis job that sounds most like yours. We’ll show the closest fit, its current price, and the quickest way to see it in action.</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.roleList} aria-label="Choose your tennis role">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={option.id === selected.id ? styles.roleButtonActive : styles.roleButton}
              aria-pressed={option.id === selected.id}
              onClick={() => selectRole(option.id)}
            >
              <TiqFeatureIcon name={ROLE_ICONS[option.id]} size="sm" variant="ghost" />
              <span>
                <strong>{option.label}</strong>
                <small>{option.prompt}</small>
              </span>
            </button>
          ))}
        </div>

        <article className={styles.recommendation} aria-live="polite" data-testid="tour-plan-recommendation">
          <div className={styles.recommendationTop}>
            <TiqFeatureIcon name={ROLE_ICONS[selected.id]} size="lg" variant="surface" />
            <div>
              <span>Your closest fit</span>
              <h3>{selected.label}</h3>
            </div>
            <div className={styles.price}>
              <strong>{selected.priceLabel}</strong>
              <small>{selected.priceNote}</small>
            </div>
          </div>

          <div className={styles.recommendationCopy}>
            <strong>{selected.headline}</strong>
            <p>{selected.outcome}</p>
            <ul>
              {selected.valueProps.map((valueProp) => <li key={valueProp}>{valueProp}</li>)}
            </ul>
          </div>

          <div className={styles.actions}>
            <Link
              className={styles.primaryAction}
              href={selected.ctaHref}
              onClick={() => track('Product Tour Plan Finder', {
                action: 'cta_clicked',
                roleId: selected.id,
                destination: selected.ctaHref,
              })}
            >
              {selected.ctaLabel}
            </Link>
            <ProductTourVideoButton
              key={selected.videoId}
              videoId={selected.videoId}
              variant="secondary"
              label={`Watch ${selected.label} overview`}
              source="platform-tour-plan-finder"
            />
          </div>
        </article>
      </div>
    </section>
  )
}
