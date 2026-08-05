export type TeamRoomCompletedMatch = {
  id: string
  external_match_id: string | null
  home_team: string | null
  away_team: string | null
  match_date: string | null
  league_name: string | null
  flight: string | null
  winner_side: 'A' | 'B' | null
  score: string | null
  status: string | null
  line_number: string | null
}

export type TeamRoomFinalResult = {
  matchId: string
  externalMatchId: string
  teamName: string
  opponentName: string
  teamScore: string
  opponentScore: string
  score: string
  outcome: 'win' | 'loss' | 'final'
}

type TeamRoomResultScope = {
  matchId?: string
  teamName: string
  leagueName: string
  flight: string
  matchDate: string
  opponent: string
  externalMatchId?: string
}

export function selectTeamRoomCompletedMatch(
  matches: TeamRoomCompletedMatch[],
  scope: TeamRoomResultScope,
) {
  const teamKey = normalizeKey(scope.teamName)
  const opponentKey = normalizeKey(scope.opponent)
  const leagueKey = normalizeKey(scope.leagueName)
  const flightKey = normalizeKey(scope.flight)
  const externalMatchId = clean(scope.externalMatchId)
  const matchId = clean(scope.matchId)
  const candidates = matches.flatMap((match) => {
    if (match.status !== 'completed' || match.line_number || clean(match.match_date) !== scope.matchDate) return []
    const homeKey = normalizeKey(match.home_team)
    const awayKey = normalizeKey(match.away_team)
    const teamSide = homeKey === teamKey ? 'A' : awayKey === teamKey ? 'B' : ''
    if (!teamSide) return []
    const matchedOpponentKey = teamSide === 'A' ? awayKey : homeKey
    const exactRecord = Boolean(matchId && match.id === matchId)
    const exactId = Boolean(externalMatchId && clean(match.external_match_id) === externalMatchId)
    const opponentMatches = Boolean(opponentKey && matchedOpponentKey === opponentKey)
    const leagueMatches = Boolean(leagueKey && normalizeKey(match.league_name) === leagueKey)
    const flightMatches = Boolean(flightKey && normalizeKey(match.flight) === flightKey)
    return [{
      match,
      score: (exactRecord ? 200 : 0) + (exactId ? 100 : 0) + (opponentMatches ? 10 : 0) + (leagueMatches ? 4 : 0) + (flightMatches ? 2 : 0),
    }]
  }).sort((left, right) => right.score - left.score)

  if (!candidates.length) return null
  if (candidates.length > 1 && candidates[0].score === candidates[1].score) return null
  return candidates[0].match
}

export function buildTeamRoomFinalResult(
  match: TeamRoomCompletedMatch,
  teamName: string,
): TeamRoomFinalResult | null {
  const teamKey = normalizeKey(teamName)
  const homeTeam = clean(match.home_team)
  const awayTeam = clean(match.away_team)
  const teamSide = normalizeKey(homeTeam) === teamKey ? 'A' : normalizeKey(awayTeam) === teamKey ? 'B' : ''
  if (!teamSide) return null

  const [homeScore = '', awayScore = ''] = parseTeamScore(match.score)
  const teamScore = teamSide === 'A' ? homeScore : awayScore
  const opponentScore = teamSide === 'A' ? awayScore : homeScore
  const opponentName = teamSide === 'A' ? awayTeam : homeTeam
  const outcome = match.winner_side === teamSide
    ? 'win'
    : match.winner_side && match.winner_side !== teamSide
      ? 'loss'
      : 'final'

  return {
    matchId: match.id,
    externalMatchId: clean(match.external_match_id),
    teamName: teamName.trim() || (teamSide === 'A' ? homeTeam : awayTeam),
    opponentName,
    teamScore,
    opponentScore,
    score: clean(match.score),
    outcome,
  }
}

function parseTeamScore(value: unknown) {
  const match = clean(value).match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/)
  return match ? [match[1], match[2]] : []
}

function normalizeKey(value: unknown) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}
