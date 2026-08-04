import type { SupabaseClient } from '@supabase/supabase-js'
import type { CaptainResumeState } from './captain-memory'
import {
  isCaptainTeamConnection,
  normalizeTeamConnectionRoles,
  type TeamProfileLinkRow,
} from './team-profile-links'

export type CaptainResumeTeamScope = {
  team: string
  league: string
  flight: string
  isDefault: boolean
  updatedAt: string
}

export type CaptainResumeNextMatch = {
  source: 'usta' | 'tiq'
  matchId: string
  scopeKey: string
  team: string
  league: string
  flight: string
  date: string
  time: string
  opponent: string
}

type ProfileTeamRow = {
  linked_team_name?: string | null
  linked_league_name?: string | null
  linked_flight?: string | null
}

type MatchRow = {
  id?: string | null
  match_date?: string | null
  match_time?: string | null
  home_team?: string | null
  away_team?: string | null
  league_name?: string | null
  flight?: string | null
  match_source?: string | null
}

type TiqLeagueRow = {
  id?: string | null
  league_name?: string | null
  flight?: string | null
  captain_team_name?: string | null
  teams?: string[] | null
}

type TiqScheduleRow = {
  id?: string | null
  league_id?: string | null
  participant_a_name?: string | null
  participant_b_name?: string | null
  scheduled_date?: string | null
  scheduled_time?: string | null
}

function cleanText(value: string | null | undefined, maxLength = 300) {
  return (value || '').trim().slice(0, maxLength)
}

function normalizeKey(value: string | null | undefined) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function buildCaptainResumeScopeKey(input: {
  team?: string | null
  league?: string | null
  flight?: string | null
}) {
  return [normalizeKey(input.team), normalizeKey(input.league), normalizeKey(input.flight)].join('__')
}

export function buildCaptainResumeTeamScopes(
  links: TeamProfileLinkRow[],
  profile?: ProfileTeamRow | null,
) {
  const scopes = new Map<string, CaptainResumeTeamScope>()

  for (const link of links) {
    const roles = normalizeTeamConnectionRoles(link.team_roles, link.team_role)
    if (link.status !== 'accepted' || !isCaptainTeamConnection(roles)) continue
    const scope = normalizeScope({
      team: link.team_name,
      league: link.league_name,
      flight: link.flight,
      isDefault: link.is_default === true,
      updatedAt: link.updated_at,
    })
    if (!scope) continue
    const key = buildCaptainResumeScopeKey(scope)
    const current = scopes.get(key)
    if (!current || scope.isDefault || Date.parse(scope.updatedAt) > Date.parse(current.updatedAt)) {
      scopes.set(key, scope)
    }
  }

  if (!scopes.size && !links.length) {
    const fallback = normalizeScope({
      team: profile?.linked_team_name,
      league: profile?.linked_league_name,
      flight: profile?.linked_flight,
      isDefault: true,
      updatedAt: '',
    })
    if (fallback) scopes.set(buildCaptainResumeScopeKey(fallback), fallback)
  }

  return [...scopes.values()]
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) return left.isDefault ? -1 : 1
      const timeDiff = Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      if (Number.isFinite(timeDiff) && timeDiff) return timeDiff
      return left.team.localeCompare(right.team)
    })
    .slice(0, 12)
}

export function chooseCaptainResumeNextMatch(
  scopes: CaptainResumeTeamScope[],
  matches: CaptainResumeNextMatch[],
) {
  const scopeByKey = new Map(scopes.map((scope) => [buildCaptainResumeScopeKey(scope), scope]))
  const valid = matches.filter((match) => scopeByKey.has(match.scopeKey) && /^\d{4}-\d{2}-\d{2}$/.test(match.date))
  const defaultMatches = valid.filter((match) => scopeByKey.get(match.scopeKey)?.isDefault)
  return [...(defaultMatches.length ? defaultMatches : valid)].sort(compareNextMatches)[0] || null
}

export function captainResumeHasCurrentMatch(
  captain: CaptainResumeState | null | undefined,
  today: string,
) {
  const date = cleanText(captain?.eventDate, 10)
  return Boolean(cleanText(captain?.team) && /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today)
}

