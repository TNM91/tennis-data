'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CSSProperties, FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { type ProductEntitlementSnapshot } from '@/lib/access-model'
import { FREE_POST_LOGIN_ROUTE, getDefaultProductHomeRoute } from '@/lib/post-login-route'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { type MembershipTierId } from '@/lib/product-story'

const DEFAULT_POST_LOGIN_ROUTE = FREE_POST_LOGIN_ROUTE
const LOGIN_PLAN_IDS: MembershipTierId[] = ['free', 'player_plus', 'coach', 'captain', 'league', 'full_court']
const LOGIN_AUTH_TIMEOUT_MS = 8000

const LOGIN_INTENT_COPY: Record<MembershipTierId, {
  eyebrow: string
  title: string
  body: string
  destination: string
}> = {
  free: {
    eyebrow: 'TenAceIQ access',
    title: 'Open the tennis map.',
    body: 'Sign in, search the tennis map, and choose the right tools when your tennis needs more support.',
    destination: 'Find',
  },
  player_plus: {
    eyebrow: 'Player path',
    title: 'Continue to My Lab.',
    body: 'Sign in to pick up your player home, matchup prep, follows, and messages.',
    destination: 'My Lab',
  },
  coach: {
    eyebrow: 'Coach path',
    title: 'Continue to Coach Hub.',
    body: 'Sign in to return to lessons, drill assignments, player proof, and coach-player follow-through.',
    destination: 'Coach Hub',
  },
  captain: {
    eyebrow: 'Team path',
    title: 'Continue to Team Hub.',
    body: 'Sign in to return to availability, lineups, scouting, and the match-week plan.',
    destination: 'Team Hub',
  },
  league: {
    eyebrow: 'League path',
    title: 'Continue to League Office.',
    body: 'Sign in to return to schedules, scores, standings, participants, and season admin.',
    destination: 'League Office',
  },
  full_court: {
    eyebrow: 'Full-Court path',
    title: 'Continue to Full-Court.',
    body: 'Sign in to move between My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.',
    destination: 'Full-Court',
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
  void userId
  return getDefaultProductHomeRoute(role, entitlements)
}

async function withLoginTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), timeoutMs)
    }),
  ])
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
  return candidate
}

