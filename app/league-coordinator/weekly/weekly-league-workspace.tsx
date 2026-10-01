'use client'

import { ArrowLeft, Bell, CalendarBlank, CaretLeft, CaretRight, CheckCircle, Copy, Eye, MapPin, PaperPlaneTilt, ShareNetwork, UserCheck, UsersThree } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import PremiumLeagueCourt from '@/app/components/premium-league-court'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import LocationDirectionsLink from '@/app/components/location-directions-link'
import LeagueOperationsSettings from './league-operations-settings'
import WeeklyScoreIntelligencePanel from './weekly-score-intelligence-panel'
import WeeklyLeagueResponse from '@/app/league-week/[token]/weekly-league-response'
import { supabase } from '@/lib/supabase'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import {
  buildLeagueWeeklyRecap,
  getLeagueWeeklyRosterSummary,
  type LeagueWeeklyCourt,
} from '@/lib/league-weekly-format'
import { buildLeagueWeeklyCourtPlan, buildLeagueWeeklySeasonScorecards, isAcceptedLeagueWeeklyResult, type LeagueWeeklyCourtPlan, type LeagueWeeklyPlayerBaseline, type LeagueWeeklyPlayerScorecard, type LeagueWeeklyReviewedResult } from '@/lib/league-weekly-intelligence'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import type { WeeklyCommunicationKind } from '@/lib/league-weekly-communications'
import styles from './weekly-league-workspace.module.css'

type WeeklyResponse = {
  player_name: string
  response_status: 'in' | 'out'
  note: string
  positive_share: string
  responded_at: string
}

type WeeklyResult = {
  session_id?: string
  court_number: number
  set_number: number
  side_a_games: number
  side_b_games: number
  submitted_by_name: string
  review_status: 'pending' | 'confirmed' | 'disputed' | 'approved'
}

type WeeklyScoreSubmissionRow = { court_number: number; set_number: number; side_a_games: number; side_b_games: number; submitted_by_name: string; submitted_at: string }
type LeaguePlayerEntryRow = { player_id: string | null; player_name: string }
type TiqRatingRow = { id: string; doubles_dynamic_rating: number | null; overall_dynamic_rating: number | null }

type WeeklySession = {
  id: string
  public_token: string
  play_on: string
  response_deadline: string | null
  status: 'collecting' | 'roster_confirmed' | 'published' | 'completed'
  roster: string[]
  assignments: LeagueWeeklyCourt[]
  recap: { headline?: string; summary?: string; stories?: string[]; sentAt?: string; sentCount?: number; emailCount?: number }
}

type RecapDraft = { headline: string; summary: string; stories: string[] }

