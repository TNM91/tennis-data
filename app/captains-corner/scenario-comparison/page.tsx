'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

type ScenarioRow = {
  id: string
  scenario_name: string
  league_name: string | null
  flight: string | null
  match_date: string | null
  team_name: string | null
  opponent_team: string | null
  slots_json: unknown
  opponent_slots_json: unknown
  notes: string | null
}

type NormalizedSlot = {
  key: string
  label: string
  players: string[]
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString()
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((v) => (v ?? '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function playerNamesFromUnknown(value: unknown): string[] {
  if (!value) return []

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => playerNamesFromUnknown(item))
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>

    const directName =
      cleanText(obj.name) ||
      cleanText(obj.player) ||
      cleanText(obj.player_name)

    if (directName) return [directName]

    return [
      ...(obj.players ? playerNamesFromUnknown(obj.players) : []),
      ...(obj.names ? playerNamesFromUnknown(obj.names) : []),
      ...(obj.roster ? playerNamesFromUnknown(obj.roster) : []),
      ...(obj.player_1 ? playerNamesFromUnknown(obj.player_1) : []),
      ...(obj.player_2 ? playerNamesFromUnknown(obj.player_2) : []),
    ]
  }

  return []
}

function normalizeSlots(raw: unknown): NormalizedSlot[] {
  if (!raw) return []

  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? safeArray(
          (raw as Record<string, unknown>).slots ??
            (raw as Record<string, unknown>).lines ??
            (raw as Record<string, unknown>).courts
        )
      : []

  return rows.map((item, index) => {
    if (typeof item === 'string') {
      return {
        key: `slot-${index}`,
        label: `Slot ${index + 1}`,
        players: item.trim() ? [item.trim()] : [],
      }
    }

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>

      const label =
        cleanText(obj.label) ||
        cleanText(obj.line_name) ||
        cleanText(obj.position) ||
        cleanText(obj.court) ||
        cleanText(obj.line) ||
        `Slot ${index + 1}`

      const players = playerNamesFromUnknown(
        obj.players ??
          obj.player_names ??
          obj.names ??
          obj.roster ??
          [obj.player_1, obj.player_2].filter(Boolean)
      )

      return {
        key: cleanText(obj.id) || `slot-${index}`,
        label,
        players,
      }
    }

    return {
      key: `slot-${index}`,
      label: `Slot ${index + 1}`,
      players: [],
    }
  })
}

function slotsToMap(slots: NormalizedSlot[]) {
  const map = new Map<string, NormalizedSlot>()

  for (const slot of slots) {
    map.set(slot.label, slot)
  }

  return map
}

function countChangedSlots(leftSlots: NormalizedSlot[], rightSlots: NormalizedSlot[]) {
  const leftMap = slotsToMap(leftSlots)
  const rightMap = slotsToMap(rightSlots)

  const labels = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()]))

  return labels.reduce((count, label) => {
    const leftPlayers = leftMap.get(label)?.players ?? []
    const rightPlayers = rightMap.get(label)?.players ?? []

    const leftText = leftPlayers.length ? leftPlayers.join(' / ') : '—'
    const rightText = rightPlayers.length ? rightPlayers.join(' / ') : '—'

    return leftText !== rightText ? count + 1 : count
  }, 0)
}

function ScenarioMeta({ scenario }: { scenario: ScenarioRow }) {
  return (
    <div className="metric-grid" style={metaGridStyle}>
      <div className="metric-card">
        <div className="section-kicker">Scenario</div>
        <div style={metaValueStyle}>{scenario.scenario_name || 'Untitled'}</div>
      </div>

      <div className="metric-card">
        <div className="section-kicker">League</div>
        <div style={metaValueStyle}>{scenario.league_name || '—'}</div>
      </div>

      <div className="metric-card">
        <div className="section-kicker">Flight</div>
        <div style={metaValueStyle}>{scenario.flight || '—'}</div>
      </div>

      <div className="metric-card">
        <div className="section-kicker">Match Date</div>
        <div style={metaValueStyle}>{formatDate(scenario.match_date)}</div>
      </div>

      <div className="metric-card">
        <div className="section-kicker">Team</div>
        <div style={metaValueStyle}>{scenario.team_name || '—'}</div>
      </div>

      <div className="metric-card">
        <div className="section-kicker">Opponent</div>
        <div style={metaValueStyle}>{scenario.opponent_team || '—'}</div>
      </div>
    </div>
  )
}

