'use client'

import Link from 'next/link'
import Image from 'next/image'
import { CSSProperties, FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
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

      setMessage('Password updated successfully. Redirecting to login...')
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
          <h1 style={heroTitle}>Reset your password and get back in.</h1>
          <p style={heroText}>
            Create a new password for your TenAceIQ account. After resetting, you’ll sign in
            again with your email and new password.
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
              <InfoCard title="Use 8+ characters" text="Create a stronger password than your last one." />
              <InfoCard title="Match both fields" text="Your confirmation field must match exactly." />
              <InfoCard title="Save it securely" text="Use your password manager if you have one." />
              <InfoCard title="Sign back in" text="You’ll return to the login page after reset." />
            </div>
          </div>
        </div>

        <div style={formPanel}>
          <div style={formPanelGlow} />
          <div style={formPanelInner}>
            <div style={loginBrandWrap}>
              <div style={logoOrbWrap}>
                <div style={logoOrbOuter} />
                <div style={logoOrbMiddle} />
                <div style={logoOrbInner}>
                  <Image
                    src="/logo-icon-current.png"
                    alt="TenAceIQ"
                    width={124}
                    height={124}
                    priority
                    style={{
                      width: isMobile ? '108px' : '124px',
                      height: isMobile ? '108px' : '124px',
                      display: 'block',
                      objectFit: 'contain',
                    }}
                  />
                </div>
              </div>

              <div style={loginBrandText}>
                <span style={{ color: '#F8FBFF' }}>TenAce</span>
                <span style={brandIQ}>IQ</span>
              </div>
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

              {message ? <div style={successBanner}>{message}</div> : null}
              {error ? <div style={errorBanner}>{error}</div> : null}

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

const brandIQ: CSSProperties = { background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginLeft: '2px' }
const heroShell: CSSProperties = { position: 'relative', zIndex: 2, maxWidth: '1280px', margin: '14px auto 24px', display: 'grid', borderRadius: '34px', border: '1px solid rgba(116,190,255,0.22)', background: 'linear-gradient(135deg, rgba(26,54,104,0.52) 0%, rgba(17,36,72,0.72) 22%, rgba(12,27,52,0.82) 100%)', boxShadow: '0 34px 80px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.07), inset 0 0 80px rgba(88,170,255,0.06)' }
const eyebrow: CSSProperties = { display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', minHeight: '38px', padding: '8px 14px', borderRadius: '999px', border: '1px solid rgba(130,244,118,0.28)', background: 'rgba(89,145,73,0.14)', color: '#d9e7ef', fontWeight: 800, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }
const heroTitle: CSSProperties = { margin: '0 0 12px', color: '#f7fbff', fontWeight: 900, lineHeight: 0.98, letterSpacing: '-0.055em', maxWidth: '760px', fontSize: '58px' }
const heroText: CSSProperties = { margin: '0 0 20px', color: 'rgba(224,234,247,0.84)', fontSize: '18px', lineHeight: 1.6, maxWidth: '760px' }
const pillRow: CSSProperties = { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }
const pillBase: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px', padding: '0 14px', borderRadius: '999px', fontSize: '13px', lineHeight: 1, fontWeight: 900, border: '1px solid transparent' }
const pillBlue: CSSProperties = { ...pillBase, background: 'rgba(37,91,227,0.16)', color: '#c7dbff', borderColor: 'rgba(98,154,255,0.18)' }
const pillGreen: CSSProperties = { ...pillBase, background: 'rgba(96,221,116,0.14)', color: '#dffad5', borderColor: 'rgba(130,244,118,0.2)' }
const panelCard: CSSProperties = { marginTop: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(10,20,37,0.56)', padding: '18px', maxWidth: '900px' }
const panelLabel: CSSProperties = { color: '#e7ffd0', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '14px' }
const infoGrid: CSSProperties = { display: 'grid', gap: '12px' }
const infoCard: CSSProperties = { borderRadius: '18px', padding: '16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }
const infoTitle: CSSProperties = { color: '#f8fbff', fontSize: '16px', fontWeight: 800, lineHeight: 1.35 }
const infoText: CSSProperties = { marginTop: '6px', color: 'rgba(224,236,249,0.76)', fontSize: '14px', lineHeight: 1.6 }
const formPanel: CSSProperties = { position: 'relative', borderRadius: '30px', overflow: 'hidden', border: '1px solid rgba(116,190,255,0.18)', background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)', boxShadow: '0 22px 52px rgba(7,18,40,0.24)' }
const formPanelGlow: CSSProperties = { position: 'absolute', inset: 'auto auto 8px 50%', width: '250px', height: '250px', transform: 'translateX(-50%)', borderRadius: '999px', background: 'radial-gradient(circle, rgba(116,190,255,0.18) 0%, rgba(155,225,29,0.08) 34%, rgba(116,190,255,0) 72%)', pointerEvents: 'none' }
const formPanelInner: CSSProperties = { position: 'relative', zIndex: 1, height: '100%', padding: '22px', display: 'flex', flexDirection: 'column' }
const loginBrandWrap: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '18px' }
const logoOrbWrap: CSSProperties = { position: 'relative', width: '188px', height: '188px', display: 'grid', placeItems: 'center', margin: '8px auto 12px' }
const logoOrbOuter: CSSProperties = { position: 'absolute', inset: 0, borderRadius: '999px', background: 'radial-gradient(circle, rgba(116,190,255,0.30) 0%, rgba(116,190,255,0.12) 42%, rgba(116,190,255,0) 74%)', filter: 'blur(1px)' }
const logoOrbMiddle: CSSProperties = { position: 'absolute', inset: '14px', borderRadius: '999px', border: '1px solid rgba(116,190,255,0.28)', boxShadow: '0 0 0 1px rgba(155,225,29,0.08), inset 0 0 38px rgba(74,163,255,0.18)' }
const logoOrbInner: CSSProperties = { position: 'relative', zIndex: 2, width: '142px', height: '142px', borderRadius: '999px', display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.08), rgba(255,255,255,0.02) 36%, rgba(8,26,49,0.78) 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 18px 38px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(74,163,255,0.08)' }
const loginBrandText: CSSProperties = { display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '2px', fontWeight: 900, letterSpacing: '-0.05em', fontSize: '36px', lineHeight: 1 }
const formCard: CSSProperties = { display: 'grid', gap: '12px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(9,18,35,0.56)', padding: '18px' }
const formLabel: CSSProperties = { color: '#e7ffd0', fontSize: '12px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }
const formTitle: CSSProperties = { margin: 0, color: '#f8fbff', fontSize: '28px', lineHeight: 1.04, fontWeight: 900, letterSpacing: '-0.045em' }
const inputLabel: CSSProperties = { color: '#dfe8f7', fontSize: '13px', fontWeight: 700, marginTop: '2px' }
const inputStyle: CSSProperties = { width: '100%', minHeight: '52px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#f5f8ff', padding: '0 16px', fontSize: '15px', outline: 'none' }
const togglePasswordButton: CSSProperties = { minHeight: '46px', padding: '0 16px', borderRadius: '16px', border: '1px solid rgba(116,190,255,0.22)', background: 'linear-gradient(180deg, rgba(58,115,212,0.22) 0%, rgba(27,62,120,0.18) 100%)', color: '#e7eefb', fontWeight: 800, fontSize: '13px', cursor: 'pointer' }
const submitButton: CSSProperties = { minHeight: '52px', borderRadius: '16px', border: '1px solid rgba(155,225,29,0.34)', background: 'linear-gradient(135deg, #9be11d 0%, #c7f36b 100%)', color: '#08111d', fontWeight: 900, fontSize: '15px', cursor: 'pointer', boxShadow: '0 10px 28px rgba(155,225,29,0.18)' }
const successBanner: CSSProperties = { borderRadius: '16px', padding: '12px 14px', background: 'rgba(96,221,116,0.12)', border: '1px solid rgba(130,244,118,0.18)', color: '#e7ffd0', fontWeight: 700, fontSize: '14px' }
const errorBanner: CSSProperties = { borderRadius: '16px', padding: '12px 14px', background: 'rgba(142, 32, 32, 0.18)', border: '1px solid rgba(255, 122, 122, 0.26)', color: '#ffd7d7', fontWeight: 700, fontSize: '14px' }
const helperRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }
const inlineLink: CSSProperties = { color: '#c7dbff', textDecoration: 'none', fontWeight: 800 }
const inlineLinkMuted: CSSProperties = { color: 'rgba(224,236,249,0.74)', textDecoration: 'none', fontWeight: 700 }
const loadingShell: CSSProperties = { position: 'relative', zIndex: 2, maxWidth: '1280px', margin: '40px auto', padding: '0 24px' }
const loadingCard: CSSProperties = { borderRadius: '22px', padding: '18px 20px', color: '#eaf4ff', background: 'linear-gradient(180deg, rgba(24,49,93,0.68) 0%, rgba(13,26,50,0.92) 100%)', border: '1px solid rgba(116,190,255,0.18)', fontSize: '15px', fontWeight: 700 }
