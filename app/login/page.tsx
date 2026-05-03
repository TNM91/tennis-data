'use client'

import Link from 'next/link'
import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { getClientAuthState } from '@/lib/auth'
import { buildProductAccessState, type ProductEntitlementSnapshot } from '@/lib/access-model'
import { loadUserProfileLink } from '@/lib/user-profile'
import SiteShell from '@/app/components/site-shell'
import BrandWordmark from '@/app/components/brand-wordmark'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { getMembershipTier, type MembershipTierId } from '@/lib/product-story'

const DEFAULT_POST_LOGIN_ROUTE = '/mylab'
const LOGIN_PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'captain', 'league']

const LOGIN_INTENT_COPY: Record<MembershipTierId, {
  eyebrow: string
  mobileTitle: string
  desktopTitle: string
  mobileText: string
  desktopText: string
  destination: string
}> = {
  free: {
    eyebrow: 'TenAceIQ access',
    mobileTitle: 'Sign in.',
    desktopTitle: 'Sign in. Start exploring.',
    mobileText: 'Open your free tennis workspace.',
    desktopText: 'Open TenAceIQ and start with the public tennis map before adding deeper tools.',
    destination: 'Free tennis map',
  },
  player_plus: {
    eyebrow: 'Player path',
    mobileTitle: 'Open your lab.',
    desktopTitle: 'Sign in. Connect your player path.',
    mobileText: 'Continue toward My Lab and player-linked prep.',
    desktopText: 'Sign in to continue toward My Lab, follows, matchup reads, and player-linked prep.',
    destination: 'My Lab setup',
  },
  captain: {
    eyebrow: 'Captain path',
    mobileTitle: 'Open Captain.',
    desktopTitle: 'Sign in. Run the team week.',
    mobileText: 'Continue into lineups, readiness, and team decisions.',
    desktopText: 'Sign in to continue toward lineups, scouting, readiness, and the weekly captain flow.',
    destination: 'Captain tools',
  },
  league: {
    eyebrow: 'Coordinator path',
    mobileTitle: 'Open league tools.',
    desktopTitle: 'Sign in. Operate the season.',
    mobileText: 'Continue into league setup and season operations.',
    desktopText: 'Sign in to continue toward league structure, visibility, rankings, schedules, and results.',
    destination: 'League desk',
  },
}

function getLoginPlanIntent() {
  if (typeof window === 'undefined') return 'free'
  const plan = new URLSearchParams(window.location.search).get('plan')
  return LOGIN_PLAN_IDS.includes(plan as MembershipTierId) ? (plan as MembershipTierId) : 'free'
}

async function getDefaultPostLoginRoute(
  role: UserRole = 'member',
  entitlements?: ProductEntitlementSnapshot | null,
  userId?: string | null,
) {
  const access = buildProductAccessState(role, entitlements)
  if (access.canUseAdvancedPlayerInsights) {
    const profileRes = await loadUserProfileLink(userId)
    const hasLinkedPlayer = Boolean(profileRes.data?.linked_player_id || profileRes.data?.linked_player_name)
    if (!hasLinkedPlayer) return '/profile'
  }
  if (access.canUseLeagueTools) return '/captain/season-dashboard'
  if (access.canUseCaptainWorkflow) return '/captain'
  return DEFAULT_POST_LOGIN_ROUTE
}

async function resolvePostLoginRoute(
  candidate: string | null | undefined,
  role: UserRole = 'member',
  entitlements?: ProductEntitlementSnapshot | null,
  userId?: string | null,
) {
  const fallback = await getDefaultPostLoginRoute(role, entitlements, userId)
  if (!candidate) return fallback
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  if (candidate.startsWith('/login')) return fallback
  if (candidate.startsWith('/join')) return fallback
  if (fallback === '/profile' && requiresPersonalIdentity(candidate)) return fallback
  return candidate
}

function requiresPersonalIdentity(candidate: string) {
  return candidate.startsWith('/mylab') || candidate.startsWith('/matchup') || candidate.startsWith('/captain')
}