export default function LoginPage() {
  return (
    <SiteShell active="login">
      <LoginContent />
    </SiteShell>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { role, userId, entitlements, authResolved, refreshAuth } = useAuth()
  const [redirecting, setRedirecting] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitHovered, setSubmitHovered] = useState(false)
  const [error, setError] = useState('')
  const [authNote, setAuthNote] = useState('')

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

  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const selectedPlanId = getLoginPlanIntent()
  const selectedIntent = LOGIN_INTENT_COPY[selectedPlanId]
  const emailPrefill = searchParams.get('email')?.trim() ?? ''
  const switchingAccount = searchParams.get('switchAccount') === '1'
  const coachSetupEmailLabel = emailPrefill || 'the invited email'
  const coachSetupNote = role !== 'public'
    ? `You are signed in to another TenAceIQ account. Use ${coachSetupEmailLabel} here so this coach setup lands on the right player profile.`
    : `Use ${coachSetupEmailLabel} here to finish this coach text setup. The setup link opens after sign in.`

  useEffect(() => {
    router.prefetch(DEFAULT_POST_LOGIN_ROUTE)
    router.prefetch('/profile')
    router.prefetch('/captain')
    router.prefetch('/league-coordinator')
  }, [router, getPostLoginRoute])

  useEffect(() => {
    if (!emailPrefill) return

    setEmail((current) => current || emailPrefill)
  }, [emailPrefill])

  useEffect(() => {
    const redirectAuthenticatedUser = async (
      nextRole: UserRole,
      nextEntitlements: ProductEntitlementSnapshot | null,
      userId?: string | null,
    ) => {
      if (nextRole === 'public' || hasRedirectedRef.current) return

      hasRedirectedRef.current = true
      setRedirecting(true)
      router.replace(await getPostLoginRoute(nextRole, nextEntitlements, userId))
    }

    if (!authResolved) return
    if (role !== 'public' && !switchingAccount) {
      void redirectAuthenticatedUser(role, entitlements, userId)
      return
    }

    hasRedirectedRef.current = false
    setRedirecting(false)
  }, [authResolved, entitlements, getPostLoginRoute, role, router, switchingAccount, userId])

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
    setAuthNote('')

    try {
      const signInResult = await withLoginTimeout<
        | { timedOut: false; result: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>> }
        | { timedOut: true }
      >(
        supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        }).then((result) => ({ timedOut: false as const, result })),
        LOGIN_AUTH_TIMEOUT_MS,
        { timedOut: true as const },
      )
      if (signInResult.timedOut) {
        throw new Error('Sign in timed out. Check your connection and try again.')
      }

      const { data: signInData, error: signInError } = signInResult.result

      if (signInError) throw new Error(signInError.message)
      if (!signInData.session?.access_token || !signInData.session.refresh_token) {
        throw new Error('Sign in did not return an active session. Please check the account credentials and try again.')
      }

      setAuthNote(canUseBrowserStorage() ? 'Session accepted. Opening TenAceIQ...' : 'Session accepted for this tab. Browser storage looks blocked on this device.')

      const authState = await withLoginTimeout(
        refreshAuth(),
        LOGIN_AUTH_TIMEOUT_MS,
        null,
      )
      const nextRole = authState?.role && authState.role !== 'public' ? authState.role : 'member'

      hasRedirectedRef.current = true
      setRedirecting(true)
      const nextRoute = await getPostLoginRoute(
        nextRole,
        authState?.entitlements ?? null,
        authState?.userId ?? signInData.session.user.id,
      )
      router.replace(nextRoute)
      router.refresh()
    } catch (err) {
      hasRedirectedRef.current = false
      setRedirecting(false)
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

function canUseBrowserStorage() {
  if (typeof window === 'undefined') return false

  try {
    const key = '__tenaceiq_auth_storage_check__'
    window.localStorage.setItem(key, '1')
    window.localStorage.removeItem(key)
    return true
  } catch {
    return false
  }
}

  const heroShellResponsive: CSSProperties = {
    ...heroShell,
    width: isMobile ? 'min(620px, calc(100% - 20px))' : 'min(620px, calc(100% - clamp(24px, 5vw, 40px)))',
    gridTemplateColumns: 'minmax(0, 1fr)',
    padding: isMobile ? '18px' : '24px',
    gap: isMobile ? '12px' : '14px',
    margin: isMobile ? '10px auto 22px' : heroShell.margin,
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

  const helperRowResponsive: CSSProperties = {
    ...helperRow,
    ...(isMobile ? mobileHelperRow : null),
  }

  const footerPromptResponsive: CSSProperties = {
    ...footerPrompt,
    ...(isMobile ? mobileFooterPrompt : null),
  }

  if (!authResolved || (!switchingAccount && role !== 'public') || redirecting) {
    return (
      <section style={loadingShell}>
        <div style={loadingCard}>
          <span style={authLoadingIconStyle}>
            <Image
              src="/tiq/logo/tiq-app-icon.png"
              alt=""
              width={512}
              height={512}
              priority
              style={authLoadingImageStyle}
            />
          </span>
          {submitting ? 'Signing you in...' : 'Opening your next tennis tool...'}
        </div>
      </section>
    )
  }

  return (
    <section style={heroShellResponsive}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={loginCopyRailStyle}>
          <div style={eyebrow}>{selectedIntent.eyebrow}</div>
          <h1 style={{ ...heroTitle, fontSize: isSmallMobile ? '30px' : isMobile ? '34px' : '42px' }}>
            {selectedIntent.title}
          </h1>
          <p style={{ ...heroText, fontSize: isSmallMobile ? '15px' : '16px' }}>
            {selectedIntent.body}
          </p>

          <div style={destinationPillStyle}>Next tennis tool: {selectedIntent.destination}</div>
        </div>

        <div style={loginPanelResponsive}>
          <div style={loginPanelGlow} />
          <div style={loginPanelInnerResponsive}>
            <form onSubmit={handleSubmit} style={isMobile ? formCardMobile : formCard}>
              <div style={formLabel}>More Tennis. Less Chaos.</div>
              <h2 style={isMobile ? formTitleMobile : formTitle}>Sign in</h2>
              {switchingAccount ? (
                <div role="status" aria-live="polite" style={successBanner}>
                  {coachSetupNote}
                </div>
              ) : null}

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
                {submitting ? 'Signing in...' : selectedPlanId === 'free' ? 'Sign in' : `Continue to ${selectedIntent.destination}`}
              </button>

              {error ? <div id="login-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}
              {!error && authNote ? <div role="status" aria-live="polite" style={successBanner}>{authNote}</div> : null}

              <div style={helperRowResponsive}>
                <Link
                  href={selectedPlanId === 'free' ? '/join' : `/join?plan=${selectedPlanId}`}
                  style={isMobile ? mobilePrimaryAuthLink : inlineLink}
                >
                  Create free account
                </Link>
                <Link href="/forget-password" style={isMobile ? mobileSecondaryAuthLink : inlineLinkMuted}>
                  Forgot password?
                </Link>
              </div>
            </form>

            <div style={footerPromptResponsive}>
              Need the public experience first?{' '}
              <Link href="/explore" style={isMobile ? mobileInlineExploreLink : inlineLink}>
                Explore TenAceIQ
              </Link>
            </div>
          </div>
        </div>
    </section>
  )
}

function passwordWrapResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...passwordWrap,
    gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)',
    overflowWrap: 'anywhere',
  }
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  minWidth: 0,
  margin: '14px auto 24px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'var(--portal-surface-bg)',
  boxShadow: '0 24px 70px rgba(2,8,23,0.48)',
  overflow: 'hidden',
  boxSizing: 'border-box',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: 'clamp(-42px, -4vw, -18px)',
  bottom: 'clamp(-76px, -6vw, -30px)',
  width: 'clamp(260px, 36vw, 500px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.22,
  pointerEvents: 'none',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  maxWidth: '100%',
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

