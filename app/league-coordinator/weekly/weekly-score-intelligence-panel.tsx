'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import type { LeagueWeeklyCourt } from '@/lib/league-weekly-format'
import { buildLeagueWeeklyDashboard, buildLeagueWeeklyScoreReview, type LeagueWeeklyPlayerScorecard, type LeagueWeeklyReviewedResult, type LeagueWeeklyScoreSubmission } from '@/lib/league-weekly-intelligence'

type ReviewSet = { courtNumber: number; setNumber: number }

export default function WeeklyScoreIntelligencePanel({ sessionId, courts, results, submissions, scorecards, accessToken, onRefresh }: {
  sessionId: string
  courts: LeagueWeeklyCourt[]
  results: LeagueWeeklyReviewedResult[]
  submissions: LeagueWeeklyScoreSubmission[]
  scorecards: LeagueWeeklyPlayerScorecard[]
  accessToken: string
  onRefresh: () => Promise<void>
}) {
  const review = useMemo(() => buildLeagueWeeklyScoreReview(courts, results, submissions), [courts, results, submissions])
  const dashboard = useMemo(() => buildLeagueWeeklyDashboard(courts, results), [courts, results])
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
    if (![sideAGames, sideBGames].every(Number.isInteger) || sideAGames === sideBGames) {
      setMessage('Enter a completed score before approving this set.')
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
                  <input aria-label={`Court ${set.courtNumber} set ${set.setNumber} first side games`} type="number" min={0} max={99} value={drafts[key]?.a ?? current?.sideAGames ?? ''} onChange={(event) => setDrafts((items) => ({ ...items, [key]: { a: event.target.value, b: items[key]?.b ?? String(current?.sideBGames ?? '') } }))} style={scoreInputStyle} />
                  <span>–</span>
                  <input aria-label={`Court ${set.courtNumber} set ${set.setNumber} second side games`} type="number" min={0} max={99} value={drafts[key]?.b ?? current?.sideBGames ?? ''} onChange={(event) => setDrafts((items) => ({ ...items, [key]: { a: items[key]?.a ?? String(current?.sideAGames ?? ''), b: event.target.value } }))} style={scoreInputStyle} />
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
        {dashboard.leaders.length ? <div style={leaderGridStyle}>{dashboard.leaders.map((leader, index) => <article key={leader.playerName} style={leaderCardStyle}><span style={rankStyle}>#{index + 1}</span><strong>{leader.playerName}</strong><small>{leader.setsWon} set wins · {leader.gameDifferential > 0 ? '+' : ''}{leader.gameDifferential} games</small></article>)}</div> : <p>Approved scores will surface this week’s leaders and closest sets.</p>}
      </section>

      {scorecards.length ? <section style={panelStyle}>
        <p style={eyebrowStyle}>Season scorecards</p>
        <h2 style={{ marginTop: 0 }}>Form that can guide next week</h2>
        <div style={{ overflowX: 'auto' }}><table style={tableStyle}><thead><tr><th style={leftCellStyle}>Player</th><th>Weeks</th><th>Sets</th><th>Win %</th><th>Games</th><th>Streak</th></tr></thead><tbody>{scorecards.map((scorecard) => <tr key={scorecard.playerName}><td style={playerCellStyle}>{scorecard.playerName}</td><td style={centerCellStyle}>{scorecard.weeksPlayed}</td><td style={centerCellStyle}>{scorecard.setsPlayed}</td><td style={centerCellStyle}>{scorecard.setWinPercentage}%</td><td style={centerCellStyle}>{scorecard.gameDifferential > 0 ? '+' : ''}{scorecard.gameDifferential}</td><td style={centerCellStyle}>{scorecard.currentWinStreak ? `${scorecard.currentWinStreak}W` : '—'}</td></tr>)}</tbody></table></div>
      </section> : null}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <article style={metricStyle}><strong style={metricValueStyle}>{value}</strong><span style={metricLabelStyle}>{label}</span></article>
}

const panelStyle: CSSProperties = { border: '1px solid #dce4df', borderRadius: 20, background: '#fff', color: '#14231d', padding: 22, boxShadow: '0 10px 35px rgba(24,55,43,.06)' }
const eyebrowStyle: CSSProperties = { margin: '0 0 6px', color: '#23765b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 12 }
const metricGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }
const metricStyle: CSSProperties = { display: 'grid', gap: 3, padding: 14, borderRadius: 14, background: '#f4f8f5', border: '1px solid #dce4df' }
const metricValueStyle: CSSProperties = { fontSize: 25, color: '#126044' }
const metricLabelStyle: CSSProperties = { color: '#52605a', fontSize: 12, fontWeight: 750 }
const reviewCardStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 14, borderRadius: 14, border: '1px solid #ead7c7', background: '#fffaf5' }
const reviewCopyStyle: CSSProperties = { margin: '5px 0 0', color: '#6b5b4f', fontSize: 13 }
const scoreControlStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }
const scoreInputStyle: CSSProperties = { width: 58, minHeight: 40, border: '1px solid #cbd8d1', borderRadius: 9, padding: 7, textAlign: 'center' }
const buttonStyle: CSSProperties = { border: 0, borderRadius: 999, padding: '10px 14px', background: '#126044', color: '#fff', fontWeight: 800, cursor: 'pointer' }
const noticeStyle: CSSProperties = { padding: 11, borderRadius: 10, background: '#fff7dc', color: '#6e5510' }
const successStyle: CSSProperties = { padding: 12, borderRadius: 10, background: '#e7f4ee', color: '#126044', fontWeight: 750 }
const leaderGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 14 }
const leaderCardStyle: CSSProperties = { display: 'grid', gap: 4, padding: 14, border: '1px solid #dce4df', borderRadius: 14 }
const rankStyle: CSSProperties = { color: '#23765b', fontWeight: 900, fontSize: 12 }
const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const leftCellStyle: CSSProperties = { textAlign: 'left' }
const playerCellStyle: CSSProperties = { padding: '9px 0', fontWeight: 750 }
const centerCellStyle: CSSProperties = { textAlign: 'center', padding: '9px 6px' }
