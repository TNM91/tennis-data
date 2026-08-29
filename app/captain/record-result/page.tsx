'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import { buildTeamRoomHref } from '@/lib/team-room'
import styles from './record-result.module.css'

type CourtDraft = {
  id: string
  courtNumber: number
  matchType: 'singles' | 'doubles'
  teamPlayers: string[]
  opponentPlayers: string[]
  outcome: 'team' | 'opponent'
  score: string
}

type RosterResponse = {
  ok?: boolean
  players?: Array<{ name?: string | null }>
  rosterMembers?: Array<{ player_name?: string | null }>
}

function createCourt(courtNumber: number): CourtDraft {
  return {
    id: `court-${courtNumber}-${Math.random().toString(36).slice(2, 8)}`,
    courtNumber,
    matchType: 'doubles',
    teamPlayers: ['', ''],
    opponentPlayers: ['', ''],
    outcome: 'team',
    score: '',
  }
}

function normalizeName(value: string | null | undefined) {
  return (value || '').trim().replace(/\s+/g, ' ')
}

function RecordResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { authResolved, session } = useAuth()
  const teamName = searchParams.get('team')?.trim() || ''
  const leagueName = searchParams.get('league')?.trim() || ''
  const flight = searchParams.get('flight')?.trim() || ''
  const defaultDate = searchParams.get('date')?.trim() || ''
  const defaultOpponent = searchParams.get('opponent')?.trim() || ''
  const defaultTime = searchParams.get('time')?.trim() || ''
  const defaultFacility = searchParams.get('facility')?.trim() || ''
  const [matchDate, setMatchDate] = useState(defaultDate)
  const [opponentTeam, setOpponentTeam] = useState(defaultOpponent)
  const [matchTime, setMatchTime] = useState(defaultTime)
  const [facility, setFacility] = useState(defaultFacility)
  const [courts, setCourts] = useState<CourtDraft[]>(() => [createCourt(1)])
  const [rosterNames, setRosterNames] = useState<string[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const teamRoomHref = useMemo(() => buildTeamRoomHref({
    teamName,
    leagueName,
    flight,
    date: matchDate,
    opponent: opponentTeam,
    time: matchTime,
    facility,
  }), [facility, flight, leagueName, matchDate, matchTime, opponentTeam, teamName])

  useEffect(() => {
    if (!authResolved || !session?.access_token || !teamName) return
    let active = true
    setLoadingRoster(true)
    const params = new URLSearchParams({ team: teamName })
    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    void fetch(`/api/captain/lineup-builder?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (response) => {
        if (!response.ok) return null
        return response.json() as Promise<RosterResponse>
      })
      .then((payload) => {
        if (!active || !payload?.ok) return
        const names = [...new Set([
          ...(payload.players || []).map((player) => normalizeName(player.name)),
          ...(payload.rosterMembers || []).map((player) => normalizeName(player.player_name)),
        ].filter(Boolean))].sort((left, right) => left.localeCompare(right))
        setRosterNames(names)
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingRoster(false)
      })
    return () => { active = false }
  }, [authResolved, flight, leagueName, session?.access_token, teamName])

  function updateCourt(id: string, patch: Partial<CourtDraft>) {
    setCourts((current) => current.map((court) => court.id === id ? { ...court, ...patch } : court))
  }

  function updatePlayer(id: string, side: 'teamPlayers' | 'opponentPlayers', index: number, value: string) {
    setCourts((current) => current.map((court) => {
      if (court.id !== id) return court
      const players = [...court[side]]
      players[index] = value
      return { ...court, [side]: players }
    }))
  }

  function setMatchType(id: string, matchType: CourtDraft['matchType']) {
    setCourts((current) => current.map((court) => {
      if (court.id !== id) return court
      const seats = matchType === 'doubles' ? 2 : 1
      return {
        ...court,
        matchType,
        teamPlayers: court.teamPlayers.slice(0, seats).concat(Array(Math.max(0, seats - court.teamPlayers.length)).fill('')),
        opponentPlayers: court.opponentPlayers.slice(0, seats).concat(Array(Math.max(0, seats - court.opponentPlayers.length)).fill('')),
      }
    }))
  }

  async function saveResult() {
    setError('')
    setNotice('')
    if (!session?.access_token) {
      setError('Sign in to save a captain scorecard.')
      return
    }
    if (!teamName) {
      setError('Choose a team before recording a result.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/captain/match-results', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          teamName,
          opponentTeam,
          matchDate,
          matchTime,
          facility,
          leagueName,
          flight,
          lines: courts.map(({ courtNumber, matchType, teamPlayers, opponentPlayers, outcome, score }) => ({
            courtNumber,
            matchType,
            teamPlayers,
            opponentPlayers,
            outcome,
            score,
          })),
        }),
      })
      const payload = await response.json() as { ok?: boolean; message?: string; needsReview?: boolean }
      if (!response.ok || !payload.ok) {
        setError(payload.message || 'The scorecard could not be saved.')
        return
      }
      setNotice(payload.message || 'Result saved.')
      window.setTimeout(() => router.replace(`${teamRoomHref}${teamRoomHref.includes('?') ? '&' : '?'}result=updated`), 450)
    } catch {
      setError('The scorecard could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="record-result-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Post-match scorecard</p>
            <h1 id="record-result-title">Record the result.</h1>
            <p>Save the final courts now. TiQ uses this verified captain record first; later source imports fill gaps and flag any disagreement.</p>
          </div>
          <Link className={styles.backLink} href={teamRoomHref}>Back to team</Link>
        </div>

        <div className={styles.matchCard}>
          <span>{teamName || 'Your team'}</span>
          <strong>vs {opponentTeam || 'Opponent'}</strong>
          <small>{[matchDate, matchTime, facility].filter(Boolean).join(' · ') || 'Add the match details below'}</small>
        </div>

        <section className={styles.details} aria-label="Match details">
          <label>Match date<input type="date" value={matchDate} onChange={(event) => setMatchDate(event.target.value)} /></label>
          <label>Opponent<input value={opponentTeam} onChange={(event) => setOpponentTeam(event.target.value)} placeholder="Opponent team" /></label>
          <label>Start time<input value={matchTime} onChange={(event) => setMatchTime(event.target.value)} placeholder="Optional" /></label>
          <label>Location<input value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Optional" /></label>
        </section>

        <div className={styles.courtHeader}>
          <div>
            <p className={styles.eyebrow}>Court results</p>
            <h2>Enter each completed court.</h2>
          </div>
          <button className={styles.addCourt} type="button" onClick={() => setCourts((current) => [...current, createCourt(Math.max(0, ...current.map((court) => court.courtNumber)) + 1)])}>Add court</button>
        </div>

        <div className={styles.courtList}>
          {courts.map((court) => {
            const playerCount = court.matchType === 'doubles' ? 2 : 1
            return (
              <article className={styles.courtCard} key={court.id}>
                <div className={styles.courtTitle}>
                  <div>
                    <span>Court {court.courtNumber}</span>
                    <strong>{court.matchType === 'doubles' ? 'Doubles' : 'Singles'}</strong>
                  </div>
                  {courts.length > 1 ? <button type="button" className={styles.removeCourt} onClick={() => setCourts((current) => current.filter((item) => item.id !== court.id))}>Remove</button> : null}
                </div>
                <div className={styles.matchTypeControl} aria-label={`Court ${court.courtNumber} match type`}>
                  <button type="button" data-active={court.matchType === 'doubles'} onClick={() => setMatchType(court.id, 'doubles')}>Doubles</button>
                  <button type="button" data-active={court.matchType === 'singles'} onClick={() => setMatchType(court.id, 'singles')}>Singles</button>
                </div>
                <div className={styles.playerColumns}>
                  <div>
                    <span className={styles.sideLabel}>Your team</span>
                    {Array.from({ length: playerCount }, (_, playerIndex) => (
                      <label className={styles.compactLabel} key={`team-${playerIndex}`}>
                        <span>{playerCount === 2 ? `Player ${playerIndex + 1}` : 'Player'}</span>
                        <select value={court.teamPlayers[playerIndex] || ''} onChange={(event) => updatePlayer(court.id, 'teamPlayers', playerIndex, event.target.value)}>
                          <option value="">Select player</option>
                          {rosterNames.map((name) => <option value={name} key={name}>{name}</option>)}
                        </select>
                      </label>
                    ))}
                    {loadingRoster ? <small className={styles.rosterNote}>Loading your roster…</small> : null}
                    {!loadingRoster && !rosterNames.length ? <small className={styles.rosterNote}>Your roster is not available yet. Add the player name in Team Roster, then return here.</small> : null}
                  </div>
                  <div>
                    <span className={styles.sideLabel}>Opposition</span>
                    {Array.from({ length: playerCount }, (_, playerIndex) => (
                      <label className={styles.compactLabel} key={`opponent-${playerIndex}`}>
                        <span>{playerCount === 2 ? `Player ${playerIndex + 1}` : 'Player'}</span>
                        <input value={court.opponentPlayers[playerIndex] || ''} onChange={(event) => updatePlayer(court.id, 'opponentPlayers', playerIndex, event.target.value)} placeholder="Opponent name" />
                      </label>
                    ))}
                  </div>
                </div>
                <div className={styles.resultControls}>
                  <label className={styles.scoreInput}><span>Final score</span><input value={court.score} onChange={(event) => updateCourt(court.id, { score: event.target.value })} placeholder="6-4 3-6 10-8" /></label>
                  <fieldset>
                    <legend>Winner</legend>
                    <div className={styles.outcomeButtons}>
                      <button type="button" data-active={court.outcome === 'team'} onClick={() => updateCourt(court.id, { outcome: 'team' })}>We won</button>
                      <button type="button" data-active={court.outcome === 'opponent'} onClick={() => updateCourt(court.id, { outcome: 'opponent' })}>They won</button>
                    </div>
                  </fieldset>
                </div>
              </article>
            )
          })}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        <div className={styles.saveBar}>
          <p>TiQ will refresh the team result and its ratings after this scorecard is saved.</p>
          <button className={styles.saveButton} type="button" disabled={saving || !authResolved} onClick={() => void saveResult()}>{saving ? 'Saving result…' : 'Save verified result'}</button>
        </div>
      </section>
    </main>
  )
}

export default function RecordResultPage() {
  return (
    <SiteShell active="Teams">
      <Suspense fallback={null}><RecordResultContent /></Suspense>
    </SiteShell>
  )
}
