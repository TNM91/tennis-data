'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import {
  CAPTAIN_PILOT_PRICE_LABEL,
  CAPTAIN_PILOT_TRIAL_MONTHS,
  getCaptainPilotAvailability,
} from '@/lib/captain-pilot'
import styles from './captain-pilot.module.css'

type ClaimResponse = {
  ok?: boolean
  message?: string
  requestId?: string | null
  alreadyActive?: boolean
}

export default function CaptainPilotPage() {
  return (
    <SiteShell active="captain" showPortalToolBar={false}>
      <CaptainPilotContent />
    </SiteShell>
  )
}

function CaptainPilotContent() {
  const { session, authResolved } = useAuth()
  const [captainName, setCaptainName] = useState('')
  const [clubOrArea, setClubOrArea] = useState('')
  const [teamName, setTeamName] = useState('')
  const [feedbackFocus, setFeedbackFocus] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState('')
  const availability = useMemo(() => getCaptainPilotAvailability(), [])
  const isOpen = availability === 'active'
  const returnTo = '/captain-pilot'
  const joinHref = `/join?plan=captain&next=${encodeURIComponent(returnTo)}`
  const loginHref = `/login?plan=captain&next=${encodeURIComponent(returnTo)}`

  async function beginPilot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session?.access_token || submitting || !isOpen) return
    if (!acceptedTerms) {
      setNotice('Please confirm the pilot and renewal terms before continuing.')
      return
    }

    setSubmitting(true)
    setNotice('')
    try {
      const claimResponse = await fetch('/api/captain-pilot/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ captainName, clubOrArea, teamName, feedbackFocus }),
      })
      const claim = await claimResponse.json().catch(() => null) as ClaimResponse | null
      if (!claimResponse.ok || !claim?.ok) throw new Error(claim?.message || 'Your pilot claim could not be started.')
      if (claim.alreadyActive) {
        setNotice('Your Fall Captain Pilot is already active. Open Team Hub to keep building the week.')
        return
      }
      if (!claim.requestId) throw new Error('Your pilot claim did not include checkout access.')

      const checkoutResponse = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId: claim.requestId, nextHref: '/captain' }),
      })
      const checkout = await checkoutResponse.json().catch(() => null) as { ok?: boolean; message?: string; url?: string } | null
      if (!checkoutResponse.ok || !checkout?.ok || !checkout.url) {
        throw new Error(checkout?.message || 'Checkout could not be started.')
      }
      window.location.assign(checkout.url)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your pilot claim could not be started.')
      setSubmitting(false)
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
            Bring availability, lineup decisions, scouting, and a clear team plan into one Captain workflow — and help us build it around the way local teams really operate.
          </p>
          <div className={styles.offerCard}>
            <strong>{CAPTAIN_PILOT_TRIAL_MONTHS} months of Captain free</strong>
            <span>Then {CAPTAIN_PILOT_PRICE_LABEL} until canceled.</span>
          </div>
          <div className={styles.benefitGrid}>
            <p><strong>Know availability</strong><span>before lineup pressure arrives.</span></p>
            <p><strong>Build and compare lineups</strong><span>with your team’s real context.</span></p>
            <p><strong>Scout teams and pairings</strong><span>before match day.</span></p>
            <p><strong>Send one clear plan</strong><span>instead of another group-text scramble.</span></p>
          </div>
        </section>

        <section className={styles.claimCard} aria-labelledby="pilot-claim-title">
          <div className={styles.claimHeading}>
            <p>{session?.user ? 'Step 2 of 2 · Activate Captain' : 'Step 1 of 2 · Create or sign in'}</p>
            <h2 id="pilot-claim-title">
              {availability === 'expired'
                ? 'This pilot has closed.'
                : session?.user
                  ? 'Finish your free Captain pilot.'
                  : 'Start your free Captain pilot.'}
            </h2>
            <span>{session?.user
              ? 'Your account currently has Free access. Share a little about your team, then complete secure checkout to activate 3 months of Captain at $0. No charge today.'
              : 'Create your account first. Then share a little about your team and complete secure checkout to activate 3 months of Captain at $0.'}</span>
          </div>

          {!authResolved ? <p className={styles.status}>Checking your account…</p> : !session?.user ? (
            <div className={styles.accountActions}>
              <p>Start with your free TenAceIQ account. Captain tools activate after the short pilot form and secure checkout.</p>
              <div>
                <Link href={joinHref} className={styles.primaryAction}>Create account to start 3 months free</Link>
                <Link href={loginHref} className={styles.secondaryAction}>Sign in</Link>
              </div>
            </div>
          ) : (
            <form className={styles.form} onSubmit={beginPilot}>
              <p className={styles.activationNote}><strong>What happens next:</strong> submit this form, add payment details securely in Stripe, and Captain activates immediately. You will not be charged for the first 3 months.</p>
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
                What would make Captain more useful for your team?
                <textarea value={feedbackFocus} onChange={(event) => setFeedbackFocus(event.target.value)} required rows={4} placeholder="Availability, lineups, scouting, communication…" />
              </label>
              <label className={styles.checkRow}>
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required />
                <span>I’m a local captain or co-captain. I understand this is a 3-month free Captain trial, then {CAPTAIN_PILOT_PRICE_LABEL} until canceled. I can cancel before renewal.</span>
              </label>
              <button type="submit" className={styles.primaryAction} disabled={!isOpen || submitting}>
                {submitting ? 'Opening secure checkout…' : isOpen ? 'Continue to secure checkout · 3 months free' : 'Pilot closed'}
              </button>
            </form>
          )}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}

          <div className={styles.terms}>
            <strong>Pilot terms</strong>
            <span>Offer available through December 31, 2026, for eligible local tennis captains. One claim per captain or team. New Captain pilot participants only; not transferable, resalable, or combinable with other offers. Trial begins when checkout is completed. Continued Captain access renews at {CAPTAIN_PILOT_PRICE_LABEL} until canceled. TenAceIQ may revoke access for misuse or modify the offer where permitted.</span>
          </div>
          <p className={styles.feedback}>Questions or feedback? <a href="mailto:nathan@tenaceiq.com">Nathan@TenAceiQ.com</a></p>
        </section>

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
