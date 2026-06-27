'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react'
import SiteShell from '@/app/components/site-shell'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { getPlayerDevelopmentIdentity, getPlayerDevelopmentIdentityActionRead } from '@/lib/player-development'
import { loadTiqTournamentRecord, type TiqTournamentRecord } from '@/lib/tiq-tournament-registry'

export const dynamic = 'force-dynamic'

const TOURNAMENT_ALERT_PLAYER_IDENTITY = getPlayerDevelopmentIdentity('pressure-closer-4-0')
const TOURNAMENT_ALERT_PLAYER_IDENTITY_READ = getPlayerDevelopmentIdentityActionRead(TOURNAMENT_ALERT_PLAYER_IDENTITY)
const TOURNAMENT_ALERT_LEVEL_UP_HREF = `/level-up/${TOURNAMENT_ALERT_PLAYER_IDENTITY.slug}#level-up-flow`
const TOURNAMENT_ALERT_PLAYER_DEVELOPMENT_HREF = `/player-development/${TOURNAMENT_ALERT_PLAYER_IDENTITY.slug}`
const tournamentAlertPlayerIdActions = [
  { href: TOURNAMENT_ALERT_LEVEL_UP_HREF, label: 'Start Level Up' },
  { href: TOURNAMENT_ALERT_PLAYER_DEVELOPMENT_HREF, label: 'Read Player ID' },
  { href: '/matchup', label: 'Prep matchup' },
] as const

export default function TournamentPreferencesPage() {
  return (
    <SiteShell active="/league-coordinator">
      <TournamentPreferencesInner />
    </SiteShell>
  )
}

