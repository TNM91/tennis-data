'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { uniqueSorted } from '@/lib/captain-formatters'
import { normalizeUserRole, isCaptain, type UserRole } from '@/lib/roles'
import SiteShell from '@/app/components/site-shell'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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

type PlayerRow = {
  id: string
  name: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating: number | null
}

type NormalizedSlot = {
  key: string
  label: string
  slotType: 'singles' | 'doubles'
  players: string[]
  playerIds: string[]
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

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function extractPlayers(value: unknown): Array<{ id: string; name: string }> {
  if (!value) return []

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? [{ id: '', name: trimmed }] : []
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractPlayers(item))
  }

  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>

    const directName =
      cleanText(obj.playerName) ||
      cleanText(obj.name) ||
      cleanText(obj.player) ||
      cleanText(obj.player_name)
    const directId = cleanText(obj.playerId) || cleanText(obj.id)

    if (directName) return [{ id: directId, name: directName }]

    return [
      ...(obj.players ? extractPlayers(obj.players) : []),
      ...(obj.names ? extractPlayers(obj.names) : []),
      ...(obj.roster ? extractPlayers(obj.roster) : []),
      ...(obj.player_1 ? extractPlayers(obj.player_1) : []),
      ...(obj.player_2 ? extractPlayers(obj.player_2) : []),
    ]
  }

  return []
}

function inferSlotType(label: string, count: number): 'singles' | 'doubles' {
  const lower = label.toLowerCase()
  if (lower.includes('double') || lower.includes('court')) return 'doubles'
  return count >= 2 ? 'doubles' : 'singles'
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
        slotType: 'singles',
        players: item.trim() ? [item.trim()] : [],
        playerIds: [],
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

      const extracted = extractPlayers(
        obj.players ??
          obj.player_names ??
          obj.names ??
          obj.roster ??
          [obj.player_1, obj.player_2].filter(Boolean)
      )

      return {
        key: cleanText(obj.id) || `slot-${index}`,
        label,
        slotType: inferSlotType(label, extracted.length),
        players: extracted.map((p) => p.name).filter(Boolean),
        playerIds: extracted.map((p) => p.id).filter(Boolean),
      }
    }

    return {
      key: `slot-${index}`,
      label: `Slot ${index + 1}`,
      slotType: 'singles',
      players: [],
      playerIds: [],
    }
  })
}

function slotsToMap(slots: NormalizedSlot[]) {
  const map = new Map<string, NormalizedSlot>()
  for (const slot of slots) map.set(slot.label, slot)
  return map
}

function strengthForSlot(slot: NormalizedSlot | undefined, players: PlayerRow[]) {
  if (!slot) return null
  const resolved = slot.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as PlayerRow[]

  if (!resolved.length) return null

  if (slot.slotType === 'singles') {
    const p = resolved[0]
    return p.singles_dynamic_rating ?? p.overall_dynamic_rating
  }

  const values = resolved
    .map((p) => p.doubles_dynamic_rating ?? p.overall_dynamic_rating)
    .filter((v): v is number => typeof v === 'number')

  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function compareSlots(leftSlots: NormalizedSlot[], rightSlots: NormalizedSlot[], players: PlayerRow[]) {
  const leftMap = slotsToMap(leftSlots)
  const rightMap = slotsToMap(rightSlots)
  const labels = Array.from(new Set([...leftMap.keys(), ...rightMap.keys()])).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  )

  const rows = labels.map((label) => {
    const leftSlot = leftMap.get(label)
    const rightSlot = rightMap.get(label)

    const leftPlayers = leftSlot?.players ?? []
    const rightPlayers = rightSlot?.players ?? []
    const leftText = leftPlayers.length ? leftPlayers.join(' / ') : '—'
    const rightText = rightPlayers.length ? rightPlayers.join(' / ') : '—'
    const changed = leftText !== rightText

    const leftStrength = strengthForSlot(leftSlot, players)
    const rightStrength = strengthForSlot(rightSlot, players)
    const diff =
      typeof leftStrength === 'number' && typeof rightStrength === 'number'
        ? leftStrength - rightStrength
        : null

    return {
      label,
      leftText,
      rightText,
      changed,
      leftStrength,
      rightStrength,
      diff,
    }
  })

  const changedCount = rows.filter((row) => row.changed).length
  const comparable = rows.filter((row) => typeof row.diff === 'number')
  const avgDiff = comparable.length
    ? comparable.reduce((sum, row) => sum + (row.diff ?? 0), 0) / comparable.length
    : 0

  return {
    rows,
    changedCount,
    avgDiff,
    projection: 1 / (1 + Math.exp(-avgDiff * 3.2)),
    biggestSwing:
      comparable.sort((a, b) => Math.abs(b.diff ?? 0) - Math.abs(a.diff ?? 0))[0] ?? null,
  }
}


async function writeScenarioFeedEvents({
  team,
  league,
  flight,
  projection,
  biggestSwing,
  changedCount,
}: {
  team: string
  league: string
  flight: string
  projection: number
  biggestSwing: { label: string; diff: number | null } | null
  changedCount: number
}) {
  const cleanTeam = cleanText(team)
  if (!cleanTeam) return

  const cleanLeague = cleanText(league)
  const cleanFlight = cleanText(flight)
  const teamId = `${cleanTeam}__${cleanLeague}__${cleanFlight}`

  const events: Array<{
    event_type: string
    entity_type: 'team'
    entity_id: string
    entity_name: string
    subtitle: string | null
    title: string
    body: string | null
  }> = []

  events.push({
    event_type: 'scenario_decision',
    entity_type: 'team',
    entity_id: teamId,
    entity_name: cleanTeam,
    subtitle: [cleanLeague, cleanFlight].filter(Boolean).join(' · ') || null,
    title: 'Scenario decision made',
    body: `Projection: ${Math.round(projection * 100)}%`,
  })

  if (Math.abs(projection - 0.5) < 0.05) {
    events.push({
      event_type: 'scenario_low_confidence',
      entity_type: 'team',
      entity_id: teamId,
      entity_name: cleanTeam,
      subtitle: [cleanLeague, cleanFlight].filter(Boolean).join(' · ') || null,
      title: 'Low confidence scenario',
      body: 'Scenarios are very close and still need captain judgment.',
    })
  }

  if (biggestSwing?.label) {
    events.push({
      event_type: 'scenario_swing_match',
      entity_type: 'team',
      entity_id: teamId,
      entity_name: cleanTeam,
      subtitle: [cleanLeague, cleanFlight].filter(Boolean).join(' · ') || null,
      title: `Swing match: ${biggestSwing.label}`,
      body:
        typeof biggestSwing.diff === 'number'
          ? `Projected swing impact: ${biggestSwing.diff >= 0 ? '+' : ''}${biggestSwing.diff.toFixed(2)}`
          : 'Key deciding court identified in the comparison.',
    })
  }

  if (changedCount > 3) {
    events.push({
      event_type: 'scenario_gap_alert',
      entity_type: 'team',
      entity_id: teamId,
      entity_name: cleanTeam,
      subtitle: [cleanLeague, cleanFlight].filter(Boolean).join(' · ') || null,
      title: 'High lineup volatility',
      body: `${changedCount} comparison changes detected across the two saved scenarios.`,
    })
  }

  if (!events.length) return

  const { error } = await supabase.from('my_lab_feed').insert(events)
  if (error) {
    throw new Error(`Failed to write scenario feed events: ${error.message}`)
  }
}


