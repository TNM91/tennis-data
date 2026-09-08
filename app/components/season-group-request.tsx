'use client'

import { useState } from 'react'
import { seasonGroupMessage, seasonGroupPath } from '@/lib/season-group-request'
import { seasonMatchLabel, type SeasonScope } from '@/lib/season-kickoff'
import type { TeamSeasonMatch } from '@/lib/team-season-calendar'
import styles from './season-kickoff.module.css'

export default function SeasonGroupRequest({ scope, matches, token, onPrepared }: { scope: SeasonScope; matches: TeamSeasonMatch[]; token: string; onPrepared: () => void }) {
  const [matchId, setMatchId] = useState(matches[0]?.id || '')
  const [deadline, setDeadline] = useState('')
  const [ready, setReady] = useState(false)
  const [origin, setOrigin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const match = matches.find(item => item.id === matchId)
  const message = seasonGroupMessage(scope, `${origin}${seasonGroupPath(scope, match?.id || '')}`, match, deadline)
  async function prepare() {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/captain/season-kickoff?${new URLSearchParams(scope)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'group' }), signal: AbortSignal.timeout(30000),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not prepare the group request.')
      setOrigin(window.location.origin); setReady(true); onPrepared()
      setNotice('Message ready. Nothing has been sent. Copy it into your existing team group chat.')
    } catch (cause) { setError(cause instanceof Error && cause.name !== 'TimeoutError' ? cause.message : 'This took too long. Retry safely; existing links and answers stay in place.') }
    finally { setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(message); setNotice('Group message copied. Paste into your team chat and send when ready.') }
    catch { setNotice('Select and copy the message below, then paste it into your team chat.') }
  }
  return <details className={styles.item}>
    <summary>Group chat reminder · optional</summary>
    <div className={styles.groupFields}>
    <p>Send one shared link in your existing group chat. Players sign in and see only their own availability. You can skip this and text selected players from your lineup instead.</p>
    <label>Request availability for<select className={styles.input} value={matchId} disabled={busy} onChange={event => setMatchId(event.target.value)}>
      {matches.map(item => <option key={item.id} value={item.id}>{seasonMatchLabel(item)} · vs {item.home_team === scope.team ? item.away_team : item.home_team}</option>)}
      <option value="">Whole season</option>
    </select></label>
    <label>Reply by · optional<input className={styles.input} value={deadline} maxLength={100} placeholder="e.g. Wednesday evening" disabled={busy} onChange={event => setDeadline(event.target.value)} /></label>
    {!ready ? <button className={styles.button} disabled={busy || !matches.length} onClick={() => void prepare()}>{busy ? 'Preparing…' : 'Prepare group message'}</button> : <>
      <label>Message to paste<textarea className={`${styles.input} ${styles.messagePreview}`} readOnly value={message} onFocus={event => event.target.select()} /></label>
      <button className={styles.button} onClick={() => void copy()}>Copy group message</button>
    </>}
    <p>Preparing a request preserves existing answers and does not reopen stopped invitations. Unlinked players must connect their own player record and team, or ask for an individual invitation.</p>
    {error ? <p className={`${styles.feedback} ${styles.error}`} role="alert">{error}</p> : null}
    {notice ? <p className={styles.feedback} role="status">{notice}</p> : null}
    </div>
  </details>
}
