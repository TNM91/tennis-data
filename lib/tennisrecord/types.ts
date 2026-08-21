export type TennisRecordDiscipline = 'singles' | 'doubles'
export type TennisRecordSide = 'A' | 'B'
export type TennisRecordSource = 'admin_verified' | 'captain_upload' | 'player_upload' | 'tenaceiq' | 'tennisrecord'

export type TennisRecordParticipant = {
  name: string
  sourcePlayerKey: string
  side: TennisRecordSide
  seat: number
  publishedRating?: number
}

export type TennisRecordMatch = {
  sourceMatchKey: string
  sourceUrl: string
  playedOn: string
  leagueName: string
  flight: string
  homeTeam: string
  awayTeam: string
  discipline: TennisRecordDiscipline
  courtNumber: number
  scoreText: string
  winnerSide: TennisRecordSide | null
  participants: TennisRecordParticipant[]
}

export type TennisRecordPlayer = {
  sourcePlayerKey: string
  name: string
  city: string
  state: string
  ntrpLabel: string
  publishedRating?: number
  sourceUrl: string
}

export type TennisRecordTeam = { sourceTeamKey: string; name: string; leagueName: string; flight: string; seasonYear: number | null; sourceUrl: string }
export type TennisRecordLeague = { sourceLeagueKey: string; name: string; flight: string; seasonYear: number | null; sourceUrl: string }
/**
 * A player explicitly listed by the source on a team roster page. This is
 * source context only; promotion into a TenAceIQ roster remains a separate,
 * higher-confidence decision.
 */
export type TennisRecordTeamMember = {
  teamName: string
  sourcePlayerKey: string
  name: string
  sourceUrl: string
}

export type ParsedTennisRecordPage = {
  players: TennisRecordPlayer[]
  teams: TennisRecordTeam[]
  teamMembers: TennisRecordTeamMember[]
  leagues: TennisRecordLeague[]
  matches: TennisRecordMatch[]
  discoveredUrls: string[]
}

export type TennisRecordRunSummary = {
  status: 'completed' | 'blocked' | 'failed' | 'disabled' | 'skipped' | 'awaiting_seed'
  pagesAttempted: number
  pagesProcessed: number
  playersDiscovered: number
  teamsDiscovered: number
  matchesStaged: number
  canonicalMatchesCreated: number
  duplicatesDetected: number
  conflictsFound: number
  blockedRequests: number
  parserFailures: number
}
