'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'
import { getClientAuthState } from '@/lib/auth'
import { uniqueSorted } from '@/lib/captain-formatters'
import { isCaptain, type UserRole } from '@/lib/roles'
import { useViewportBreakpoints } from '@/lib/use-viewport-breakpoints'

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

type PoolPlayer = PlayerRow & {
  availabilityStatus: string | null
  availabilityNotes: string | null
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

function availabilityRank(status: string | null | undefined) {
  const normalized = (status ?? '').trim().toLowerCase()

  if (normalized === 'available' || normalized === 'yes' || normalized === 'in') return 0
  if (normalized === 'maybe') return 1
  if (normalized === 'unknown' || normalized === '') return 2
  if (normalized === 'unavailable' || normalized === 'no' || normalized === 'out') return 3

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

function selectedLineStrength(slot: LineupSlot, players: PlayerRow[]) {
  const selected = slot.players
    .map((slotPlayer) => players.find((p) => p.id === slotPlayer.playerId))
    .filter(Boolean) as PlayerRow[]

  if (!selected.length) return null

  if (slot.slotType === 'singles') {
    return selected[0].singles_dynamic_rating ?? selected[0].singles_rating ?? selected[0].overall_dynamic_rating ?? selected[0].overall_rating
  }

  const values = selected
    .map((p) => p.doubles_dynamic_rating ?? p.doubles_rating ?? p.overall_dynamic_rating ?? p.overall_rating)
    .filter((v): v is number => typeof v === 'number')

  if (!values.length) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatStrength(value: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(2) : '—'
}

function compareLineupStrength(teamSlots: LineupSlot[], opponentSlots: LineupSlot[], players: PlayerRow[]) {
  const lines = teamSlots.map((slot, index) => {
    const opponentSlot = opponentSlots[index]
    const yourStrength = selectedLineStrength(slot, players)
    const opponentStrength = opponentSlot ? selectedLineStrength(opponentSlot, players) : null
    const diff =
      typeof yourStrength === 'number' && typeof opponentStrength === 'number'
        ? yourStrength - opponentStrength
        : null

    return {
      label: slot.label,
      slotType: slot.slotType,
      yourStrength,
      opponentStrength,
      diff,
    }
  })

  const diffs = lines
    .map((line) => line.diff)
    .filter((value): value is number => typeof value === 'number')

  const avgDiff = diffs.length ? diffs.reduce((a, b) => a + b, 0) / diffs.length : 0
  const projection = 1 / (1 + Math.exp(-avgDiff * 3.2))

  return {
    lines,
    avgDiff,
    projection,
  }
}

export default function LineupBuilderPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [availability, setAvailability] = useState<AvailabilityRow[]>([])
  const [savedScenarios, setSavedScenarios] = useState<ScenarioRow[]>([])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [role, setRole] = useState<UserRole>('public')
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
  const [opponentSlots, setOpponentSlots] = useState<LineupSlot[]>(cloneSlots(DEFAULT_OPPONENT_SLOTS))

  const { isTablet, isMobile, isSmallMobile } = useViewportBreakpoints()
  const isCaptainAccess = isCaptain(role)
  const isMemberPreview = !authLoading && role === 'member'

  useEffect(() => {
    let mounted = true

    async function loadRole() {
      const authState = await getClientAuthState()
      if (!mounted) return

      setRole(authState.role)
      setAuthLoading(false)

      if (authState.role === 'public' && typeof window !== 'undefined') {
        const next = encodeURIComponent('/captain/analytics')
        window.location.href = `/login?next=${next}`
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
  }, [])

  const refreshAnalyticsData = useCallback(async () => {
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
  }, [])

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

    void loadData()

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
    const map = new Map<string, { status: string | null; notes: string | null }>()
    for (const row of availabilityForSelection) {
      map.set(row.player_id, { status: row.status, notes: row.notes })
    }
    return map
  }, [availabilityForSelection])

  const availablePlayerPool = useMemo<PoolPlayer[]>(() => {
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
        if (availabilityOnly && availabilityForSelection.length > 0) return availabilityMap.has(player.id)
        return true
      })
      .filter((player) => {
        if (!hideUnavailable) return true
        const normalized = (player.availabilityStatus ?? '').trim().toLowerCase()
        if (!availabilityOnly && !normalized) return true
        return normalized !== 'unavailable' && normalized !== 'no' && normalized !== 'out'
      })
      .sort((a, b) => {
        const statusCompare = availabilityRank(a.availabilityStatus) - availabilityRank(b.availabilityStatus)
        if (statusCompare !== 0) return statusCompare

        const ratingA = a.overall_dynamic_rating ?? a.overall_rating ?? -999
        const ratingB = b.overall_dynamic_rating ?? b.overall_rating ?? -999
        if (ratingB !== ratingA) return ratingB - ratingA
        return a.name.localeCompare(b.name)
      })
  }, [players, availabilityMap, flight, availabilityOnly, availabilityForSelection.length, hideUnavailable])

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    for (const slot of [...teamSlots, ...opponentSlots]) {
      for (const player of slot.players) {
        if (player.playerId) ids.add(player.playerId)
      }
    }
    return ids
  }, [teamSlots, opponentSlots])

  function playerLabel(player: PoolPlayer) {
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
        return { ...slot, players: nextPlayers }
      })

    if (side === 'team') setTeamSlots((current) => update(current))
    else setOpponentSlots((current) => update(current))
  }

  function setSlotLabel(side: 'team' | 'opponent', slotId: string, label: string) {
    const update = (slots: LineupSlot[]) =>
      slots.map((slot) => (slot.id === slotId ? { ...slot, label } : slot))

    if (side === 'team') setTeamSlots((current) => update(current))
    else setOpponentSlots((current) => update(current))
  }

  function addSlot(side: 'team' | 'opponent', slotType: 'singles' | 'doubles') {
    const id = `${side}-${slotType}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const labelBase = slotType === 'singles' ? 'Singles' : 'Doubles'
    const source = side === 'team' ? teamSlots : opponentSlots
    const nextCount = source.filter((slot) => slot.slotType === slotType).length + 1

    const newSlot =
      slotType === 'singles'
        ? createSinglesSlot(id, `${labelBase} ${nextCount}`)
        : createDoublesSlot(id, `${labelBase} ${nextCount}`)

    if (side === 'team') setTeamSlots((current) => [...current, newSlot])
    else setOpponentSlots((current) => [...current, newSlot])
  }

  function removeSlot(side: 'team' | 'opponent', slotId: string) {
    if (side === 'team') setTeamSlots((current) => current.filter((slot) => slot.id !== slotId))
    else setOpponentSlots((current) => current.filter((slot) => slot.id !== slotId))
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
    if (!isCaptainAccess) {
      setError('Captain tier required to save scenarios.')
      setMessage('')
      return
    }

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
      setError('A scenario with this name already exists for this team and match date.')
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

    if (data?.id) setCurrentScenarioId(data.id)
    await refreshSavedScenarios()
    setMessage(asNew ? 'Scenario saved as new successfully.' : 'Scenario saved successfully.')
  }

  async function deleteScenario(scenarioId: string) {
    if (!isCaptainAccess) {
      setError('Captain tier required to delete scenarios.')
      setMessage('')
      return
    }

    const scenario = savedScenarios.find((row) => row.id === scenarioId)
    const confirmed = window.confirm(`Delete scenario "${scenario?.scenario_name ?? 'this scenario'}"?`)
    if (!confirmed) return

    setDeletingScenarioId(scenarioId)
    setError('')
    setMessage('')

    const { error } = await supabase.from('lineup_scenarios').delete().eq('id', scenarioId)
    setDeletingScenarioId('')

    if (error) {
      setError(error.message)
      return
    }

    const deletedCurrent = scenarioId === currentScenarioId
    await refreshSavedScenarios()

    if (deletedCurrent) {
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
    setOpponentSlots(loadedOpponentSlots.length ? loadedOpponentSlots : cloneSlots(DEFAULT_OPPONENT_SLOTS))

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
    return query ? `/captain/scenario-builder?${query}` : '/captain/scenario-builder'
  }, [leagueName, flight, teamName, matchDate, currentScenarioId])

  const analysis = useMemo(() => {
    return compareLineupStrength(teamSlots, opponentSlots, players)
  }, [teamSlots, opponentSlots, players])

  const bestLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.diff === 'number')
      .sort((a, b) => (b.diff ?? 0) - (a.diff ?? 0))
    return scored[0] ?? null
  }, [analysis.lines])

  const weakestLine = useMemo(() => {
    const scored = analysis.lines
      .filter((line) => typeof line.diff === 'number')
      .sort((a, b) => (a.diff ?? 0) - (b.diff ?? 0))
    return scored[0] ?? null
  }, [analysis.lines])

  return (
    <SiteShell active="/captain">
      <div style={pageWrap}>
        {authLoading ? (
          <section style={surfaceCardStrong}>
            <p style={mutedTextStyle}>Loading captain access...</p>
          </section>
        ) : null}

        {isMemberPreview ? (
          <section style={surfaceCard}>
            <p style={sectionKicker}>Member preview</p>
            <h2 style={sectionTitle}>Captain analytics preview mode</h2>
            <p style={sectionBodyTextStyle}>
              You can review the builder and scenario analysis here, but saving and deleting scenarios require Captain access.
            </p>
          </section>
        ) : null}

        <section style={heroShellResponsive(isTablet, isMobile)}>
        <div>
          <div style={eyebrow}>Captain tools</div>
          <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Captain Analytics</h1>
          <p style={heroTextStyle}>
            Pressure-test lineup ideas, review line-by-line strength, and keep the scenario work focused on decision clarity before you save or compare.
          </p>

          <div style={heroButtonRowStyle}>
            <Link href={compareHref} style={primaryButton}>
              Compare Saved Scenarios
            </Link>
            <button type="button" onClick={resetBuilder} style={ghostButton}>
              Reset Builder
            </button>
          </div>

          <div style={heroMetricGridStyle(isSmallMobile)}>
            <MetricStat label="Scenario Mode" value={currentScenarioId ? 'Editing saved scenario' : 'New scenario'} />
            <MetricStat label="Player Pool" value={`${availablePlayerPool.length} available`} />
            <MetricStat label="Saved Versions" value={`${scenarioOptions.length} scenarios`} />
          </div>
        </div>

        <div style={quickStartCard}>
          <p style={sectionKicker}>Builder workflow</p>
          <h2 style={quickStartTitle}>Set context, model both sides, then compare</h2>
          <div style={workflowListStyle}>
            {[
              ['1', 'Define the match context', 'League, flight, team, opponent, and date drive the scenario.'],
              ['2', 'Build both sides', 'Create your lineup and capture the likely opponent projection.'],
              ['3', 'Save and compare', 'Keep multiple versions and review them side by side.'],
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

          <div style={heroBadgeRowStyleCompact}>
            <span style={badgeSlate}>{scenarioName.trim() ? 'Scenario named' : 'Name needed'}</span>
            <span style={badgeSlate}>{teamName && opponentTeam ? 'Matchup set' : 'Matchup incomplete'}</span>
            <span style={badgeSlate}>{scenarioOptions.length > 1 ? 'Compare ready' : 'Need 2 versions'}</span>
          </div>
        </div>
      </section>

        <section style={contentWrap}>
        <div style={builderLayoutResponsive(isTablet)}>
          <div style={columnStyle}>
            <section style={surfaceCardStrong}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Scenario setup</p>
                  <h2 style={sectionTitle}>Match and scenario details</h2>
                  <p style={sectionBodyTextStyle}>Save a new version or update the scenario currently loaded into the builder.</p>
                </div>
              </div>

              {currentScenario ? (
                <div style={bannerBlueStyle}>
                  <div style={bannerTitleStyle}>Editing saved scenario: {currentScenario.scenario_name}</div>
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
                  <label style={labelStyle}>Scenario Name</label>
                  <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} placeholder="Example: Safer Doubles Version" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Match Date</label>
                  <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>League</label>
                  <input list="league-options" value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder="League name" style={inputStyle} />
                  <datalist id="league-options">
                    {leagueOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Flight</label>
                  <input list="flight-options" value={flight} onChange={(e) => setFlight(e.target.value)} placeholder="Flight" style={inputStyle} />
                  <datalist id="flight-options">
                    {flightOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Team Name</label>
                  <input list="team-options" value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Your team" style={inputStyle} />
                  <datalist id="team-options">
                    {teamOptions.map((option) => <option key={option} value={option} />)}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle}>Opponent Team</label>
                  <input value={opponentTeam} onChange={(e) => setOpponentTeam(e.target.value)} placeholder="Opponent team" style={inputStyle} />
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={labelStyle}>Captain Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Matchups, player preferences, injury notes, weather backups, etc." style={textareaStyle} />
              </div>

              <div style={toggleGridResponsive(isSmallMobile)}>
                <label style={toggleCardStyle}>
                  <div>
                    <div style={toggleTitleStyle}>Availability-filtered pool</div>
                    <div style={toggleTextStyle}>Use lineup availability records when they exist for the selected match context.</div>
                  </div>
                  <input type="checkbox" checked={availabilityOnly} onChange={(e) => setAvailabilityOnly(e.target.checked)} />
                </label>

                <label style={toggleCardStyle}>
                  <div>
                    <div style={toggleTitleStyle}>Hide unavailable players</div>
                    <div style={toggleTextStyle}>Remove players marked out or unavailable from your selection list.</div>
                  </div>
                  <input type="checkbox" checked={hideUnavailable} onChange={(e) => setHideUnavailable(e.target.checked)} />
                </label>
              </div>

              <div style={actionRowStyle}>
                <button type="button" onClick={() => saveScenario(false)} style={primaryButton} disabled={saving || !isCaptainAccess}>
                  {saving ? 'Saving...' : currentScenarioId ? 'Update Scenario' : 'Save Scenario'}
                </button>
                <button type="button" onClick={() => saveScenario(true)} style={ghostButton} disabled={saving || !isCaptainAccess}>
                  Save as New
                </button>
                <Link href={compareHref} style={secondaryLinkButton}>Open Comparison</Link>
                <button type="button" onClick={() => void refreshAnalyticsData()} style={ghostButton} disabled={loading}>
                  {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
              </div>

              {currentScenarioId ? <p style={infoTextStyle}>Loaded scenario is ready for update and comparison.</p> : null}
              {message ? <p style={successTextStyle}>{message}</p> : null}
              {error ? <p style={errorTextStyle}>{error}</p> : null}

              <div style={readinessGridStyle}>
                <div style={readinessCardStyle}>
                  <div style={bannerTitleStyle}>Scenario naming</div>
                  <div style={readinessValueStyle}>{scenarioName.trim() ? 'Ready' : 'Needs setup'}</div>
                  <div style={bannerMetaStyle}>{scenarioName.trim() || 'Add a scenario name before saving so versions stay understandable later.'}</div>
                </div>
                <div style={readinessCardStyle}>
                  <div style={bannerTitleStyle}>Match context</div>
                  <div style={readinessValueStyle}>{teamName && opponentTeam && matchDate ? 'Ready' : 'Needs setup'}</div>
                  <div style={bannerMetaStyle}>
                    {teamName && opponentTeam && matchDate ? `${teamName} vs ${opponentTeam} on ${formatDate(matchDate)}` : 'Add team, opponent, and match date so comparison results stay trustworthy.'}
                  </div>
                </div>
                <div style={readinessCardStyle}>
                  <div style={bannerTitleStyle}>Comparison readiness</div>
                  <div style={readinessValueStyle}>{scenarioOptions.length > 1 ? 'Ready' : 'Needs another version'}</div>
                  <div style={bannerMetaStyle}>
                    {scenarioOptions.length > 1 ? `${scenarioOptions.length} saved scenarios are available in the current scope.` : 'Save one more scenario in this same scope to unlock a meaningful comparison.'}
                  </div>
                </div>
              </div>
            </section>

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Your lineup</p>
                  <h2 style={sectionTitle}>Build your side</h2>
                  <p style={sectionBodyTextStyle}>Create singles and doubles slots for your expected match-day lineup.</p>
                </div>

                <div style={miniActionRowStyle}>
                  <button type="button" style={ghostButtonSmall} onClick={() => addSlot('team', 'singles')}>+ Singles Slot</button>
                  <button type="button" style={ghostButtonSmall} onClick={() => addSlot('team', 'doubles')}>+ Doubles Slot</button>
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

            <section style={surfaceCard}>
              <div style={sectionHeaderStyle}>
                <div>
                  <p style={sectionKicker}>Opponent projection</p>
                  <h2 style={sectionTitle}>Model the other side</h2>
                  <p style={sectionBodyTextStyle}>Capture your expected opponent lineup or your best working guess.</p>
                </div>

                <div style={miniActionRowStyle}>
                  <button type="button" style={ghostButtonSmall} onClick={() => addSlot('opponent', 'singles')}>+ Singles Slot</button>
                  <button type="button" style={ghostButtonSmall} onClick={() => addSlot('opponent', 'doubles')}>+ Doubles Slot</button>
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
            <section style={surfaceCard}>
              <p style={sectionKicker}>Live projection</p>
              <h2 style={sectionTitle}>Strength by line</h2>
              <p style={sectionBodyTextStyle}>A quick heuristic based on selected dynamic ratings for each slot.</p>

              <div style={heroBadgeRowStyleCompact}>
                <span style={badgeBlue}>Projected win chance {formatStrength(analysis.projection * 100)}%</span>
                <span style={badgeSlate}>Avg edge {formatStrength(analysis.avgDiff)}</span>
              </div>

              <div style={stackStyle}>
                {analysis.lines.map((line) => (
                  <div key={line.label} style={poolCardStyle}>
                    <div style={poolCardTopStyle}>
                      <div>
                        <div style={playerNameStyle}>{line.label}</div>
                        <div style={playerMetaStyle}>{line.slotType === 'singles' ? 'Singles line' : 'Doubles line'}</div>
                      </div>
                      <span style={typeof line.diff === 'number' && line.diff >= 0 ? goodBadgeStyle : warnBadgeStyle}>
                        {typeof line.diff === 'number' ? `${line.diff >= 0 ? '+' : ''}${line.diff.toFixed(2)}` : '—'}
                      </span>
                    </div>

                    <div style={compareGridStyle}>
                      <div style={compareCardStyle}>
                        <div style={compareLabelStyle}>Your side</div>
                        <div style={compareValueStyle}>{formatStrength(line.yourStrength)}</div>
                      </div>
                      <div style={compareCardStyle}>
                        <div style={compareLabelStyle}>Opponent</div>
                        <div style={compareValueStyle}>{formatStrength(line.opponentStrength)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={sectionKicker}>Readout</div>
                <p style={sectionBodyTextStyle}>
                  Best line: <strong>{bestLine?.label ?? '—'}</strong>. Weakest line: <strong>{weakestLine?.label ?? '—'}</strong>.
                </p>
              </div>
            </section>

            <section style={surfaceCard}>
              <p style={sectionKicker}>Player pool</p>
              <h2 style={sectionTitle}>Availability-aware options</h2>
              <p style={sectionBodyTextStyle}>Sorted by availability first, then overall strength.</p>

              <div style={heroBadgeRowStyleCompact}>
                <span style={badgeSlate}>{availablePlayerPool.length} players</span>
                <span style={badgeBlue}>{availabilityForSelection.length} availability rows</span>
              </div>

              <div style={stackStyle}>
                {loading ? (
                  <p style={mutedTextStyle}>Loading players...</p>
                ) : availablePlayerPool.length === 0 ? (
                  <div style={stackStyle}>
                    <p style={mutedTextStyle}>No players match the current filters.</p>
                    <p style={sectionBodyTextStyle}>
                      Broaden the league, flight, or team context, or relax the availability toggles if you are still in early planning mode.
                    </p>
                  </div>
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
                          <span style={miniPillStyle}>OVR {(player.overall_dynamic_rating ?? player.overall_rating)?.toFixed(2) ?? '—'}</span>
                          <span style={miniPillStyle}>S {player.singles_dynamic_rating?.toFixed(2) ?? '—'}</span>
                          <span style={miniPillStyle}>D {player.doubles_dynamic_rating?.toFixed(2) ?? '—'}</span>
                          {assigned ? <span style={assignedPillStyle}>Assigned</span> : null}
                        </div>

                        {player.lineup_notes ? <p style={cardNoteTextStyle}>{player.lineup_notes}</p> : null}
                        {player.availabilityNotes ? <p style={subtleNoteTextStyle}>Availability note: {player.availabilityNotes}</p> : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>

            <section style={surfaceCard}>
              <p style={sectionKicker}>Saved scenarios</p>
              <h2 style={sectionTitle}>Reload or clean up prior versions</h2>
              <p style={sectionBodyTextStyle}>Load a saved scenario into the builder, then tweak, compare, resave, or delete it.</p>

              <div style={stackStyle}>
                {scenarioOptions.length === 0 ? (
                  <div style={stackStyle}>
                    <p style={mutedTextStyle}>No saved scenarios for the current filters.</p>
                    <p style={sectionBodyTextStyle}>
                      Save the current build as your first version, or loosen the match context above to bring previous scenarios back into scope.
                    </p>
                  </div>
                ) : (
                  scenarioOptions.map((scenario) => {
                    const isCurrent = scenario.id === currentScenarioId
                    const isDeleting = deletingScenarioId === scenario.id
                    const isLoading = loadingScenarioId === scenario.id

                    return (
                      <article key={scenario.id} style={{ ...savedScenarioCardStyle, ...(isCurrent ? savedScenarioCardActiveStyle : {}) }}>
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
                                <span style={miniPillBlueStyle}>Currently loaded</span>
                              </div>
                            ) : null}
                          </div>

                          <div style={savedScenarioActionsStyle}>
                            <button type="button" style={ghostButtonSmall} onClick={() => loadScenario(scenario.id)} disabled={isLoading || isDeleting}>
                              {isLoading ? 'Loading...' : 'Load'}
                            </button>

                            <button type="button" onClick={() => deleteScenario(scenario.id)} disabled={isDeleting || isLoading || !isCaptainAccess} style={dangerButtonStyle}>
                              {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        </div>

                        {scenario.notes ? <p style={cardNoteTextStyle}>{scenario.notes}</p> : null}
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      </div>
    </SiteShell>
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
  playerPool: PoolPlayer[]
  assignedPlayerIds: Set<string>
  setSlotLabel: (side: 'team' | 'opponent', slotId: string, label: string) => void
  setSlotPlayer: (
    side: 'team' | 'opponent',
    slotId: string,
    playerIndex: number,
    playerId: string
  ) => void
  removeSlot: (side: 'team' | 'opponent', slotId: string) => void
  playerLabel: (player: PoolPlayer) => string
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
          <span style={slot.slotType === 'singles' ? miniPillBlueStyle : assignedPillStyle}>
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

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle}>{value}</div>
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

function builderLayoutResponsive(isTablet: boolean): CSSProperties {
  return {
    ...builderLayoutStyle,
    gridTemplateColumns: isTablet ? '1fr' : 'minmax(0, 1.45fr) minmax(320px, 0.95fr)',
  }
}

function toggleGridResponsive(isSmallMobile: boolean): CSSProperties {
  return {
    ...toggleGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(auto-fit, minmax(260px, 1fr))',
  }
}

const pageWrap: CSSProperties = {
  width: 'min(1280px, calc(100% - 48px))',
  margin: '0 auto',
  display: 'grid',
  gap: '18px',
  padding: '14px 0 28px',
  position: 'relative',
  zIndex: 2,
}

const eyebrow: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  minHeight: '38px',
  padding: '8px 14px',
  borderRadius: '999px',
  border: '1px solid rgba(130, 244, 118, 0.28)',
  background: 'rgba(89, 145, 73, 0.14)',
  color: '#d9e7ef',
  fontWeight: 800,
  fontSize: '14px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  marginBottom: '4px',
}


const heroShell: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto 18px',
  display: 'grid',
  borderRadius: '34px',
  border: '1px solid rgba(107, 162, 255, 0.18)',
  background: 'linear-gradient(135deg, rgba(7,29,61,0.96), rgba(7,20,39,0.96) 56%, rgba(18,58,50,0.9) 100%)',
  boxShadow: '0 34px 80px rgba(0,0,0,0.32)',
}

const heroTextStyle: CSSProperties = {
  marginTop: 16,
  marginBottom: 0,
  maxWidth: 820,
  color: 'rgba(255,255,255,0.78)',
  fontSize: '1.02rem',
  lineHeight: 1.72,
}

const heroTitleStyle: CSSProperties = {
  margin: 0,
  color: '#f7fbff',
  fontWeight: 900,
  lineHeight: 0.98,
  letterSpacing: '-0.055em',
  maxWidth: '760px',
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
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.06)',
}

const metricLabelStyle: CSSProperties = {
  color: 'rgba(255,255,255,0.72)',
  fontSize: '0.82rem',
  marginBottom: '0.42rem',
  fontWeight: 700,
}

const metricValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '1.05rem',
  fontWeight: 800,
  lineHeight: 1.4,
}

const quickStartCard: CSSProperties = {
  borderRadius: '28px',
  border: '1px solid rgba(255,255,255,0.10)',
  background: 'linear-gradient(180deg, rgba(37,56,84,0.88), rgba(21,37,64,0.88))',
  padding: '20px',
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

const contentWrap: CSSProperties = {
  position: 'relative',
  zIndex: 2,
  maxWidth: '1240px',
  margin: '0 auto',
}

const builderLayoutStyle: CSSProperties = {
  display: 'grid',
  gap: '20px',
  alignItems: 'start',
}

const columnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '20px',
}

const surfaceCardStrong: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(133, 168, 229, 0.16)',
  background:
    'radial-gradient(circle at top right, rgba(184, 230, 26, 0.12), transparent 34%), linear-gradient(135deg, rgba(8, 34, 75, 0.98) 0%, rgba(4, 18, 45, 0.98) 58%, rgba(7, 36, 46, 0.98) 100%)',
  boxShadow: '0 28px 60px rgba(2, 8, 23, 0.28)',
}

const surfaceCard: CSSProperties = {
  borderRadius: '28px',
  padding: '20px',
  border: '1px solid rgba(140,184,255,0.18)',
  background: 'linear-gradient(180deg, rgba(65,112,194,0.20) 0%, rgba(28,49,95,0.38) 100%)',
  boxShadow: '0 18px 40px rgba(0,0,0,0.22)',
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

const sectionBodyTextStyle: CSSProperties = {
  margin: 0,
  color: 'rgba(224,234,247,0.76)',
  lineHeight: 1.65,
}

const bannerBlueStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  background: 'rgba(37, 91, 227, 0.12)',
  border: '1px solid rgba(37, 91, 227, 0.20)',
}

const bannerSlateStyle: CSSProperties = {
  marginBottom: '16px',
  padding: '14px 16px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#dbeafe',
  fontWeight: 700,
}

const bannerTitleStyle: CSSProperties = {
  color: '#8fb7ff',
  fontWeight: 800,
  marginBottom: '4px',
}

const bannerMetaStyle: CSSProperties = {
  color: '#cbd5e1',
  lineHeight: 1.5,
}

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '14px',
}

const toggleGridStyle: CSSProperties = {
  display: 'grid',
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
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#e7eefb',
}

const toggleTitleStyle: CSSProperties = {
  fontWeight: 800,
  color: '#f8fbff',
  marginBottom: 4,
}

const toggleTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  lineHeight: 1.5,
  fontSize: '.94rem',
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '12px',
  flexWrap: 'wrap',
  marginTop: '18px',
}

const readinessGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
  marginTop: '18px',
}

const readinessCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '14px 16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'grid',
  gap: '6px',
}

const readinessValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontSize: '20px',
  lineHeight: 1.1,
  fontWeight: 900,
}

const miniActionRowStyle: CSSProperties = {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
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
  background: 'linear-gradient(135deg, #67f19a, #28cd6e)',
  color: '#071622',
  border: '1px solid rgba(133, 171, 255, 0.18)',
  boxShadow: '0 16px 32px rgba(26, 74, 196, 0.16)',
  cursor: 'pointer',
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
  background: 'rgba(14, 27, 49, 0.9)',
  color: '#ebf1fd',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  cursor: 'pointer',
}

const ghostButtonSmall: CSSProperties = {
  ...ghostButton,
  minHeight: '42px',
  padding: '0 14px',
}

const secondaryLinkButton: CSSProperties = {
  ...ghostButton,
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

const textareaStyle: CSSProperties = {
  width: '100%',
  minHeight: '118px',
  borderRadius: '14px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#f8fbff',
  padding: '12px 14px',
  fontSize: '14px',
  outline: 'none',
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

const smallLabelStyle: CSSProperties = {
  ...labelStyle,
  marginBottom: '6px',
}

const infoTextStyle: CSSProperties = {
  color: '#8fb7ff',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const successTextStyle: CSSProperties = {
  color: '#86efac',
  marginTop: '14px',
  marginBottom: 0,
  fontWeight: 600,
}

const errorTextStyle: CSSProperties = {
  color: '#fca5a5',
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
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
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
  ...inputStyle,
  minWidth: '180px',
  maxWidth: '220px',
  height: '42px',
  fontWeight: 700,
}

const slotPlayersGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
  gap: '12px',
}

const heroBadgeRowStyleCompact: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const badgeBase: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '36px',
  padding: '0 14px',
  borderRadius: '999px',
  fontSize: '0.82rem',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: '0.02em',
  border: '1px solid transparent',
}

const badgeBlue: CSSProperties = {
  ...badgeBase,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
  borderColor: 'rgba(98, 154, 255, 0.18)',
}

const badgeSlate: CSSProperties = {
  ...badgeBase,
  background: 'rgba(255, 255, 255, 0.08)',
  color: '#e8eef9',
  borderColor: 'rgba(255, 255, 255, 0.1)',
}


const stackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  marginTop: '14px',
}

const mutedTextStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  margin: 0,
  lineHeight: 1.6,
}

const poolCardStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  padding: '14px',
  background: 'rgba(255,255,255,0.04)',
}

const poolCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '10px',
}

const playerNameStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: '1rem',
}

const playerMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
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

const pillRowStyle: CSSProperties = {
  display: 'flex',
  gap: '8px',
  flexWrap: 'wrap',
  marginTop: '14px',
}

const miniPillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255,255,255,0.08)',
  color: '#dfe8f8',
  fontSize: '12px',
  fontWeight: 800,
}

const miniPillBlueStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(37, 91, 227, 0.16)',
  color: '#c7dbff',
}

const assignedPillStyle: CSSProperties = {
  ...miniPillStyle,
  background: 'rgba(96, 221, 116, 0.14)',
  color: '#dffad5',
}

const cardNoteTextStyle: CSSProperties = {
  margin: '10px 0 0 0',
  color: '#e7eefb',
  lineHeight: 1.58,
}

const subtleNoteTextStyle: CSSProperties = {
  margin: '8px 0 0 0',
  color: 'rgba(224,234,247,0.72)',
  lineHeight: 1.58,
  fontSize: '0.92rem',
}

const compareGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '10px',
}

const compareCardStyle: CSSProperties = {
  borderRadius: '16px',
  padding: '12px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const compareLabelStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '12px',
  fontWeight: 700,
  marginBottom: '6px',
}

const compareValueStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 900,
  fontSize: '18px',
}

const goodBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(96, 221, 116, 0.14)',
  color: '#dffad5',
  fontSize: '12px',
  fontWeight: 800,
}

const warnBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '30px',
  padding: '0 12px',
  borderRadius: '999px',
  background: 'rgba(255, 93, 93, 0.10)',
  color: '#fecaca',
  fontSize: '12px',
  fontWeight: 800,
}

const savedScenarioCardStyle: CSSProperties = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  padding: '14px',
  background: 'rgba(255,255,255,0.04)',
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
  color: '#f8fbff',
  fontWeight: 800,
  fontSize: '1rem',
}

const savedScenarioMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
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
  color: '#fca5a5',
  border: '1px solid rgba(255, 93, 93, 0.18)',
  fontWeight: 700,
  cursor: 'pointer',
}

