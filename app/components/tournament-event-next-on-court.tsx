'use client'

import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import type { EventDeskMatch } from '@/lib/tournament-event-desk'
import { buildEventCourtQueue } from '@/lib/tournament-event-next-on-court'
import { formatTournamentEventDate, formatTournamentEventTime } from '@/lib/tournament-event-presentation'
import styles from './tournament-event-next-on-court.module.css'

export default function TournamentEventNextOnCourt({ matches, divisions, conflictKeys, onEdit, onManage, disabled }: {
  matches: EventDeskMatch[]; divisions: TiqTournamentRecord[]; conflictKeys: Set<string>
  onEdit: (match: EventDeskMatch) => void
  onManage: (division: TiqTournamentRecord, section: string) => void
  disabled: boolean
}) {
  const queue = buildEventCourtQueue(matches, divisions)
  return <section className={styles.panel} aria-labelledby="event-next-on-court-heading">
    <p className={styles.eyebrow}>Event night</p><h3 id="event-next-on-court-heading">Next on court</h3>
    <p className={styles.note}>The earliest unfinished, playable match on each court. Scheduled times guide the order; confirm courts are free before calling players.</p>
    <div className={styles.grid}>{queue.courts.map(({ court, next, remaining }) => <article key={court} className={styles.card}>
      <header><h4>{/^court\b/i.test(next.court) ? next.court : `Court ${next.court}`}</h4><span>{remaining} remaining</span></header>
      <p className={styles.slot}>{formatTournamentEventDate(next.date, true)} · {formatTournamentEventTime(next.time)}</p>
      <p className={styles.division}>{next.divisionName} · {next.label}</p>
      <strong className={styles.pairing}>{next.sideA}<span>vs</span>{next.sideB}</strong>
      {conflictKeys.has(next.key) ? <p className={styles.warning}>Court overlap: review the slot before calling this match.</p> : null}
      <div className={styles.actions}><button type="button" disabled={disabled} onClick={() => { const division = divisions.find(item => item.id === next.divisionId); if (division) onManage(division, `tournament-match-${next.matchId}`) }}>Enter score</button><button type="button" disabled={disabled} onClick={() => onEdit(next)}>Edit court slot</button></div>
    </article>)}</div>
    {!queue.courts.length ? <p className={styles.empty}>{!matches.length ? 'Confirm the field to build your court queue.' : matches.every(match => match.completed) ? 'Every match has a posted result. Review the division champions and awards.' : 'No playable matches have court slots yet.'}</p> : null}
    {queue.unassigned.length ? <button className={styles.assign} type="button" disabled={disabled} onClick={() => onEdit(queue.unassigned[0])}>Assign next playable match · {queue.unassigned.length} without a slot</button> : null}
    {queue.awaitingPlayers ? <p className={styles.note}>{queue.awaitingPlayers} later {queue.awaitingPlayers === 1 ? 'match awaits' : 'matches await'} players or qualifying results.</p> : null}
  </section>
}