export default function ScenarioComparisonPage() {
  const router = useRouter()

  const [role, setRole] = useState<UserRole>('public')
  const [authLoading, setAuthLoading] = useState(true)

  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')
  const [leftId, setLeftId] = useState('')
  const [rightId, setRightId] = useState('')
  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      try {
        const { data } = await supabase.auth.getUser()
        const user = data.user

        if (!user) {
          if (mounted) {
            setRole('public')
            setAuthLoading(false)
          }
          router.replace('/login?next=/captain/scenario-builder')
          return
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        const normalized = normalizeUserRole(profile?.role)

        if (!mounted) return
        setRole(normalized)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }

    void loadRole()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadRole()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router])

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
    if (authLoading || role === 'public') return

    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      const [scenarioResult, playersResult] = await Promise.all([
        supabase
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
          .order('scenario_name', { ascending: true }),
        supabase
          .from('players')
          .select(`
            id,
            name,
            singles_dynamic_rating,
            doubles_dynamic_rating,
            overall_dynamic_rating
          `)
          .order('name', { ascending: true }),
      ])

      if (!mounted) return

      if (scenarioResult.error) {
        setError(scenarioResult.error.message)
      } else if (playersResult.error) {
        setError(playersResult.error.message)
      } else {
        setScenarios((scenarioResult.data ?? []) as ScenarioRow[])
        setPlayers((playersResult.data ?? []) as PlayerRow[])
      }

      setLoading(false)
    }

    void load()

    return () => {
      mounted = false
    }
  }, [authLoading, role])

  const leagueOptions = useMemo(() => uniqueSorted(scenarios.map((scenario) => scenario.league_name)), [scenarios])
  const flightOptions = useMemo(() => uniqueSorted(scenarios.map((scenario) => scenario.flight)), [scenarios])
  const teamOptions = useMemo(() => uniqueSorted(scenarios.map((scenario) => scenario.team_name)), [scenarios])

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

    const leftValid = filteredScenarios.some((scenario) => scenario.id === leftId)
    const rightValid = filteredScenarios.some((scenario) => scenario.id === rightId)

    const nextLeft = leftValid ? leftId : filteredScenarios[0]?.id ?? ''
    if (!leftValid) setLeftId(nextLeft)

    if (!rightValid) {
      const nextRight =
        filteredScenarios.find((scenario) => scenario.id !== nextLeft)?.id ??
        filteredScenarios[1]?.id ??
        filteredScenarios[0]?.id ??
        ''
      setRightId(nextRight)
    }
  }, [filteredScenarios, leftId, rightId])

  const leftScenario = filteredScenarios.find((scenario) => scenario.id === leftId) ?? null
  const rightScenario = filteredScenarios.find((scenario) => scenario.id === rightId) ?? null

  const leftTeamSlots = normalizeSlots(leftScenario?.slots_json)
  const rightTeamSlots = normalizeSlots(rightScenario?.slots_json)
  const leftOpponentSlots = normalizeSlots(leftScenario?.opponent_slots_json)
  const rightOpponentSlots = normalizeSlots(rightScenario?.opponent_slots_json)

  const yourComparison = useMemo(
    () => compareSlots(leftTeamSlots, rightTeamSlots, players),
    [leftTeamSlots, rightTeamSlots, players]
  )

  const opponentComparison = useMemo(
    () => compareSlots(leftOpponentSlots, rightOpponentSlots, players),
    [leftOpponentSlots, rightOpponentSlots, players]
  )

  const overallProjection = useMemo(() => {
    const combinedDiff = (yourComparison.avgDiff - opponentComparison.avgDiff) / 2
    return 1 / (1 + Math.exp(-combinedDiff * 3.2))
  }, [yourComparison.avgDiff, opponentComparison.avgDiff])

  const premiumEnabled = isCaptain(role)

  const builderHref = (scenarioId: string) => {
    const params = new URLSearchParams()
    params.set('scenario', scenarioId)
    params.set('source', 'scenario')
    if (leagueFilter) params.set('league', leagueFilter)
    if (flightFilter) params.set('flight', flightFilter)
    if (teamFilter) params.set('team', teamFilter)
    if (dateFilter) params.set('date', dateFilter)
    return `/captain/lineup-builder?${params.toString()}`
  }

  if (authLoading) {
    return (
      <SiteShell active="/captain">
        <section style={pageContentStyle}>
          <section style={surfaceCard}>
            <p style={mutedTextStyle}>Loading scenario builder...</p>
          </section>
        </section>
      </SiteShell>
    )
  }

  if (role === 'public') return null

  return (
    <SiteShell active="/captain">
      <section style={pageContentStyle}>
        <section style={heroShellResponsive(isTablet, isMobile)}>
          <div>
            <div style={eyebrow}>Captain tools</div>
            <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Scenario Comparison</h1>
            <p style={heroTextStyle}>
              Compare saved lineup scenarios side by side, see where the lineup changed, identify
              the biggest swing lines, and decide which version gives you the strongest overall edge.
            </p>

            <div style={heroButtonRowStyle}>
              <Link href="/captain/lineup-builder" style={primaryButton}>
                Open Lineup Builder
              </Link>
              <Link href="/captain" style={ghostButton}>
                Back to Captain Console
              </Link>
            </div>

            <div style={heroMetricGridStyle(isSmallMobile)}>
              <MetricStat label="Filtered scenarios" value={String(filteredScenarios.length)} />
              <MetricStat
                label="Your lineup changes"
                value={leftScenario && rightScenario ? String(yourComparison.changedCount) : '—'}
              />
              <MetricStat
                label="Opponent changes"
                value={leftScenario && rightScenario ? String(opponentComparison.changedCount) : '—'}
              />
            </div>
          </div>

          <div style={quickStartCard}>
            <p style={sectionKicker}>Decision support</p>
            <h2 style={quickStartTitle}>Find the version you actually want to field</h2>
            <div style={workflowListStyle}>
              {[
                ['1', 'Filter the saved set', 'Narrow by league, flight, team, and date so only relevant versions remain.'],
                ['2', 'Compare A vs B', 'Line-by-line changes, strength differences, and notes all in one view.'],
                ['3', 'Send the winner back', 'Jump back to the builder with the scenario you want to keep iterating.'],
              ].map(([step, title, text]) => (
                <div key={step} style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>{step}</div>
                  <div>
                    <div style={workflowTitleStyle}>{title}</div>
                    <div style={workflowTextStyle}>{text}</div>
                  </div>
                </div>
              ))}
            </div>

            {!premiumEnabled ? (
              <div style={{ marginTop: 18 }}>
                <span style={warnPill}>Preview mode</span>
              </div>
            ) : null}
          </div>
        </section>

        <section style={contentWrap}>
          <section style={surfaceCardStrong}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Scenario filters</p>
                <h2 style={sectionTitle}>Narrow the comparison set</h2>
                <p style={sectionBodyTextStyle}>
                  Use filters to isolate the saved scenarios that matter for the current match context.
                </p>
              </div>

              <button
                type="button"
                style={ghostButtonSmallButton}
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
                <label htmlFor="scenario-builder-league-filter" style={labelStyle}>League</label>
                <select id="scenario-builder-league-filter" value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {leagueOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scenario-builder-flight-filter" style={labelStyle}>Flight</label>
                <select id="scenario-builder-flight-filter" value={flightFilter} onChange={(e) => setFlightFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {flightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scenario-builder-team-filter" style={labelStyle}>Team</label>
                <select id="scenario-builder-team-filter" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={inputStyle}>
                  <option value="">All</option>
                  {teamOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="scenario-builder-date-filter" style={labelStyle}>Match Date</label>
                <input
                  id="scenario-builder-date-filter"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={filterFooterStyle}>
              <span style={miniPillSlate}>
                {filteredScenarios.length} saved scenario{filteredScenarios.length === 1 ? '' : 's'}
              </span>
            </div>
          </section>

          {loading ? (
            <section style={surfaceCard}>
              <p style={mutedTextStyle}>Loading saved scenarios...</p>
            </section>
          ) : error ? (
            <section style={surfaceCard}>
              <p style={errorTextStyle}>Unable to load scenarios: {error}</p>
            </section>
          ) : filteredScenarios.length === 0 ? (
            <section style={surfaceCard}>
              <h3 style={sectionTitle}>No saved scenarios found</h3>
              <p style={mutedTextStyle}>
                Save lineup scenarios in the Lineup Builder, then come back here to compare them side by side.
              </p>
              <p style={mutedTextStyle}>
                If you already saved one, clear the filters above or reopen the builder with the same team and match context before comparing.
              </p>
              <div style={heroButtonRowStyle}>
                <Link href="/captain/lineup-builder" style={primaryButtonSmall}>
                  Start in lineup builder
                </Link>
                <Link href="/captain" style={ghostButtonSmall}>
                  Return to captain console
                </Link>
              </div>
            </section>
          ) : (
            <>
              <section style={compareGridResponsive(isTablet)}>
                <ScenarioPanel
                  title="Scenario A"
                  badgeStyle={miniPillBlue}
                  selectedId={leftId}
                  onChange={setLeftId}
                  scenarios={filteredScenarios}
                  scenario={leftScenario}
                  builderHref={leftScenario ? builderHref(leftScenario.id) : '/captain/lineup-builder'}
                />

                <ScenarioPanel
                  title="Scenario B"
                  badgeStyle={miniPillGreen}
                  selectedId={rightId}
                  onChange={setRightId}
                  scenarios={filteredScenarios}
                  scenario={rightScenario}
                  builderHref={rightScenario ? builderHref(rightScenario.id) : '/captain/lineup-builder'}
                />
              </section>

              {leftScenario && rightScenario ? (
                <>
                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Scenario change digest</p>
                        <h3 style={sectionTitleSmall}>What actually changed between versions</h3>
                      </div>
                      <span style={miniPillSlate}>
                        {yourComparison.changedCount + opponentComparison.changedCount} total deltas
                      </span>
                    </div>

                    <div style={changeDigestGridStyle}>
                      <div style={changeDigestCardStyle}>
                        <div style={changeDigestLabelStyle}>Your lineup</div>
                        <div style={changeDigestValueStyle}>
                          {yourComparison.changedCount === 0
                            ? 'No changes'
                            : `${yourComparison.changedCount} changed slot${yourComparison.changedCount === 1 ? '' : 's'}`}
                        </div>
                        <div style={changeDigestTextStyle}>
                          {yourComparison.changedCount === 0
                            ? 'Both saved versions use the same lineup on your side.'
                            : 'These are the internal lineup shifts driving the difference between your compared versions.'}
                        </div>
                      </div>

                      <div style={changeDigestCardStyle}>
                        <div style={changeDigestLabelStyle}>Opponent assumptions</div>
                        <div style={changeDigestValueStyle}>
                          {opponentComparison.changedCount === 0
                            ? 'No changes'
                            : `${opponentComparison.changedCount} changed slot${opponentComparison.changedCount === 1 ? '' : 's'}`}
                        </div>
                        <div style={changeDigestTextStyle}>
                          {opponentComparison.changedCount === 0
                            ? 'Your opponent projection is stable across both versions.'
                            : 'These opponent-side changes are affecting the matchup readout the most.'}
                        </div>
                      </div>

                      <div style={changeDigestCardStyle}>
                        <div style={changeDigestLabelStyle}>Fastest explanation</div>
                        <div style={changeDigestValueStyle}>
                          {yourComparison.biggestSwing?.label || opponentComparison.biggestSwing?.label || 'No major swing slot'}
                        </div>
                        <div style={changeDigestTextStyle}>
                          Start with the largest swing slot first when you need to explain why one version is leading.
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Decision scoreboard</p>
                        <h3 style={sectionTitleSmall}>A faster read on which version is ahead</h3>
                      </div>
                      <span style={overallProjection >= 0.5 ? miniPillBlue : miniPillGreen}>
                        {overallProjection >= 0.5 ? 'Scenario A ahead' : 'Scenario B ahead'}
                      </span>
                    </div>

                    <div style={scoreboardGridStyle}>
                      <div style={scoreboardCardStyle}>
                        <div style={scoreboardLabelStyle}>Scenario A</div>
                        <div style={scoreboardValueStyle}>{Math.round(overallProjection * 100)}%</div>
                        <div style={scoreboardTextStyle}>
                          Combined comparison readout for the left-side scenario.
                        </div>
                      </div>

                      <div style={scoreboardCardStyle}>
                        <div style={scoreboardLabelStyle}>Scenario B</div>
                        <div style={scoreboardValueStyle}>{100 - Math.round(overallProjection * 100)}%</div>
                        <div style={scoreboardTextStyle}>
                          Combined comparison readout for the right-side scenario.
                        </div>
                      </div>

                      <div style={scoreboardCardStyle}>
                        <div style={scoreboardLabelStyle}>Largest swing court</div>
                        <div style={scoreboardValueStyle}>
                          {yourComparison.biggestSwing?.label || opponentComparison.biggestSwing?.label || 'No major swing'}
                        </div>
                        <div style={scoreboardTextStyle}>
                          Start here if you want the fastest explanation for why one version is separating.
                        </div>
                      </div>
                    </div>

                    <div style={scoreboardInsightStyle}>
                      {overallProjection >= 0.58
                        ? 'Scenario A has started to separate enough that it should be treated as the lead plan unless new information shows up.'
                        : overallProjection <= 0.42
                          ? 'Scenario B has started to separate enough that it should be treated as the lead plan unless new information shows up.'
                          : 'Neither version is fully separating yet, so this still benefits from one more builder pass or a captain judgment call.'}
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Scenario delta summary</p>
                        <h3 style={sectionTitleSmall}>Why one version is pulling ahead</h3>
                      </div>
                      <span style={miniPillSlate}>
                        {Math.abs(yourComparison.avgDiff - opponentComparison.avgDiff).toFixed(2)} net gap
                      </span>
                    </div>

                    <div style={deltaSummaryGridStyle}>
                      <div style={deltaSummaryCardStyle}>
                        <div style={deltaSummaryLabelStyle}>Your lineup change load</div>
                        <div style={deltaSummaryValueStyle}>{yourComparison.changedCount}</div>
                        <div style={deltaSummaryTextStyle}>
                          Different courts across your compared lineup versions.
                        </div>
                      </div>

                      <div style={deltaSummaryCardStyle}>
                        <div style={deltaSummaryLabelStyle}>Opponent assumption load</div>
                        <div style={deltaSummaryValueStyle}>{opponentComparison.changedCount}</div>
                        <div style={deltaSummaryTextStyle}>
                          Different opponent courts affecting the matchup picture.
                        </div>
                      </div>

                      <div style={deltaSummaryCardStyle}>
                        <div style={deltaSummaryLabelStyle}>Net comparison edge</div>
                        <div style={deltaSummaryValueStyle}>
                          {(yourComparison.avgDiff - opponentComparison.avgDiff) >= 0 ? 'A leaning' : 'B leaning'}
                        </div>
                        <div style={deltaSummaryTextStyle}>
                          A quick read of which version carries the cleaner combined scenario profile.
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Captain takeaway</p>
                        <h3 style={sectionTitleSmall}>What matters most in this decision</h3>
                      </div>
                      <span style={overallProjection >= 0.5 ? miniPillBlue : miniPillGreen}>
                        {overallProjection >= 0.5 ? 'Scenario A leaning ahead' : 'Scenario B leaning ahead'}
                      </span>
                    </div>

                    <div style={takeawayGridStyle}>
                      <div style={takeawayCardStyle}>
                        <div style={takeawayLabelStyle}>Winning version</div>
                        <div style={takeawayValueStyle}>
                          {overallProjection >= 0.5
                            ? (leftScenario?.scenario_name || 'Scenario A')
                            : (rightScenario?.scenario_name || 'Scenario B')}
                        </div>
                        <div style={takeawayTextStyle}>
                          This is the version with the stronger combined readout from the current scenario comparison model.
                        </div>
                      </div>

                      <div style={takeawayCardStyle}>
                        <div style={takeawayLabelStyle}>Biggest internal change</div>
                        <div style={takeawayValueStyle}>
                          {yourComparison.biggestSwing?.label || 'No major lineup swing'}
                        </div>
                        <div style={takeawayTextStyle}>
                          {yourComparison.biggestSwing
                            ? 'This lineup slot creates the largest internal difference between your compared versions.'
                            : 'The compared lineups are currently very similar across your own side.'}
                        </div>
                      </div>

                      <div style={takeawayCardStyle}>
                        <div style={takeawayLabelStyle}>Biggest opponent change</div>
                        <div style={takeawayValueStyle}>
                          {opponentComparison.biggestSwing?.label || 'No major opponent swing'}
                        </div>
                        <div style={takeawayTextStyle}>
                          {opponentComparison.biggestSwing
                            ? 'This opponent slot changes the matchup picture the most between the saved versions.'
                            : 'Opponent assumptions are currently fairly stable across both scenarios.'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={projectionGridResponsive(isSmallMobile, isTablet)}>
                    <ProjectionCard
                      title="Your lineup edge"
                      projection={yourComparison.projection}
                      avgDiff={yourComparison.avgDiff}
                      changedCount={yourComparison.changedCount}
                      biggestSwing={yourComparison.biggestSwing}
                    />
                    <ProjectionCard
                      title="Opponent lineup edge"
                      projection={opponentComparison.projection}
                      avgDiff={opponentComparison.avgDiff}
                      changedCount={opponentComparison.changedCount}
                      biggestSwing={opponentComparison.biggestSwing}
                    />
                    <OverallCard projection={overallProjection} />
                  </section>

                  <section style={surfaceCardStrong}>
                    <p style={sectionKicker}>Final decision</p>
                    <h2 style={sectionTitle}>Which scenario should you play?</h2>

                    <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                      <div style={miniPillBlue}>
                        Scenario A win chance: {Math.round(overallProjection * 100)}%
                      </div>
                      <div style={miniPillGreen}>
                        Scenario B win chance: {100 - Math.round(overallProjection * 100)}%
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <strong>
                        Recommendation: {overallProjection >= 0.5 ? 'Play Scenario A' : 'Play Scenario B'}
                      </strong>

                      <div style={{ marginTop: 10, fontSize: 14, opacity: 0.8 }}>
                        Next step: Send this lineup to your team
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Finalize workflow</p>
                        <h3 style={sectionTitleSmall}>Move from comparison to action</h3>
                      </div>
                      <span style={miniPillSlate}>
                        {overallProjection >= 0.5 ? 'Scenario A leads' : 'Scenario B leads'}
                      </span>
                    </div>

                    <div style={finalizeGridStyle}>
                      <div style={finalizeCardStyle}>
                        <div style={finalizeLabelStyle}>Recommended winner</div>
                        <div style={finalizeValueStyle}>
                          {overallProjection >= 0.5
                            ? leftScenario?.scenario_name || 'Scenario A'
                            : rightScenario?.scenario_name || 'Scenario B'}
                        </div>
                        <div style={finalizeTextStyle}>
                          {overallProjection >= 0.5
                            ? 'Scenario A currently carries the stronger combined readout across the compared versions.'
                            : 'Scenario B currently carries the stronger combined readout across the compared versions.'}
                        </div>
                      </div>

                      <div style={finalizeCardStyle}>
                        <div style={finalizeLabelStyle}>Next best action</div>
                        <div style={finalizeValueStyle}>
                          {yourComparison.changedCount > 0 || opponentComparison.changedCount > 0
                            ? 'Send the winner back to builder'
                            : 'Lock the cleaner version'}
                        </div>
                        <div style={finalizeTextStyle}>
                          Jump back into the lineup builder for the winning version if you still need to adjust players, otherwise move into team communication.
                        </div>
                      </div>

                      <div style={finalizeCardStyle}>
                        <div style={finalizeLabelStyle}>Captain follow-through</div>
                        <div style={finalizeValueStyle}>Communicate the plan</div>
                        <div style={finalizeTextStyle}>
                          Once you trust the winning scenario, carry it into your weekly messaging workflow so the team gets one clear version.
                        </div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <Link
                        href={overallProjection >= 0.5
                          ? (leftScenario ? builderHref(leftScenario.id) : '/captain/lineup-builder')
                          : (rightScenario ? builderHref(rightScenario.id) : '/captain/lineup-builder')}
                        style={primaryButtonSmall}
                      >
                        Edit Winning Scenario
                      </Link>
                      <button
                        type="button"
                        style={ghostButtonSmall}
                        onClick={async () => {
                          if (!premiumEnabled) {
                            setError('Captain tier required to send the winning scenario to messaging.')
                            return
                          }

                          const winningScenario =
                            overallProjection >= 0.5 ? leftScenario : rightScenario

                          if (!winningScenario) return

                          localStorage.setItem(
                            'tenace_selected_scenario',
                            JSON.stringify(winningScenario)
                          )

                          localStorage.setItem(
                            'tenace_flow_source',
                            'scenario_builder'
                          )

                          const team = winningScenario.team_name || ''
                          const league = winningScenario.league_name || ''
                          const flight = winningScenario.flight || ''

                          try {
                            await writeScenarioFeedEvents({
                              team,
                              league,
                              flight,
                              projection: overallProjection,
                              biggestSwing: yourComparison.biggestSwing || opponentComparison.biggestSwing,
                              changedCount: yourComparison.changedCount + opponentComparison.changedCount,
                            })
                          } catch (error) {
                            console.error('Failed to write scenario feed events', error)
                          }

                          window.location.href = `/captain/messaging?team=${encodeURIComponent(team)}&league=${encodeURIComponent(league)}&flight=${encodeURIComponent(flight)}&source=scenario_builder`
                        }}
                      >
                        Send Winning Scenario
                      </button>
                      <Link href="/captain" style={ghostButtonSmall}>
                        Back to Captain Console
                      </Link>
                    </div>
                  </section>

                  <ComparisonTable title="Your lineup comparison" comparison={yourComparison} />
                  <ComparisonTable title="Opponent lineup comparison" comparison={opponentComparison} />

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Scenario confidence ladder</p>
                        <h3 style={sectionTitleSmall}>How strong this recommendation really is</h3>
                      </div>
                      <span style={miniPillSlate}>
                        {Math.abs(overallProjection - 0.5) >= 0.15 ? 'High separation' : Math.abs(overallProjection - 0.5) >= 0.08 ? 'Moderate separation' : 'Tight decision'}
                      </span>
                    </div>

                    <div style={confidenceLadderGridStyle}>
                      <div style={confidenceLadderCardStyle}>
                        <div style={confidenceLadderLabelStyle}>Projection spread</div>
                        <div style={confidenceLadderValueStyle}>
                          {Math.abs((Math.round(overallProjection * 100)) - (100 - Math.round(overallProjection * 100)))} pts
                        </div>
                        <div style={confidenceLadderTextStyle}>
                          Bigger spreads usually mean the winning version is separating more clearly.
                        </div>
                      </div>

                      <div style={confidenceLadderCardStyle}>
                        <div style={confidenceLadderLabelStyle}>Your-side volatility</div>
                        <div style={confidenceLadderValueStyle}>
                          {yourComparison.changedCount <= 1 ? 'Low' : yourComparison.changedCount <= 3 ? 'Medium' : 'High'}
                        </div>
                        <div style={confidenceLadderTextStyle}>
                          This reflects how much your own lineup changes between the compared versions.
                        </div>
                      </div>

                      <div style={confidenceLadderCardStyle}>
                        <div style={confidenceLadderLabelStyle}>Opponent volatility</div>
                        <div style={confidenceLadderValueStyle}>
                          {opponentComparison.changedCount <= 1 ? 'Low' : opponentComparison.changedCount <= 3 ? 'Medium' : 'High'}
                        </div>
                        <div style={confidenceLadderTextStyle}>
                          This reflects how much your opponent assumptions are moving between versions.
                        </div>
                      </div>
                    </div>

                    <div style={confidenceLadderInsightStyle}>
                      {Math.abs(overallProjection - 0.5) >= 0.15
                        ? 'Confidence is strong enough to treat the winning scenario as your lead version unless new availability or scouting changes show up.'
                        : Math.abs(overallProjection - 0.5) >= 0.08
                          ? 'You have a usable lean, but this still benefits from one more captain review before it becomes the communicated plan.'
                          : 'This comparison is still tight. Use builder edits, lock decisions, or fresher opponent assumptions before treating one version as final.'}
                    </div>
                  </section>

                  <section style={surfaceCardStrong}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Communication readiness</p>
                        <h3 style={sectionTitleSmall}>How close this is to a sendable plan</h3>
                      </div>
                      <span style={
                        overallProjection >= 0.6 || overallProjection <= 0.4
                          ? miniPillGreen
                          : miniPillSlate
                      }>
                        {overallProjection >= 0.6 || overallProjection <= 0.4 ? 'Clearer winner' : 'Needs captain judgment'}
                      </span>
                    </div>

                    <div style={readinessGridStyle}>
                      <div style={readinessCardStyle}>
                        <div style={readinessLabelStyle}>Decision clarity</div>
                        <div style={readinessValueStyle}>
                          {Math.abs(overallProjection - 0.5) >= 0.1 ? 'Strong' : 'Moderate'}
                        </div>
                        <div style={readinessTextStyle}>
                          {Math.abs(overallProjection - 0.5) >= 0.1
                            ? 'One version is separating enough that you can communicate with more confidence.'
                            : 'The compared versions are still fairly close, so final captain judgment still matters.'}
                        </div>
                      </div>

                      <div style={readinessCardStyle}>
                        <div style={readinessLabelStyle}>Scenario stability</div>
                        <div style={readinessValueStyle}>
                          {yourComparison.changedCount <= 2 ? 'Stable' : 'Still moving'}
                        </div>
                        <div style={readinessTextStyle}>
                          {yourComparison.changedCount <= 2
                            ? 'Your lineup versions are relatively close, which makes the winner easier to trust.'
                            : 'Your own lineup is changing a lot across versions, so keep refining before treating this as final.'}
                        </div>
                      </div>

                      <div style={readinessCardStyle}>
                        <div style={readinessLabelStyle}>Send readiness</div>
                        <div style={readinessValueStyle}>
                          {Math.abs(overallProjection - 0.5) >= 0.1 && yourComparison.changedCount <= 2 && opponentComparison.changedCount <= 2 ? 'Ready to message' : 'Refine first'}
                        </div>
                        <div style={readinessTextStyle}>
                          {Math.abs(overallProjection - 0.5) >= 0.1 && yourComparison.changedCount <= 2 && opponentComparison.changedCount <= 2
                            ? 'This comparison is clean enough to move the winning version into weekly team messaging.'
                            : 'Keep tuning the winning version in builder before pushing it out to the team.'}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section style={surfaceCard}>
                    <div style={tableHeaderStyle}>
                      <div>
                        <p style={sectionKicker}>Scenario command deck</p>
                        <h3 style={sectionTitleSmall}>What to do with the winning version now</h3>
                      </div>
                      <span style={miniPillSlate}>
                        {yourComparison.changedCount + opponentComparison.changedCount} total comparison changes
                      </span>
                    </div>

                    <div style={scenarioCommandGridStyle}>
                      <div style={scenarioCommandCardStyle}>
                        <div style={scenarioCommandLabelStyle}>Winning scenario</div>
                        <div style={scenarioCommandValueStyle}>
                          {overallProjection >= 0.5
                            ? (leftScenario?.scenario_name || 'Scenario A')
                            : (rightScenario?.scenario_name || 'Scenario B')}
                        </div>
                        <div style={scenarioCommandTextStyle}>
                          Use this as your working favorite unless late availability or opponent intel changes the picture.
                        </div>
                      </div>

                      <div style={scenarioCommandCardStyle}>
                        <div style={scenarioCommandLabelStyle}>Best next move</div>
                        <div style={scenarioCommandValueStyle}>
                          {yourComparison.changedCount > 0 ? 'Edit the winner in builder' : 'Carry it forward'}
                        </div>
                        <div style={scenarioCommandTextStyle}>
                          {yourComparison.changedCount > 0
                            ? 'Jump back into lineup builder with the winning scenario if you still want to tune player placement.'
                            : 'This comparison is stable enough to move toward communication and final confirmation.'}
                        </div>
                      </div>

                      <div style={scenarioCommandCardStyle}>
                        <div style={scenarioCommandLabelStyle}>Captain workflow</div>
                        <div style={scenarioCommandValueStyle}>Compare → refine → send</div>
                        <div style={scenarioCommandTextStyle}>
                          Keep scenario work focused on decision clarity, then move the final version into weekly team messaging.
                        </div>
                      </div>
                    </div>

                    <div style={actionRowStyle}>
                      <Link
                        href={overallProjection >= 0.5
                          ? (leftScenario ? builderHref(leftScenario.id) : '/captain/lineup-builder')
                          : (rightScenario ? builderHref(rightScenario.id) : '/captain/lineup-builder')}
                        style={primaryButtonSmall}
                      >
                        Open Winning Scenario in Builder
                      </Link>
                      <button
                        type="button"
                        style={ghostButtonSmall}
                        onClick={async () => {
                          if (!premiumEnabled) {
                            setError('Captain tier required to open messaging from scenario builder.')
                            return
                          }

                          const winningScenario =
                            overallProjection >= 0.5 ? leftScenario : rightScenario

                          if (!winningScenario) return

                          localStorage.setItem(
                            'tenace_selected_scenario',
                            JSON.stringify(winningScenario)
                          )

                          localStorage.setItem(
                            'tenace_flow_source',
                            'scenario_builder'
                          )

                          const team = winningScenario.team_name || ''
                          const league = winningScenario.league_name || ''
                          const flight = winningScenario.flight || ''

                          try {
                            await writeScenarioFeedEvents({
                              team,
                              league,
                              flight,
                              projection: overallProjection,
                              biggestSwing: yourComparison.biggestSwing || opponentComparison.biggestSwing,
                              changedCount: yourComparison.changedCount + opponentComparison.changedCount,
                            })
                          } catch (error) {
                            console.error('Failed to write scenario feed events', error)
                          }

                          window.location.href = `/captain/messaging?team=${encodeURIComponent(team)}&league=${encodeURIComponent(league)}&flight=${encodeURIComponent(flight)}&source=scenario_builder`
                        }}
                      >
                        Open Messaging
                      </button>
                    </div>
                  </section>

                  <section style={notesGridResponsive(isTablet)}>
                    <NotesCard label="Scenario A" scenario={leftScenario} />
                    <NotesCard label="Scenario B" scenario={rightScenario} />
                  </section>
                </>
              ) : null}
            </>
          )}
        </section>
      </section>
    </SiteShell>
  )
}

function ScenarioPanel({
  title,
  badgeStyle,
  selectedId,
  onChange,
  scenarios,
  scenario,
  builderHref,
}: {
  title: string
  badgeStyle: CSSProperties
  selectedId: string
  onChange: (value: string) => void
  scenarios: ScenarioRow[]
  scenario: ScenarioRow | null
  builderHref: string
}) {
  const selectorId = `scenario-panel-${title.toLowerCase().replace(/\s+/g, '-')}`
  const helperId = `${selectorId}-helper`

  return (
    <div style={surfaceCard}>
      <div style={panelTopStyle}>
        <div>
          <p style={sectionKicker}>{title}</p>
          <h2 style={sectionTitleSmall}>Comparison panel</h2>
        </div>
        <span style={badgeStyle}>{title}</span>
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor={selectorId} style={labelStyle}>Select scenario</label>
        <p id={helperId} style={sectionBodyTextStyle}>
          Choose the saved version you want on this side before reviewing slot-level differences and projection shifts.
        </p>
        <select id={selectorId} aria-describedby={helperId} value={selectedId} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
          {scenarios.map((item) => (
            <option key={item.id} value={item.id}>
              {item.scenario_name} • {item.team_name || '—'} • {formatDate(item.match_date)}
            </option>
          ))}
        </select>
      </div>

      {scenario ? (
        <>
          <div style={metaGridStylePanel}>
            <MetaCard label="Scenario" value={scenario.scenario_name || 'Untitled'} />
            <MetaCard label="League" value={scenario.league_name || '—'} />
            <MetaCard label="Flight" value={scenario.flight || '—'} />
            <MetaCard label="Match Date" value={formatDate(scenario.match_date)} />
            <MetaCard label="Team" value={scenario.team_name || '—'} />
            <MetaCard label="Opponent" value={scenario.opponent_team || '—'} />
          </div>

          <div style={actionRowStyle}>
            <Link href={builderHref} style={primaryButtonSmall}>
              Edit in Builder
            </Link>
          </div>
        </>
      ) : null}
    </div>
  )
}

function ProjectionCard({
  title,
  projection,
  avgDiff,
  changedCount,
  biggestSwing,
}: {
  title: string
  projection: number
  avgDiff: number
  changedCount: number
  biggestSwing: { label: string; diff: number | null } | null
}) {
  return (
    <div style={surfaceCard}>
      <p style={sectionKicker}>{title}</p>
      <div style={projectionValueStyle}>{Math.round(projection * 100)}%</div>
      <p style={sectionBodyTextStyle}>
        Avg edge {avgDiff >= 0 ? '+' : ''}
        {avgDiff.toFixed(2)} across comparable lines.
      </p>
      <div style={pillRowStyle}>
        <span style={miniPillSlate}>{changedCount} changed</span>
        {biggestSwing ? (
          <span style={miniPillBlue}>
            Biggest swing: {biggestSwing.label} ({(biggestSwing.diff ?? 0) >= 0 ? '+' : ''}
            {(biggestSwing.diff ?? 0).toFixed(2)})
          </span>
        ) : null}
      </div>
    </div>
  )
}

function OverallCard({ projection }: { projection: number }) {
  const leftPct = Math.round(projection * 100)
  const rightPct = 100 - leftPct

  return (
    <div style={surfaceCardStrong}>
      <p style={sectionKicker}>Overall readout</p>
      <div style={projectionValueStyle}>
        {leftPct}% / {rightPct}%
      </div>
      <p style={sectionBodyTextStyle}>
        Quick combined read of which side looks stronger across the compared lineup versions.
      </p>
      <div style={pillRowStyle}>
        <span style={leftPct >= rightPct ? miniPillGreen : miniPillBlue}>
          Scenario A {leftPct >= rightPct ? 'favored' : 'trails'}
        </span>
        <span style={rightPct > leftPct ? miniPillGreen : miniPillSlate}>
          Scenario B {rightPct > leftPct ? 'favored' : 'trails'}
        </span>
      </div>
    </div>
  )
}

function ComparisonTable({
  title,
  comparison,
}: {
  title: string
  comparison: ReturnType<typeof compareSlots>
}) {
  return (
    <section style={surfaceCard}>
      <div style={tableHeaderStyle}>
        <div>
          <p style={sectionKicker}>Comparison table</p>
          <h3 style={sectionTitleSmall}>{title}</h3>
        </div>
        <span style={miniPillSlate}>{comparison.rows.length} slots</span>
      </div>

      {comparison.rows.length === 0 ? (
        <p style={mutedTextStyle}>No saved slots found.</p>
      ) : (
        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <caption style={tableCaptionStyle}>
              Slot-by-slot comparison showing lineup assignments, projected edge, and whether each position changed between Scenario A and Scenario B.
            </caption>
            <thead>
              <tr>
                <th style={thStyle}>Slot</th>
                <th style={thStyle}>Scenario A</th>
                <th style={thStyle}>Scenario B</th>
                <th style={thStyle}>Strength</th>
                <th style={thStyle}>Changed</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => {
                const changed = row.changed
                const diff = row.diff
                const diffText =
                  typeof diff === 'number'
                    ? `${diff >= 0 ? 'A +' : 'B +'}${Math.abs(diff).toFixed(2)}`
                    : '—'

                return (
                  <tr key={row.label}>
                    <td style={tdLabelStyle}>{row.label}</td>
                    <td style={tdStyle}>{row.leftText}</td>
                    <td style={tdStyle}>{row.rightText}</td>
                    <td style={tdStyle}>
                      <span
                        style={
                          typeof diff === 'number'
                            ? diff >= 0
                              ? miniPillBlue
                              : warnPill
                            : miniPillSlate
                        }
                      >
                        {diffText}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      <span style={changed ? miniPillBlue : miniPillGreen}>
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

function NotesCard({ label, scenario }: { label: string; scenario: ScenarioRow }) {
  return (
    <div style={surfaceCard}>
      <p style={sectionKicker}>{label}</p>
      <h3 style={sectionTitleSmall}>Saved notes</h3>
      <p style={notesTextStyle}>{scenario.notes?.trim() || 'No notes saved.'}</p>
    </div>
  )
}

function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={metaCardStyle}>
      <div style={metaLabelStyle}>{label}</div>
      <div style={metaValueStyle}>{value}</div>
    </div>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
    </div>
  )
}

function heroShellResponsive(isTablet: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroShell,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.45fr) minmax(300px, 0.95fr)',
    gap: isMobile ? '18px' : '24px',
    padding: isMobile ? '26px 18px' : '34px 26px',
  }
}

function heroTitleResponsive(isSmallMobile: boolean, isMobile: boolean): CSSProperties {
  return {
    ...heroTitleStyle,
    fontSize: isSmallMobile ? '34px' : isMobile ? '42px' : '50px',
  }
}

function heroMetricGridStyle(isSmallMobile: boolean): CSSProperties {
  return {
    ...heroMetricGridBaseStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(3, minmax(0, 1fr))',
  }
}

function compareGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...compareGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
}

function projectionGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...projectionGridStyle,
    gridTemplateColumns: isSmallMobile
      ? '1fr'
      : isTablet
        ? 'repeat(2, minmax(0, 1fr))'
        : 'repeat(3, minmax(0, 1fr))',
  }
}

function notesGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...notesGridStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
}

const pageContentStyle: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  width: '100%',
  maxWidth: '1280px',
  margin: '0 auto',
  padding: '18px 24px 0',
}

const heroShell: CSSProperties = {
  position: 'relative',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(116,190,255,0.18)',
  background:
    'linear-gradient(135deg, rgba(14,39,82,0.88) 0%, rgba(11,30,64,0.90) 52%, rgba(8,27,56,0.92) 100%)',
  boxShadow: '0 28px 80px rgba(3, 10, 24, 0.30)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'rgba(155,225,29,0.12)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(231,239,251,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroButtonRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 12,
  marginTop: 22,
}

const heroMetricGridBaseStyle: CSSProperties = {
  marginTop: 22,
  display: 'grid',
  gap: '14px',
}

const heroMetricCardStyle: CSSProperties = {
  borderRadius: '22px',
  padding: '16px',
  border: '1px solid rgba(116,190,255,0.14)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.16) 0%, rgba(20,43,86,0.34) 100%)',
}

const metricLabelStyle: CSSProperties = {
  color: 'rgba(225,236,250,0.72)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValueStyleHero: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(116,190,255,0.12)',
  background: 'linear-gradient(180deg, rgba(29,56,105,0.62), rgba(14,30,59,0.78))',
  padding: '20px',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const quickStartTitle: CSSProperties = {
  marginTop: 10,
  marginBottom: 14,
  fontSize: '1.35rem',
  lineHeight: 1.14,
  color: '#ffffff',
}

const workflowListStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
}

const workflowRowStyle: CSSProperties = {
  display: 'flex',
  gap: 12,
  alignItems: 'flex-start',
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
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  flexShrink: 0,
}

const workflowTitleStyle: CSSProperties = {
  fontWeight: 700,
  color: '#ffffff',
  marginBottom: 4,
}

const workflowTextStyle: CSSProperties = {
  color: 'rgba(231,239,251,0.72)',
  lineHeight: 1.55,
  fontSize: '.95rem',
}

const contentWrap: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '18px',
  marginTop: '18px',
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background:
    'radial-gradient(circle at top right, rgba(155,225,29,0.10), transparent 34%), linear-gradient(135deg, rgba(13,42,90,0.82) 0%, rgba(8,27,59,0.90) 58%, rgba(7,30,62,0.94) 100%)',
  boxShadow: '0 24px 60px rgba(2, 8, 23, 0.24)',
  backdropFilter: 'blur(16px)',
  WebkitBackdropFilter: 'blur(16px)',
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'linear-gradient(180deg, rgba(58,115,212,0.14) 0%, rgba(16,34,70,0.42) 100%)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.18)',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
}

const sectionHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionKicker: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  fontSize: '13px',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  margin: 0,
}