export default function LoginPage() {
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)
  const [error, setError] = useState('')

  const hasRedirectedRef = useRef(false)

  // Read fresh at redirect time rather than once at mount to avoid stale values when
  // Next.js serves a cached page instance for a navigation with a different ?next= param.
  const getPostLoginRoute = useCallback((
    nextRole: UserRole = role === 'public' ? 'member' : role,
    nextEntitlements: ProductEntitlementSnapshot | null = null,
    userId?: string | null,
  ) => {
    if (typeof window === 'undefined') return getDefaultPostLoginRoute(nextRole, nextEntitlements, userId)
    return resolvePostLoginRoute(
      new URLSearchParams(window.location.search).get('next'),
      nextRole,
      nextEntitlements,
      userId,
    )
  }, [role])

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const selectedPlanId = getLoginPlanIntent()
  const selectedIntent = LOGIN_INTENT_COPY[selectedPlanId]
  const selectedTier = getMembershipTier(selectedPlanId)

  useEffect(() => {
    router.prefetch(DEFAULT_POST_LOGIN_ROUTE)
    router.prefetch('/profile')
    router.prefetch('/captain')
    router.prefetch('/captain/season-dashboard')
  }, [router, getPostLoginRoute])

  useEffect(() => {
    let mounted = true

    const redirectAuthenticatedUser = async (
      nextRole: UserRole,
      nextEntitlements: ProductEntitlementSnapshot | null,
      userId?: string | null,
    ) => {
      if (nextRole === 'public' || hasRedirectedRef.current) return

      hasRedirectedRef.current = true

      if (mounted) {
        setRedirecting(true)
        setRole(nextRole)
        setAuthLoading(false)
      }

      router.replace(await getPostLoginRoute(nextRole, nextEntitlements, userId))
    }

    async function loadAuth() {
      try {
        if (!mounted) return

        const authState = await getClientAuthState()
        const nextRole = authState.role
        setRole(nextRole)

        if (nextRole !== 'public') {
          void redirectAuthenticatedUser(nextRole, authState.entitlements, authState.user?.id)
          return
        }
      } catch (err) {
        if (mounted) {
          console.error('Unable to restore auth session on /login:', err)
        }
      } finally {
        if (mounted && !hasRedirectedRef.current) {
          setAuthLoading(false)
        }
      }
    }

    loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      if (!mounted) return

      const authState = await getClientAuthState()
      const nextRole = authState.role
      setRole(nextRole)

      if (nextRole !== 'public') {
        void redirectAuthenticatedUser(nextRole, authState.entitlements, authState.user?.id)
        return
      }

      setRedirecting(false)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, getPostLoginRoute])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email.')
      return
    }

    if (!password) {
      setError('Enter your password.')
      return
    }

    setSubmitting(true)
    setRedirecting(false)
    setError('')

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (signInError) throw new Error(signInError.message)

      const authState = await getClientAuthState()
      const nextRole = authState.role === 'public' ? 'member' : authState.role

      hasRedirectedRef.current = true
      setRedirecting(true)
      setRole(nextRole)
      setAuthLoading(false)
      router.replace(await getPostLoginRoute(nextRole, authState.entitlements, authState.user?.id))
    } catch (err) {
      hasRedirectedRef.current = false
      setRedirecting(false)
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
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
      <SiteShell active="login">
        <section style={loadingShell}>
          <div style={loadingCard}>
            <span style={spinnerStyle} />
            Checking sign-in status...
          </div>
        </section>
      </SiteShell>
    )
  }

  if (role !== 'public' || redirecting) {
    return (
      <SiteShell active="login">
        <section style={loadingShell}>
          <div style={loadingCard}>
            <span style={spinnerStyle} />
            {submitting ? 'Signing you in...' : 'Redirecting to your workspace...'}
          </div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="login">
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
            <div style={selectedPlanLabelStyle}>After sign in</div>
            <div style={selectedPlanTitleStyle}>{selectedIntent.destination}</div>
            <div style={selectedPlanTextStyle}>{selectedTier.upgradeCue}</div>
          </div>

          {isMobile ? (
            <div style={mobilePromiseBar}>
              <span style={mobilePromiseChip}>My Lab</span>
              <span style={mobilePromiseChip}>Team week</span>
              <span style={mobilePromiseChip}>League desk</span>
            </div>
          ) : (
            <>
              <div style={accessPanel}>
                <div style={featureLabel}>After sign in</div>
                <div style={accessPathGrid}>
                  <AccessPath label="Player" title="My Lab" text="Scorecard, matchups, goals, notes, and follows." />
                  <AccessPath label="Captain" title="Team week" text="Availability, lineup, team update, and weekly brief." />
                  <AccessPath label="Coordinator" title="League desk" text="League setup, schedules, standings, and results." />
                </div>
              </div>

              <div style={teamFlowPanel}>
                <div style={featureLabel}>Team communication</div>
                <div style={teamFlowGrid}>
                  <TeamStep number="1" title="Ask" text="Who can play?" />
                  <TeamStep number="2" title="Build" text="Set the lineup." />
                  <TeamStep number="3" title="Send" text="One clear update." />
                  <TeamStep number="4" title="Track" text="Replies and changes." />
                </div>
              </div>
            </>
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
              <div style={formLabel}>Account sign in</div>
              <h2 style={isMobile ? formTitleMobile : formTitle}>Welcome back</h2>

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
                aria-describedby={error ? 'login-error' : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="you@example.com"
                style={inputStyle}
              />

              <label htmlFor="password" style={inputLabel}>
                Password
              </label>
              <div style={passwordWrapResponsive(isSmallMobile)}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'login-error' : undefined}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  placeholder="Enter your password"
                  style={passwordInputStyle}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((v) => !v)}
                  style={togglePasswordButton}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button
                type="submit"
                disabled={submitting}
                onMouseEnter={() => setSubmitHovered(true)}
                onMouseLeave={() => setSubmitHovered(false)}
                style={{
                  ...(submitting ? submitButtonDisabled : submitButton),
                  transform: submitHovered && !submitting ? 'translateY(-1px)' : 'none',
                  boxShadow: submitHovered && !submitting
                    ? '0 14px 34px rgba(155,225,29,0.26)'
                    : undefined,
                  transition: 'transform 140ms ease, box-shadow 140ms ease',
                }}
              >
                {submitting ? 'Signing in...' : 'Open TenAceIQ'}
              </button>

              {error ? <div id="login-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}

              <div style={helperRow}>
                <Link href="/join" style={inlineLink}>
                  Create account
                </Link>
                <Link href="/forget-password" style={inlineLinkMuted}>
                  Forgot password?
                </Link>
              </div>
            </form>

            <div style={footerPrompt}>
              Need the public experience first?{' '}
              <Link href="/explore" style={inlineLink}>
                Explore TenAceIQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function AccessPath({ label, title, text }: { label: string; title: string; text: string }) {
  return (
    <div style={accessPathCard}>
      <div style={accessPathLabel}>{label}</div>
      <div style={featureTitle}>{title}</div>
      <div style={featureText}>{text}</div>
    </div>
  )
}

function TeamStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div style={teamStepCard}>
      <span style={teamStepNumber}>{number}</span>
      <div>
        <div style={teamStepTitle}>{title}</div>
        <div style={teamStepText}>{text}</div>
      </div>
    </div>
  )
}

function passwordWrapResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...passwordWrap,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'minmax(0, 1fr) auto',
  }
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

const accessPanel: CSSProperties = {
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

const teamFlowPanel: CSSProperties = {
  marginTop: '14px',
  borderRadius: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 78%, var(--brand-blue-2) 8%)',
  padding: '16px',
  maxWidth: '900px',
}

const featureLabel: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '14px',
}

