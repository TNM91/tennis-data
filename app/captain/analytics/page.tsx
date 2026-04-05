'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { supabase } from '@/lib/supabase'
import SiteShell from '@/app/components/site-shell'

type PlayerRow = {
  id: string
  name: string
  singles_dynamic_rating: number | null
  doubles_dynamic_rating: number | null
  overall_dynamic_rating: number | null
  flight: string | null
  preferred_role: string | null
}

type MatchRow = {
  id: string
  match_date: string | null
  match_type: string | null
  score: string | null
  winner_side: string | null
  flight: string | null
  league_name: string | null
  home_team: string | null
  away_team: string | null
}

type MatchPlayerRow = {
  id: string
  match_id: string
  player_id: string
  side: string | null
  seat: number | null
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

type AvailabilityEntry = {
  id: string
  playerName: string
  playerId: string | null
  phone: string | null
  leagueName: string | null
  flight: string | null
  teamName: string | null
  seasonLabel: string | null
  sessionLabel: string | null
  weekKey: string
  response: AvailabilityStatus
  updatedAt: string | null
}

type AvailabilityStatus = 'yes' | 'no' | 'maybe' | 'no-response'

type PairingStat = {
  key: string
  names: string[]
  avgRating: number
  matches: number
}

type Recommendation = {
  title: string
  body: string
  tone: 'good' | 'warn' | 'info'
}

type WeeklyReadiness = {
  weekKey: string
  total: number
  yes: number
  no: number
  maybe: number
  noResponse: number
  yesRate: number
  responseRate: number
}

const AVAILABILITY_TABLES = [
  'captain_availability',
  'lineup_availability',
  'weekly_availability',
  'player_availability',
  'availability_responses',
  'captain_lineup_availability',
] as const

function normalizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')
}

function formatDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatPct(value: number | null, digits = 0) {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}

function formatRating(value: number | null, digits = 2) {
  if (value == null || Number.isNaN(value)) return '—'
  return value.toFixed(digits)
}

function weekKeyFromDate(value: string | null) {
  const date = value ? new Date(value) : new Date()
  if (Number.isNaN(date.getTime())) return 'Current week'
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  const day = normalized.getDay()
  const diffToMonday = (day + 6) % 7
  normalized.setDate(normalized.getDate() - diffToMonday)
  return normalized.toISOString().slice(0, 10)
}

function parseAvailabilityStatus(value: unknown): AvailabilityStatus {
  const text = cleanText(value).toLowerCase()
  if (['yes', 'available', 'in', 'confirmed', 'accept', 'accepted'].includes(text)) return 'yes'
  if (['no', 'out', 'unavailable', 'declined', 'decline'].includes(text)) return 'no'
  if (['maybe', 'tentative', 'unsure'].includes(text)) return 'maybe'
  return 'no-response'
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((v) => (v ?? '').trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  )
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

function normalizeScenarioSlots(raw: unknown) {
  const rows: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'object' && raw !== null
      ? safeArray(
          (raw as Record<string, unknown>).slots ??
            (raw as Record<string, unknown>).lines ??
            (raw as Record<string, unknown>).courts,
        )
      : []

  return rows.map((item, index) => {
    if (typeof item === 'string') {
      return {
        key: `slot-${index}`,
        label: `Slot ${index + 1}`,
        players: item.trim() ? [item.trim()] : [],
        playerIds: [],
      }
    }

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>
      const extracted = extractPlayers(
        obj.players ??
          obj.player_names ??
          obj.names ??
          obj.roster ??
          [obj.player_1, obj.player_2].filter(Boolean),
      )

      return {
        key: cleanText(obj.id) || `slot-${index}`,
        label:
          cleanText(obj.label) ||
          cleanText(obj.line_name) ||
          cleanText(obj.position) ||
          cleanText(obj.court) ||
          cleanText(obj.line) ||
          `Slot ${index + 1}`,
        players: extracted.map((p) => p.name).filter(Boolean),
        playerIds: extracted.map((p) => p.id).filter(Boolean),
      }
    }

    return {
      key: `slot-${index}`,
      label: `Slot ${index + 1}`,
      players: [],
      playerIds: [],
    }
  })
}

async function tryLoadAvailability() {
  for (const table of AVAILABILITY_TABLES) {
    const result = await supabase.from(table).select('*').limit(400)
    if (!result.error && Array.isArray(result.data)) {
      return {
        table,
        rows: result.data as Record<string, unknown>[],
      }
    }
  }

  return {
    table: null,
    rows: [] as Record<string, unknown>[],
  }
}

