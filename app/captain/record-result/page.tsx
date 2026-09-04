'use client'

import Link from 'next/link'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import type { CaptainScorecardSavedRecap } from '@/lib/captain-scorecard'
import {
  captainScorecardPhotoPrefillStorageKey,
  isCaptainScorecardPhotoPrefill,
} from '@/lib/captain-scorecard-photo-prefill'
import { buildTeamRoomHref } from '@/lib/team-room'
import styles from './record-result.module.css'

type CourtDraft = {
  id: string
  courtNumber: number
  label?: string
  matchType: 'singles' | 'doubles'
  teamPlayers: string[]
  opponentPlayers: string[]
  outcome: 'team' | 'opponent'
  score: string
}

type StoredScorecardDraft = {
  version: 1
  teamName: string
  matchDate: string
  opponentTeam: string
  matchTime: string
  facility: string
  courts: CourtDraft[]
}

type RosterResponse = {
  ok?: boolean
  players?: Array<{ name?: string | null }>
  rosterMembers?: Array<{ player_name?: string | null }>
  opponentRosterNames?: string[]
}

type TeamRoomResponse = {
  ok?: boolean
  room?: {
    messages?: Array<{
      card?: {
        matchDate?: string
        opponent?: string
        lineup?: Array<{ label?: string; players?: string[] }>
      } | null
    }>
  } | null
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

function isCourtEntryComplete(court: CourtDraft) {
  const playerCount = court.matchType === 'doubles' ? 2 : 1
  return court.teamPlayers.slice(0, playerCount).every((name) => Boolean(normalizeName(name)))
    && court.opponentPlayers.slice(0, playerCount).every((name) => Boolean(normalizeName(name)))
    && Boolean(court.score.trim())
}

function buildScorecardDraftStorageKey(input: {
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponentTeam: string
}) {
  const scope = [input.teamName, input.leagueName, input.flight, input.matchDate, input.opponentTeam]
    .map((value) => normalizeName(value).toLowerCase())
    .join('::')
  return scope.replace(/:/g, '') ? `tiq:captain-scorecard-draft:${scope}` : ''
}

function isStoredScorecardDraft(value: unknown): value is StoredScorecardDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const draft = value as Partial<StoredScorecardDraft>
  return draft.version === 1
    && typeof draft.teamName === 'string'
    && typeof draft.matchDate === 'string'
    && typeof draft.opponentTeam === 'string'
    && typeof draft.matchTime === 'string'
    && typeof draft.facility === 'string'
    && Array.isArray(draft.courts)
    && draft.courts.every((court) => (
      court
      && typeof court === 'object'
      && typeof court.id === 'string'
      && Number.isInteger(court.courtNumber)
      && (court.matchType === 'singles' || court.matchType === 'doubles')
      && Array.isArray(court.teamPlayers)
      && Array.isArray(court.opponentPlayers)
      && (court.outcome === 'team' || court.outcome === 'opponent')
      && typeof court.score === 'string'
    ))
}

function formatRating(value: number | null) {
  return value === null ? 'TiQ pending' : value.toFixed(2)
}

