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
import { getClientAuthState } from '@/lib/auth'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import SiteShell from '@/app/components/site-shell'
import BrandWordmark from '@/app/components/brand-wordmark'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { getMembershipTier, type MembershipTierId } from '@/lib/product-story'
import { getPlanDestinationHref, getPlanUnlockHref, isSafeLocalNextHref } from '@/lib/plan-intent'

const JOIN_PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'captain', 'league']

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
    desktopTitle: 'Start free. Add tools when you need them.',
    mobileText: 'Create an account and explore tennis context.',
    desktopText: 'Explore tennis context first. Upgrade when you want My Lab, team-week tools, or league operations.',
    formCue: 'Create the free account first. Your tier path stays simple from there.',
    success: 'Account created. Sign in, then explore the tennis map.',
  },
  player_plus: {
    eyebrow: 'Player path',
    mobileTitle: 'Set up your lab.',
    desktopTitle: 'Create your account. Make TenAceIQ personal.',
    mobileText: 'Start with an account, then connect your player identity.',
    desktopText: 'Player starts with your account, then opens My Lab, follows, matchup reads, and player-linked prep around your game.',
    formCue: 'After signup, connect your player record so My Lab can revolve around your tennis.',
    success: 'Account created. Sign in, then connect your player identity for My Lab.',
  },
  captain: {
    eyebrow: 'Captain path',
    mobileTitle: 'Set up Captain.',
    desktopTitle: 'Create your account. Run the team week.',
    mobileText: 'Start with an account, then open the captain workflow.',
    desktopText: 'Captain starts with your account, then brings lineups, scouting, readiness, and weekly team decisions into one flow.',
    formCue: 'After signup, open Captain tools to start organizing lineups, scouting, and readiness.',
    success: 'Account created. Sign in, then open Captain tools.',
  },
  league: {
    eyebrow: 'Coordinator path',
    mobileTitle: 'Set up league tools.',
    desktopTitle: 'Create your account. Operate the season.',
    mobileText: 'Start with an account, then set up the league path.',
    desktopText: 'Coordinator starts with your account, then supports league structure, visibility, rankings, schedules, results, and admin workflows.',
    formCue: 'After signup, move into league setup when you are ready to organize the season.',
    success: 'Account created. Sign in, then continue into league setup.',
  },
}

function getJoinNextRoute(planId: MembershipTierId) {
  return getPlanUnlockHref(planId, getPlanDestinationHref(planId))
}

const SETUP_STEPS: {
  title: string
  text: string
  icon: TiqFeatureIconName
}[] = [
  {
    title: 'Explore free',
    text: 'Search players, teams, leagues, and rankings first.',
    icon: 'opponentScouting',
  },
  {
    title: 'Connect your player',
    text: 'Player and higher tiers set identity once.',
    icon: 'accountSecurity',
  },
  {
    title: 'Open your lab',
    text: 'My Lab and Matchup start around your game.',
    icon: 'myLab',
  },
]

function getDefaultSignedInRoute(
  role: UserRole,
  entitlements?: ProductEntitlementSnapshot | null,
) {
  const access = buildProductAccessState(role, entitlements)
  if (access.canUseAdvancedPlayerInsights) return '/profile'
  if (access.canUseLeagueTools) return '/captain/season-dashboard'
  if (access.canUseCaptainWorkflow) return '/captain'
  return '/mylab'
}

