'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'

type PlayerRow = {
  id: string
  name: string
  location: string | null
  flight: string | null
  preferred_role: string | null
  lineup_notes: string | null
  singles_rating: number | null
  singles_dynamic_rating: number | null
  doubles_rating: number | null
  doubles_dynamic_rating: number | null
  overall_rating: number | null
  overall_dynamic_rating: number | null
}

type AvailabilityRow = {
  id: string
  match_date: string | null
  team_name: string | null
  league_name: string | null
  flight: string | null
  player_id: string
  status: string | null
  notes: string | null
}

type SlotPlayer = {
  playerId: string
  playerName: string
}

type LineupSlot = {
  id: string
  label: string
  slotType: 'singles' | 'doubles'
  players: SlotPlayer[]
}

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

const DEFAULT_TEAM_SLOTS: LineupSlot[] = [
  createSinglesSlot('s1', 'Singles 1'),
  createSinglesSlot('s2', 'Singles 2'),
  createSinglesSlot('s3', 'Singles 3'),
  createDoublesSlot('d1', 'Doubles 1'),
  createDoublesSlot('d2', 'Doubles 2'),
]

const DEFAULT_OPPONENT_SLOTS: LineupSlot[] = [
  createSinglesSlot('os1', 'Singles 1'),
  createSinglesSlot('os2', 'Singles 2'),
  createSinglesSlot('os3', 'Singles 3'),
  createDoublesSlot('od1', 'Doubles 1'),
  createDoublesSlot('od2', 'Doubles 2'),
]

function createSinglesSlot(id: string, label: string): LineupSlot {
  return {
    id,
    label,
    slotType: 'singles',
    players: [{ playerId: '', playerName: '' }],
  }
}

function createDoublesSlot(id: string, label: string): LineupSlot {
  return {
    id,
    label,
    slotType: 'doubles',
    players: [
      { playerId: '', playerName: '' },
      { playerId: '', playerName: '' },
    ],
  }
}

function cloneSlots(slots: LineupSlot[]) {
  return slots.map((slot) => ({
    ...slot,
    players: slot.players.map((player) => ({ ...player })),
  }))
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
    new Set(values.map((value) => (value ?? '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))
}

function availabilityRank(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()

  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') {
    return 0
  }

  if (normalized === 'maybe') {
    return 1
  }

  if (normalized === 'unknown' || normalized === '') {
    return 2
  }

  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') {
    return 3
  }

  return 2
}

function statusTone(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()

  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') {
    return {
      background: 'rgba(112, 255, 165, 0.12)',
      color: '#0f8f52',
      border: '1px solid rgba(112, 255, 165, 0.28)',
    }
  }

  if (normalized === 'maybe') {
    return {
      background: 'rgba(255, 214, 102, 0.14)',
      color: '#9a6700',
      border: '1px solid rgba(255, 214, 102, 0.34)',
    }
  }

  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') {
    return {
      background: 'rgba(255, 93, 93, 0.10)',
      color: '#c43f3f',
      border: '1px solid rgba(255, 93, 93, 0.24)',
    }
  }

  return {
    background: 'rgba(37, 91, 227, 0.08)',
    color: '#4c67a7',
    border: '1px solid rgba(37, 91, 227, 0.14)',
  }
}

function normalizeSavedSlots(raw: unknown): LineupSlot[] {
  if (!raw || !Array.isArray(raw)) return []

  return raw.map((item, index) => {
    const obj =
      typeof item === 'object' && item !== null
        ? (item as Record<string, unknown>)
        : {}

    const slotType = obj.slotType === 'doubles' ? 'doubles' : 'singles'
    const label = cleanText(obj.label) || `Slot ${index + 1}`

    const rawPlayers = Array.isArray(obj.players) ? obj.players : []
    const normalizedPlayers = rawPlayers.map((player) => {
      const p =
        typeof player === 'object' && player !== null
          ? (player as Record<string, unknown>)
          : {}

      return {
        playerId: cleanText(p.playerId),
        playerName: cleanText(p.playerName),
      }
    })

    return {
      id: cleanText(obj.id) || `slot-${index + 1}`,
      label,
      slotType,
      players:
        slotType === 'doubles'
          ? [
              normalizedPlayers[0] ?? { playerId: '', playerName: '' },
              normalizedPlayers[1] ?? { playerId: '', playerName: '' },
            ]
          : [normalizedPlayers[0] ?? { playerId: '', playerName: '' }],
    }
  })
}

