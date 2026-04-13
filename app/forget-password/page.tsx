'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { getClientAuthState } from '@/lib/auth'
import SiteShell from '@/app/components/site-shell'

export default function ForgotPasswordPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [screenWidth, setScreenWidth] = useState(1280)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  useEffect(() => {
    const onResize = () => setScreenWidth(window.innerWidth)
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    async function loadAuth() {
      try {
        const authState = await getClientAuthState()
        setRole(authState.role)
      } finally {
        setAuthLoading(false)
      }
    }

    void loadAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      const authState = await getClientAuthState()
      setRole(authState.role)
      setAuthLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedEmail = email.trim()

    if (!trimmedEmail) {
      setError('Enter your email.')
      setMessage('')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const redirectTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/reset-password`
          : undefined

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      })

      if (resetError) throw new Error(resetError.message)

      setMessage('Password reset email sent. Check your inbox for the reset link.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset email.')
    } finally {
      setSubmitting(false)
    }
  }

  const roleLabel = useMemo(() => {
    if (role === 'member') return 'Member access enabled'
    return 'Public access'
  }, [role])

  const heroShellResponsive: CSSProperties = {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.05fr) minmax(360px, 0.95fr)',
    padding: isMobile ? '26px 18px' : '34px 26px',
    gap: isMobile ? '18px' : '24px',
  }

  const infoGridResponsive: CSSProperties = {
    ...infoGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  const logoImageStyle: CSSProperties = {
    width: isMobile ? '108px' : '124px',
    height: isMobile ? '108px' : '124px',
    display: 'block',
    objectFit: 'contain',
  }

  const formPanelInnerResponsive: CSSProperties = {
    ...formPanelInner,
    padding: isMobile ? '20px' : '26px',
  }

  const helperRowResponsive: CSSProperties = {
    ...helperRow,
    flexDirection: isSmallMobile ? 'column' : 'row',
    alignItems: isSmallMobile ? 'flex-start' : 'center',
  }

  if (authLoading) {
    return (
      <SiteShell active="forgot-password">
        <section style={loadingShell}>
          <div style={loadingCard}>Checking account status...</div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="forgot-password">
      <section style={pageWrap}>
        <div style={pageGlowOne} />
        <div style={pageGlowTwo} />

        <section style={heroShellResponsive}>
          <div style={heroLeftColumn}>
            <div style={eyebrow}>Reset access</div>
            <h1 style={heroTitle}>Forgot your password?</h1>
            <p style={heroText}>
              Enter your email and we’ll send you a secure reset link so you can create a new
              password and get back into your member dashboard.
            </p>

            <div style={pillRow}>
              <span style={pillBlue}>Fast reset</span>
              <span style={pillBlue}>Secure access</span>
              <span style={pillGreen}>My Lab</span>
              <span style={pillGreen}>Members</span>
            </div>

            <div style={panelCard}>
              <div style={panelHeader}>
                <div style={panelLabel}>What happens next</div>
                <div style={statusPill}>{roleLabel}</div>
              </div>

              <div style={infoGridResponsive}>
                <InfoCard title="Step 1" text="Enter the email tied to your account." />
                <InfoCard title="Step 2" text="Open the reset email and click the secure link." />
                <InfoCard title="Step 3" text="Create a new password on the reset page." />
                <InfoCard title="Step 4" text="Sign back in and continue using TenAceIQ." />
              </div>
            </div>
          </div>

          <div style={formPanel}>
            <div style={formPanelGlow} />
            <div style={formPanelInnerResponsive}>
              <div style={loginBrandWrap}>
                <div style={logoOrbWrap}>
                  <div style={logoOrbOuter} />
                  <div style={logoOrbMiddle} />
                  <div style={logoOrbInner}>
                    <Image
                      src="/logo-icon.png"
                      alt="TenAceIQ"
                      width={124}
                      height={124}
                      priority
                      style={logoImageStyle}
                    />
                  </div>
                </div>

                <div style={loginBrandText}>
                  <span style={{ color: '#F8FBFF' }}>TenAce</span>
                  <span style={brandIQ}>IQ</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} style={formCard}>
                <div style={formLabel}>Password recovery</div>
                <h2 style={formTitle}>Send reset email</h2>

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
                    setMessage('')
                  }}
                  placeholder="you@example.com"
                  style={inputStyle}
                />

                <button type="submit" disabled={submitting} style={submitButton}>
                  {submitting ? 'Sending...' : 'Send reset link'}
                </button>

                {message ? <div style={successBanner}>{message}</div> : null}
                {error ? <div style={errorBanner}>{error}</div> : null}

                <div style={helperRowResponsive}>
                  <Link href="/login" style={inlineLink}>
                    Back to login
                  </Link>
                  <Link href="/join" style={inlineLinkMuted}>
                    Create account
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </section>
      </section>
    </SiteShell>
  )
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <div style={infoCard}>
      <div style={infoTitle}>{title}</div>
      <div style={infoText}>{text}</div>
    </div>
  )
}

const pageWrap: CSSProperties = {
  position: 'relative',
  width: '100%',
  minHeight: 'calc(100vh - 120px)',
  padding: '12px 0 44px',
  overflow: 'hidden',
}

const pageGlowOne: CSSProperties = {
  position: 'absolute',
  top: '-120px',
  left: '-120px',
  width: '320px',
  height: '320px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(74,163,255,0.18) 0%, transparent 70%)',
  pointerEvents: 'none',
}

const pageGlowTwo: CSSProperties = {
  position: 'absolute',
  right: '-120px',
  top: '80px',
  width: '360px',
  height: '360px',
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(155,225,29,0.10) 0%, transparent 72%)',
  pointerEvents: 'none',
}

const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background:
    'linear-gradient(135deg, rgba(7,29,61,0.96), rgba(7,20,39,0.96) 56%, rgba(18,58,50,0.9) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32)',
}

const heroLeftColumn: CSSProperties = {
  minWidth: 0,
}

const infoGrid: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const loadingShell: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '60vh',
}

const loadingCard: CSSProperties = {
  padding: '20px 24px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.08)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '999px',
  border: '1px solid rgba(155, 225, 29, 0.24)',
  background: 'rgba(155, 225, 29, 0.10)',
  color: '#d8f7a4',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: '16px 0 0',
  color: '#ffffff',
  fontSize: 'clamp(34px, 5vw, 56px)',
  lineHeight: 0.96,
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const heroText: CSSProperties = {
  marginTop: '16px',
  maxWidth: '640px',
  color: 'rgba(229, 238, 251, 0.84)',
  fontSize: '16px',
  lineHeight: 1.75,
}

const pillRow: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginTop: '18px',
}

const pillBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.03em',
}

const pillBlue: CSSProperties = {
  ...pillBase,
  color: '#dbeafe',
  border: '1px solid rgba(96, 165, 250, 0.18)',
  background: 'rgba(10, 28, 52, 0.92)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  color: '#dcfce7',
  border: '1px solid rgba(74, 222, 128, 0.20)',
  background: 'rgba(17, 39, 27, 0.92)',
}

const panelCard: CSSProperties = {
  marginTop: '22px',
  borderRadius: '24px',
  border: '1px solid rgba(116, 190, 255, 0.14)',
  background: 'linear-gradient(180deg, rgba(17,34,63,0.74) 0%, rgba(9,18,34,0.92) 100%)',
  boxShadow: '0 18px 42px rgba(5,12,25,0.18), inset 0 1px 0 rgba(255,255,255,0.04)',
  padding: '18px',
}

const panelHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '10px',
  marginBottom: '12px',
  flexWrap: 'wrap',
}

const panelLabel: CSSProperties = {
  color: '#c5d5ea',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const statusPill: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '7px 10px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: 'rgba(229, 238, 251, 0.84)',
  fontSize: '12px',
  fontWeight: 700,
}

const infoCard: CSSProperties = {
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  padding: '14px 14px',
}

const infoTitle: CSSProperties = {
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 800,
  marginBottom: '6px',
}

const infoText: CSSProperties = {
  color: 'rgba(197, 213, 234, 0.80)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const formPanel: CSSProperties = {
  position: 'relative',
  minHeight: '100%',
  borderRadius: '28px',
  border: '1px solid rgba(116, 190, 255, 0.16)',
  background: 'linear-gradient(180deg, rgba(11,25,48,0.86) 0%, rgba(7,17,31,0.96) 100%)',
  overflow: 'hidden',
  boxShadow: '0 26px 80px rgba(7,18,42,0.24)',
}

const formPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at 50% 0%, rgba(74,163,255,0.16), transparent 36%), radial-gradient(circle at 100% 0%, rgba(155,225,29,0.10), transparent 34%)',
}

const formPanelInner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  padding: '26px',
}

const loginBrandWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '14px',
  marginBottom: '22px',
}

const logoOrbWrap: CSSProperties = {
  position: 'relative',
  width: '148px',
  height: '148px',
  display: 'grid',
  placeItems: 'center',
}

const logoOrbOuter: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '999px',
  background: 'radial-gradient(circle, rgba(74,163,255,0.20) 0%, transparent 70%)',
}

const logoOrbMiddle: CSSProperties = {
  position: 'absolute',
  inset: '10px',
  borderRadius: '999px',
  border: '1px solid rgba(116,190,255,0.22)',
  background: 'rgba(255,255,255,0.03)',
  backdropFilter: 'blur(8px)',
}

const logoOrbInner: CSSProperties = {
  position: 'relative',
  zIndex: 1,
  width: '132px',
  height: '132px',
  borderRadius: '999px',
  display: 'grid',
  placeItems: 'center',
  background: 'linear-gradient(180deg, rgba(20,42,78,0.62) 0%, rgba(11,25,48,0.82) 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const loginBrandText: CSSProperties = {
  fontSize: '32px',
  fontWeight: 900,
  letterSpacing: '-0.05em',
  lineHeight: 1,
}

const brandIQ: CSSProperties = {
  background: 'linear-gradient(180deg, #ecfccb 0%, #bef264 12%, #a3e635 35%, #84cc16 62%, #65a30d 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
}

const formCard: CSSProperties = {
  borderRadius: '22px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  padding: '20px',
}

const formLabel: CSSProperties = {
  color: '#c5d5ea',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const formTitle: CSSProperties = {
  margin: '10px 0 18px',
  color: '#ffffff',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 850,
  letterSpacing: '-0.04em',
}

const inputLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  marginBottom: '10px',
  color: '#c5d5ea',
  fontSize: '14px',
  fontWeight: 700,
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid rgba(116, 190, 255, 0.16)',
  background: 'linear-gradient(180deg, rgba(14,30,58,0.96) 0%, rgba(8,19,38,0.99) 100%)',
  color: '#e5eefb',
  padding: '14px 16px',
  outline: 'none',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 10px 24px rgba(3,10,23,0.12)',
  marginBottom: '16px',
}

const submitButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  minHeight: '48px',
  width: '100%',
  padding: '0 18px',
  borderRadius: '16px',
  fontWeight: 800,
  letterSpacing: '-0.01em',
  cursor: 'pointer',
  border: '1px solid rgba(155, 225, 29, 0.35)',
  background: 'linear-gradient(135deg, #9be11d, #c7f36b)',
  color: '#08111d',
  boxShadow: '0 10px 30px rgba(74, 222, 128, 0.25), 0 0 0 1px rgba(155, 225, 29, 0.18)',
}

const successBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '14px',
  border: '1px solid rgba(74, 222, 128, 0.20)',
  background: 'rgba(17, 39, 27, 0.92)',
  color: '#dcfce7',
  padding: '12px 14px',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
}

const errorBanner: CSSProperties = {
  marginTop: '14px',
  borderRadius: '14px',
  border: '1px solid rgba(248, 113, 113, 0.22)',
  background: 'rgba(69, 10, 10, 0.84)',
  color: '#fecaca',
  padding: '12px 14px',
  fontSize: '14px',
  fontWeight: 700,
  lineHeight: 1.5,
}

const helperRow: CSSProperties = {
  marginTop: '16px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
}

const inlineLink: CSSProperties = {
  color: '#dcebff',
  fontWeight: 700,
  textDecoration: 'none',
}

const inlineLinkMuted: CSSProperties = {
  color: 'rgba(197, 213, 234, 0.78)',
  fontWeight: 700,
  textDecoration: 'none',
}
