'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { buildTournamentEventRecap } from '@/lib/tournament-event-recap'
import styles from './tournament-event-recap.module.css'

export default function TournamentEventRecap({ event, divisions, director = false }: { event: TiqTournamentRecord; divisions: TiqTournamentRecord[]; director?: boolean }) {
  const recap = useMemo(() => buildTournamentEventRecap(event, divisions), [event, divisions])
  const [draft, setDraft] = useState<{ source: string; text: string } | null>(null)
  const [feedback, setFeedback] = useState<{source:string;text:string} | null>(null)
  const message = draft?.source === recap.message ? draft.text : recap.message
  if (!recap.rows.some(row => row.posted) && event.status !== 'completed') return null
  return <section className={styles.panel} aria-label="Event results recap">
    <header><div><p className={styles.eyebrow}>Event recap</p><h2>{recap.confirmed === recap.rows.length && recap.rows.length ? 'Your division champions.' : 'Results so far.'}</h2></div><span>{recap.confirmed}/{recap.rows.length} winners confirmed</span></header>
    <div className={styles.grid}>{recap.rows.map(row => <article key={row.id}><p>{row.name}</p><p className={styles.eyebrow}>{row.champion ? 'Division champion' : 'Title pending'}</p><h3>{row.champion || 'Title pending'}</h3>{row.runnerUp ? <p>Runner-up · {row.runnerUp}</p> : null}<p>{row.detail}{row.score ? ` · ${row.score}` : ''}</p>{row.score ? <small>Final score follows the order of the names shown.</small> : null}<p>{row.posted}/{row.total} match results posted</p><Link href={`/tournaments/${encodeURIComponent(row.id)}#draw`}>View division results</Link></article>)}</div>
    {director ? <details className={styles.share}><summary>Prepare a recap to share</summary><label>Recap message<textarea value={message} onChange={e => { setDraft({source:recap.message,text:e.target.value}); setFeedback(null) }} /></label><button type="button" disabled={!message.trim()} onClick={async () => {
      try { await navigator.clipboard.writeText(message); setFeedback({source:recap.message,text:'Recap copied. Share it when you’re ready.'}) }
      catch { setFeedback({source:recap.message,text:'Copy unavailable. Select the recap and copy it manually.'}) }
    }}>Copy recap</button><p>Copying does not send a message. Edits stay here until you leave or posted results change.</p><p role="status">{feedback?.source === recap.message ? feedback.text : ''}</p></details> : null}
  </section>
}
