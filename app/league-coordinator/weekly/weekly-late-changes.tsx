'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { getAffectedWeeklyPlayers, replaceWeeklyPlayer } from '@/lib/league-weekly-operations'
import styles from './weekly-league-workspace.module.css'

export default function WeeklyLateChanges({ sessionId, updatedAt, courts, players, inPlayers, scoredCourts, onRefresh }: {
  sessionId: string; updatedAt: string; courts: LeagueWeeklyCourt[]; players: string[]; inPlayers: string[]; scoredCourts: number[]; onRefresh: () => Promise<void>
}) {
  const [requests, setRequests] = useState<Array<{ player_name: string; reason: string }>>([])
  const [outgoing, setOutgoing] = useState('')
  const [incoming, setIncoming] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmedAvailable, setConfirmedAvailable] = useState(false)
  const [times, setTimes] = useState<Record<number, string>>({})
  useEffect(() => {
    let active = true
    void supabase.from('tiq_league_weekly_change_requests').select('player_name,reason').eq('session_id', sessionId).eq('status', 'pending').then(({ data, error }) => {
      if (!active) return
      if (error) setMessage('Withdrawal requests need the weekly changes database update.')
      else setRequests(data || [])
    })
    return () => { active = false }
  }, [sessionId, updatedAt])
  const assigned = courts.flatMap(court => court.players)
  const substitutes = players.filter(name => !assigned.includes(name))
  const needsAvailability = Boolean(incoming && !inPlayers.includes(incoming))
  const court = courts.find(item => item.players.includes(outgoing))
  const affected = court && incoming && substitutes.includes(incoming) ? getAffectedWeeklyPlayers(courts, replaceWeeklyPlayer(courts, outgoing, incoming)) : []
  async function replace() {
    if (!outgoing || !incoming || !window.confirm(`Replace ${outgoing} with ${incoming} on court ${court?.courtNumber}?`)) return
    setBusy(true)
    try {
      const { error } = await supabase.rpc('replace_tiq_weekly_player', { target_session_id: sessionId, outgoing, incoming, expected_updated_at: updatedAt, confirm_available: confirmedAvailable })
      if (error) throw error
      setMessage('Substitute confirmed. Prepare a plan-change update to notify the affected players.')
      setOutgoing(''); setIncoming(''); await onRefresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The substitute could not be confirmed. Refresh and try again.') }
    finally { setBusy(false) }
  }
  async function dismiss(player: string) {
    if (!window.confirm(`Keep ${player} on the court and close their withdrawal request? Confirm their availability first.`)) return
    setBusy(true)
    const { error } = await supabase.rpc('dismiss_tiq_weekly_withdrawal', { target_session_id: sessionId, target_player: player })
    if (error) setMessage(error.message)
    else { setRequests(items => items.filter(item => item.player_name !== player)); setMessage('Request closed. The court plan is unchanged.') }
    setBusy(false)
  }
  async function changeTime(number: number) {
    const time = times[number]
    if (!time || !window.confirm(`Change court ${number} to ${time}? This will be ready to notify the affected players.`)) return
    setBusy(true)
    const assignments = courts.map(item => item.courtNumber === number ? { ...item, startTime: time } : item)
    const { data, error } = await supabase.from('tiq_league_weekly_sessions').update({ assignments }).eq('id', sessionId).eq('updated_at', updatedAt).select('id').maybeSingle()
    if (error || !data) setMessage(error?.message || 'The week changed. Refresh before changing a court time.')
    else await onRefresh()
    setBusy(false)
  }
  return <section className={styles.commsCenter} aria-labelledby="late-changes-title">
    <h2 id="late-changes-title">Late changes and substitutes</h2>
    <p>A withdrawal request does not remove anyone automatically. Confirm a substitute, then notify just the affected court.</p>
    {requests.length ? requests.map(request => <div key={request.player_name}><p><strong>{request.player_name} requested a withdrawal.</strong> {request.reason}</p><button disabled={busy} onClick={() => void dismiss(request.player_name)}>Keep player · close request</button></div>) : <p>No pending withdrawal requests.</p>}
    <div className={styles.communicationDraft}>
      <label>Player leaving<select value={outgoing} disabled={busy} onChange={event => setOutgoing(event.target.value)}><option value="">Choose a confirmed player</option>{assigned.map(name => <option key={name} value={name} disabled={scoredCourts.some(number => courts.find(item => item.courtNumber === number)?.players.includes(name))}>{name}</option>)}</select></label>
      <label>Substitute<select value={incoming} disabled={busy} onChange={event => { setIncoming(event.target.value); setConfirmedAvailable(false) }}><option value="">Choose an unassigned player</option>{substitutes.map(name => <option key={name} value={name}>{name}{inPlayers.includes(name) ? ' · replied in' : ' · availability needed'}</option>)}</select></label>
      {needsAvailability ? <label><span><input type="checkbox" checked={confirmedAvailable} onChange={event => setConfirmedAvailable(event.target.checked)} /> I have confirmed this player is available. Mark them in and assign this court.</span></label> : null}
      {!substitutes.length ? <p>No unassigned league players are available. Add an eligible substitute in Edit league first.</p> : null}
      {affected.length ? <p>Court {court?.courtNumber} · {court?.startTime}. Affected players: {affected.join(', ')}. All three partner rotations will update together.</p> : null}
      <button type="button" disabled={busy || !outgoing || !incoming || !court || (needsAvailability && !confirmedAvailable) || scoredCourts.includes(court.courtNumber)} onClick={() => void replace()}>{busy ? 'Confirming…' : 'Confirm substitute'}</button>
      <small>Courts with submitted scores are protected from player changes.</small>
    </div>
    <details className={styles.communicationDraft}><summary>Change a court start time</summary>{courts.map(item => <div key={item.courtNumber}><label>Court {item.courtNumber}<input type="time" value={times[item.courtNumber] ?? item.startTime} onChange={event => setTimes(current => ({ ...current, [item.courtNumber]: event.target.value }))} /></label><button disabled={busy || !times[item.courtNumber] || times[item.courtNumber] === item.startTime} onClick={() => void changeTime(item.courtNumber)}>Save court time</button></div>)}</details>
    {message ? <p role="status">{message}</p> : null}
  </section>
}