export function applyAutomaticCaptainNextMatch(
  captain: CaptainResumeState | null | undefined,
  match: CaptainResumeNextMatch | null,
  today: string,
  now = new Date().toISOString(),
) {
  if (captainResumeHasCurrentMatch(captain, today) || !match) return captain || null

  return {
    competitionLayer: match.source,
    team: match.team,
    league: match.league,
    flight: match.flight,
    lastTool: 'hub',
    lastToolLabel: 'Captain home',
    lastVisitedAt: captain?.lastVisitedAt || now,
    eventDate: match.date,
    opponentTeam: match.opponent,
    ...(match.source === 'usta' && match.matchId ? { matchId: match.matchId } : {}),
  } satisfies CaptainResumeState
}

export async function loadCaptainResumeNextMatch(
  service: SupabaseClient,
  userId: string,
  today: string,
) {
  try {
    return await loadCaptainResumeNextMatchFromCloud(service, userId, today)
  } catch {
    return null
  }
}

async function loadCaptainResumeNextMatchFromCloud(
  service: SupabaseClient,
  userId: string,
  today: string,
) {
  const [linksResult, profileResult] = await Promise.all([
    service
      .from('team_profile_links')
      .select('team_name,league_name,flight,team_role,team_roles,status,is_default,updated_at')
      .eq('profile_user_id', userId)
      .eq('status', 'accepted')
      .order('is_default', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(50),
    service
      .from('profiles')
      .select('linked_team_name,linked_league_name,linked_flight')
      .eq('id', userId)
      .maybeSingle(),
  ])

  const scopes = buildCaptainResumeTeamScopes(
    (linksResult.data || []) as TeamProfileLinkRow[],
    (profileResult.data || null) as ProfileTeamRow | null,
  )
  if (!scopes.length) return null

  const [ustaMatches, tiqMatches] = await Promise.all([
    loadUstaMatches(service, scopes, today),
    loadTiqMatches(service, scopes, today),
  ])
  return chooseCaptainResumeNextMatch(scopes, [...ustaMatches, ...tiqMatches])
}

function normalizeScope(input: {
  team?: string | null
  league?: string | null
  flight?: string | null
  isDefault?: boolean
  updatedAt?: string | null
}) {
  const team = cleanText(input.team)
  if (!team) return null
  return {
    team,
    league: cleanText(input.league),
    flight: cleanText(input.flight),
    isDefault: input.isDefault === true,
    updatedAt: cleanText(input.updatedAt, 80),
  } satisfies CaptainResumeTeamScope
}

async function loadUstaMatches(
  service: SupabaseClient,
  scopes: CaptainResumeTeamScope[],
  today: string,
) {
  const leagueNames = [...new Set(scopes.map((scope) => scope.league).filter(Boolean))]
  const rows: MatchRow[] = []

  if (leagueNames.length) {
    const { data } = await service
      .from('matches')
      .select('id,match_date,match_time,home_team,away_team,league_name,flight,match_source')
      .in('league_name', leagueNames)
      .gte('match_date', today)
      .is('line_number', null)
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })
      .limit(600)
    rows.push(...((data || []) as MatchRow[]))
  }

  const unscopedRows = await Promise.all(scopes.filter((scope) => !scope.league).map(async (scope) => {
    const safeTeam = scope.team.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const { data } = await service
      .from('matches')
      .select('id,match_date,match_time,home_team,away_team,league_name,flight,match_source')
      .or(`home_team.eq."${safeTeam}",away_team.eq."${safeTeam}"`)
      .gte('match_date', today)
      .is('line_number', null)
      .order('match_date', { ascending: true })
      .order('match_time', { ascending: true })
      .limit(40)
    return (data || []) as MatchRow[]
  }))
  rows.push(...unscopedRows.flat())

  const earliestByScope = new Map<string, CaptainResumeNextMatch>()
  for (const row of rows) {
    const scope = scopes.find((item) => (
      (!item.league || normalizeKey(item.league) === normalizeKey(row.league_name)) &&
      (!item.flight || normalizeKey(item.flight) === normalizeKey(row.flight)) &&
      [row.home_team, row.away_team].some((team) => normalizeKey(team) === normalizeKey(item.team))
    ))
    if (!scope) continue
    const isHome = normalizeKey(row.home_team) === normalizeKey(scope.team)
    const match = {
      source: normalizeKey(row.match_source) === 'tiq' ? 'tiq' : 'usta',
      matchId: cleanText(row.id, 160),
      scopeKey: buildCaptainResumeScopeKey(scope),
      team: scope.team,
      league: scope.league || cleanText(row.league_name),
      flight: scope.flight || cleanText(row.flight),
      date: cleanText(row.match_date, 10),
      time: cleanText(row.match_time, 20),
      opponent: cleanText(isHome ? row.away_team : row.home_team) || 'Opponent TBD',
    } satisfies CaptainResumeNextMatch
    const current = earliestByScope.get(match.scopeKey)
    if (!current || compareNextMatches(match, current) < 0) earliestByScope.set(match.scopeKey, match)
  }

  return [...earliestByScope.values()]
}