function nextThursday() {
  const date = new Date()
  const distance = (4 - date.getDay() + 7) % 7
  date.setDate(date.getDate() + distance)
  return localDateKey(date)
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function WeeklyLeagueWorkspace({
  initialLeagueId,
  initialPlayOn,
}: {
  initialLeagueId: string
  initialPlayOn: string
}) {
  const { authResolved, session: authSession, userId } = useAuth()
  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [leagueId, setLeagueId] = useState(initialLeagueId)
  const [playOn, setPlayOn] = useState(() => initialPlayOn || nextThursday())
  const [session, setSession] = useState<WeeklySession | null>(null)
  const [responses, setResponses] = useState<WeeklyResponse[]>([])
  const [results, setResults] = useState<WeeklyResult[]>([])
  const [scoreSubmissions, setScoreSubmissions] = useState<WeeklyScoreSubmissionRow[]>([])
  const [playerStats, setPlayerStats] = useState<LeagueWeeklyPlayerScorecard[]>([])
  const [playerBaselines, setPlayerBaselines] = useState<LeagueWeeklyPlayerBaseline[]>([])
  const [historyCourts, setHistoryCourts] = useState<LeagueWeeklyCourt[][]>([])
  const [lockedCourts, setLockedCourts] = useState<Record<string, number>>({})
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const playerPreviewRef = useRef<HTMLDialogElement>(null)
  const sessionRequestRef = useRef(0)
  const [recapDraft, setRecapDraft] = useState<RecapDraft>({ headline: '', summary: '', stories: [] })

  const league = useMemo(() => leagues.find((record) => record.id === leagueId) || null, [leagueId, leagues])
  const inPlayers = useMemo(() => responses.filter((response) => response.response_status === 'in').map((response) => response.player_name), [responses])
  const rosterSummary = useMemo(
    () => getLeagueWeeklyRosterSummary(selectedPlayers, league?.weeklySettings || {}),
    [league?.weeklySettings, selectedPlayers],
  )
  const courtPlan = useMemo(() => league ? buildLeagueWeeklyCourtPlan({
    playerNames: selectedPlayers,
    settings: league.weeklySettings,
    scorecards: playerStats,
    playerBaselines,
    historyCourts,
    lockedCourts,
    strategy: league.weeklySettings.autoGenerateCourts ? 'balanced' : 'manual',
  }) : null, [historyCourts, league, lockedCourts, playerBaselines, playerStats, selectedPlayers])

  const loadSession = useCallback(async (targetLeagueId: string, targetPlayOn: string) => {
    if (!targetLeagueId || !targetPlayOn) return
    const request = ++sessionRequestRef.current
    setBusy(true)
    setSession(null)
    setResponses([])
    setResults([])
    setSelectedPlayers([])
    setPlayerStats([])
    setHistoryCourts([])
    setScoreSubmissions([])
    const { data, error } = await supabase
      .from('tiq_league_weekly_sessions')
      .select('id,public_token,play_on,response_deadline,status,roster,assignments,recap')
      .eq('league_id', targetLeagueId)
      .eq('play_on', targetPlayOn)
      .maybeSingle()
    if (request !== sessionRequestRef.current) return
    if (error) {
      setStatus(error.message.includes('schema cache') ? 'Weekly play needs the new database migration before sessions can sync.' : error.message)
      setSession(null)
      setBusy(false)
      return
    }
    const nextSession = data as WeeklySession | null
    setSession(nextSession)
    setRecapDraft({
      headline: nextSession?.recap?.headline || '',
      summary: nextSession?.recap?.summary || '',
      stories: Array.isArray(nextSession?.recap?.stories) ? nextSession.recap.stories : [],
    })
    setSelectedPlayers(Array.isArray(nextSession?.roster) ? nextSession.roster : [])
    if (!nextSession) {
      setResponses([])
      setResults([])
      setScoreSubmissions([])
      setBusy(false)
      return
    }
    const [responseResult, scoreResult, submissionResult] = await Promise.all([
      supabase.from('tiq_league_weekly_responses').select('player_name,response_status,note,positive_share,responded_at').eq('session_id', nextSession.id).order('responded_at', { ascending: false }),
      supabase.from('tiq_league_weekly_set_results').select('court_number,set_number,side_a_games,side_b_games,submitted_by_name,review_status').eq('session_id', nextSession.id).order('court_number').order('set_number'),
      supabase.from('tiq_league_weekly_score_submissions').select('court_number,set_number,side_a_games,side_b_games,submitted_by_name,submitted_at').eq('session_id', nextSession.id).order('submitted_at'),
    ])
    if (request !== sessionRequestRef.current) return
    setResponses((responseResult.data || []) as WeeklyResponse[])
    setResults((scoreResult.data || []) as WeeklyResult[])
    setScoreSubmissions((submissionResult.data || []) as WeeklyScoreSubmissionRow[])
    const { data: historySessions } = await supabase
      .from('tiq_league_weekly_sessions')
      .select('id,play_on,assignments')
      .eq('league_id', targetLeagueId)
      .in('status', ['published', 'completed'])
      .order('play_on', { ascending: false })
      .limit(20)
    const historyIds = (historySessions || []).map((item) => item.id)
    const { data: historyResults } = historyIds.length
      ? await supabase.from('tiq_league_weekly_set_results').select('session_id,court_number,set_number,side_a_games,side_b_games,submitted_by_name,review_status').in('session_id', historyIds)
      : { data: [] }
    if (request !== sessionRequestRef.current) return
    const history = (historySessions || []).map((historicalSession) => ({
      playOn: historicalSession.play_on,
      courts: Array.isArray(historicalSession.assignments) ? historicalSession.assignments as LeagueWeeklyCourt[] : [],
      results: (historyResults || []).filter((result) => result.session_id === historicalSession.id).map((result) => ({
        courtNumber: result.court_number,
        setNumber: result.set_number,
        sideAGames: result.side_a_games,
        sideBGames: result.side_b_games,
        submittedByName: result.submitted_by_name,
        reviewStatus: result.review_status,
      } as LeagueWeeklyReviewedResult)),
    }))
    setPlayerStats(buildLeagueWeeklySeasonScorecards(history))
    setHistoryCourts(history.filter((item) => item.playOn !== targetPlayOn).map((item) => item.courts))
    if (!nextSession.roster?.length) setSelectedPlayers((responseResult.data || []).filter((item) => item.response_status === 'in').map((item) => item.player_name))
    setStatus('')
    setBusy(false)
  }, [])

  useEffect(() => {
    void listTiqLeagues().then(({ records }) => {
      const weeklyLeagues = records.filter((record) => record.weeklySettings.enabled)
      setLeagues(weeklyLeagues)
      const nextId = initialLeagueId && weeklyLeagues.some((record) => record.id === initialLeagueId)
        ? initialLeagueId
        : weeklyLeagues[0]?.id || ''
      setLeagueId(nextId)
    })
  }, [initialLeagueId])

  useEffect(() => {
    if (!authResolved || !userId || !leagueId) return
    const timeoutId = window.setTimeout(() => void loadSession(leagueId, playOn), 0)
    return () => {
      window.clearTimeout(timeoutId)
      sessionRequestRef.current += 1
    }
  }, [authResolved, leagueId, loadSession, playOn, userId])

  useEffect(() => {
    if (!leagueId) return
    let active = true
    void (async () => {
      try {
        const { data: entryData, error: entryError } = await supabase
          .from('tiq_player_league_entries')
          .select('player_id,player_name')
          .eq('league_id', leagueId)
          .eq('entry_status', 'active')
        if (entryError) throw entryError
        const linkedEntries = ((entryData || []) as LeaguePlayerEntryRow[]).flatMap((entry) => {
          const playerId = entry.player_id?.trim()
          return playerId ? [{ playerId, playerName: entry.player_name }] : []
        })
        const playerIds = Array.from(new Set(linkedEntries.map((entry) => entry.playerId)))
        if (!playerIds.length) {
          if (active) setPlayerBaselines([])
          return
        }
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('id,doubles_dynamic_rating,overall_dynamic_rating')
          .in('id', playerIds)
        if (playerError) throw playerError
        const ratingById = new Map(((playerData || []) as TiqRatingRow[]).map((player) => [player.id, player.doubles_dynamic_rating ?? player.overall_dynamic_rating ?? null]))
        const baselines = linkedEntries.map((entry) => ({
          playerName: entry.playerName,
          playerId: entry.playerId,
          tiqDoublesRating: ratingById.get(entry.playerId) ?? null,
        } satisfies LeagueWeeklyPlayerBaseline))
        if (active) setPlayerBaselines(baselines)
      } catch {
        if (active) setPlayerBaselines([])
      }
    })()
    return () => {
      active = false
    }
  }, [leagueId])

  async function createSession() {
    if (!league || !userId) return
    setBusy(true)
    const deadline = new Date(`${playOn}T08:00:00`)
    deadline.setDate(deadline.getDate() - 1)
    const { error } = await supabase.from('tiq_league_weekly_sessions').insert({
      league_id: league.id,
      play_on: playOn,
      response_deadline: deadline.toISOString(),
      created_by_user_id: userId,
    })
    if (error) setStatus(error.message)
    else await loadSession(league.id, playOn)
    setBusy(false)
  }

  function togglePlayer(playerName: string) {
    const isSelected = selectedPlayers.includes(playerName)
    setSelectedPlayers(isSelected
      ? selectedPlayers.filter((name) => name !== playerName)
      : [...selectedPlayers, playerName])
    if (isSelected && lockedCourts[playerName]) {
      setLockedCourts((current) => {
        const next = { ...current }
        delete next[playerName]
        return next
      })
    }
  }

  function lockPlayerToCourt(playerName: string, courtNumber: number) {
    if (courtNumber > 0) {
      const lockedCount = Object.entries(lockedCourts).filter(([otherPlayer, lockedCourt]) => (
        otherPlayer !== playerName && selectedPlayers.includes(otherPlayer) && lockedCourt === courtNumber
      )).length
      if (lockedCount >= 4) {
        setStatus(`Court ${courtNumber} already has four locked players. Clear a lock first.`)
        return
      }
    }
    setLockedCourts((current) => {
      const next = { ...current }
      if (courtNumber > 0) next[playerName] = courtNumber
      else delete next[playerName]
      return next
    })
    setStatus('')
  }

  async function publishCourts() {
    if (!league || !session) return
    const assignments = courtPlan?.courts || []
    if (!assignments.length) {
      setStatus('Confirm at least four players before building courts.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('tiq_league_weekly_sessions').update({
      roster: selectedPlayers,
      assignments,
      status: 'published',
    }).eq('id', session.id)
    if (error) setStatus(error.message)
    else await loadSession(league.id, playOn)
    setBusy(false)
  }

  async function prepareRecap() {
    if (!league || !session) return
    const recap = buildLeagueWeeklyRecap({
      leagueName: league.leagueName,
      playOn,
      courts: session.assignments || [],
      results: results.filter((result) => isAcceptedLeagueWeeklyResult({ reviewStatus: result.review_status })).map((result) => ({
        courtNumber: result.court_number,
        setNumber: result.set_number,
        sideAGames: result.side_a_games,
        sideBGames: result.side_b_games,
      })),
      stories: responses.map((response) => response.positive_share),
    })
    setRecapDraft(recap)
    await saveRecap('save', recap)
  }

  async function saveRecap(action: 'save' | 'send', draft = recapDraft) {
    if (!league || !session || !authSession?.access_token) return
    setBusy(true)
    setStatus(action === 'send' ? 'Sending the approved recap…' : 'Saving recap draft…')
    try {
      const response = await fetch(`/api/leagues/weekly/sessions/${session.id}/recap`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authSession.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, recap: draft }),
      })
      const payload = await response.json() as { message?: string }
      if (!response.ok) throw new Error(payload.message || 'The recap could not be saved.')
      setStatus(payload.message || 'Recap saved.')
      await loadSession(league.id, playOn)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The recap could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function confirmAndSendRecap() {
    if (!window.confirm('Send this recap to linked league players with email alerts turned on?')) return
    void saveRecap('send')
  }

  function shiftWeek(days: number) {
    const parsed = new Date(`${playOn}T12:00:00`)
    if (Number.isNaN(parsed.getTime())) return
    parsed.setDate(parsed.getDate() + days)
    setPlayOn(localDateKey(parsed))
  }

  async function copyWeeklyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 2400)
    } catch {
      setStatus('Select the player link below and copy it for your text thread.')
    }
  }

  const shareUrl = session && typeof window !== 'undefined' ? `${window.location.origin}/league-week/${session.public_token}` : ''
  const acceptedScoreCount = results.filter((result) => isAcceptedLeagueWeeklyResult({ reviewStatus: result.review_status })).length
  const weeklyStage = !session ? 0 : !session.assignments?.length ? (responses.length ? 1 : 0) : acceptedScoreCount < session.assignments.length * 3 ? 2 : 3
  const outCount = responses.filter((response) => response.response_status === 'out').length
  const responseCount = responses.length
  const waitingResponseCount = Math.max(0, (league?.players.length || 0) - responseCount)
  const responseDeadline = formatWorkspaceDeadline(session?.response_deadline || null)
  const phaseItems = [
    { label: 'Replies', detail: session ? `${responseCount}/${league?.players.length || responseCount}` : 'Not open', href: '#weekly-replies' },
    { label: 'Roster', detail: `${selectedPlayers.length} selected`, href: session ? '#weekly-roster' : '#weekly-replies' },
    { label: 'Courts', detail: `${session?.assignments?.length || 0} ready`, href: session?.assignments?.length ? '#weekly-courts' : session ? '#weekly-courts-plan' : '#weekly-replies' },
    { label: 'Recap', detail: `${acceptedScoreCount} scores`, href: session?.assignments?.length ? '#weekly-recap' : '#weekly-replies' },
  ]
  const commandAction = !session
    ? { label: 'Open player replies', href: '#weekly-replies' }
    : !session.assignments?.length
      ? { label: responseCount ? 'Review replies' : 'Share player link', href: '#weekly-replies' }
      : weeklyStage === 2
        ? { label: 'Review scores', href: '#weekly-courts' }
        : { label: 'Finish recap', href: '#weekly-recap' }

  return (
    <div style={pageStyle} className={styles.workspace}>
      <section className={styles.hero} data-live={session ? 'true' : 'false'}>
        <div className={styles.heroCopy}>
          <Link href="/league-coordinator" className={styles.backLink}><ArrowLeft size={17} />League Office</Link>
          <p style={eyebrowStyle}>{session ? 'This week is live' : 'Plan the week'}</p>
          <h1 style={titleStyle}>{session?.assignments?.length ? `${session.assignments.length} courts. Ready to play.` : session ? `${inPlayers.length} in. ${waitingResponseCount} waiting.` : formatWorkspaceDate(playOn)}</h1>
          <p style={heroSubheadStyle}>{session ? `${league?.leagueName || 'Your league'} · ${formatWorkspaceDate(playOn)} · ${session.status === 'collecting' ? 'Replies open' : session.status === 'completed' ? 'Week complete' : 'Court plan published'}` : 'Collect replies, shape the best courts, and publish one clear league night.'}</p>
          <div className={styles.heroMeta}>
            <span><CalendarBlank size={19} weight="duotone" />{formatWorkspaceDate(playOn)}</span>
            <span><MapPin size={19} weight="duotone" />{league?.defaultFacility || league?.locationLabel || 'League site'}</span>
          </div>
          {session ? (
            <div className={styles.commandMetrics}>
              <span><strong>{inPlayers.length}</strong> in</span>
              <span><strong>{outCount}</strong> out</span>
              <span><strong>{waitingResponseCount}</strong> waiting</span>
              <span><strong>{rosterSummary.openSpots}</strong> spots</span>
            </div>
          ) : null}
          <div className={styles.heroActions}>
            <a href={commandAction.href} className={styles.heroPrimary}>{commandAction.label}<CaretRight size={18} weight="bold" /></a>
            {league ? <button type="button" onClick={() => playerPreviewRef.current?.showModal()} className={styles.heroSecondary}><Eye size={18} />Preview as player</button> : null}
          </div>
          {session ? <p className={styles.deadlineLine}><Bell size={15} weight="fill" />{responseDeadline}</p> : null}
        </div>
        <div className={styles.heroCourt} aria-hidden="true"><PremiumLeagueCourt /></div>
      </section>

      <nav className={styles.phaseRail} aria-label="Weekly planning progress">
        {phaseItems.map((phase, index) => (
          <a key={phase.label} href={phase.href} data-state={index < weeklyStage ? 'done' : index === weeklyStage ? 'active' : 'next'} aria-current={index === weeklyStage ? 'step' : undefined}>
            <span>{index < weeklyStage ? <CheckCircle size={18} weight="fill" /> : index + 1}</span>
            <span className={styles.phaseCopy}><strong>{phase.label}</strong><small>{phase.detail}</small></span>
          </a>
        ))}
      </nav>
      {league ? (
        <dialog ref={playerPreviewRef} className={styles.playerPreviewDialog} aria-label="Preview as player">
          <div className={styles.previewToolbar}><strong>Player preview</strong><button type="button" onClick={() => playerPreviewRef.current?.close()}>Close preview</button></div>
          <WeeklyLeagueResponse
            key={`${league.id}-${playOn}-${session?.status || 'draft'}`}
            token={session?.public_token || ''}
            previewMode
            initialData={{
              league: { name: league.leagueName, logoUrl: league.photoUrl, facility: league.defaultFacility || league.locationLabel, players: league.players, weeklySettings: { collectPlayerStories: league.weeklySettings.collectPlayerStories, startTimes: league.weeklySettings.startTimes } },
              week: { playOn, responseDeadline: session?.response_deadline || null, status: session?.status || 'collecting', roster: session?.roster || [], assignments: session?.assignments || [], results },
            }}
          />
        </dialog>
      ) : null}

      {!leagues.length ? (
        <section style={panelStyle}>
          <h2>Turn on weekly play first</h2>
          <p>Edit a league and enable Weekly rotating doubles. The league name, logo, players, court count, start waves, and optional tools will carry into this workspace.</p>
          <Link href="/league-coordinator#league-setup-form" style={primaryLinkStyle}>Edit league setup</Link>
        </section>
      ) : (
        <>
          <section style={panelStyle} className={styles.weekPicker}>
            <div className={styles.weekPickerHeader}>
              <div><p style={eyebrowStyle}>League night</p><h2>{formatWorkspaceDate(playOn)}</h2></div>
              <div className={styles.weekNav} aria-label="Change week">
                <button type="button" onClick={() => shiftWeek(-7)} aria-label="Previous week"><CaretLeft size={20} weight="bold" /></button>
                <button type="button" onClick={() => shiftWeek(7)} aria-label="Next week"><CaretRight size={20} weight="bold" /></button>
              </div>
            </div>
            <div style={twoColumnStyle}>
              <label style={labelStyle}>League<select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} style={inputStyle}>{leagues.map((record) => <option key={record.id} value={record.id}>{record.leagueName}</option>)}</select></label>
              <label style={labelStyle}>Choose another date<input type="date" value={playOn} onChange={(event) => setPlayOn(event.target.value)} style={inputStyle} /></label>
            </div>
            <LocationDirectionsLink location={league?.defaultFacility || league?.locationLabel} style={weeklyDirectionsStyle} />
            {status ? <p style={noticeStyle}>{status}</p> : null}
          </section>

          {league ? <WeeklyWaveSummary league={league} selectedCount={selectedPlayers.length || inPlayers.length} /> : null}

          {league && userId ? (
            <LeagueOperationsSettings
              key={league.id}
              league={league}
              userId={userId}
              onLeagueUpdated={(updatedLeague) => {
                setLeagues((current) => current.map((record) => record.id === updatedLeague.id ? updatedLeague : record))
              }}
            />
          ) : null}

          {!session ? (
            <section id="weekly-replies" style={panelStyle}>
              <p style={eyebrowStyle}>1 · Open replies</p>
              <h2>Create this week’s player link</h2>
              <p>Players choose in or out. Their optional note and positive share stay with this week.</p>
              {userId ? <button onClick={() => void createSession()} disabled={busy} style={buttonStyle}>{busy ? 'Loading this week…' : 'Open weekly replies'}</button> : <Link href="/login?next=%2Fleague-coordinator%2Fweekly" style={primaryLinkStyle}>Sign in to run the week</Link>}
            </section>
          ) : (
            <>
              <section id="weekly-replies" style={panelStyle}>
                <p style={eyebrowStyle}>1 · Player replies</p>
                <div style={headerStyle}><div><h2>{inPlayers.length} in · {responses.filter((item) => item.response_status === 'out').length} out</h2><p>Share one link with the league. The roster stays editable until you publish courts.</p></div><span style={pillStyle}>{session.status.replace('_', ' ')}</span></div>
                <div style={shareRowStyle}><input readOnly value={shareUrl} style={inputStyle} /><button style={buttonStyle} onClick={() => void copyWeeklyLink()}><Copy size={17} weight="bold" />{linkCopied ? 'Copied — preview ready' : 'Copy player link'}</button></div>
                <p className={styles.sharePreviewNote}><ShareNetwork size={18} weight="duotone" /><span><strong>League-branded text preview</strong>Your league logo, date, site, and “Are you in?” card appear when supported messaging apps unfurl this link.</span></p>
                {league ? <WeeklyCommunicationCenter key={session.id} sessionId={session.id} sessionStatus={session.status} accessToken={authSession?.access_token || ''} league={league} playOn={playOn} shareUrl={shareUrl} responses={responses} selectedPlayers={session.roster || []} assignments={session.assignments || []} /> : null}
              </section>

              <section id="weekly-roster" style={panelStyle}>
                <p style={eyebrowStyle}>2 · Confirm roster</p>
                <div className={styles.rosterHeadline}><UsersThree size={30} weight="duotone" /><h2>{rosterSummary.playingCount} playing · {rosterSummary.openSpots} open · {rosterSummary.waitlistCount} waiting</h2></div>
                <div style={playerGridStyle}>
                  {(league?.players || []).map((player) => {
                    const response = responses.find((item) => item.player_name === player)
                    const selected = selectedPlayers.includes(player)
                    return <div key={player} style={playerStyle}><input aria-label={`Select ${player}`} type="checkbox" checked={selected} onChange={() => togglePlayer(player)} /><span style={{ flex: 1 }}><strong>{player}</strong><small style={{ display: 'block' }}>{response?.response_status || 'No reply'}{response?.note ? ` · ${response.note}` : ''}</small></span>{selected ? <select aria-label={`Lock ${player} to a court`} value={lockedCourts[player] || 0} onChange={(event) => lockPlayerToCourt(player, Number(event.target.value))} style={lockSelectStyle}><option value={0}>{league?.weeklySettings.autoGenerateCourts ? 'Auto court' : 'Roster order'}</option>{Array.from({ length: league?.weeklySettings.courtCount || 0 }, (_, index) => <option key={index + 1} value={index + 1}>Court {index + 1}</option>)}</select> : null}</div>
                  })}
                </div>
                <p style={{ color: '#a7cdf6' }}>{league?.weeklySettings.autoGenerateCourts ? 'Court locks stay fixed. Everyone else is balanced using current TIQ doubles ratings, accepted league results, recent courtmates, attendance, and last week’s court.' : 'Court locks and roster order build this plan. Move any player before publishing.'}</p>
                <div id="weekly-courts-plan" />
                <CourtPlanPreview
                  plan={courtPlan}
                  courtCount={league?.weeklySettings.courtCount || 0}
                  lockedCourts={lockedCourts}
                  busy={busy}
                  onMovePlayer={lockPlayerToCourt}
                  onPublish={() => void publishCourts()}
                />
              </section>

              {session.assignments?.length ? (
                <section id="weekly-courts" style={panelStyle}>
                  <p style={eyebrowStyle}>3 · Courts and scorecards</p>
                  <div style={courtGridStyle}>{session.assignments.map((court) => <article key={court.courtNumber} style={courtStyle}><div style={headerStyle}><h3>Court {court.courtNumber}</h3><span style={pillStyle}>{court.startTime}</span></div>{court.sets.map((set) => {
                    const score = results.find((result) => result.court_number === court.courtNumber && result.set_number === set.setNumber)
                    return <p key={set.setNumber}><strong>Set {set.setNumber}</strong><br />{set.sideA.join(' + ')} vs {set.sideB.join(' + ')}{score ? <small style={{ display: 'block', marginTop: 4, color: score.review_status === 'disputed' ? '#9a3412' : '#126044', fontWeight: 750 }}>{score.side_a_games}–{score.side_b_games} · {score.review_status}{score.submitted_by_name ? ` · recorded by ${score.submitted_by_name}` : ''}</small> : <small style={{ display: 'block', marginTop: 4, color: '#64748b' }}>Score missing</small>}</p>
                  })}</article>)}</div>
                </section>
              ) : null}

              {session.assignments?.length && league && authSession?.access_token ? <WeeklyScoreIntelligencePanel
                sessionId={session.id}
                courts={session.assignments}
                results={results.map((result) => ({ courtNumber: result.court_number, setNumber: result.set_number, sideAGames: result.side_a_games, sideBGames: result.side_b_games, submittedByName: result.submitted_by_name, reviewStatus: result.review_status }))}
                submissions={scoreSubmissions.map((submission) => ({ courtNumber: submission.court_number, setNumber: submission.set_number, sideAGames: submission.side_a_games, sideBGames: submission.side_b_games, submittedByName: submission.submitted_by_name, submittedAt: submission.submitted_at }))}
                scorecards={playerStats}
                accessToken={authSession.access_token}
                onRefresh={() => loadSession(league.id, playOn)}
              /> : null}

              {session.assignments?.length ? (
                <section id="weekly-recap" style={panelStyle}>
                  <p style={eyebrowStyle}>4 · Weekly recap</p>
                  <h2>Celebrate the week, then send it</h2>
                  <p>{results.filter((result) => isAcceptedLeagueWeeklyResult({ reviewStatus: result.review_status })).length} of {session.assignments.length * 3} set scores are official. Generate a starting draft from approved results and player shares, then make it yours.</p>
                  <div style={{ display: 'grid', gap: 12, margin: '16px 0' }}>
                    <label style={labelStyle}>Headline<input value={recapDraft.headline} maxLength={120} onChange={(event) => setRecapDraft((current) => ({ ...current, headline: event.target.value }))} style={inputStyle} placeholder="A competitive night on every court" /></label>
                    <label style={labelStyle}>Summary<textarea value={recapDraft.summary} maxLength={2000} rows={5} onChange={(event) => setRecapDraft((current) => ({ ...current, summary: event.target.value }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Share the results, standout performances, and what made the night memorable." /></label>
                    <label style={labelStyle}>Player moments<textarea value={recapDraft.stories.join('\n')} maxLength={6000} rows={4} onChange={(event) => setRecapDraft((current) => ({ ...current, stories: event.target.value.split('\n').map((story) => story.trim()).filter(Boolean).slice(0, 12) }))} style={{ ...inputStyle, resize: 'vertical' }} placeholder="One positive moment per line" /></label>
                  </div>
                  {session.recap?.sentAt ? <p style={sentNoticeStyle}>Shared with {session.recap.sentCount || 0} linked {session.recap.sentCount === 1 ? 'player' : 'players'} on {new Date(session.recap.sentAt).toLocaleDateString()}. {session.recap.emailCount || 0} received the email.</p> : null}
                  <div style={actionRowStyle}>
                    <button onClick={() => void prepareRecap()} disabled={busy} style={secondaryButtonStyle}>Generate draft</button>
                    <button onClick={() => void saveRecap('save')} disabled={busy || !recapDraft.headline.trim() || !recapDraft.summary.trim()} style={secondaryButtonStyle}>Save draft</button>
                    <button onClick={confirmAndSendRecap} disabled={busy || Boolean(session.recap?.sentAt) || !recapDraft.headline.trim() || !recapDraft.summary.trim()} style={buttonStyle}>{session.recap?.sentAt ? 'Recap sent' : 'Send recap'}</button>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </div>
  )
}

function WeeklyWaveSummary({ league, selectedCount }: { league: TiqLeagueRecord; selectedCount: number }) {
  const capacity = league.weeklySettings.courtCount * 4
  const waveCounts = league.weeklySettings.startTimes.map((time) => ({
    time,
    courts: Array.from({ length: league.weeklySettings.courtCount }, (_, index) => index + 1).filter((court) => (
      league.weeklySettings.startTimes[(court - 1) % league.weeklySettings.startTimes.length] === time
    )),
  }))

  return (
    <section className={styles.waveSummary} aria-labelledby="weekly-wave-title">
      <div className={styles.waveSummaryHeader}>
        <div><p style={eyebrowStyle}>Thursday plan</p><h2 id="weekly-wave-title">Start waves at a glance</h2></div>
        <span>{Math.min(selectedCount, capacity)} of {capacity} spots</span>
      </div>
      <div className={styles.waveCards}>
        {waveCounts.map((wave) => (
          <article key={wave.time}>
            <strong>{formatWorkspaceTime(wave.time)}</strong>
            <span>{formatCourtRange(wave.courts)}</span>
            <small>{wave.courts.length * 4} player capacity</small>
          </article>
        ))}
      </div>
      <div className={styles.capacityTrack} aria-label={`${Math.min(selectedCount, capacity)} of ${capacity} weekly spots filled`}><span style={{ width: `${capacity ? Math.min(100, selectedCount / capacity * 100) : 0}%` }} /></div>
      <p>{Math.max(0, capacity - selectedCount)} spots open across {league.weeklySettings.courtCount} courts.</p>
    </section>
  )
}

function WeeklyCommunicationCenter({
  sessionId,
  sessionStatus,
  accessToken,
  league,
  playOn,
  shareUrl,
  responses,
  selectedPlayers,
  assignments,
}: {
  sessionId: string
  sessionStatus: string
  accessToken: string
  league: TiqLeagueRecord
  playOn: string
  shareUrl: string
  responses: WeeklyResponse[]
  selectedPlayers: string[]
  assignments: LeagueWeeklyCourt[]
}) {
  const [activeKind, setActiveKind] = useState<WeeklyCommunicationKind | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [receipts, setReceipts] = useState<Partial<Record<WeeklyCommunicationKind, { lastSent: string; count: number }>>>({})
  useEffect(() => {
    if (!accessToken) return
    let active = true
    void fetch(`/api/leagues/weekly/sessions/${sessionId}/communications`, { headers: { Authorization: `Bearer ${accessToken}` } }).then(async (response) => {
      if (response.ok && active) setReceipts((await response.json()).receipts || {})
    }).catch(() => {})
    return () => { active = false }
  }, [accessToken, sessionId])
  const replied = new Set(responses.map((response) => response.player_name))
  const waitingPlayers = league.players.filter((player) => !replied.has(player))
  const courtLines = assignments.map((court) => `Court ${court.courtNumber} · ${formatWorkspaceTime(court.startTime)} · ${court.players.join(', ')}`).join('\n')
  const published = ['published', 'completed'].includes(sessionStatus)
  const actions: Array<{ kind: WeeklyCommunicationKind; title: string; detail: string; message: string; disabled: boolean; icon: typeof Bell }> = [
    { kind: 'reminder', title: 'Remind nonresponders', detail: `${waitingPlayers.length} waiting`, message: `${league.leagueName}: are you in for ${formatWorkspaceDate(playOn)}? Reply here: ${shareUrl}`, disabled: sessionStatus !== 'collecting' || !waitingPlayers.length, icon: Bell },
    { kind: 'roster', title: 'Send confirmed roster', detail: published ? `${selectedPlayers.length} confirmed` : 'Publish the court plan first', message: `${league.leagueName} · ${formatWorkspaceDate(playOn)}\nConfirmed roster: ${selectedPlayers.join(', ')}\n${shareUrl}`, disabled: !published, icon: UserCheck },
    { kind: 'courts', title: 'Send court assignments', detail: published ? `${assignments.length} courts ready` : 'Publish the court plan first', message: `${league.leagueName} · ${formatWorkspaceDate(playOn)}\n${courtLines}\n${shareUrl}`, disabled: !published, icon: UsersThree },
    { kind: 'change', title: 'Notify players of changes', detail: 'Update linked league players', message: `${league.leagueName}: the plan for ${formatWorkspaceDate(playOn)} has changed.\n\n${shareUrl}`, disabled: false, icon: ShareNetwork },
  ]

  async function sendUpdate() {
    if (!activeKind || !accessToken || sending) return
    setSending(true)
    setNotice('')
    try {
      const response = await fetch(`/api/leagues/weekly/sessions/${sessionId}/communications`, { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: activeKind, message: draft }) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || 'This update could not be sent.')
      setNotice(payload.message)
      if (payload.lastSent) setReceipts((current) => ({ ...current, [activeKind]: { lastSent: payload.lastSent, count: payload.count } }))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'This update could not be sent.')
    } finally { setSending(false) }
  }

  return (
    <div className={styles.commsCenter}>
      <div className={styles.commsHeading}><div><p style={eyebrowStyle}>Weekly communications</p><h3>Send the right update at the right time.</h3></div><PaperPlaneTilt size={26} weight="duotone" /></div>
      <div className={styles.commsGrid}>
        {actions.map((action) => <div key={action.kind}><action.icon size={21} weight="duotone" /><strong>{action.title}</strong><small>{action.detail}</small><button type="button" style={secondaryButtonStyle} disabled={action.disabled || sending} onClick={() => { setActiveKind(action.kind); setDraft(action.message); setNotice('') }}>Prepare update</button>{receipts[action.kind]?.lastSent ? <small>Last sent {new Date(receipts[action.kind]!.lastSent).toLocaleDateString()} · {receipts[action.kind]!.count} notified</small> : null}</div>)}
      </div>
      {activeKind ? <div className={styles.communicationDraft}><label style={labelStyle}>{actions.find((action) => action.kind === activeKind)?.title}<textarea style={{ ...inputStyle, minHeight: 130 }} value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} /></label><p>Send a TiQ notification to eligible linked players, or copy this message for your group text.</p><div style={actionRowStyle}><button type="button" style={buttonStyle} disabled={sending || !accessToken || !draft.trim()} onClick={() => void sendUpdate()}>{sending ? 'Sending…' : 'Send in TiQ'}</button><button type="button" style={secondaryButtonStyle} onClick={() => void navigator.clipboard.writeText(draft).then(() => setNotice('Message copied. Paste it into your text thread.')).catch(() => setNotice('Select the message above to copy it.'))}>Copy text message</button><button type="button" style={secondaryButtonStyle} disabled={sending} onClick={() => setActiveKind(null)}>Close</button></div></div> : null}
      {notice ? <p role="status" style={noticeStyle}>{notice}</p> : null}
      {league.weeklySettings.leagueChatEnabled ? <div style={{ marginTop: 12 }}><QuickMessageComposer mode="league" triggerLabel="Open league room" subject={`${league.leagueName} · ${formatWorkspaceDate(playOn)}`} body={`Weekly play: ${shareUrl}`} leagueId={league.id} leagueName={league.leagueName} participantNames={league.players} /></div> : null}
    </div>
  )
}

function CourtPlanPreview({
  plan,
  courtCount,
  lockedCourts,
  busy,
  onMovePlayer,
  onPublish,
}: {
  plan: LeagueWeeklyCourtPlan | null
  courtCount: number
  lockedCourts: Record<string, number>
  busy: boolean
  onMovePlayer: (playerName: string, courtNumber: number) => void
  onPublish: () => void
}) {
  if (!plan?.courts.length) {
    return <div style={planEmptyStyle}>Choose at least four players to preview the first court.</div>
  }
  return (
    <div style={planPreviewStyle}>
      <div style={planHeaderStyle}>
        <div>
          <p style={planKickerStyle}>{plan.strategy === 'balanced' ? 'TIQ recommendation' : 'Manual plan'}</p>
          <h3 style={planTitleStyle}>Preview before publishing</h3>
          <p style={planCopyStyle}>{plan.strategy === 'balanced'
            ? 'TIQ doubles ratings set the starting point. Accepted league results carry more weight as each player builds history.'
            : 'Players without a court lock follow the roster order shown above.'}</p>
        </div>
        <span style={planModeStyle}>{plan.strategy === 'balanced' ? 'Balanced' : 'Roster order'}</span>
      </div>

      <div style={planSummaryStyle}>
        <PlanMetric label="Performance spread" value={String(plan.summary.strengthSpread)} />
        <PlanMetric label="TIQ-rated players" value={String(plan.summary.tiqRatedPlayers)} />
        <PlanMetric label="Players with history" value={String(plan.summary.trackedPlayers)} />
        <PlanMetric label="Fresh courtmates" value={String(plan.summary.freshConnections)} />
        <PlanMetric label="Moved courts" value={String(plan.summary.movedPlayers)} />
        <PlanMetric label="Your locks" value={String(plan.summary.lockedPlayers)} />
      </div>

      <div style={planCourtGridStyle}>
        {plan.courts.map((court) => {
          const insight = plan.insights.find((item) => item.courtNumber === court.courtNumber)
          return (
            <article key={court.courtNumber} style={planCourtStyle}>
              <div style={planCourtHeaderStyle}>
                <div><strong>Court {court.courtNumber}</strong><small style={planCourtTimeStyle}>{court.startTime}</small></div>
                <span style={strengthStyle}>Index {insight?.strengthIndex ?? 50}</span>
              </div>
              <div style={planPlayerListStyle}>
                {court.players.map((player) => {
                  const signal = insight?.playerSignals.find((item) => item.playerName === player)
                  return <label key={player} style={planPlayerStyle}>
                    <span><strong style={planPlayerNameStyle}>{player}</strong><small style={planPlayerSignalStyle}>{formatPlayerSignal(signal)}</small>{lockedCourts[player] === court.courtNumber ? <small style={lockedStyle}>Locked here</small> : null}</span>
                    <select aria-label={`Move ${player} to a court`} value={lockedCourts[player] || 0} onChange={(event) => onMovePlayer(player, Number(event.target.value))} style={planMoveSelectStyle}>
                      <option value={0}>{plan.strategy === 'balanced' ? 'TIQ pick' : 'Roster order'}</option>
                      {Array.from({ length: courtCount }, (_, index) => <option key={index + 1} value={index + 1}>Court {index + 1}</option>)}
                    </select>
                  </label>
                })}
              </div>
              <p style={planReasonStyle}>
                {insight?.trackedPlayers || 0}/4 with score history · {insight?.freshConnections || 0} fresh courtmate pairings
                {insight?.movedPlayers.length ? ` · ${insight.movedPlayers.length} moved from last week` : ''}
              </p>
            </article>
          )
        })}
      </div>
      <div style={planActionStyle}>
        <p style={planCopyStyle}>Nothing is shared until you publish this plan.</p>
        <button onClick={onPublish} disabled={busy} style={buttonStyle}>{busy ? 'Publishing…' : 'Publish this court plan'}</button>
      </div>
    </div>
  )
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return <div style={planMetricStyle}><span>{label}</span><strong>{value}</strong></div>
}

function formatPlayerSignal(signal: LeagueWeeklyCourtPlan['insights'][number]['playerSignals'][number] | undefined) {
  if (!signal) return 'TIQ profile not connected'
  const acceptedSets = `${signal.acceptedSets} accepted ${signal.acceptedSets === 1 ? 'set' : 'sets'}`
  if (signal.tiqRating !== null) return `TIQ ${signal.tiqRating.toFixed(2)} · ${acceptedSets}`
  if (signal.acceptedSets) return `League form · ${acceptedSets}`
  return 'TIQ profile not connected'
}

function formatWorkspaceDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`)
  if (!value || Number.isNaN(parsed.getTime())) return 'Build the next league night.'
  return parsed.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })
}

function formatWorkspaceDeadline(value: string | null) {
  if (!value) return 'Set the response deadline when replies open.'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'Response deadline coming soon.'
  return `Replies due ${parsed.toLocaleDateString(undefined, { weekday: 'long' })} at ${parsed.toLocaleTimeString(undefined, { hour: 'numeric', minute: parsed.getMinutes() ? '2-digit' : undefined })}`
}

function formatWorkspaceTime(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return value
  const hour = Number(match[1])
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? 'PM' : 'AM'}`
}

function formatCourtRange(courts: number[]) {
  if (!courts.length) return 'No courts'
  if (courts.length === 1) return `Court ${courts[0]}`
  const consecutive = courts.every((court, index) => index === 0 || court === courts[index - 1] + 1)
  return consecutive ? `Courts ${courts[0]}–${courts.at(-1)}` : `Courts ${courts.join(', ')}`
}

const pageStyle: CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '26px 20px 88px', display: 'grid', gap: 16 }
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }
const eyebrowStyle: CSSProperties = { margin: '0 0 8px', color: '#9be11d', fontWeight: 950, textTransform: 'uppercase', letterSpacing: '.16em', fontSize: 11 }
const titleStyle: CSSProperties = { margin: 0, color: '#fff', fontSize: 'clamp(2.5rem, 7vw, 5.5rem)', lineHeight: .96, letterSpacing: '-.065em' }
const heroSubheadStyle: CSSProperties = { maxWidth: 590, margin: '14px 0 0', color: '#a7cdf6', fontSize: 16, lineHeight: 1.55 }
const panelStyle: CSSProperties = { border: '1px solid rgba(148,190,231,.22)', borderRadius: 22, background: 'linear-gradient(145deg,#0a2442,#071a31)', color: '#fff', padding: 22, boxShadow: '0 18px 55px rgba(0,12,29,.2)' }
const twoColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const labelStyle: CSSProperties = { display: 'grid', gap: 7, color: '#a7cdf6', fontWeight: 850 }
const inputStyle: CSSProperties = { width: '100%', minHeight: 46, border: '1px solid rgba(167,205,246,.28)', borderRadius: 12, padding: '9px 12px', background: '#0a294a', color: '#fff' }
const buttonStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: 0, borderRadius: 13, padding: '12px 17px', background: '#9be11d', color: 'var(--foreground-strong)', fontWeight: 950, cursor: 'pointer' }
const linkStyle: CSSProperties = { color: '#9be11d', fontWeight: 850 }
const primaryLinkStyle: CSSProperties = { ...linkStyle, display: 'inline-block', marginTop: 8 }
const weeklyDirectionsStyle: CSSProperties = { marginTop: 10, borderColor: 'rgba(167,205,246,.4)', color: '#a7cdf6' }
const noticeStyle: CSSProperties = { padding: 12, borderRadius: 10, background: '#fff7dc', color: '#6e5510' }
const pillStyle: CSSProperties = { padding: '5px 9px', borderRadius: 999, background: 'rgba(155,225,29,.12)', color: '#9be11d', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }
const shareRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }
const playerGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, margin: '16px 0' }
const playerStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid rgba(148,190,231,.2)', borderRadius: 13, background: 'rgba(6,23,47,.45)' }
const lockSelectStyle: CSSProperties = { minHeight: 34, maxWidth: 112, border: '1px solid rgba(167,205,246,.28)', borderRadius: 9, padding: '5px 7px', background: '#0a294a', color: '#fff' }
const courtGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }
const courtStyle: CSSProperties = { padding: 16, borderRadius: 15, background: 'rgba(6,23,47,.58)', border: '1px solid rgba(148,190,231,.22)' }
const actionRowStyle: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, border: '1px solid rgba(167,205,246,.35)', background: '#0a294a', color: '#a7cdf6' }
const sentNoticeStyle: CSSProperties = { padding: 12, borderRadius: 10, background: 'rgba(155,225,29,.12)', color: '#9be11d', fontWeight: 800 }
const planEmptyStyle: CSSProperties = { padding: 14, borderRadius: 13, border: '1px dashed rgba(167,205,246,.32)', background: 'rgba(6,23,47,.42)', color: '#a7cdf6', fontSize: 13, fontWeight: 700 }
const planPreviewStyle: CSSProperties = { display: 'grid', gap: 14, minWidth: 0, marginTop: 14, padding: 16, borderRadius: 18, border: '1px solid rgba(155,225,29,.28)', background: 'linear-gradient(145deg,rgba(155,225,29,.07),rgba(6,23,47,.64))' }
const planHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }
const planKickerStyle: CSSProperties = { margin: '0 0 4px', color: '#9be11d', fontSize: 10, fontWeight: 950, letterSpacing: '.1em', textTransform: 'uppercase' }
const planTitleStyle: CSSProperties = { margin: 0, color: '#fff', fontSize: 20 }
const planCopyStyle: CSSProperties = { margin: '5px 0 0', color: '#a7cdf6', fontSize: 12, lineHeight: 1.45 }
const planModeStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 29, padding: '0 10px', borderRadius: 999, background: 'rgba(155,225,29,.12)', color: '#9be11d', fontSize: 10, fontWeight: 950, textTransform: 'uppercase' }
const planSummaryStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 115px), 1fr))', gap: 8 }
const planMetricStyle: CSSProperties = { display: 'grid', gap: 3, minWidth: 0, padding: 10, borderRadius: 11, border: '1px solid rgba(148,190,231,.2)', background: 'rgba(6,23,47,.58)', color: '#8faed0', fontSize: 9, fontWeight: 900, letterSpacing: '.04em', textTransform: 'uppercase' }
const planCourtGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))', gap: 10 }
const planCourtStyle: CSSProperties = { display: 'grid', alignContent: 'start', gap: 10, minWidth: 0, padding: 13, borderRadius: 14, border: '1px solid rgba(148,190,231,.22)', background: '#071b34' }
const planCourtHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }
const planCourtTimeStyle: CSSProperties = { display: 'block', marginTop: 2, color: '#a7cdf6', fontSize: 10, fontWeight: 750 }
const strengthStyle: CSSProperties = { flex: '0 0 auto', padding: '5px 8px', borderRadius: 999, background: 'rgba(167,205,246,.12)', color: '#a7cdf6', fontSize: 10, fontWeight: 900 }
const planPlayerListStyle: CSSProperties = { display: 'grid', gap: 6 }
const planPlayerStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 8, minWidth: 0, padding: '7px 8px', borderRadius: 10, background: 'rgba(10,41,74,.76)' }
const planPlayerNameStyle: CSSProperties = { display: 'block', minWidth: 0, color: '#fff', fontSize: 11, overflowWrap: 'anywhere' }
const planPlayerSignalStyle: CSSProperties = { display: 'block', marginTop: 2, color: '#8faed0', fontSize: 10, fontWeight: 700 }
const lockedStyle: CSSProperties = { display: 'block', marginTop: 2, color: '#9be11d', fontSize: 9, fontWeight: 850 }
const planMoveSelectStyle: CSSProperties = { minHeight: 32, maxWidth: 105, border: '1px solid rgba(167,205,246,.3)', borderRadius: 8, padding: '4px 6px', background: 'var(--shell-chip-bg)', color: '#fff', fontSize: 10 }
const planReasonStyle: CSSProperties = { margin: 0, color: '#8faed0', fontSize: 10, lineHeight: 1.4 }
const planActionStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }
