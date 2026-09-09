'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import {
  buildCaptainPracticeInviteText,
  buildCaptainPracticeSmsHref,
} from '@/lib/captain-practice-invite'
import { practiceRsvpPath } from '@/lib/captain-practice-rsvp'
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
  defaultNotes = '',
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
  defaultNotes?: string
}) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [scheduledDate, setScheduledDate] = useState(defaultDate)
  const [scheduledTime, setScheduledTime] = useState(defaultTime)
  const [facility, setFacility] = useState(defaultFacility)
  const [recurrenceRule, setRecurrenceRule] = useState('')
  const [notes, setNotes] = useState('')
  const [capacity, setCapacity] = useState('')
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
  const [practiceDelivery, setPracticeDelivery] = useState<{
    responseUrl: string
    inviteText: string
    postedToTeamChat: boolean
  } | null>(null)

  useEffect(() => {
    if (!open) {
      setScheduledDate(defaultDate)
      setScheduledTime(defaultTime)
      setFacility(defaultFacility)
      setRecurrenceRule('')
      setNotes(defaultNotes)
      setCapacity('')
      setConversationId('')
      setStatus('')
      setError('')
      setRecipientPreview(null)
      setPreviewLoading(false)
      setPracticeDelivery(null)
    }
  }, [defaultDate, defaultFacility, defaultNotes, defaultTime, open])

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
          capacity: capacity ? Number(capacity) : null,
        })
        setConversationId(result.conversationId)
        const responseUrl = `${window.location.origin}${practiceRsvpPath(result.publicToken)}`
        const inviteText = buildCaptainPracticeInviteText({
          teamName,
          scheduledDate,
          scheduledTime,
          facility,
          capacity: capacity ? Number(capacity) : null,
          practiceFocus: notes.replace(/Please mark In, Out, or Maybe[\s\S]*$/i, '').replace(/^Practice focus:\s*/i, '').trim(),
          responseUrl,
        })
        let postedToTeamChat = false
        if (session?.access_token) {
          const teamRoomResponse = await fetch('/api/team-rooms', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'send',
              teamName,
              leagueName,
              flight,
              body: inviteText,
              announcement: true,
            }),
          }).catch(() => null)
          postedToTeamChat = Boolean(teamRoomResponse?.ok)
        }
        setPracticeDelivery({ responseUrl, inviteText, postedToTeamChat })
        setStatus(
          postedToTeamChat
            ? `Practice posted to Team Chat for ${result.linkedParticipantCount} linked player account${result.linkedParticipantCount === 1 ? '' : 's'}.`
            : result.linkedParticipantCount > 0
              ? `Practice RSVP opened for ${result.linkedParticipantCount} linked player account${result.linkedParticipantCount === 1 ? '' : 's'}. Share it with the team below.`
              : 'Practice RSVP opened. Link player profiles to capture individual replies.',
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Schedule could not be created.')
    } finally {
      setSaving(false)
    }
  }

  async function copyPracticeInvite() {
    if (!practiceDelivery) return
    try {
      await navigator.clipboard.writeText(practiceDelivery.inviteText)
      setStatus('Practice invite copied. Paste it into your group text.')
    } catch {
      setError('The invite could not be copied. Use Text group instead.')
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
              <div style={fieldGridStyle}>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Repeats</span>
                  <select value={recurrenceRule} onChange={(event) => setRecurrenceRule(event.target.value)} style={inputStyle}>
                    <option value="">One time</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Every other week</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  <span style={labelStyle}>Player limit</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    inputMode="numeric"
                    value={capacity}
                    onChange={(event) => setCapacity(event.target.value)}
                    placeholder="No limit"
                    style={inputStyle}
                  />
                </label>
              </div>
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
                {saving ? 'Sending...' : mode === 'captain-practice' ? 'Send practice invite' : 'Create schedule thread'}
              </button>
              <Link href={conversationId ? `/messages?thread=${encodeURIComponent(conversationId)}#message-schedule-panel` : '/messages'} style={secondaryStyle}>
                {conversationId ? 'Open RSVP roster' : 'Open Messages'}
              </Link>
            </div>

            {status ? (
              <div style={successStyle}>{status}</div>
            ) : null}
            {practiceDelivery ? (
              <div style={deliveryPanelStyle} aria-label="Share practice invite">
                <div style={deliveryHeaderStyle}>
                  <span style={kickerStyle}>Practice ready</span>
                  <strong>{practiceDelivery.postedToTeamChat ? 'Posted to Team Chat' : 'Ready to share'}</strong>
                </div>
                <div style={deliveryActionsStyle}>
                  <Link href={`/messages?thread=${encodeURIComponent(conversationId)}#message-schedule-panel`} style={primaryStyle}>View RSVPs</Link>
                  <a href={buildCaptainPracticeSmsHref(practiceDelivery.inviteText)} style={primaryStyle}>Text group</a>
                  <button type="button" onClick={() => void copyPracticeInvite()} style={ghostActionStyle}>Copy invite</button>
                </div>
                <p style={deliveryHintStyle}>No account needed. Players can RSVP, see who is coming, join the waitlist, and add practice to their calendar.</p>
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
  minHeight: 44,
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
  width: 44,
  height: 44,
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
  minWidth: 0,
  overflowWrap: 'anywhere',
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
  minWidth: 0,
  overflowWrap: 'anywhere',
}

const fieldGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
  minWidth: 0,
}

const labelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  overflowWrap: 'anywhere',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minWidth: 0,
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
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  textAlign: 'center',
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const disabledStyle: CSSProperties = {
  opacity: 0.56,
  cursor: 'not-allowed',
}

const secondaryStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 44,
  color: '#dbeafe',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
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

const deliveryPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(155,225,29,0.3)',
  background: 'linear-gradient(135deg, rgba(155,225,29,0.12), rgba(116,190,255,0.08))',
}

const deliveryHeaderStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  color: '#f8fbff',
}

const deliveryActionsStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))',
  gap: 8,
}

const ghostActionStyle: CSSProperties = {
  ...primaryStyle,
  borderColor: 'rgba(116,190,255,0.22)',
  background: 'rgba(7,17,33,0.7)',
  color: '#dbeafe',
}

const deliveryHintStyle: CSSProperties = {
  margin: 0,
  color: '#cbd5e1',
  fontSize: 12,
  lineHeight: 1.45,
  fontWeight: 750,
}
