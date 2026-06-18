'use client'

import Link from 'next/link'
import { use, useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import { getPlanDestinationHref, isSafeLocalNextHref } from '@/lib/plan-intent'
import { getPricingPlan, type PricingPlanId } from '@/lib/pricing-plans'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import { getMembershipTier } from '@/lib/product-story'
import { buildSupportMessageHref } from '@/lib/message-links'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import {
  buildUpgradePricingSnapshot,
  UPGRADE_REQUESTS_KEY,
  type UpgradeRequestRecord,
} from '@/lib/upgrade-requests'

const PLAN_IDS: PricingPlanId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']
const LAST_REMOTE_UPGRADE_REQUEST_KEY = 'tenaceiq-last-remote-upgrade-request-v1'

const PLAN_ICON_BY_ID: Record<PricingPlanId, TiqFeatureIconName> = {
  free: 'playerRatings',
  player_plus: 'myLab',
  coach: 'scenarioBuilder',
  captain: 'lineupBuilder',
  league: 'teamRankings',
  full_court: 'teamRankings',
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
    body: 'Search players, teams, leagues, rankings, flights, and areas before you need a paid workspace.',
    action: 'Open Find',
    checkoutAction: 'Open Find',
    setupAction: 'Open Free',
  },
  player_plus: {
    eyebrow: 'Player unlock',
    title: 'Unlock the Player path for $4.99/month.',
    body: 'Player gives you My Lab, Level Up training cards, Tactics Tools, better data refreshes, matchup prep, follows, and messages around your game.',
    action: 'Continue with Player',
    checkoutAction: 'Unlock Player',
    setupAction: 'Preview Player setup',
  },
  coach: {
    eyebrow: 'Coach unlock',
    title: 'Help players leave with the next step.',
    body: 'Continue with Coach when drill assignments, player development tracking, reviews, resources, scheduling, and tactical boards need one flow.',
    action: 'Continue with Coach',
    checkoutAction: 'Unlock Coach',
    setupAction: 'Preview Coach',
  },
  captain: {
    eyebrow: 'Captain unlock',
    title: 'Run the team week.',
    body: 'Continue with Captain when Team Hub lineup decisions, scouting, readiness, and team communication need one cleaner flow.',
    action: 'Continue with Team Hub',
    checkoutAction: 'Unlock Captain',
    setupAction: 'Preview Team Hub',
  },
  league: {
    eyebrow: 'League unlock',
    title: 'Run the season with less admin work.',
    body: 'Continue with League Office when players or teams, schedules, scores, standings, visibility, and corrections need one place.',
    action: 'Continue with League Office',
    checkoutAction: 'Unlock League',
    setupAction: 'Preview League Office',
  },
  full_court: {
    eyebrow: 'Full-Court unlock',
    title: 'Run the full court.',
    body: 'Continue with Full-Court when My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations should stay connected around one tennis operation.',
    action: 'Continue with Full-Court',
    checkoutAction: 'Unlock Full-Court',
    setupAction: 'Preview Full-Court',
  },
}

const ACTIVATION_STEPS: Record<PricingPlanId, string[]> = {
  free: ['Open Find', 'Search public tennis context', 'Upgrade when a workspace helps'],
  player_plus: ['Request Player access', 'Open My Lab', 'Prep matchup'],
  coach: ['Request Coach access', 'Open Coach Hub', 'Assign drills and lessons'],
  captain: ['Request Captain access', 'Open Team Hub', 'Build lineup and weekly flow'],
  league: ['Request League access', 'Open League Office', 'Track participants and results'],
  full_court: ['Request Full-Court access', 'Open every tennis job', 'Create unlimited tournaments'],
}

