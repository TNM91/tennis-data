'use client'

import { useEffect, useRef, useState } from 'react'
import { linkAvailabilityPlayer, searchAvailabilityPlayers, type AvailabilityPlayer } from '@/lib/availability-player-link'
import { writeLocalProfileLink } from '@/lib/profile-link-storage'
import { notifyTeamConnectionsChanged } from '@/lib/team-profile-links-events'
import styles from './availability-entry.module.css'

export default function AvailabilityPlayerLink({ token, userId, onLinked }: { token: string; userId: string; onLinked: () => void }) {
  const [name, setName] = useState('')
  const [players, setPlayers] = useState<AvailabilityPlayer[]>([])
  const [selected, setSelected] = useState<AvailabilityPlayer | null>(null)
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    if (name.trim().length < 2) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const debounce = setTimeout(() => {
      void searchAvailabilityPlayers(name, controller.signal).then(rows => { if (active) { setPlayers(rows); setSearched(true) } })
        .catch(() => { if (active) setError('Search took too long or could not load. Please try again.') })
        .finally(() => { clearTimeout(timeout); if (active) setSearching(false) })
    }, 300)
    return () => { active = false; clearTimeout(timeout); clearTimeout(debounce); controller.abort() }
  }, [name, attempt])
  async function save() {
    if (!selected || lock.current) return
    lock.current = true; setSaving(true); setError('')
    try {
      const profile = await linkAvailabilityPlayer(token, selected.id)
      // Continue only after the authenticated API confirms a cloud save.
      writeLocalProfileLink(userId, profile)
      notifyTeamConnectionsChanged()
      onLinked()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your player could not be connected. Please retry.') }
    finally { lock.current = false; setSaving(false) }
  }
  return <div className={styles.actions}>
    <h2>Which player are you?</h2>
    <p>Search your name, then choose your own record. Check the location if names are similar.</p>
    <label>Your tennis name<input className={styles.input} type="search" autoComplete="name" maxLength={100} value={name} disabled={saving}
      placeholder="First and last name" onChange={event => { setName(event.target.value); setSelected(null); setPlayers([]); setSearched(false); setSearching(event.target.value.trim().length >= 2); setError('') }} /></label>
    {searching ? <p role="status">Finding players…</p> : null}
    {players.length ? <fieldset className={styles.playerChoices}><legend>Choose only your own player</legend>{players.map(player => <label key={player.id} data-selected={selected?.id === player.id}>
      <input type="radio" name="availability-player" value={player.id} checked={selected?.id === player.id} disabled={saving} onChange={() => setSelected(player)} />
      <span><strong>{player.name}</strong><span>{player.location || 'Location not listed'}</span></span>
    </label>)}</fieldset> : null}
    {searched && !searching && !players.length ? <p>No matching player found. Try your last name or the spelling on your roster.</p> : null}
    {players.length === 8 ? <p className={styles.note}>More names may match. Type more of your name to narrow the list.</p> : null}
    {error ? <><p className={styles.error} role="alert">{error}</p>{!selected ? <button className={styles.secondary} onClick={() => { setError(''); setSearching(true); setAttempt(value => value + 1) }}>Retry search</button> : null}</> : null}
    <button className={styles.primary} disabled={!selected || saving || searching} onClick={() => void save()}>{saving ? 'Connecting your player…' : selected ? 'This is me — connect & continue' : 'Choose your player to continue'}</button>
  </div>
}
