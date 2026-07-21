'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import UpgradePrompt from '@/app/components/upgrade-prompt'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanUnlockHref } from '@/lib/plan-intent'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import type { PricingPlanId } from '@/lib/pricing-plans'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import TiqTacticalStudio from './TiqTacticalStudio'
import styles from './TiqTacticalStudio.module.css'

const TACTICS_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('smart-attacker-4-0-to-4-5')
const TACTICS_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TACTICS_PLAYER_IDENTITY)
const TACTICS_LEVEL_UP_HREF = `/level-up/${TACTICS_PLAYER_IDENTITY.slug}#level-up-flow`
const TACTICS_PLAYER_DEVELOPMENT_HREF = `/player-development/${TACTICS_PLAYER_IDENTITY.slug}`
const TACTICS_MY_LAB_HREF = '/mylab#level-up-proof'
const TACTICS_IMPROVE_HREF = '/tactics?source=improve&template=crosscourt&role=player'
type TacticsGateSource = 'improve' | 'coach' | 'captain'

export default function TiqTacticalStudioGate() {
  const searchParams = useSearchParams()
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
  const gateSource = getTacticsGateSource(searchParams.get('source'), searchParams.get('role'))
  const tacticsGateHref = buildTacticsGateHref(searchParams)
  const gatePlanId = getTacticsGatePlanId(gateSource)
  const gatePlanName = getTacticsGatePlanName(gateSource)
  const gateIdentityLabel = cleanGateIntentValue(searchParams.get('identityLabel')) ?? TACTICS_PLAYER_IDENTITY.title.replace(/^The /, '')
  const gateCardId = cleanGateIntentValue(searchParams.get('card'))
  const requestedGateCardTitle = cleanGateIntentValue(searchParams.get('cardTitle'))
  const gateCardTitle = requestedGateCardTitle ?? getDefaultGateBoardTitle(gateSource)
  const hasGateLevelUpCard = Boolean(gateCardId || requestedGateCardTitle)
  const gateIntentLabel = getGateIntentLabel(gateSource, hasGateLevelUpCard)
  const gateProofReturnCue = getGateProofReturnCue(gateSource, gateCardTitle, hasGateLevelUpCard)
  const tacticsGateStarterRead = getTacticsGateStarterRead(gateSource, gateCardTitle, gateProofReturnCue)
  const gateActionLinks = getTacticsGateActionLinks(gateSource, tacticsGateHref)
  const tacticsUnlockSteps = getTacticsUnlockSteps(gateSource)

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
    <div className={styles.studio} data-gate-source={gateSource}>
      <section className={`${styles.hero} ${styles.gateHero}`}>
        <div className={styles.gateCopy}>
          <div className={styles.eyebrow}>{gatePlanName} unlock preview</div>
          <div className={styles.gateStarterCue} aria-label={gateIntentLabel}>
            <span>{gateIntentLabel}</span>
            <strong>{gateCardTitle} opens after {gatePlanName} unlock.</strong>
            <small>{getGateStarterCue(gateSource, gateIdentityLabel)}</small>
          </div>
          <h1>{getGateHeadline(gateSource)}</h1>
          <p>
            TIQ Tactical Studio is part of Player, Coach, Captain, and Full-Court access. Use it to map drills,
            point patterns, assignments, and player-ready briefings.
          </p>
          <div className={styles.actions}>
            <Link className={styles.button} href={getPlanUnlockHref(gatePlanId, tacticsGateHref)}>See {gatePlanName}</Link>
            <Link className={styles.button} href={getPlanUnlockHref('full_court', tacticsGateHref)}>See Full-Court</Link>
          </div>
        </div>
        <div className={styles.gateStats}>
          <PreviewCard title="Court boards" text="Use the locked TIQ court, tokens, paths, zones, and labels." icon="scenarioBuilder" />
          <PreviewCard title="Coach briefs" text="Turn diagrams into captain, coach, or player instructions." icon="reports" />
          <PreviewCard title="Saved scenarios" text="Save locally or to your account when signed in." icon="accountSecurity" />
        </div>
      </section>

      <details className={styles.tacticsPlayerIdTrail} aria-label={getGateStarterPathLabel(gateSource)}>
        <summary className={styles.tacticsPlayerIdSummary}>
          <span>
            <span className={styles.tacticsPlayerIdEyebrow}>{getGateTrailEyebrow(gateSource)}</span>
            <strong>{getGateTrailHeadline(gateSource)}</strong>
          </span>
          <small>Show path</small>
        </summary>
        <div className={styles.tacticsPlayerIdHeader}>
          <div>
            <div className={styles.tacticsPlayerIdEyebrow}>{getGateTrailEyebrow(gateSource)}</div>
            <h2>{getGateTrailHeadline(gateSource)}</h2>
          </div>
          <p>{getGateTrailCopy(gateSource, gateIdentityLabel)}</p>
        </div>
        <div className={styles.tacticsPlayerIdGrid} aria-label={getGateStarterReadLabel(gateSource)}>
          {tacticsGateStarterRead.map((item) => (
            <div className={styles.tacticsPlayerIdCard} key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
        <div className={styles.tacticsPlayerIdActions}>
          {gateActionLinks.map((action, index) => (
            <Link className={`${styles.button} ${index === 0 ? styles.primary : ''}`} href={action.href} key={action.label}>
              {action.label}
            </Link>
          ))}
        </div>
      </details>

      <UpgradePrompt
        planId={gatePlanId}
        headline={`Unlock TIQ Tactical Studio with ${gatePlanName}.`}
        body={getGatePromptBody(gateSource)}
        result={getGatePromptResult(gateSource)}
        ctaLabel={`Unlock ${gatePlanName}`}
        ctaHref={getPlanUnlockHref(gatePlanId, tacticsGateHref)}
        secondaryHref={getPlanUnlockHref('full_court', tacticsGateHref)}
        secondaryLabel="Unlock Full-Court"
        compact
        summaryOnly
        unlockSteps={tacticsUnlockSteps}
      />
    </div>
  )
}

function buildTacticsGateHref(params: { get(name: string): string | null }) {
  const source = getTacticsGateSource(params.get('source'), params.get('role'))
  const nextParams = new URLSearchParams({
    source,
    template: getTacticsGateTemplate(source, params.get('template')),
    role: getTacticsGateRole(source),
  })
  let hasCustomIntent = false

  const intentKeys = ['identity', 'identityLabel', 'card', 'cardTitle'] as const
  intentKeys.forEach((key) => {
    const value = cleanGateIntentValue(params.get(key))
    if (value) {
      hasCustomIntent = true
      nextParams.set(key, value)
    }
  })

  if (!hasCustomIntent && source === 'improve') return TACTICS_IMPROVE_HREF
  return `/tactics?${nextParams.toString()}`
}

function cleanGateIntentValue(value: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.slice(0, 80)
}

function getTacticsGateSource(source: string | null, role: string | null): TacticsGateSource {
  if (source === 'coach' || role === 'coach') return 'coach'
  if (source === 'captain' || role === 'captain') return 'captain'
  return 'improve'
}

function getTacticsGateRole(source: TacticsGateSource) {
  if (source === 'coach') return 'coach'
  if (source === 'captain') return 'captain'
  return 'player'
}

function getTacticsGateTemplate(source: TacticsGateSource, requestedTemplate: string | null) {
  if (source === 'coach') return 'coachProgression'
  if (source === 'captain') return 'basicDoubles'
  return requestedTemplate === 'crosscourt' ? requestedTemplate : 'crosscourt'
}

function getTacticsGatePlanId(source: TacticsGateSource): PricingPlanId {
  if (source === 'coach') return 'coach'
  if (source === 'captain') return 'captain'
  return 'player_plus'
}

function getTacticsGatePlanName(source: TacticsGateSource) {
  if (source === 'coach') return 'Coach'
  if (source === 'captain') return 'Captain'
  return 'Player'
}

function getDefaultGateBoardTitle(source: TacticsGateSource) {
  if (source === 'coach') return 'Coach lesson board'
  if (source === 'captain') return 'Captain match-week board'
  return 'Crosscourt pattern board'
}

function getGateIntentLabel(source: TacticsGateSource, hasLevelUpCard: boolean) {
  if (hasLevelUpCard) return 'My Lab proof board requested'
  if (source === 'coach') return 'Coach lesson board requested'
  if (source === 'captain') return 'Captain match-week board requested'
  return 'Improve starter board requested'
}

function getGateProofReturnCue(source: TacticsGateSource, boardTitle: string, hasLevelUpCard: boolean) {
  if (hasLevelUpCard) return `Return ${boardTitle} proof to My Lab after the board is saved.`
  if (source === 'coach') return 'Copy the coach brief back to Coach Hub after the lesson board is saved.'
  if (source === 'captain') return 'Save the match-week board, then send the plan with the lineup or practice note.'
  return 'Save the board back to My Lab before the next court block.'
}

function getGateStarterCue(source: TacticsGateSource, identityLabel: string) {
  if (source === 'coach') return 'Coach Hub keeps the lesson-board intent attached so Tactical Studio opens to the feed, recover, attack progression.'
  if (source === 'captain') return 'Team Hub keeps the match-week board intent attached so Tactical Studio opens to the doubles pattern.'
  return `${identityLabel}: read the Player ID cue, adjust the court, then save the proof back to My Lab.`
}

function getGateHeadline(source: TacticsGateSource) {
  if (source === 'coach') return 'Build the lesson board, then assign the next step.'
  if (source === 'captain') return 'Map the match-week board, then send the team plan.'
  return 'Build the drill board, then return the proof.'
}

function getGateTrailEyebrow(source: TacticsGateSource) {
  if (source === 'coach') return 'Coach Hub to tactics'
  if (source === 'captain') return 'Team Hub to tactics'
  return 'Player ID to tactics'
}

function getGateTrailHeadline(source: TacticsGateSource) {
  if (source === 'coach') return 'Start with the lesson constraint, then build the board.'
  if (source === 'captain') return 'Start with the doubles assignment, then build the team board.'
  return 'Start with the player read, then build the board.'
}

function getGateTrailCopy(source: TacticsGateSource, identityLabel: string) {
  if (source === 'coach') return 'Coach entries keep the feed, recovery, attack lane, and assignment loop attached through unlock.'
  if (source === 'captain') return 'Captain entries keep the serve pattern, assignments, and team communication loop attached through unlock.'
  return `${identityLabel} starts from: ${TACTICS_PLAYER_IDENTITY_READ.levelUpNudge} Tactical Studio turns that read into the court shape, assignment, and My Lab proof the next session needs.`
}

function getGateStarterPathLabel(source: TacticsGateSource) {
  if (source === 'coach') return 'Tactics Coach lesson starter path'
  if (source === 'captain') return 'Tactics Captain match-week starter path'
  return 'Tactics Player ID starter path'
}

function getGateStarterReadLabel(source: TacticsGateSource) {
  if (source === 'coach') return 'Tactics Coach lesson starter read'
  if (source === 'captain') return 'Tactics Captain match-week starter read'
  return 'Tactics Player ID starter read'
}

function getTacticsGateStarterRead(source: TacticsGateSource, boardTitle: string, handoffCue: string) {
  if (source === 'coach') {
    return [
      { label: 'Lesson board', value: boardTitle },
      { label: 'Coach focus', value: 'Movement + Finish' },
      { label: 'Rep score', value: 'Recover before attacking, then finish balanced.' },
      { label: 'Handoff', value: handoffCue },
      { label: 'Next tool', value: 'Coach Hub assignment' },
    ] as const
  }

  if (source === 'captain') {
    return [
      { label: 'Match board', value: boardTitle },
      { label: 'Team focus', value: 'Setup' },
      { label: 'Assignment cue', value: 'Name the serve, first move, recovery lane, and target.' },
      { label: 'Handoff', value: handoffCue },
      { label: 'Next tool', value: 'Team message or lineup note' },
    ] as const
  }

  return [
    { label: 'Court pattern', value: TACTICS_PLAYER_IDENTITY_READ.trainingPriority },
    { label: 'Proof target', value: TACTICS_PLAYER_IDENTITY_READ.proofTarget },
    { label: 'Board starter', value: boardTitle },
    { label: 'My Lab handoff', value: handoffCue },
    { label: 'Match week test', value: TACTICS_PLAYER_IDENTITY_READ.matchTrigger },
  ] as const
}

function getTacticsGateActionLinks(source: TacticsGateSource, tacticsGateHref: string) {
  if (source === 'coach') {
    return [
      { label: 'Open Coach Hub', href: '/coach' },
      { label: 'Build lesson board', href: getPlanUnlockHref('coach', tacticsGateHref) },
      { label: 'Development paths', href: '/player-development' },
      { label: 'Unlock Full-Court', href: getPlanUnlockHref('full_court', tacticsGateHref) },
    ] as const
  }

  if (source === 'captain') {
    return [
      { label: 'Open Team Hub', href: '/captain' },
      { label: 'Build match board', href: getPlanUnlockHref('captain', tacticsGateHref) },
      { label: 'Lineup builder', href: '/captain/lineup-builder' },
      { label: 'Send plan', href: '/captain/messaging' },
    ] as const
  }

  return [
    { label: 'Start Level Up', href: TACTICS_LEVEL_UP_HREF },
    { label: 'Build starter board', href: getPlanUnlockHref('player_plus', tacticsGateHref) },
    { label: 'Read Player ID', href: TACTICS_PLAYER_DEVELOPMENT_HREF },
    { label: 'Open My Lab', href: TACTICS_MY_LAB_HREF },
  ] as const
}

function getTacticsUnlockSteps(source: TacticsGateSource) {
  if (source === 'coach') {
    return [
      { title: 'Open the lesson board', body: 'Coach unlock keeps the progression board attached after checkout.' },
      { title: 'Adjust the drill', body: 'Drag the feed, recovery lane, attack target, and teaching cues before the session.' },
      { title: 'Assign the next step', body: 'Copy the coach brief, then send the player assignment from Coach Hub.' },
    ] as const
  }

  if (source === 'captain') {
    return [
      { title: 'Open the match board', body: 'Captain unlock keeps the doubles board attached after checkout.' },
      { title: 'Confirm assignments', body: 'Name the pattern, partner roles, recovery lane, and target before practice or match day.' },
      { title: 'Send the team plan', body: 'Save or copy the team brief, then send it with Team Hub messaging.' },
    ] as const
  }

  return [
    { title: 'Open the starter board', body: 'Player unlock keeps the crosscourt board attached after checkout.' },
    { title: 'Adjust the court', body: 'Drag players, target windows, and paths until the rep matches your next session.' },
    { title: 'Send proof back', body: 'Save or copy the player brief, then return the work to My Lab.' },
  ] as const
}

function getGatePromptBody(source: TacticsGateSource) {
  if (source === 'coach') return 'Create reusable lesson boards, save tactical scenarios, export coach briefs, and connect court work to player assignments.'
  if (source === 'captain') return 'Create reusable team boards, save tactical scenarios, export match-week briefs, and connect court work to lineup communication.'
  return 'Create reusable drill boards, save tactical scenarios, export briefings, and connect court work to your Level Up plan.'
}

function getGatePromptResult(source: TacticsGateSource) {
  if (source === 'coach') return 'Coach includes Player features plus Coach Hub, lesson planning, assignments, scheduling, and Tactical Studio boards.'
  if (source === 'captain') return 'Captain includes Player features plus Team Hub, lineups, scouting, readiness, messaging, and Tactical Studio boards.'
  return 'Player includes My Lab, Level Up, Tactics Tools, matchup prep, follows, and tennis messages.'
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
