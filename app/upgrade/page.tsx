'use client'

import Link from 'next/link'
import { use, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { getClientAuthState } from '@/lib/auth'
import { getPlanDestinationHref, isSafeLocalNextHref } from '@/lib/plan-intent'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'
import { getMembershipTier } from '@/lib/product-story'
import { type UserRole } from '@/lib/roles'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import {
  UPGRADE_REQUESTS_KEY,
  type UpgradeRequestRecord,
} from '@/lib/upgrade-requests'

const PLAN_IDS: PricingPlanId[] = ['free', 'player_plus', 'captain', 'league']
const LAST_REMOTE_UPGRADE_REQUEST_KEY = 'tenaceiq-last-remote-upgrade-request-v1'

const PLAN_ICON_BY_ID: Record<PricingPlanId, TiqFeatureIconName> = {
  free: 'playerRatings',
  player_plus: 'myLab',
  captain: 'lineupBuilder',
  league: 'teamRankings',
}

const UNLOCK_COPY: Record<PricingPlanId, {
  eyebrow: string
  title: string
  body: string
  action: string
  checkoutAction: string
  setupAction: string
}> = {
  free: {
    eyebrow: 'Free path',
    title: 'Start with the tennis map.',
    body: 'Search players, teams, leagues, rankings, flights, and areas before you need paid tools.',
    action: 'Explore TenAceIQ',
    checkoutAction: 'Explore TenAceIQ',
    setupAction: 'Open Free',
  },
  player_plus: {
    eyebrow: 'Player unlock',
    title: 'Make TenAceIQ personal.',
    body: 'Continue with Player when you want My Lab, follows, matchup reads, and player-linked prep around your game.',
    action: 'Continue with Player',
    checkoutAction: 'Unlock Player',
    setupAction: 'Preview Player setup',
  },
  captain: {
    eyebrow: 'Captain unlock',
    title: 'Run the team week.',
    body: 'Continue with Captain when lineup decisions, scouting, readiness, and team communication need one cleaner flow.',
    action: 'Continue with Captain',
    checkoutAction: 'Unlock Captain Tools',
    setupAction: 'Preview Captain tools',
  },
  league: {
    eyebrow: 'Coordinator unlock',
    title: 'Operate the season.',
    body: 'Continue with TIQ League Coordinator when league structure, visibility, standings, schedules, and results need one place.',
    action: 'Continue with Coordinator',
    checkoutAction: 'Run Your League on TIQ',
    setupAction: 'Preview league setup',
  },
}

type UpgradePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default function UpgradePage({ searchParams }: UpgradePageProps) {
  const resolvedSearchParams = use(searchParams)
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const requestedPlan = getSearchParamValue(resolvedSearchParams.plan)
  const planId: PricingPlanId = PLAN_IDS.includes(requestedPlan as PricingPlanId)
    ? (requestedPlan as PricingPlanId)
    : 'captain'
  const plan = getPricingPlan(planId)
  const tier = getMembershipTier(planId)
  const copy = UNLOCK_COPY[planId]
  const nextHref = isSafeLocalNextHref(getSearchParamValue(resolvedSearchParams.next), getPlanDestinationHref(planId))

  const [role, setRole] = useState<UserRole>('public')
  const [entitlements, setEntitlements] = useState<ProductEntitlementSnapshot | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [requestName, setRequestName] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestOrganization, setRequestOrganization] = useState('')
  const [requestGoal, setRequestGoal] = useState('')
  const [requestError, setRequestError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState<UpgradeRequestRecord | null>(null)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [requestStorageMode, setRequestStorageMode] = useState<'supabase' | 'local' | null>(null)
  const [requestLinkStatus, setRequestLinkStatus] = useState('')

  useEffect(() => {
    let active = true

    void (async () => {
      const authState = await getClientAuthState()
      if (!active) return
      setRole(authState.role)
      setEntitlements(authState.entitlements)
      setRequestEmail(authState.user?.email ?? '')
      setAuthLoading(false)
      if (authState.user?.id) {
        void claimLastRemoteRequest(authState.user.email ?? '')
      }
    })()

    return () => {
      active = false
    }
  }, [])

  async function claimLastRemoteRequest(userEmail: string) {
    const stored = readLastRemoteRequest()
    if (!stored?.id || !stored.email || stored.email.toLowerCase() !== userEmail.toLowerCase()) return

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session?.access_token) return

    try {
      const response = await fetch('/api/upgrade-requests', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId: stored.id }),
      })
      const body = await response.json().catch(() => null) as
        | { ok?: boolean; message?: string; request?: UpgradeRequestRecord }
        | null

      if (!response.ok || !body?.ok || !body.request) return

      setSubmittedRequest(body.request)
      setRequestStorageMode('supabase')
      setRequestLinkStatus('Your upgrade request is linked to this account.')
      window.localStorage.removeItem(LAST_REMOTE_UPGRADE_REQUEST_KEY)
    } catch {
      // Keep the page quiet. Admin can still follow up by email.
    }
  }

  const access = useMemo(() => buildProductAccessState(role, entitlements), [entitlements, role])
  const hasAccess =
    planId === 'free' ||
    (planId === 'player_plus' && access.canUseAdvancedPlayerInsights) ||
    (planId === 'captain' && access.canUseCaptainWorkflow) ||
    (planId === 'league' && access.canUseLeagueTools)
  const isPublic = role === 'public'
  const isPaidPlan = planId === 'player_plus' || planId === 'captain' || planId === 'league'
  const showAccessRequest = isPaidPlan && !hasAccess && (isPublic || !authLoading)
  const mailtoHref = buildAccessRequestMailto(submittedRequest ?? {
    id: '',
    planId,
    planName: plan.name,
    name: requestName,
    email: requestEmail,
    organization: requestOrganization,
    goal: requestGoal,
    nextHref,
    createdAt: '',
  })

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (requestSubmitting) return

    const name = requestName.trim()
    const email = requestEmail.trim()
    const organization = requestOrganization.trim()
    const goal = requestGoal.trim()

    if (!email || !email.includes('@')) {
      setRequestError('Enter an email so we can follow up.')
      return
    }

    if (!goal) {
      setRequestError('Tell us what you want TenAceIQ to help with first.')
      return
    }

    setRequestSubmitting(true)
    setRequestError('')

    const record: UpgradeRequestRecord = {
      id: `${planId}-${Math.round(event.timeStamp)}`,
      planId,
      planName: plan.name,
      name,
      email,
      organization,
      goal,
      nextHref,
      createdAt: String(event.timeStamp),
      status: 'pending',
      source: 'local',
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`
      }

      const response = await fetch('/api/upgrade-requests', {
        method: 'POST',
        headers,
        body: JSON.stringify(record),
      })
      const body = await response.json().catch(() => null) as
        | { ok?: boolean; message?: string; request?: UpgradeRequestRecord }
        | null

      if (!response.ok || !body?.ok || !body.request) {
        throw new Error(body?.message ?? 'Upgrade request could not be saved.')
      }

      setSubmittedRequest(body.request)
      setRequestStorageMode('supabase')
      if (!body.request.userId) {
        window.localStorage.setItem(
          LAST_REMOTE_UPGRADE_REQUEST_KEY,
          JSON.stringify({ id: body.request.id, email: body.request.email }),
        )
      }
    } catch {
      try {
        const existingRaw = window.localStorage.getItem(UPGRADE_REQUESTS_KEY)
        const existing = existingRaw ? JSON.parse(existingRaw) : []
        const nextRecords = Array.isArray(existing) ? [record, ...existing].slice(0, 50) : [record]
        window.localStorage.setItem(UPGRADE_REQUESTS_KEY, JSON.stringify(nextRecords))
        setSubmittedRequest(record)
        setRequestStorageMode('local')
      } catch {
        setRequestError('This browser could not save the request. Use the email link below and we will handle it.')
      }
    } finally {
      setRequestSubmitting(false)
    }
  }

  return (
    <SiteShell active="">
      <main style={pageStyle}>
        <section
          style={{
            ...heroStyle,
            gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.04fr) minmax(320px, 0.96fr)',
            padding: isSmallMobile ? 18 : 26,
          }}
        >
          <div style={heroCopyStyle}>
            <div style={eyebrowStyle}>{copy.eyebrow}</div>
            <h1 style={titleStyle}>{hasAccess ? `${plan.name} is already active.` : copy.title}</h1>
            <p style={textStyle}>
              {hasAccess
                ? `Your account already has the access needed for ${plan.name}. Open the workspace when you are ready.`
                : copy.body}
            </p>

            <div style={actionRowStyle}>
              {showAccessRequest ? (
                <Link href={`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}#activation`} style={primaryButtonStyle}>
                  {isPublic ? `Request ${plan.name}` : copy.checkoutAction}
                </Link>
              ) : (
                <Link href={nextHref} style={primaryButtonStyle}>
                  {hasAccess ? `Open ${plan.name}` : copy.action}
                </Link>
              )}
              <Link
                href={isPublic ? `/login?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}` : '/pricing'}
                style={secondaryButtonStyle}
              >
                {isPublic ? 'Sign in' : 'Compare plans'}
              </Link>
            </div>
          </div>

          <aside style={planCardStyle}>
            <TiqFeatureIcon name={PLAN_ICON_BY_ID[planId]} size="lg" variant="surface" />
            <div style={planNameStyle}>{plan.name}</div>
            <div style={priceStyle}>{plan.priceLabel}</div>
            {plan.alternatePriceNote ? <div style={mutedStyle}>{plan.alternatePriceNote}</div> : null}
            <div style={resultCardStyle}>
              <span style={labelStyle}>Result</span>
              <strong>{plan.outcome}</strong>
            </div>
            <div style={metaGridStyle}>
              <div style={metaCardStyle}>
                <span style={labelStyle}>Best for</span>
                <strong>{tier.audience}</strong>
              </div>
              <div style={metaCardStyle}>
                <span style={labelStyle}>Upgrade trigger</span>
                <strong>{tier.upgradeCue}</strong>
              </div>
            </div>
            <div style={valueListStyle}>
              {plan.valueProps.map((valueProp) => (
                <span key={valueProp} style={valuePillStyle}>{valueProp}</span>
              ))}
            </div>
          </aside>
        </section>

        {showAccessRequest ? (
          <section id="activation" style={activationStyle}>
            <div style={activationCopyStyle}>
              <div style={labelStyle}>{isPublic ? 'Quick request' : 'Activation step'}</div>
              <h2 style={activationTitleStyle}>Ready to turn on {plan.name}?</h2>
              <p style={noteTextStyle}>
                {isPublic
                  ? 'Send the plan request first. You can create an account after we know the tennis job you need solved.'
                  : 'Send the plan request now. We will use it to activate the right workspace or route you to checkout when billing is connected.'}
              </p>
              <Link
                href={isPublic ? `/login?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}` : nextHref}
                style={secondaryInlineLinkStyle}
              >
                {isPublic ? 'Sign in instead' : copy.setupAction}
              </Link>
            </div>
            {submittedRequest ? (
              <div style={successCardStyle}>
                <div style={labelStyle}>Request saved</div>
                <h3 style={successTitleStyle}>We have your {plan.name} request.</h3>
                <p style={noteTextStyle}>
                  {requestStorageMode === 'supabase'
                    ? 'We captured the plan, email, and tennis job for admin follow-up.'
                    : 'We saved this request in the browser. Send an email copy if you want this routed outside the device.'}
                </p>
                {requestLinkStatus ? <p style={successMetaStyle}>{requestLinkStatus}</p> : null}
                {isPublic && requestStorageMode === 'supabase' ? (
                  <div style={formActionRowStyle}>
                    <Link
                      href={`/join?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}`}
                      style={primaryButtonStyle}
                    >
                      Create account
                    </Link>
                    <Link
                      href={`/login?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}`}
                      style={secondaryButtonStyle}
                    >
                      Link after sign in
                    </Link>
                  </div>
                ) : null}
                <a href={mailtoHref} style={primaryButtonStyle}>
                  Send email copy
                </a>
              </div>
            ) : (
              <form style={requestFormStyle} onSubmit={handleRequestSubmit}>
                <div style={selectedPlanStyle}>
                  <span style={labelStyle}>Selected plan</span>
                  <strong>{plan.name}</strong>
                </div>
                <div style={fieldGridStyle}>
                  <label style={fieldStyle}>
                    Name
                    <input
                      value={requestName}
                      onChange={(event) => setRequestName(event.target.value)}
                      placeholder="Your name"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldStyle}>
                    Email
                    <input
                      type="email"
                      value={requestEmail}
                      onChange={(event) => setRequestEmail(event.target.value)}
                      placeholder="you@example.com"
                      style={inputStyle}
                    />
                  </label>
                </div>
                <label style={fieldStyle}>
                  Team or league
                  <input
                    value={requestOrganization}
                    onChange={(event) => setRequestOrganization(event.target.value)}
                    placeholder="Optional"
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  What are you trying to do first?
                  <textarea
                    value={requestGoal}
                    onChange={(event) => setRequestGoal(event.target.value)}
                    placeholder="Example: compare a lineup, prep for a match, or run league standings."
                    style={textareaStyle}
                  />
                </label>
                {requestError ? <p style={errorTextStyle}>{requestError}</p> : null}
                <div style={formActionRowStyle}>
                  <button type="submit" disabled={requestSubmitting} style={submitButtonStyle}>
                    {requestSubmitting ? 'Saving request...' : `Request ${plan.name}`}
                  </button>
                  <a href={mailtoHref} style={secondaryButtonStyle}>
                    Email instead
                  </a>
                </div>
              </form>
            )}
          </section>
        ) : null}
      </main>
    </SiteShell>
  )
}