const sectionTitle: CSSProperties = {
  margin: '8px 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '28px',
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}

const sectionTitleSmall: CSSProperties = {
  margin: '8px 0 0 0',
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '22px',
  letterSpacing: '-0.03em',
  lineHeight: 1.15,
}

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(224,234,247,0.76)',
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
  gap: '20px',
}

const projectionGridStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
}

const notesGridStyle: CSSProperties = {
  display: 'grid',
  gap: '20px',
}

const panelTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
}

const metaGridStylePanel: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: '10px',
  marginTop: '18px',
}

const metaCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const metaLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const metaValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  lineHeight: 1.45,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '16px',
}

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  color: 'rgba(198,216,248,0.84)',
  fontSize: '13px',
  fontWeight: 800,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  height: '48px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  padding: '0 14px',
  fontSize: '14px',
  outline: 'none',
}

const primaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  color: '#071622',
  border: '1px solid rgba(155,225,29,0.34)',
  boxShadow: '0 16px 32px rgba(74, 222, 128, 0.14)',
}

const ghostButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '46px',
  padding: '0 16px',
  borderRadius: '999px',
  textDecoration: 'none',
  fontWeight: 800,
  background: 'linear-gradient(180deg, rgba(58,115,212,0.18) 0%, rgba(27,62,120,0.14) 100%)',
  color: '#ebf1fd',
  border: '1px solid rgba(116,190,255,0.18)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
}

