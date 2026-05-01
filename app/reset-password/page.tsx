'use client'

import Link from 'next/link'
import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BrandWordmark from '@/app/components/brand-wordmark'
import SiteShell from '@/app/components/site-shell'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    async function loadSession() {
      try {
        const { data } = await supabase.auth.getSession()
        setSessionReady(Boolean(data.session))
      } finally {
        setChecking(false)
      }
    }

    loadSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true)
      }
      setChecking(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!password) {
      setError('Enter a new password.')
      setMessage('')
      return
    }

    if (password.length < 8) {
      setError('Use at least 8 characters for your password.')
      setMessage('')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      setMessage('')
      return
    }

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw new Error(error.message)

      setMessage('Password updated. Redirecting to login...')
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push('/login')
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.')
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

  const infoGridResponsive: CSSProperties = {
    ...infoGrid,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }

  if (checking) {
    return (
      <SiteShell active="reset-password">
        <section style={loadingShell}>
          <div style={loadingCard}>Preparing reset session...</div>
        </section>
      </SiteShell>
    )
  }

  return (
    <SiteShell active="reset-password">
      <section style={heroShellResponsive}>
        <div>
          <div style={eyebrow}>New password</div>
          <h1 style={heroTitle}>Create a new password.</h1>
          <p style={heroText}>
            Update your password, then sign in again and return to your TenAceIQ workspace.
          </p>

          <div style={pillRow}>
            <span style={pillBlue}>Secure reset</span>
            <span style={pillBlue}>Password update</span>
            <span style={pillGreen}>My Lab</span>
            <span style={pillGreen}>Captain</span>
          </div>

          <div style={panelCard}>
            <div style={panelLabel}>Reset checklist</div>
            <div style={infoGridResponsive}>
              <InfoCard title="8+ characters" text="Use at least 8 characters." />
              <InfoCard title="Match fields" text="Both password fields must match." />
              <InfoCard title="Save it" text="Use your password manager if you have one." />
              <InfoCard title="Sign in" text="You will return to login after reset." />
            </div>
          </div>
        </div>

        <div style={formPanel}>
          <div style={formPanelGlow} />
          <div style={formPanelInner}>
            <div style={loginBrandWrap}>
              <BrandWordmark compact={isSmallMobile} />
            </div>

            <form onSubmit={handleSubmit} style={formCard}>
              <div style={formLabel}>Reset password</div>
              <h2 style={formTitle}>Create a new password</h2>

              {!sessionReady ? (
                <div style={errorBanner}>
                  No active reset session was found. Open the reset link from your email again.
                </div>
              ) : null}

              <label htmlFor="password" style={inputLabel}>
                New password
              </label>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-pw-error' : undefined}
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
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                aria-required="true"
                aria-invalid={!!error}
                aria-describedby={error ? 'reset-pw-error' : undefined}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  setError('')
                  setMessage('')
                }}
                placeholder="Re-enter your password"
                style={inputStyle}
              />

              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={togglePasswordButton}
              >
                {showPassword ? 'Hide passwords' : 'Show passwords'}
              </button>

              <button
                type="submit"
                disabled={submitting || !sessionReady}
                style={submitButton}
              >
                {submitting ? 'Updating...' : 'Update password'}
              </button>

              {message ? <div role="status" aria-live="polite" style={successBanner}>{message}</div> : null}
              {error ? <div id="reset-pw-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}

              <div style={helperRow}>
                <Link href="/forget-password" style={inlineLink}>
                  Send another reset email
                </Link>
                <Link href="/login" style={inlineLinkMuted}>
                  Back to login
                </Link>
              </div>
            </form>
          </div>
        </div>
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

const heroShell: CSSProperties = { position: 'relative', zIndex: 2, maxWidth: '1280px', margin: '14px auto 24px', display: 'grid', borderRadius: '34px', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg-strong)', boxShadow: 'var(--shadow-card)' }
const eyebrow: CSSProperties = { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: '38px', padding: '8px 14px', borderRadius: '999px', border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)', background: 'color-mix(in srgb, var(--brand-lime) 10%, var(--shell-chip-bg) 90%)', color: 'var(--home-eyebrow-color)', fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }
const heroTitle: CSSProperties = { margin: '0 0 12px', color: 'var(--foreground-strong)', fontWeight: 900, lineHeight: 0.98, letterSpacing: 0, maxWidth: '760px', fontSize: '58px' }
const heroText: CSSProperties = { margin: '0 0 20px', color: 'var(--shell-copy-muted)', fontSize: '18px', lineHeight: 1.6, maxWidth: '760px' }
const pillRow: CSSProperties = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }
const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px', padding: '0 14px', borderRadius: '999px', fontSize: '13px', lineHeight: 1, fontWeight: 900 }
const pillBlue: CSSProperties = { ...pillBase, background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)', color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-blue-2) 22%, var(--shell-panel-border) 78%)' }
const pillGreen: CSSProperties = { ...pillBase, background: 'color-mix(in srgb, var(--brand-lime) 11%, var(--shell-chip-bg) 89%)', color: 'var(--foreground-strong)', border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)' }
const panelCard: CSSProperties = { marginTop: '24px', borderRadius: '24px', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', padding: '18px', maxWidth: '900px', boxShadow: 'var(--shadow-soft)' }
const panelLabel: CSSProperties = { color: 'var(--home-eyebrow-color)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }
const infoGrid: CSSProperties = { display: 'grid', gap: '12px' }
const infoCard: CSSProperties = { borderRadius: '18px', padding: '16px', background: 'var(--shell-chip-bg)', border: '1px solid var(--shell-panel-border)' }
const infoTitle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: '16px', fontWeight: 800, lineHeight: 1.35 }
const infoText: CSSProperties = { marginTop: '6px', color: 'var(--shell-copy-muted)', fontSize: '14px', lineHeight: 1.6 }
const formPanel: CSSProperties = { position: 'relative', borderRadius: '30px', overflow: 'hidden', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', boxShadow: 'var(--shadow-card)' }
const formPanelGlow: CSSProperties = { position: 'absolute', inset: 'auto auto 8px 50%', width: '250px', height: '250px', transform: 'translateX(-50%)', borderRadius: '999px', background: 'radial-gradient(circle, rgba(116,190,255,0.18) 0%, rgba(155,225,29,0.08) 34%, rgba(116,190,255,0) 72%)', pointerEvents: 'none' }
const formPanelInner: CSSProperties = { position: 'relative', zIndex: 1, height: '100%', padding: '22px', display: 'flex', flexDirection: 'column' }
const loginBrandWrap: CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', marginBottom: '18px', minHeight: '64px' }
const formCard: CSSProperties = { display: 'grid', gap: '12px', borderRadius: '24px', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', padding: '18px' }
const formLabel: CSSProperties = { color: 'var(--home-eyebrow-color)', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }
const formTitle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: '28px', lineHeight: 1.04, fontWeight: 900, letterSpacing: 0 }
const inputLabel: CSSProperties = { color: 'var(--foreground)', fontSize: '13px', fontWeight: 700, marginTop: '2px' }
const inputStyle: CSSProperties = { width: '100%', minHeight: '52px', borderRadius: '16px', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', padding: '0 16px', fontSize: '15px', outline: 'none', boxShadow: 'var(--home-control-shadow)' }
const togglePasswordButton: CSSProperties = { minHeight: '46px', padding: '0 16px', borderRadius: '16px', border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', color: 'var(--foreground-strong)', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }
const submitButton: CSSProperties = { minHeight: '52px', borderRadius: '16px', border: '1px solid color-mix(in srgb, var(--brand-lime) 30%, var(--shell-panel-border) 70%)', background: 'linear-gradient(135deg, var(--brand-lime) 0%, #c7f36b 100%)', color: 'var(--text-dark)', fontWeight: 900, fontSize: '15px', cursor: 'pointer', boxShadow: '0 10px 28px color-mix(in srgb, var(--brand-lime) 18%, transparent)' }
const successBanner: CSSProperties = { borderRadius: '16px', padding: '12px 14px', background: 'color-mix(in srgb, var(--brand-lime) 11%, var(--shell-chip-bg) 89%)', border: '1px solid color-mix(in srgb, var(--brand-lime) 24%, var(--shell-panel-border) 76%)', color: 'var(--foreground-strong)', fontWeight: 700, fontSize: '14px' }
const errorBanner: CSSProperties = { borderRadius: '16px', padding: '12px 14px', background: 'color-mix(in srgb, #7f1d1d 14%, var(--shell-chip-bg) 86%)', border: '1px solid color-mix(in srgb, #f87171 26%, var(--shell-panel-border) 74%)', color: 'color-mix(in srgb, #f87171 72%, var(--foreground-strong) 28%)', fontWeight: 700, fontSize: '14px' }
const helperRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }
const inlineLink: CSSProperties = { color: 'var(--foreground)', textDecoration: 'none', fontWeight: 800 }
const inlineLinkMuted: CSSProperties = { color: 'var(--shell-copy-muted)', textDecoration: 'none', fontWeight: 700 }
const loadingShell: CSSProperties = { position: 'relative', zIndex: 2, maxWidth: '1280px', margin: '40px auto', padding: '0 24px' }
const loadingCard: CSSProperties = { borderRadius: '22px', padding: '18px 20px', color: 'var(--foreground-strong)', background: 'var(--shell-panel-bg)', border: '1px solid var(--shell-panel-border)', fontSize: '15px', fontWeight: 700 }