const SUCCESS_HANDOFF_COPY: Record<PricingPlanId, {
  title: string
  body: string
  primaryAction: string
  secondaryAction: string
  secondaryHref: string
  steps: string[]
}> = {
  free: {
    title: 'Free is ready.',
    body: 'Search public tennis context, then upgrade when a paid workspace helps.',
    primaryAction: 'Open Find',
    secondaryAction: 'Compare plans',
    secondaryHref: '/pricing',
    steps: ['Search players and teams', 'Review public rankings', 'Upgrade when you need more'],
  },
  player_plus: {
    title: 'Player is active. Start in My Lab.',
    body: 'Open My Lab, use Level Up, improve the data behind your tennis read, and prep your next match.',
    primaryAction: 'Open My Lab',
    secondaryAction: 'Start Level Up',
    secondaryHref: '/level-up',
    steps: ['Open My Lab', 'Choose Level Up work', 'Compare your next match'],
  },
  coach: {
    title: 'Coach Hub is active. Build the next lesson.',
    body: 'Open Coach Hub, map court work in Tactical Studio, and turn drills into player assignments.',
    primaryAction: 'Open Coach Hub',
    secondaryAction: 'Open workbook',
    secondaryHref: '/player-development',
    steps: ['Plan a lesson', 'Build a tactical board', 'Assign the next drill'],
  },
  captain: {
    title: 'Team Hub is active. Build the week.',
    body: 'Start with Team Hub, then turn scouting and lineup decisions into a cleaner match plan.',
    primaryAction: 'Open Team Hub',
    secondaryAction: 'Build lineup',
    secondaryHref: '/captain/lineup-builder',
    steps: ['Confirm team context', 'Review player readiness', 'Build a lineup plan'],
  },
  league: {
    title: 'League Office is active. Set up the season.',
    body: 'Create the league structure in League Office, bring players or teams into scope, and keep standings visible.',
    primaryAction: 'Open League Office',
    secondaryAction: 'Find leagues',
    secondaryHref: '/leagues',
    steps: ['Create the League Office shell', 'Add participants', 'Track results and rankings'],
  },
  full_court: {
    title: 'Full-Court is active. Run every tennis job.',
    body: 'Open Full-Court, then use My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations together.',
    primaryAction: 'Open Full-Court',
    secondaryAction: 'Find leagues',
    secondaryHref: '/leagues',
    steps: ['Open every tennis job', 'Create leagues or tournaments', 'Track teams, players, results, and rankings'],
  },
}

type UpgradePageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default function UpgradePage({ searchParams }: UpgradePageProps) {
  const resolvedSearchParams = use(searchParams)
  return (
    <SiteShell active="">
      <UpgradeContent resolvedSearchParams={resolvedSearchParams} />
    </SiteShell>
  )
}

