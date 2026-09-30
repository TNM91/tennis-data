'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import QuickMessageComposer from '@/app/components/quick-message-composer'
import LeagueOperationsSettings from './league-operations-settings'
import { supabase } from '@/lib/supabase'
import { listTiqLeagues } from '@/lib/tiq-league-service'
import {
  buildLeagueWeeklyCourts,
  buildLeagueWeeklyPlayerStats,
  buildLeagueWeeklyRecap,
  getLeagueWeeklyRosterSummary,
  type LeagueWeeklyCourt,
  type LeagueWeeklyPlayerStat,
  orderLeagueWeeklyPlayers,
} from '@/lib/league-weekly-format'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'

type WeeklyResponse = {
  player_name: string
  response_status: 'in' | 'out'
  note: string
  positive_share: string
  responded_at: string
}

type WeeklyResult = {
  court_number: number
  set_number: number
  side_a_games: number
  side_b_games: number
}

type WeeklySession = {
  id: string
  public_token: string
  play_on: string
  response_deadline: string | null
  status: 'collecting' | 'roster_confirmed' | 'published' | 'completed'
  roster: string[]
  assignments: LeagueWeeklyCourt[]
  recap: { headline?: string; summary?: string; stories?: string[] }
}

function nextThursday() {
  const date = new Date()
  const distance = (4 - date.getDay() + 7) % 7
  date.setDate(date.getDate() + distance)
  return date.toISOString().slice(0, 10)
}

