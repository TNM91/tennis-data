import { createClient } from '@supabase/supabase-js'
import {
  inferCompetitionLayerFromValues,
  inferLeagueFormatFromValues,
  type CompetitionLayer,
  type LeagueFormat,
} from '@/lib/competition-layers'
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
  leagueId?: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  year: string
  season: string
  gender: string
  rating: string
  competitionLayer: CompetitionLayer
  leagueFormat: LeagueFormat
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

function isInvalidLeagueName(value: string | null | undefined) {
  const cleaned = safeText(value)
  if (!cleaned) return true
  if (/^(singles|doubles)$/i.test(cleaned)) return true
  if (/^#?\s*\d+\s*#?\s*(singles|doubles)$/i.test(cleaned)) return true
  return false
}

function canonicalTeamName(value: string | null | undefined) {
  const cleaned = safeText(value)
  if (!cleaned) return ''
  const lower = cleaned.toLowerCase()
  if (lower === 'singles' || lower === 'doubles') return ''
  if (/^#?\s*\d+\s*#?\s*(singles|doubles)$/i.test(cleaned)) return ''
  if (!/[a-z]/i.test(cleaned)) return ''
  return cleaned.replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim().toLowerCase()
}

function isScheduleSource(value: string | null | undefined) {
  return /\bschedule\b/i.test(safeText(value))
}

function inferYear(row: MatchLeagueRow) {
  const leagueYear = safeText(row.league_name).match(/\b(20\d{2})\b/)
  if (leagueYear) return leagueYear[1]
  return safeText(row.match_date).slice(0, 4)
}

function inferSeason(row: MatchLeagueRow) {
  const haystack = [row.league_name, row.source].map(safeText).join(' ')
  const match = haystack.match(/\b(Spring|Summer|Fall|Winter)\b/i)
  return match ? match[1].toLowerCase().replace(/^\w/, (c) => c.toUpperCase()) : ''
}

function inferGender(row: MatchLeagueRow) {
  const haystack = [row.league_name, row.flight, row.usta_section, row.district_area].map(safeText).join(' ').toLowerCase()
  if (/\b(women|female|ladies)\b/.test(haystack)) return 'Female'
  if (/\b(men|male|gentlemen)\b/.test(haystack)) return 'Male'
  return ''
}

function inferRating(row: MatchLeagueRow) {
  const haystack = [row.flight, row.league_name].map(safeText).join(' ')
  const match = haystack.match(/\b([2-5](?:\.[05]))\b/)
  return match ? match[1] : ''
}

function chooseBetterText(current: string, incoming: string) {
  if (!current && incoming) return incoming
  if (incoming.length > current.length) return incoming
  return current
}

function buildLeagueKey(row: MatchLeagueRow) {
  const competitionLayer = inferCompetitionLayerFromValues({
    leagueName: row.league_name,
    ustaSection: row.usta_section,
    districtArea: row.district_area,
  })

  return [
    competitionLayer,
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
  const leagueMap = new Map<string, LeagueCard & { teamSet: Set<string>; scheduleTeamSet: Set<string> }>()
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
        const leagueNameText = isInvalidLeagueName(row.league_name) ? '' : safeText(row.league_name)
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
        const year = inferYear(row)
        const season = inferSeason(row)
        const gender = inferGender(row)
        const rating = inferRating(row)
        const competitionLayer = inferCompetitionLayerFromValues({
          leagueName,
          ustaSection,
          districtArea,
        })

        if (!leagueMap.has(key)) {
          leagueMap.set(key, {
            key,
            leagueName,
            flight,
            ustaSection,
            districtArea,
            year,
            season,
            gender,
            rating,
            competitionLayer,
            leagueFormat: inferLeagueFormatFromValues({
              competitionLayer,
              leagueName,
            }),
            matchCount: 0,
            teamCount: 0,
            latestMatchDate: row.match_date || null,
            teamSet: new Set<string>(),
            scheduleTeamSet: new Set<string>(),
          })
        }

        const current = leagueMap.get(key)!
        current.matchCount += 1
        current.leagueName = chooseBetterText(current.leagueName, leagueName)
        current.flight = chooseBetterText(current.flight, flight)
        current.ustaSection = chooseBetterText(current.ustaSection, ustaSection)
        current.districtArea = chooseBetterText(current.districtArea, districtArea)

        const canonicalHome = canonicalTeamName(homeTeam)
        const canonicalAway = canonicalTeamName(awayTeam)
        if (canonicalHome) current.teamSet.add(canonicalHome)
        if (canonicalAway) current.teamSet.add(canonicalAway)
        if (isScheduleSource(row.source)) {
          if (canonicalHome) current.scheduleTeamSet.add(canonicalHome)
          if (canonicalAway) current.scheduleTeamSet.add(canonicalAway)
        }

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
      year: league.year,
      season: league.season,
      gender: league.gender,
      rating: league.rating,
      competitionLayer: league.competitionLayer,
      leagueFormat: inferLeagueFormatFromValues({
        competitionLayer: league.competitionLayer,
        leagueName: league.leagueName,
        teamCount: (league.scheduleTeamSet.size || league.teamSet.size),
      }),
      matchCount: league.matchCount,
      teamCount: league.scheduleTeamSet.size || league.teamSet.size,
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