const loginCopyRailStyle: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  display: 'grid',
  gap: 8,
  minWidth: 0,
}

const destinationPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  maxWidth: '100%',
  minHeight: '36px',
  padding: '0 13px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.26)',
  background: 'rgba(155,225,29,0.10)',
  color: 'var(--foreground)',
  fontSize: '14px',
  fontWeight: 900,
  overflowWrap: 'anywhere',
  whiteSpace: 'normal',
}

const loginPanel: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  minWidth: 0,
  borderRadius: '30px',
  overflow: 'hidden',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(8,13,28,0.62)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.38)',
}

const loginPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(125,211,252,0.08), transparent 42%), linear-gradient(135deg, transparent 58%, rgba(155,225,29,0.08))',
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
  border: '1px solid rgba(125,211,252,0.14)',
  background: 'rgba(15,23,42,0.66)',
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
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(255,255,255,0.045)',
  color: 'var(--foreground-strong)',
  padding: '0 16px',
  fontSize: '15px',
  outline: 'none',
}

const passwordWrap: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, auto)',
  gap: '10px',
  alignItems: 'center',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const passwordInputStyle: CSSProperties = {
  ...inputStyle,
}

const togglePasswordButton: CSSProperties = {
  minHeight: '50px',
  maxWidth: '100%',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(125,211,252,0.08)',
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
  border: '1px solid rgba(155,225,29,0.34)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  fontSize: '15px',
  overflowWrap: 'anywhere',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
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
  overflowWrap: 'anywhere',
}

const successBanner: CSSProperties = {
  ...errorBanner,
  background: 'rgba(155,225,29,0.11)',
  border: '1px solid rgba(155,225,29,0.30)',
  color: 'var(--foreground-strong)',
  overflowWrap: 'anywhere',
}

const helperRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  minWidth: 0,
  marginTop: '4px',
}

const mobileHelperRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '9px',
  alignItems: 'stretch',
  marginTop: '2px',
}

const footerPrompt: CSSProperties = {
  marginTop: '16px',
  textAlign: 'center',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const mobileFooterPrompt: CSSProperties = {
  display: 'grid',
  gap: '6px',
  justifyItems: 'center',
  marginTop: '14px',
  padding: '0 4px 8px',
  lineHeight: 1.35,
}

const inlineLink: CSSProperties = {
  color: 'var(--brand-blue-2)',
  textDecoration: 'none',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const inlineLinkMuted: CSSProperties = {
  color: 'rgba(224,236,249,0.74)',
  textDecoration: 'none',
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

const mobilePrimaryAuthLink: CSSProperties = {
  ...inlineLink,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(96,165,250,0.24)',
  background: 'rgba(96,165,250,0.10)',
  textAlign: 'center',
}

const mobileSecondaryAuthLink: CSSProperties = {
  ...inlineLinkMuted,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  width: '100%',
  borderRadius: 14,
  border: '1px solid rgba(224,236,249,0.12)',
  background: 'rgba(255,255,255,0.045)',
  textAlign: 'center',
}

const mobileInlineExploreLink: CSSProperties = {
  ...inlineLink,
  display: 'inline-flex',
  minHeight: 32,
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

const loadingShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: 'min(1280px, calc(100% - clamp(24px, 5vw, 40px)))',
  margin: '40px auto',
  boxSizing: 'border-box',
}

const loadingCard: CSSProperties = {
  borderRadius: '22px',
  padding: '18px 20px',
  color: 'var(--foreground-strong)',
  background: 'rgba(8,13,28,0.66)',
  border: '1px solid rgba(125,211,252,0.16)',
  fontSize: '15px',
  fontWeight: 700,
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
}

const authLoadingIconStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-grid',
  placeItems: 'center',
  width: '32px',
  height: '32px',
  flexShrink: 0,
}

const authLoadingImageStyle: CSSProperties = {
  display: 'block',
  width: 32,
  height: 32,
  objectFit: 'contain',
}
