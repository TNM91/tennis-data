'use client'
import { useState } from 'react'
import type { TiqTournamentRecord } from '@/lib/tiq-tournament-registry'
import { buildEventPublicationReview, eventPublicationVersion } from '@/lib/tournament-event-publication'
import TournamentEventPanel from './tournament-event-panel'
import styles from './tournament-event-publication.module.css'

export default function TournamentEventPublication({event,divisions,onEdit,onVisibility}:{event:TiqTournamentRecord;divisions:TiqTournamentRecord[];onEdit:()=>void;onVisibility:(makePublic:boolean)=>Promise<void>}) {
  const review=buildEventPublicationReview(event,divisions)
  const version=eventPublicationVersion(event,divisions)
  const [previewOpen,setPreviewOpen]=useState(false)
  const [reviewed,setReviewed]=useState('')
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  async function changeVisibility() {
    if(busy || reviewed!==version || (!event.isPublic && !review.ready)) return
    setBusy(true);setError('');setMessage('')
    try {await onVisibility(!event.isPublic);setReviewed('');setMessage(event.isPublic ? 'Event is private. Its divisions are private too.' : 'Event published. Players can open the event and division pages.')}
    catch(cause){setError(cause instanceof Error ? cause.message : 'Visibility could not be saved.');setReviewed('')}
    finally{setBusy(false)}
  }
  return <section className={styles.panel} aria-label="Event publication review"><header><div><p className={styles.eyebrow}>Player access</p><h2>{event.isPublic ? 'Your event is public.' : 'Ready to open your event?'}</h2></div><span>{event.isPublic ? 'Public event and divisions' : 'Private event'}</span></header>
    <p>Review the saved details players will see. Confirmed teams, court assignments, and results can be added after signups open.</p>
    <ul>{review.items.map(item=><li key={item.label}><strong>{item.ready ? '✓' : '○'} {item.label}</strong><p>{item.detail}</p></li>)}</ul>
    <button type="button" onClick={onEdit} disabled={busy}>Edit event details</button>
    <details className={styles.preview} onToggle={e=>setPreviewOpen(e.currentTarget.open)}><summary>Preview the player announcement</summary><p>Player preview · This does not change event visibility.</p><p>Draws, results, and player passes remain on the full event page.</p>{previewOpen ? <TournamentEventPanel event={{...event,isPublic:true}} divisions={review.children.map(row=>({...row,isPublic:true}))} announcementOnly/> : null}</details>
    <label className={styles.confirm}><input type="checkbox" checked={reviewed===version} disabled={busy || (!event.isPublic && !review.ready)} onChange={e=>setReviewed(e.target.checked ? version : '')}/><span>{event.isPublic ? 'I want to make the event and all its divisions private.' : 'I reviewed the saved player details and want to make the event and all its divisions public.'}</span></label>
    <button type="button" className={styles.primary} disabled={busy || reviewed!==version || (!event.isPublic && !review.ready)} onClick={()=>void changeVisibility()}>{busy ? 'Saving visibility…' : event.isPublic ? 'Make event private' : 'Publish event'}</button>
    {!event.isPublic && !review.ready ? <p>Complete the missing details before publishing.</p> : null}{message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
  </section>
}
