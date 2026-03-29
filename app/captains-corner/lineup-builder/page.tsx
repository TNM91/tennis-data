'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
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
      background: '#edf9f1',
      color: '#17663a',
      border: '1px solid #b7e3c6',
    }
  }

  if (normalized === 'maybe') {
    return {
      background: '#fff7e8',
      color: '#9a6700',
      border: '1px solid #f1d38b',
    }
  }

  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') {
    return {
      background: '#fff1ef',
      color: '#b42318',
      border: '1px solid #f6c7c1',
    }
  }

  return {
    background: '#f4f6fb',
    color: '#5c6784',
    border: '1px solid #dde3f1',
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

    setTeamSlots(
      loadedTeamSlots.length ? loadedTeamSlots : cloneSlots(DEFAULT_TEAM_SLOTS)
    )
    setOpponentSlots(
      loadedOpponentSlots.length
        ? loadedOpponentSlots
        : cloneSlots(DEFAULT_OPPONENT_SLOTS)
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
        <Link href="/captains-corner/scenario-comparison" style={navLinkStyle}>
          Scenario Comparison
        </Link>
      </div>

      <section style={heroCardStyle}>
        <div style={heroTopRowStyle}>
          <div>
            <div style={heroBadgeStyle}>Captain Tools</div>
            <h1 style={titleStyle}>Lineup Builder</h1>
            <p style={subtitleStyle}>
              Build match-day lineups, use availability-aware player pools, save
              scenarios, compare versions, and clean up older plans when they are no longer needed.
            </p>
          </div>

          <div style={heroActionsStyle}>
            <Link href={compareHref} style={secondaryButtonStyle}>
              Compare Saved Scenarios
            </Link>
            <button type="button" style={ghostButtonStyle} onClick={resetBuilder}>
              Reset Builder
            </button>
          </div>
        </div>
      </section>

      <section style={sectionGridStyle}>
        <div style={leftColumnStyle}>
          <section style={cardStyle}>
            <div style={cardHeaderRowStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Scenario Setup</h2>
                <p style={sectionSubtitleStyle}>
                  Save a new version or update the scenario you currently have loaded.
                </p>
              </div>
            </div>

            {currentScenario ? (
              <div style={loadedScenarioBannerStyle}>
                <div style={loadedScenarioTitleStyle}>
                  Editing saved scenario: {currentScenario.scenario_name}
                </div>
                <div style={loadedScenarioMetaStyle}>
                  {currentScenario.team_name || '—'} vs {currentScenario.opponent_team || '—'}
                  {currentScenario.match_date ? ` • ${formatDate(currentScenario.match_date)}` : ''}
                </div>
              </div>
            ) : (
              <div style={newScenarioBannerStyle}>Creating a new scenario</div>
            )}

            <div style={formGridStyle}>
              <div>
                <label style={labelStyle}>Scenario Name</label>
                <input
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Example: Safer Doubles Version"
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>Match Date</label>
                <input
                  type="date"
                  value={matchDate}
                  onChange={(e) => setMatchDate(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle}>League</label>
                <input
                  list="league-options"
                  value={leagueName}
                  onChange={(e) => setLeagueName(e.target.value)}
                  placeholder="League name"
                  style={inputStyle}
                />
                <datalist id="league-options">
                  {leagueOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Flight</label>
                <input
                  list="flight-options"
                  value={flight}
                  onChange={(e) => setFlight(e.target.value)}
                  placeholder="Flight"
                  style={inputStyle}
                />
                <datalist id="flight-options">
                  {flightOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Team Name</label>
                <input
                  list="team-options"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Your team"
                  style={inputStyle}
                />
                <datalist id="team-options">
                  {teamOptions.map((option) => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={labelStyle}>Opponent Team</label>
                <input
                  value={opponentTeam}
                  onChange={(e) => setOpponentTeam(e.target.value)}
                  placeholder="Opponent team"
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={textAreaWrapStyle}>
              <label style={labelStyle}>Captain Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Matchups, player preferences, injury notes, weather backups, etc."
                style={textAreaStyle}
              />
            </div>

            <div style={toggleRowStyle}>
              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={availabilityOnly}
                  onChange={(e) => setAvailabilityOnly(e.target.checked)}
                />
                <span>Use availability-filtered player pool when available</span>
              </label>

              <label style={checkboxLabelStyle}>
                <input
                  type="checkbox"
                  checked={hideUnavailable}
                  onChange={(e) => setHideUnavailable(e.target.checked)}
                />
                <span>Hide unavailable players</span>
              </label>
            </div>

            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={() => saveScenario(false)}
                style={primaryButtonStyle}
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
                style={secondaryActionButtonStyle}
                disabled={saving}
              >
                Save as New
              </button>

              <Link href={compareHref} style={secondaryButtonStyle}>
                Open Comparison
              </Link>
            </div>

            {currentScenarioId ? (
              <p style={activeScenarioTextStyle}>
                Loaded scenario is ready for update and comparison.
              </p>
            ) : null}

            {message ? <p style={successTextStyle}>{message}</p> : null}
            {error ? <p style={errorTextStyle}>{error}</p> : null}
          </section>

          <section style={cardStyle}>
            <div style={cardHeaderRowStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Your Lineup</h2>
                <p style={sectionSubtitleStyle}>
                  Build your planned lineup with singles and doubles slots.
                </p>
              </div>

              <div style={miniActionRowStyle}>
                <button
                  type="button"
                  style={smallButtonStyle}
                  onClick={() => addSlot('team', 'singles')}
                >
                  + Singles Slot
                </button>
                <button
                  type="button"
                  style={smallButtonStyle}
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

          <section style={cardStyle}>
            <div style={cardHeaderRowStyle}>
              <div>
                <h2 style={sectionTitleStyle}>Opponent Projection</h2>
                <p style={sectionSubtitleStyle}>
                  Capture your expected opponent lineup or best guess.
                </p>
              </div>

              <div style={miniActionRowStyle}>
                <button
                  type="button"
                  style={smallButtonStyle}
                  onClick={() => addSlot('opponent', 'singles')}
                >
                  + Singles Slot
                </button>
                <button
                  type="button"
                  style={smallButtonStyle}
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

        <div style={rightColumnStyle}>
          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Player Pool</h2>
            <p style={sectionSubtitleStyle}>
              Sorted by availability first, then rating. Use this to quickly see
              likely options for the current scenario.
            </p>

            <div style={summaryPillsRowStyle}>
              <div style={summaryPillStyle}>
                {availablePlayerPool.length} player
                {availablePlayerPool.length === 1 ? '' : 's'}
              </div>
              <div style={summaryPillStyle}>
                {availabilityForSelection.length} availability row
                {availabilityForSelection.length === 1 ? '' : 's'}
              </div>
            </div>

            <div style={playerPoolListStyle}>
              {loading ? (
                <p style={mutedTextStyle}>Loading players...</p>
              ) : availablePlayerPool.length === 0 ? (
                <p style={mutedTextStyle}>
                  No players match the current filters. Try clearing a filter or
                  disabling availability-only mode.
                </p>
              ) : (
                availablePlayerPool.map((player) => {
                  const tone = statusTone(player.availabilityStatus)
                  const assigned = assignedPlayerIds.has(player.id)

                  return (
                    <div key={player.id} style={playerCardStyle}>
                      <div style={playerCardTopRowStyle}>
                        <div>
                          <div style={playerNameStyle}>{player.name}</div>
                          <div style={playerMetaStyle}>
                            {player.preferred_role || 'No role set'}
                            {player.location ? ` • ${player.location}` : ''}
                            {player.flight ? ` • ${player.flight}` : ''}
                          </div>
                        </div>

                        <span style={{ ...availabilityBadgeStyle, ...tone }}>
                          {player.availabilityStatus || 'Unknown'}
                        </span>
                      </div>

                      <div style={ratingsRowStyle}>
                        <span style={ratingChipStyle}>
                          OVR{' '}
                          {(player.overall_dynamic_rating ?? player.overall_rating)?.toFixed(2) ??
                            '—'}
                        </span>
                        <span style={ratingChipStyle}>
                          S {player.singles_dynamic_rating?.toFixed(2) ?? '—'}
                        </span>
                        <span style={ratingChipStyle}>
                          D {player.doubles_dynamic_rating?.toFixed(2) ?? '—'}
                        </span>
                        {assigned ? <span style={assignedChipStyle}>Assigned</span> : null}
                      </div>

                      {player.lineup_notes ? (
                        <p style={playerNotesStyle}>{player.lineup_notes}</p>
                      ) : null}

                      {player.availabilityNotes ? (
                        <p style={availabilityNotesStyle}>
                          Availability note: {player.availabilityNotes}
                        </p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </section>

          <section style={cardStyle}>
            <h2 style={sectionTitleStyle}>Saved Scenarios</h2>
            <p style={sectionSubtitleStyle}>
              Load a saved scenario into the builder, then tweak, re-save, compare, or delete it.
            </p>

            <div style={savedScenarioListStyle}>
              {scenarioOptions.length === 0 ? (
                <p style={mutedTextStyle}>No saved scenarios for the current filters.</p>
              ) : (
                scenarioOptions.map((scenario) => {
                  const isCurrent = scenario.id === currentScenarioId
                  const isDeleting = deletingScenarioId === scenario.id
                  const isLoading = loadingScenarioId === scenario.id

                  return (
                    <div
                      key={scenario.id}
                      style={{
                        ...savedScenarioCardStyle,
                        ...(isCurrent ? currentSavedScenarioCardStyle : {}),
                      }}
                    >
                      <div style={savedScenarioTopStyle}>
                        <div>
                          <div style={savedScenarioNameStyle}>
                            {scenario.scenario_name}
                          </div>
                          <div style={savedScenarioMetaStyle}>
                            {scenario.team_name || '—'} vs {scenario.opponent_team || '—'}
                          </div>
                          <div style={savedScenarioMetaStyle}>
                            {scenario.league_name || '—'}
                            {scenario.flight ? ` • ${scenario.flight}` : ''}
                            {scenario.match_date ? ` • ${formatDate(scenario.match_date)}` : ''}
                          </div>
                          {isCurrent ? (
                            <div style={currentScenarioBadgeStyle}>Currently loaded</div>
                          ) : null}
                        </div>

                        <div style={savedScenarioActionColumnStyle}>
                          <button
                            type="button"
                            style={smallButtonStyle}
                            onClick={() => loadScenario(scenario.id)}
                            disabled={isLoading || isDeleting}
                          >
                            {isLoading ? 'Loading...' : 'Load'}
                          </button>

                          <button
                            type="button"
                            style={deleteButtonStyle}
                            onClick={() => deleteScenario(scenario.id)}
                            disabled={isDeleting || isLoading}
                          >
                            {isDeleting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      {scenario.notes ? (
                        <p style={savedScenarioNotesStyle}>{scenario.notes}</p>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
          </section>
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
            style={slotLabelInputStyle}
          />
          <span style={slotTypeBadgeStyle}>
            {slot.slotType === 'singles' ? 'Singles' : 'Doubles'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => removeSlot(side, slot.id)}
          style={removeButtonStyle}
        >
          Remove
        </button>
      </div>

      <div style={slotPlayersGridStyle}>
        {slot.players.map((selectedPlayer, index) => (
          <div key={`${slot.id}-${index}`}>
            <label style={smallLabelStyle}>
              {slot.slotType === 'doubles' ? `Player ${index + 1}` : 'Player'}
            </label>

            <select
              value={selectedPlayer.playerId}
              onChange={(e) => setSlotPlayer(side, slot.id, index, e.target.value)}
              style={inputStyle}
            >
              <option value="">Select player</option>
              {playerPool.map((player) => {
                const isTakenElsewhere =
                  player.id !== selectedPlayer.playerId &&
                  assignedPlayerIds.has(player.id)

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

const heroActionsStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const sectionGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 0.9fr)',
  gap: '20px',
  alignItems: 'start',
}

const leftColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
}

const rightColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: '20px',
  padding: '20px',
  boxShadow: '0 10px 26px rgba(15, 22, 50, 0.08)',
  border: '1px solid #ebeff8',
}

const cardHeaderRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap',
  marginBottom: '16px',
}

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.15rem',
  color: '#0f1632',
}

const sectionSubtitleStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#5c6784',
  lineHeight: 1.5,
}

const loadedScenarioBannerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#eef4ff',
  border: '1px solid #cdd9ff',
}

const loadedScenarioTitleStyle: React.CSSProperties = {
  color: '#255BE3',
  fontWeight: 800,
  marginBottom: '4px',
}

const loadedScenarioMetaStyle: React.CSSProperties = {
  color: '#4b5e93',
  lineHeight: 1.5,
}

const newScenarioBannerStyle: React.CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '14px',
  background: '#f7f9ff',
  border: '1px solid #dde3f1',
  color: '#5c6784',
  fontWeight: 700,
}

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '8px',
  fontSize: '0.95rem',
  fontWeight: 700,
  color: '#0f1632',
}

const smallLabelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  fontSize: '0.82rem',
  fontWeight: 700,
  color: '#5c6784',
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

const textAreaWrapStyle: React.CSSProperties = {
  marginTop: '16px',
}

const textAreaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '110px',
  padding: '12px 14px',
  borderRadius: '12px',
  border: '1px solid #d7def0',
  background: '#ffffff',
  color: '#0f1632',
  fontSize: '0.95rem',
  outline: 'none',
  resize: 'vertical',
}

const toggleRowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
  marginTop: '16px',
}

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  alignItems: 'center',
  color: '#0f1632',
  fontWeight: 500,
}

const actionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '18px',
}

const miniActionRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
}

const primaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#255BE3',
  color: '#ffffff',
  textDecoration: 'none',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
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

const secondaryActionButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#ffffff',
  color: '#0f1632',
  fontWeight: 700,
  border: '1px solid #d7def0',
  cursor: 'pointer',
}

const ghostButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 16px',
  borderRadius: '12px',
  background: '#ffffff',
  color: '#0f1632',
  fontWeight: 700,
  border: '1px solid #d7def0',
  cursor: 'pointer',
}

const smallButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#f7f9ff',
  color: '#0f1632',
  fontWeight: 700,
  border: '1px solid #d7def0',
  cursor: 'pointer',
}

const deleteButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 12px',
  borderRadius: '10px',
  background: '#fff5f4',
  color: '#b42318',
  fontWeight: 700,
  border: '1px solid #f0c7c2',
  cursor: 'pointer',
}

const successTextStyle: React.CSSProperties = {
  color: '#17663a',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const errorTextStyle: React.CSSProperties = {
  color: '#b42318',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const activeScenarioTextStyle: React.CSSProperties = {
  color: '#255BE3',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const mutedTextStyle: React.CSSProperties = {
  color: '#5c6784',
  margin: 0,
}

const slotListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '14px',
}

const slotCardStyle: React.CSSProperties = {
  background: '#f9fbff',
  border: '1px solid #e3eaf7',
  borderRadius: '16px',
  padding: '14px',
}

const slotHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  flexWrap: 'wrap',
  marginBottom: '12px',
}

const slotHeaderLeftStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap',
}

const slotLabelInputStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderRadius: '10px',
  border: '1px solid #d7def0',
  background: '#ffffff',
  color: '#0f1632',
  fontSize: '0.95rem',
  fontWeight: 700,
  outline: 'none',
}

const slotTypeBadgeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#eef4ff',
  color: '#255BE3',
  fontWeight: 700,
  fontSize: '0.8rem',
}

const removeButtonStyle: React.CSSProperties = {
  padding: '8px 10px',
  borderRadius: '10px',
  border: '1px solid #f0c7c2',
  background: '#fff5f4',
  color: '#b42318',
  fontWeight: 700,
  cursor: 'pointer',
}

const slotPlayersGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '12px',
}

const summaryPillsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '14px',
  marginBottom: '14px',
}

const summaryPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '7px 11px',
  borderRadius: '999px',
  background: '#f4f6fb',
  color: '#5c6784',
  border: '1px solid #dde3f1',
  fontWeight: 700,
  fontSize: '0.82rem',
}

const playerPoolListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '8px',
}

const playerCardStyle: React.CSSProperties = {
  border: '1px solid #e7ebf5',
  borderRadius: '16px',
  padding: '14px',
  background: '#ffffff',
}

const playerCardTopRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '10px',
}

const playerNameStyle: React.CSSProperties = {
  color: '#0f1632',
  fontWeight: 800,
  fontSize: '1rem',
}

const playerMetaStyle: React.CSSProperties = {
  color: '#5c6784',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  marginTop: '4px',
}

const availabilityBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: '999px',
  fontWeight: 700,
  fontSize: '0.8rem',
  whiteSpace: 'nowrap',
}

const ratingsRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
}

const ratingChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#f4f6fb',
  color: '#0f1632',
  border: '1px solid #dde3f1',
  fontWeight: 700,
  fontSize: '0.8rem',
}

const assignedChipStyle: React.CSSProperties = {
  display: 'inline-flex',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#eef4ff',
  color: '#255BE3',
  border: '1px solid #cdd9ff',
  fontWeight: 700,
  fontSize: '0.8rem',
}

const playerNotesStyle: React.CSSProperties = {
  margin: '10px 0 0 0',
  color: '#0f1632',
  lineHeight: 1.5,
}

const availabilityNotesStyle: React.CSSProperties = {
  margin: '8px 0 0 0',
  color: '#5c6784',
  lineHeight: 1.5,
  fontSize: '0.92rem',
}

const savedScenarioListStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '8px',
}

