'use client'

import { useState } from 'react'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { buildEventDeskMatches } from '@/lib/tournament-event-desk'
import { buildEventScheduleNoticeMessage, formatEventScheduleSlot } from '@/lib/tournament-event-schedule-notice'
import styles from './tournament-event-schedule-notices.module.css'

export default function TournamentEventScheduleNotices({ event, divisions }: { event: TiqTournamentRecord; divisions: TiqTournamentRecord[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState('')
  const notices = buildEventDeskMatches(divisions).flatMap(match => {
    const division = divisions.find(item => item.id === match.divisionId)!
    const schedule = division.schedule[match.matchId]
    const change = schedule?.change
    return change && !match.completed && change.sideA === match.sideA && change.sideB === match.sideB
      ? [{ match, schedule, key: `${match.key}:${change.changedAt}` }] : []
  })
  if (!notices.length) return null
  return <section className={styles.panel} aria-label="Schedule change notices">
    <header><div><p>Schedule updates</p><h2>Keep players in the loop</h2></div><span>{notices.length} updated match{notices.length === 1 ? '' : 'es'}</span></header>
    <p>Review the latest change for each match, then copy the message to share with the affected teams. Player passes show the saved assignment. Live SMS is unavailable.</p>
    {notices.map(({ match, schedule, key }) => {
      const message = drafts[key] ?? buildEventScheduleNoticeMessage(event.name, match.label, schedule, event.eventDetails?.timeZoneLabel)
      return <article key={key}>
        <h3>{match.divisionName} · {match.label}</h3><p>{match.sideA} vs {match.sideB}</p>
        <dl><div><dt>Previously</dt><dd>{formatEventScheduleSlot(schedule.change!.previous, event.eventDetails?.timeZoneLabel)}</dd></div><div><dt>Now</dt><dd>{formatEventScheduleSlot(schedule, event.eventDetails?.timeZoneLabel)}</dd></div></dl>
        <label>Message to share<textarea value={message} onChange={e => setDrafts(current => ({ ...current, [key]: e.target.value }))} /></label>
        <button type="button" disabled={!message.trim()} onClick={async () => {
          try { await navigator.clipboard.writeText(message); setFeedback('Message copied. Share it with the affected teams.') }
          catch { setFeedback('Copy unavailable. Select the message and copy it manually.') }
        }}>Copy message</button>
        <small>Message edits stay here until you leave. Copying does not send a notification.</small>
      </article>
    })}<p role="status">{feedback}</p>
  </section>
}