export default function JoinPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const requestedPlan = searchParams.get('plan')
  const selectedPlanId: MembershipTierId = JOIN_PLAN_IDS.includes(requestedPlan as MembershipTierId)
    ? (requestedPlan as MembershipTierId)
    : 'free'
  const selectedIntent = JOIN_INTENT_COPY[selectedPlanId]
  const selectedTier = getMembershipTier(selectedPlanId)
  const selectedNextRoute = isSafeLocalNextHref(searchParams.get('next'), getJoinNextRoute(selectedPlanId))

  useEffect(() => {
    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        const nextRole = authState.role
        setRole(nextRole)

        if (nextRole !== 'public') {
          router.replace(getDefaultSignedInRoute(nextRole, authState.entitlements))
        }
      } finally {
        setAuthLoading(false)
      }
    }

    loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const authState = await getClientAuthState()
      const nextRole = authState.role
      setRole(nextRole)
      setAuthLoading(false)

      if (nextRole !== 'public') {
        router.replace(getDefaultSignedInRoute(nextRole, authState.entitlements))
      }
    })

    return () => subscription.unsubscribe()
  }, [router])

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
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.05fr) minmax(360px, 0.95fr)',
    padding: isMobile ? '22px 18px' : '34px 26px',
    gap: isMobile ? '14px' : '24px',
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
      <SiteShell active="/join">
        <section style={loadingShell}>
          <div style={loadingCard}>Checking account status...</div>
        </section>
      </SiteShell>
    )
  }

  if (role !== 'public') return null

  return (
    <SiteShell active="/join">
      <section style={heroShellResponsive}>
        <div>
          <div style={eyebrow}>{selectedIntent.eyebrow}</div>
          <h1 style={{ ...heroTitle, fontSize: isSmallMobile ? '32px' : isMobile ? '36px' : '58px' }}>
            {isMobile ? selectedIntent.mobileTitle : selectedIntent.desktopTitle}
          </h1>
          <p style={{ ...heroText, fontSize: isSmallMobile ? '16px' : '18px' }}>
            {isMobile ? selectedIntent.mobileText : selectedIntent.desktopText}
          </p>

          <div style={selectedPlanCardStyle}>
            <div style={selectedPlanLabelStyle}>Selected path</div>
            <div style={selectedPlanTitleStyle}>{selectedTier.name}</div>
            <div style={selectedPlanTextStyle}>{selectedTier.upgradeCue}</div>
            <Link href="/pricing" style={selectedPlanLinkStyle}>
              Compare tiers
            </Link>
          </div>

          {isMobile ? (
            <div style={mobilePromiseBar}>
              <span style={mobilePromiseChip}>Explore</span>
              <span style={mobilePromiseChip}>Connect</span>
              <span style={mobilePromiseChip}>Play smarter</span>
            </div>
          ) : (
            <div style={joinPromisePanel}>
              <div style={promiseLabel}>Simple setup</div>
              <div style={promiseStack}>
                {SETUP_STEPS.map((step) => (
                  <JoinPromiseStep key={step.title} icon={step.icon} title={step.title} text={step.text} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={loginPanelResponsive}>
          <div style={loginPanelGlow} />
          <div style={loginPanelInnerResponsive}>
            {!isMobile ? (
              <div style={loginBrandWrap}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                  <BrandWordmark compact={isSmallMobile} top={!isSmallMobile} />
                </div>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} style={isMobile ? formCardMobile : formCard}>
              <div style={formLabel}>New member setup</div>
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
                {submitting ? 'Creating account...' : 'Create free account'}
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
    </SiteShell>
  )
}

function JoinPromiseStep({ icon, title, text }: { icon: TiqFeatureIconName; title: string; text: string }) {
  return (
    <div style={promiseStep}>
      <TiqFeatureIcon name={icon} size="sm" variant="ghost" />
      <div>
        <div style={promiseTitle}>{title}</div>
        <div style={promiseText}>{text}</div>
      </div>
    </div>
  )
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '14px auto 24px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid var(--home-eyebrow-border)',
  background: 'var(--home-eyebrow-bg)',
  color: 'var(--home-eyebrow-color)',
  fontWeight: 800,
  fontSize: '15px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: 0,
  maxWidth: '760px',
  fontSize: '58px',
}

const heroText: CSSProperties = {
  margin: '0 0 16px',
  color: 'var(--shell-copy-muted)',
  fontSize: '18px',
  lineHeight: 1.45,
  maxWidth: '760px',
}

const selectedPlanCardStyle: CSSProperties = {
  display: 'grid',
  gap: '7px',
  width: 'min(100%, 560px)',
  margin: '18px 0 0',
  padding: '16px',
  borderRadius: '22px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 22%, var(--shell-panel-border) 78%)',
  background:
    'linear-gradient(135deg, color-mix(in srgb, var(--shell-panel-bg) 90%, var(--brand-green) 10%) 0%, color-mix(in srgb, var(--shell-panel-bg) 96%, var(--brand-blue-2) 4%) 100%)',
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
  fontSize: '22px',
  lineHeight: 1,
  fontWeight: 900,
}

const selectedPlanTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.55,
  fontWeight: 750,
}

const selectedPlanLinkStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  alignItems: 'center',
  minHeight: '34px',
  padding: '0 12px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: '13px',
  fontWeight: 900,
}

const joinPromisePanel: CSSProperties = {
  marginTop: '24px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  padding: '18px',
  maxWidth: '900px',
}

const mobilePromiseBar: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '10px',
}

const mobilePromiseChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '32px',
  padding: '0 11px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 800,
}

const promiseLabel: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '14px',
}

const promiseStack: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const promiseStep: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '42px minmax(0, 1fr)',
  gap: '12px',
  alignItems: 'center',
  borderRadius: '18px',
  padding: '14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const promiseTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  lineHeight: 1.35,
  fontWeight: 900,
}

const promiseText: CSSProperties = {
  marginTop: '4px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const loginPanel: CSSProperties = {
  position: 'relative',
  borderRadius: '30px',
  overflow: 'hidden',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
}

const loginPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 'auto auto 8px 50%',
  width: '250px',
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
  height: '100%',
  padding: '22px',
  display: 'flex',
  flexDirection: 'column',
}

const loginBrandWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  textAlign: 'center',
  marginBottom: '18px',
}

const formCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 90%, var(--foreground) 10%)',
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
}

const formTitleMobile: CSSProperties = {
  ...formTitle,
  fontSize: '24px',
}

const identityCueStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '36px minmax(0, 1fr)',
  gap: '10px',
  alignItems: 'center',
  padding: '10px 12px',
  borderRadius: '16px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 20%, var(--shell-panel-border) 80%)',
  background: 'color-mix(in srgb, var(--brand-green) 8%, var(--shell-chip-bg) 92%)',
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 800,
  lineHeight: 1.4,
}

const inputLabel: CSSProperties = {
  color: 'var(--foreground)',
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '2px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '50px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
}

const termsRow: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
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
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 84%, var(--brand-blue-2) 16%)',
  color: 'var(--foreground)',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
}

const submitButton: CSSProperties = {
  minHeight: '50px',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  color: '#08111d',
  fontWeight: 900,
  fontSize: '15px',
  cursor: 'pointer',
  boxShadow: '0 10px 28px rgba(155,225,29,0.18)',
}

const successBanner: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(96,221,116,0.12)',
  border: '1px solid rgba(130,244,118,0.18)',
  color: '#e7ffd0',
  fontWeight: 700,
  fontSize: '14px',
}

const errorBanner: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(142, 32, 32, 0.18)',
  border: '1px solid rgba(255, 122, 122, 0.26)',
  color: '#ffd7d7',
  fontWeight: 700,
  fontSize: '14px',
}

const helperRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
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
}

const loadingShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '40px auto',
  padding: '0 24px',
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: 'var(--foreground-strong)',
  background: 'var(--shell-panel-bg)',
  border: '1px solid var(--shell-panel-border)',
  fontSize: '15px',
  fontWeight: 700,
}
