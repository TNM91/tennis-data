'use client'

import { useState, type CSSProperties } from 'react'
import type { LeagueWeeklyCompetitionView, LeagueWeeklyPlayerInsight } from '@/lib/league-weekly-player-records'

export default function WeeklyLeagueResultsPanel({
  view,
  loading,
  error,
}: {
  view: LeagueWeeklyCompetitionView | null
  loading: boolean
  error: string
}) {
  const [selectedPlayerName, setSelectedPlayerName] = useState('')
  const playerInsights = view?.playerInsights || []
  const selectedPlayer = playerInsights.find((player) => player.playerName === selectedPlayerName) || playerInsights[0] || null

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
                        <td style={playerCellStyle}>
                          <button
                            type="button"
                            aria-pressed={selectedPlayer?.playerName === standing.playerName}
                            aria-label={`View ${standing.playerName}'s league profile`}
                            onClick={() => setSelectedPlayerName(standing.playerName)}
                            style={selectedPlayer?.playerName === standing.playerName ? activePlayerButtonStyle : playerButtonStyle}
                          >
                            {standing.playerName}
                          </button>
                        </td>
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

          {selectedPlayer ? <PlayerInsight player={selectedPlayer} /> : null}

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

function PlayerInsight({ player }: { player: LeagueWeeklyPlayerInsight }) {
  return (
    <section style={playerInsightStyle} aria-labelledby="weekly-player-insight-title">
      <div style={playerInsightHeaderStyle}>
        <div>
          <div style={eyebrowStyle}>Player spotlight</div>
          <h3 id="weekly-player-insight-title" style={playerInsightTitleStyle}>{player.playerName}</h3>
          <p style={subsectionBodyStyle}>Select another player in the standings to compare their league story.</p>
        </div>
        <span style={rankPillStyle}>Rank #{player.rank}</span>
      </div>

      <div style={playerMetricGridStyle}>
        <PlayerMetric label="Record" value={`${player.wins}–${player.losses}`} />
        <PlayerMetric label="Win rate" value={`${player.winPercentage}%`} />
        <PlayerMetric label="Game +/-" value={formatDifferential(player.gameDifferential)} />
        <PlayerMetric label="Current run" value={player.currentStreak ? `${player.currentStreak.count}${player.currentStreak.outcome}` : '—'} />
      </div>

      <div style={insightGridStyle}>
        <div style={insightCardStyle}>
          <div style={insightHeadingRowStyle}>
            <div>
              <strong style={insightTitleStyle}>Recent form</strong>
              <small style={insightLabelStyle}>Last five accepted sets</small>
            </div>
            <div style={formRowStyle} aria-label={player.recentForm.length ? `Recent form ${player.recentForm.join(', ')}` : 'No recent form'}>
              {player.recentForm.length ? player.recentForm.map((outcome, index) => (
                <span key={`${outcome}-${index}`} style={outcome === 'W' ? winBadgeStyle : lossBadgeStyle}>{outcome}</span>
              )) : <span style={mutedValueStyle}>No sets yet</span>}
            </div>
          </div>

          <div style={dividerStyle} />
          <strong style={insightTitleStyle}>Partner combinations</strong>
          {player.partners.length ? (
            <div style={partnerListStyle}>
              {player.partners.map((partner) => (
                <div key={partner.playerName} style={partnerRowStyle}>
                  <span style={partnerNameStyle}>{partner.playerName}</span>
                  <span style={partnerRecordStyle}>{partner.wins}–{partner.losses}</span>
                  <span style={partnerMetaStyle}>{partner.setsPlayed} {partner.setsPlayed === 1 ? 'set' : 'sets'} · {partner.winPercentage}% · {formatDifferential(partner.gameDifferential)}</span>
                </div>
              ))}
            </div>
          ) : <div style={insightEmptyStyle}>Partner results appear after this player records a set.</div>}
        </div>

        <div style={insightCardStyle}>
          <div>
            <strong style={insightTitleStyle}>Weekly court history</strong>
            <small style={insightLabelStyle}>Newest week first</small>
          </div>
          {player.weeks.length ? (
            <div style={historyListStyle}>
              {player.weeks.map((week) => (
                <div key={week.sessionId} style={historyRowStyle}>
                  <div>
                    <strong style={historyDateStyle}>{formatPlayDate(week.playOn)}</strong>
                    <small style={historyMetaStyle}>
                      {week.courtNumbers.length ? week.courtNumbers.map((court) => `Court ${court}`).join(', ') : 'Court pending'}
                      {week.partners.length ? ` · with ${week.partners.join(', ')}` : ''}
                    </small>
                  </div>
                  <div style={historyResultStyle}>
                    <strong>{week.wins}–{week.losses}</strong>
                    <small>{formatDifferential(week.gameDifferential)} games</small>
                  </div>
                </div>
              ))}
            </div>
          ) : <div style={insightEmptyStyle}>Court history begins after this player records a set.</div>}
        </div>
      </div>
    </section>
  )
}

function PlayerMetric({ label, value }: { label: string; value: string }) {
  return <div style={playerMetricStyle}><span>{label}</span><strong>{value}</strong></div>
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
const playerButtonStyle: CSSProperties = { appearance: 'none', width: '100%', padding: '7px 9px', border: '1px solid transparent', borderRadius: 10, background: 'transparent', color: 'var(--foreground-strong)', font: 'inherit', fontWeight: 950, textAlign: 'left', cursor: 'pointer' }
const activePlayerButtonStyle: CSSProperties = { ...playerButtonStyle, border: '1px solid color-mix(in srgb, var(--brand-green) 40%, var(--shell-panel-border) 60%)', background: 'color-mix(in srgb, var(--brand-green) 11%, var(--shell-panel-bg) 89%)', color: 'var(--brand-green)' }
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
const playerInsightStyle: CSSProperties = { display: 'grid', gap: 13, minWidth: 0, padding: 16, borderRadius: 18, border: '1px solid color-mix(in srgb, var(--brand-blue-2) 24%, var(--shell-panel-border) 76%)', background: 'linear-gradient(145deg, color-mix(in srgb, var(--brand-blue-2) 7%, var(--shell-chip-bg) 93%), var(--shell-panel-bg))' }
const playerInsightHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }
const playerInsightTitleStyle: CSSProperties = { margin: 0, color: 'var(--foreground-strong)', fontSize: 21, lineHeight: 1.15 }
const rankPillStyle: CSSProperties = { display: 'inline-flex', alignItems: 'center', minHeight: 30, padding: '0 11px', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-blue-2) 14%, var(--shell-chip-bg) 86%)', color: 'var(--brand-blue-2)', fontSize: 11, fontWeight: 950, textTransform: 'uppercase' }
const playerMetricGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 105px), 1fr))', gap: 8 }
const playerMetricStyle: CSSProperties = { display: 'grid', gap: 3, minWidth: 0, padding: 11, borderRadius: 13, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)', color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 900, letterSpacing: '0.04em', textTransform: 'uppercase' }
const insightGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 10 }
const insightCardStyle: CSSProperties = { display: 'grid', alignContent: 'start', gap: 10, minWidth: 0, padding: 13, borderRadius: 15, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-chip-bg)' }
const insightHeadingRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }
const insightTitleStyle: CSSProperties = { display: 'block', color: 'var(--foreground-strong)', fontSize: 13 }
const insightLabelStyle: CSSProperties = { display: 'block', marginTop: 2, color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 750 }
const formRowStyle: CSSProperties = { display: 'flex', gap: 5, alignItems: 'center' }
const winBadgeStyle: CSSProperties = { display: 'inline-grid', width: 25, height: 25, placeItems: 'center', borderRadius: 999, background: 'color-mix(in srgb, var(--brand-green) 18%, var(--shell-panel-bg) 82%)', color: 'var(--brand-green)', fontSize: 11, fontWeight: 950 }
const lossBadgeStyle: CSSProperties = { ...winBadgeStyle, background: 'color-mix(in srgb, #ef4444 13%, var(--shell-panel-bg) 87%)', color: '#dc2626' }
const mutedValueStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 750 }
const dividerStyle: CSSProperties = { height: 1, background: 'var(--shell-panel-border)' }
const partnerListStyle: CSSProperties = { display: 'grid', gap: 7 }
const partnerRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '2px 10px', minWidth: 0, padding: '9px 10px', borderRadius: 11, background: 'var(--shell-panel-bg)' }
const partnerNameStyle: CSSProperties = { minWidth: 0, color: 'var(--foreground-strong)', fontSize: 12, fontWeight: 900, overflowWrap: 'anywhere' }
const partnerRecordStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 12, fontWeight: 950 }
const partnerMetaStyle: CSSProperties = { gridColumn: '1 / -1', color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 750 }
const insightEmptyStyle: CSSProperties = { padding: 11, borderRadius: 11, border: '1px dashed var(--shell-panel-border)', color: 'var(--shell-copy-muted)', fontSize: 11, lineHeight: 1.4 }
const historyListStyle: CSSProperties = { display: 'grid', gap: 7 }
const historyRowStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, minWidth: 0, padding: '9px 10px', borderRadius: 11, background: 'var(--shell-panel-bg)' }
const historyDateStyle: CSSProperties = { display: 'block', color: 'var(--foreground-strong)', fontSize: 11 }
const historyMetaStyle: CSSProperties = { display: 'block', marginTop: 3, color: 'var(--shell-copy-muted)', fontSize: 10, fontWeight: 700, lineHeight: 1.35, overflowWrap: 'anywhere' }
const historyResultStyle: CSSProperties = { display: 'grid', flex: '0 0 auto', gap: 2, color: 'var(--brand-green)', fontSize: 12, fontWeight: 950, textAlign: 'right' }
