'use client'

import Link from 'next/link'
import {
  CSSProperties,
  FormEvent,
  useEffect,
  useState,
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { getMembershipTier, type MembershipTierId } from '@/lib/product-story'
import { getPlanDestinationHref, getPlanUnlockHref, isSafeLocalNextHref } from '@/lib/plan-intent'

const JOIN_PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']

const JOIN_INTENT_COPY: Record<MembershipTierId, {
  eyebrow: string
  mobileTitle: string
  desktopTitle: string
  mobileText: string
  desktopText: string
  formCue: string
  success: string
}> = {
  free: {
    eyebrow: 'Create your account',
    mobileTitle: 'Start free.',
    desktopTitle: 'Start free. Pick the tennis job later.',
    mobileText: 'Create an account and search the tennis map.',
    desktopText: 'Search players, teams, leagues, rankings, and tennis context first. Upgrade only when a specific job needs a home base.',
    formCue: 'Create the free account first. Choose My Lab, Coach Hub, Team Hub, League Office, or Full-Court when a tennis job needs it.',
    success: 'Account created. Sign in, then explore the tennis map.',
  },
  player_plus: {
    eyebrow: 'Player path',
    mobileTitle: 'Set up your lab.',
    desktopTitle: 'Create your account. Then activate My Lab.',
    mobileText: 'Create the free account first. Player unlocks after the plan is active.',
    desktopText: 'Player starts with Free, then unlocks My Lab, data refreshes, matchup prep, follows, and tennis messages after the plan is active.',
    formCue: 'Signup creates Free access. Activate Player next, then open My Lab so TenAceIQ can revolve around your tennis.',
    success: 'Free account created. Sign in, then activate Player and open My Lab.',
  },
  coach: {
    eyebrow: 'Coach path',
    mobileTitle: 'Set up Coach.',
    desktopTitle: 'Create your account. Then activate Coach Hub.',
    mobileText: 'Create the free account first. Coach unlocks after the plan is active.',
    desktopText: 'Coach starts with Free, then unlocks lesson planning, player tracking, assignments, scheduling, and tactical boards after the plan is active.',
    formCue: 'Signup creates Free access. Activate Coach next, then open Coach Hub and Tactical Studio for the player-development job.',
    success: 'Free account created. Sign in, then activate Coach to open Coach Hub.',
  },
  captain: {
    eyebrow: 'Team path',
    mobileTitle: 'Set up Captain.',
    desktopTitle: 'Create your account. Then activate Team Hub.',
    mobileText: 'Create the free account first. Captain unlocks after the plan is active.',
    desktopText: 'Captain starts with Free, then unlocks availability, lineups, scouting, readiness, messages, and weekly team decisions after the plan is active.',
    formCue: 'Signup creates Free access. Activate Captain next, then open Team Hub for the match-week job.',
    success: 'Free account created. Sign in, then activate Captain to open Team Hub.',
  },
  league: {
    eyebrow: 'League path',
    mobileTitle: 'Set up League.',
    desktopTitle: 'Create your account. Then activate League Office.',
    mobileText: 'Create the free account first. League unlocks after access is active.',
    desktopText: 'League starts with Free, then unlocks one season workspace for players or teams, schedules, scores, standings, and admin follow-through.',
    formCue: 'Signup creates Free access. Activate League next, then open League Office for the season job.',
    success: 'Free account created. Sign in, then activate League to open League Office.',
  },
  full_court: {
    eyebrow: 'Full-Court path',
    mobileTitle: 'Set up every tennis job.',
    desktopTitle: 'Create your account. Run every tennis job.',
    mobileText: 'Create the free account first. Full-Court unlocks after the plan is active.',
    desktopText: 'Full-Court starts with a free account, then unlocks My Lab, Coach Hub, Team Hub, League Office, and unlimited Tournament Desk operations after the plan is active.',
    formCue: 'Signup creates Free access. Activate Full-Court next, then open one connected tennis operation.',
    success: 'Free account created. Sign in, then activate Full-Court to run every tennis job.',
  },
}

const JOIN_SELECTED_PLAN_COPY: Record<MembershipTierId, string> = {
  free: 'Search the tennis map first. Upgrade only when a specific tennis job needs a home base.',
  player_plus: 'Player starts from Free, then opens My Lab for your game, matchup prep, follows, and messages.',
  coach: 'Coach starts from Free, then opens Coach Hub for lessons, assignments, player proof, and follow-through.',
  captain: 'Captain starts from Free, then opens Team Hub for availability, lineups, scouting, and team messages.',
  league: 'League starts from Free, then opens League Office for one season of schedules, scores, and standings.',
  full_court: 'Full-Court starts from Free, then opens every tennis job plus unlimited Tournament Desk operations.',
}

function getJoinNextRoute(planId: MembershipTierId) {
  return getPlanUnlockHref(planId, getPlanDestinationHref(planId))
}

function getDefaultSignedInRoute(
  role: UserRole,
  entitlements?: ProductEntitlementSnapshot | null,
) {
  const access = buildProductAccessState(role, entitlements)
  if (access.currentPlanId === 'full_court') return '/league-coordinator'
  if (access.currentPlanId === 'league') return '/league-coordinator'
  if (access.currentPlanId === 'captain') return '/captain'
  if (access.currentPlanId === 'coach') return '/coach'
  if (access.canUseAdvancedPlayerInsights) return '/profile'
  return '/mylab'
}

export default function JoinPage() {
  return (
    <SiteShell active="/join">
      <JoinContent />
    </SiteShell>
  )
}

function JoinContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, entitlements, authResolved } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const requestedPlan = searchParams.get('plan')
  const requestedEmail = searchParams.get('email')?.trim() ?? ''
  const selectedPlanId: MembershipTierId = JOIN_PLAN_IDS.includes(requestedPlan as MembershipTierId)
    ? (requestedPlan as MembershipTierId)
    : 'free'
  const selectedIntent = JOIN_INTENT_COPY[selectedPlanId]
  const selectedTier = getMembershipTier(selectedPlanId)
  const selectedNextRoute = isSafeLocalNextHref(searchParams.get('next'), getJoinNextRoute(selectedPlanId))
  const authLoading = !authResolved

  useEffect(() => {
    if (!authResolved || role === 'public') return
    router.replace(getDefaultSignedInRoute(role, entitlements))
  }, [authResolved, entitlements, role, router])

  useEffect(() => {
    if (requestedEmail && !email) setEmail(requestedEmail)
  }, [email, requestedEmail])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email.')
      return
    }

    if (!password) {
      setError('Create a password.')
      return
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (!acceptedTerms) {
      setError('You must accept the Terms and Privacy Policy to create an account.')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      })

      if (error) throw new Error(error.message)

      setMessage(selectedIntent.success)
      setTimeout(() => {
        router.push(`/login?plan=${selectedPlanId}&next=${encodeURIComponent(selectedNextRoute)}`)
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.')
    } finally {
      setSubmitting(false)
    }
  }

  const heroShellResponsive: CSSProperties = {
    ...heroShell,
    width: isMobile ? 'min(100% - 20px, 680px)' : 'min(720px, calc(100% - clamp(24px, 5vw, 40px)))',
    gridTemplateColumns: 'minmax(0, 1fr)',
    padding: isMobile ? '18px' : '24px',
    gap: isMobile ? '12px' : '14px',
  }

  const loginPanelResponsive: CSSProperties = {
    ...loginPanel,
    ...(isMobile
      ? {
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          borderRadius: 0,
        }
      : {}),
  }

  const loginPanelInnerResponsive: CSSProperties = {
    ...loginPanelInner,
    padding: isMobile ? 0 : '22px',
  }

  if (authLoading) {
    return (
      <section style={loadingShell}>
        <div style={loadingCard}>Checking account status...</div>
      </section>
    )
  }

  if (role !== 'public') return null

  return (
    <section style={heroShellResponsive}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={joinCopyRailStyle}>
          <div style={eyebrow}>{selectedIntent.eyebrow}</div>
          <h1 style={{ ...heroTitle, fontSize: isSmallMobile ? '30px' : isMobile ? '34px' : '42px' }}>
            {isMobile ? selectedIntent.mobileTitle : selectedIntent.desktopTitle}
          </h1>
          <p style={{ ...heroText, fontSize: isSmallMobile ? '15px' : '16px' }}>
            {isMobile ? selectedIntent.mobileText : selectedIntent.desktopText}
          </p>

          <div style={selectedPlanCardStyle}>
            <div style={selectedPlanLabelStyle}>Selected start</div>
            <div style={selectedPlanTitleStyle}>{selectedTier.name}</div>
            <div style={selectedPlanTextStyle}>
              {JOIN_SELECTED_PLAN_COPY[selectedPlanId]}
            </div>
            {selectedPlanId !== 'free' ? (
              <div style={entitlementNoticeStyle}>
                Account creation starts Free access first.
              </div>
            ) : null}
            <div style={selectedPlanActionRowStyle}>
              <Link href="/pricing" style={selectedPlanLinkStyle}>
                Compare tiers
              </Link>
              <Link href={selectedNextRoute} style={selectedPlanLinkStyle}>
                Preview next step
              </Link>
            </div>
          </div>
        </div>

        <div style={loginPanelResponsive}>
          <div style={loginPanelGlow} />
          <div style={loginPanelInnerResponsive}>
            <form onSubmit={handleSubmit} style={isMobile ? formCardMobile : formCard}>
              <div style={formLabel}>More Tennis. Less Chaos.</div>
              <h2 style={isMobile ? formTitleMobile : formTitle}>Create your account</h2>
              <div style={identityCueStyle}>
                <TiqFeatureIcon name="accountSecurity" size="sm" variant="ghost" />
                <span>{selectedIntent.formCue}</span>
              </div>

              <label htmlFor="email" style={inputLabel}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'join-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                  setMessage('')
                }}
                placeholder="you@example.com"
                style={inputStyle}
              />

              <label htmlFor="password" style={inputLabel}>
                Password
              </label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'join-error' : undefined}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                  setMessage('')
                }}
                placeholder="At least 8 characters"
                style={inputStyle}
              />

              <label htmlFor="confirmPassword" style={inputLabel}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'join-error' : undefined}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setError('')
                  setMessage('')
                }}
                placeholder="Re-enter your password"
                style={inputStyle}
              />

              <label style={termsRow}>
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  aria-required="true"
                  onChange={(e) => {
                    setAcceptedTerms(e.target.checked)
                    setError('')
                  }}
                  style={checkboxStyle}
                />
                <span>
                  I agree to the{' '}
                  <Link href="/legal/terms" style={inlineLegalLink}>
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/legal/privacy" style={inlineLegalLink}>
                    Privacy Policy
                  </Link>
                  .
                </span>
              </label>

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={togglePasswordButton}
              >
                {showPassword ? 'Hide passwords' : 'Show passwords'}
              </button>

              <button
                type="submit"
                disabled={submitting}
                onMouseEnter={() => setSubmitHovered(true)}
                onMouseLeave={() => setSubmitHovered(false)}
                style={{
                  ...submitButton,
                  transform: submitHovered && !submitting ? 'translateY(-1px)' : 'none',
                  boxShadow: submitHovered && !submitting
                    ? '0 14px 34px rgba(155,225,29,0.26)'
                    : '0 10px 28px rgba(155,225,29,0.18)',
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
              >
                {submitting ? 'Creating account...' : selectedPlanId === 'free' ? 'Create free account' : 'Create free account first'}
              </button>

              {message ? <div role="status" aria-live="polite" style={successBanner}>{message}</div> : null}
              {error ? <div id="join-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}

              <div style={helperRow}>
                <span style={helperText}>Already have an account?</span>
                <Link href="/login" style={inlineLink}>
                  Sign in
                </Link>
              </div>
            </form>
          </div>
        </div>
    </section>
  )
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  minWidth: 0,
  margin: '14px auto 24px',
  display: 'grid',
  borderRadius: '34px',
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.22)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2, 8, 23, 0.48)',
  boxSizing: 'border-box',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: '-110px',
  top: '-118px',
  width: 'clamp(220px, 24vw, 310px)',
  aspectRatio: '1',
  borderRadius: '50%',
  pointerEvents: 'none',
  opacity: 0.16,
  background:
    'radial-gradient(circle at 36% 34%, rgba(255,255,255,0.88) 0 7%, transparent 8%), radial-gradient(circle at 50% 50%, rgba(155,225,29,0.96) 0 48%, rgba(155,225,29,0.1) 49%, transparent 58%)',
  boxShadow: '0 0 80px rgba(155,225,29,0.22)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  maxWidth: '100%',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.24)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--home-eyebrow-color)',
  fontWeight: 800,
  fontSize: '15px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '760px',
  fontSize: '58px',
  overflowWrap: 'anywhere',
}