function mapAvailabilityRows(rows: Record<string, unknown>[]): AvailabilityEntry[] {
  return rows.map((row, index) => {
    const playerName =
      cleanText(row.player_name) ||
      cleanText(row.name) ||
      cleanText(row.player) ||
      cleanText(row.contact_name) ||
      cleanText(row.member_name) ||
      `Player ${index + 1}`

    const weekKey =
      cleanText(row.week_key) ||
      cleanText(row.week_start) ||
      weekKeyFromDate(cleanText(row.match_date) || cleanText(row.event_date) || cleanText(row.created_at) || null)

    return {
      id: cleanText(row.id) || `${playerName}-${weekKey}-${index}`,
      playerName,
      playerId: cleanText(row.player_id) || cleanText(row.contact_id) || null,
      phone: cleanText(row.phone) || cleanText(row.mobile) || cleanText(row.cell_phone) || null,
      leagueName: cleanText(row.league_name) || cleanText(row.league) || null,
      flight: cleanText(row.flight) || null,
      teamName: cleanText(row.team_name) || cleanText(row.team) || null,
      seasonLabel: cleanText(row.season_label) || cleanText(row.season) || null,
      sessionLabel: cleanText(row.session_label) || cleanText(row.session) || null,
      weekKey,
      response: parseAvailabilityStatus(
        row.response_status ?? row.status ?? row.response ?? row.availability ?? row.reply,
      ),
      updatedAt: cleanText(row.updated_at) || cleanText(row.created_at) || null,
    }
  })
}

