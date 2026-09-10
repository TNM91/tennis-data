'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import ProductTourVideoButton from '@/app/components/product-tour-video'
import { useAuth } from '@/app/components/auth-provider'
import { buildProductAccessState } from '@/lib/access-model'
import { CAPTAIN_PILOT_FIRST_WIN_HREF } from '@/lib/captain-quick-start'
import {
  CAPTAIN_PILOT_PRICE_LABEL,
  CAPTAIN_PILOT_TRIAL_MONTHS,
  getCaptainPilotAvailability,
} from '@/lib/captain-pilot'
import { buildCaptainPilotHref, normalizeCaptainPilotSource } from '@/lib/captain-pilot-source'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import type { TeamConnection } from '@/lib/team-profile-links'
import styles from './captain-pilot.module.css'
import PilotShare from './pilot-share'

type ClaimResponse = {
  ok?: boolean
  message?: string
  requestId?: string | null
  alreadyActive?: boolean
  cardFree?: boolean
  trialEndsAt?: string | null
  billingRequired?: boolean
}

type PilotStatus = {
  active: boolean
  requestId: string | null
  trialEndsAt: string | null
  billingRequired: boolean
}

type CaptainPilotPageProps = {
  renewalDateLabel: string
}

export default function CaptainPilotPage({ renewalDateLabel }: CaptainPilotPageProps) {
  return (
    <SiteShell active="captain" showPortalToolBar={false}>
      <CaptainPilotContent renewalDateLabel={renewalDateLabel} />
    </SiteShell>
  )
}

