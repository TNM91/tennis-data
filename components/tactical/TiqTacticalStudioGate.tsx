'use client'

import Link from 'next/link'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanUnlockHref } from '@/lib/plan-intent'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import TiqTacticalStudio from './TiqTacticalStudio'
import styles from './TiqTacticalStudio.module.css'

const TACTICS_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('smart-attacker-4-0-to-4-5')
const TACTICS_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TACTICS_PLAYER_IDENTITY)
const TACTICS_LEVEL_UP_HREF = `/level-up/${TACTICS_PLAYER_IDENTITY.slug}#level-up-flow`
const TACTICS_PLAYER_DEVELOPMENT_HREF = `/player-development/${TACTICS_PLAYER_IDENTITY.slug}`
const TACTICS_IMPROVE_HREF = '/tactics?source=improve&template=crosscourt&role=player'
const tacticsPlayerIdStarterRead = [
  { label: 'Court pattern', value: TACTICS_PLAYER_IDENTITY_READ.trainingPriority },
  { label: 'Proof target', value: TACTICS_PLAYER_IDENTITY_READ.proofTarget },
  { label: 'Match week test', value: TACTICS_PLAYER_IDENTITY_READ.matchTrigger },
] as const

export default function TiqTacticalStudioGate() {
  const { role, userId, entitlements, authResolved } = useAuth()
  const authenticated = Boolean(userId) || role !== 'public'
  const accessPending = authenticated && (!authResolved || entitlements === null)
  const resolvedRole = authResolved || !userId ? role : 'member'
  const access = buildProductAccessState(resolvedRole, entitlements)
  const canOpenStudio =
    access.canUseAdvancedPlayerInsights ||
    access.canUseCoachWorkflow ||
    access.canUseCaptainWorkflow ||
    access.currentPlanId === 'full_court'

  if (accessPending) {
    return (
      <div className={styles.studio}>
        <section className={styles.hero}>
          <div>
            <div className={styles.eyebrow}>TIQ Tactical Studio</div>
            <h1>Loading your tactical board.</h1>
            <p>Checking Player, Coach, Captain, and Full-Court access.</p>
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
          <div className={styles.eyebrow}>Player unlock preview</div>
          <h1>Build the drill board, then save the plan.</h1>
          <p>
            TIQ Tactical Studio is part of Player, Coach, Captain, and Full-Court access. Use it to map drills,
            point patterns, assignments, and player-ready briefings.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href="/pricing#player_plus">See Player</Link>
            <Link className={styles.button} href="/pricing#full_court">See Full-Court</Link>
          </div>
        </div>
        <div className={styles.gateStats}>
          <PreviewCard title="Court boards" text="Use the locked TIQ court, tokens, paths, zones, and labels." icon="scenarioBuilder" />
          <PreviewCard title="Coach briefs" text="Turn diagrams into captain, coach, or player instructions." icon="reports" />
          <PreviewCard title="Saved scenarios" text="Save locally or to your account when signed in." icon="accountSecurity" />
        </div>
      </section>

      <section className={styles.tacticsPlayerIdTrail} aria-label="Tactics Player ID starter path">
        <div className={styles.tacticsPlayerIdHeader}>
          <div>
            <div className={styles.tacticsPlayerIdEyebrow}>Player ID to tactics</div>
            <h2>Start with the player read, then build the board.</h2>
          </div>
          <p>
            {TACTICS_PLAYER_IDENTITY_READ.levelUpNudge} Tactical Studio turns that read into the court shape,
            assignment, and proof the next session needs.
          </p>
        </div>
        <div className={styles.tacticsPlayerIdGrid} aria-label="Tactics Player ID starter read">
          {tacticsPlayerIdStarterRead.map((item) => (
            <div className={styles.tacticsPlayerIdCard} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className={styles.tacticsPlayerIdActions}>
          <Link className={`${styles.button} ${styles.primary}`} href={TACTICS_LEVEL_UP_HREF}>
            Start Level Up
          </Link>
          <Link className={styles.button} href={TACTICS_PLAYER_DEVELOPMENT_HREF}>
            Read Player ID
          </Link>
          <Link className={styles.button} href="/mylab">
            Open My Lab
          </Link>
        </div>
      </section>

      <UpgradePrompt
        planId="player_plus"
        headline="Unlock TIQ Tactical Studio with Player."
        body="Create reusable drill boards, save tactical scenarios, export briefings, and connect court work to your Level Up plan."
        result="Player includes My Lab, Level Up, Tactics Tools, matchup prep, follows, and tennis messages."
        ctaLabel="Unlock Player"
        ctaHref={getPlanUnlockHref('player_plus', TACTICS_IMPROVE_HREF)}
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