function RecordResultContent() {
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
  // Undefined means "open the first court" for a fresh scorecard. Null means
  // the captain intentionally collapsed every court after reviewing it.
  const [openCourtId, setOpenCourtId] = useState<string | null | undefined>(undefined)
  const [rosterNames, setRosterNames] = useState<string[]>([])
  const [opponentRosterNames, setOpponentRosterNames] = useState<string[]>([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [savedRecap, setSavedRecap] = useState<CaptainScorecardSavedRecap | null>(null)
  const [teamAnnouncementUpdated, setTeamAnnouncementUpdated] = useState(false)
  const [resultShareNotice, setResultShareNotice] = useState('')
  const lineupPrefillKey = useRef('')
  const restoredScorecardDraftKey = useRef('')
  const scorecardPhotoPrefillKey = useRef('')
  const scorecardPhotoPrefillActive = useRef(false)
  const [dataAssistBatchId, setDataAssistBatchId] = useState('')
  const [dataAssistDraftId, setDataAssistDraftId] = useState('')

  const teamRoomHref = useMemo(() => buildTeamRoomHref({
    teamName,
    leagueName,
    flight,
    date: matchDate,
    opponent: opponentTeam,
    time: matchTime,
    facility,
  }), [facility, flight, leagueName, matchDate, matchTime, opponentTeam, teamName])
  const updatedTeamRoomHref = `${teamRoomHref}${teamRoomHref.includes('?') ? '&' : '?'}result=updated`
  const savedResultMatchId = searchParams.get('resultMatch')?.trim() || ''
  const shouldRestoreRecap = searchParams.get('result') === 'updated' && Boolean(savedResultMatchId)
  const scorecardPhotoDraftId = searchParams.get('scorecardDraft')?.trim() || ''
  const scorecardCameraHref = useMemo(() => {
    const resultParams = new URLSearchParams()
    if (teamName) resultParams.set('team', teamName)
    if (leagueName) resultParams.set('league', leagueName)
    if (flight) resultParams.set('flight', flight)
    if (matchDate) resultParams.set('date', matchDate)
    if (opponentTeam) resultParams.set('opponent', opponentTeam)
    if (matchTime) resultParams.set('time', matchTime)
    if (facility) resultParams.set('facility', facility)
    const captureParams = new URLSearchParams({
      intent: 'upload-source',
      context: 'captain-scorecard',
      type: 'scorecard',
      capture: 'camera',
      returnTo: `/captain/record-result?${resultParams.toString()}`,
    })
    return `/data-assist?${captureParams.toString()}`
  }, [facility, flight, leagueName, matchDate, matchTime, opponentTeam, teamName])
  const scorecardDraftStorageKey = useMemo(() => buildScorecardDraftStorageKey({
    teamName,
    leagueName,
    flight,
    matchDate: defaultDate,
    opponentTeam: defaultOpponent,
  }), [defaultDate, defaultOpponent, flight, leagueName, teamName])
  const activeCourtId = openCourtId === undefined
    ? courts[0]?.id || ''
    : courts.some((court) => court.id === openCourtId) ? openCourtId || '' : ''
  const completedCourtCount = courts.filter(isCourtEntryComplete).length

  useEffect(() => {
    if (restoredScorecardDraftKey.current === scorecardDraftStorageKey) return
    restoredScorecardDraftKey.current = scorecardDraftStorageKey
    if (!scorecardDraftStorageKey || scorecardPhotoDraftId) {
      setDraftReady(true)
      return
    }

    try {
      const raw = window.localStorage.getItem(scorecardDraftStorageKey)
      if (!raw) return
      const draft = JSON.parse(raw) as unknown
      if (!isStoredScorecardDraft(draft) || normalizeName(draft.teamName).toLowerCase() !== normalizeName(teamName).toLowerCase()) return
      setMatchDate(draft.matchDate)
      setOpponentTeam(draft.opponentTeam)
      setMatchTime(draft.matchTime)
      setFacility(draft.facility)
      setCourts(draft.courts)
      lineupPrefillKey.current = [teamName, leagueName, flight, draft.matchDate, draft.opponentTeam].join('::').toLowerCase()
      setNotice('Your in-progress scorecard was restored on this device.')
      setDraftSaved(true)
    } catch {
      // A malformed local draft should never block a captain from recording a result.
      window.localStorage.removeItem(scorecardDraftStorageKey)
    } finally {
      setDraftReady(true)
    }
  }, [flight, leagueName, scorecardDraftStorageKey, scorecardPhotoDraftId, teamName])

  useEffect(() => {
    if (!draftReady || !scorecardDraftStorageKey) return
    const hasProgress = courts.some((court) => (
      court.teamPlayers.some((name) => Boolean(normalizeName(name)))
      || court.opponentPlayers.some((name) => Boolean(normalizeName(name)))
      || Boolean(court.score.trim())
    ))
    try {
      if (!hasProgress) {
        window.localStorage.removeItem(scorecardDraftStorageKey)
        setDraftSaved(false)
        return
      }
      const draft: StoredScorecardDraft = {
        version: 1,
        teamName,
        matchDate,
        opponentTeam,
        matchTime,
        facility,
        courts,
      }
      window.localStorage.setItem(scorecardDraftStorageKey, JSON.stringify(draft))
      setDraftSaved(true)
    } catch {
      // Score entry remains fully usable when device storage is unavailable.
      setDraftSaved(false)
    }
  }, [courts, draftReady, facility, matchDate, matchTime, opponentTeam, scorecardDraftStorageKey, teamName])

  useEffect(() => {
    if (!authResolved || !session?.access_token || !teamName) return
    let active = true
    setLoadingRoster(true)
    const params = new URLSearchParams({ team: teamName })
    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    if (opponentTeam) params.set('opponent', opponentTeam)
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
        setOpponentRosterNames((payload.opponentRosterNames || []).map(normalizeName).filter(Boolean))
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoadingRoster(false)
      })
    return () => { active = false }
  }, [authResolved, flight, leagueName, opponentTeam, session?.access_token, teamName])

  useEffect(() => {
    if (!scorecardPhotoDraftId || !teamName || scorecardPhotoPrefillKey.current === scorecardPhotoDraftId) return
    try {
      const raw = window.sessionStorage.getItem(captainScorecardPhotoPrefillStorageKey(scorecardPhotoDraftId))
      if (!raw) return
      const prefill = JSON.parse(raw) as unknown
      if (!isCaptainScorecardPhotoPrefill(prefill) || normalizeName(prefill.teamName).toLowerCase() !== normalizeName(teamName).toLowerCase()) return
      const preparedCourts = prefill.courts.map((court, index) => ({
        ...createCourt(court.courtNumber || index + 1),
        courtNumber: court.courtNumber || index + 1,
        matchType: court.matchType,
        teamPlayers: court.teamPlayers,
        opponentPlayers: court.opponentPlayers,
        outcome: court.outcome,
        score: court.score,
      }))
      if (!preparedCourts.length) return
      scorecardPhotoPrefillKey.current = scorecardPhotoDraftId
      scorecardPhotoPrefillActive.current = true
      lineupPrefillKey.current = `photo:${scorecardPhotoDraftId}`
      setDataAssistBatchId(prefill.dataAssistBatchId)
      setDataAssistDraftId(prefill.dataAssistDraftId)
      if (prefill.matchDate) setMatchDate(prefill.matchDate)
      if (prefill.opponentTeam) setOpponentTeam(prefill.opponentTeam)
      setCourts(preparedCourts)
      setNotice('Scorecard photo read loaded. Check every court, then save the verified captain result.')
    } catch {
      // Keep the captain form usable if the local photo draft is unavailable.
    }
  }, [scorecardPhotoDraftId, teamName])

  useEffect(() => {
    if (!authResolved || !session?.access_token || !teamName || !matchDate || !opponentTeam) return
    if (scorecardPhotoPrefillActive.current) return
    const prefillKey = [teamName, leagueName, flight, matchDate, opponentTeam].join('::').toLowerCase()
    if (lineupPrefillKey.current === prefillKey) return
    let active = true
    const params = new URLSearchParams({ team: teamName, date: matchDate, opponent: opponentTeam })
    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    void fetch(`/api/team-rooms?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(async (response) => response.ok ? response.json() as Promise<TeamRoomResponse> : null)
      .then((payload) => {
        if (!active || !payload?.ok || lineupPrefillKey.current === prefillKey) return
        const expectedOpponent = normalizeName(opponentTeam).toLowerCase()
        const card = (payload.room?.messages || [])
          .map((message) => message.card)
          .find((candidate) => candidate?.matchDate === matchDate && normalizeName(candidate.opponent).toLowerCase() === expectedOpponent)
        const lineup = card?.lineup || []
        if (!lineup.length) return
        const prepared = lineup.map((line, index) => {
          const players = (line.players || []).map(normalizeName).filter(Boolean).slice(0, 2)
          const singles = /single/i.test(line.label || '')
          return {
            ...createCourt(index + 1),
            courtNumber: index + 1,
            label: normalizeName(line.label),
            matchType: singles ? 'singles' as const : 'doubles' as const,
            teamPlayers: singles ? [players[0] || ''] : [players[0] || '', players[1] || ''],
            opponentPlayers: singles ? [''] : ['', ''],
          }
        })
        lineupPrefillKey.current = prefillKey
        setCourts(prepared)
        setNotice(`Loaded ${prepared.length} saved court${prepared.length === 1 ? '' : 's'} from your lineup.`)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [authResolved, flight, leagueName, matchDate, opponentTeam, session?.access_token, teamName])

  useEffect(() => {
    if (!authResolved || !session?.access_token || !teamName || !shouldRestoreRecap || !savedResultMatchId || savedRecap) return
    let active = true
    const params = new URLSearchParams({ externalMatchId: savedResultMatchId, team: teamName })
    void fetch(`/api/captain/match-results?${params.toString()}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: 'no-store',
    })
      .then(async (response) => response.ok ? response.json() as Promise<{ ok?: boolean; recap?: CaptainScorecardSavedRecap }> : null)
      .then((payload) => {
        if (active && payload?.ok && payload.recap) setSavedRecap(payload.recap)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [authResolved, savedRecap, savedResultMatchId, session?.access_token, shouldRestoreRecap, teamName])

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

  async function textFinalResult() {
    if (!savedRecap) return
    const teamChatUrl = new URL(updatedTeamRoomHref, window.location.origin).toString()
    const scoreLine = `${teamName || 'Your team'} ${savedRecap.teamCourts}–${savedRecap.opponentCourts} ${opponentTeam || 'Opponent'}`
    const courtLines = savedRecap.lines.map((line) => `${line.label}: ${line.outcome === 'team' ? 'W' : 'L'} ${line.score}`).join('\n')
    const message = ['Final result', scoreLine, matchDate ? `Match date: ${matchDate}` : '', courtLines, `Team Chat: ${teamChatUrl}`].filter(Boolean).join('\n')
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${teamName || 'Team'} final result`, text: message, url: teamChatUrl })
        setResultShareNotice('Choose Messages to text the final result to any player or captain.')
        return
      }
      window.location.href = `sms:?&body=${encodeURIComponent(message)}`
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return
      window.location.href = `sms:?&body=${encodeURIComponent(message)}`
    }
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
          dataAssistBatchId,
          dataAssistDraftId,
          lines: courts.map(({ courtNumber, label, matchType, teamPlayers, opponentPlayers, outcome, score }) => ({
            courtNumber,
            label,
            matchType,
            teamPlayers,
            opponentPlayers,
            outcome,
            score,
          })),
        }),
      })
      const payload = await response.json() as { ok?: boolean; message?: string; needsReview?: boolean; externalMatchId?: string; recap?: CaptainScorecardSavedRecap; teamAnnouncementUpdated?: boolean }
      if (!response.ok || !payload.ok) {
        setError(payload.message || 'The scorecard could not be saved.')
        return
      }
      setNotice(payload.message || 'Result saved.')
      setSavedRecap(payload.recap || null)
      setTeamAnnouncementUpdated(payload.teamAnnouncementUpdated === true)
      if (payload.externalMatchId) {
        if (scorecardDraftStorageKey) window.localStorage.removeItem(scorecardDraftStorageKey)
        setDraftSaved(false)
        const url = new URL(window.location.href)
        if (dataAssistBatchId) window.sessionStorage.removeItem(captainScorecardPhotoPrefillStorageKey(dataAssistBatchId))
        scorecardPhotoPrefillKey.current = ''
        scorecardPhotoPrefillActive.current = false
        setDataAssistBatchId('')
        setDataAssistDraftId('')
        url.searchParams.set('result', 'updated')
        url.searchParams.set('resultMatch', payload.externalMatchId)
        url.searchParams.delete('scorecardDraft')
        window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setError('The scorecard could not be saved. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  if (savedRecap) {
    const outcomeLabel = savedRecap.outcome === 'won' ? 'Match won.' : savedRecap.outcome === 'lost' ? 'Match recorded.' : 'Match split.'
    const ratingChanges = [...savedRecap.ratingChanges].sort((left, right) => Number(right.side === 'team') - Number(left.side === 'team'))
    return (
      <main className={styles.page}>
        <section className={styles.recapShell} aria-labelledby="scorecard-recap-title">
          <div className={styles.recapHeading}>
            <div>
              <p className={styles.eyebrow}>Verified result</p>
              <h1 id="scorecard-recap-title">{outcomeLabel}</h1>
              <p>{teamName || 'Your team'} vs {opponentTeam || 'opponent'} · {matchDate || 'Match date'}</p>
            </div>
            <span className={styles.verifiedPill}>Captain verified</span>
          </div>

          <section className={styles.resultScoreboard} aria-label="Team result">
            <div><span>{teamName || 'Your team'}</span><strong>{savedRecap.teamCourts}</strong></div>
            <em>Final courts</em>
            <div><span>{opponentTeam || 'Opponent'}</span><strong>{savedRecap.opponentCourts}</strong></div>
          </section>

          <section className={styles.recapSection}>
            <div className={styles.recapSectionHeading}>
              <div><p className={styles.eyebrow}>Court tape</p><h2>What was recorded</h2></div>
              <span>{savedRecap.lines.length} court{savedRecap.lines.length === 1 ? '' : 's'}</span>
            </div>
            <div className={styles.recapLines}>
              {savedRecap.lines.map((line) => (
                <article className={styles.recapLine} key={`${line.courtNumber}-${line.label}`} data-outcome={line.outcome}>
                  <div><strong>{line.label}</strong><span>{line.outcome === 'team' ? 'Won' : 'Lost'} · {line.score}</span></div>
                  <p>{line.teamPlayers.join(' / ')} <small>vs</small> {line.opponentPlayers.join(' / ')}</p>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.recapSection}>
            <div className={styles.recapSectionHeading}>
              <div><p className={styles.eyebrow}>TiQ movement</p><h2>After this result</h2></div>
              <span>Match-specific</span>
            </div>
            {ratingChanges.length ? (
              <div className={styles.ratingChanges}>
                {ratingChanges.map((change) => (
                  <article className={styles.ratingChange} key={change.playerId}>
                    <div><strong>{change.playerName}</strong><span>{change.side === 'team' ? 'Your team' : 'Opponent'} · {change.matchType === 'doubles' ? 'Doubles TiQ' : 'Singles TiQ'}</span></div>
                    <div className={styles.ratingValues}>
                      <strong>{formatRating(change.after)}</strong>
                      {change.delta !== null ? <span data-direction={change.delta > 0 ? 'up' : change.delta < 0 ? 'down' : 'flat'}>{change.delta > 0 ? '+' : ''}{change.delta.toFixed(3)}</span> : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.recapEmpty}>TiQ is refreshing the player read. This verified scorecard is already saved.</p>}
          </section>

          <section className={styles.auditNote}>
            <strong>{savedRecap.sourceConflictCount ? 'Source detail retained' : 'Match record protected'}</strong>
            <span>{savedRecap.sourceConflictCount
              ? `TiQ kept ${savedRecap.sourceConflictCount} lower-confidence score difference for audit. Your verified captain scorecard remains canonical.`
              : 'Your verified captain scorecard is now connected to this match. Future imports can fill gaps but cannot silently replace it.'}</span>
          </section>

          {teamAnnouncementUpdated ? (
            <section className={styles.teamUpdateNote} aria-label="Team update posted">
              <strong>Team update posted</strong>
              <span>The final result is now in Team Chat for your roster.</span>
            </section>
          ) : null}

          <div className={styles.recapActions}>
            <Link className={styles.saveButton} href={updatedTeamRoomHref}>{teamAnnouncementUpdated ? 'View team update' : 'Open team recap'}</Link>
            <button className={styles.addCourt} type="button" onClick={() => void textFinalResult()}>Text final result</button>
            <button className={styles.addCourt} type="button" onClick={() => {
              setSavedRecap(null)
              setTeamAnnouncementUpdated(false)
              const url = new URL(window.location.href)
              url.searchParams.delete('result')
              url.searchParams.delete('resultMatch')
              window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)
            }}>Edit scorecard</button>
          </div>
          {resultShareNotice ? <p className={styles.notice} role="status">{resultShareNotice}</p> : null}
        </section>
      </main>
    )
  }

  return (
    <main className={styles.page}>
      <section className={styles.shell} aria-labelledby="record-result-title">
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Live scorecard</p>
            <h1 id="record-result-title">Record the result.</h1>
            <p>Enter the opponents and final score for each court, then submit once.</p>
          </div>
          <Link className={styles.backLink} href={teamRoomHref}>Back to team</Link>
        </div>

        <div className={styles.matchCard}>
          <span>{teamName || 'Your team'}</span>
          <strong>vs {opponentTeam || 'Opponent'}</strong>
          <small>{[matchDate, matchTime, facility].filter(Boolean).join(' · ') || 'Add the match details below'}</small>
        </div>

        <section className={styles.quickActions} aria-label="Scorecard shortcuts">
          <div><strong>Have a paper scorecard?</strong><span>Scan it and review the prefilled courts.</span></div>
          {teamName ? (
            <Link className={styles.photoCaptureButton} href={scorecardCameraHref}>Scan scorecard</Link>
          ) : (
            <span className={styles.photoCaptureHint}>Choose a team to use scorecard capture.</span>
          )}
        </section>

        <details className={styles.matchDetails} open={!defaultDate || !defaultOpponent}>
          <summary>Match details <span>Edit date, opponent, time, or location</span></summary>
          <section className={styles.details} aria-label="Match details">
            <label>Match date<input type="date" value={matchDate} onChange={(event) => setMatchDate(event.target.value)} /></label>
            <label>Opponent<input value={opponentTeam} onChange={(event) => setOpponentTeam(event.target.value)} placeholder="Opponent team" /></label>
            <label>Start time<input value={matchTime} onChange={(event) => setMatchTime(event.target.value)} placeholder="Optional" /></label>
            <label>Location<input value={facility} onChange={(event) => setFacility(event.target.value)} placeholder="Optional" /></label>
          </section>
        </details>

        <div className={styles.courtHeader}>
          <div>
            <p className={styles.eyebrow}>Court results</p>
            <h2>Enter one court at a time.</h2>
            <p>{completedCourtCount}/{courts.length} ready to submit</p>
            {draftSaved ? <span className={styles.draftSaved} role="status">Draft saved on this device</span> : null}
          </div>
          <button className={styles.addCourt} type="button" onClick={() => setCourts((current) => [...current, createCourt(Math.max(0, ...current.map((court) => court.courtNumber)) + 1)])}>Add court</button>
        </div>

        <div className={styles.courtList}>
          {courts.map((court) => {
            const playerCount = court.matchType === 'doubles' ? 2 : 1
            const isOpen = court.id === activeCourtId
            const entryComplete = isCourtEntryComplete(court)
            const teamPlayers = court.teamPlayers.slice(0, playerCount).map(normalizeName).filter(Boolean)
            const opponentPlayers = court.opponentPlayers.slice(0, playerCount).map(normalizeName).filter(Boolean)
            return (
              <article className={styles.courtCard} key={court.id} id={`scorecard-court-${court.id}`} data-open={isOpen}>
                <div className={styles.courtTitle}>
                  <div>
                    <span>Match line</span>
                    <strong>{court.label || `${court.matchType === 'doubles' ? 'Doubles' : 'Singles'} ${court.courtNumber}`}</strong>
                  </div>
                  <div className={styles.courtTitleActions}>
                    <span className={entryComplete ? styles.courtReady : styles.courtPending}>{entryComplete ? 'Ready' : isOpen ? 'Editing' : 'Needs result'}</span>
                    <button
                      type="button"
                      className={styles.toggleCourt}
                      aria-expanded={isOpen}
                      aria-controls={`scorecard-court-entry-${court.id}`}
                      onClick={() => setOpenCourtId(isOpen ? '' : court.id)}
                    >
                      {isOpen ? 'Done for now' : 'Enter result'}
                    </button>
                    {courts.length > 1 ? <button type="button" className={styles.removeCourt} onClick={() => setCourts((current) => current.filter((item) => item.id !== court.id))}>Remove</button> : null}
                  </div>
                </div>
                {!isOpen ? <p className={styles.courtSummary}>{teamPlayers.length ? teamPlayers.join(' / ') : 'Add your player(s)'} <small>vs</small> {opponentPlayers.length ? opponentPlayers.join(' / ') : 'add opponent(s)'}{court.score ? ` · ${court.score}` : ''}</p> : null}
                {isOpen ? (
                  <div className={styles.courtEntry} id={`scorecard-court-entry-${court.id}`}>
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
                          <div className={styles.opponentEntry} key={`opponent-${playerIndex}`}>
                            <span>{playerCount === 2 ? `Player ${playerIndex + 1}` : 'Player'}</span>
                            {opponentRosterNames.length ? (
                              <>
                                <select
                                  aria-label={`Choose an opponent for ${court.label || `court ${court.courtNumber}`}`}
                                  value={opponentRosterNames.includes(court.opponentPlayers[playerIndex] || '') ? court.opponentPlayers[playerIndex] || '' : '__manual__'}
                                  onChange={(event) => updatePlayer(court.id, 'opponentPlayers', playerIndex, event.target.value === '__manual__' ? '' : event.target.value)}
                                >
                                  <option value="">Choose a known opponent</option>
                                  {opponentRosterNames.map((name) => <option value={name} key={name}>{name}</option>)}
                                  <option value="__manual__">Enter a different player</option>
                                </select>
                                {!opponentRosterNames.includes(court.opponentPlayers[playerIndex] || '') ? (
                                  <input aria-label={`Enter an opponent for ${court.label || `court ${court.courtNumber}`}`} value={court.opponentPlayers[playerIndex] || ''} onChange={(event) => updatePlayer(court.id, 'opponentPlayers', playerIndex, event.target.value)} placeholder="Type opponent name" />
                                ) : null}
                              </>
                            ) : (
                              <input aria-label={`Enter an opponent for ${court.label || `court ${court.courtNumber}`}`} value={court.opponentPlayers[playerIndex] || ''} onChange={(event) => updatePlayer(court.id, 'opponentPlayers', playerIndex, event.target.value)} placeholder="Type opponent name" />
                            )}
                          </div>
                        ))}
                        <small className={styles.rosterNote}>{opponentRosterNames.length ? `Choose from ${opponentRosterNames.length} known opponent${opponentRosterNames.length === 1 ? '' : 's'}, or select “Enter a different player.”` : 'No opponent roster is connected yet. Type each opponent name.'}</small>
                      </div>
                    </div>
                    <div className={styles.resultControls}>
                      <label className={styles.scoreInput}><span>Select or enter final score</span><input list="captain-score-options" value={court.score} onChange={(event) => updateCourt(court.id, { score: event.target.value })} placeholder="6-4 3-6 10-8" /></label>
                      <fieldset>
                        <legend>Winner</legend>
                        <div className={styles.outcomeButtons}>
                          <button type="button" data-active={court.outcome === 'team'} onClick={() => updateCourt(court.id, { outcome: 'team' })}>We won</button>
                          <button type="button" data-active={court.outcome === 'opponent'} onClick={() => updateCourt(court.id, { outcome: 'opponent' })}>They won</button>
                        </div>
                      </fieldset>
                    </div>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>

        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
        <div className={styles.saveBar}>
          <p>Review the courts, then submit the final result to TiQ.</p>
          <button className={styles.saveButton} type="button" disabled={saving || !authResolved} onClick={() => void saveResult()}>{saving ? 'Saving result…' : 'Submit final result'}</button>
        </div>
        <datalist id="captain-score-options">
          {['6-0 6-0', '6-1 6-1', '6-2 6-2', '6-3 6-3', '6-4 6-4', '7-5 6-4', '7-6 6-4', '6-4 6-7 10-8', '6-7 6-4 10-8'].map((score) => <option value={score} key={score} />)}
        </datalist>
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
