'use client'

import { useState, type CSSProperties } from 'react'
import {
  getIssueTypeLabel,
  submitMatchAccuracyReport,
  type MatchAccuracyIssueType,
} from '@/lib/match-accuracy-reports'

type MatchAccuracyReportButtonProps = {
  matchId: string
  reporterPlayerName?: string
  matchLabel: string
  context?: Record<string, unknown>
}

const issueTypes: MatchAccuracyIssueType[] = [
  'wrong_player',
  'wrong_score',
  'wrong_winner',
  'wrong_team',
  'duplicate_match',
  'missing_match',
  'other',
]

export default function MatchAccuracyReportButton({
  matchId,
  reporterPlayerName = '',
  matchLabel,
  context = {},
}: MatchAccuracyReportButtonProps) {
  const [open, setOpen] = useState(false)
  const [issueType, setIssueType] = useState<MatchAccuracyIssueType>('wrong_score')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submitReport() {
    if (saving) return
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await submitMatchAccuracyReport({
        matchId,
        reporterPlayerName,
        issueType,
        description,
        context: {
          matchLabel,
          ...context,
        },
      })
      setMessage('Report sent to admins.')
      setDescription('')
      window.setTimeout(() => setOpen(false), 900)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send this report.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        Report issue
      </button>

      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Report match accuracy issue" style={overlayStyle}>
          <div style={dialogStyle}>
            <div style={headerStyle}>
              <div>
                <div style={kickerStyle}>Match accuracy</div>
                <h2 style={titleStyle}>Report an issue</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={closeButtonStyle} aria-label="Close report dialog">
                X
              </button>
            </div>

            <p style={copyStyle}>{matchLabel}</p>

            <label htmlFor={`accuracy-type-${matchId}`} style={labelStyle}>What looks wrong?</label>
            <select
              id={`accuracy-type-${matchId}`}
              value={issueType}
              onChange={(event) => setIssueType(event.target.value as MatchAccuracyIssueType)}
              style={selectStyle}
            >
              {issueTypes.map((type) => (
                <option key={type} value={type}>{getIssueTypeLabel(type)}</option>
              ))}
            </select>

            <label htmlFor={`accuracy-note-${matchId}`} style={labelStyle}>Details for admins</label>
            <textarea
              id={`accuracy-note-${matchId}`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              style={textareaStyle}
              placeholder="Example: I played this match, but the winner or score is wrong."
            />

            {message ? <div style={successStyle}>{message}</div> : null}
            {error ? <div style={errorStyle}>{error}</div> : null}

            <div style={actionRowStyle}>
              <button type="button" onClick={() => setOpen(false)} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button type="button" onClick={() => void submitReport()} disabled={saving || description.trim().length < 8} style={{ ...primaryButtonStyle, ...((saving || description.trim().length < 8) ? disabledStyle : {}) }}>
                {saving ? 'Sending...' : 'Send report'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '32px',
  padding: '0 10px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  fontSize: '12px',
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 80,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 18,
  background: 'rgba(3, 10, 24, 0.62)',
}

const dialogStyle: CSSProperties = {
  width: 'min(100%, 520px)',
  borderRadius: 22,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg-strong)',
  boxShadow: 'var(--shadow-card)',
  padding: 20,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
}

const kickerStyle: CSSProperties = {
  color: 'var(--brand-blue-2)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const titleStyle: CSSProperties = {
  margin: '6px 0 0',
  color: 'var(--foreground-strong)',
  fontSize: 24,
  fontWeight: 900,
}

const closeButtonStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  cursor: 'pointer',
  fontWeight: 900,
}

const copyStyle: CSSProperties = {
  color: 'var(--shell-copy-muted)',
  lineHeight: 1.55,
  margin: '14px 0',
}

const labelStyle: CSSProperties = {
  display: 'block',
  color: 'var(--foreground-strong)',
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '14px 0 8px',
}

const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: '0 12px',
  colorScheme: 'normal',
}

const textareaStyle: CSSProperties = {
  width: '100%',
  borderRadius: 14,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  padding: 12,
  lineHeight: 1.55,
  resize: 'vertical',
  colorScheme: 'normal',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  flexWrap: 'wrap',
  marginTop: 16,
}

const primaryButtonStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid color-mix(in srgb, var(--brand-green) 34%, var(--shell-panel-border) 66%)',
  background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-chip-bg) 82%)',
  color: 'var(--foreground-strong)',
  fontWeight: 900,
  cursor: 'pointer',
}

const secondaryButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
}

const disabledStyle: CSSProperties = {
  opacity: 0.55,
  cursor: 'not-allowed',
}

const successStyle: CSSProperties = {
  marginTop: 12,
  color: 'var(--foreground-strong)',
  background: 'rgba(155,225,29,0.10)',
  border: '1px solid rgba(155,225,29,0.24)',
  borderRadius: 12,
  padding: '10px 12px',
  fontWeight: 800,
}

const errorStyle: CSSProperties = {
  ...successStyle,
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(248,113,113,0.24)',
}
