'use client'

import Link from 'next/link'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import TiqTacticalStudio from './TiqTacticalStudio'
import styles from './TiqTacticalStudio.module.css'

export default function TiqTacticalStudioGate() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const authenticated = Boolean(userId) || role !== 'public'
  const accessPending = authenticated && (!authResolved || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = buildProductAccessState(resolvedRole, entitlements)
  const canOpenStudio = access.canUseCoachWorkflow || access.canUseCaptainWorkflow || access.currentPlanId === 'full_court'

  if (accessPending) {
    return (
      <div className={styles.studio}>
        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>TIQ Tactical Studio</div>
            <h1>Loading your tactical workspace.</h1>
            <p>Checking Coach, Captain, and Full-Court access.</p>
          </div>
        </section>
      </div>
    )
  }

  if (canOpenStudio) return <TiqTacticalStudio />

  return (
    <div className={styles.studio}>
      <section className={`${styles.hero} ${styles.gateHero}`}>
        <div className={styles.gateCopy}>
          <div className={styles.eyebrow}>Coach unlock preview</div>
          <h1>Build the drill board, then save the plan.</h1>
          <p>
            TIQ Tactical Studio is part of Coach, Captain, and Full-Court access. Use it to map drills,
            point patterns, assignments, and player-ready briefings.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/pricing#coach">See Coach</Link>
            <Link className={styles.button} href="/pricing#full_court">See Full-Court</Link>
          </div>
        </div>
        <div className={styles.gateStats}>
          <PreviewCard title="Court boards" text="Use the locked TIQ court, tokens, paths, zones, and labels." icon="scenarioBuilder" />
          <PreviewCard title="Coach briefs" text="Turn diagrams into captain, coach, or player instructions." icon="reports" />
          <PreviewCard title="Saved scenarios" text="Save locally or to your account when signed in." icon="accountSecurity" />
        </div>
      </section>

      <UpgradePrompt
        planId="coach"
        headline="Unlock TIQ Tactical Studio with Coach."
        body="Create reusable drill boards, save tactical scenarios, export briefings, and connect court work to player development."
        result="Coach is built for lesson planning, student tracking, drill assignments, scheduling, and tactical player development."
        ctaLabel="Unlock Coach"
        secondaryHref="/pricing#captain"
        secondaryLabel="Compare Captain"
      />
    </div>
  )
}

function PreviewCard({ icon, text, title }: { icon: 'scenarioBuilder' | 'reports' | 'accountSecurity'; text: string; title: string }) {
  return (
    <div className={styles.stat}>
      <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
      <div className={styles.statValue}>{title}</div>
      <p>{text}</p>
    </div>
  )
}
