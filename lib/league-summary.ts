import { createClient } from '@supabase/supabase-js'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

const LEAGUE_SUMMARY_PAGE_SIZE = 2000
const LEAGUE_SUMMARY_FETCH_LIMIT = 20000
const LEAGUE_SUMMARY_TIMEOUT_MS = 20000

type MatchLeagueRow = {
  id: string
  external_match_id: string | null
  league_name: string | null
  flight: string | null
  usta_section: string | null
  district_area: string | null
  home_team: string | null
  away_team: string | null
  match_date: string
  source?: string | null
  line_number?: string | null
}

export type LeagueCard = {
  key: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  matchCount: number
  teamCount: number
  latestMatchDate: string | null
}

export type LeagueSummaryPayload = {
  leagues: LeagueCard[]
  totalMatches: number
  totalFlights: number
  latestMatch: string | null
  notice: string | null
  diagnostics: {
    totalParentMatches: number
    namedParentMatches: number
    missingLeagueNameCount: number
    missingTeamCount: number
    sampleMissingLeagueRows: Array<{
      externalMatchId: string
      matchDate: string | null
      homeTeam: string
      awayTeam: string
      flight: string
      ustaSection: string
      districtArea: string
      source: string
    }>
  }
}

function safeText(value: string | null | undefined) {
  return (value || '').trim()
}

function normalizeKeyPart(value: string | null | undefined) {
  return safeText(value).toLowerCase()
}

function chooseBetterText(current: string, incoming: string) {
  if (!current && incoming) return incoming
  if (incoming.length > current.length) return incoming
  return current
}

function buildLeagueKey(row: MatchLeagueRow) {
  return [
    normalizeKeyPart(row.league_name),
    normalizeKeyPart(row.flight),
    normalizeKeyPart(row.usta_section),
    normalizeKeyPart(row.district_area),
  ].join('__')
}

function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

export async function fetchLeagueSummary(): Promise<LeagueSummaryPayload> {
  const supabase = createServerSupabaseClient()
  const deadline = Date.now() + LEAGUE_SUMMARY_TIMEOUT_MS
  const leagueMap = new Map<string, LeagueCard & { teamSet: Set<string> }>()
  let totalMatches = 0
  let totalParentMatches = 0
  let missingLeagueNameCount = 0
  let missingTeamCount = 0
  const sampleMissingLeagueRows: LeagueSummaryPayload['diagnostics']['sampleMissingLeagueRows'] = []
  let notice: string | null = null

  for (let offset = 0; offset < LEAGUE_SUMMARY_FETCH_LIMIT; offset += LEAGUE_SUMMARY_PAGE_SIZE) {
    const remainingMs = deadline - Date.now()
    if (remainingMs <= 0) {
      notice = `Loaded the most recent ${totalMatches.toLocaleString()} parent matches before the server summary timeout. Older season rows may still exist outside this summary window.`
      break
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), remainingMs)

    try {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          external_match_id,
          league_name,
          flight,
          usta_section,
          district_area,
          home_team,
          away_team,
          match_date,
          source,
          line_number
        `)
        .is('line_number', null)
        .order('match_date', { ascending: false })
        .range(offset, offset + LEAGUE_SUMMARY_PAGE_SIZE - 1)
        .abortSignal(controller.signal)

      if (error) {
        throw new Error(error.message)
      }

      const batch = (data || []) as MatchLeagueRow[]
      totalParentMatches += batch.length

      for (const row of batch) {
        const leagueNameText = safeText(row.league_name)
        const homeTeam = safeText(row.home_team)
        const awayTeam = safeText(row.away_team)

        if (!leagueNameText) {
          missingLeagueNameCount += 1

          if (sampleMissingLeagueRows.length < 6) {
            sampleMissingLeagueRows.push({
              externalMatchId: safeText(row.external_match_id) || row.id,
              matchDate: row.match_date || null,
              homeTeam,
              awayTeam,
              flight: safeText(row.flight),
              ustaSection: safeText(row.usta_section),
              districtArea: safeText(row.district_area),
              source: safeText(row.source),
            })
          }
        }

        if (!homeTeam || !awayTeam) {
          missingTeamCount += 1
        }

        if (!leagueNameText) continue

        totalMatches += 1
        const key = buildLeagueKey(row)
        if (!key) continue

        const leagueName = leagueNameText
        const flight = safeText(row.flight)
        const ustaSection = safeText(row.usta_section)
        const districtArea = safeText(row.district_area)

        if (!leagueMap.has(key)) {
          leagueMap.set(key, {
            key,
            leagueName,
            flight,
            ustaSection,
            districtArea,
            matchCount: 0,
            teamCount: 0,
            latestMatchDate: row.match_date || null,
            teamSet: new Set<string>(),
          })
        }

        const current = leagueMap.get(key)!
        current.matchCount += 1
        current.leagueName = chooseBetterText(current.leagueName, leagueName)
        current.flight = chooseBetterText(current.flight, flight)
        current.ustaSection = chooseBetterText(current.ustaSection, ustaSection)
        current.districtArea = chooseBetterText(current.districtArea, districtArea)

        if (homeTeam) current.teamSet.add(homeTeam)
        if (awayTeam) current.teamSet.add(awayTeam)

        if (
          row.match_date &&
          (!current.latestMatchDate ||
            new Date(row.match_date).getTime() > new Date(current.latestMatchDate).getTime())
        ) {
          current.latestMatchDate = row.match_date
        }
      }

      if ((data || []).length < LEAGUE_SUMMARY_PAGE_SIZE) {
        break
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        notice = `Loaded the most recent ${totalMatches.toLocaleString()} parent matches before the server summary timeout. Older season rows may still exist outside this summary window.`
        break
      }

      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const leagues = [...leagueMap.values()]
    .map((league) => ({
      key: league.key,
      leagueName: league.leagueName,
      flight: league.flight,
      ustaSection: league.ustaSection,
      districtArea: league.districtArea,
      matchCount: league.matchCount,
      teamCount: league.teamSet.size,
      latestMatchDate: league.latestMatchDate,
    }))
    .sort((a, b) => {
      const aDate = a.latestMatchDate ? new Date(a.latestMatchDate).getTime() : 0
      const bDate = b.latestMatchDate ? new Date(b.latestMatchDate).getTime() : 0
      return bDate - aDate
    })

  const totalFlights = new Set(leagues.map((league) => league.flight).filter(Boolean)).size
  const latestMatch =
    leagues.length > 0
      ? leagues
          .map((league) => league.latestMatchDate)
          .filter(Boolean)
          .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null
      : null

  return {
    leagues,
    totalMatches,
    totalFlights,
    latestMatch,
    notice,
    diagnostics: {
      totalParentMatches,
      namedParentMatches: totalMatches,
      missingLeagueNameCount,
      missingTeamCount,
      sampleMissingLeagueRows,
    },
  }
}
