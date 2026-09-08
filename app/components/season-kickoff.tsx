'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { currentSeasonReplies, seasonRosterProgress, seasonMatchLabel, seasonInviteText, type SeasonInvite, type SeasonPlayer, type SeasonReply, type SeasonScope, type seasonReadiness } from '@/lib/season-kickoff'
import type { TeamSeasonMatch } from '@/lib/team-season-calendar'
import { buildCaptainScopedHref } from '@/lib/captain-memory'
import styles from './season-kickoff.module.css'
import SeasonAvailabilityClient from '@/app/season-availability/season-availability-client'
import SeasonGroupRequest from './season-group-request'

type Payload = { roster: SeasonPlayer[]; matches: TeamSeasonMatch[]; invites: SeasonInvite[]; replies: SeasonReply[]; readiness: ReturnType<typeof seasonReadiness>; self: SeasonPlayer | null }
const replyLabels: Record<string, string> = { available: 'Available', maybe: 'Not sure', unavailable: 'Unavailable' }
export default function SeasonKickoff({ scope, token, onCalendar, onDirtyChange }: { scope: SeasonScope; token: string; onCalendar: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [data, setData] = useState<Payload | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [copiedLink, setCopiedLink] = useState('')
  const [view, setView] = useState<'team' | 'mine' | 'invite'>('team')
  const [byPlayer, setByPlayer] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [answerBusy, setAnswerBusy] = useState(false)
  const generation = useRef(0)
  const endpoint = `/api/captain/season-kickoff?${new URLSearchParams(scope)}`
  const load = useCallback(async (method = 'GET', body?: unknown, announce = false) => {
    const run = ++generation.current
    setBusy(true); setError('')
    try {
      const response = await fetch(endpoint, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Season setup could not be loaded.')
      if (run !== generation.current) return
      setData(result)
      const selfAction = body && typeof body === 'object' && 'action' in body && body.action === 'self'
      if (method === 'GET') { if (announce) setMessage('Team replies refreshed.') }
      else if (method === 'POST') { setSelected([]); setMessage(selfAction ? '' : 'Personal links are ready. Nothing has been sent yet—share each link only with that player.') }
      else setMessage(body && typeof body === 'object' && 'action' in body && body.action === 'replace'
        ? 'Replacement link ready. Share the new invitation with that player; their old link no longer works.'
        : 'Personal link stopped. It can no longer be used to reply or load the season calendar.')
    } catch (cause) { if (run === generation.current) setError(cause instanceof Error && !['TimeoutError', 'AbortError'].includes(cause.name) ? cause.message : 'This took too long. Please retry.') }
    finally { if (run === generation.current) setBusy(false) }
  }, [endpoint, token])
  useEffect(() => { void load(); return () => { generation.current += 1 } }, [load])
  useEffect(() => { onDirtyChange?.(dirty || answerBusy); return () => onDirtyChange?.(false) }, [dirty, answerBusy, onDirtyChange])
  function changeView(next: typeof view) {
    if (busy || answerBusy) return
    if (next !== view && dirty && !window.confirm('Leave without saving your availability changes?')) return
    if (next !== view) setDirty(false)
    setView(next); setMessage(''); setCopiedLink('')
  }

  async function copy(invite: SeasonInvite) {
    const link = `${window.location.origin}/season-availability#${invite.response_token}`
    try { await navigator.clipboard.writeText(seasonInviteText(scope.team, invite.player_name, link)); setMessage(`Invite copied for ${invite.player_name}. Paste it into your message and send.`) }
    catch { setCopiedLink(link); setMessage('Copy this personal link and send it only to the named player.') }
  }
  const valid = data ? currentSeasonReplies(data.matches, data.replies) : []
  const progress = data ? seasonRosterProgress(data.matches, data.roster, data.invites, data.replies) : null
  const selfInvite = data?.invites.find(invite => invite.roster_key === data.self?.key)
  const stoppedKeys = new Set(data?.invites.filter(invite => invite.revoked_at).map(invite => invite.roster_key))
  return <section className={styles.panel} aria-label="Season availability">
    <div className={styles.row}><h2>Season availability</h2><button className={styles.secondary} disabled={busy || answerBusy || dirty} onClick={onCalendar}>Add season to calendar</button></div>
    <p>Answer for yourself, invite your roster, and see who can play. Availability helps plan ahead; final lineups are confirmed separately.</p>
    <div className={styles.viewNav} role="group" aria-label="Season tools">
      <button className={styles.secondary} aria-pressed={view === 'mine'} disabled={busy || answerBusy} onClick={() => changeView('mine')}>My availability</button>
      <button className={styles.secondary} aria-pressed={view === 'team'} disabled={busy || answerBusy} onClick={() => changeView('team')}>Team availability</button>
      <button className={styles.secondary} aria-pressed={view === 'invite'} disabled={busy || answerBusy} onClick={() => changeView('invite')}>Invite players</button>
    </div>
    {error ? <p role="alert" className={`${styles.feedback} ${styles.error}`}>{error}</p> : null}
    {busy ? <p role="status">Loading season and replies…</p> : null}
    {data ? <>
      <p><strong>{data.matches.length} upcoming matches · {data.roster.length} roster players</strong></p>
      {!data.matches.length ? <p>No upcoming dates in this season. Choose another season or add the schedule first.</p> : null}
      {!data.roster.length ? <p>No roster found for this season. Add your team roster before preparing personal invitations.</p> : null}
      {view !== 'mine' && data.matches.length > 0 && data.roster.length > 0 ? <SeasonGroupRequest key={JSON.stringify(scope)} scope={scope} matches={data.matches} token={token} onPrepared={() => void load()} /> : null}
      {view === 'mine' ? !data.self ? <div className={styles.item}><h3>Connect your player record</h3><p>Your linked player record needs to be on this roster to enter your own availability here. You can still manage the team.</p><Link className={styles.secondary} href="/profile">Open my profile</Link></div>
        : selfInvite && !selfInvite.revoked_at ? <SeasonAvailabilityClient key={selfInvite.response_token} responseToken={selfInvite.response_token} embedded onSaved={() => { void load() }} onDirtyChange={setDirty} onBusyChange={setAnswerBusy} />
        : <div className={styles.item}><h3>{data.self.name} · your availability</h3><p>Answer for yourself right here. No text message to yourself needed.</p><button className={styles.button} disabled={busy || !data.matches.length} onClick={() => void (selfInvite?.revoked_at ? load('PATCH', { inviteId: selfInvite.id, action: 'replace' }) : load('POST', { action: 'self' }))}>{selfInvite?.revoked_at ? 'Reopen my availability' : 'Set my availability'}</button>{selfInvite?.revoked_at ? <p>This creates a new personal link; your old link stays invalid.</p> : null}</div> : null}
      {view === 'invite' ? <>
      <p>Each player gets a private link to answer and add the season to their calendar. No TiQ login is needed to reply.</p>
      <details open={!data.invites.length || selected.length > 0}>
        <summary>Choose players · {selected.length} selected</summary>
        <button className={styles.secondary} disabled={busy} onClick={() => setSelected(data.roster.filter(player => !stoppedKeys.has(player.key)).map(player => player.key))}>Select whole roster</button>
        <ul className={styles.list}>{data.roster.map(player => <li key={player.key}><label className={styles.choice}><input type="checkbox" checked={selected.includes(player.key)} disabled={busy || stoppedKeys.has(player.key)}
          onChange={event => setSelected(previous => event.target.checked ? [...previous, player.key] : previous.filter(key => key !== player.key))} />{player.name}{stoppedKeys.has(player.key) ? ' · Link stopped; create a replacement below' : ''}</label></li>)}</ul>
        <button className={styles.button} disabled={busy || !selected.length || !data.matches.length} onClick={() => void load('POST', { playerKeys: selected })}>Prepare {selected.length || ''} personal invitations</button>
        <p>Existing links and answers stay in place. New dates are unanswered until players review them.</p>
      </details>
      {data.invites.length ? <details open><summary>Share personal invitations · {data.invites.length} {data.invites.length === 1 ? 'player' : 'players'}</summary>
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
      </> : null}
      {view === 'team' && progress ? <>
        <div className={styles.item}><h3>Whole-team progress</h3><p><strong>{progress.started} of {data.roster.length}</strong> players have answered · <strong>{progress.complete}</strong> finished every date</p>{progress.needsInvite ? <button className={styles.secondary} disabled={busy} onClick={() => changeView('invite')}>{progress.needsInvite} players need an invitation</button> : null}</div>
        <div className={styles.actions} role="group" aria-label="Track team availability"><button className={styles.secondary} aria-pressed={!byPlayer} onClick={() => setByPlayer(false)}>By match</button><button className={styles.secondary} aria-pressed={byPlayer} onClick={() => setByPlayer(true)}>By player</button></div>
        {byPlayer ? <ul className={styles.list}>{progress.players.map(player => <li key={player.key} className={styles.item}><strong>{player.name}{player.key === data.self?.key ? ' (you)' : ''}</strong><p>{player.invite?.revoked_at ? 'Link stopped' : !player.invite ? 'Not invited yet' : `${player.answered} of ${data.matches.length} dates answered`}</p><details><summary>View dates and answers</summary><ul className={styles.list}>{data.matches.map(match => <li key={match.id}>{seasonMatchLabel(match)} · {replyLabels[player.answers.find(answer => answer.match_id === match.id)?.status || ''] || 'Unanswered'}</li>)}</ul></details></li>)}</ul> : <>
      <ul className={styles.list}>{(showAll ? data.matches : data.matches.slice(0, 4)).map(match => {
        const counts = progress.matches.find(row => row.matchId === match.id)!
        const opponent = match.home_team === scope.team ? match.away_team : match.home_team
        return <li className={styles.item} key={match.id}><details><summary className={styles.matchSummary}><strong>{seasonMatchLabel(match)}</strong><span>vs {opponent}</span><span className={styles.counts}>{counts.available} available · {counts.maybe} not sure · {counts.unavailable} unavailable</span><span className={styles.muted}>{counts.waiting} unanswered{counts.needsInvite ? ` · ${counts.needsInvite} need an invitation` : ''}</span><span className={styles.disclosure}>View player answers</span></summary>
          <ul className={styles.list}>{progress.players.map(player => <li key={player.key} className={styles.answerRow}><span>{player.name}</span><strong>{!player.invite ? 'Not invited' : player.invite.revoked_at ? 'Link stopped' : replyLabels[player.answers.find(answer => answer.match_id === match.id)?.status || ''] || 'Unanswered'}</strong></li>)}</ul>
          <Link className={styles.secondary} href={buildCaptainScopedHref('/captain/lineup-builder', { team: scope.team, league: scope.league, flight: scope.flight, date: match.match_date || '', opponent: opponent || '', matchId: match.id })}>Build this match’s lineup</Link>
        </details></li>
      })}</ul>{data.matches.length > 4 ? <button className={styles.secondary} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show next 4 matches' : `Show all ${data.matches.length} matches`}</button> : null}</>}
      </> : null}
    </> : null}
    {view !== 'mine' || error ? <button className={styles.secondary} disabled={busy || answerBusy} onClick={() => void load('GET', undefined, true)}>Refresh replies</button> : null}
    {message ? <p className={styles.feedback} role="status">{message}</p> : null}
    {copiedLink ? <label>Personal link<input className={styles.input} readOnly value={copiedLink} onFocus={event => event.target.select()} /></label> : null}
  </section>
}