function CaptainPilotContent({ renewalDateLabel }: CaptainPilotPageProps) {
  const searchParams = useSearchParams()
  const { session, authResolved, role, entitlements, refreshAuth } = useAuth()
  const hasCaptainAccess = authResolved && Boolean(session?.user) && buildProductAccessState(role, entitlements).canUseCaptainWorkflow
  const [captainName, setCaptainName] = useState('')
  const [clubOrArea, setClubOrArea] = useState('')
  const [teamName, setTeamName] = useState('')
  const [feedbackFocus, setFeedbackFocus] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const [pilotAlreadyActive, setPilotAlreadyActive] = useState(false)
  const [pilotStatus, setPilotStatus] = useState<PilotStatus | null>(null)
  const [billingSubmitting, setBillingSubmitting] = useState(false)
  const [teamConnections, setTeamConnections] = useState<TeamConnection[]>([])
  const [teamPreviewResolved, setTeamPreviewResolved] = useState(false)
  const trackedPilotViewRef = useRef('')
  const trackedPreviewRef = useRef('')
  const signedInUserId = session?.user.id ?? ''
  const accessToken = session?.access_token ?? ''
  const preferredCaptainName = getPreferredName(session?.user.user_metadata, session?.user.email)
  const availability = useMemo(() => getCaptainPilotAvailability(), [])
  const isOpen = availability === 'active'
  const captainPilotActivated = hasCaptainAccess || pilotAlreadyActive || pilotStatus?.active === true
  const acquisitionSource = normalizeCaptainPilotSource(
    searchParams.get('src') ?? searchParams.get('utm_source') ?? searchParams.get('source'),
  )
  const returnTo = buildCaptainPilotHref(acquisitionSource)
  const joinHref = `/join?plan=captain&next=${encodeURIComponent(returnTo)}`
  const loginHref = `/login?plan=captain&next=${encodeURIComponent(returnTo)}`
  const connectedTeam = useMemo(
    () => teamConnections.find((connection) => connection.isDefault && !connection.archivedAt)
      ?? teamConnections.find((connection) => !connection.archivedAt)
      ?? null,
    [teamConnections],
  )
  const connectTeamHref = `/compete/teams?source=captain-pilot&returnTo=${encodeURIComponent(returnTo)}#captain-setup`

  useEffect(() => {
    if (!authResolved || !signedInUserId) return

    if (trackedPilotViewRef.current !== signedInUserId) {
      trackedPilotViewRef.current = signedInUserId
      void trackProductUsageEvent({
        eventName: 'captain_pilot_viewed',
        surface: 'upgrade',
        planId: 'captain',
        metadata: { signedIn: true, acquisitionSource },
      })
    }

    setCaptainName((current) => current || preferredCaptainName)

    if (!accessToken) {
      setTeamPreviewResolved(true)
      return
    }

    const controller = new AbortController()
    setTeamPreviewResolved(false)
    void fetch('/api/team-connections', {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(async (response) => {
        const body = await response.json().catch(() => null) as { ok?: boolean; connections?: TeamConnection[] } | null
        if (!response.ok || !body?.ok || !Array.isArray(body.connections)) return
        setTeamConnections(body.connections.filter((connection) => connection.status === 'accepted'))
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
      })
      .finally(() => setTeamPreviewResolved(true))

    return () => controller.abort()
  }, [accessToken, acquisitionSource, authResolved, preferredCaptainName, signedInUserId])

  useEffect(() => {
    if (!authResolved || !accessToken) return
    const controller = new AbortController()
    void fetch('/api/captain-pilot/status', {
      signal: controller.signal,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(async (response) => {
      const body = await response.json().catch(() => null) as { ok?: boolean; pilot?: PilotStatus | null } | null
      if (response.ok && body?.ok) setPilotStatus(body.pilot ?? null)
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return
    })
    return () => controller.abort()
  }, [accessToken, authResolved])

  useEffect(() => {
    if (!connectedTeam || teamName) return
    setTeamName(connectedTeam.teamName)
  }, [connectedTeam, teamName])

  useEffect(() => {
    if (!signedInUserId || !teamPreviewResolved) return
    const trackingKey = `${signedInUserId}:${connectedTeam ? 'connected' : 'generic'}`
    if (trackedPreviewRef.current === trackingKey) return
    trackedPreviewRef.current = trackingKey
    void trackProductUsageEvent({
      eventName: 'captain_pilot_team_preview_viewed',
      surface: 'upgrade',
      planId: 'captain',
      metadata: { hasConnectedTeam: Boolean(connectedTeam), acquisitionSource },
    })
  }, [acquisitionSource, connectedTeam, signedInUserId, teamPreviewResolved])

  function trackPilotCta(action: string) {
    void trackProductUsageEvent({
      eventName: 'captain_pilot_cta_clicked',
      surface: 'upgrade',
      planId: 'captain',
      metadata: { action, hasConnectedTeam: Boolean(connectedTeam), acquisitionSource },
    })
  }

  async function beginPilot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.access_token || submitting || !isOpen || hasCaptainAccess) return
    if (!acceptedTerms) {
      setNotice('Please confirm the pilot terms before continuing.')
      return
    }

    trackPilotCta('activate_card_free')
    setSubmitting(true)
    setNotice('')
    try {
      const claimResponse = await fetch('/api/captain-pilot/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ captainName, clubOrArea, teamName, feedbackFocus, acquisitionSource }),
      })
      const claim = await claimResponse.json().catch(() => null) as ClaimResponse | null
      if (!claimResponse.ok || !claim?.ok) {
        void trackProductUsageEvent({
          eventName: 'captain_pilot_activation_failed',
          surface: 'upgrade',
          planId: 'captain',
          metadata: { source: 'captain_pilot', acquisitionSource, stage: 'pilot_claim', status: claimResponse.status },
        })
        throw new Error(claim?.message || 'Your pilot claim could not be started.')
      }
      setPilotAlreadyActive(true)
      if (claim.requestId || claim.trialEndsAt) {
        setPilotStatus({
          active: true,
          requestId: claim.requestId ?? null,
          trialEndsAt: claim.trialEndsAt ?? null,
          billingRequired: claim.billingRequired === true,
        })
      }
      await refreshAuth()
      setNotice(claim.alreadyActive
        ? 'Your Captain access is already active. Continue with your guided team setup.'
        : `Captain is active—no card required. Your three free months run through ${formatPilotDate(claim.trialEndsAt)}.`)
    } catch (error) {
      if (error instanceof TypeError) {
        void trackProductUsageEvent({
          eventName: 'captain_pilot_activation_failed',
          surface: 'upgrade',
          planId: 'captain',
          metadata: { source: 'captain_pilot', acquisitionSource, stage: 'network' },
        })
      }
      setNotice(error instanceof Error ? error.message : 'Your pilot claim could not be started.')
    } finally {
      setSubmitting(false)
    }
  }

  async function beginPilotBilling() {
    if (!session?.access_token || !pilotStatus?.requestId || billingSubmitting) return
    setBillingSubmitting(true)
    setNotice('')
    void trackProductUsageEvent({
      eventName: 'captain_pilot_billing_clicked',
      surface: 'upgrade',
      planId: 'captain',
      metadata: { acquisitionSource, source: 'captain_pilot_active_offer' },
    })
    try {
      const response = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId: pilotStatus.requestId, nextHref: CAPTAIN_PILOT_FIRST_WIN_HREF }),
      })
      const body = await response.json().catch(() => null) as { ok?: boolean; message?: string; url?: string } | null
      if (!response.ok || !body?.ok || !body.url) throw new Error(body?.message || 'Billing could not be opened.')
      window.location.assign(body.url)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Billing could not be opened.')
      setBillingSubmitting(false)
    }
  }

  return (
      <div className={styles.page}>
        <section className={styles.hero} aria-labelledby="captain-pilot-title">
          <Image
            src="/brand/web/header-logo-transparent.png"
            alt="TenAceIQ"
            width={544}
            height={144}
            priority
            className={styles.logo}
          />
          <p className={styles.eyebrow}>Local Tennis Captains · Fall Captain Pilot</p>
          <h1 id="captain-pilot-title">Start your fall season on us.</h1>
          <p className={styles.heroCopy}>
            Know who can play, build your lineup, and send one clear match-day plan. We’ll walk you through your first team setup.
          </p>
          <div className={styles.offerCard}>
            <strong>{CAPTAIN_PILOT_TRIAL_MONTHS} months of Captain free</strong>
            <span>$0 today · no card required · add billing only if you want to continue after {renewalDateLabel}.</span>
          </div>
          <div className={styles.heroActions}>
            {!authResolved ? <p className={styles.status}>Checking your account…</p> : captainPilotActivated ? (
              <Link href={hasCaptainAccess ? CAPTAIN_PILOT_FIRST_WIN_HREF : '#pilot-claim'} className={styles.primaryAction}>
                {hasCaptainAccess ? 'Continue my first match week' : 'Review Captain access'}
              </Link>
            ) : isOpen ? (
              <>
                <Link
                  href={session?.user ? '#pilot-preview' : joinHref}
                  className={styles.primaryAction}
                  onClick={() => trackPilotCta(session?.user ? 'view_match_week_preview' : 'create_account')}
                >
                  {session?.user ? 'Preview my first match week' : 'Start 3 months free'}
                </Link>
                {!session?.user ? <Link href={loginHref} className={styles.secondaryAction}>Already have an account? Sign in</Link> : null}
              </>
            ) : <p className={styles.status}>Pilot enrollment has closed.</p>}
          </div>
          <div className={styles.benefitGrid}>
            <p><strong>Know availability</strong><span>before lineup pressure arrives.</span></p>
            <p><strong>Build and compare lineups</strong><span>with your team’s real context.</span></p>
            <p><strong>Scout teams and pairings</strong><span>before match day.</span></p>
            <p><strong>Send one clear plan</strong><span>instead of another group-text scramble.</span></p>
          </div>
        </section>

        <section className={styles.tourCard} aria-labelledby="captain-tour-title">
          <div className={styles.tourCopy}>
            <p>See Captain in action</p>
            <h2 id="captain-tour-title">From player replies to one clear lineup.</h2>
            <span>Watch the real match-week flow before you activate anything.</span>
            <div className={styles.tourSteps} aria-label="Captain match-week workflow">
              <span>Ask availability</span>
              <span>Build the courts</span>
              <span>Share the plan</span>
            </div>
          </div>
          <ProductTourVideoButton
            videoId="captain"
            variant="poster"
            label="Watch the 18-second Captain match-week tour"
            surface="upgrade"
            source="captain-pilot"
            className={styles.tourMedia}
            ctaHref={captainPilotActivated ? hasCaptainAccess ? CAPTAIN_PILOT_FIRST_WIN_HREF : '#pilot-claim' : session?.user ? '#pilot-claim' : joinHref}
            ctaLabel={captainPilotActivated ? hasCaptainAccess ? 'Open my teams' : 'Review Captain access' : session?.user ? 'Activate free · no card' : 'Start 3 months free'}
          />
        </section>

        {session?.user ? (
          <section id="pilot-preview" className={styles.previewCard} aria-labelledby="pilot-preview-title">
            <div className={styles.previewHeading}>
              <p>Your first win with Captain</p>
              <h2 id="pilot-preview-title">
                {teamPreviewResolved
                  ? connectedTeam
                    ? `A calmer match week for ${connectedTeam.teamName}.`
                    : 'A calmer match week starts with your team.'
                  : 'Finding your team…'}
              </h2>
              {connectedTeam ? (
                <span>{[connectedTeam.leagueName, connectedTeam.flight].filter(Boolean).join(' · ') || 'Your connected TenAceIQ team'}</span>
              ) : teamPreviewResolved ? (
                <span>Connect a TennisLink or TiQ team now, or type the team name during activation.</span>
              ) : null}
            </div>
            <div className={styles.previewGrid}>
              <article><b>1</b><strong>Ask availability</strong><span>Send one link. Players can answer without joining first.</span></article>
              <article><b>2</b><strong>Build the lineup</strong><span>Use replies, locks, and team context in one place.</span></article>
              <article><b>3</b><strong>Share the plan</strong><span>Post to Team Chat or copy a polished group text.</span></article>
              <article><b>4</b><strong>Close out the match</strong><span>Print or enter the scorecard and keep the history.</span></article>
            </div>
            <div className={styles.previewActions}>
              <Link href="#pilot-claim" className={styles.primaryAction} onClick={() => trackPilotCta(captainPilotActivated ? 'manage_active_pilot' : 'activate_from_preview')}>
                {captainPilotActivated ? 'Review my Captain access' : 'Activate free · no card'}
              </Link>
              {!connectedTeam && teamPreviewResolved ? (
                <Link href={connectTeamHref} className={styles.secondaryAction} onClick={() => trackPilotCta('connect_team_first')}>
                  Connect my team first
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        <section id="pilot-claim" className={styles.claimCard} aria-labelledby="pilot-claim-title">
          <div className={styles.claimHeading}>
            <p>{captainPilotActivated ? 'Your Captain access' : session?.user ? 'Step 2 of 2 · Activate Captain' : 'Step 1 of 2 · Create or sign in'}</p>
            <h2 id="pilot-claim-title">
              {captainPilotActivated
                ? pilotStatus?.active && pilotStatus.billingRequired
                  ? 'Manage your Captain Pilot.'
                  : 'Your Captain tools are ready.'
                : availability === 'expired'
                ? 'This pilot has closed.'
                : session?.user
                  ? 'Finish your free Captain pilot.'
                  : 'Start your free Captain pilot.'}
            </h2>
            <span>{captainPilotActivated
              ? pilotStatus?.active && pilotStatus.billingRequired
                ? 'Review your free-access date, choose whether to add billing, or open your teams.'
                : 'Captain is already included in your access. Open your teams to prepare the next match, or share this offer with another local captain.'
              : session?.user
              ? `Confirm your team and activate immediately. No card is required. Add billing later only if you want to continue after ${renewalDateLabel}.`
              : 'Create your account first. Then share a little about your team and activate three months of Captain—no card required.'}</span>
          </div>

          {!authResolved ? <p className={styles.status}>Checking your account…</p> : captainPilotActivated ? (
            <div className={styles.accountActions}>
              {pilotStatus?.active && pilotStatus.billingRequired ? (
                <div className={styles.activePilotBilling}>
                  <p><strong>Free through {formatPilotDate(pilotStatus.trialEndsAt)}.</strong> No card is on file. Your access pauses after that date unless you choose to continue.</p>
                  {pilotStatus.requestId ? (
                    <button type="button" className={styles.secondaryAction} onClick={() => void beginPilotBilling()} disabled={billingSubmitting}>
                      {billingSubmitting ? 'Opening Stripe…' : `Add billing for after the trial · ${CAPTAIN_PILOT_PRICE_LABEL}`}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div>
                <Link href={CAPTAIN_PILOT_FIRST_WIN_HREF} className={styles.primaryAction}>Continue my first match week</Link>
                <Link href="/compete/teams" className={styles.secondaryAction}>Open all teams</Link>
                <Link href="/captain-pilot/flyer" className={styles.secondaryAction}>Share the pilot flyer</Link>
              </div>
            </div>
          ) : !session?.user ? (
            <div className={styles.accountActions}>
              <p>Start with your free TenAceIQ account. Captain tools activate after the short pilot form—no payment step.</p>
              <div>
                <Link href={joinHref} className={styles.primaryAction}>Create account to start 3 months free</Link>
                <Link href={loginHref} className={styles.secondaryAction}>Sign in</Link>
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={beginPilot}>
              <div className={styles.trustGrid} aria-label="Captain Pilot billing summary">
                <p><strong>No card</strong><span>Activate Captain immediately.</span></p>
                <p><strong>3 months free</strong><span>Your pilot runs through {renewalDateLabel}.</span></p>
                <p><strong>Your choice</strong><span>Add billing later to continue for {CAPTAIN_PILOT_PRICE_LABEL}.</span></p>
              </div>
              <details className={styles.whyCard}>
                <summary>What happens after three months?</summary>
                <p>We’ll remind you before the pilot ends. Add billing through Stripe if you want to continue; otherwise Captain access pauses automatically and you are not charged.</p>
              </details>
              <label>
                Your name
                <input value={captainName} onChange={(event) => setCaptainName(event.target.value)} required autoComplete="name" />
              </label>
              <label>
                Team name
                <input value={teamName} onChange={(event) => setTeamName(event.target.value)} required placeholder="Example: River Club 3.5 Women" />
              </label>
              <label>
                Club or local area <em>Optional</em>
                <input value={clubOrArea} onChange={(event) => setClubOrArea(event.target.value)} placeholder="Example: River Club or Naperville" />
              </label>
              <label>
                What would make Captain more useful? <em>Optional</em>
                <textarea value={feedbackFocus} onChange={(event) => setFeedbackFocus(event.target.value)} rows={3} placeholder="Availability, lineups, scouting, communication…" />
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required />
                <span>I’m a local captain or co-captain. I understand this is three months of free Captain access with no card required. Access pauses unless I later choose to add billing.</span>
              </label>
              <button type="submit" className={styles.primaryAction} disabled={!isOpen || submitting}>
                {submitting ? 'Activating Captain…' : isOpen ? 'Activate my 3 months free' : 'Pilot closed'}
              </button>
            </form>
          )}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

          <div className={styles.terms}>
            <strong>Pilot terms</strong>
            <span>Offer available through December 31, 2026, for eligible local tennis captains. One claim per captain or team. New Captain pilot participants only; not transferable, resalable, or combinable with other offers. Free access begins when activated and pauses after three months unless billing is added. Continuing Captain costs {CAPTAIN_PILOT_PRICE_LABEL}. TenAceIQ may revoke access for misuse or modify the offer where permitted.</span>
          </div>
          <p className={styles.feedback}>Questions or feedback? <a href="mailto:nathan@tenaceiq.com">Nathan@TenAceiQ.com</a></p>
        </section>

        <PilotShare />
        <section className={styles.shareCard} aria-label="Share the Captain Pilot flyer">
          <Image src="/brand/flyers/fall-2026-captain-pilot-qr.svg" alt="QR code to claim the Fall Captain Pilot" width={176} height={176} />
          <div>
            <p>Sharing with a local captain?</p>
            <strong>Scan to apply</strong>
            <span>tenaceiq.com/captain-pilot</span>
          </div>
          <Link href="/captain-pilot/flyer" className={styles.printLink}>Open print flyer</Link>
        </section>
        <p className={styles.dateNote}>Pilot enrollment is open now and closes December 31, 2026.</p>
      </div>
  )
}

function getPreferredName(metadata: Record<string, unknown> | undefined, email: string | undefined) {
  const candidate = metadata?.full_name ?? metadata?.name ?? metadata?.display_name
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim().slice(0, 120)
  const localPart = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim() ?? ''
  return localPart.replace(/\b\w/g, (letter) => letter.toUpperCase()).slice(0, 120)
}

function formatPilotDate(value: string | null | undefined) {
  const parsed = value ? Date.parse(value) : Number.NaN
  if (!Number.isFinite(parsed)) return 'the end of your pilot'
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(parsed))
}