const heroText: CSSProperties = {
  margin: '0 0 16px',
  color: 'var(--shell-copy-muted)',
  fontSize: '18px',
  lineHeight: 1.45,
  maxWidth: '760px',
  overflowWrap: 'anywhere',
}

const joinCopyRailStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const selectedPlanCardStyle: CSSProperties = {
  display: 'grid',
  gap: '6px',
  width: '100%',
  minWidth: 0,
  margin: '2px 0 0',
  padding: '12px',
  borderRadius: '18px',
  border: '1px solid rgba(155,225,29,0.24)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(34,211,238,0.08))',
}

const selectedPlanLabelStyle: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const selectedPlanTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '19px',
  lineHeight: 1,
  fontWeight: 900,
}

const selectedPlanTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
  overflowWrap: 'anywhere',
}

const entitlementNoticeStyle: CSSProperties = {
  padding: '8px 10px',
  borderRadius: '12px',
  border: '1px solid rgba(251,191,36,0.24)',
  background: 'rgba(251,191,36,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 800,
}

const selectedPlanActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '8px',
  marginTop: '2px',
}

const selectedPlanLinkStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  maxWidth: '100%',
  alignItems: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const loginPanel: CSSProperties = {
  position: 'relative',
  minWidth: 0,
  borderRadius: '30px',
  overflow: 'hidden',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(8, 13, 28, 0.66)',
  boxShadow: 'var(--shadow-soft)',
}

const loginPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 'auto auto 8px 50%',
  width: 'min(100%, 250px)',
  height: '250px',
  transform: 'translateX(-50%)',
  borderRadius: '999px',
  background:
    'radial-gradient(circle, rgba(116,190,255,0.18) 0%, rgba(155,225,29,0.08) 34%, rgba(116,190,255,0) 72%)',
  pointerEvents: 'none',
}

const loginPanelInner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
  height: '100%',
  padding: '22px',
  display: 'flex',
  flexDirection: 'column',
}

const formCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  minWidth: 0,
  borderRadius: '24px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.62)',
  padding: '18px',
}

const formCardMobile: CSSProperties = {
  ...formCard,
  gap: '10px',
  padding: '16px',
}

const formLabel: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const formTitle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

const formTitleMobile: CSSProperties = {
  ...formTitle,
  fontSize: '24px',
}

const identityCueStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 36px) minmax(0, 1fr)',
  gap: '10px',
  minWidth: 0,
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.2)',
  background: 'rgba(155,225,29,0.08)',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 800,
  lineHeight: 1.4,
  overflowWrap: 'anywhere',
}

const inputLabel: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '2px',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: '50px',
  borderRadius: '16px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(15, 23, 42, 0.66)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
}

const termsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  minWidth: 0,
  marginTop: '4px',
  color: 'var(--foreground)',
  fontSize: '13px',
  lineHeight: 1.6,
  fontWeight: 600,
}

