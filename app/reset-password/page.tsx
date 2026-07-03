'use client'

import Link from 'next/link'
import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import { getAuthEntryNextIntent } from '@/lib/auth-entry-next-intent'
import { buildAuthEntryHref, getAuthEntryPlanId } from '@/lib/auth-entry-hrefs'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const { isMobile, isSmallMobile } = useViewportBreakpoints()
  const selectedPlanId = getAuthEntryPlanId(searchParams.get('plan'))
  const requestedNextRoute = searchParams.get('next')
  const selectedNextRoute = isSafeLocalNextHref(requestedNextRoute, '/login')
  const hasSafeRequestedNext = !!requestedNextRoute && selectedNextRoute === requestedNextRoute
  const nextIntent = getAuthEntryNextIntent(selectedNextRoute)
  const loginHref = buildAuthEntryHref('/login', selectedPlanId, selectedNextRoute, hasSafeRequestedNext)
  const forgotPasswordHref = buildAuthEntryHref('/forget-password', selectedPlanId, selectedNextRoute, hasSafeRequestedNext)

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
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw new Error(updateError.message)

      setMessage('Password updated. Sending you back to login...')
      setTimeout(async () => {
        await supabase.auth.signOut()
        router.push(loginHref)
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.')
    } finally {
      setSubmitting(false)
    }
  }

  const heroShellResponsive: CSSProperties = {
    ...heroShell,
    width: isMobile ? 'min(100% - 20px, 620px)' : 'min(620px, calc(100% - clamp(24px, 5vw, 40px)))',
    gridTemplateColumns: 'minmax(0, 1fr)',
    padding: isMobile ? '18px' : '24px',
    gap: isMobile ? '12px' : '14px',
  }

  const formPanelResponsive: CSSProperties = {
    ...formPanel,
    ...(isMobile
      ? {
          border: 'none',
          background: 'transparent',
          boxShadow: 'none',
          borderRadius: 0,
        }
      : {}),
  }

  const formPanelInnerResponsive: CSSProperties = {
    ...formPanelInner,
    padding: isMobile ? 0 : '22px',
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
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={copyRailStyle}>
          <div style={eyebrow}>Password reset</div>
          <h1 style={{ ...heroTitle, fontSize: isSmallMobile ? '30px' : isMobile ? '34px' : '42px' }}>
            Set your new password.
          </h1>
          <p style={{ ...heroText, fontSize: isSmallMobile ? '15px' : '16px' }}>
            Secure the account, then return to your saved tennis work.
          </p>
          <div style={destinationPillStyle}>Next step: sign back in</div>
          {nextIntent ? (
            <div aria-label="Reset password next action" style={nextIntentStyle}>
              <div style={nextIntentLabelStyle}>{nextIntent.label}</div>
              <div style={nextIntentTitleStyle}>{nextIntent.title}</div>
              <div style={nextIntentBodyStyle}>{nextIntent.body}</div>
            </div>
          ) : null}
        </div>

        <div style={formPanelResponsive}>
          <div style={formPanelGlow} />
          <div style={formPanelInnerResponsive}>
            <form onSubmit={handleSubmit} style={isMobile ? formCardMobile : formCard}>
              <div style={formLabel}>More Tennis. Less Chaos.</div>
              <h2 style={isMobile ? formTitleMobile : formTitle}>Choose new password</h2>

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
                onClick={() => setShowPassword((value) => !value)}
                style={togglePasswordButton}
              >
                {showPassword ? 'Hide passwords' : 'Show passwords'}
              </button>

              <button
                type="submit"
                disabled={submitting || !sessionReady}
                style={submitting || !sessionReady ? submitButtonDisabled : submitButton}
              >
                {submitting ? 'Updating...' : 'Update password'}
              </button>

              {message ? <div role="status" aria-live="polite" style={successBanner}>{message}</div> : null}
              {error ? <div id="reset-pw-error" role="alert" aria-live="assertive" style={errorBanner}>{error}</div> : null}

              <div style={helperRow}>
                <Link href={forgotPasswordHref} style={inlineLink}>
                  Send another reset email
                </Link>
                <Link href={loginHref} style={inlineLinkMuted}>
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
  right: 'clamp(-90px, -7vw, -34px)',
  bottom: 'clamp(-120px, -10vw, -46px)',
  width: 'clamp(220px, 31vw, 430px)',
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const copyRailStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  minWidth: 0,
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

const nextIntentStyle: CSSProperties = {
  display: 'grid',
  gap: '4px',
  minWidth: 0,
  alignSelf: 'flex-start',
  maxWidth: '560px',
  padding: '10px 12px',
  borderRadius: '16px',
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  boxSizing: 'border-box',
}

const nextIntentLabelStyle: CSSProperties = {
  color: 'var(--home-eyebrow-color)',
  fontSize: '11px',
  fontWeight: 900,
  lineHeight: 1.2,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

const nextIntentTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '14px',
  fontWeight: 900,
  lineHeight: 1.18,
  overflowWrap: 'anywhere',
}

const nextIntentBodyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: '13px',
  fontWeight: 700,
  lineHeight: 1.35,
  overflowWrap: 'anywhere',
}

const formPanel: CSSProperties = {
  position: 'relative',
  minWidth: 0,
  borderRadius: '30px',
  overflow: 'hidden',
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(8,13,28,0.62)',
  boxShadow: '0 18px 45px rgba(2,8,23,0.38)',
}

const formPanelGlow: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(180deg, rgba(125,211,252,0.08), transparent 42%), linear-gradient(135deg, transparent 58%, rgba(155,225,29,0.08))',
  pointerEvents: 'none',
}

const formPanelInner: CSSProperties = {
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

const successBanner: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(155,225,29,0.11)',
  border: '1px solid rgba(155,225,29,0.30)',
  color: 'var(--foreground-strong)',
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
  maxWidth: '100%',
  marginTop: '4px',
}

const inlineLink: CSSProperties = {
  color: 'var(--brand-blue-2)',
  textDecoration: 'none',
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

const inlineLinkMuted: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  textDecoration: 'none',
  fontWeight: 700,
  overflowWrap: 'anywhere',
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
}
