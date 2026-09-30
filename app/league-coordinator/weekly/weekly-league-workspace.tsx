'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import LeagueOperationsSettings from './league-operations-settings'
import WeeklyScoreIntelligencePanel from './weekly-score-intelligence-panel'
import { supabase } from '@/lib/supabase'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import {
  buildLeagueWeeklyCourts,
  buildLeagueWeeklyRecap,
  getLeagueWeeklyRosterSummary,
  type LeagueWeeklyCourt,
} from '@/lib/league-weekly-format'
import { buildBalancedLeagueWeeklyCourts, buildLeagueWeeklySeasonScorecards, isAcceptedLeagueWeeklyResult, type LeagueWeeklyPlayerScorecard, type LeagueWeeklyReviewedResult } from '@/lib/league-weekly-intelligence'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'

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
  return date.toISOString().slice(0, 10)
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
  const [historyCourts, setHistoryCourts] = useState<LeagueWeeklyCourt[][]>([])
  const [lockedCourts, setLockedCourts] = useState<Record<string, number>>({})
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [recapDraft, setRecapDraft] = useState<RecapDraft>({ headline: '', summary: '', stories: [] })

  const league = useMemo(() => leagues.find((record) => record.id === leagueId) || null, [leagueId, leagues])
  const inPlayers = useMemo(() => responses.filter((response) => response.response_status === 'in').map((response) => response.player_name), [responses])
  const rosterSummary = useMemo(
    () => getLeagueWeeklyRosterSummary(selectedPlayers, league?.weeklySettings || {}),
    [league?.weeklySettings, selectedPlayers],
  )

  const loadSession = useCallback(async (targetLeagueId: string, targetPlayOn: string) => {
    if (!targetLeagueId || !targetPlayOn) return
    setBusy(true)
    const { data, error } = await supabase
      .from('tiq_league_weekly_sessions')
      .select('id,public_token,play_on,response_deadline,status,roster,assignments,recap')
      .eq('league_id', targetLeagueId)
      .eq('play_on', targetPlayOn)
      .maybeSingle()
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
    return () => window.clearTimeout(timeoutId)
  }, [authResolved, leagueId, loadSession, playOn, userId])

  async function createSession() {
    if (!league) return
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
    setSelectedPlayers((current) => current.includes(playerName)
      ? current.filter((name) => name !== playerName)
      : [...current, playerName])
  }

  async function publishCourts() {
    if (!league || !session) return
    const assignments = league.weeklySettings.autoGenerateCourts
      ? buildBalancedLeagueWeeklyCourts({ playerNames: selectedPlayers, settings: league.weeklySettings, scorecards: playerStats, historyCourts, lockedCourts })
      : buildLeagueWeeklyCourts(selectedPlayers, league.weeklySettings)
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

  const shareUrl = session && typeof window !== 'undefined' ? `${window.location.origin}/league-week/${session.public_token}` : ''

  return (
    <main style={pageStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>League Office</p>
          <h1 style={titleStyle}>Run weekly play</h1>
          <p style={heroSubheadStyle}>Collect the in list, confirm the roster, publish staggered courts, then turn scores and player moments into the recap.</p>
        </div>
        <Link href="/league-coordinator" style={linkStyle}>Back to League Office</Link>
      </div>

      {!leagues.length ? (
        <section style={panelStyle}>
          <h2>Turn on weekly play first</h2>
          <p>Edit a league and enable Weekly rotating doubles. The league name, logo, players, court count, start waves, and optional tools will carry into this workspace.</p>
          <Link href="/league-coordinator#league-setup-form" style={primaryLinkStyle}>Edit league setup</Link>
        </section>
      ) : (
        <>
          <section style={panelStyle}>
            <div style={twoColumnStyle}>
              <label style={labelStyle}>League<select value={leagueId} onChange={(event) => setLeagueId(event.target.value)} style={inputStyle}>{leagues.map((record) => <option key={record.id} value={record.id}>{record.leagueName}</option>)}</select></label>
              <label style={labelStyle}>Play date<input type="date" value={playOn} onChange={(event) => setPlayOn(event.target.value)} style={inputStyle} /></label>
            </div>
            {status ? <p style={noticeStyle}>{status}</p> : null}
          </section>

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
            <section style={panelStyle}>
              <p style={eyebrowStyle}>1 · Open replies</p>
              <h2>Create this week’s player link</h2>
              <p>Players choose in or out. Their optional note and positive share stay with this week.</p>
              <button onClick={() => void createSession()} disabled={busy} style={buttonStyle}>{busy ? 'Opening…' : 'Open weekly replies'}</button>
            </section>
          ) : (
            <>
              <section style={panelStyle}>
                <p style={eyebrowStyle}>1 · Player replies</p>
                <div style={headerStyle}><div><h2>{inPlayers.length} in · {responses.filter((item) => item.response_status === 'out').length} out</h2><p>Share one link with the league. The roster stays editable until you publish courts.</p></div><span style={pillStyle}>{session.status.replace('_', ' ')}</span></div>
                <div style={shareRowStyle}><input readOnly value={shareUrl} style={inputStyle} /><button style={buttonStyle} onClick={() => void navigator.clipboard.writeText(shareUrl)}>Copy link</button></div>
                {league?.weeklySettings.leagueChatEnabled ? (
                  <div style={{ marginTop: 12 }}>
                    <QuickMessageComposer
                      mode="league"
                      triggerLabel="Message league room"
                      subject={`${league.leagueName} · ${playOn}`}
                      body={`Weekly play is open for ${playOn}. Reply here: ${shareUrl}`}
                      leagueId={league.id}
                      leagueName={league.leagueName}
                      participantNames={league.players}
                    />
                  </div>
                ) : null}
              </section>

              <section style={panelStyle}>
                <p style={eyebrowStyle}>2 · Confirm roster</p>
                <h2>{rosterSummary.playingCount} playing · {rosterSummary.openSpots} open · {rosterSummary.waitlistCount} waiting</h2>
                <div style={playerGridStyle}>
                  {(league?.players || []).map((player) => {
                    const response = responses.find((item) => item.player_name === player)
                    const selected = selectedPlayers.includes(player)
                    return <div key={player} style={playerStyle}><input aria-label={`Select ${player}`} type="checkbox" checked={selected} onChange={() => togglePlayer(player)} /><span style={{ flex: 1 }}><strong>{player}</strong><small style={{ display: 'block' }}>{response?.response_status || 'No reply'}{response?.note ? ` · ${response.note}` : ''}</small></span>{selected ? <select aria-label={`Lock ${player} to a court`} value={lockedCourts[player] || 0} onChange={(event) => setLockedCourts((current) => ({ ...current, [player]: Number(event.target.value) }))} style={lockSelectStyle}><option value={0}>Auto court</option>{Array.from({ length: league?.weeklySettings.courtCount || 0 }, (_, index) => <option key={index + 1} value={index + 1}>Court {index + 1}</option>)}</select> : null}</div>
                  })}
                </div>
                <p style={{ color: '#52605a' }}>Court locks stay fixed. Everyone else is balanced using approved results, recent courtmates, and last week’s court.</p>
                <button onClick={() => void publishCourts()} disabled={busy} style={buttonStyle}>{league?.weeklySettings.autoGenerateCourts ? 'Generate balanced courts and publish' : 'Confirm roster and publish courts'}</button>
              </section>

              {session.assignments?.length ? (
                <section style={panelStyle}>
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
                <section style={panelStyle}>
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
    </main>
  )
}

const pageStyle: CSSProperties = { maxWidth: 1180, margin: '0 auto', padding: '32px 20px 80px', display: 'grid', gap: 18 }
const headerStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }
const eyebrowStyle: CSSProperties = { margin: '0 0 6px', color: '#23765b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 12 }
const titleStyle: CSSProperties = { margin: 0, fontSize: 'clamp(2rem, 5vw, 4rem)', letterSpacing: '-.05em' }
const heroSubheadStyle: CSSProperties = { maxWidth: 720, color: '#b8c8c0', lineHeight: 1.6 }
const panelStyle: CSSProperties = { border: '1px solid #dce4df', borderRadius: 20, background: '#fff', color: '#14231d', padding: 22, boxShadow: '0 10px 35px rgba(24,55,43,.06)' }
const twoColumnStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }
const labelStyle: CSSProperties = { display: 'grid', gap: 7, fontWeight: 750 }
const inputStyle: CSSProperties = { width: '100%', minHeight: 44, border: '1px solid #cbd8d1', borderRadius: 10, padding: '9px 12px', background: '#fff', color: '#14231d' }
const buttonStyle: CSSProperties = { border: 0, borderRadius: 999, padding: '11px 17px', background: '#126044', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const linkStyle: CSSProperties = { color: '#126044', fontWeight: 800 }
const primaryLinkStyle: CSSProperties = { ...linkStyle, display: 'inline-block', marginTop: 8 }
const noticeStyle: CSSProperties = { padding: 12, borderRadius: 10, background: '#fff7dc', color: '#6e5510' }
const pillStyle: CSSProperties = { padding: '5px 9px', borderRadius: 999, background: '#e7f4ee', color: '#126044', fontSize: 12, fontWeight: 800 }
const shareRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }
const playerGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 10, margin: '16px 0' }
const playerStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: 12, border: '1px solid #dce4df', borderRadius: 12 }
const lockSelectStyle: CSSProperties = { minHeight: 34, maxWidth: 112, border: '1px solid #cbd8d1', borderRadius: 9, padding: '5px 7px', background: '#fff', color: '#14231d' }
const courtGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }
const courtStyle: CSSProperties = { padding: 16, borderRadius: 14, background: '#f4f8f5', border: '1px solid #dce4df' }
const actionRowStyle: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' }
const secondaryButtonStyle: CSSProperties = { ...buttonStyle, background: '#e7f4ee', color: '#126044' }
const sentNoticeStyle: CSSProperties = { padding: 12, borderRadius: 10, background: '#e7f4ee', color: '#126044', fontWeight: 700 }
