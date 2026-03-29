'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
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

function ScenarioMeta({ scenario }: { scenario: ScenarioRow }) {
  return (
    <div style={metaGridStyle}>
      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>Scenario</div>
        <div style={metaValueStyle}>{scenario.scenario_name || 'Untitled'}</div>
      </div>

      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>League</div>
        <div style={metaValueStyle}>{scenario.league_name || '—'}</div>
      </div>

      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>Flight</div>
        <div style={metaValueStyle}>{scenario.flight || '—'}</div>
      </div>

      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>Match Date</div>
        <div style={metaValueStyle}>{formatDate(scenario.match_date)}</div>
      </div>

      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>Team</div>
        <div style={metaValueStyle}>{scenario.team_name || '—'}</div>
      </div>

      <div style={metaCardStyle}>
        <div style={metaLabelStyle}>Opponent</div>
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
    <section style={sectionCardStyle}>
      <h3 style={sectionTitleStyle}>{title}</h3>

      {labels.length === 0 ? (
        <p style={mutedTextStyle}>No saved slots found.</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Slot</th>
                <th style={thStyle}>Scenario A</th>
                <th style={thStyle}>Scenario B</th>
                <th style={thStyle}>Changed</th>
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
                    <td style={tdLabelStyle}>{label}</td>
                    <td style={tdStyle}>{leftText}</td>
                    <td style={tdStyle}>{rightText}</td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          ...statusBadgeStyle,
                          background: changed ? '#fff1ef' : '#edf9f1',
                          color: changed ? '#b42318' : '#17663a',
                          border: changed
                            ? '1px solid #f6c7c1'
                            : '1px solid #b7e3c6',
                        }}
                      >
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
  const searchParams = useSearchParams()

  const initialLeague = searchParams.get('league') ?? ''
  const initialFlight = searchParams.get('flight') ?? ''
  const initialTeam = searchParams.get('team') ?? ''
  const initialDate = searchParams.get('date') ?? ''
  const initialLeft = searchParams.get('left') ?? ''
  const initialRight = searchParams.get('right') ?? ''

  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leagueFilter, setLeagueFilter] = useState(initialLeague)
  const [flightFilter, setFlightFilter] = useState(initialFlight)
  const [teamFilter, setTeamFilter] = useState(initialTeam)
  const [dateFilter, setDateFilter] = useState(initialDate)

  const [leftId, setLeftId] = useState(initialLeft)
  const [rightId, setRightId] = useState(initialRight)

  useEffect(() => {
    let mounted = true

    async function loadScenarios() {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from('lineup_scenarios')
        .select(
          `
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
        `
        )
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

    if (!leftStillValid) {
      setLeftId(filteredScenarios[0]?.id ?? '')
    }

    if (!rightStillValid) {
      const nextRight =
        filteredScenarios.find((scenario) => scenario.id !== (leftStillValid ? leftId : filteredScenarios[0]?.id))
          ?.id ??
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

  return (
    <main style={mainStyle}>
      <div style={navRowStyle}>
        <Link href="/" style={navLinkStyle}>
          Home
        </Link>
        <Link href="/rankings" style={navLinkStyle}>
          Rankings
        </Link>
        <Link href="/leagues" style={navLinkStyle}>
          Leagues
        </Link>
        <Link href="/captains-corner" style={navLinkStyle}>
          Captain&apos;s Corner
        </Link>
        <Link href="/captains-corner/lineup-availability" style={navLinkStyle}>
          Availability
        </Link>
        <Link href="/captains-corner/lineup-builder" style={navLinkStyle}>
          Lineup Builder
        </Link>
      </div>

      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <div style={heroBadgeStyle}>Captain Tools</div>
            <h1 style={titleStyle}>Scenario Comparison</h1>
            <p style={subtitleStyle}>
              Compare saved lineup scenarios side by side to see lineup changes,
              opponent changes, and saved notes before match day.
            </p>
          </div>

          <Link href="/captains-corner" style={secondaryButtonStyle}>
            Back to Captain&apos;s Corner
          </Link>
        </div>
      </section>

      <section style={filtersCardStyle}>
        <div style={filtersGridStyle}>
          <div>
            <label style={labelStyle}>League</label>
            <select
              value={leagueFilter}
              onChange={(e) => setLeagueFilter(e.target.value)}
              style={inputStyle}
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
            <label style={labelStyle}>Flight</label>
            <select
              value={flightFilter}
              onChange={(e) => setFlightFilter(e.target.value)}
              style={inputStyle}
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
            <label style={labelStyle}>Team</label>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              style={inputStyle}
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
            <label style={labelStyle}>Match Date</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        <div style={filtersFooterStyle}>
          <span style={mutedTextStyle}>
            {filteredScenarios.length} saved scenario
            {filteredScenarios.length === 1 ? '' : 's'}
          </span>

          <button
            type="button"
            style={clearButtonStyle}
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
      </section>

      {loading ? (
        <section style={sectionCardStyle}>
          <p style={mutedTextStyle}>Loading saved scenarios...</p>
        </section>
      ) : error ? (
        <section style={sectionCardStyle}>
          <p style={errorTextStyle}>Unable to load scenarios: {error}</p>
        </section>
      ) : filteredScenarios.length === 0 ? (
        <section style={sectionCardStyle}>
          <h3 style={sectionTitleStyle}>No saved scenarios found</h3>
          <p style={mutedTextStyle}>
            Save lineup scenarios in the Lineup Builder, then come back here to
            compare them side by side.
          </p>
        </section>
      ) : (
        <>
          <section style={compareGridStyle}>
            <div style={sectionCardStyle}>
              <label style={labelStyle}>Scenario A</label>
              <select
                value={leftId}
                onChange={(e) => setLeftId(e.target.value)}
                style={inputStyle}
              >
                {filteredScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.scenario_name} • {scenario.team_name || '—'} •{' '}
                    {formatDate(scenario.match_date)}
                  </option>
                ))}
              </select>

              {leftScenario && (
                <div style={scenarioMetaWrapStyle}>
                  <ScenarioMeta scenario={leftScenario} />
                </div>
              )}
            </div>

            <div style={sectionCardStyle}>
              <label style={labelStyle}>Scenario B</label>
              <select
                value={rightId}
                onChange={(e) => setRightId(e.target.value)}
                style={inputStyle}
              >
                {filteredScenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.scenario_name} • {scenario.team_name || '—'} •{' '}
                    {formatDate(scenario.match_date)}
                  </option>
                ))}
              </select>

              {rightScenario && (
                <div style={scenarioMetaWrapStyle}>
                  <ScenarioMeta scenario={rightScenario} />
                </div>
              )}
            </div>
          </section>

          {leftScenario && rightScenario && (
            <>
              <SlotComparisonTable
                title="Your Lineup Comparison"
                leftSlots={leftTeamSlots}
                rightSlots={rightTeamSlots}
              />

              <SlotComparisonTable
                title="Opponent Lineup Comparison"
                leftSlots={leftOpponentSlots}
                rightSlots={rightOpponentSlots}
              />

              <section style={notesGridStyle}>
                <div style={sectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Scenario A Notes</h3>
                  <p style={notesTextStyle}>
                    {leftScenario.notes?.trim() || 'No notes saved.'}
                  </p>
                </div>

                <div style={sectionCardStyle}>
                  <h3 style={sectionTitleStyle}>Scenario B Notes</h3>
                  <p style={notesTextStyle}>
                    {rightScenario.notes?.trim() || 'No notes saved.'}
                  </p>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </main>
  )
}

const mainStyle: React.CSSProperties = {
  minHeight: '100vh',
  background:
    'linear-gradient(180deg, #0f1632 0%, #162044 34%, #f6f8fc 34%, #f6f8fc 100%)',
  padding: '24px',
}

const navRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '20px',
}

const navLinkStyle: React.CSSProperties = {
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 600,
  padding: '10px 14px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.10)',
  border: '1px solid rgba(255,255,255,0.14)',
}

const heroCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '22px',
  padding: '28px',
  boxShadow: '0 12px 30px rgba(15, 22, 50, 0.10)',
  marginBottom: '20px',
}

const heroTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
}

const heroBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 12px',
  borderRadius: '999px',
  background: '#eef4ff',
  color: '#255BE3',
  fontWeight: 700,
  fontSize: '0.8rem',
  marginBottom: '14px',
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '2.1rem',
  lineHeight: 1.05,
  color: '#0f1632',
}

const subtitleStyle: React.CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  maxWidth: '820px',
  color: '#5c6784',
  fontSize: '1rem',
  lineHeight: 1.6,
}

const secondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#f7f9ff',
  color: '#0f1632',
  textDecoration: 'none',
  fontWeight: 700,
  border: '1px solid #d7def0',
}

const filtersCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 10px 26px rgba(15, 22, 50, 0.08)',
  border: '1px solid #ebeff8',
  marginBottom: '20px',
}

const filtersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '14px',
}

const filtersFooterStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginTop: '16px',
  flexWrap: 'wrap',
}

const compareGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
  marginBottom: '20px',
}

const notesGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: '20px',
  marginBottom: '20px',
}

const sectionCardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 10px 26px rgba(15, 22, 50, 0.08)',
  border: '1px solid #ebeff8',
  marginBottom: '20px',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: '1.1rem',
  color: '#0f1632',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#0f1632',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #d7def0',
  background: '#ffffff',
  color: '#0f1632',
  fontSize: '0.95rem',
  outline: 'none',
}

const clearButtonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: '10px',
  border: '1px solid #d7def0',
  background: '#ffffff',
  color: '#0f1632',
  fontWeight: 700,
  cursor: 'pointer',
}

const scenarioMetaWrapStyle: React.CSSProperties = {
  marginTop: '16px',
}

const metaGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '10px',
}

const metaCardStyle: React.CSSProperties = {
  background: '#f7f9ff',
  border: '1px solid #e2e8f7',
  borderRadius: '14px',
  padding: '12px',
}

const metaLabelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: '#6d7897',
  marginBottom: '6px',
}

const metaValueStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#0f1632',
  lineHeight: 1.4,
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: 'auto',
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  minWidth: '720px',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '1px solid #e7ebf5',
  color: '#5c6784',
  fontSize: '0.85rem',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const tdStyle: React.CSSProperties = {
  padding: '14px 12px',
  borderBottom: '1px solid #eef2fa',
  color: '#0f1632',
  verticalAlign: 'top',
}

const tdLabelStyle: React.CSSProperties = {
  ...tdStyle,
  fontWeight: 700,
}

const statusBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  fontSize: '0.8rem',
  fontWeight: 700,
}

const notesTextStyle: React.CSSProperties = {
  margin: 0,
  color: '#0f1632',
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
}

const mutedTextStyle: React.CSSProperties = {
  color: '#5c6784',
  margin: 0,
}

const errorTextStyle: React.CSSProperties = {
  color: '#b42318',
  margin: 0,
}