'use client'

import type { CSSProperties } from 'react'
import { useState } from 'react'
import type {
  CompetitionScheduleResponseState,
  CompetitionScheduleResponseSummary,
} from '@/lib/competition-schedule-responses'

type CompetitionResponseSummaryProps = {
  summary: CompetitionScheduleResponseSummary
  adjustHref?: string
  onAdjust?: () => void
  onRemind?: () => Promise<{ sentCount: number; cooldownCount: number; nextReminderAt: string; message: string }>
  rosterHref: string
  compact?: boolean
}

const stateLabel: Record<CompetitionScheduleResponseState, string> = {
  available: 'Available',
  unavailable: 'Can’t play',
  waiting: 'Waiting',
  changed: 'Ask again',
}

const stateColor: Record<CompetitionScheduleResponseState, string> = {
  available: '#a3e635',
  unavailable: '#fca5a5',
  waiting: '#cbd5e1',
  changed: '#fcd34d',
}

export default function CompetitionResponseSummary({
  summary,
  adjustHref,
  onAdjust,
  onRemind,
  rosterHref,
  compact = false,
}: CompetitionResponseSummaryProps) {
  const [reminderState, setReminderState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderSentCount, setReminderSentCount] = useState(0)
  const [reminderCooldownCount, setReminderCooldownCount] = useState(0)
  const reminderCount = summary.waitingCount + summary.changedCount
  const reminderButtonLabel = reminderState === 'sending'
    ? 'Sending...'
    : reminderState === 'sent'
      ? reminderSentCount > 0
        ? 'Reminder sent'
        : reminderCooldownCount > 0
          ? 'Recently reminded'
          : 'Replies checked'
      : `Remind ${reminderCount}`

  async function handleRemind() {
    if (!onRemind || reminderState === 'sending') return
    setReminderState('sending')
    setReminderMessage('')
    try {
      const result = await onRemind()
      setReminderSentCount(result.sentCount)
      setReminderCooldownCount(result.cooldownCount)
      setReminderState('sent')
      setReminderMessage(result.message)
    } catch (error) {
      setReminderState('error')
      setReminderMessage(error instanceof Error ? error.message : 'Reminders could not be sent.')
    }
  }

  return (
    <div style={compact ? compactWrapStyle : wrapStyle} aria-label="Player availability replies">
      <div style={headerStyle}>
        <strong>Player replies</strong>
        <div style={countRowStyle}>
          <span style={availablePillStyle}>{summary.availableCount} yes</span>
          {summary.unavailableCount ? <span style={unavailablePillStyle}>{summary.unavailableCount} can’t</span> : null}
          {summary.waitingCount ? <span style={waitingPillStyle}>{summary.waitingCount} waiting</span> : null}
          {summary.changedCount ? <span style={changedPillStyle}>{summary.changedCount} ask again</span> : null}
        </div>
      </div>

      {!compact ? (
        <div style={playersStyle}>
          {summary.rows.map((row) => (
            <div key={row.playerName} style={playerStyle}>
              <span>{row.playerName}</span>
              <strong style={{ color: stateColor[row.state] }}>{stateLabel[row.state]}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {summary.needsAction ? (
        <div style={actionsStyle}>
          {onAdjust ? (
            <button type="button" onClick={onAdjust} style={primaryButtonStyle}>Adjust time</button>
          ) : adjustHref ? (
            <a href={adjustHref} style={primaryActionStyle}>Adjust time</a>
          ) : null}
          <a href={rosterHref} style={secondaryActionStyle}>Review roster</a>
        </div>
      ) : null}
      {onRemind && reminderCount > 0 ? (
        <div style={reminderRowStyle}>
          <button
            type="button"
            onClick={() => void handleRemind()}
            disabled={reminderState === 'sending' || reminderState === 'sent'}
            style={reminderState === 'sent' ? reminderButtonDoneStyle : reminderButtonStyle}
          >
            {reminderButtonLabel}
          </button>
          {reminderMessage ? (
            <span style={reminderState === 'error' ? reminderErrorStyle : reminderStatusStyle} aria-live="polite">
              {reminderMessage}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

const wrapStyle: CSSProperties = {
  display: 'grid',
  gap: 10,
  marginTop: 12,
  padding: 14,
  border: '1px solid rgba(125, 211, 252, 0.2)',
  borderRadius: 16,
  background: 'rgba(8, 23, 42, 0.72)',
}

const compactWrapStyle: CSSProperties = {
  ...wrapStyle,
  padding: 10,
  gap: 8,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: 8,
  color: '#f8fafc',
}

const countRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 6,
}

const basePillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '4px 9px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 900,
}

const availablePillStyle: CSSProperties = {
  ...basePillStyle,
  color: '#d9f99d',
  background: 'rgba(63, 98, 18, 0.4)',
  border: '1px solid rgba(163, 230, 53, 0.34)',
}

const unavailablePillStyle: CSSProperties = {
  ...basePillStyle,
  color: '#fecaca',
  background: 'rgba(127, 29, 29, 0.34)',
  border: '1px solid rgba(248, 113, 113, 0.34)',
}

const waitingPillStyle: CSSProperties = {
  ...basePillStyle,
  color: '#e2e8f0',
  background: 'rgba(51, 65, 85, 0.56)',
  border: '1px solid rgba(148, 163, 184, 0.26)',
}

const changedPillStyle: CSSProperties = {
  ...basePillStyle,
  color: '#fde68a',
  background: 'rgba(120, 53, 15, 0.36)',
  border: '1px solid rgba(251, 191, 36, 0.32)',
}

const playersStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
}

const playerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  color: '#e2e8f0',
  fontSize: 13,
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
}

const primaryActionStyle: CSSProperties = {
  padding: '8px 12px',
  borderRadius: 999,
  color: '#07111f',
  background: '#a3e635',
  fontSize: 12,
  fontWeight: 900,
  textDecoration: 'none',
}

const primaryButtonStyle: CSSProperties = {
  ...primaryActionStyle,
  border: 0,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const secondaryActionStyle: CSSProperties = {
  ...primaryActionStyle,
  color: '#f8fafc',
  background: 'rgba(30, 41, 59, 0.9)',
  border: '1px solid rgba(148, 163, 184, 0.28)',
}

const reminderRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 8,
}

const reminderButtonStyle: CSSProperties = {
  ...primaryButtonStyle,
  color: '#dbeafe',
  background: 'rgba(30, 64, 175, 0.28)',
  border: '1px solid rgba(96, 165, 250, 0.36)',
}

const reminderButtonDoneStyle: CSSProperties = {
  ...reminderButtonStyle,
  cursor: 'default',
  opacity: 0.82,
}

const reminderStatusStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 12,
  fontWeight: 800,
}

const reminderErrorStyle: CSSProperties = {
  ...reminderStatusStyle,
  color: '#fecaca',
}
