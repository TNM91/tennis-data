'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getUserRole, type UserRole } from '@/lib/roles'
import SiteShell from '@/app/components/site-shell'

const DEFAULT_POST_LOGIN_ROUTE = '/mylab'

function resolvePostLoginRoute(candidate: string | null | undefined) {
  if (!candidate) return DEFAULT_POST_LOGIN_ROUTE
  if (!candidate.startsWith('/')) return DEFAULT_POST_LOGIN_ROUTE
  if (candidate.startsWith('//')) return DEFAULT_POST_LOGIN_ROUTE
  if (candidate.startsWith('/login')) return DEFAULT_POST_LOGIN_ROUTE
  if (candidate.startsWith('/join')) return DEFAULT_POST_LOGIN_ROUTE
  return candidate
}

export default function LoginPage() {
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [redirecting, setRedirecting] = useState(false)
  const [screenWidth, setScreenWidth] = useState(1280)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const hasRedirectedRef = useRef(false)

  const postLoginRoute = useMemo(() => {
    if (typeof window === 'undefined') return DEFAULT_POST_LOGIN_ROUTE
    return resolvePostLoginRoute(new URLSearchParams(window.location.search).get('next'))
  }, [])

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    router.prefetch(postLoginRoute)
  }, [postLoginRoute, router])

  useEffect(() => {
    let mounted = true

    const redirectAuthenticatedUser = (nextRole: UserRole) => {
      if (nextRole === 'public' || hasRedirectedRef.current) return
      hasRedirectedRef.current = true
      if (mounted) {
        setRedirecting(true)
        setRole(nextRole)
        setAuthLoading(false)
      }
      router.replace(postLoginRoute)
    }

    async function loadAuth() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!mounted) return

        const nextRole = getUserRole(session?.user?.id ?? null)
        setRole(nextRole)

        if (nextRole !== 'public') {
          redirectAuthenticatedUser(nextRole)
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return

      const nextRole = getUserRole(session?.user?.id ?? null)
      setRole(nextRole)

      if (nextRole !== 'public') {
        redirectAuthenticatedUser(nextRole)
        return
      }

      setRedirecting(false)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [postLoginRoute, router])

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

      setRedirecting(true)
    } catch (err) {
      setRedirecting(false)
      setError(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  const heroShellResponsive: CSSProperties = {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.05fr) minmax(360px, 0.95fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '24px',
  }

  const formGridResponsive: CSSProperties = {
    ...benefitGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  if (authLoading) {
    return (
      <SiteShell active="login">
        <section style={loadingShell}>
          <div style={loadingCard}>Checking sign-in status...</div>
        </section>
      </SiteShell>
    )
  }

  if (role !== 'public' || redirecting) {
    return (
      <SiteShell active="login">
        <section style={loadingShell}>
          <div style={loadingCard}>{submitting ? 'Signing you in...' : 'Redirecting to your workspace...'}</div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="login">
      <section style={heroShellResponsive}>
        <div>
          <div style={eyebrow}>Member access</div>
          <h1 style={{ ...heroTitle, fontSize: isSmallMobile ? '38px' : isMobile ? '46px' : '58px' }}>
            Sign in with your email and password.
          </h1>
          <p style={{ ...heroText, fontSize: isSmallMobile ? '16px' : '18px' }}>
            Access My Lab, Captain tools, followed players and teams, and your private member dashboard.
          </p>

          <div style={pillRow}>
            <span style={pillBlue}>My Players</span>
            <span style={pillBlue}>My Teams</span>
            <span style={pillGreen}>My Leagues</span>
            <span style={pillGreen}>Captain</span>
          </div>

          <div style={featurePanel}>
            <div style={featureLabel}>Member tools</div>
            <div style={formGridResponsive}>
              <FeatureCard
                title="My Lab"
                text="Follow players, teams, and leagues with a personalized activity feed."
              />
              <FeatureCard
                title="Captain’s Corner"
                text="Manage availability, lineups, messaging, and match-week planning."
              />
              <FeatureCard
                title="Saved context"
                text="Keep your team and season context organized in one workspace."
              />
              <FeatureCard
                title="Admin access"
                text="Admins automatically see elevated tools after signing in."
              />
            </div>
          </div>
        </div>

        <div style={loginPanel}>
          <div style={loginPanelGlow} />
          <div style={loginPanelInner}>
            <div style={loginBrandWrap}>
              <div style={{ ...logoOrbWrap, width: isSmallMobile ? '156px' : '188px', height: isSmallMobile ? '156px' : '188px' }}>
                <div style={logoOrbOuter} />
                <div style={{ ...logoOrbMiddle, inset: isSmallMobile ? '12px' : '14px' }} />
                <div
                  style={{
                    ...logoOrbInner,
                    width: isSmallMobile ? '120px' : '142px',
                    height: isSmallMobile ? '120px' : '142px',
                  }}
                >
                  <Image
                    src="/logo-icon.png"
                    alt="TenAceIQ"
                    width={124}
                    height={124}
                    priority
                    style={{
                      width: isSmallMobile ? '92px' : isMobile ? '108px' : '124px',
                      height: isSmallMobile ? '92px' : isMobile ? '108px' : '124px',
                      display: 'block',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </div>

              <div style={{ ...loginBrandText, fontSize: isSmallMobile ? '30px' : '36px' }}>
                <span style={{ color: '#F8FBFF' }}>TenAce</span>
                <span style={brandIQ}>IQ</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={formCard}>
              <div style={formLabel}>Password sign in</div>
              <h2 style={formTitle}>Welcome back</h2>

              <label htmlFor="email" style={inputLabel}>
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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
                  onClick={() => setShowPassword((v) => !v)}
                  style={togglePasswordButton}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <button type="submit" disabled={submitting} style={submitting ? submitButtonDisabled : submitButton}>
                {submitting ? 'Signing in...' : 'Sign in'}
              </button>

              {error ? <div style={errorBanner}>{error}</div> : null}

              <div style={helperRow}>
                <Link href="/join" style={inlineLink}>
                  Create account
                </Link>
                <Link href="/forgot-password" style={inlineLinkMuted}>
                  Forgot password?
                </Link>
              </div>
            </form>

            <div style={footerPrompt}>
              Need the public experience first?{' '}
              <Link href="/explore" style={inlineLink}>
                Explore TA-IQ
              </Link>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  )
}

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={featureCard}>
      <div style={featureTitle}>{title}</div>
      <div style={featureText}>{text}</div>
    </div>
  )
}

function passwordWrapResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...passwordWrap,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'minmax(0, 1fr) auto',
  }
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  marginLeft: '2px',
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1280px',
  margin: '14px auto 24px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(135deg, rgba(26,54,104,0.52) 0%, rgba(17,36,72,0.72) 22%, rgba(12,27,52,0.82) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130,244,118,0.28)',
  background: 'rgba(89,145,73,0.14)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '15px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitle: CSSProperties = {
  margin: '0 0 12px',
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
  fontSize: '58px',
}

const heroText: CSSProperties = {
  margin: '0 0 20px',
  color: 'rgba(224,234,247,0.84)',
  fontSize: '18px',
  lineHeight: 1.6,
  maxWidth: '760px',
}

const pillRow: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '8px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '13px',
  lineHeight: 1,
  fontWeight: 900,
  border: '1px solid transparent',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  background: 'rgba(37,91,227,0.16)',
  color: '#c7dbff',
  borderColor: 'rgba(98,154,255,0.18)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  background: 'rgba(96,221,116,0.14)',
  color: '#dffad5',
  borderColor: 'rgba(130,244,118,0.2)',
}

const featurePanel: CSSProperties = {
  marginTop: '24px',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(10,20,37,0.56)',
  padding: '18px',
  maxWidth: '900px',
}

const featureLabel: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '14px',
}

const benefitGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const featureCard: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
}

const featureTitle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '16px',
  fontWeight: 800,
  lineHeight: 1.35,
}

const featureText: CSSProperties = {
  marginTop: '6px',
  color: 'rgba(224,236,249,0.76)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const loginPanel: CSSProperties = {
  position: 'relative',
  borderRadius: '30px',
  overflow: 'hidden',
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  boxShadow: '0 22px 52px rgba(7,18,40,0.24)',
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

const logoOrbWrap: CSSProperties = {
  position: 'relative',
  width: '188px',
  height: '188px',
  display: 'grid',
  placeItems: 'center',
  margin: '8px auto 12px',
}

const logoOrbOuter: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '999px',
  background:
    'radial-gradient(circle, rgba(116,190,255,0.30) 0%, rgba(116,190,255,0.12) 42%, rgba(116,190,255,0) 74%)',
  filter: 'blur(1px)',
}

const logoOrbMiddle: CSSProperties = {
  position: 'absolute',
  inset: '14px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.28)',
  boxShadow:
    '0 0 0 1px rgba(155,225,29,0.08), inset 0 0 38px rgba(74,163,255,0.18)',
}

const logoOrbInner: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '142px',
  height: '142px',
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  background:
    'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 36%, rgba(8,26,49,0.78) 100%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow:
    '0 18px 38px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(74,163,255,0.08)',
}

const loginBrandText: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'center',
  gap: '2px',
  fontWeight: 900,
  letterSpacing: '-0.05em',
  fontSize: '36px',
  lineHeight: 1,
}

const formCard: CSSProperties = {
  display: 'grid',
  gap: '12px',
  borderRadius: '24px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(9,18,35,0.56)',
  padding: '18px',
}

const formLabel: CSSProperties = {
  color: '#e7ffd0',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const formTitle: CSSProperties = {
  margin: 0,
  color: '#f8fbff',
  fontSize: '28px',
  lineHeight: 1.04,
  fontWeight: 900,
  letterSpacing: '-0.045em',
}

const inputLabel: CSSProperties = {
  color: '#dfe8f7',
  fontSize: '13px',
  fontWeight: 700,
  marginTop: '2px',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: '52px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.04)',
  color: '#f5f8ff',
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
  minHeight: '52px',
  padding: '0 16px',
  borderRadius: '16px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)',
  color: '#e7eefb',
  fontWeight: 800,
  fontSize: '13px',
  cursor: 'pointer',
}

const submitButton: CSSProperties = {
  minHeight: '52px',
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
  color: 'rgba(224,236,249,0.74)',
  fontSize: '14px',
  lineHeight: 1.6,
}

const inlineLink: CSSProperties = {
  color: '#c7dbff',
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
  color: '#eaf4ff',
  background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)',
  border: '1px solid rgba(116,190,255,0.18)',
  fontSize: '15px',
  fontWeight: 700,
}
