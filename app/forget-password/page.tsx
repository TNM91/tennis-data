'use client'

import Link from 'next/link'
import { CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react'
import BrandWordmark from '@/app/components/brand-wordmark'
import { supabase } from '@/lib/supabase'
import { type UserRole } from '@/lib/roles'
import { getClientAuthState } from '@/lib/auth'
import SiteShell from '@/app/components/site-shell'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export default function ForgotPasswordPage() {
  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

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
    if (role === 'admin') return 'Admin access enabled'
    if (role === 'captain') return 'Captain access enabled'
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
                <BrandWordmark compact={isSmallMobile} />
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
                  required
                  aria-required="true"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'reset-error' : message ? 'reset-message' : undefined}
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

                {message ? <div id="reset-message" role="status" aria-live="polite" style={successBanner}>{message}</div> : null}
                {error ? <div id="reset-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}

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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
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
  background: 'var(--shell-panel-bg)',
  color: 'var(--foreground-strong)',
  border: '1px solid var(--shell-panel-border)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '8px 12px',
  borderRadius: '999px',
  border: '1px solid var(--home-eyebrow-border)',
  background: 'var(--home-eyebrow-bg)',
  color: 'var(--home-eyebrow-color)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const heroTitle: CSSProperties = {
  margin: '16px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 'clamp(34px, 5vw, 56px)',
  lineHeight: 0.96,
  fontWeight: 900,
  letterSpacing: '-0.05em',
}

const heroText: CSSProperties = {
  marginTop: '16px',
  maxWidth: '640px',
  color: 'var(--shell-copy-muted)',
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
  color: 'var(--foreground)',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 88%, var(--brand-blue-2) 12%)',
}

const pillGreen: CSSProperties = {
  ...pillBase,
  color: 'var(--foreground)',
  border: '1px solid color-mix(in srgb, var(--brand-green) 24%, var(--shell-panel-border) 76%)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 84%, var(--brand-green) 16%)',
}

const panelCard: CSSProperties = {
  marginTop: '22px',
  borderRadius: '24px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
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
  color: 'var(--brand-blue-2)',
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
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground)',
  fontSize: '12px',
  fontWeight: 700,
}

const infoCard: CSSProperties = {
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-chip-bg) 90%, var(--foreground) 10%)',
  padding: '14px 14px',
}

const infoTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 800,
  marginBottom: '6px',
}

const infoText: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  lineHeight: 1.6,
}

const formPanel: CSSProperties = {
  position: 'relative',
  minHeight: '100%',
  borderRadius: '28px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-card)',
}

const formPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background:
    'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--brand-blue-2) 18%, transparent), transparent 36%), radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--brand-green) 12%, transparent), transparent 34%)',
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

const formCard: CSSProperties = {
  borderRadius: '22px',
  border: '1px solid var(--shell-panel-border)',
  background: 'color-mix(in srgb, var(--shell-panel-bg) 90%, var(--foreground) 10%)',
  padding: '20px',
}

const formLabel: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: '12px',
  fontWeight: 800,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const formTitle: CSSProperties = {
  margin: '10px 0 18px',
  color: 'var(--foreground-strong)',
  fontSize: '28px',
  lineHeight: 1.05,
  fontWeight: 850,
  letterSpacing: '-0.04em',
}

const inputLabel: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  marginBottom: '10px',
  color: 'var(--foreground)',
  fontSize: '14px',
  fontWeight: 700,
}

const inputStyle: CSSProperties = {
  width: '100%',
  borderRadius: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '14px 16px',
  outline: 'none',
  boxShadow: 'var(--home-control-shadow)',
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
  color: 'var(--brand-blue-2)',
  fontWeight: 700,
  textDecoration: 'none',
}

const inlineLinkMuted: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontWeight: 700,
  textDecoration: 'none',
}