const accessPathGrid: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const teamFlowGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '10px',
}

const accessPathCard: CSSProperties = {
  display: 'grid',
  gap: '6px',
  borderRadius: '18px',
  padding: '14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const accessPathLabel: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const featureTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.35,
}

const featureText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const teamStepCard: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  minHeight: '72px',
  borderRadius: '16px',
  padding: '10px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
}

const teamStepNumber: CSSProperties = {
  width: '30px',
  height: '30px',
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  flexShrink: 0,
  background: 'linear-gradient(135deg, #9be11d 0%, #54e184 100%)',
  color: '#06111d',
  fontWeight: 900,
  fontSize: '13px',
}

const teamStepTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 900,
  lineHeight: 1.2,
}

const teamStepText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '12px',
  lineHeight: 1.35,
  marginTop: '2px',
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

const passwordWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'center',
}

const passwordInputStyle: CSSProperties = {
  ...inputStyle,
}

const togglePasswordButton: CSSProperties = {
  minHeight: '50px',
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

const submitButtonDisabled: CSSProperties = {
  ...submitButton,
  opacity: 0.72,
  cursor: 'wait',
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
}

const footerPrompt: CSSProperties = {
  marginTop: '16px',
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const inlineLink: CSSProperties = {
  color: 'var(--brand-blue-2)',
  textDecoration: 'none',
  fontWeight: 800,
}

const inlineLinkMuted: CSSProperties = {
  color: 'rgba(224,236,249,0.74)',
  textDecoration: 'none',
  fontWeight: 700,
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
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const spinnerStyle: CSSProperties = {
  display: 'inline-block',
  width: '18px',
  height: '18px',
  borderRadius: '50%',
  border: '2px solid rgba(155,225,29,0.2)',
  borderTopColor: '#9be11d',
  animation: 'tenaceiq-spin 0.7s linear infinite',
  flexShrink: 0,
}