export default function LineupBuilderPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingScenarioId, setDeletingScenarioId] = useState('')
  const [loadingScenarioId, setLoadingScenarioId] = useState('')
  const [currentScenarioId, setCurrentScenarioId] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const [leagueName, setLeagueName] = useState('')
  const [flight, setFlight] = useState('')
  const [teamName, setTeamName] = useState('')
  const [opponentTeam, setOpponentTeam] = useState('')
  const [matchDate, setMatchDate] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [notes, setNotes] = useState('')

  const [availabilityOnly, setAvailabilityOnly] = useState(true)
  const [hideUnavailable, setHideUnavailable] = useState(true)

  const [teamSlots, setTeamSlots] = useState<LineupSlot[]>(cloneSlots(DEFAULT_TEAM_SLOTS))
  const [opponentSlots, setOpponentSlots] = useState<LineupSlot[]>(
    cloneSlots(DEFAULT_OPPONENT_SLOTS)
  )

  useEffect(() => {
    let mounted = true

    async function loadData() {
      setLoading(true)
      setError('')
      setMessage('')

      const [playersResult, availabilityResult, scenariosResult] = await Promise.all([
        supabase
          .from('players')
          .select(`
            id,
            name,
            location,
            flight,
            preferred_role,
            lineup_notes,
            singles_rating,
            singles_dynamic_rating,
            doubles_rating,
            doubles_dynamic_rating,
            overall_rating,
            overall_dynamic_rating
          `)
          .order('name', { ascending: true }),
        supabase
          .from('lineup_availability')
          .select(`
            id,
            match_date,
            team_name,
            league_name,
            flight,
            player_id,
            status,
            notes
          `)
          .order('match_date', { ascending: false }),
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
      ])

      if (!mounted) return

      if (playersResult.error) {
        setError(playersResult.error.message)
      } else if (availabilityResult.error) {
        setError(availabilityResult.error.message)
      } else if (scenariosResult.error) {
        setError(scenariosResult.error.message)
      } else {
        setPlayers((playersResult.data ?? []) as PlayerRow[])
        setAvailability((availabilityResult.data ?? []) as AvailabilityRow[])
        setSavedScenarios((scenariosResult.data ?? []) as ScenarioRow[])
      }

      setLoading(false)
    }

    loadData()

    return () => {
      mounted = false
    }
  }, [])

  const leagueOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.league_name),
        ...savedScenarios.map((row) => row.league_name),
      ]),
    [availability, savedScenarios]
  )

  const flightOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.flight),
        ...players.map((row) => row.flight),
        ...savedScenarios.map((row) => row.flight),
      ]),
    [availability, players, savedScenarios]
  )

  const teamOptions = useMemo(
    () =>
      uniqueSorted([
        ...availability.map((row) => row.team_name),
        ...savedScenarios.map((row) => row.team_name),
      ]),
    [availability, savedScenarios]
  )

  const scenarioOptions = useMemo(() => {
    return savedScenarios.filter((scenario) => {
      const leagueMatch = !leagueName || scenario.league_name === leagueName
      const flightMatch = !flight || scenario.flight === flight
      const teamMatch = !teamName || scenario.team_name === teamName
      return leagueMatch && flightMatch && teamMatch
    })
  }, [savedScenarios, leagueName, flight, teamName])

  const availabilityForSelection = useMemo(() => {
    return availability.filter((row) => {
      const dateMatch = !matchDate || row.match_date === matchDate
      const teamMatch = !teamName || row.team_name === teamName
      const leagueMatch = !leagueName || row.league_name === leagueName
      const flightMatch = !flight || row.flight === flight

      return dateMatch && teamMatch && leagueMatch && flightMatch
    })
  }, [availability, matchDate, teamName, leagueName, flight])

  const availabilityMap = useMemo(() => {
    const map = new Map<
      string,
      {
        status: string | null
        notes: string | null
      }
    >()

    for (const row of availabilityForSelection) {
      map.set(row.player_id, {
        status: row.status,
        notes: row.notes,
      })
    }

    return map
  }, [availabilityForSelection])

  const availablePlayerPool = useMemo(() => {
    return players
      .map((player) => {
        const availabilityEntry = availabilityMap.get(player.id)

        return {
          ...player,
          availabilityStatus: availabilityEntry?.status ?? null,
          availabilityNotes: availabilityEntry?.notes ?? null,
        }
      })
      .filter((player) => {
        if (flight && player.flight && player.flight !== flight) return false

        if (availabilityOnly && availabilityForSelection.length > 0) {
          return availabilityMap.has(player.id)
        }

        return true
      })
      .filter((player) => {
        if (!hideUnavailable) return true

        const normalized = (player.availabilityStatus ?? '').trim().toLowerCase()
        if (!availabilityOnly && !normalized) return true

        return normalized !== 'unavailable' && normalized !== 'no' && normalized !== 'out'
      })
      .sort((a, b) => {
        const statusCompare =
          availabilityRank(a.availabilityStatus) - availabilityRank(b.availabilityStatus)

        if (statusCompare !== 0) return statusCompare

        const ratingA = a.overall_dynamic_rating ?? a.overall_rating ?? -999
        const ratingB = b.overall_dynamic_rating ?? b.overall_rating ?? -999

        if (ratingB !== ratingA) return ratingB - ratingA

        return a.name.localeCompare(b.name)
      })
  }, [
    players,
    availabilityMap,
    flight,
    availabilityOnly,
    availabilityForSelection.length,
    hideUnavailable,
  ])

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()

    for (const slot of [...teamSlots, ...opponentSlots]) {
      for (const player of slot.players) {
        if (player.playerId) ids.add(player.playerId)
      }
    }

    return ids
  }, [teamSlots, opponentSlots])

  function playerLabel(player: {
    name: string
    availabilityStatus: string | null
    overall_dynamic_rating: number | null
    overall_rating: number | null
    singles_dynamic_rating: number | null
    doubles_dynamic_rating: number | null
  }) {
    const overall = player.overall_dynamic_rating ?? player.overall_rating
    const singles = player.singles_dynamic_rating
    const doubles = player.doubles_dynamic_rating
    const status = player.availabilityStatus ? ` • ${player.availabilityStatus}` : ''

    return `${player.name}${
      overall !== null ? ` • OVR ${overall.toFixed(2)}` : ''
    }${singles !== null ? ` • S ${singles.toFixed(2)}` : ''}${
      doubles !== null ? ` • D ${doubles.toFixed(2)}` : ''
    }${status}`
  }

  function getPlayerById(playerId: string) {
    return players.find((player) => player.id === playerId) ?? null
  }

  function setSlotPlayer(
    side: 'team' | 'opponent',
    slotId: string,
    playerIndex: number,
    playerId: string
  ) {
    const update = (slots: LineupSlot[]) =>
      slots.map((slot) => {
        if (slot.id !== slotId) return slot

        const nextPlayers = slot.players.map((player, index) => {
          if (index !== playerIndex) return player

          const matchedPlayer = getPlayerById(playerId)

          return {
            playerId,
            playerName: matchedPlayer?.name ?? '',
          }
        })

        return {
          ...slot,
          players: nextPlayers,
        }
      })

    if (side === 'team') {
      setTeamSlots((current) => update(current))
    } else {
      setOpponentSlots((current) => update(current))
    }
  }

  function setSlotLabel(side: 'team' | 'opponent', slotId: string, label: string) {
    const update = (slots: LineupSlot[]) =>
      slots.map((slot) => (slot.id === slotId ? { ...slot, label } : slot))

    if (side === 'team') {
      setTeamSlots((current) => update(current))
    } else {
      setOpponentSlots((current) => update(current))
    }
  }

  function addSlot(side: 'team' | 'opponent', slotType: 'singles' | 'doubles') {
    const id = `${side}-${slotType}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`
    const labelBase = slotType === 'singles' ? 'Singles' : 'Doubles'
    const source = side === 'team' ? teamSlots : opponentSlots
    const nextCount = source.filter((slot) => slot.slotType === slotType).length + 1

    const newSlot =
      slotType === 'singles'
        ? createSinglesSlot(id, `${labelBase} ${nextCount}`)
        : createDoublesSlot(id, `${labelBase} ${nextCount}`)

    if (side === 'team') {
      setTeamSlots((current) => [...current, newSlot])
    } else {
      setOpponentSlots((current) => [...current, newSlot])
    }
  }

  function removeSlot(side: 'team' | 'opponent', slotId: string) {
    if (side === 'team') {
      setTeamSlots((current) => current.filter((slot) => slot.id !== slotId))
    } else {
      setOpponentSlots((current) => current.filter((slot) => slot.id !== slotId))
    }
  }

  function resetBuilder() {
    setCurrentScenarioId('')
    setScenarioName('')
    setLeagueName('')
    setFlight('')
    setTeamName('')
    setOpponentTeam('')
    setMatchDate('')
    setNotes('')
    setLoadingScenarioId('')
    setTeamSlots(cloneSlots(DEFAULT_TEAM_SLOTS))
    setOpponentSlots(cloneSlots(DEFAULT_OPPONENT_SLOTS))
    setMessage('Builder reset.')
    setError('')
  }

  async function refreshSavedScenarios() {
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

    if (error) {
      setError(error.message)
      return []
    }

    const rows = (data ?? []) as ScenarioRow[]
    setSavedScenarios(rows)
    return rows
  }

  function buildScenarioPayload() {
    return {
      scenario_name: scenarioName.trim(),
      league_name: leagueName || null,
      flight: flight || null,
      match_date: matchDate || null,
      team_name: teamName || null,
      opponent_team: opponentTeam || null,
      slots_json: teamSlots,
      opponent_slots_json: opponentSlots,
      notes: notes.trim() || null,
    }
  }

  async function saveScenario(asNew = false) {
    setSaving(true)
    setError('')
    setMessage('')

    if (!scenarioName.trim()) {
      setSaving(false)
      setError('Please enter a scenario name.')
      return
    }

    const normalizedName = scenarioName.trim().toLowerCase()

    const duplicate = savedScenarios.find((s) => {
      const sameName = (s.scenario_name ?? '').trim().toLowerCase() === normalizedName
      const sameTeam = (s.team_name ?? '') === (teamName || '')
      const sameDate = (s.match_date ?? '') === (matchDate || '')

      return sameName && sameTeam && sameDate
    })

    if (duplicate && (asNew || duplicate.id !== currentScenarioId)) {
      setSaving(false)
      setError(
        'A scenario with this name already exists for this team and match date. Use a different name or update the existing one.'
      )
      return
    }

    const payload = buildScenarioPayload()

    if (currentScenarioId && !asNew) {
      const { error } = await supabase
        .from('lineup_scenarios')
        .update(payload)
        .eq('id', currentScenarioId)

      setSaving(false)

      if (error) {
        setError(error.message)
        return
      }

      await refreshSavedScenarios()
      setMessage('Scenario updated successfully.')
      return
    }

    const { data, error } = await supabase
      .from('lineup_scenarios')
      .insert(payload)
      .select('id')
      .single()

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    if (data?.id) {
      setCurrentScenarioId(data.id)
    }

    await refreshSavedScenarios()
    setMessage(asNew ? 'Scenario saved as new successfully.' : 'Scenario saved successfully.')
  }

  async function deleteScenario(scenarioId: string) {
    const scenario = savedScenarios.find((row) => row.id === scenarioId)
    const confirmed = window.confirm(
      `Delete scenario "${scenario?.scenario_name ?? 'this scenario'}"? This cannot be undone.`
    )

    if (!confirmed) return

    setDeletingScenarioId(scenarioId)
    setError('')
    setMessage('')

    const { error } = await supabase
      .from('lineup_scenarios')
      .delete()
      .eq('id', scenarioId)

    setDeletingScenarioId('')

    if (error) {
      setError(error.message)
      return
    }

    const deletedCurrentScenario = scenarioId === currentScenarioId

    await refreshSavedScenarios()

    if (deletedCurrentScenario) {
      setCurrentScenarioId('')
      setMessage('Scenario deleted. Builder is now in new scenario mode.')
    } else {
      setMessage('Scenario deleted successfully.')
    }
  }

  async function loadScenario(scenarioId: string) {
    setLoadingScenarioId(scenarioId)
    setError('')
    setMessage('')

    const scenario = savedScenarios.find((row) => row.id === scenarioId)

    if (!scenario) {
      setLoadingScenarioId('')
      setError('Scenario not found.')
      return
    }

    setCurrentScenarioId(scenario.id)
    setScenarioName(scenario.scenario_name ?? '')
    setLeagueName(scenario.league_name ?? '')
    setFlight(scenario.flight ?? '')
    setMatchDate(scenario.match_date ?? '')
    setTeamName(scenario.team_name ?? '')
    setOpponentTeam(scenario.opponent_team ?? '')
    setNotes(scenario.notes ?? '')

    const loadedTeamSlots = normalizeSavedSlots(scenario.slots_json)
    const loadedOpponentSlots = normalizeSavedSlots(scenario.opponent_slots_json)

    setTeamSlots(loadedTeamSlots.length ? loadedTeamSlots : cloneSlots(DEFAULT_TEAM_SLOTS))
    setOpponentSlots(
      loadedOpponentSlots.length ? loadedOpponentSlots : cloneSlots(DEFAULT_OPPONENT_SLOTS)
    )

    setLoadingScenarioId('')
    setMessage('Scenario loaded into the builder.')
  }

  const currentScenario = useMemo(
    () => savedScenarios.find((scenario) => scenario.id === currentScenarioId) ?? null,
    [savedScenarios, currentScenarioId]
  )

  const compareHref = useMemo(() => {
    const params = new URLSearchParams()

    if (leagueName) params.set('league', leagueName)
    if (flight) params.set('flight', flight)
    if (teamName) params.set('team', teamName)
    if (matchDate) params.set('date', matchDate)
    if (currentScenarioId) params.set('left', currentScenarioId)

    const query = params.toString()

    return query
      ? `/captains-corner/scenario-comparison?${query}`
      : '/captains-corner/scenario-comparison'
  }, [leagueName, flight, teamName, matchDate, currentScenarioId])

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
                Match-day strategy workspace
              </p>
              <h1 style={heroTitleStyle}>Lineup Builder</h1>
              <p style={heroTextStyle}>
                Build match-day lineups, work from availability-aware player pools, save
                multiple scenarios, compare versions, and keep your captain prep organized.
              </p>

              <div style={heroButtonRowStyle}>
                <Link href={compareHref} className="button-primary">
                  Compare Saved Scenarios
                </Link>
                <button type="button" className="button-secondary" onClick={resetBuilder}>
                  Reset Builder
                </button>
              </div>

              <div className="metric-grid" style={heroMetricGridStyle}>
                <div className="metric-card">
                  <div className="section-kicker">Scenario Mode</div>
                  <div style={metricValueStyle}>
                    {currentScenarioId ? 'Editing saved scenario' : 'New scenario'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="section-kicker">Player Pool</div>
                  <div style={metricValueStyle}>
                    {availablePlayerPool.length} available option
                    {availablePlayerPool.length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="metric-card">
                  <div className="section-kicker">Saved Versions</div>
                  <div style={metricValueStyle}>
                    {scenarioOptions.length} scenario
                    {scenarioOptions.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card panel-pad">
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Builder workflow
              </p>
              <h2 style={sideHeroTitleStyle}>Set the match context, build, save, compare</h2>

              <div style={workflowListStyle}>
                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>1</div>
                  <div>
                    <div style={workflowTitleStyle}>Define the match context</div>
                    <div style={workflowTextStyle}>
                      League, flight, team, opponent, and match date drive your scenario setup.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>2</div>
                  <div>
                    <div style={workflowTitleStyle}>Build both sides</div>
                    <div style={workflowTextStyle}>
                      Create your lineup and capture the likely opponent projection in one place.
                    </div>
                  </div>
                </div>

                <div style={workflowRowStyle}>
                  <div style={workflowNumberStyle}>3</div>
                  <div>
                    <div style={workflowTitleStyle}>Save and compare</div>
                    <div style={workflowTextStyle}>
                      Keep multiple versions and open scenario comparison when decisions get tight.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div style={builderLayoutStyle}>
          <div style={columnStyle}>
            <section className="surface-card-strong panel-pad">
              <div style={sectionHeaderStyle}>
                <div>
                  <p className="section-kicker" style={{ marginBottom: 8 }}>
                    Scenario setup
                  </p>
                  <h2 className="section-title" style={{ marginBottom: 8 }}>
                    Match and scenario details
                  </h2>
                  <p style={sectionBodyTextStyle}>
                    Save a new version or update the scenario currently loaded into the builder.
                  </p>
                </div>
              </div>

              {currentScenario ? (
                <div style={bannerBlueStyle}>
                  <div style={bannerTitleStyle}>
                    Editing saved scenario: {currentScenario.scenario_name}
                  </div>
                  <div style={bannerMetaStyle}>
                    {currentScenario.team_name || '—'} vs {currentScenario.opponent_team || '—'}
                    {currentScenario.match_date ? ` • ${formatDate(currentScenario.match_date)}` : ''}
                  </div>
                </div>
              ) : (
                <div style={bannerSlateStyle}>Creating a new scenario</div>
              )}

              <div style={formGridStyle}>
                <div>
                  <label className="label">Scenario Name</label>
                  <input
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                    placeholder="Example: Safer Doubles Version"
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">Match Date</label>
                  <input
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    className="input"
                  />
                </div>

                <div>
                  <label className="label">League</label>
                  <input
                    list="league-options"
                    value={leagueName}
                    onChange={(e) => setLeagueName(e.target.value)}
                    placeholder="League name"
                    className="input"
                  />
                  <datalist id="league-options">
                    {leagueOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label">Flight</label>
                  <input
                    list="flight-options"
                    value={flight}
                    onChange={(e) => setFlight(e.target.value)}
                    placeholder="Flight"
                    className="input"
                  />
                  <datalist id="flight-options">
                    {flightOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label">Team Name</label>
                  <input
                    list="team-options"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Your team"
                    className="input"
                  />
                  <datalist id="team-options">
                    {teamOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label">Opponent Team</label>
                  <input
                    value={opponentTeam}
                    onChange={(e) => setOpponentTeam(e.target.value)}
                    placeholder="Opponent team"
                    className="input"
                  />
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label className="label">Captain Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Matchups, player preferences, injury notes, weather backups, etc."
                  className="textarea"
                  style={{ minHeight: 118 }}
                />
              </div>

              <div style={toggleGridStyle}>
                <label style={toggleCardStyle}>
                  <div>
                    <div style={toggleTitleStyle}>Availability-filtered pool</div>
                    <div style={toggleTextStyle}>
                      Use lineup availability records when they exist for the selected match context.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={availabilityOnly}
                    onChange={(e) => setAvailabilityOnly(e.target.checked)}
                  />
                </label>

                <label style={toggleCardStyle}>
                  <div>
                    <div style={toggleTitleStyle}>Hide unavailable players</div>
                    <div style={toggleTextStyle}>
                      Remove players marked out or unavailable from your selection list.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={hideUnavailable}
                    onChange={(e) => setHideUnavailable(e.target.checked)}
                  />
                </label>
              </div>

              <div style={actionRowStyle}>
                <button
                  type="button"
                  onClick={() => saveScenario(false)}
                  className="button-primary"
                  disabled={saving}
                >
                  {saving
                    ? 'Saving...'
                    : currentScenarioId
                      ? 'Update Scenario'
                      : 'Save Scenario'}
                </button>

                <button
                  type="button"
                  onClick={() => saveScenario(true)}
                  className="button-secondary"
                  disabled={saving}
                >
                  Save as New
                </button>

                <Link href={compareHref} className="button-ghost">
                  Open Comparison
                </Link>
              </div>

              {currentScenarioId ? (
                <p style={infoTextStyle}>
                  Loaded scenario is ready for update and comparison.
                </p>
              ) : null}

              {message ? <p style={successTextStyle}>{message}</p> : null}
              {error ? <p style={errorTextStyle}>{error}</p> : null}
            </section>

            <section className="surface-card panel-pad">
              <div style={sectionHeaderStyle}>
                <div>
                  <p className="section-kicker" style={{ marginBottom: 8 }}>
                    Your lineup
                  </p>
                  <h2 className="section-title" style={{ marginBottom: 8 }}>
                    Build your side
                  </h2>
                  <p style={sectionBodyTextStyle}>
                    Create singles and doubles slots for your expected match-day lineup.
                  </p>
                </div>

                <div style={miniActionRowStyle}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => addSlot('team', 'singles')}
                  >
                    + Singles Slot
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => addSlot('team', 'doubles')}
                  >
                    + Doubles Slot
                  </button>
                </div>
              </div>

              <div style={slotListStyle}>
                {teamSlots.map((slot) => (
                  <SlotEditor
                    key={slot.id}
                    slot={slot}
                    side="team"
                    playerPool={availablePlayerPool}
                    assignedPlayerIds={assignedPlayerIds}
                    setSlotLabel={setSlotLabel}
                    setSlotPlayer={setSlotPlayer}
                    removeSlot={removeSlot}
                    playerLabel={playerLabel}
                  />
                ))}
              </div>
            </section>

            <section className="surface-card panel-pad">
              <div style={sectionHeaderStyle}>
                <div>
                  <p className="section-kicker" style={{ marginBottom: 8 }}>
                    Opponent projection
                  </p>
                  <h2 className="section-title" style={{ marginBottom: 8 }}>
                    Model the other side
                  </h2>
                  <p style={sectionBodyTextStyle}>
                    Capture your expected opponent lineup or your best working guess.
                  </p>
                </div>

                <div style={miniActionRowStyle}>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => addSlot('opponent', 'singles')}
                  >
                    + Singles Slot
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => addSlot('opponent', 'doubles')}
                  >
                    + Doubles Slot
                  </button>
                </div>
              </div>

              <div style={slotListStyle}>
                {opponentSlots.map((slot) => (
                  <SlotEditor
                    key={slot.id}
                    slot={slot}
                    side="opponent"
                    playerPool={availablePlayerPool}
                    assignedPlayerIds={assignedPlayerIds}
                    setSlotLabel={setSlotLabel}
                    setSlotPlayer={setSlotPlayer}
                    removeSlot={removeSlot}
                    playerLabel={playerLabel}
                  />
                ))}
              </div>
            </section>
          </div>

          <div style={columnStyle}>
            <section className="surface-card panel-pad">
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Player pool
              </p>
              <h2 className="section-title" style={{ marginBottom: 8 }}>
                Availability-aware player options
              </h2>
              <p style={sectionBodyTextStyle}>
                Sorted by availability first, then rating, so you can see the most realistic
                options for the current scenario.
              </p>

              <div style={pillRowStyle}>
                <div className="badge badge-slate">
                  {availablePlayerPool.length} player
                  {availablePlayerPool.length === 1 ? '' : 's'}
                </div>
                <div className="badge badge-blue">
                  {availabilityForSelection.length} availability row
                  {availabilityForSelection.length === 1 ? '' : 's'}
                </div>
              </div>

              <div style={stackStyle}>
                {loading ? (
                  <p style={mutedTextStyle}>Loading players...</p>
                ) : availablePlayerPool.length === 0 ? (
                  <p style={mutedTextStyle}>
                    No players match the current filters. Try clearing a filter or disabling
                    availability-only mode.
                  </p>
                ) : (
                  availablePlayerPool.map((player) => {
                    const tone = statusTone(player.availabilityStatus)
                    const assigned = assignedPlayerIds.has(player.id)

                    return (
                      <article key={player.id} style={poolCardStyle}>
                        <div style={poolCardTopStyle}>
                          <div>
                            <div style={playerNameStyle}>{player.name}</div>
                            <div style={playerMetaStyle}>
                              {player.preferred_role || 'No role set'}
                              {player.location ? ` • ${player.location}` : ''}
                              {player.flight ? ` • ${player.flight}` : ''}
                            </div>
                          </div>

                          <span style={{ ...statusBadgeStyle, ...tone }}>
                            {player.availabilityStatus || 'Unknown'}
                          </span>
                        </div>

                        <div style={pillRowStyle}>
                          <span className="badge badge-slate">
                            OVR{' '}
                            {(player.overall_dynamic_rating ?? player.overall_rating)?.toFixed(2) ??
                              '—'}
                          </span>
                          <span className="badge badge-slate">
                            S {player.singles_dynamic_rating?.toFixed(2) ?? '—'}
                          </span>
                          <span className="badge badge-slate">
                            D {player.doubles_dynamic_rating?.toFixed(2) ?? '—'}
                          </span>
                          {assigned ? <span className="badge badge-green">Assigned</span> : null}
                        </div>

                        {player.lineup_notes ? (
                          <p style={cardNoteTextStyle}>{player.lineup_notes}</p>
                        ) : null}

                        {player.availabilityNotes ? (
                          <p style={subtleNoteTextStyle}>
                            Availability note: {player.availabilityNotes}
                          </p>
                        ) : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>

            <section className="surface-card panel-pad">
              <p className="section-kicker" style={{ marginBottom: 8 }}>
                Saved scenarios
              </p>
              <h2 className="section-title" style={{ marginBottom: 8 }}>
                Reload or clean up prior versions
              </h2>
              <p style={sectionBodyTextStyle}>
                Load a saved scenario into the builder, then tweak, compare, resave, or delete it.
              </p>

              <div style={stackStyle}>
                {scenarioOptions.length === 0 ? (
                  <p style={mutedTextStyle}>No saved scenarios for the current filters.</p>
                ) : (
                  scenarioOptions.map((scenario) => {
                    const isCurrent = scenario.id === currentScenarioId
                    const isDeleting = deletingScenarioId === scenario.id
                    const isLoading = loadingScenarioId === scenario.id

                    return (
                      <article
                        key={scenario.id}
                        style={{
                          ...savedScenarioCardStyle,
                          ...(isCurrent ? savedScenarioCardActiveStyle : null),
                        }}
                      >
                        <div style={savedScenarioTopStyle}>
                          <div>
                            <div style={savedScenarioTitleStyle}>{scenario.scenario_name}</div>
                            <div style={savedScenarioMetaStyle}>
                              {scenario.team_name || '—'} vs {scenario.opponent_team || '—'}
                            </div>
                            <div style={savedScenarioMetaStyle}>
                              {scenario.league_name || '—'}
                              {scenario.flight ? ` • ${scenario.flight}` : ''}
                              {scenario.match_date ? ` • ${formatDate(scenario.match_date)}` : ''}
                            </div>
                            {isCurrent ? (
                              <div style={{ marginTop: 8 }}>
                                <span className="badge badge-blue">Currently loaded</span>
                              </div>
                            ) : null}
                          </div>

                          <div style={savedScenarioActionsStyle}>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => loadScenario(scenario.id)}
                              disabled={isLoading || isDeleting}
                            >
                              {isLoading ? 'Loading...' : 'Load'}
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteScenario(scenario.id)}
                              disabled={isDeleting || isLoading}
                              style={dangerButtonStyle}
                            >
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        {scenario.notes ? (
                          <p style={cardNoteTextStyle}>{scenario.notes}</p>
                        ) : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}

function SlotEditor({
  slot,
  side,
  playerPool,
  assignedPlayerIds,
  setSlotLabel,
  setSlotPlayer,
  removeSlot,
  playerLabel,
}: {
  slot: LineupSlot
  side: 'team' | 'opponent'
  playerPool: Array<
    PlayerRow & {
      availabilityStatus: string | null
      availabilityNotes: string | null
    }
  >
  assignedPlayerIds: Set<string>
  setSlotLabel: (side: 'team' | 'opponent', slotId: string, label: string) => void
  setSlotPlayer: (
    side: 'team' | 'opponent',
    slotId: string,
    playerIndex: number,
    playerId: string
  ) => void
  removeSlot: (side: 'team' | 'opponent', slotId: string) => void
  playerLabel: (player: {
    name: string
    availabilityStatus: string | null
    overall_dynamic_rating: number | null
    overall_rating: number | null
    singles_dynamic_rating: number | null
    doubles_dynamic_rating: number | null
  }) => string
}) {
  return (
    <div style={slotCardStyle}>
      <div style={slotHeaderStyle}>
        <div style={slotHeaderLeftStyle}>
          <input
            value={slot.label}
            onChange={(e) => setSlotLabel(side, slot.id, e.target.value)}
            className="input"
            style={slotLabelInputStyle}
          />
          <span className={slot.slotType === 'singles' ? 'badge badge-blue' : 'badge badge-green'}>
            {slot.slotType === 'singles' ? 'Singles' : 'Doubles'}
          </span>
        </div>

        <button type="button" onClick={() => removeSlot(side, slot.id)} style={dangerButtonStyle}>
          Remove
        </button>
      </div>

      <div style={slotPlayersGridStyle}>
        {slot.players.map((selectedPlayer, index) => (
          <div key={`${slot.id}-${index}`}>
            <label className="label" style={{ marginBottom: 6 }}>
              {slot.slotType === 'doubles' ? `Player ${index + 1}` : 'Player'}
            </label>

            <select
              value={selectedPlayer.playerId}
              onChange={(e) => setSlotPlayer(side, slot.id, index, e.target.value)}
              className="select"
            >
              <option value="">Select player</option>
              {playerPool.map((player) => {
                const isTakenElsewhere =
                  player.id !== selectedPlayer.playerId && assignedPlayerIds.has(player.id)

                return (
                  <option key={player.id} value={player.id} disabled={isTakenElsewhere}>
                    {playerLabel(player)}
                    {isTakenElsewhere ? ' • already assigned' : ''}
                  </option>
                )
              })}
            </select>
          </div>
        ))}
      </div>
    </div>
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
  fontSize: 'clamp(2.15rem, 4vw, 3.15rem)',
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
  fontSize: '1.05rem',
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

const builderLayoutStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.95fr)',
  gap: '20px',
  alignItems: 'start',
}

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
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
}

const bannerBlueStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  background: 'rgba(37, 91, 227, 0.08)',
  border: '1px solid rgba(37, 91, 227, 0.14)',
}

const bannerSlateStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  background: 'rgba(15, 22, 50, 0.04)',
  border: '1px solid rgba(15, 22, 50, 0.08)',
  color: '#51607a',
  fontWeight: 700,
}

const bannerTitleStyle: CSSProperties = {
  color: '#255BE3',
  fontWeight: 800,
  marginBottom: '4px',
}

const bannerMetaStyle: CSSProperties = {
  color: '#4b5e93',
  lineHeight: 1.5,
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const toggleGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '12px',
  marginTop: '18px',
}

const toggleCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '14px',
  padding: '14px 16px',
  borderRadius: '16px',
  background: 'rgba(15, 22, 50, 0.03)',
  border: '1px solid rgba(15, 22, 50, 0.06)',
}

const toggleTitleStyle: CSSProperties = {
  fontWeight: 800,
  color: '#0f1632',
  marginBottom: 4,
}

const toggleTextStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  lineHeight: 1.5,
  fontSize: '.94rem',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '18px',
}

const miniActionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const infoTextStyle: CSSProperties = {
  color: '#255BE3',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const successTextStyle: CSSProperties = {
  color: '#0f8f52',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const errorTextStyle: CSSProperties = {
  color: '#c43f3f',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const slotListStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const slotCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '16px',
  background: 'linear-gradient(180deg, rgba(248,250,255,0.98) 0%, #ffffff 100%)',
  border: '1px solid rgba(37, 91, 227, 0.10)',
  boxShadow: '0 16px 40px rgba(15, 22, 50, 0.05)',
}

const slotHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px',
}

const slotHeaderLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
}

const slotLabelInputStyle: CSSProperties = {
  minWidth: 180,
  fontWeight: 700,
}

const slotPlayersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '12px',
}

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '14px',
}

const mutedTextStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  margin: 0,
  lineHeight: 1.6,
}

const poolCardStyle: CSSProperties = {
  border: '1px solid rgba(15, 22, 50, 0.08)',
  borderRadius: '18px',
  padding: '14px',
  background: '#ffffff',
}

const poolCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '10px',
}

const playerNameStyle: CSSProperties = {
  color: '#0f1632',
  fontWeight: 800,
  fontSize: '1rem',
}

const playerMetaStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  marginTop: '4px',
}

const statusBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: '999px',
  fontWeight: 700,
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
}