const savedScenarioCardStyle: React.CSSProperties = {
  border: '1px solid #e7ebf5',
  borderRadius: '16px',
  padding: '14px',
  background: '#ffffff',
}

const currentSavedScenarioCardStyle: React.CSSProperties = {
  border: '1px solid #cdd9ff',
  boxShadow: '0 0 0 3px rgba(37, 91, 227, 0.08)',
}

const savedScenarioTopStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
}

const savedScenarioActionColumnStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  alignItems: 'stretch',
}

const savedScenarioNameStyle: React.CSSProperties = {
  color: '#0f1632',
  fontWeight: 800,
  fontSize: '0.98rem',
}

const savedScenarioMetaStyle: React.CSSProperties = {
  color: '#5c6784',
  fontSize: '0.9rem',
  lineHeight: 1.5,
  marginTop: '4px',
}

const currentScenarioBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginTop: '8px',
  padding: '6px 10px',
  borderRadius: '999px',
  background: '#eef4ff',
  color: '#255BE3',
  border: '1px solid #cdd9ff',
  fontWeight: 700,
  fontSize: '0.78rem',
}

const savedScenarioNotesStyle: React.CSSProperties = {
  margin: '10px 0 0 0',
  color: '#0f1632',
  lineHeight: 1.5,
}