const ghostButtonSmall: CSSProperties = {
  ...ghostButton,
  minHeight: '42px',
  cursor: 'pointer',
}

const ghostButtonSmallButton: CSSProperties = {
  ...ghostButtonSmall,
  appearance: 'none',
}

const primaryButtonSmall: CSSProperties = {
  ...primaryButton,
  minHeight: '42px',
}

const projectionValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '36px',
  lineHeight: 1,
  letterSpacing: '-0.04em',
  marginTop: '8px',
  marginBottom: '10px',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '12px',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  fontSize: '12px',
  fontWeight: 800,
}

const miniPillSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
}

const miniPillBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
}

const miniPillGreen: CSSProperties = {
  ...badgeBase,
  background: 'rgba(155,225,29,0.14)',
  color: '#e7ffd1',
}

const warnPill: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255, 93, 93, 0.10)',
  color: '#fecaca',
}

const tableHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '14px',
}

const tableWrapStyle: CSSProperties = {
  width: '100%',
  overflowX: 'auto',
  borderRadius: '18px',
  border: '1px solid rgba(255,255,255,0.08)',
}

const tableCaptionStyle: CSSProperties = {
  captionSide: 'top',
  textAlign: 'left',
  padding: '0 0 12px',
  color: '#94a3b8',
  fontSize: 13,
  lineHeight: 1.5,
}

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '14px',
  background: 'rgba(255,255,255,0.06)',
  color: '#c7dbff',
  fontSize: '12px',
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const tdStyle: CSSProperties = {
  padding: '14px',
  borderTop: '1px solid rgba(255,255,255,0.08)',
  color: '#f8fbff',
  verticalAlign: 'top',
}

const tdLabelStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 800,
}

const mutedTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  margin: 0,
  lineHeight: 1.65,
}

const errorTextStyle: CSSProperties = {
  color: '#fca5a5',
  margin: 0,
  lineHeight: 1.65,
}

const notesTextStyle: CSSProperties = {
  margin: 0,
  color: '#e7eefb',
  lineHeight: 1.7,
  whiteSpace: 'pre-wrap',
}

const finalizeGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const finalizeCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const finalizeLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const finalizeValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const finalizeTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const takeawayGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const takeawayCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const takeawayLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const takeawayValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const takeawayTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const scenarioCommandGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const scenarioCommandCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const scenarioCommandLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const scenarioCommandValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const scenarioCommandTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const deltaSummaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const deltaSummaryCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const deltaSummaryLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const deltaSummaryValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const deltaSummaryTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const readinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const readinessCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const readinessLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const readinessValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const readinessTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const confidenceLadderGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const confidenceLadderCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const confidenceLadderLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const confidenceLadderValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const confidenceLadderTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const confidenceLadderInsightStyle: CSSProperties = {
  marginTop: '14px',
  color: '#e7eefb',
  lineHeight: 1.7,
  fontSize: '14px',
}

const scoreboardGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const scoreboardCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const scoreboardLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const scoreboardValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const scoreboardTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}

const scoreboardInsightStyle: CSSProperties = {
  marginTop: '14px',
  color: '#e7eefb',
  lineHeight: 1.7,
  fontSize: '14px',
}

const changeDigestGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
  marginTop: '4px',
}

const changeDigestCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '8px',
}

const changeDigestLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
}

const changeDigestValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '20px',
  lineHeight: 1.1,
  letterSpacing: '-0.03em',
}

const changeDigestTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
  fontSize: '14px',
}