function TournamentPreferencesInner() {
  const params = useParams<{ id: string }>()
  const tournamentId = decodeURIComponent(params?.id || '')
  const [record, setRecord] = useState<TiqTournamentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [playerName, setPlayerName] = useState('')
  const [phone, setPhone] = useState('')
  const [smsOptIn, setSmsOptIn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [preferenceReceipt, setPreferenceReceipt] = useState<{
    status: 'on' | 'off'
    phone: string
    savedAt: string
  } | null>(null)
  const phoneReady = phone.trim().length >= 7
  const nameReady = playerName.trim().length > 1
  const consentSteps = [
    {
      label: 'Name',
      value: nameReady ? 'Matched' : 'Needed',
      ready: nameReady,
    },
    {
      label: 'Phone',
      value: phoneReady ? 'Ready' : 'Needed',
      ready: phoneReady,
    },
    {
      label: 'Choice',
      value: smsOptIn ? 'Texts on' : 'Texts off',
      ready: true,
    },
  ]

  useEffect(() => {
    let active = true

    async function loadRecord() {
      setLoading(true)
      const result = await loadTiqTournamentRecord(tournamentId)
      if (!active) return
      setRecord(result.data)
      setLoading(false)
    }

    void loadRecord()

    return () => {
      active = false
    }
  }, [tournamentId])

  async function submitPreference(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setNotice('')

    try {
      const response = await fetch('/api/tournaments/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentId,
          playerName,
          phone,
          smsOptIn,
        }),
      })
      const body = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null
      if (!response.ok || !body?.ok) throw new Error(body?.message || 'Preference could not be saved.')
      setNotice(body.message || 'Preference saved.')
      setPreferenceReceipt({
        status: smsOptIn ? 'on' : 'off',
        phone,
        savedAt: new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
      })
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Preference could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main style={pageStyle}>
      <section style={panelStyle}>
        <span aria-hidden="true" style={watermarkStyle} />
        <div style={headerStyle}>
          <TiqFeatureIcon name="messagingCenter" size="lg" variant="surface" />
          <div>
            <div style={eyebrowStyle}>Tournament Alerts</div>
            <h1 style={titleStyle}>{loading ? 'Loading preferences.' : record?.name || 'Manage text alerts.'}</h1>
            <p style={textStyle}>Use the same name and phone number from your tournament entry. Changes are saved for this tournament only.</p>
          </div>
        </div>

        <div style={consentGridStyle} aria-label="Text alert consent checklist">
          {consentSteps.map((step) => (
            <div key={step.label} style={consentStepStyle}>
              <span style={step.ready ? readinessDotReadyStyle : readinessDotWaitingStyle} />
              <strong>{step.label}</strong>
              <em>{step.value}</em>
            </div>
          ))}
        </div>

        <section style={alertPlayerIdStyle} aria-label="Tournament alerts Player ID follow-through">
          <div style={alertPlayerIdCopyStyle}>
            <span style={alertPlayerIdEyebrowStyle}>Alerts to Player ID</span>
            <strong style={alertPlayerIdTitleStyle}>Texts tell you what changed. Player ID tells you what to train next.</strong>
            <span style={alertPlayerIdTextStyle}>
              {TOURNAMENT_ALERT_PLAYER_IDENTITY_READ.levelUpNudge} After court alerts or results land, keep one pressure cue ready.
            </span>
          </div>
          <div style={alertPlayerIdSignalGridStyle} aria-label="Tournament alerts Player ID starter read">
            <span style={alertPlayerIdSignalStyle}>
              <em>Read</em>
              <strong>{TOURNAMENT_ALERT_PLAYER_IDENTITY_READ.matchTrigger}</strong>
            </span>
            <span style={alertPlayerIdSignalStyle}>
              <em>Proof</em>
              <strong>{TOURNAMENT_ALERT_PLAYER_IDENTITY_READ.proofTarget}</strong>
            </span>
          </div>
          <div style={alertPlayerIdActionRowStyle}>
            {tournamentAlertPlayerIdActions.map((action, index) => (
              <Link
                key={action.href}
                href={action.href}
                style={index === 0 ? { ...alertPlayerIdActionStyle, ...alertPlayerIdPrimaryActionStyle } : alertPlayerIdActionStyle}
              >
                {action.label}
              </Link>
            ))}
          </div>
        </section>

        <form style={formStyle} onSubmit={submitPreference}>
          <label style={fieldStyle}>
            Name
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              onFocus={() => setFocusedField('name')}
              onBlur={() => setFocusedField(null)}
              style={{
                ...inputStyle,
                ...(focusedField === 'name' ? inputFocusStyle : null),
              }}
            />
          </label>
          <label style={fieldStyle}>
            Phone
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              onFocus={() => setFocusedField('phone')}
              onBlur={() => setFocusedField(null)}
              placeholder="(555) 555-5555"
              style={{
                ...inputStyle,
                ...(focusedField === 'phone' ? inputFocusStyle : null),
              }}
            />
          </label>
          <label style={toggleStyle}>
            <input type="checkbox" checked={smsOptIn} onChange={(event) => setSmsOptIn(event.target.checked)} />
            <span style={toggleCopyStyle}>
              <strong>{smsOptIn ? 'Alerts on' : 'Alerts off'}</strong>
              <small>{smsOptIn ? 'Court alerts, rules, schedule changes, and recaps may arrive by text.' : 'Save this way to stop tournament texts.'}</small>
            </span>
          </label>
          <div style={complianceNoteStyle}>
            Every text includes a TenAceIQ link and opt-out language. Reply STOP anytime.
          </div>
          <button type="submit" disabled={saving} style={{ ...buttonStyle, ...(saving ? disabledButtonStyle : null) }}>
            {saving ? 'Saving...' : smsOptIn ? 'Turn alerts on' : 'Turn alerts off'}
          </button>
          {notice ? <div style={noticeStyle}>{notice}</div> : null}
        </form>

        {preferenceReceipt ? (
          <div style={receiptStyle} aria-live="polite">
            <div style={receiptHeaderStyle}>
              <TiqFeatureIcon name="messagingCenter" size="sm" variant="ghost" />
              <div>
                <strong>{preferenceReceipt.status === 'on' ? 'Tournament alerts are on' : 'Tournament alerts are off'}</strong>
                <span>{preferenceReceipt.savedAt}</span>
              </div>
            </div>
            <div style={receiptGridStyle}>
              <span>{preferenceReceipt.phone || 'Phone saved'}</span>
              <span>{record?.name || 'This tournament'} only</span>
              <span>Reply STOP anytime</span>
            </div>
          </div>
        ) : null}

        <div style={footerActionStyle}>
          <Link href={`/tournaments/${encodeURIComponent(tournamentId)}`} style={secondaryButtonStyle}>
            Back to tournament
          </Link>
        </div>
      </section>
    </main>
  )
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  padding: 'clamp(14px, 3vw, 28px)',
  background: 'var(--background)',
  color: 'var(--foreground-strong)',
}

const panelStyle: CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  display: 'grid',
  gap: 18,
  maxWidth: 760,
  margin: '0 auto',
  padding: 'clamp(18px, 4vw, 34px)',
  borderRadius: 24,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(135deg, rgba(12,25,45,0.96), rgba(7,16,31,0.98))',
  boxShadow: '0 24px 80px rgba(0,0,0,0.24)',
}

const watermarkStyle: CSSProperties = {
  position: 'absolute',
  right: -80,
  bottom: -120,
  width: 320,
  aspectRatio: '1045 / 490',
  background: 'url("/tiq/logo/tiq-mark-light.png") center / contain no-repeat',
  opacity: 0.14,
  pointerEvents: 'none',
}

const headerStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  gap: 14,
  alignItems: 'center',
  minWidth: 0,
}

const eyebrowStyle: CSSProperties = {
  color: 'var(--accent-blue)',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
  letterSpacing: 1.8,
}

const titleStyle: CSSProperties = {
  margin: '6px 0',
  fontSize: 'clamp(34px, 6vw, 58px)',
  lineHeight: 0.96,
  letterSpacing: 0,
}

const textStyle: CSSProperties = {
  margin: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 15,
  lineHeight: 1.5,
  fontWeight: 750,
}

const formStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
}

const consentGridStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const consentStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto minmax(0, 1fr) auto',
  gap: 8,
  alignItems: 'center',
  minWidth: 0,
  padding: 10,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'rgba(15,23,42,0.50)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const alertPlayerIdStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  overflow: 'hidden',
  overflowWrap: 'anywhere',
}

const alertPlayerIdCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
}

const alertPlayerIdEyebrowStyle: CSSProperties = {
  color: 'var(--brand-lime)',
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: 0,
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const alertPlayerIdTitleStyle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: 14,
  lineHeight: 1.3,
  fontWeight: 950,
  overflowWrap: 'anywhere',
}

const alertPlayerIdTextStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const alertPlayerIdSignalGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))',
  gap: 8,
  minWidth: 0,
}

const alertPlayerIdSignalStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  minHeight: 62,
  padding: 9,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'rgba(15,23,42,0.42)',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const alertPlayerIdActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-start',
  gap: 8,
  minWidth: 0,
}

const alertPlayerIdActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  maxWidth: '100%',
  minHeight: 36,
  minWidth: 0,
  padding: '8px 11px',
  borderRadius: 12,
  border: '1px solid rgba(116,190,255,0.15)',
  background: 'rgba(7,17,33,0.72)',
  color: '#eef5ff',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 950,
  textAlign: 'center',
  whiteSpace: 'normal',
  overflowWrap: 'anywhere',
}

const alertPlayerIdPrimaryActionStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.14)',
  color: '#f5ffe2',
}

const readinessDotReadyStyle: CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: '50%',
  background: 'var(--brand-lime)',
  boxShadow: '0 0 0 4px rgba(155,225,29,0.10)',
}

const readinessDotWaitingStyle: CSSProperties = {
  ...readinessDotReadyStyle,
  background: 'rgba(116,190,255,0.46)',
  boxShadow: '0 0 0 4px rgba(116,190,255,0.08)',
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  color: 'var(--accent-blue)',
  fontSize: 12,
  fontWeight: 950,
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(15,23,42,0.72)',
  color: 'var(--foreground-strong)',
  fontSize: 15,
  fontWeight: 850,
  outline: '2px solid transparent',
  outlineOffset: 2,
  boxSizing: 'border-box',
}

const inputFocusStyle: CSSProperties = {
  borderColor: 'rgba(155,225,29,0.45)',
  outline: '2px solid rgba(155,225,29,0.42)',
  boxShadow: '0 0 0 5px rgba(155,225,29,0.12)',
}

const toggleStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.18)',
  background: 'rgba(155,225,29,0.07)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
}

const toggleCopyStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  minWidth: 0,
  lineHeight: 1.35,
}

const complianceNoteStyle: CSSProperties = {
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 850,
  overflowWrap: 'anywhere',
}

const footerActionStyle: CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
  minWidth: 0,
}

const secondaryButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 42,
  maxWidth: '100%',
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.20)',
  background: 'rgba(116,190,255,0.10)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 950,
}

const buttonStyle: CSSProperties = {
  minHeight: 46,
  padding: '0 18px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.36)',
  background: 'rgba(155,225,29,0.2)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  cursor: 'pointer',
}

const disabledButtonStyle: CSSProperties = {
  opacity: 0.6,
  cursor: 'not-allowed',
}

const noticeStyle: CSSProperties = {
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.18)',
  background: 'rgba(116,190,255,0.08)',
  color: 'var(--foreground-strong)',
  fontSize: 13,
  fontWeight: 850,
}

const receiptStyle: CSSProperties = {
  position: 'relative',
  display: 'grid',
  gap: 12,
  minWidth: 0,
  padding: 14,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.075)',
  color: 'var(--foreground-strong)',
}

const receiptHeaderStyle: CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  minWidth: 0,
  fontSize: 14,
  fontWeight: 950,
}

const receiptGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 150px), 1fr))',
  gap: 8,
  minWidth: 0,
  color: 'var(--shell-copy-muted)',
  fontSize: 12,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}