const cardNoteTextStyle: CSSProperties = {
  margin: '10px 0 0 0',
  color: '#0f1632',
  lineHeight: 1.58,
}

const subtleNoteTextStyle: CSSProperties = {
  margin: '8px 0 0 0',
  color: 'var(--muted-foreground, #667085)',
  lineHeight: 1.58,
  fontSize: '0.92rem',
}

const savedScenarioCardStyle: CSSProperties = {
  border: '1px solid rgba(15, 22, 50, 0.08)',
  borderRadius: '18px',
  padding: '14px',
  background: '#ffffff',
}

const savedScenarioCardActiveStyle: CSSProperties = {
  border: '1px solid rgba(37, 91, 227, 0.22)',
  boxShadow: '0 0 0 3px rgba(37, 91, 227, 0.08)',
}

const savedScenarioTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
}

const savedScenarioTitleStyle: CSSProperties = {
  color: '#0f1632',
  fontWeight: 800,
  fontSize: '1rem',
}

const savedScenarioMetaStyle: CSSProperties = {
  color: 'var(--muted-foreground, #667085)',
  fontSize: '0.92rem',
  lineHeight: 1.55,
  marginTop: '4px',
}

const savedScenarioActionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  alignItems: 'stretch',
}

const dangerButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '12px',
  background: 'rgba(255, 93, 93, 0.08)',
  color: '#c43f3f',
  border: '1px solid rgba(255, 93, 93, 0.18)',
  fontWeight: 700,
  cursor: 'pointer',
}