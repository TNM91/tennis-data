import type { CSSProperties } from 'react'
import type { LeagueWeeklyCompetitionView } from '@/lib/league-weekly-player-records'

export default function WeeklyLeagueResultsPanel({
  view,
  loading,
  error,
}: {
  view: LeagueWeeklyCompetitionView | null
  loading: boolean
  error: string
}) {
  return (
    <section id="weekly-league-results" style={panelStyle} aria-labelledby="weekly-league-results-title">
      <div style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Weekly doubles</div>
          <h2 id="weekly-league-results-title" style={titleStyle}>Standings and scorecards</h2>
          <p style={bodyStyle}>Confirmed player scores and league-approved corrections build this table.</p>
        </div>
        <span style={acceptedPillStyle}>Accepted sets only</span>
      </div>

      {loading ? <div style={emptyStyle}>Loading weekly results…</div> : null}
      {!loading && error ? <div role="status" style={errorStyle}>{error}</div> : null}
      {!loading && !error && view ? (
        <>
          <div style={summaryGridStyle}>
            <SummaryMetric label="Weeks" value={view.summary.weeks} />
            <SummaryMetric label="Confirmed sets" value={view.summary.acceptedSets} />
            <SummaryMetric label="Players" value={view.summary.players} />
            <SummaryMetric label="Games played" value={view.summary.totalGames} />
          </div>

          <div style={subsectionStyle}>
            <div style={subsectionHeaderStyle}>
              <div>
                <h3 style={subsectionTitleStyle}>Player standings</h3>
                <p style={subsectionBodyStyle}>Every doubles set counts once for each player on the court.</p>
              </div>
            </div>
            {view.standings.length ? (
              <div style={tableScrollStyle}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      {['Rank', 'Player', 'W', 'L', 'Sets', 'Win %', 'Weeks', 'Game +/-'].map((label) => (
                        <th key={label} style={{ ...headerCellStyle, textAlign: label === 'Player' ? 'left' : 'center' }}>{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {view.standings.map((standing) => (
                      <tr key={standing.playerName}>
                        <td style={rankCellStyle}>{standing.rank}</td>
                        <td style={playerCellStyle}>{standing.playerName}</td>
                        <td style={winCellStyle}>{standing.wins}</td>
                        <td style={metricCellStyle}>{standing.losses}</td>
                        <td style={metricCellStyle}>{standing.setsPlayed}</td>
                        <td style={metricCellStyle}>{standing.winPercentage}%</td>
                        <td style={metricCellStyle}>{standing.weeksPlayed}</td>
                        <td style={standing.gameDifferential >= 0 ? positiveCellStyle : metricCellStyle}>{formatDifferential(standing.gameDifferential)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={emptyStyle}>Standings begin after the first confirmed set.</div>}
          </div>

          <div style={subsectionStyle}>
            <div style={subsectionHeaderStyle}>
              <div>
                <h3 style={subsectionTitleStyle}>Week-by-week scorecards</h3>
                <p style={subsectionBodyStyle}>Open a week to see every accepted court result.</p>
              </div>
            </div>
            {view.weeks.length ? (
              <div style={weekListStyle}>
                {view.weeks.map((week, index) => (
                  <details key={week.sessionId} open={index === 0} style={weekCardStyle}>
                    <summary style={weekSummaryStyle}>
                      <span>
                        <strong style={weekTitleStyle}>{formatPlayDate(week.playOn)}</strong>
                        <small style={weekMetaStyle}>{week.status === 'completed' ? 'Week complete' : 'Results in progress'}</small>
                      </span>
                      <span style={setCountStyle}>{week.acceptedSetCount} {week.acceptedSetCount === 1 ? 'set' : 'sets'}</span>
                    </summary>
                    {week.courts.length ? (
                      <div style={courtGridStyle}>
                        {week.courts.map((court) => (
                          <div key={court.courtNumber} style={courtCardStyle}>
                            <strong style={courtTitleStyle}>Court {court.courtNumber}</strong>
                            {court.sets.map((set) => (
                              <div key={set.setNumber} style={setRowStyle}>
                                <span style={setLabelStyle}>Set {set.setNumber}</span>
                                <span style={sideStyle}>{set.sideA.join(' + ')}</span>
                                <strong style={scoreStyle}>{set.sideAGames}–{set.sideBGames}</strong>
                                <span style={sideStyle}>{set.sideB.join(' + ')}</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : <div style={weekEmptyStyle}>No confirmed scores for this week yet.</div>}
                  </details>
                ))}
              </div>
            ) : <div style={emptyStyle}>Published weeks will appear here.</div>}
          </div>
        </>
      ) : null}
    </section>
  )
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return <div style={summaryCardStyle}><span>{label}</span><strong style={summaryValueStyle}>{value}</strong></div>
}

function formatPlayDate(value: string) {
  if (!value) return 'Date pending'
  const parsed = new Date(`${value}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDifferential(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

const panelStyle: CSSProperties = { display: 'grid', gap: 18, minWidth: 0, padding: 20, borderRadius: 24, border: '1px solid color-mix(in srgb, var(--brand-green) 26%, var(--shell-panel-border) 74%)', background: 'linear-gradient(180deg, color-mix(in srgb, var(--brand-green) 6%, var(--shell-panel-bg) 94%), var(--shell-panel-bg))', boxShadow: 'var(--shadow-soft)' }
const headerStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }
const eyebrowStyle: CSSProperties = { marginBottom: 5, color: 'var(--brand-green)', fontSize: 11, fontWeight: 950, letterSpacing: '0.08em', textTransform: 'uppercase' }
const titleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 'clamp(22px, 4vw, 30px)', lineHeight: 1.1 }
const bodyStyle: CSSProperties = { maxWidth: 680, margin: '7px 0 0', color: 'var(--shell-copy-muted)', fontSize: 14, lineHeight: 1.5 }
const acceptedPillStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 11px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-green) 14%, var(--shell-chip-bg) 86%)', color: 'var(--brand-green)', fontSize: 11, fontWeight: 950, textTransform: 'uppercase' }
const summaryGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 130px), 1fr))', gap: 10 }
const summaryCardStyle: CSSProperties = { display: 'grid', gap: 4, minWidth: 0, padding: 13, borderRadius: 15, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }
const summaryValueStyle: CSSProperties = { color: 'var(--foreground-strong)', fontSize: 22, lineHeight: 1.05 }
const subsectionStyle: CSSProperties = { display: 'grid', gap: 11, minWidth: 0 }
const subsectionHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: 12 }
const subsectionTitleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 18 }
const subsectionBodyStyle: CSSProperties = { margin: '4px 0 0', color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.45 }
const tableScrollStyle: CSSProperties = { minWidth: 0, overflowX: 'auto', borderRadius: 16, border: '1px solid var(--shell-panel-border)' }
const tableStyle: CSSProperties = { width: '100%', minWidth: 680, borderCollapse: 'collapse', background: 'var(--shell-chip-bg)' }
const headerCellStyle: CSSProperties = { padding: '10px 11px', borderBottom: '1px solid var(--shell-panel-border)', color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 950, letterSpacing: '0.05em', textTransform: 'uppercase' }
const metricCellStyle: CSSProperties = { padding: '11px', borderBottom: '1px solid var(--shell-panel-border)', color: 'var(--foreground-strong)', fontSize: 12, fontWeight: 800, textAlign: 'center' }
const rankCellStyle: CSSProperties = { ...metricCellStyle, width: 52, color: 'var(--brand-blue-2)', fontWeight: 950 }
const playerCellStyle: CSSProperties = { ...metricCellStyle, minWidth: 180, textAlign: 'left', fontSize: 13, fontWeight: 950 }
const winCellStyle: CSSProperties = { ...metricCellStyle, color: 'var(--brand-green)', fontWeight: 950 }
const positiveCellStyle: CSSProperties = { ...metricCellStyle, color: 'var(--brand-green)' }
const emptyStyle: CSSProperties = { padding: 16, borderRadius: 15, border: '1px dashed var(--shell-panel-border)', color: 'var(--shell-copy-muted)', fontSize: 13, lineHeight: 1.45 }
const errorStyle: CSSProperties = { ...emptyStyle, borderStyle: 'solid', borderColor: 'color-mix(in srgb, #f59e0b 45%, var(--shell-panel-border) 55%)', color: '#b45309' }
const weekListStyle: CSSProperties = { display: 'grid', gap: 10 }
const weekCardStyle: CSSProperties = { borderRadius: 16, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', overflow: 'hidden' }
const weekSummaryStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 58, padding: '10px 13px', cursor: 'pointer', listStylePosition: 'inside' }
const weekTitleStyle: CSSProperties = { display: 'block', color: 'var(--foreground-strong)', fontSize: 14 }
const weekMetaStyle: CSSProperties = { display: 'block', marginTop: 3, color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 750 }
const setCountStyle: CSSProperties = { flex: '0 0 auto', color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 950 }
const courtGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 10, padding: '0 12px 12px' }
const courtCardStyle: CSSProperties = { display: 'grid', gap: 0, minWidth: 0, padding: 12, borderRadius: 14, border: '1px solid color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-panel-border) 86%)', background: 'var(--shell-panel-bg)' }
const courtTitleStyle: CSSProperties = { paddingBottom: 7, color: 'var(--brand-blue-2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }
const setRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: '42px minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 7, minWidth: 0, padding: '9px 0', borderTop: '1px solid var(--shell-panel-border)' }
const setLabelStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 900 }
const sideStyle: CSSProperties = { minWidth: 0, color: 'var(--foreground-strong)', fontSize: 11, fontWeight: 750, lineHeight: 1.35, overflowWrap: 'anywhere' }
const scoreStyle: CSSProperties = { minWidth: 38, color: 'var(--brand-green)', fontSize: 14, textAlign: 'center' }
const weekEmptyStyle: CSSProperties = { padding: '0 13px 13px', color: 'var(--shell-copy-muted)', fontSize: 12 }
