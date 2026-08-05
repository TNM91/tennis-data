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
  lines: TeamRoomFinalResultLine[]
  unresolvedPlayerCount: number
}

export type TeamRoomCompletedLineMatch = {
  id: string
  external_match_id: string | null
  line_number: string | null
  match_type: string | null
  winner_side: 'A' | 'B' | null
  score: string | null
  status: string | null
}

export type TeamRoomLinePlayer = {
  match_id: string
  player_id: string
  side: 'A' | 'B' | null
  seat: number | null
}

export type TeamRoomPlayerName = {
  id: string
  name: string | null
}

export type TeamRoomFinalResultLine = {
  id: string
  label: string
  teamPlayers: string[]
  opponentPlayers: string[]
  score: string
  winner: 'team' | 'opponent' | 'final'
  teamMissingPlayerCount: number
  opponentMissingPlayerCount: number
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
  const homeTeam = clean(match.home_team)
  const awayTeam = clean(match.away_team)
  const teamSide = getTeamRoomMatchSide(match, teamName)
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
    lines: [],
    unresolvedPlayerCount: 0,
  }
}

export function getTeamRoomMatchSide(
  match: Pick<TeamRoomCompletedMatch, 'home_team' | 'away_team'>,
  teamName: string,
) {
  const teamKey = normalizeKey(teamName)
  return normalizeKey(match.home_team) === teamKey
    ? 'A' as const
    : normalizeKey(match.away_team) === teamKey
      ? 'B' as const
      : null
}

export function buildTeamRoomFinalResultLines({
  matches,
  matchPlayers,
  players,
  teamSide,
  lineupLabels = [],
}: {
  matches: TeamRoomCompletedLineMatch[]
  matchPlayers: TeamRoomLinePlayer[]
  players: TeamRoomPlayerName[]
  teamSide: 'A' | 'B'
  lineupLabels?: string[]
}): TeamRoomFinalResultLine[] {
  const playerNameById = new Map(players.map((player) => [player.id, clean(player.name)]))
  const playersByMatchId = new Map<string, TeamRoomLinePlayer[]>()
  matchPlayers.forEach((player) => {
    const current = playersByMatchId.get(player.match_id) || []
    current.push(player)
    playersByMatchId.set(player.match_id, current)
  })
  const opponentSide = teamSide === 'A' ? 'B' : 'A'

  return matches
    .filter((match) => match.status === 'completed' && clean(match.line_number))
    .sort((left, right) => (lineNumber(left.line_number) ?? Number.MAX_SAFE_INTEGER) - (lineNumber(right.line_number) ?? Number.MAX_SAFE_INTEGER))
    .map((match) => {
      const linePlayers = (playersByMatchId.get(match.id) || [])
        .slice()
        .sort((left, right) => (left.seat ?? 99) - (right.seat ?? 99))
      const namesForSide = (side: 'A' | 'B') => linePlayers
        .filter((player) => player.side === side)
        .map((player) => playerNameById.get(player.player_id) || '')
        .filter(Boolean)
      const expectedPlayersPerSide = clean(match.match_type).toLowerCase() === 'doubles' ? 2 : 1
      const missingForSide = (side: 'A' | 'B') => Math.max(
        0,
        expectedPlayersPerSide - namesForSide(side).length,
      )
      const number = lineNumber(match.line_number)
      const matchType = clean(match.match_type).toLowerCase()
      const fallbackLabel = `${number ? `${number} ` : ''}${matchType === 'doubles' ? 'Doubles' : matchType === 'singles' ? 'Singles' : 'Court'}`

      return {
        id: match.id,
        label: clean(lineupLabels[(number ?? 0) - 1]) || fallbackLabel,
        teamPlayers: namesForSide(teamSide),
        opponentPlayers: namesForSide(opponentSide),
        score: clean(match.score),
        winner: match.winner_side === teamSide
          ? 'team' as const
          : match.winner_side === opponentSide
            ? 'opponent' as const
            : 'final' as const,
        teamMissingPlayerCount: missingForSide(teamSide),
        opponentMissingPlayerCount: missingForSide(opponentSide),
      }
    })
}

function lineNumber(value: unknown) {
  const number = Number(clean(value))
  return Number.isFinite(number) && number > 0 ? number : null
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