export default function WeeklyLeagueWorkspace({ initialLeagueId }: { initialLeagueId: string }) {
  const { authResolved, userId } = useAuth()
  const [leagues, setLeagues] = useState<TiqLeagueRecord[]>([])
  const [leagueId, setLeagueId] = useState(initialLeagueId)
  const [playOn, setPlayOn] = useState(nextThursday)
  const [session, setSession] = useState<WeeklySession | null>(null)
  const [responses, setResponses] = useState<WeeklyResponse[]>([])
  const [results, setResults] = useState<WeeklyResult[]>([])
  const [playerStats, setPlayerStats] = useState<LeagueWeeklyPlayerStat[]>([])
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

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
    setSelectedPlayers(Array.isArray(nextSession?.roster) ? nextSession.roster : [])
    if (!nextSession) {
      setResponses([])
      setResults([])
      setBusy(false)
      return
    }
    const [responseResult, scoreResult] = await Promise.all([
      supabase.from('tiq_league_weekly_responses').select('player_name,response_status,note,positive_share,responded_at').eq('session_id', nextSession.id).order('responded_at', { ascending: false }),
      supabase.from('tiq_league_weekly_set_results').select('court_number,set_number,side_a_games,side_b_games').eq('session_id', nextSession.id).order('court_number').order('set_number'),
    ])
    setResponses((responseResult.data || []) as WeeklyResponse[])
    setResults((scoreResult.data || []) as WeeklyResult[])
    const { data: historySessions } = await supabase
      .from('tiq_league_weekly_sessions')
      .select('id,assignments')
      .eq('league_id', targetLeagueId)
      .in('status', ['published', 'completed'])
      .order('play_on', { ascending: false })
      .limit(20)
    const historyIds = (historySessions || []).map((item) => item.id)
    const { data: historyResults } = historyIds.length
      ? await supabase.from('tiq_league_weekly_set_results').select('session_id,court_number,set_number,side_a_games,side_b_games').in('session_id', historyIds)
      : { data: [] }
    const historicalStats = (historySessions || []).flatMap((historicalSession) => buildLeagueWeeklyPlayerStats(
      Array.isArray(historicalSession.assignments) ? historicalSession.assignments as LeagueWeeklyCourt[] : [],
      (historyResults || []).filter((result) => result.session_id === historicalSession.id).map((result) => ({
        courtNumber: result.court_number,
        setNumber: result.set_number,
        sideAGames: result.side_a_games,
        sideBGames: result.side_b_games,
      })),
    ))
    const combined = new Map<string, LeagueWeeklyPlayerStat>()
    for (const stat of historicalStats) {
      const current = combined.get(stat.playerName) || { playerName: stat.playerName, setsPlayed: 0, setsWon: 0, gamesWon: 0, gamesLost: 0, gameDifferential: 0 }
      current.setsPlayed += stat.setsPlayed
      current.setsWon += stat.setsWon
      current.gamesWon += stat.gamesWon
      current.gamesLost += stat.gamesLost
      current.gameDifferential = current.gamesWon - current.gamesLost
      combined.set(stat.playerName, current)
    }
    setPlayerStats(Array.from(combined.values()).sort((a, b) => b.setsWon - a.setsWon || b.gameDifferential - a.gameDifferential))
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
    const orderedPlayers = orderLeagueWeeklyPlayers(selectedPlayers, playerStats)
    const assignments = buildLeagueWeeklyCourts(orderedPlayers, league.weeklySettings)
    if (!assignments.length) {
      setStatus('Confirm at least four players before building courts.')
      return
    }
    setBusy(true)
    const { error } = await supabase.from('tiq_league_weekly_sessions').update({
      roster: orderedPlayers,
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
      results: results.map((result) => ({
        courtNumber: result.court_number,
        setNumber: result.set_number,
        sideAGames: result.side_a_games,
        sideBGames: result.side_b_games,
      })),
      stories: responses.map((response) => response.positive_share),
    })
    setBusy(true)
    const { error } = await supabase.from('tiq_league_weekly_sessions').update({ recap, status: 'completed' }).eq('id', session.id)
    if (error) setStatus(error.message)
    else await loadSession(league.id, playOn)
    setBusy(false)
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
                    return <label key={player} style={playerStyle}><input type="checkbox" checked={selectedPlayers.includes(player)} onChange={() => togglePlayer(player)} /><span><strong>{player}</strong><small>{response?.response_status || 'No reply'}{response?.note ? ` · ${response.note}` : ''}</small></span></label>
                  })}
                </div>
                <button onClick={() => void publishCourts()} disabled={busy} style={buttonStyle}>Confirm roster and publish courts</button>
              </section>

              {session.assignments?.length ? (
                <section style={panelStyle}>
                  <p style={eyebrowStyle}>3 · Courts and scorecards</p>
                  <div style={courtGridStyle}>{session.assignments.map((court) => <article key={court.courtNumber} style={courtStyle}><div style={headerStyle}><h3>Court {court.courtNumber}</h3><span style={pillStyle}>{court.startTime}</span></div>{court.sets.map((set) => <p key={set.setNumber}><strong>Set {set.setNumber}</strong><br />{set.sideA.join(' + ')} vs {set.sideB.join(' + ')}</p>)}</article>)}</div>
                </section>
              ) : null}

              {playerStats.length ? (
                <section style={panelStyle}>
                  <p style={eyebrowStyle}>League scorecards</p>
                  <h2>Performance that can guide next week</h2>
                  <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={{ textAlign: 'left' }}>Player</th><th>Sets</th><th>Won</th><th>Games</th><th>Diff.</th></tr></thead><tbody>{playerStats.map((stat) => <tr key={stat.playerName}><td style={{ padding: '9px 0', fontWeight: 750 }}>{stat.playerName}</td><td style={{ textAlign: 'center' }}>{stat.setsPlayed}</td><td style={{ textAlign: 'center' }}>{stat.setsWon}</td><td style={{ textAlign: 'center' }}>{stat.gamesWon}–{stat.gamesLost}</td><td style={{ textAlign: 'center' }}>{stat.gameDifferential > 0 ? '+' : ''}{stat.gameDifferential}</td></tr>)}</tbody></table></div>
                  <p style={subheadStyle}>Suggested courts start from these scorecards. You can still change the confirmed roster before publishing.</p>
                </section>
              ) : null}

              {session.assignments?.length ? (
                <section style={panelStyle}>
                  <p style={eyebrowStyle}>4 · Weekly recap</p>
                  {session.recap?.summary ? <><h2>{session.recap.headline}</h2><p>{session.recap.summary}</p>{session.recap.stories?.map((story) => <blockquote key={story}>“{story}”</blockquote>)}</> : <p>{results.length} of {session.assignments.length * 3} set scores are in. Player shares appear here with the tennis totals.</p>}
                  <button onClick={() => void prepareRecap()} disabled={busy} style={buttonStyle}>Prepare recap</button>
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
const subheadStyle: CSSProperties = { maxWidth: 720, color: '#52605a', lineHeight: 1.6 }
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
const courtGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(245px, 1fr))', gap: 12 }
const courtStyle: CSSProperties = { padding: 16, borderRadius: 14, background: '#f4f8f5', border: '1px solid #dce4df' }