const checkboxStyle: CSSProperties = {
  width: '18px',
  height: '18px',
  marginTop: '2px',
  flexShrink: 0,
  accentColor: '#9be11d',
}

const inlineLegalLink: CSSProperties = {
  color: 'var(--brand-green)',
  textDecoration: 'none',
  fontWeight: 800,
}

const togglePasswordButton: CSSProperties = {
  minHeight: '46px',
  maxWidth: '100%',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  background: 'rgba(56,189,248,0.12)',
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: '13px',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
}

const submitButton: CSSProperties = {
  minHeight: '50px',
  maxWidth: '100%',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.38)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '15px',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const successBanner: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(96,221,116,0.12)',
  border: '1px solid rgba(130,244,118,0.18)',
  color: '#e7ffd0',
  fontWeight: 700,
  fontSize: '14px',
  overflowWrap: 'anywhere',
}

const errorBanner: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(142, 32, 32, 0.18)',
  border: '1px solid rgba(255, 122, 122, 0.26)',
  color: '#ffd7d7',
  fontWeight: 700,
  fontSize: '14px',
  overflowWrap: 'anywhere',
}

const helperRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
  marginTop: '4px',
  alignItems: 'center',
}

const helperText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const inlineLink: CSSProperties = {
  color: 'var(--brand-blue-2)',
  textDecoration: 'none',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const loadingShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '40px auto',
  padding: 0,
  boxSizing: 'border-box',
  overflowX: 'clip',
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: 'var(--foreground-strong)',
  background: 'var(--portal-surface-bg)',
  border: '1px solid rgba(125, 211, 252, 0.18)',
  fontSize: '15px',
  fontWeight: 700,
}