export default function CaptainAnalyticsPage() {
  const [screenWidth, setScreenWidth] = useState(1280)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [matchPlayers, setMatchPlayers] = useState<MatchPlayerRow[]>([])
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([])
  const [availability, setAvailability] = useState<AvailabilityEntry[]>([])
  const [availabilityTableName, setAvailabilityTableName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [leagueFilter, setLeagueFilter] = useState('')
  const [flightFilter, setFlightFilter] = useState('')
  const [teamFilter, setTeamFilter] = useState('')
  const [weekFilter, setWeekFilter] = useState('')

  useEffect(() => {
    const handleResize = () => setScreenWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    let mounted = true

    async function load() {
      setLoading(true)
      setError(null)

      const [
        playersResult,
        matchesResult,
        matchPlayersResult,
        scenariosResult,
        availabilityResult,
      ] = await Promise.all([
        supabase
          .from('players')
          .select(
            'id, name, singles_dynamic_rating, doubles_dynamic_rating, overall_dynamic_rating, flight, preferred_role',
          )
          .order('name', { ascending: true }),
        supabase
          .from('matches')
          .select(
            'id, match_date, match_type, score, winner_side, flight, league_name, home_team, away_team',
          )
          .order('match_date', { ascending: false })
          .limit(400),
        supabase
          .from('match_players')
          .select('id, match_id, player_id, side, seat')
          .limit(2000),
        supabase
          .from('lineup_scenarios')
          .select(
            'id, scenario_name, league_name, flight, match_date, team_name, opponent_team, slots_json, opponent_slots_json, notes',
          )
          .order('match_date', { ascending: false })
          .limit(250),
        tryLoadAvailability(),
      ])

      if (!mounted) return

      if (playersResult.error) {
        setError(playersResult.error.message)
      } else if (matchesResult.error) {
        setError(matchesResult.error.message)
      } else if (matchPlayersResult.error) {
        setError(matchPlayersResult.error.message)
      } else if (scenariosResult.error) {
        setError(scenariosResult.error.message)
      } else {
        setPlayers((playersResult.data ?? []) as PlayerRow[])
        setMatches((matchesResult.data ?? []) as MatchRow[])
        setMatchPlayers((matchPlayersResult.data ?? []) as MatchPlayerRow[])
        setScenarios((scenariosResult.data ?? []) as ScenarioRow[])
        setAvailability(mapAvailabilityRows(availabilityResult.rows))
        setAvailabilityTableName(availabilityResult.table)
      }

      setLoading(false)
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  const isTablet = screenWidth < 1080
  const isMobile = screenWidth < 820
  const isSmallMobile = screenWidth < 560

  const leagueOptions = useMemo(
    () =>
      uniqueSorted([
        ...matches.map((item) => item.league_name),
        ...availability.map((item) => item.leagueName),
        ...scenarios.map((item) => item.league_name),
      ]),
    [matches, availability, scenarios],
  )

  const flightOptions = useMemo(
    () =>
      uniqueSorted([
        ...matches.map((item) => item.flight),
        ...availability.map((item) => item.flight),
        ...players.map((item) => item.flight),
        ...scenarios.map((item) => item.flight),
      ]),
    [matches, availability, players, scenarios],
  )

  const teamOptions = useMemo(
    () =>
      uniqueSorted([
        ...matches.flatMap((item) => [item.home_team, item.away_team]),
        ...availability.map((item) => item.teamName),
        ...scenarios.map((item) => item.team_name),
      ]),
    [matches, availability, scenarios],
  )

  const weekOptions = useMemo(
    () => uniqueSorted(availability.map((item) => item.weekKey)).sort((a, b) => b.localeCompare(a)),
    [availability],
  )

  useEffect(() => {
    if (!weekFilter && weekOptions.length) {
      setWeekFilter(weekOptions[0])
    }
  }, [weekFilter, weekOptions])

  const filteredPlayers = useMemo(() => {
    return players.filter((player) => {
      const flightMatch = !flightFilter || player.flight === flightFilter
      return flightMatch
    })
  }, [players, flightFilter])

  const filteredMatches = useMemo(() => {
    return matches.filter((match) => {
      const leagueMatch = !leagueFilter || match.league_name === leagueFilter
      const flightMatch = !flightFilter || match.flight === flightFilter
      const teamMatch =
        !teamFilter || match.home_team === teamFilter || match.away_team === teamFilter
      return leagueMatch && flightMatch && teamMatch
    })
  }, [matches, leagueFilter, flightFilter, teamFilter])

  const filteredAvailability = useMemo(() => {
    return availability.filter((entry) => {
      const leagueMatch = !leagueFilter || entry.leagueName === leagueFilter
      const flightMatch = !flightFilter || entry.flight === flightFilter
      const teamMatch = !teamFilter || entry.teamName === teamFilter
      const weekMatch = !weekFilter || entry.weekKey === weekFilter
      return leagueMatch && flightMatch && teamMatch && weekMatch
    })
  }, [availability, leagueFilter, flightFilter, teamFilter, weekFilter])

  const filteredScenarios = useMemo(() => {
    return scenarios.filter((scenario) => {
      const leagueMatch = !leagueFilter || scenario.league_name === leagueFilter
      const flightMatch = !flightFilter || scenario.flight === flightFilter
      const teamMatch = !teamFilter || scenario.team_name === teamFilter
      return leagueMatch && flightMatch && teamMatch
    })
  }, [scenarios, leagueFilter, flightFilter, teamFilter])

  const playerMap = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])

  const lineupStrength = useMemo(() => {
    const recent = filteredScenarios.slice(0, 8)
    const rows = recent.map((scenario) => {
      const slots = normalizeScenarioSlots(scenario.slots_json)
      const playerIds = slots.flatMap((slot) => slot.playerIds)
      const ratings = playerIds
        .map((id) => playerMap.get(id))
        .map((player) => player?.overall_dynamic_rating ?? player?.doubles_dynamic_rating ?? player?.singles_dynamic_rating ?? null)
        .filter((value): value is number => typeof value === 'number')

      const avg = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null

      return {
        id: scenario.id,
        name: scenario.scenario_name,
        teamName: scenario.team_name || '—',
        opponentTeam: scenario.opponent_team || '—',
        matchDate: scenario.match_date,
        avgRating: avg,
        slots: slots.length,
      }
    })

    return rows.sort((a, b) => (b.avgRating ?? -999) - (a.avgRating ?? -999))
  }, [filteredScenarios, playerMap])

  const pairingStats = useMemo(() => {
    const pairCounts = new Map<string, PairingStat>()

    for (const match of filteredMatches) {
      if ((match.match_type ?? '').toLowerCase() !== 'doubles') continue
      const participants = matchPlayers.filter((mp) => mp.match_id === match.id)

      const bySide = new Map<string, MatchPlayerRow[]>()
      for (const row of participants) {
        const side = cleanText(row.side) || 'unknown'
        const current = bySide.get(side) ?? []
        current.push(row)
        bySide.set(side, current)
      }

      for (const rows of bySide.values()) {
        if (rows.length < 2) continue
        const ids = rows
          .map((row) => row.player_id)
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))

        if (ids.length < 2) continue
        const key = ids.join('|')
        const names = ids
          .map((id) => playerMap.get(id)?.name ?? 'Unknown')
          .sort((a, b) => a.localeCompare(b))
        const ratings = ids
          .map((id) => playerMap.get(id)?.doubles_dynamic_rating ?? playerMap.get(id)?.overall_dynamic_rating ?? null)
          .filter((value): value is number => typeof value === 'number')
        const avgRating = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0
        const current = pairCounts.get(key)

        if (current) {
          current.matches += 1
        } else {
          pairCounts.set(key, {
            key,
            names,
            avgRating,
            matches: 1,
          })
        }
      }
    }

    return Array.from(pairCounts.values()).sort((a, b) => {
      if (b.matches !== a.matches) return b.matches - a.matches
      return b.avgRating - a.avgRating
    })
  }, [filteredMatches, matchPlayers, playerMap])

  const singlesLeaders = useMemo(() => {
    return [...filteredPlayers]
      .sort(
        (a, b) =>
          (b.singles_dynamic_rating ?? b.overall_dynamic_rating ?? -999) -
          (a.singles_dynamic_rating ?? a.overall_dynamic_rating ?? -999),
      )
      .slice(0, 6)
  }, [filteredPlayers])

  const doublesLeaders = useMemo(() => {
    return [...filteredPlayers]
      .sort(
        (a, b) =>
          (b.doubles_dynamic_rating ?? b.overall_dynamic_rating ?? -999) -
          (a.doubles_dynamic_rating ?? a.overall_dynamic_rating ?? -999),
      )
      .slice(0, 6)
  }, [filteredPlayers])

  const weeklyReadiness = useMemo<WeeklyReadiness | null>(() => {
    if (!filteredAvailability.length) return null
    const total = filteredAvailability.length
    const yes = filteredAvailability.filter((item) => item.response === 'yes').length
    const no = filteredAvailability.filter((item) => item.response === 'no').length
    const maybe = filteredAvailability.filter((item) => item.response === 'maybe').length
    const noResponse = filteredAvailability.filter((item) => item.response === 'no-response').length

    return {
      weekKey: weekFilter || filteredAvailability[0]?.weekKey || weekKeyFromDate(null),
      total,
      yes,
      no,
      maybe,
      noResponse,
      yesRate: total ? yes / total : 0,
      responseRate: total ? (yes + no + maybe) / total : 0,
    }
  }, [filteredAvailability, weekFilter])

  const weeklyAvailabilityTrend = useMemo(() => {
    const grouped = new Map<string, AvailabilityEntry[]>()
    for (const row of availability) {
      const leagueMatch = !leagueFilter || row.leagueName === leagueFilter
      const flightMatch = !flightFilter || row.flight === flightFilter
      const teamMatch = !teamFilter || row.teamName === teamFilter
      if (!(leagueMatch && flightMatch && teamMatch)) continue

      const current = grouped.get(row.weekKey) ?? []
      current.push(row)
      grouped.set(row.weekKey, current)
    }

    return Array.from(grouped.entries())
      .map(([weekKey, rows]) => {
        const total = rows.length
        const yes = rows.filter((row) => row.response === 'yes').length
        const maybe = rows.filter((row) => row.response === 'maybe').length
        const noResponse = rows.filter((row) => row.response === 'no-response').length
        return {
          weekKey,
          total,
          yes,
          maybe,
          noResponse,
          yesRate: total ? yes / total : 0,
          responseRate: total ? (total - noResponse) / total : 0,
        }
      })
      .sort((a, b) => a.weekKey.localeCompare(b.weekKey))
      .slice(-8)
  }, [availability, leagueFilter, flightFilter, teamFilter])

  const responseLeaders = useMemo(() => {
    const grouped = new Map<string, { name: string; total: number; replied: number; yes: number }>()

    for (const entry of availability) {
      const leagueMatch = !leagueFilter || entry.leagueName === leagueFilter
      const flightMatch = !flightFilter || entry.flight === flightFilter
      const teamMatch = !teamFilter || entry.teamName === teamFilter
      if (!(leagueMatch && flightMatch && teamMatch)) continue

      const key = entry.playerId || entry.playerName
      const current = grouped.get(key) ?? { name: entry.playerName, total: 0, replied: 0, yes: 0 }
      current.total += 1
      if (entry.response !== 'no-response') current.replied += 1
      if (entry.response === 'yes') current.yes += 1
      grouped.set(key, current)
    }

    return Array.from(grouped.values())
      .map((item) => ({
        ...item,
        replyRate: item.total ? item.replied / item.total : 0,
        availabilityRate: item.total ? item.yes / item.total : 0,
      }))
      .sort((a, b) => {
        if (b.replyRate !== a.replyRate) return b.replyRate - a.replyRate
        return b.availabilityRate - a.availabilityRate
      })
      .slice(0, 8)
  }, [availability, leagueFilter, flightFilter, teamFilter])

  const slowResponders = useMemo(() => {
    return responseLeaders
      .filter((item) => item.total >= 2)
      .sort((a, b) => a.replyRate - b.replyRate)
      .slice(0, 6)
  }, [responseLeaders])

  const noResponseList = useMemo(() => {
    return filteredAvailability.filter((item) => item.response === 'no-response').slice(0, 10)
  }, [filteredAvailability])

  const readinessScore = useMemo(() => {
    if (!weeklyReadiness) return null
    const score = weeklyReadiness.yesRate * 0.58 + weeklyReadiness.responseRate * 0.42
    return Math.max(0, Math.min(1, score))
  }, [weeklyReadiness])

  const recommendations = useMemo<Recommendation[]>(() => {
    const items: Recommendation[] = []

    if (weeklyReadiness) {
      if (weeklyReadiness.noResponse >= 3) {
        items.push({
          title: 'Follow up with non-responders',
          body: `${weeklyReadiness.noResponse} players still have not replied for the week of ${weeklyReadiness.weekKey}. Send a targeted reminder from Messaging before locking the lineup.`,
          tone: 'warn',
        })
      }

      if (weeklyReadiness.yes >= 6) {
        items.push({
          title: 'You have a workable lineup pool',
          body: `${weeklyReadiness.yes} players are marked available this week. This is enough to build a stronger singles + doubles mix and compare multiple saved scenarios.`,
          tone: 'good',
        })
      }

      if (weeklyReadiness.responseRate < 0.7) {
        items.push({
          title: 'Response rate is lagging',
          body: `Only ${formatPct(weeklyReadiness.responseRate)} of the filtered group has replied. Consider sending a short “need availability by tonight” message with match details attached.`,
          tone: 'warn',
        })
      }
    }

    if (lineupStrength[0]?.avgRating != null) {
      items.push({
        title: 'Top saved lineup is worth revisiting',
        body: `“${lineupStrength[0].name}” is your strongest recent saved scenario by average projected rating at ${formatRating(lineupStrength[0].avgRating)}. Use it as the baseline in the lineup builder.`,
        tone: 'info',
      })
    }

    if (pairingStats[0]) {
      items.push({
        title: 'Most proven doubles pairing',
        body: `${pairingStats[0].names.join(' / ')} has the strongest combination of repeat usage and projected doubles strength in the filtered sample.`,
        tone: 'good',
      })
    }

    if (slowResponders[0] && slowResponders[0].replyRate < 0.6) {
      items.push({
        title: 'Build your reminder list around response behavior',
        body: `${slowResponders[0].name} and similar players are replying below your normal standard. The captain console should target them first when you send lineup and match-day reminders.`,
        tone: 'info',
      })
    }

    return items.slice(0, 4)
  }, [weeklyReadiness, lineupStrength, pairingStats, slowResponders])

  type MetricTone = 'good' | 'warn' | 'info'

  type StatCard = {
    id: string
    label: string
    value: string
    helper: string
    tone: MetricTone
  }

  const statCards = useMemo<StatCard[]>(
    () => [
      {
        id: 'weekly-readiness',
        label: 'Weekly readiness',
        value: readinessScore == null ? '—' : `${Math.round(readinessScore * 100)}%`,
        helper: weeklyReadiness
          ? `${weeklyReadiness.yes} yes • ${weeklyReadiness.noResponse} no reply`
          : 'No availability data found',
        tone:
          readinessScore != null && readinessScore >= 0.75
            ? 'good'
            : readinessScore != null && readinessScore < 0.55
              ? 'warn'
              : 'info',
      },
      {
        id: 'players-in-scope',
        label: 'Players in scope',
        value: String(filteredPlayers.length),
        helper: flightFilter || 'All flights',
        tone: 'info',
      },
      {
        id: 'saved-lineup-scenarios',
        label: 'Saved lineup scenarios',
        value: String(filteredScenarios.length),
        helper: lineupStrength[0]?.name ? `Top: ${lineupStrength[0].name}` : 'No saved scenarios',
        tone: 'info',
      },
      {
        id: 'recent-matches',
        label: 'Recent matches',
        value: String(filteredMatches.length),
        helper: teamFilter || 'All teams',
        tone: 'info',
      },
    ],
    [readinessScore, weeklyReadiness, filteredPlayers.length, flightFilter, filteredScenarios.length, lineupStrength, filteredMatches.length, teamFilter],
  )

  return (
    <SiteShell active="/captain">
      <section style={pageContentStyle}>
        <section style={heroShellResponsive(isTablet, isMobile)}>
          <div>
            <div style={eyebrow}>Captain IQ</div>
            <h1 style={heroTitleResponsive(isSmallMobile, isMobile)}>Captain Analytics</h1>
            <p style={heroTextStyle}>
              Turn weekly availability, saved lineups, player ratings, and recent match history into
              real captain decisions: who to follow up with, who to trust, and which lineup gives
              you the strongest chance to win.
            </p>

            <div style={heroButtonRowStyle}>
              <Link href="/captain/messaging" style={primaryButton}>
                Open Weekly Messaging
              </Link>
              <Link href="/captains-corner/lineup-builder" style={ghostButton}>
                Open Lineup Builder
              </Link>
              <Link href="/captain" style={ghostButton}>
                Back to Captain
              </Link>
            </div>

            <div style={heroMetricGridStyle(isSmallMobile)}>
              {statCards.map((card) => (
                <MetricCard key={card.id} label={card.label} value={card.value} helper={card.helper} tone={card.tone} />
              ))}
            </div>
          </div>

          <div style={quickStartCard}>
            <p style={sectionKicker}>What this page is solving</p>
            <h2 style={quickStartTitle}>Weekly captain decisions, not vanity charts</h2>
            <div style={workflowListStyle}>
              {[
                ['1', 'See readiness', 'Know whether your team is actually ready for the week based on who replied and who is available.'],
                ['2', 'Compare your best options', 'Find your strongest recent singles, doubles, and saved lineup combinations in one place.'],
                ['3', 'Take action fast', 'Jump straight into messaging or the lineup builder with a clear list of follow-ups and lineup ideas.'],
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

            <div style={{ marginTop: 16 }}>
              <span style={miniPillSlate}>
                Availability source: {availabilityTableName ?? 'No live availability table found'}
              </span>
            </div>
          </div>
        </section>

        <section style={contentWrap}>
          <section style={surfaceCardStrong}>
            <div style={sectionHeaderStyle}>
              <div>
                <p style={sectionKicker}>Filters</p>
                <h2 style={sectionTitle}>Scope the captain view</h2>
                <p style={sectionBodyTextStyle}>
                  Narrow the analytics by league, flight, team, and week so the dashboard reflects
                  the exact roster and session you are managing.
                </p>
              </div>

              <button
                type="button"
                style={ghostButtonSmallButton}
                onClick={() => {
                  setLeagueFilter('')
                  setFlightFilter('')
                  setTeamFilter('')
                  setWeekFilter(weekOptions[0] ?? '')
                }}
              >
                Reset Filters
              </button>
            </div>

            <div style={filtersGridStyle}>
              <div>
                <label style={labelStyle}>League</label>
                <select value={leagueFilter} onChange={(e) => setLeagueFilter(e.target.value)} style={inputStyle}>
                  <option value="">All leagues</option>
                  {leagueOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Flight</label>
                <select value={flightFilter} onChange={(e) => setFlightFilter(e.target.value)} style={inputStyle}>
                  <option value="">All flights</option>
                  {flightOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Team</label>
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={inputStyle}>
                  <option value="">All teams</option>
                  {teamOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Week</label>
                <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} style={inputStyle}>
                  <option value="">All weeks</option>
                  {weekOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {loading ? (
            <section style={surfaceCard}>
              <p style={mutedTextStyle}>Loading captain analytics...</p>
            </section>
          ) : error ? (
            <section style={surfaceCard}>
              <p style={errorTextStyle}>Unable to load analytics: {error}</p>
            </section>
          ) : (
            <>
              <section style={projectionGridResponsive(isSmallMobile, isTablet)}>
                <ReadinessCard weeklyReadiness={weeklyReadiness} readinessScore={readinessScore} />
                <ResponseHealthCard noResponseList={noResponseList} slowResponders={slowResponders} />
                <RecommendationsCard recommendations={recommendations} />
              </section>

              <section style={dualGridResponsive(isTablet)}>
                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Singles strength</p>
                      <h3 style={sectionTitleSmall}>Top singles options</h3>
                    </div>
                    <span style={miniPillBlue}>{singlesLeaders.length} players</span>
                  </div>
                  <div style={stackListStyle}>
                    {singlesLeaders.length ? (
                      singlesLeaders.map((player, index) => (
                        <RankRow
                          key={player.id}
                          rank={index + 1}
                          name={player.name}
                          sublabel={player.flight || player.preferred_role || 'Player'}
                          value={formatRating(player.singles_dynamic_rating ?? player.overall_dynamic_rating)}
                        />
                      ))
                    ) : (
                      <p style={mutedTextStyle}>No singles rating data found in the current scope.</p>
                    )}
                  </div>
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Doubles strength</p>
                      <h3 style={sectionTitleSmall}>Top doubles options</h3>
                    </div>
                    <span style={miniPillGreen}>{doublesLeaders.length} players</span>
                  </div>
                  <div style={stackListStyle}>
                    {doublesLeaders.length ? (
                      doublesLeaders.map((player, index) => (
                        <RankRow
                          key={player.id}
                          rank={index + 1}
                          name={player.name}
                          sublabel={player.flight || player.preferred_role || 'Player'}
                          value={formatRating(player.doubles_dynamic_rating ?? player.overall_dynamic_rating)}
                        />
                      ))
                    ) : (
                      <p style={mutedTextStyle}>No doubles rating data found in the current scope.</p>
                    )}
                  </div>
                </section>
              </section>

              <section style={dualGridResponsive(isTablet)}>
                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Pairing intelligence</p>
                      <h3 style={sectionTitleSmall}>Most used doubles pairings</h3>
                    </div>
                    <span style={miniPillSlate}>{pairingStats.length} tracked</span>
                  </div>

                  {pairingStats.length ? (
                    <div style={tableWrapStyle}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Pairing</th>
                            <th style={thStyle}>Matches</th>
                            <th style={thStyle}>Avg rating</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pairingStats.slice(0, 8).map((row) => (
                            <tr key={row.key}>
                              <td style={tdLabelStyle}>{row.names.join(' / ')}</td>
                              <td style={tdStyle}>{row.matches}</td>
                              <td style={tdStyle}>{formatRating(row.avgRating)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={mutedTextStyle}>No doubles pairing history found in the filtered match sample.</p>
                  )}
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Saved lineup strength</p>
                      <h3 style={sectionTitleSmall}>Best recent scenarios</h3>
                    </div>
                    <span style={miniPillBlue}>{lineupStrength.length} scenarios</span>
                  </div>

                  {lineupStrength.length ? (
                    <div style={stackListStyle}>
                      {lineupStrength.slice(0, 6).map((row, index) => (
                        <div key={row.id} style={listCardStyle}>
                          <div style={listCardTopStyle}>
                            <div>
                              <div style={listTitleStyle}>
                                {index + 1}. {row.name}
                              </div>
                              <div style={listMetaStyle}>
                                {row.teamName} vs {row.opponentTeam} • {formatDate(row.matchDate)}
                              </div>
                            </div>
                            <span style={miniPillGreen}>{formatRating(row.avgRating)}</span>
                          </div>
                          <div style={pillRowStyle}>
                            <span style={miniPillSlate}>{row.slots} slots</span>
                            <Link href="/captains-corner/lineup-builder" style={inlineLinkPill}>
                              Open builder
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={mutedTextStyle}>No saved lineup scenarios found in the current scope.</p>
                  )}
                </section>
              </section>

              <section style={surfaceCard}>
                <div style={tableHeaderStyle}>
                  <div>
                    <p style={sectionKicker}>Availability trends</p>
                    <h3 style={sectionTitleSmall}>Last several weeks</h3>
                  </div>
                  <span style={miniPillSlate}>{weeklyAvailabilityTrend.length} weeks</span>
                </div>

                {weeklyAvailabilityTrend.length ? (
                  <div style={tableWrapStyle}>
                    <table style={tableStyle}>
                      <thead>
                        <tr>
                          <th style={thStyle}>Week</th>
                          <th style={thStyle}>Yes rate</th>
                          <th style={thStyle}>Response rate</th>
                          <th style={thStyle}>Maybe</th>
                          <th style={thStyle}>No response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weeklyAvailabilityTrend.map((row) => (
                          <tr key={row.weekKey}>
                            <td style={tdLabelStyle}>{row.weekKey}</td>
                            <td style={tdStyle}>{formatPct(row.yesRate)}</td>
                            <td style={tdStyle}>{formatPct(row.responseRate)}</td>
                            <td style={tdStyle}>{row.maybe}</td>
                            <td style={tdStyle}>{row.noResponse}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={mutedTextStyle}>No multi-week availability history is available yet.</p>
                )}
              </section>

              <section style={dualGridResponsive(isTablet)}>
                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Reply behavior</p>
                      <h3 style={sectionTitleSmall}>Most reliable responders</h3>
                    </div>
                    <span style={miniPillGreen}>{responseLeaders.length} tracked</span>
                  </div>
                  <div style={stackListStyle}>
                    {responseLeaders.length ? (
                      responseLeaders.map((row) => (
                        <div key={row.name} style={listCardStyleCompact}>
                          <div>
                            <div style={listTitleStyle}>{row.name}</div>
                            <div style={listMetaStyle}>
                              Reply {formatPct(row.replyRate)} • Available {formatPct(row.availabilityRate)}
                            </div>
                          </div>
                          <span style={miniPillBlue}>{row.total} weeks</span>
                        </div>
                      ))
                    ) : (
                      <p style={mutedTextStyle}>No response history found yet.</p>
                    )}
                  </div>
                </section>

                <section style={surfaceCard}>
                  <div style={tableHeaderStyle}>
                    <div>
                      <p style={sectionKicker}>Captain actions</p>
                      <h3 style={sectionTitleSmall}>Fast links</h3>
                    </div>
                    <span style={miniPillSlate}>Workflow</span>
                  </div>
                  <div style={stackListStyle}>
                    {[
                      {
                        title: 'Weekly messaging console',
                        body: 'Message only non-responders, available players, or lineup locks for the current week.',
                        href: '/captain/messaging',
                      },
                      {
                        title: 'Lineup builder',
                        body: 'Use analytics to compare saved scenarios and then finalize the strongest version.',
                        href: '/captains-corner/lineup-builder',
                      },
                      {
                        title: 'Scenario comparison',
                        body: 'Compare two lineup versions side by side and see where your strongest edges live.',
                        href: '/captains-corner/scenario-comparison',
                      },
                      {
                        title: 'Availability page',
                        body: 'Collect weekly player responses and keep this dashboard current.',
                        href: '/captain/availability',
                      },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} style={actionCardLinkStyle}>
                        <div style={listTitleStyle}>{item.title}</div>
                        <div style={listMetaStyle}>{item.body}</div>
                      </Link>
                    ))}
                  </div>
                </section>
              </section>
            </>
          )}
        </section>
      </section>
    </SiteShell>
  )
}

function MetricCard({
  label,
  value,
  helper,
  tone,
}: {
  label: string
  value: string
  helper: string
  tone: 'good' | 'warn' | 'info'
}) {
  return (
    <div style={heroMetricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyleHero}>{value}</div>
      <div style={tone === 'good' ? helperGoodStyle : tone === 'warn' ? helperWarnStyle : helperInfoStyle}>
        {helper}
      </div>
    </div>
  )
}

function ReadinessCard({
  weeklyReadiness,
  readinessScore,
}: {
  weeklyReadiness: WeeklyReadiness | null
  readinessScore: number | null
}) {
  return (
    <section style={surfaceCard}>
      <p style={sectionKicker}>Weekly readiness</p>
      <div style={projectionValueStyle}>{readinessScore == null ? '—' : `${Math.round(readinessScore * 100)}%`}</div>
      <p style={sectionBodyTextStyle}>
        {weeklyReadiness
          ? `For ${weeklyReadiness.weekKey}, ${weeklyReadiness.yes} players are in, ${weeklyReadiness.maybe} are tentative, and ${weeklyReadiness.noResponse} still need a reply.`
          : 'Add or connect weekly availability data to unlock the team readiness score.'}
      </p>
      {weeklyReadiness ? (
        <div style={pillRowStyle}>
          <span style={miniPillGreen}>{weeklyReadiness.yes} yes</span>
          <span style={miniPillSlate}>{weeklyReadiness.maybe} maybe</span>
          <span style={warnPill}>{weeklyReadiness.noResponse} no reply</span>
        </div>
      ) : null}
    </section>
  )
}

function ResponseHealthCard({
  noResponseList,
  slowResponders,
}: {
  noResponseList: AvailabilityEntry[]
  slowResponders: Array<{ name: string; total: number; replied: number; yes: number; replyRate: number; availabilityRate: number }>
}) {
  return (
    <section style={surfaceCard}>
      <p style={sectionKicker}>Response health</p>
      <div style={projectionValueStyle}>{noResponseList.length}</div>
      <p style={sectionBodyTextStyle}>
        Players currently needing follow-up in the active weekly scope.
      </p>
      <div style={stackListStyleCompact}>
        {noResponseList.length ? (
          noResponseList.slice(0, 4).map((item) => (
            <div key={item.id} style={listCardStyleCompact}>
              <div>
                <div style={listTitleStyle}>{item.playerName}</div>
                <div style={listMetaStyle}>{item.teamName || item.leagueName || 'Roster contact'}</div>
              </div>
              <span style={warnPill}>No reply</span>
            </div>
          ))
        ) : slowResponders.length ? (
          slowResponders.slice(0, 3).map((item) => (
            <div key={item.name} style={listCardStyleCompact}>
              <div>
                <div style={listTitleStyle}>{item.name}</div>
                <div style={listMetaStyle}>Reply rate {formatPct(item.replyRate)}</div>
              </div>
              <span style={miniPillSlate}>{item.total} weeks</span>
            </div>
          ))
        ) : (
          <p style={mutedTextStyle}>No current reply risk detected.</p>
        )}
      </div>
    </section>
  )
}

function RecommendationsCard({ recommendations }: { recommendations: Recommendation[] }) {
  return (
    <section style={surfaceCardStrong}>
      <p style={sectionKicker}>Recommended actions</p>
      <div style={stackListStyleCompact}>
        {recommendations.length ? (
          recommendations.map((item) => (
            <div key={item.title} style={recommendationCardStyle}>
              <div style={recommendationTopStyle}>
                <div style={listTitleStyle}>{item.title}</div>
                <span style={item.tone === 'good' ? miniPillGreen : item.tone === 'warn' ? warnPill : miniPillBlue}>
                  {item.tone === 'good' ? 'Priority' : item.tone === 'warn' ? 'Watch' : 'Insight'}
                </span>
              </div>
              <div style={listMetaStyle}>{item.body}</div>
            </div>
          ))
        ) : (
          <p style={mutedTextStyle}>No recommendations yet. Add more lineup and availability history.</p>
        )}
      </div>
    </section>
  )
}

function RankRow({
  rank,
  name,
  sublabel,
  value,
}: {
  rank: number
  name: string
  sublabel: string
  value: string
}) {
  return (
    <div style={rankRowStyle}>
      <div style={rankBubbleStyle}>{rank}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={listTitleStyle}>{name}</div>
        <div style={listMetaStyle}>{titleCase(sublabel)}</div>
      </div>
      <span style={miniPillBlue}>{value}</span>
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
    gridTemplateColumns: isSmallMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
  }
}

function projectionGridResponsive(isSmallMobile: boolean, isTablet: boolean): CSSProperties {
  return {
    ...projectionGridStyle,
    gridTemplateColumns: isSmallMobile ? '1fr' : isTablet ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
  }
}

function dualGridResponsive(isTablet: boolean): CSSProperties {
  return {
    ...dualGridStyle,
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
  fontSize: '1.2rem',
  fontWeight: 900,
  lineHeight: 1.3,
}

const helperInfoStyle: CSSProperties = {
  marginTop: 8,
  color: 'rgba(231,239,251,0.72)',
  fontSize: '.92rem',
  lineHeight: 1.45,
}

const helperGoodStyle: CSSProperties = {
  ...helperInfoStyle,
  color: '#d9ffd8',
}

const helperWarnStyle: CSSProperties = {
  ...helperInfoStyle,
  color: '#fecaca',
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

const dualGridStyle: CSSProperties = {
  display: 'grid',
  gap: '20px',
}

const projectionGridStyle: CSSProperties = {
  display: 'grid',
  gap: '18px',
}

const stackListStyle: CSSProperties = {
  display: 'grid',
  gap: '12px',
}

const stackListStyleCompact: CSSProperties = {
  display: 'grid',
  gap: '10px',
}

const listCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const listCardStyleCompact: CSSProperties = {
  borderRadius: '16px',
  padding: '12px 14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
}

const listCardTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '12px',
}

const listTitleStyle: CSSProperties = {
  color: '#f8fbff',
  fontWeight: 800,
  lineHeight: 1.35,
}

const listMetaStyle: CSSProperties = {
  color: 'rgba(224,234,247,0.72)',
  fontSize: '.93rem',
  lineHeight: 1.55,
  marginTop: '4px',
}

const actionCardLinkStyle: CSSProperties = {
  ...listCardStyle,
  textDecoration: 'none',
  display: 'block',
}

const recommendationCardStyle: CSSProperties = {
  borderRadius: '18px',
  padding: '14px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const recommendationTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '8px',
  flexWrap: 'wrap',
}

const rankRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '12px 14px',
  borderRadius: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.08)',
}

const rankBubbleStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  color: '#0f1632',
  background: 'linear-gradient(135deg, #9be11d 0%, #4ade80 100%)',
  flexShrink: 0,
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

const ghostButtonSmallButton: CSSProperties = {
  ...ghostButton,
  minHeight: '42px',
  cursor: 'pointer',
  appearance: 'none',
}

const inlineLinkPill: CSSProperties = {
  ...ghostButton,
  minHeight: '30px',
  padding: '0 12px',
  fontSize: '12px',
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