async function loadTiqMatches(
  service: SupabaseClient,
  scopes: CaptainResumeTeamScope[],
  today: string,
) {
  const leagueNames = [...new Set(scopes.map((scope) => scope.league).filter(Boolean))]
  if (!leagueNames.length) return []

  const { data: leagueData, error: leagueError } = await service
    .from('tiq_leagues')
    .select('id,league_name,flight,captain_team_name,teams')
    .eq('league_format', 'team')
    .in('league_name', leagueNames)
    .limit(100)
  if (leagueError || !leagueData?.length) return []

  const leagues = (leagueData as TiqLeagueRow[]).filter((league) => scopes.some((scope) => (
    normalizeKey(scope.league) === normalizeKey(league.league_name) &&
    (!scope.flight || !league.flight || normalizeKey(scope.flight) === normalizeKey(league.flight)) &&
    [league.captain_team_name, ...(league.teams || [])].some((team) => normalizeKey(team) === normalizeKey(scope.team))
  )))
  const leagueIds = leagues.flatMap((league) => cleanText(league.id, 160) ? [cleanText(league.id, 160)] : [])
  if (!leagueIds.length) return []

  const { data: scheduleData, error: scheduleError } = await service
    .from('tiq_league_schedule_items')
    .select('id,league_id,participant_a_name,participant_b_name,scheduled_date,scheduled_time')
    .in('league_id', leagueIds)
    .in('status', ['confirmed', 'coordinator_set'])
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .order('scheduled_time', { ascending: true })
    .limit(200)
  if (scheduleError) return []

  const leagueById = new Map(leagues.map((league) => [cleanText(league.id, 160), league]))
  return ((scheduleData || []) as TiqScheduleRow[]).flatMap<CaptainResumeNextMatch>((row) => {
    const league = leagueById.get(cleanText(row.league_id, 160))
    if (!league) return []
    const scope = scopes.find((item) => (
      normalizeKey(item.league) === normalizeKey(league.league_name) &&
      (!item.flight || !league.flight || normalizeKey(item.flight) === normalizeKey(league.flight)) &&
      [row.participant_a_name, row.participant_b_name].some((team) => normalizeKey(team) === normalizeKey(item.team))
    ))
    if (!scope) return []
    const isSideA = normalizeKey(row.participant_a_name) === normalizeKey(scope.team)
    return [{
      source: 'tiq',
      matchId: cleanText(row.id, 160),
      scopeKey: buildCaptainResumeScopeKey(scope),
      team: scope.team,
      league: scope.league || cleanText(league.league_name),
      flight: scope.flight || cleanText(league.flight),
      date: cleanText(row.scheduled_date, 10),
      time: cleanText(row.scheduled_time, 20),
      opponent: cleanText(isSideA ? row.participant_b_name : row.participant_a_name) || 'Opponent TBD',
    }]
  })
}

function compareNextMatches(left: CaptainResumeNextMatch, right: CaptainResumeNextMatch) {
  const dateDiff = left.date.localeCompare(right.date)
  if (dateDiff) return dateDiff
  const timeDiff = (left.time || '23:59:59').localeCompare(right.time || '23:59:59')
  if (timeDiff) return timeDiff
  if (left.source !== right.source) return left.source === 'usta' ? -1 : 1
  return left.team.localeCompare(right.team)
}