function UpgradeContent({
  resolvedSearchParams,
}: {
  resolvedSearchParams: { [key: string]: string | string[] | undefined }
}) {
  const { isTablet, isSmallMobile } = useViewportBreakpoints()
  const { role, userId, entitlements, authResolved, session, refreshAuth } = useAuth()
  const requestedPlan = getSearchParamValue(resolvedSearchParams.plan)
  const planId: PricingPlanId = PLAN_IDS.includes(requestedPlan as PricingPlanId)
    ? (requestedPlan as PricingPlanId)
    : 'captain'
  const plan = getPricingPlan(planId)
  const pricingSnapshot = useMemo(() => buildUpgradePricingSnapshot(planId), [planId])
  const tier = getMembershipTier(planId)
  const copy = UNLOCK_COPY[planId]
  const successHandoff = SUCCESS_HANDOFF_COPY[planId]
  const nextHref = isSafeLocalNextHref(getSearchParamValue(resolvedSearchParams.next), getPlanDestinationHref(planId))

  const [requestName, setRequestName] = useState('')
  const [requestEmail, setRequestEmail] = useState('')
  const [requestOrganization, setRequestOrganization] = useState('')
  const [requestGoal, setRequestGoal] = useState('')
  const [requestError, setRequestError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState<UpgradeRequestRecord | null>(null)
  const [requestSubmitting, setRequestSubmitting] = useState(false)
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutSuccessMessage, setCheckoutSuccessMessage] = useState('')
  const [requestStorageMode, setRequestStorageMode] = useState<'supabase' | 'local' | null>(null)
  const [requestLinkStatus, setRequestLinkStatus] = useState('')
  const [autoCheckoutStarted, setAutoCheckoutStarted] = useState(false)
  const checkoutReturnState = getSearchParamValue(resolvedSearchParams.checkout)
  const checkoutReturnRequestId = getSearchParamValue(resolvedSearchParams.request) ?? ''
  const checkoutReturnSessionId = getSearchParamValue(resolvedSearchParams.session_id) ?? ''

  useEffect(() => {
    if (!authResolved) return
    setRequestEmail(session?.user?.email ?? '')
    if (userId) {
      void claimLastRemoteRequest(session?.user?.email ?? '')
    }
  }, [authResolved, session?.user?.email, userId])

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
      // Keep the page quiet. Admin can still follow up inside TenAceIQ support.
    }
  }

  const startCheckoutForRequest = useCallback(async (requestId: string, accessToken: string) => {
    const response = await fetch('/api/checkout/session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        requestId,
        nextHref,
      }),
    })
    const body = await response.json().catch(() => null) as
      | { ok?: boolean; message?: string; url?: string }
      | null

    if (!response.ok || !body?.ok || !body.url) {
      throw new Error(body?.message ?? 'Checkout could not be started.')
    }

    if (planId !== 'free') {
      await trackProductUsageEvent({
        eventName: 'upgrade_checkout_started',
        surface: 'upgrade',
        planId,
        metadata: {
          requestId,
          nextHref,
        },
      })
    }

    window.location.assign(body.url)
  }, [nextHref, planId])

  const startCheckout = useCallback(async () => {
    if (!submittedRequest?.id || checkoutSubmitting) return

    setCheckoutSubmitting(true)
    setCheckoutError('')
    setCheckoutSuccessMessage('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token) {
        throw new Error('Sign in before checkout.')
      }

      await startCheckoutForRequest(submittedRequest.id, session.access_token)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be started.')
      setCheckoutSubmitting(false)
    }
  }, [checkoutSubmitting, startCheckoutForRequest, submittedRequest?.id])

  const startSignedInCheckout = useCallback(async () => {
    if (checkoutSubmitting || planId === 'free') return

    setCheckoutSubmitting(true)
    setCheckoutError('')
    setCheckoutSuccessMessage('')
    setRequestError('')

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session?.access_token || !session.user.email) {
        throw new Error('Sign in before checkout.')
      }

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
        email: session.user.email,
        organization: '',
        goal: `Start ${plan.name} checkout from upgrade.`,
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

      setSubmittedRequest(requestBody.request)
      setRequestStorageMode('supabase')
      await startCheckoutForRequest(requestBody.request.id, session.access_token)
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be started.')
      setCheckoutSubmitting(false)
    }
  }, [checkoutSubmitting, nextHref, plan.name, planId, pricingSnapshot, startCheckoutForRequest])

  const resolvedRole = authResolved || !userId ? role : 'member'
  const authLoading = !authResolved
  const access = useMemo(() => buildProductAccessState(resolvedRole, entitlements), [entitlements, resolvedRole])
  const hasAccess =
    planId === 'free' ||
    (planId === 'player_plus' && access.canUseAdvancedPlayerInsights) ||
    (planId === 'coach' && access.canUseCoachWorkflow) ||
    (planId === 'captain' && access.canUseCaptainWorkflow) ||
    (planId === 'league' && access.canUseLeagueTools) ||
    (planId === 'full_court' && access.currentPlanId === 'full_court')
  const isPublic = resolvedRole === 'public'
  const isPaidPlan = planId === 'player_plus' || planId === 'coach' || planId === 'captain' || planId === 'league' || planId === 'full_court'
  const showAccessRequest = isPaidPlan && !hasAccess && (isPublic || !authLoading)
  const planChoiceCards = PLAN_IDS.map((choicePlanId) => {
    const choicePlan = getPricingPlan(choicePlanId)
    const choiceTier = getMembershipTier(choicePlanId)
    return {
      id: choicePlanId,
      plan: choicePlan,
      tier: choiceTier,
      selected: choicePlanId === planId,
      active: isPlanAlreadyActive(choicePlanId, access),
      href: `/upgrade?plan=${choicePlanId}&next=${encodeURIComponent(getPlanDestinationHref(choicePlanId))}`,
    }
  })

  useEffect(() => {
    if (autoCheckoutStarted || authLoading || !isPaidPlan || hasAccess || isPublic || checkoutReturnState) return

    setAutoCheckoutStarted(true)
    void startSignedInCheckout()
  }, [
    autoCheckoutStarted,
    authLoading,
    checkoutReturnState,
    hasAccess,
    isPaidPlan,
    isPublic,
    startSignedInCheckout,
  ])

  useEffect(() => {
    if (authLoading || checkoutReturnState !== 'success' || !checkoutReturnRequestId || isPublic) return

    let active = true
    let redirectTimeout: number | undefined

    void (async () => {
      setCheckoutSubmitting(true)
      setCheckoutError('')
      setCheckoutSuccessMessage('')

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          throw new Error('Sign in before confirming checkout.')
        }

        const response = await fetch('/api/checkout/complete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            requestId: checkoutReturnRequestId,
            sessionId: checkoutReturnSessionId,
          }),
        })
        const body = await response.json().catch(() => null) as
          | { ok?: boolean; message?: string }
          | null

        if (!response.ok || !body?.ok) {
          throw new Error(body?.message ?? 'Checkout could not be confirmed.')
        }

        await refreshAuth()
        if (active) {
          setRequestEmail(session?.user?.email ?? '')
          setCheckoutSubmitting(false)
          setCheckoutSuccessMessage(`${successHandoff.body} Opening ${getPlanDestinationLabel(planId)}...`)
          redirectTimeout = window.setTimeout(() => {
            window.location.replace(nextHref)
          }, 2800)
        }
      } catch (error) {
        if (!active) return
        setCheckoutError(error instanceof Error ? error.message : 'Checkout could not be confirmed.')
        setCheckoutSubmitting(false)
      }
    })()

    return () => {
      active = false
      if (redirectTimeout) {
        window.clearTimeout(redirectTimeout)
      }
    }
  }, [
    authLoading,
    checkoutReturnRequestId,
    checkoutReturnSessionId,
    checkoutReturnState,
    isPublic,
    nextHref,
    planId,
    refreshAuth,
    session?.user?.email,
    successHandoff.body,
  ])

  const supportThreadHref = buildAccessRequestSupportHref(submittedRequest ?? {
    id: '',
    planId,
    ...pricingSnapshot,
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
      ...pricingSnapshot,
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
        setRequestError('This browser could not save the request. Open a support thread and we will handle it inside TenAceIQ.')
      }
    } finally {
      setRequestSubmitting(false)
    }
  }

  return (
    <main style={pageStyle}>
        <section
          style={{
            ...heroStyle,
            gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.04fr) minmax(min(100%, 320px), 0.96fr)',
            padding: isSmallMobile ? 18 : 26,
          }}
        >
          <span aria-hidden="true" style={watermarkStyle} />
          <div style={heroCopyStyle}>
            <div style={eyebrowStyle}>{copy.eyebrow}</div>
            <h1 style={titleStyle}>{checkoutSuccessMessage ? successHandoff.title : hasAccess ? `${plan.name} is already active.` : copy.title}</h1>
            <p style={textStyle}>
              {hasAccess
                ? checkoutSuccessMessage || `Your account already has the access needed for ${plan.name}. Open the workspace when you are ready.`
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
            <div style={activationPathStyle}>
              <span style={labelStyle}>Activation path</span>
              <div style={activationStepGridStyle}>
                {ACTIVATION_STEPS[planId].map((step, index) => (
                  <span key={step} style={activationStepStyle}>
                    <strong>{index + 1}</strong>
                    {step}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section style={tierMapStyle} aria-label="Choose TenAceIQ by tennis job">
          <div style={tierMapHeaderStyle}>
            <div>
              <div style={labelStyle}>Choose by job</div>
              <h2 style={tierMapTitleStyle}>Unlock the level that removes the work in front of you.</h2>
            </div>
            <Link href="/pricing" style={secondaryButtonStyle}>
              Compare full plans
            </Link>
          </div>
          <div style={tierMapGridStyle}>
            {planChoiceCards.map((choice) => (
              <Link
                key={choice.id}
                href={choice.href}
                aria-current={choice.selected ? 'page' : undefined}
                style={{
                  ...tierChoiceCardStyle,
                  ...(choice.selected ? tierChoiceSelectedStyle : null),
                }}
              >
                <div style={tierChoiceTopStyle}>
                  <TiqFeatureIcon name={PLAN_ICON_BY_ID[choice.id]} size="md" variant={choice.selected ? 'surface' : 'ghost'} />
                  <span style={choice.active ? activeBadgeStyle : tierBadgeStyle}>
                    {choice.active ? 'Active' : choice.selected ? 'Selected' : UNLOCK_COPY[choice.id].eyebrow}
                  </span>
                </div>
                <strong style={tierChoiceNameStyle}>{choice.plan.name}</strong>
                <span style={tierChoiceBodyStyle}>{choice.tier.shortPromise}</span>
                <span style={tierChoicePriceStyle}>{choice.plan.priceLabel}</span>
              </Link>
            ))}
          </div>
        </section>

        {showAccessRequest ? (
          <section id="activation" style={activationStyle}>
            <div style={activationCopyStyle}>
              <div style={labelStyle}>{isPublic ? 'Quick request' : 'Activation step'}</div>
              <h2 style={activationTitleStyle}>Ready to turn on {plan.name}?</h2>
              <p style={noteTextStyle}>
                {isPublic
                  ? 'Send the plan request first. Account creation starts Free access; the selected plan opens after access is active.'
                  : checkoutSuccessMessage
                    ? checkoutSuccessMessage
                    : checkoutError
                      ? 'Checkout did not start. Try again below or use the plan page while we keep your account signed in.'
                      : 'We are opening secure Stripe Checkout. No extra request form needed.'}
              </p>
              <Link
                href={isPublic ? `/login?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}` : nextHref}
                style={secondaryInlineLinkStyle}
              >
                {isPublic ? 'Sign in instead' : copy.setupAction}
              </Link>
            </div>
            {!isPublic ? (
              <div style={successCardStyle}>
                <div style={labelStyle}>Secure checkout</div>
                <h3 style={successTitleStyle}>
                  {checkoutSuccessMessage
                    ? successHandoff.title
                    : checkoutSubmitting
                      ? checkoutReturnState === 'success'
                        ? 'Confirming checkout...'
                        : 'Opening Stripe Checkout...'
                      : checkoutError
                        ? 'Checkout needs another try.'
                        : `Starting ${plan.name} checkout.`}
                </h3>
                <p style={noteTextStyle}>
                  {checkoutSuccessMessage
                    ? checkoutSuccessMessage
                    : checkoutSubmitting
                      ? checkoutReturnState === 'success'
                        ? 'We are refreshing your account access now.'
                        : 'We are creating your checkout session now.'
                      : checkoutError
                        ? checkoutError
                        : 'Continue to Stripe to finish the upgrade.'}
                </p>
                {checkoutSuccessMessage ? (
                  <div style={handoffStepGridStyle}>
                    {successHandoff.steps.map((step, index) => (
                      <span key={step} style={handoffStepStyle}>
                        <strong>{index + 1}</strong>
                        {step}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div style={formActionRowStyle}>
                  {checkoutSuccessMessage ? (
                    <>
                      <Link href={nextHref} style={primaryButtonStyle}>
                        {successHandoff.primaryAction}
                      </Link>
                      <Link href={successHandoff.secondaryHref} style={secondaryButtonStyle}>
                        {successHandoff.secondaryAction}
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void startSignedInCheckout()}
                        disabled={checkoutSubmitting}
                        style={submitButtonStyle}
                      >
                        {checkoutSubmitting ? 'Opening checkout...' : 'Continue to secure checkout'}
                      </button>
                      <Link href="/pricing" style={secondaryButtonStyle}>
                        Compare plans
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ) : submittedRequest ? (
              <div style={successCardStyle}>
                <div style={labelStyle}>Request saved</div>
                <h3 style={successTitleStyle}>We have your {plan.name} request.</h3>
                <p style={noteTextStyle}>
                  {requestStorageMode === 'supabase'
                    ? 'We captured the plan, account contact, and tennis job for admin follow-up.'
                    : 'We saved this request in the browser. Open a support thread if you want this routed inside TenAceIQ.'}
                </p>
                {requestLinkStatus ? <p style={successMetaStyle}>{requestLinkStatus}</p> : null}
                {requestStorageMode === 'supabase' && submittedRequest.userId ? (
                  <div style={formActionRowStyle}>
                    <button
                      type="button"
                      onClick={() => void startCheckout()}
                      disabled={checkoutSubmitting}
                      style={submitButtonStyle}
                    >
                      {checkoutSubmitting ? 'Opening checkout...' : 'Continue to secure checkout'}
                    </button>
                    <Link href={supportThreadHref} style={secondaryButtonStyle}>
                      Open support thread
                    </Link>
                  </div>
                ) : isPublic && requestStorageMode === 'supabase' ? (
                  <div style={formActionRowStyle}>
                    <Link
                      href={`/join?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}`}
                      style={primaryButtonStyle}
                    >
                      Create free account first
                    </Link>
                    <Link
                      href={`/login?plan=${planId}&next=${encodeURIComponent(`/upgrade?plan=${planId}&next=${encodeURIComponent(nextHref)}`)}`}
                      style={secondaryButtonStyle}
                    >
                      Link after sign in
                    </Link>
                  </div>
                ) : null}
                {checkoutError ? <p style={errorTextStyle}>{checkoutError}</p> : null}
                {requestStorageMode !== 'supabase' || !submittedRequest.userId ? (
                  <Link href={supportThreadHref} style={primaryButtonStyle}>
                    Open support thread
                  </Link>
                ) : null}
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
                      className="tiq-focus-ring"
                      value={requestName}
                      onChange={(event) => setRequestName(event.target.value)}
                      placeholder="Your name"
                      style={inputStyle}
                    />
                  </label>
                  <label style={fieldStyle}>
                    Email
                    <input
                      className="tiq-focus-ring"
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
                    className="tiq-focus-ring"
                    value={requestOrganization}
                    onChange={(event) => setRequestOrganization(event.target.value)}
                    placeholder="Optional"
                    style={inputStyle}
                  />
                </label>
                <label style={fieldStyle}>
                  What are you trying to do first?
                  <textarea
                    className="tiq-focus-ring"
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
                  <Link href={supportThreadHref} style={secondaryButtonStyle}>
                    Ask support
                  </Link>
                </div>
              </form>
            )}
          </section>
        ) : null}
    </main>
  )
}

function buildAccessRequestSupportHref(request: UpgradeRequestRecord) {
  return buildSupportMessageHref({
    category: 'billing',
    subject: `TenAceIQ ${request.planName} access request`,
    body: [
      `Plan: ${request.planName}`,
      `Price: ${request.priceLabel || 'Not captured'}`,
      `Billing: ${request.checkoutMode || 'manual'} ${request.billingInterval || ''}`.trim(),
      `Name: ${request.name || 'Not provided'}`,
      `Account contact: ${request.email || 'Not provided'}`,
      `Team or league: ${request.organization || 'Not provided'}`,
      `Goal: ${request.goal || 'Not provided'}`,
      `Requested destination: ${request.nextHref}`,
    ].join('\n'),
    entityType: 'billing',
    entityId: request.planId,
  })
}

function getSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function getPlanDestinationLabel(planId: PricingPlanId) {
  if (planId === 'player_plus') return 'My Lab'
  if (planId === 'coach') return 'Coach'
  if (planId === 'captain') return 'Team'
  if (planId === 'league') return 'League'
  if (planId === 'full_court') return 'Full-Court'
  return 'Find'
}

function isPlanAlreadyActive(planId: PricingPlanId, access: ReturnType<typeof buildProductAccessState>) {
  if (planId === 'free') return access.currentPlanId === 'free'
  if (planId === 'player_plus') return access.canUseAdvancedPlayerInsights
  if (planId === 'coach') return access.canUseCoachWorkflow
  if (planId === 'captain') return access.canUseCaptainWorkflow
  if (planId === 'league') return access.canUseLeagueTools
  if (planId === 'full_court') return access.currentPlanId === 'full_court'
  return false
}

function createClientRequestId(planId: PricingPlanId) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${planId}-${crypto.randomUUID()}`
  }

  return `${planId}-${Date.now()}-${Math.round(Math.random() * 10000)}`
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
  width: 'min(1180px, calc(100% - clamp(24px, 5vw, 32px)))',
  minWidth: 0,
  margin: '0 auto',
  padding: '20px 0 36px',
  display: 'grid',
  gap: 16,
  boxSizing: 'border-box',
  overflowX: 'clip',
}

const heroStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 18,
  minWidth: 0,
  alignItems: 'stretch',
  borderRadius: 30,
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.48)',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-118px',
  width: 310,
  height: 310,
  borderRadius: '50%',
  pointerEvents: 'none',
  opacity: 0.16,
  background:
    'radial-gradient(circle at 36% 34%, rgba(255,255,255,0.88) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(155,225,29,0.96) 0 48%, rgba(155,225,29,0.1) 49%, transparent 58%)',
  boxShadow: '0 0 80px rgba(155,225,29,0.22)',
}

const heroCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 13,
  minWidth: 0,
  alignContent: 'center',
}

const eyebrowStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  maxWidth: '100%',
  alignItems: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const titleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(2.25rem, 4.5vw, 4.6rem)',
  lineHeight: 0.98,
  fontWeight: 950,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 16,
  lineHeight: 1.72,
  maxWidth: 760,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  minWidth: 0,
  gap: 10,
}

const primaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 46,
  padding: '0 16px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.32), rgba(34,211,238,0.16))',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 950,
  overflowWrap: 'anywhere',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  boxShadow: 'none',
}

const planCardStyle: CSSProperties = {
  display: 'grid',
  alignContent: 'start',
  gap: 13,
  minWidth: 0,
  padding: 20,
  borderRadius: 24,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.72)',
  boxShadow: 'var(--shadow-soft)',
}

const tierMapStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  minWidth: 0,
  padding: 18,
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(13,28,53,0.72) 0%, rgba(8,18,36,0.9) 100%)',
  boxShadow: '0 18px 46px rgba(2,10,24,0.12), inset 0 1px 0 rgba(255,255,255,0.04)',
}

const tierMapHeaderStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  minWidth: 0,
}

const tierMapTitleStyle: CSSProperties = {
  margin: '4px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.35rem, 2.6vw, 2.15rem)',
  lineHeight: 1.05,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const tierMapGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const tierChoiceCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  minHeight: 172,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--foreground)',
  textDecoration: 'none',
  overflowWrap: 'anywhere',
}

const tierChoiceSelectedStyle: CSSProperties = {
  border: '1px solid color-mix(in srgb, var(--brand-green) 36%, rgba(116,190,255,0.14) 64%)',
  background: 'color-mix(in srgb, rgba(255,255,255,0.05) 82%, var(--brand-green) 18%)',
}

const tierChoiceTopStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
}

const tierBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  maxWidth: '100%',
  padding: '0 10px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--shell-copy-muted)',
  fontSize: 10,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const activeBadgeStyle: CSSProperties = {
  ...tierBadgeStyle,
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.1)',
  color: 'var(--foreground-strong)',
}

const tierChoiceNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 17,
  lineHeight: 1.1,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const tierChoiceBodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const tierChoicePriceStyle: CSSProperties = {
  alignSelf: 'end',
  color: 'var(--brand-green)',
  fontSize: 13,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const planNameStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 18,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  overflowWrap: 'anywhere',
}

const priceStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 32,
  lineHeight: 1,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const mutedStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const resultCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  padding: 13,
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground)',
  lineHeight: 1.55,
  overflowWrap: 'anywhere',
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 9,
  minWidth: 0,
}

const metaCardStyle: CSSProperties = {
  ...resultCardStyle,
  fontSize: 13,
}

const valueListStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  minWidth: 0,
  gap: 8,
}

const valuePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minHeight: 32,
  padding: '0 11px',
  borderRadius: 999,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const activationPathStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 12,
  borderRadius: 16,
  border: '1px solid rgba(125, 211, 252, 0.16)',
  background: 'rgba(15, 23, 42, 0.62)',
}

const activationStepGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const activationStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
  alignItems: 'center',
  minHeight: 34,
  padding: '5px 9px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.10)',
  background: 'rgba(8, 13, 28, 0.58)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const activationStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
  gap: 14,
  minWidth: 0,
  alignItems: 'start',
  padding: 16,
  borderRadius: 20,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
}

const activationCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const activationTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(1.25rem, 2vw, 1.8rem)',
  lineHeight: 1.08,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const noteTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.6,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const secondaryInlineLinkStyle: CSSProperties = {
  maxWidth: '100%',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 950,
  textDecoration: 'underline',
  textUnderlineOffset: 4,
  overflowWrap: 'anywhere',
}

const requestFormStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.72)',
}

const selectedPlanStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  minWidth: 0,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  minWidth: 0,
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 950,
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 42,
  padding: '0 12px',
  borderRadius: 12,
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.76)',
  color: 'var(--foreground-strong)',
  fontSize: 14,
  fontWeight: 750,
  outline: '2px solid transparent',
  outlineOffset: 2,
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
  minWidth: 0,
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
  overflowWrap: 'anywhere',
}

const successCardStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  minWidth: 0,
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.32)',
  background: 'rgba(155,225,29,0.1)',
}

const successTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 20,
  lineHeight: 1.12,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const successMetaStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const handoffStepGridStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
}

const handoffStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 24px) minmax(0, 1fr)',
  gap: 8,
  minWidth: 0,
  alignItems: 'center',
  minHeight: 34,
  padding: '5px 9px',
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground)',
  fontSize: 12,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}