function buildAccessRequestMailto(request: UpgradeRequestRecord) {
  const subject = encodeURIComponent(`TenAceIQ ${request.planName} access request`)
  const body = encodeURIComponent(
    [
      `Plan: ${request.planName}`,
      `Name: ${request.name || 'Not provided'}`,
      `Email: ${request.email || 'Not provided'}`,
      `Team or league: ${request.organization || 'Not provided'}`,
      `Goal: ${request.goal || 'Not provided'}`,
      `Requested destination: ${request.nextHref}`,
    ].join('\n'),
  )

  return `mailto:hello@tenaceiq.com?subject=${subject}&body=${body}`
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function readLastRemoteRequest(): { id?: string; email?: string } | null {
  try {
    const raw = window.localStorage.getItem(LAST_REMOTE_UPGRADE_REQUEST_KEY)
    return raw ? JSON.parse(raw) as { id?: string; email?: string } : null
  } catch {
    return null
  }
}

const pageStyle: CSSProperties = {
  width: 'min(1180px, calc(100% - 32px))',
  margin: '0 auto',
  padding: '20px 0 36px',
  display: 'grid',
  gap: 16,
}

const heroStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  alignItems: 'stretch',
  borderRadius: 30,
  border: '1px solid var(--shell-panel-border)',
  background:
    'radial-gradient(circle at 12% 18%, color-mix(in srgb, var(--brand-blue-2) 16%, transparent) 0%, transparent 32%), radial-gradient(circle at 90% 14%, color-mix(in srgb, var(--brand-green) 16%, transparent) 0%, transparent 30%), var(--shell-panel-bg-strong)',
  boxShadow: '0 24px 56px rgba(2, 10, 24, 0.14)',
}

const heroCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  alignContent: 'center',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-chip-bg) 88%)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.25rem, 4.5vw, 4.6rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 16,
  lineHeight: 1.72,
  maxWidth: 760,
  fontWeight: 700,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#04121a',
  textDecoration: 'none',
  fontWeight: 950,
  boxShadow: '0 16px 28px rgba(155, 225, 29, 0.16)',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
  boxShadow: 'none',
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 13,
  padding: 20,
  borderRadius: 24,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 92%, var(--brand-blue-2) 8%)',
  boxShadow: 'var(--shadow-soft)',
}

const planNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const priceStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
}

const mutedStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
}

const resultCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 13,
  borderRadius: 16,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  lineHeight: 1.55,
}

const labelStyle: CSSProperties = {
  color: 'color-mix(in srgb, var(--brand-blue) 72%, var(--foreground-strong) 28%)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const metaGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 9,
}

const metaCardStyle: CSSProperties = {
  ...resultCardStyle,
  fontSize: 13,
}

const valueListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const valuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 850,
}

const activationStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 14,
  alignItems: 'start',
  padding: 16,
  borderRadius: 20,
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-panel-bg) 92%)',
}

const activationCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
}

const activationTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 2vw, 1.8rem)',
  lineHeight: 1.08,
  fontWeight: 950,
}

const noteTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 750,
}

const secondaryInlineLinkStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  textDecoration: 'underline',
  textUnderlineOffset: 4,
}

const requestFormStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 14,
  borderRadius: 18,
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg-strong) 86%, var(--brand-green) 14%)',
}

const selectedPlanStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: 14,
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid var(--shell-panel-border)',
  background: 'rgba(255, 255, 255, 0.92)',
  color: '#071523',
  fontSize: 14,
  fontWeight: 750,
  outline: 'none',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 88,
  padding: '11px 12px',
  resize: 'vertical',
  lineHeight: 1.45,
}

const formActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 9,
  alignItems: 'center',
}

const submitButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: 14,
}

const errorTextStyle: CSSProperties = {
  margin: 0,
  color: '#fecaca',
  fontSize: 13,
  fontWeight: 850,
}

const successCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 16,
  borderRadius: 18,
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 12%, var(--shell-panel-bg-strong) 88%)',
}

const successTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
}

const successMetaStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
}
