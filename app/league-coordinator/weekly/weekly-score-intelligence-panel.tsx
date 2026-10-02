'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { ROTATING_PARTNER_DOUBLES_FORMAT, validateLeagueWeeklySetScore, type LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { buildLeagueWeeklyDashboard, buildLeagueWeeklyScoreReview, type LeagueWeeklyPlayerScorecard, type LeagueWeeklyReviewedResult, type LeagueWeeklyScoreSubmission } from '@/lib/league-weekly-intelligence'

type ReviewSet = { courtNumber: number; setNumber: number }

export default function WeeklyScoreIntelligencePanel({ sessionId, courts, results, submissions, scorecards, accessToken, onRefresh, showRankings = true }: {
  sessionId: string
  courts: LeagueWeeklyCourt[]
  results: LeagueWeeklyReviewedResult[]
  submissions: LeagueWeeklyScoreSubmission[]
  scorecards: LeagueWeeklyPlayerScorecard[]
  accessToken: string
  onRefresh: () => Promise<void>
  showRankings?: boolean
}) {
  const review = useMemo(() => buildLeagueWeeklyScoreReview(courts, results, submissions), [courts, results, submissions])
  const dashboard = useMemo(() => buildLeagueWeeklyDashboard(courts, results), [courts, results])
  const visibleScorecards = showRankings ? scorecards : [...scorecards].sort((a, b) => a.playerName.localeCompare(b.playerName))
  const [drafts, setDrafts] = useState<Record<string, { a: string; b: string }>>({})
  const [message, setMessage] = useState('')
  const [busyKey, setBusyKey] = useState('')
  const reviewSets = [...review.disputed, ...review.pending, ...review.missing]

  function resultFor(set: ReviewSet) {
    return results.find((result) => result.courtNumber === set.courtNumber && result.setNumber === set.setNumber)
  }

  async function approve(set: ReviewSet) {
    const key = `${set.courtNumber}-${set.setNumber}`
    const current = resultFor(set)
    const sideAGames = Number(drafts[key]?.a ?? current?.sideAGames)
    const sideBGames = Number(drafts[key]?.b ?? current?.sideBGames)
    const validation = validateLeagueWeeklySetScore(sideAGames, sideBGames)
    if (!validation.valid) {
      setMessage(validation.message)
      return
    }
    setBusyKey(key)
    try {
      const response = await fetch(`/api/leagues/weekly/sessions/${sessionId}/scores`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courtNumber: set.courtNumber, setNumber: set.setNumber, sideAGames, sideBGames }),
      })
      const payload = await response.json() as { message?: string }
      setMessage(payload.message || (response.ok ? 'Score approved.' : 'That score could not be approved.'))
      if (response.ok) await onRefresh()
    } catch {
      setMessage('That score could not be approved. Check your connection and try again.')
    } finally {
      setBusyKey('')
    }
  }

  return (
    <>
      <section style={panelStyle}>
        <p style={eyebrowStyle}>Score control</p>
        <p style={reviewCopyStyle}>{ROTATING_PARTNER_DOUBLES_FORMAT.scoringSummary} {ROTATING_PARTNER_DOUBLES_FORMAT.entrySummary}</p>
        <div style={metricGridStyle}>
          <Metric label="Official sets" value={`${review.acceptedCount}/${review.expectedCount}`} />
          <Metric label="Missing" value={review.missing.length} />
          <Metric label="Needs review" value={review.pending.length + review.disputed.length} />
          <Metric label="Player reporters" value={review.submittedPlayerCount} />
        </div>
        {reviewSets.length ? (
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {reviewSets.map((set) => {
              const key = `${set.courtNumber}-${set.setNumber}`
              const current = resultFor(set)
              const setSubmissions = submissions.filter((submission) => submission.courtNumber === set.courtNumber && submission.setNumber === set.setNumber)
              const state = current?.reviewStatus === 'disputed' ? 'Different scores' : current?.reviewStatus === 'pending' ? 'One report' : 'Missing score'
              return <article key={key} style={reviewCardStyle}>
                <div><strong>Court {set.courtNumber} · Set {set.setNumber}</strong><p style={reviewCopyStyle}>{state}{setSubmissions.length ? ` · ${setSubmissions.map((submission) => `${submission.submittedByName}: ${submission.sideAGames}–${submission.sideBGames}`).join(' · ')}` : ''}</p></div>
                <div style={scoreControlStyle}>
                  <input aria-label={`Court ${set.courtNumber} set ${set.setNumber} first side games`} type="number" inputMode="numeric" min={0} max={7} value={drafts[key]?.a ?? current?.sideAGames ?? ''} onChange={(event) => setDrafts((items) => ({ ...items, [key]: { a: event.target.value, b: items[key]?.b ?? String(current?.sideBGames ?? '') } }))} style={scoreInputStyle} />
                  <span>–</span>
                  <input aria-label={`Court ${set.courtNumber} set ${set.setNumber} second side games`} type="number" inputMode="numeric" min={0} max={7} value={drafts[key]?.b ?? current?.sideBGames ?? ''} onChange={(event) => setDrafts((items) => ({ ...items, [key]: { a: items[key]?.a ?? String(current?.sideAGames ?? ''), b: event.target.value } }))} style={scoreInputStyle} />
                  <button disabled={busyKey === key} onClick={() => void approve(set)} style={buttonStyle}>{busyKey === key ? 'Saving…' : current ? 'Approve score' : 'Enter score'}</button>
                </div>
              </article>
            })}
          </div>
        ) : <p style={successStyle}>Every published set has an official score.</p>}
        {message ? <p style={noticeStyle}>{message}</p> : null}
      </section>

      <section style={panelStyle}>
        <p style={eyebrowStyle}>Weekly intelligence</p>
        <h2 style={{ marginTop: 0 }}>What happened on court</h2>
        <div style={metricGridStyle}>
          <Metric label="Games played" value={dashboard.totalGames} />
          <Metric label="Close sets" value={dashboard.closeSets} />
          <Metric label="Completed sets" value={dashboard.completedSets} />
        </div>
        {showRankings ? dashboard.leaders.length ? <div style={leaderGridStyle}>{dashboard.leaders.map((leader, index) => <article key={leader.playerName} style={leaderCardStyle}><span style={rankStyle}>#{index + 1}</span><strong>{leader.playerName}</strong><small>{leader.setsWon} set wins · {leader.gameDifferential > 0 ? '+' : ''}{leader.gameDifferential} games</small></article>)}</div> : <p>Approved scores will surface this week’s leaders and closest sets.</p> : <p>Scores guide balanced courts and player stats. Competitive rankings are off.</p>}
      </section>

      {scorecards.length ? <section style={panelStyle}>
        <p style={eyebrowStyle}>Season scorecards</p>
        <h2 style={{ marginTop: 0 }}>Form that can guide next week</h2>
        <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th style={leftCellStyle}>Player</th><th>Weeks</th><th>Sets</th><th>Win %</th><th>Games</th><th>Streak</th></tr></thead><tbody>{visibleScorecards.map((scorecard) => <tr key={scorecard.playerName}><td style={playerCellStyle}>{scorecard.playerName}</td><td style={centerCellStyle}>{scorecard.weeksPlayed}</td><td style={centerCellStyle}>{scorecard.setsPlayed}</td><td style={centerCellStyle}>{scorecard.setWinPercentage}%</td><td style={centerCellStyle}>{scorecard.gameDifferential > 0 ? '+' : ''}{scorecard.gameDifferential}</td><td style={centerCellStyle}>{scorecard.currentWinStreak ? `${scorecard.currentWinStreak}W` : '—'}</td></tr>)}</tbody></table></div>
      </section> : null}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article style={metricStyle}><strong style={metricValueStyle}>{value}</strong><span style={metricLabelStyle}>{label}</span></article>
}

const panelStyle: CSSProperties = { border: '1px solid rgba(148,190,231,.22)', borderRadius: 22, background: 'linear-gradient(145deg,#0a2442,#071a31)', color: '#fff', padding: 22, boxShadow: '0 18px 55px rgba(0,12,29,.2)' }
const eyebrowStyle: CSSProperties = { margin: '0 0 6px', color: '#9be11d', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.12em', fontSize: 11 }
const metricGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }
const metricStyle: CSSProperties = { display: 'grid', gap: 3, padding: 14, borderRadius: 14, background: 'rgba(6,23,47,.56)', border: '1px solid rgba(148,190,231,.2)' }
const metricValueStyle: CSSProperties = { fontSize: 25, color: '#9be11d' }
const metricLabelStyle: CSSProperties = { color: '#8faed0', fontSize: 12, fontWeight: 750 }
const reviewCardStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 14, borderRadius: 14, border: '1px solid rgba(241,178,116,.3)', background: 'rgba(74,43,24,.24)' }
const reviewCopyStyle: CSSProperties = { margin: '5px 0 0', color: '#c7d8ec', fontSize: 13 }
const scoreControlStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }
const scoreInputStyle: CSSProperties = { width: 58, minHeight: 40, border: '1px solid rgba(167,205,246,.3)', borderRadius: 9, padding: 7, background: '#0a294a', color: '#fff', colorScheme: 'dark', textAlign: 'center' }
const buttonStyle: CSSProperties = { border: 0, borderRadius: 999, padding: '10px 14px', background: '#9be11d', color: 'var(--foreground-strong)', fontWeight: 900, cursor: 'pointer' }
const noticeStyle: CSSProperties = { padding: 11, border: '1px solid rgba(241,198,104,.28)', borderRadius: 10, background: 'rgba(110,85,16,.24)', color: '#f7dc8d' }
const successStyle: CSSProperties = { padding: 12, border: '1px solid rgba(155,225,29,.24)', borderRadius: 10, background: 'rgba(155,225,29,.1)', color: '#c8f478', fontWeight: 750 }
const leaderGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }
const leaderCardStyle: CSSProperties = { display: 'grid', gap: 4, padding: 14, border: '1px solid rgba(148,190,231,.2)', borderRadius: 14, background: 'rgba(6,23,47,.44)' }
const rankStyle: CSSProperties = { color: '#9be11d', fontWeight: 900, fontSize: 12 }
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const leftCellStyle: CSSProperties = { textAlign: 'left' }
const playerCellStyle: CSSProperties = { padding: '9px 0', fontWeight: 750 }
const centerCellStyle: CSSProperties = { textAlign: 'center', padding: '9px 6px' }
