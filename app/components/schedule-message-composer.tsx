'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import {
  createCaptainPracticeThread,
  createTiqLeagueScheduleThread,
  previewCaptainPracticeRecipients,
} from '@/lib/internal-scheduling'
import type { TiqLeagueScheduleFormat } from '@/lib/tiq-league-schedule-service'

type ScheduleComposerMode = 'tiq-league-match' | 'captain-practice'

export default function ScheduleMessageComposer({
  mode,
  triggerLabel,
  leagueId = '',
  leagueName = '',
  leagueFormat = 'individual',
  participantAName = '',
  participantAId = '',
  participantBName = '',
  participantBId = '',
  participantNames = [],
  participantPlayerIds = [],
  teamName = '',
  flight = '',
  defaultDate = '',
  defaultTime = '',
  defaultFacility = '',
}: {
  mode: ScheduleComposerMode
  triggerLabel: string
  leagueId?: string
  leagueName?: string
  leagueFormat?: TiqLeagueScheduleFormat
  participantAName?: string
  participantAId?: string
  participantBName?: string
  participantBId?: string
  participantNames?: string[]
  participantPlayerIds?: string[]
  teamName?: string
  flight?: string
  defaultDate?: string
  defaultTime?: string
  defaultFacility?: string
}) {
  const [open, setOpen] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(defaultDate)
  const [scheduledTime, setScheduledTime] = useState(defaultTime)
  const [facility, setFacility] = useState(defaultFacility)
  const [recurrenceRule, setRecurrenceRule] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [recipientPreview, setRecipientPreview] = useState<{
    rosterCount: number
    linkedParticipantCount: number
    linkedRecipientNames: string[]
    unlinkedRosterNames: string[]
  } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!open) {
      setScheduledDate(defaultDate)
      setScheduledTime(defaultTime)
      setFacility(defaultFacility)
      setRecurrenceRule('')
      setNotes('')
      setConversationId('')
      setStatus('')
      setError('')
      setRecipientPreview(null)
      setPreviewLoading(false)
    }
  }, [defaultDate, defaultFacility, defaultTime, open])

  useEffect(() => {
    if (!open || mode !== 'captain-practice' || !teamName) return
    let active = true
    setPreviewLoading(true)
    previewCaptainPracticeRecipients({ teamName, leagueName, flight })
      .then((preview) => {
        if (active) setRecipientPreview(preview)
      })
      .catch(() => {
        if (active) setRecipientPreview(null)
      })
      .finally(() => {
        if (active) setPreviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [flight, leagueName, mode, open, teamName])

  async function submitSchedule() {
    if (saving) return
    setSaving(true)
    setError('')
    setStatus('')

    try {
      if (!scheduledDate) throw new Error('Choose a date first.')

      if (mode === 'tiq-league-match') {
        if (!leagueId || !participantAName || !participantBName) {
          throw new Error('Choose both league participants before scheduling.')
        }
        const result = await createTiqLeagueScheduleThread({
          leagueId,
          leagueName,
          leagueFormat,
          participantAName,
          participantAId,
          participantBName,
          participantBId,
          scheduledDate,
          scheduledTime,
          facility,
          notes,
          participantNames,
          participantPlayerIds,
        })
        setConversationId(result.conversationId)
        setStatus(result.warning || 'Match scheduled and message thread opened.')
      } else {
        if (!teamName) throw new Error('Choose a team before scheduling practice.')
        const result = await createCaptainPracticeThread({
          teamName,
          leagueName,
          flight,
          scheduledDate,
          scheduledTime,
          facility,
          recurrenceRule,
          notes,
        })
        setConversationId(result.conversationId)
        setStatus(
          result.linkedParticipantCount > 0
            ? `Practice thread opened for ${result.linkedParticipantCount} linked player account${result.linkedParticipantCount === 1 ? '' : 's'}.`
            : 'Practice thread opened. Link player profiles to capture individual RSVPs.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedule could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const title = mode === 'tiq-league-match' ? 'Schedule through Messages' : 'Schedule practice'

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        {triggerLabel}
      </button>
      {open ? (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={title}>
          <div style={drawerStyle}>
            <div style={headerStyle}>
              <div>
                <div style={kickerStyle}>Schedule</div>
                <h2 style={titleStyle}>{title}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={closeButtonStyle} aria-label="Close scheduler">
                x
              </button>
            </div>

            <div style={targetStyle}>
              <span>{mode === 'tiq-league-match' ? 'Match' : 'Practice'}</span>
              <strong>
                {mode === 'tiq-league-match'
                  ? `${participantAName || 'Player A'} vs ${participantBName || 'Player B'}`
                  : teamName || 'Team practice'}
              </strong>
            </div>

            {mode === 'captain-practice' ? (
              <div style={recipientPreviewStyle}>
                <span style={labelStyle}>Invites</span>
                {previewLoading ? (
                  <p>Checking linked player accounts...</p>
                ) : recipientPreview ? (
                  <>
                    <strong>
                      {recipientPreview.linkedParticipantCount} linked account{recipientPreview.linkedParticipantCount === 1 ? '' : 's'}
                      {' '}from {recipientPreview.rosterCount} roster player{recipientPreview.rosterCount === 1 ? '' : 's'}
                    </strong>
                    {recipientPreview.unlinkedRosterNames.length ? (
                      <p>
                        Needs account links: {recipientPreview.unlinkedRosterNames.slice(0, 4).join(', ')}
                        {recipientPreview.unlinkedRosterNames.length > 4 ? `, +${recipientPreview.unlinkedRosterNames.length - 4} more` : ''}
                      </p>
                    ) : (
                      <p>Every roster player found for this scope has a linked TenAceIQ account.</p>
                    )}
                  </>
                ) : (
                  <p>Roster identity preview is not available yet.</p>
                )}
              </div>
            ) : null}

            <div style={fieldGridStyle}>
              <label style={fieldStyle}>
                <span style={labelStyle}>Date</span>
                <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} style={inputStyle} />
              </label>
              <label style={fieldStyle}>
                <span style={labelStyle}>Time</span>
                <input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} style={inputStyle} />
              </label>
            </div>

            <label style={fieldStyle}>
              <span style={labelStyle}>Site</span>
              <input value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Court, club, or address" style={inputStyle} />
            </label>

            {mode === 'captain-practice' ? (
              <label style={fieldStyle}>
                <span style={labelStyle}>Repeats</span>
                <select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value)} style={inputStyle}>
                  <option value="">One time</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Every other week</option>
                </select>
              </label>
            ) : null}

            <label style={fieldStyle}>
              <span style={labelStyle}>Notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Arrival time, court notes, rain plan..." style={textareaStyle} />
            </label>

            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={() => void submitSchedule()}
                disabled={saving || !scheduledDate}
                style={{ ...primaryStyle, ...((saving || !scheduledDate) ? disabledStyle : {}) }}
              >
                {saving ? 'Scheduling...' : 'Create schedule thread'}
              </button>
              <Link href="/messages" style={secondaryStyle}>Open Messages</Link>
            </div>

            {status ? (
              <div style={successStyle}>
                {status} {conversationId ? <Link href={`/messages?thread=${encodeURIComponent(conversationId)}`} style={inlineLinkStyle}>View thread</Link> : null}
              </div>
            ) : null}
            {error ? <div style={errorStyle}>{error}</div> : null}
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
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(155,225,29,0.22)',
  background: 'rgba(155,225,29,0.08)',
  color: '#e7ffd1',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 72,
  display: 'flex',
  justifyContent: 'flex-end',
  background: 'rgba(2,8,18,0.62)',
  backdropFilter: 'blur(10px)',
}

const drawerStyle: CSSProperties = {
  width: 'min(100%, 460px)',
  height: '100%',
  overflowY: 'auto',
  display: 'grid',
  alignContent: 'start',
  gap: 14,
  padding: 22,
  borderLeft: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(11,24,46,0.98), rgba(5,13,27,0.98))',
  boxShadow: '-20px 0 60px rgba(0,0,0,0.35)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
}

const kickerStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: '#f8fbff',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
}

const closeButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  cursor: 'pointer',
  fontWeight: 900,
}

const targetStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.06)',
  color: '#e7ffd1',
  fontSize: 13,
}

const recipientPreviewStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.07)',
  color: '#dbeafe',
  fontSize: 13,
  lineHeight: 1.45,
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
}

const labelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,17,33,0.78)',
  color: '#f8fbff',
  padding: '0 12px',
  fontWeight: 800,
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const disabledStyle: CSSProperties = {
  opacity: 0.56,
  cursor: 'not-allowed',
}

const secondaryStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
}

const inlineLinkStyle: CSSProperties = {
  color: '#dffad5',
  fontWeight: 950,
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 900,
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 900,
}