function SlotComparisonTable({
  title,
  leftSlots,
  rightSlots,
}: {
  title: string
  leftSlots: NormalizedSlot[]
  rightSlots: NormalizedSlot[]
}) {
  const leftMap = slotsToMap(leftSlots)
  const rightMap = slotsToMap(rightSlots)

  const labels = Array.from(
    new Set([...leftMap.keys(), ...rightMap.keys()])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return (
    <section className="surface-card panel-pad">
      <div style={tableHeaderStyle}>
        <div>
          <p className="section-kicker" style={{ marginBottom: 8 }}>
            Comparison table
          </p>
          <h3 className="section-title" style={{ marginBottom: 0 }}>
            {title}
          </h3>
        </div>

        <div className="badge badge-slate">
          {labels.length} slot{labels.length === 1 ? '' : 's'}
        </div>
      </div>

      {labels.length === 0 ? (
        <p style={mutedTextStyle}>No saved slots found.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Slot</th>
                <th>Scenario A</th>
                <th>Scenario B</th>
                <th>Changed</th>
              </tr>
            </thead>
            <tbody>
              {labels.map((label) => {
                const leftPlayers = leftMap.get(label)?.players ?? []
                const rightPlayers = rightMap.get(label)?.players ?? []

                const leftText = leftPlayers.length ? leftPlayers.join(' / ') : '—'
                const rightText = rightPlayers.length ? rightPlayers.join(' / ') : '—'
                const changed = leftText !== rightText

                return (
                  <tr key={label}>
                    <td style={tableLabelCellStyle}>{label}</td>
                    <td>{leftText}</td>
                    <td>{rightText}</td>
                    <td>
                      <span className={changed ? 'badge badge-blue' : 'badge badge-green'}>
                        {changed ? 'Changed' : 'Same'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default function ScenarioComparisonPage() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)

    setLeagueFilter(params.get('league') ?? '')
    setFlightFilter(params.get('flight') ?? '')
    setTeamFilter(params.get('team') ?? '')
    setDateFilter(params.get('date') ?? '')
    setLeftId(params.get('left') ?? '')
    setRightId(params.get('right') ?? '')
  }, [])

  useEffect(() => {
    let mounted = true

    async function loadScenarios() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('lineup_scenarios')
        .select(`
          id,
          scenario_name,
          league_name,
          flight,
          match_date,
          team_name,
          opponent_team,
          slots_json,
          opponent_slots_json,
          notes
        `)
        .order('match_date', { ascending: false })
        .order('scenario_name', { ascending: true })

      if (!mounted) return

      if (error) {
        setError(error.message)
        setScenarios([])
      } else {
        setScenarios((data ?? []) as ScenarioRow[])
      }

      setLoading(false)
    }

    loadScenarios()

    return () => {
      mounted = false
    }
  }, [])

  const leagueOptions = useMemo(
    () => uniqueSorted(scenarios.map((scenario) => scenario.league_name)),
    [scenarios]
  )

  const flightOptions = useMemo(
    () => uniqueSorted(scenarios.map((scenario) => scenario.flight)),
    [scenarios]
  )

  const teamOptions = useMemo(
    () => uniqueSorted(scenarios.map((scenario) => scenario.team_name)),
    [scenarios]
  )

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      const leagueMatch = !leagueFilter || scenario.league_name === leagueFilter
      const flightMatch = !flightFilter || scenario.flight === flightFilter
      const teamMatch = !teamFilter || scenario.team_name === teamFilter
      const dateMatch = !dateFilter || scenario.match_date === dateFilter

      return leagueMatch && flightMatch && teamMatch && dateMatch
    })
  }, [scenarios, leagueFilter, flightFilter, teamFilter, dateFilter])

  useEffect(() => {
    if (!filteredScenarios.length) {
      setLeftId('')
      setRightId('')
      return
    }

    const leftStillValid = filteredScenarios.some((scenario) => scenario.id === leftId)
    const rightStillValid = filteredScenarios.some((scenario) => scenario.id === rightId)

    const safeLeftId = leftStillValid ? leftId : filteredScenarios[0]?.id ?? ''

    if (!leftStillValid) {
      setLeftId(safeLeftId)
    }

    if (!rightStillValid) {
      const nextRight =
        filteredScenarios.find((scenario) => scenario.id !== safeLeftId)?.id ??
        filteredScenarios[1]?.id ??
        filteredScenarios[0]?.id ??
        ''

      setRightId(nextRight)
    }
  }, [filteredScenarios, leftId, rightId])

  const leftScenario =
    filteredScenarios.find((scenario) => scenario.id === leftId) ?? null
  const rightScenario =
    filteredScenarios.find((scenario) => scenario.id === rightId) ?? null

  const leftTeamSlots = normalizeSlots(leftScenario?.slots_json)
  const rightTeamSlots = normalizeSlots(rightScenario?.slots_json)

  const leftOpponentSlots = normalizeSlots(leftScenario?.opponent_slots_json)
  const rightOpponentSlots = normalizeSlots(rightScenario?.opponent_slots_json)

  const teamChangedCount = useMemo(
    () => countChangedSlots(leftTeamSlots, rightTeamSlots),
    [leftTeamSlots, rightTeamSlots]
  )

  const opponentChangedCount = useMemo(
    () => countChangedSlots(leftOpponentSlots, rightOpponentSlots),
    [leftOpponentSlots, rightOpponentSlots]
  )

  return (
    <main className="page-shell">
      <section className="hero-panel">
        <div className="hero-inner">
          <div style={heroGridStyle}>
            <div>
              <div className="badge badge-blue" style={{ marginBottom: 14 }}>
                Captain Tools
              </div>

              <p className="section-kicker" style={{ marginBottom: 10 }}>
                Scenario analysis
              </p>

              <h1 style={heroTitleStyle}>Scenario Comparison</h1>

              <p style={heroTextStyle}>
                Compare saved lineup scenarios side by side to spot lineup changes,
                opponent changes, and note differences before finalizing your
                match-day plan.
              </p>

              <div style={heroButtonRowStyle}>
                <Link href="/captains-corner/lineup-builder" className="button-primary">
                  Open Lineup Builder
                </Link>
                <Link href="/captains-corner" className="button-secondary">
                  Back to Captain&apos;s Corner
                </Link>
              </div>

              <div className="metric-grid" style={heroMetricGridStyle}>
                <div className="metric-card">
                  <div className="section-kicker">Filtered scenarios</div>
                  <div style={metricValueStyle}>
                    {filteredScenarios.length}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Your lineup changes</div>
                  <div style={metricValueStyle}>
                    {leftScenario && rightScenario ? teamChangedCount : '—'}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="section-kicker">Opponent changes</div>
                  <div style={metricValueStyle}>
                    {leftScenario && rightScenario ? opponentChangedCount : '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card panel-pad">
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Comparison workflow
              </p>
              <h2 style={sideHeroTitleStyle}>Filter, select, compare, decide</h2>

              <div style={workflowListStyle}>
                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>1</div>
                  <div>
                    <div style={workflowTitleStyle}>Narrow the scenario set</div>
                    <div style={workflowTextStyle}>
                      Filter by league, flight, team, and date to isolate the right saved versions.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>2</div>
                  <div>
                    <div style={workflowTitleStyle}>Choose Scenario A and B</div>
                    <div style={workflowTextStyle}>
                      Select the two versions you want to evaluate side by side.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>3</div>
                  <div>
                    <div style={workflowTitleStyle}>Review lineup changes</div>
                    <div style={workflowTextStyle}>
                      See which slots changed and compare the supporting notes behind each version.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="surface-card-strong panel-pad">
          <div style={sectionHeaderStyle}>
            <div>
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Scenario filters
              </p>
              <h2 className="section-title" style={{ marginBottom: 8 }}>
                Narrow the comparison set
              </h2>
              <p style={sectionBodyTextStyle}>
                Use filters to isolate the saved scenarios that matter for the current match context.
              </p>
            </div>

            <button
              type="button"
              className="button-ghost"
              onClick={() => {
                setLeagueFilter('')
                setFlightFilter('')
                setTeamFilter('')
                setDateFilter('')
                setLeftId('')
                setRightId('')
              }}
            >
              Clear Filters
            </button>
          </div>

          <div style={filtersGridStyle}>
            <div>
              <label className="label">League</label>
              <select
                value={leagueFilter}
                onChange={(e) => setLeagueFilter(e.target.value)}
                className="select"
              >
                <option value="">All</option>
                {leagueOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Flight</label>
              <select
                value={flightFilter}
                onChange={(e) => setFlightFilter(e.target.value)}
                className="select"
              >
                <option value="">All</option>
                {flightOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Team</label>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="select"
              >
                <option value="">All</option>
                {teamOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Match Date</label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input"
              />
            </div>
          </div>

          <div style={filterFooterStyle}>
            <span className="badge badge-slate">
              {filteredScenarios.length} saved scenario
              {filteredScenarios.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <p style={mutedTextStyle}>Loading saved scenarios...</p>
          </div>
        </section>
      ) : error ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <p style={errorTextStyle}>Unable to load scenarios: {error}</p>
          </div>
        </section>
      ) : filteredScenarios.length === 0 ? (
        <section className="section">
          <div className="surface-card panel-pad">
            <h3 className="section-title" style={{ marginBottom: 10 }}>
              No saved scenarios found
            </h3>
            <p style={mutedTextStyle}>
              Save lineup scenarios in the Lineup Builder, then come back here to compare them side by side.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="section">
            <div style={compareGridStyle}>
              <div className="surface-card panel-pad">
                <div style={comparePanelHeaderStyle}>
                  <div>
                    <p className="section-kicker" style={{ marginBottom: 8 }}>
                      Scenario A
                    </p>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      Left-side scenario
                    </h2>
                  </div>
                  <span className="badge badge-blue">Scenario A</span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="label">Select scenario</label>
                  <select
                    value={leftId}
                    onChange={(e) => setLeftId(e.target.value)}
                    className="select"
                  >
                    {filteredScenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.scenario_name} • {scenario.team_name || '—'} •{' '}
                        {formatDate(scenario.match_date)}
                      </option>
                    ))}
                  </select>
                </div>

                {leftScenario ? (
                  <div style={{ marginTop: 18 }}>
                    <ScenarioMeta scenario={leftScenario} />
                  </div>
                ) : null}
              </div>

              <div className="surface-card panel-pad">
                <div style={comparePanelHeaderStyle}>
                  <div>
                    <p className="section-kicker" style={{ marginBottom: 8 }}>
                      Scenario B
                    </p>
                    <h2 className="section-title" style={{ marginBottom: 0 }}>
                      Right-side scenario
                    </h2>
                  </div>
                  <span className="badge badge-green">Scenario B</span>
                </div>

                <div style={{ marginTop: 16 }}>
                  <label className="label">Select scenario</label>
                  <select
                    value={rightId}
                    onChange={(e) => setRightId(e.target.value)}
                    className="select"
                  >
                    {filteredScenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>
                        {scenario.scenario_name} • {scenario.team_name || '—'} •{' '}
                        {formatDate(scenario.match_date)}
                      </option>
                    ))}
                  </select>
                </div>

                {rightScenario ? (
                  <div style={{ marginTop: 18 }}>
                    <ScenarioMeta scenario={rightScenario} />
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {leftScenario && rightScenario ? (
            <>
              <section className="section">
                <SlotComparisonTable
                  title="Your Lineup Comparison"
                  leftSlots={leftTeamSlots}
                  rightSlots={rightTeamSlots}
                />
              </section>

              <section className="section">
                <SlotComparisonTable
                  title="Opponent Lineup Comparison"
                  leftSlots={leftOpponentSlots}
                  rightSlots={rightOpponentSlots}
                />
              </section>

              <section className="section">
                <div style={notesGridStyle}>
                  <div className="surface-card panel-pad">
                    <p className="section-kicker" style={{ marginBottom: 8 }}>
                      Scenario A
                    </p>
                    <h3 className="section-title" style={{ marginBottom: 14 }}>
                      Saved notes
                    </h3>
                    <p style={notesTextStyle}>
                      {leftScenario.notes?.trim() || 'No notes saved.'}
                    </p>
                  </div>

                  <div className="surface-card panel-pad">
                    <p className="section-kicker" style={{ marginBottom: 8 }}>
                      Scenario B
                    </p>
                    <h3 className="section-title" style={{ marginBottom: 14 }}>
                      Saved notes
                    </h3>
                    <p style={notesTextStyle}>
                      {rightScenario.notes?.trim() || 'No notes saved.'}
                    </p>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </>
      )}
    </main>
  )
}

const heroGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(300px, 0.95fr)',
  gap: '24px',
  alignItems: 'stretch',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(2.15rem, 4vw, 3.1rem)',
  lineHeight: 1.02,
  letterSpacing: '-0.03em',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(255,255,255,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
}

const heroMetricGridStyle: CSSProperties = {
  marginTop: 22,
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
}

const metricValueStyle: CSSProperties = {
  marginTop: 6,
  fontSize: '1.08rem',
  fontWeight: 800,
}

const sideHeroTitleStyle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const workflowRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
  paddingTop: 2,
}

const workflowNumberStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: '.92rem',
  color: '#0f1632',
  background: 'linear-gradient(135deg, #c7ff5e 0%, #7dffb3 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  lineHeight: 1.55,
  fontSize: '.95rem',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'var(--muted-foreground, #667085)',
  lineHeight: 1.65,
  maxWidth: 780,
}

const filtersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
}

const filterFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-start',
  alignItems: 'center',
  gap: '12px',
  marginTop: '16px',
  flexWrap: 'wrap',
}

const compareGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
}

const comparePanelHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
}

const notesGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
}

const metaGridStyle: CSSProperties = {
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '10px',
}

const metaValueStyle: CSSProperties = {
  marginTop: 6,
  fontWeight: 800,
  color: '#0f1632',
  lineHeight: 1.45,
}

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const tableLabelCellStyle: CSSProperties = {
  fontWeight: 800,
  color: '#0f1632',
}

const notesTextStyle: CSSProperties = {
  margin: 0,
  color: '#0f1632',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}

const mutedTextStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  margin: 0,
  lineHeight: 1.65,
}

const errorTextStyle: CSSProperties = {
  color: '#b42318',
  margin: 0,
  lineHeight: 1.65,
}