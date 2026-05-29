'use client'

import Link from 'next/link'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'
import { getPlanDestinationHref, getPlanSignupHref, getPlanUnlockHref } from '@/lib/plan-intent'
import { buildUpgradePricingSnapshot, type UpgradeRequestRecord } from '@/lib/upgrade-requests'

type UpgradePromptProps = {
  planId: PricingPlanId
  headline: string
  body: string
  result?: string
  ctaLabel?: string
  ctaHref?: string
  secondaryLabel?: string
  secondaryHref?: string
  footnote?: string
  compact?: boolean
  children?: ReactNode
}

export default function UpgradePrompt({
  planId,
  headline,
  body,
  result,
  ctaLabel,
  ctaHref,
  secondaryLabel = 'See plans',
  secondaryHref,
  footnote,
  compact = false,
  children,
}: UpgradePromptProps) {
  const { session, authResolved } = useAuth()
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const plan = getPricingPlan(planId)
  const resolvedResult = result || plan.outcome
  const isSignedIn = Boolean(session?.user?.id)
  const canStartDirectCheckout = !ctaHref && authResolved && isSignedIn && planId !== 'free'
  const resolvedCtaHref = ctaHref || (isSignedIn ? getPlanUnlockHref(planId) : getPlanSignupHref(planId))
  const resolvedSecondaryHref = secondaryHref || '/pricing'
  const unlockSteps = getUnlockSteps(planId)

  async function startCheckout() {
    if (checkoutSubmitting || !session?.access_token || planId === 'free') return

    setCheckoutSubmitting(true)
    setCheckoutError('')

    try {
      const nextHref = getPlanDestinationHref(planId)
      const pricingSnapshot = buildUpgradePricingSnapshot(planId)
      const userMetadata = session.user.user_metadata || {}
      const displayName =
        typeof userMetadata.name === 'string'
          ? userMetadata.name
          : typeof userMetadata.full_name === 'string'
            ? userMetadata.full_name
            : ''
      const record: UpgradeRequestRecord = {
        id: createClientRequestId(planId),
        planId,
        ...pricingSnapshot,
        name: displayName,
        email: session.user.email ?? '',
        organization: '',
        goal: `Start ${plan.name} checkout from ${getCurrentPathname()}.`,
        nextHref,
        createdAt: new Date().toISOString(),
        status: 'pending',
        source: 'supabase',
      }

      const requestResponse = await fetch('/api/upgrade-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(record),
      })
      const requestBody = await requestResponse.json().catch(() => null) as
        | { ok?: boolean; message?: string; request?: UpgradeRequestRecord }
        | null

      if (!requestResponse.ok || !requestBody?.ok || !requestBody.request?.id) {
        throw new Error(requestBody?.message ?? 'Upgrade request could not be started.')
      }

      const checkoutResponse = await fetch('/api/checkout/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          requestId: requestBody.request.id,
          nextHref,
        }),
      })
      const checkoutBody = await checkoutResponse.json().catch(() => null) as
        | { ok?: boolean; message?: string; url?: string }
        | null

      if (!checkoutResponse.ok || !checkoutBody?.ok || !checkoutBody.url) {
        throw new Error(checkoutBody?.message ?? 'Checkout could not be started.')
      }

      window.location.assign(checkoutBody.url)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be started.')
      setCheckoutSubmitting(false)
    }
  }

  return (
    <section
      style={{
        ...wrapStyle,
        ...(compact ? compactWrapStyle : null),
        ...(planId === 'captain' ? captainWrapStyle : null),
        ...(planId === 'league' ? leagueWrapStyle : null),
      }}
    >
      <div style={contentStyle}>
        <div style={labelRowStyle}>
          <span style={eyebrowStyle}>{plan.name}</span>
          {plan.badge ? <span style={badgeStyle}>{plan.badge}</span> : null}
        </div>

        <h3 style={titleStyle}>{headline}</h3>
        <p style={bodyStyle}>{body}</p>
        {planId !== 'free' ? (
          <p style={entitlementNoteStyle}>
            Creating an account starts Free access. This tier unlocks after the plan is active.
          </p>
        ) : null}

        <div style={resultWrapStyle}>
          <span style={resultLabelStyle}>Result</span>
          <span style={resultTextStyle}>{resolvedResult}</span>
        </div>

        <div style={planMetaStyle}>
          <span style={priceStyle}>{plan.priceLabel}</span>
          <span style={subtitleStyle}>{plan.subtitle}</span>
          {plan.alternatePriceNote ? <span style={noteStyle}>{plan.alternatePriceNote}</span> : null}
        </div>

        <div style={valueListStyle}>
          {plan.valueProps.slice(0, compact ? 3 : 4).map((valueProp) => (
            <span key={valueProp} style={valuePillStyle}>
              {valueProp}
            </span>
          ))}
        </div>

        <div style={unlockPathStyle}>
          <div style={unlockPathLabelStyle}>Best next unlock</div>
          <div style={unlockStepGridStyle}>
            {unlockSteps.map((step, index) => (
              <div key={step.title} style={unlockStepStyle}>
                <span style={unlockStepNumberStyle}>{index + 1}</span>
                <span style={unlockStepTextStyle}>
                  <strong style={unlockStepTitleStyle}>{step.title}</strong>
                  <span style={unlockStepBodyStyle}>{step.body}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {children}

        {footnote ? <div style={footnoteStyle}>{footnote}</div> : null}
      </div>

      <div style={actionRowStyle}>
        {canStartDirectCheckout ? (
          <button
            type="button"
            onClick={() => void startCheckout()}
            disabled={checkoutSubmitting}
            style={{
              ...primaryActionStyle,
              ...buttonActionStyle,
              ...(checkoutSubmitting ? disabledActionStyle : null),
            }}
          >
            {checkoutSubmitting ? 'Opening checkout...' : ctaLabel || plan.ctaLabel}
          </button>
        ) : (
          <Link href={resolvedCtaHref} style={primaryActionStyle}>
            {ctaLabel || plan.ctaLabel}
          </Link>
        )}
        {resolvedSecondaryHref ? (
          <Link href={resolvedSecondaryHref} style={secondaryActionStyle}>
            {secondaryLabel}
          </Link>
        ) : (
          <span style={secondaryStaticStyle}>{secondaryLabel}</span>
        )}
      </div>
      {checkoutError ? <p role="alert" style={errorTextStyle}>{checkoutError}</p> : null}
    </section>
  )
}

function createClientRequestId(planId: PricingPlanId) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${planId}-${crypto.randomUUID()}`
  }

  return `${planId}-${Date.now()}-${Math.round(Math.random() * 10000)}`
}

function getCurrentPathname() {
  if (typeof window === 'undefined') return 'TenAceIQ'
  return window.location.pathname || 'TenAceIQ'
}

function getUnlockSteps(planId: PricingPlanId) {
  if (planId === 'captain') {
    return [
      { title: 'Claim the team week', body: 'Bring availability, lineup work, and decisions into one team flow.' },
      { title: 'Build the lineup', body: 'Use roster context and scenarios before you commit.' },
      { title: 'Send the plan', body: 'Move from decision to team communication faster.' },
    ]
  }

  if (planId === 'league') {
    return [
      { title: 'Structure the season', body: 'Set the league, teams or players, and visibility in one place.' },
      { title: 'Track participation', body: 'Keep rosters, schedules, standings, and results connected.' },
      { title: 'Reduce cleanup', body: 'Operate the league without scattered spreadsheet work.' },
    ]
  }

  if (planId === 'player_plus') {
    return [
      { title: 'Open My Lab', body: 'Keep your scorecard, goals, and next tennis read together.' },
      { title: 'Improve data', body: 'Upload, report, or refresh the context behind your tennis read.' },
      { title: 'Prep matchup', body: 'Turn public discovery into personal match prep.' },
    ]
  }

  return [
    { title: 'Find', body: 'Search public players, teams, leagues, and rankings.' },
    { title: 'Learn', body: 'Use the profile paths to understand the tennis landscape.' },
    { title: 'Upgrade when useful', body: 'Add My Lab, Team Hub, or League Office only when they help.' },
  ]
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 24,
  border: '1px solid rgba(155, 225, 29, 0.18)',
  background:
    'linear-gradient(180deg, rgba(18, 36, 66, 0.74) 0%, rgba(13, 26, 48, 0.92) 100%)',
  boxShadow: '0 18px 48px rgba(2, 10, 24, 0.16)',
}

const compactWrapStyle: CSSProperties = {
  padding: 18,
  gap: 14,
}

const captainWrapStyle: CSSProperties = {
  border: '1px solid rgba(155, 225, 29, 0.22)',
  boxShadow: '0 20px 52px rgba(155, 225, 29, 0.08)',
}

const leagueWrapStyle: CSSProperties = {
  border: '1px solid rgba(116, 190, 255, 0.18)',
}

const contentStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const labelRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#dbeafe',
  background: 'rgba(37, 91, 227, 0.14)',
  border: '1px solid rgba(116, 190, 255, 0.18)',
}

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '28px',
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--foreground-strong)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.32rem, 2vw, 1.8rem)',
  lineHeight: 1.1,
  letterSpacing: 0,
}

const bodyStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 14,
  lineHeight: 1.65,
  maxWidth: 760,
}

const entitlementNoteStyle: CSSProperties = {
  margin: 0,
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(155, 225, 29, 0.16)',
  background: 'rgba(155, 225, 29, 0.07)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 800,
}

const resultWrapStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: '12px 14px',
  borderRadius: 16,
  border: '1px solid rgba(116, 190, 255, 0.12)',
  background: 'rgba(255, 255, 255, 0.04)',
}

const resultLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: '#9be11d',
}

const resultTextStyle: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 700,
}

const planMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  flexWrap: 'wrap',
}

const priceStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 24,
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
}

const subtitleStyle: CSSProperties = {
  color: '#d9f84a',
  fontSize: 13,
  fontWeight: 800,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
}

const noteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  fontWeight: 700,
}

const valueListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const valuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '0 12px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: 'var(--foreground)',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(116, 190, 255, 0.12)',
}

const unlockPathStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155, 225, 29, 0.12)',
  background: 'rgba(155, 225, 29, 0.05)',
}

const unlockPathLabelStyle: CSSProperties = {
  color: '#9be11d',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const unlockStepGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const unlockStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  padding: '10px 11px',
  borderRadius: 14,
  background: 'rgba(255, 255, 255, 0.04)',
  border: '1px solid rgba(255, 255, 255, 0.07)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const unlockStepNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  fontSize: 11,
  fontWeight: 900,
}

const unlockStepTextStyle: CSSProperties = {
  display: 'grid',
  gap: 3,
}

const unlockStepTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.25,
  fontWeight: 900,
}

const unlockStepBodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 600,
}

const footnoteStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.6,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: 999,
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  textDecoration: 'none',
  fontWeight: 900,
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const buttonActionStyle: CSSProperties = {
  border: 0,
  fontFamily: 'inherit',
  fontSize: 14,
  cursor: 'pointer',
}

const disabledActionStyle: CSSProperties = {
  opacity: 0.72,
  cursor: 'progress',
}

const secondaryActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '44px',
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(116, 190, 255, 0.16)',
  background: 'rgba(255, 255, 255, 0.05)',
  color: '#e7eefb',
  textDecoration: 'none',
  fontWeight: 800,
}

const secondaryStaticStyle: CSSProperties = {
  color: 'rgba(229, 238, 251, 0.7)',
  fontSize: 13,
  fontWeight: 700,
}

const errorTextStyle: CSSProperties = {
  margin: 0,
  color: '#fecaca',
  fontSize: 12,
  lineHeight: 1.5,
  fontWeight: 700,
}
