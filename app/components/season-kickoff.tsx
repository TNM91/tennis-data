'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { currentSeasonReplies, seasonInviteText, type SeasonInvite, type SeasonPlayer, type SeasonReply, type SeasonScope, type seasonReadiness } from '@/lib/season-kickoff'
import type { TeamSeasonMatch } from '@/lib/team-season-calendar'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import styles from './season-kickoff.module.css'

type Payload = { roster: SeasonPlayer[]; matches: TeamSeasonMatch[]; invites: SeasonInvite[]; replies: SeasonReply[]; readiness: ReturnType<typeof seasonReadiness> }
const replyLabels: Record<string, string> = { available: 'Available', maybe: 'Not sure', unavailable: 'Unavailable' }
export default function SeasonKickoff({ scope, token, onCalendar }: { scope: SeasonScope; token: string; onCalendar: () => void }) {
  const [data, setData] = useState<Payload | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState('')
  const generation = useRef(0)
  const endpoint = `/api/captain/season-kickoff?${new URLSearchParams(scope)}`
  const load = useCallback(async (method = 'GET', body?: unknown) => {
    const run = ++generation.current
    setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Season setup could not be loaded.')
      if (run !== generation.current) return
      setData(result)
      if (method === 'GET') setMessage('Replies are up to date.')
      else if (method === 'POST') setMessage('Personal links are ready. Nothing has been sent yet—share each link only with that player.')
      else setMessage(body && typeof body === 'object' && 'action' in body && body.action === 'replace'
        ? 'Replacement link ready. Share the new invitation with that player; their old link no longer works.'
        : 'Personal link stopped. It can no longer be used to reply or load the season calendar.')
    } catch (cause) { if (run === generation.current) setError(cause instanceof Error && !['TimeoutError', 'AbortError'].includes(cause.name) ? cause.message : 'This took too long. Please retry.') }
    finally { if (run === generation.current) setBusy(false) }
  }, [endpoint, token])
  useEffect(() => { void load(); return () => { generation.current += 1 } }, [load])

  async function copy(invite: SeasonInvite) {
    const link = `${window.location.origin}/season-availability#${invite.response_token}`
    try { await navigator.clipboard.writeText(seasonInviteText(scope.team, invite.player_name, link)); setMessage(`Invite copied for ${invite.player_name}. Paste it into your message and send.`) }
    catch { setCopiedLink(link); setMessage('Copy this personal link and send it only to the named player.') }
  }
  const valid = data ? currentSeasonReplies(data.matches, data.replies) : []
  return <section className={styles.panel} aria-label="Start season">
    <div className={styles.row}><h2>Plan the season together</h2><button className={styles.secondary} disabled={busy} onClick={onCalendar}>Add season to calendar</button></div>
    <p>Ask your roster which dates work. Available means they can play—not that they are selected for the final lineup.</p>
    {error ? <p role="alert" className={`${styles.feedback} ${styles.error}`}>{error}</p> : null}
    {busy ? <p role="status">Loading season and replies…</p> : null}
    {data ? <>
      <p><strong>{data.matches.length} upcoming matches · {data.roster.length} roster players</strong></p>
      {!data.matches.length ? <p>No upcoming dates in this season. Choose another season or add the schedule first.</p> : null}
      {!data.roster.length ? <p>No roster found for this season. Add your team roster before preparing personal invitations.</p> : null}
      <details open={!data.invites.length}>
        <summary>{data.invites.length ? 'Invite more players / refresh the schedule' : '1. Choose players to invite'}</summary>
        <button className={styles.secondary} disabled={busy} onClick={() => setSelected(data.roster.map(player => player.key))}>Select whole roster</button>
        <ul className={styles.list}>{data.roster.map(player => <li key={player.key}><label className={styles.choice}><input type="checkbox" checked={selected.includes(player.key)} disabled={busy}
          onChange={event => setSelected(previous => event.target.checked ? [...previous, player.key] : previous.filter(key => key !== player.key))} />{player.name}</label></li>)}</ul>
        <button className={styles.button} disabled={busy || !selected.length || !data.matches.length} onClick={() => void load('POST', { playerKeys: selected })}>Prepare {selected.length || ''} personal invitations</button>
        <p>Existing links and answers stay in place. New dates are unanswered until players review them.</p>
      </details>
      {data.invites.length ? <details open={message.startsWith('Personal links are ready')}><summary>2. Share personal invitations · {data.invites.length} players</summary>
        <ul className={styles.list}>{data.invites.map(invite => {
          const answered = valid.filter(reply => reply.invite_id === invite.id).length
          return <li key={invite.id} className={styles.item}><strong>{invite.player_name}</strong>
            <p>{invite.revoked_at ? 'Link stopped' : `${answered} of ${data.matches.length} dates answered`}</p>
            {!invite.player_id ? <p>Player ID not linked yet. Replies appear here; link their player record to use them in the lineup builder.</p> : null}
            {!invite.revoked_at ? <div className={styles.actions}><button className={styles.button} onClick={() => void copy(invite)}>Copy invite</button>
              <a className={styles.secondary} href={`sms:?body=${encodeURIComponent(seasonInviteText(scope.team, invite.player_name, typeof window === 'undefined' ? '' : `${window.location.origin}/season-availability#${invite.response_token}`))}`}>Open text message</a>
              <button className={styles.secondary} disabled={busy} onClick={() => { if (window.confirm(`Stop ${invite.player_name}'s season link? They will no longer be able to reply or load its calendar.`)) void load('PATCH', { inviteId: invite.id }) }}>Stop link</button></div>
              : <button className={styles.secondary} disabled={busy} onClick={() => void load('PATCH', { inviteId: invite.id, action: 'replace' })}>Create replacement link</button>}
          </li>
        })}</ul><p>Opening Messages does not send a text. Choose the named player as the recipient and tap Send. Never post personal reply links in a group chat.</p>
      </details> : null}
      {data.invites.length ? <details><summary>3. Season readiness · who can play?</summary><ul className={styles.list}>{data.matches.map(match => {
        const counts = data.readiness.find(row => row.matchId === match.id)!
        const opponent = match.home_team === scope.team ? match.away_team : match.home_team
        return <li className={styles.item} key={match.id}><strong>{match.match_date} · vs {opponent}</strong>
          <p>{counts.available} available · {counts.maybe} not sure · {counts.unavailable} unavailable · {counts.waiting} unanswered</p>
          <details><summary>Player answers</summary>{data.invites.filter(invite => !invite.revoked_at).map(invite => <p key={invite.id}>{invite.player_name}: {replyLabels[valid.find(reply => reply.invite_id === invite.id && reply.match_id === match.id)?.status || ''] || 'Unanswered'}</p>)}</details>
          <Link className={styles.secondary} href={buildCaptainScopedHref('/captain/lineup-builder', { team: scope.team, league: scope.league, flight: scope.flight, date: match.match_date || '', opponent: opponent || '', matchId: match.id })}>Build this match’s lineup</Link>
        </li>
      })}</ul></details> : null}
    </> : null}
    <button className={styles.secondary} disabled={busy} onClick={() => void load()}>Refresh replies</button>
    {message ? <p className={styles.feedback} role="status">{message}</p> : null}
    {copiedLink ? <label>Personal link<input className={styles.input} readOnly value={copiedLink} onFocus={event => event.target.select()} /></label> : null}
  </section>
}
