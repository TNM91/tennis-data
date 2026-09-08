'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import SeasonAvailabilityClient from '@/app/season-availability/season-availability-client'
import styles from './availability-entry.module.css'
import AvailabilityEntryCard from './availability-entry-card'
import { matchesAvailabilityTeam } from '@/lib/availability-onboarding'
import AvailabilityPlayerLink from './availability-player-link'
import { fetchTeamConnections, updateTeamConnection } from '@/lib/team-profile-links-client'
import type { TeamConnection } from '@/lib/team-profile-links'

export default function TeamAvailabilityClient({ query }: { query: string }) {
  const { session, userId, authResolved } = useAuth()
  // A changed account must unmount the private response editor immediately.
  return <AccountAvailability key={`${userId || 'signed-out'}:${query}`} userId={userId || ''} query={query} token={session?.access_token || ''} resolved={authResolved} />
}

function AccountAvailability({ token, resolved, query, userId }: { token: string; resolved: boolean; query: string; userId: string }) {
  const [data, setData] = useState<{ responseToken: string; focusMatchId: string } | null>(null)
  const [error, setError] = useState('')
  const [action, setAction] = useState('')
  const [busy, setBusy] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [playerJustLinked, setPlayerJustLinked] = useState(false)
  const retry = useCallback(() => { setBusy(true); setError(''); setAction(''); setAttempt(value => value + 1) }, [])
  const playerLinked = useCallback(() => { setPlayerJustLinked(true); retry() }, [retry])
  useEffect(() => {
    if (!token) return
    let active = true
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    void fetch(`/api/team-availability${query}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json()
        if (!active) return
        if (!response.ok) { setData(null); setAction(result.action || ''); throw new Error(result.message || 'Please retry.') }
        setError(''); setAction(''); setData(result)
      }).catch(cause => { if (active) setError(cause?.name === 'AbortError' ? 'Loading took too long. Please retry.' : cause.message) })
      .finally(() => { clearTimeout(timeout); if (active) setBusy(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [token, query, attempt])
  if (token && data) return <SeasonAvailabilityClient responseToken={data.responseToken} focusMatchId={data.focusMatchId} groupEntry />
  const href = `/team-availability${query || ''}`
  return <AvailabilityEntryCard href={href} signedIn={Boolean(token)} loading={!resolved || (Boolean(token) && busy)}>
    {action === 'team' && !busy ? <ConnectAvailabilityTeam key={`${token}:${attempt}`} token={token} userId={userId} href={href} onConnected={retry} onPlayerLinked={playerLinked} playerJustLinked={playerJustLinked} onChooseAgain={() => setPlayerJustLinked(false)} />
      : action === 'profile' ? playerJustLinked ? <PlayerRosterHelp onRetry={retry} onChooseAgain={() => setPlayerJustLinked(false)} /> : <AvailabilityPlayerLink token={token} userId={userId} onLinked={playerLinked} />
      : error ? <div className={styles.actions}><p className={styles.error} role="alert">{error}</p><button className={styles.secondary} disabled={busy} onClick={retry}>Try again</button></div> : null}
  </AvailabilityEntryCard>
}

function ConnectAvailabilityTeam({ token, userId, href, onConnected, onPlayerLinked, playerJustLinked, onChooseAgain }: { token: string; userId: string; href: string; onConnected: () => void; onPlayerLinked: () => void; playerJustLinked: boolean; onChooseAgain: () => void }) {
  const [connection, setConnection] = useState<TeamConnection | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    void fetchTeamConnections(token, { userId, force: true }).then(result => {
      if (!active) return
      // Only server-discovered invitations for this authenticated account.
      // Never grant membership merely because the group URL names a team.
      const candidates = [...result.connections, ...result.pending].filter(item => matchesAvailabilityTeam(item, href))
      setConnection(candidates.find(item => item.status === 'accepted') || candidates.find(item => item.status === 'pending') || null)
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Team links could not be checked.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, userId, href, attempt])
  async function connect() {
    if (!connection || lock.current) return
    lock.current = true; setSaving(true); setError('')
    try {
      if (connection.status !== 'accepted') await updateTeamConnection({ accessToken: token, connectionId: connection.id, action: 'accept' })
      onConnected()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your team could not be connected. Please retry.') }
    finally { lock.current = false; setSaving(false) }
  }
  if (loading) return <p role="status">Finding your team connection…</p>
  return <div className={styles.actions}>
    {error ? <><p className={styles.error} role="alert">{error}</p><button className={styles.secondary} onClick={() => { setError(''); setLoading(true); setAttempt(value => value + 1) }}>Check team again</button></> : null}
    {connection ? <><h2>{connection.status === 'accepted' ? 'Your team is connected.' : 'Is this your team?'}</h2><p>{connection.status === 'accepted' ? 'Continue to open your own availability.' : 'Confirm your team connection to continue. This does not change your availability or your captain’s lineup.'}</p>
      <button className={styles.primary} disabled={saving} onClick={() => void connect()}>{saving ? 'Connecting…' : connection.status === 'accepted' ? 'Continue to availability' : 'Yes, connect & continue'}</button></>
      : !error ? playerJustLinked ? <PlayerRosterHelp onRetry={onConnected} onChooseAgain={onChooseAgain} /> : <AvailabilityPlayerLink token={token} userId={userId} onLinked={onPlayerLinked} /> : null}
  </div>
}

function PlayerRosterHelp({ onRetry, onChooseAgain }: { onRetry: () => void; onChooseAgain: () => void }) {
  return <div className={styles.actions}>
    <h2>Your player is connected.</h2>
    <p>We still can’t match that player to this team’s roster and connection. Ask your captain to check your roster entry or send your personal availability link. You don’t need to link the same player again.</p>
    <button className={styles.primary} onClick={onRetry}>Check my team again</button>
    <button className={styles.secondary} onClick={onChooseAgain}>I chose the wrong player</button>
  </div>
}
